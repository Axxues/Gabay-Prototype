"""Benchmark runner: 140 workbook queries x 2 systems (gabay + baseline) = 280 runs.

Deterministic scoring only (routing / tool / refusal / schema).
Sampled LLM-judge scoring is out of scope for this task.

Usage:
    python scripts/run-benchmark.py --smoke            # 4 queries x 2 systems = 8 rows
    python scripts/run-benchmark.py --full             # 140 queries x 2 systems = 280 rows
    python scripts/run-benchmark.py --full --resume-after QID   # resume after QID

Auth: logs in at runtime as student1@dmmmsu.edu.ph / gabay2026 and keeps
the JWT in memory only (never written to the repo).
Sequential calls with 3s pauses; retry once on error then mark error and continue.
"""

import concurrent.futures
import json
import sys
import threading
import time
import urllib.request
import urllib.error

import openpyxl

SYSTEMS = {
    "gabay": "http://localhost:4000/api/rag/chat",
    "baseline": "http://localhost:4000/api/rag-baseline/chat",
}

LOGIN_URL = "http://localhost:4000/api/auth/login"
LOGIN_EMAIL = "student1@dmmmsu.edu.ph"
LOGIN_PASSWORD = "gabay2026"

WORKBOOK_PATH = "docs-other-outputs/Gabay-RAG-140-Benchmark-Queries-v2.xlsx"
RESULTS_PATH = "docs-other-outputs/Gabay-RAG-140-Results.xlsx"
LOG_PATH = "docs-other-outputs/Gabay-RAG-140-run-log.jsonl"

PAUSE_SECONDS = 3
CALL_TIMEOUT = 600
WORKERS = 4

_log_lock = threading.Lock()

L4_REFUSAL_TEXT = (
    "I am sorry, but I can only answer questions related to the Gabay LMS "
    "prototype. My scope is strictly limited to LMS matters such as courses "
    "and enrollment, learning content and assessments, people and calendar, "
    "grades and progress. How can I assist you with the LMS today?"
)

SHEET_ORDER = ["Retrieval", "Response", "Reasoning", "Report"]

SMOKE = [("Retrieval", "RET-01"), ("Response", "RES-01"), ("Reasoning", "REA-01"), ("Report", "REP-01")]

RESULTS_HEADER = [
    "System", "Sheet", "QueryID", "QueryText", "Complexity", "ExpectedAgent",
    "ExpectedTool", "GroundTruthSource", "PrimaryMetric", "Reply",
    "Success", "RefusalCorrect", "RoutingMatch", "ToolHit", "SchemaOK",
    "LatencyMs", "Tokens", "Error",
]


def api_post(url, body, token=None):
    data = json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=CALL_TIMEOUT) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            detail = exc.read().decode()[:500]
        except Exception:
            detail = ""
        raise RuntimeError(f"HTTP {exc.code}: {detail}")


def login():
    status, data = api_post(LOGIN_URL, {"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD})
    token = data.get("token", "")
    if not token:
        raise RuntimeError("login returned no token")
    return token


def find_query(sheet, qid):
    ws = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)[sheet]
    rows = list(ws.rows)
    keys = [c.value for c in rows[0]]
    for row in rows[1:]:
        d = dict(zip(keys, [c.value for c in row]))
        if d.get("QueryID") == qid:
            return d
    raise KeyError(f"{sheet}/{qid} not found")


def all_queries():
    out = []
    wb = openpyxl.load_workbook(WORKBOOK_PATH, read_only=True)
    for sheet in SHEET_ORDER:
        ws = wb[sheet]
        rows = list(ws.rows)
        keys = [c.value for c in rows[0]]
        for row in rows[1:]:
            d = dict(zip(keys, [c.value for c in row]))
            d["_sheet"] = sheet
            out.append(d)
    return out


def send_text(row):
    # Server appends "(My student ID is <sub>.)" itself; send workbook text verbatim.
    return row["QueryText"]


def post(system, text, session, token):
    body = {"message": text, "sessionId": session}
    _, data = api_post(SYSTEMS[system], body, token)
    return data


def log_jsonl(obj, path=LOG_PATH):
    with _log_lock:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(obj, ensure_ascii=False) + "\n")


def load_results(path=LOG_PATH):
    with open(path, encoding="utf-8") as fh:
        rows = [json.loads(line) for line in fh if line.strip()]
    return {"rows": len(rows), "records": rows}


def task_labels(out):
    try:
        tasks = (out.get("execution") or {}).get("tasks") or []
        return [t.get("label", "") for t in tasks if isinstance(t, dict)]
    except Exception:
        return []


def score_refusal(reply, complexity):
    if complexity == "L4":
        return int(reply.strip() == L4_REFUSAL_TEXT)
    return int(L4_REFUSAL_TEXT not in reply)


def score_routing(system, expected_agent, labels):
    if system == "baseline":
        # Single-agent system: the only agent is Baseline_Agent by construction.
        return int("Baseline_Agent" in labels)
    sub_agents = [l for l in labels if l.endswith("_Agent") and l != "Coordinator_Agent"]
    if expected_agent == "Coordinator-direct":
        return int(len(sub_agents) == 0)
    return int(f"{expected_agent}_Agent" in labels)


TOOL_LABEL_HINTS = {
    "RAG Courses": ("RAG: Courses",),
    "RAG Learning": ("RAG: Learning",),
    "RAG People": ("RAG: People",),
    "RAG Progress": ("RAG: Progress",),
    "Analytical Count": ("Analytical Count",),
    "Analytics": ("Analytics",),  # observed as "RAG: Analytics"
}


def _has_tool_label(labels):
    return any(
        l.startswith("RAG") or l == "Analytical Count" or "Analytics" in l
        for l in labels
    )


def score_tool(system, expected_tool, labels):
    if system == "baseline":
        # Server telemetry only surfaces Baseline_Agent (tool children of the
        # single agent are filtered from the tasks list), so tool choice is
        # unobservable via the API for baseline. Recorded as None.
        return None
    if expected_tool in (None, "", "None"):
        return int(not _has_tool_label(labels))
    hints = TOOL_LABEL_HINTS.get(expected_tool, (expected_tool,))
    return int(any(any(h in l for l in labels) for h in hints))


def score_schema(sheet, complexity, reply):
    if sheet != "Report" or complexity == "L4":
        return None
    has_table = "|" in reply
    has_bullets = any(
        line.strip().startswith(("- ", "* ")) for line in reply.splitlines()
    )
    return int(has_table or has_bullets)


def run_once(system, row, sheet, token):
    qid = row["QueryID"]
    session = f"bench-{qid}-{system}"
    text = send_text(row)
    started = time.time()
    out = None
    error = ""
    for attempt in (1, 2):
        try:
            out = post(system, text, session, token)
            reply = str((out or {}).get("reply", ""))
            if reply.strip():
                error = ""
                break
            error = "empty reply"
        except Exception as exc:  # retry once, then mark error and continue
            error = str(exc)[:500]
            out = out or {}
        if attempt == 1:
            time.sleep(5)
    latency_ms = int((time.time() - started) * 1000)
    reply = str((out or {}).get("reply", ""))
    labels = task_labels(out or {})
    tokens = None
    try:
        tokens = (out.get("execution") or {}).get("totalTokens")
    except Exception:
        tokens = None
    success = int(bool(reply.strip()) and not error)
    record = {
        "system": system,
        "sheet": sheet,
        "qid": qid,
        "complexity": row.get("Complexity"),
        "expected_agent": row.get("ExpectedAgent"),
        "expected_tool": row.get("ExpectedTool"),
        "ground_truth_source": row.get("GroundTruthSource"),
        "primary_metric": row.get("PrimaryMetric"),
        "session": session,
        "latency_ms": latency_ms,
        "tokens": tokens,
        "task_labels": labels,
        "success": success,
        "refusal_correct": score_refusal(reply, row.get("Complexity")),
        "routing_match": score_routing(system, row.get("ExpectedAgent"), labels),
        "tool_hit": score_tool(system, row.get("ExpectedTool"), labels),
        "schema_ok": score_schema(sheet, row.get("Complexity"), reply),
        "error": error,
        "reply": reply[:30000],
    }
    return record


def _run_single(args):
    system, row, sheet, token, log_path = args
    record = run_once(system, row, sheet, token)
    record["query_text"] = row["QueryText"]
    log_jsonl(record, path=log_path)
    status = "OK" if record["success"] else f"ERR {record['error'][:120]}"
    with _log_lock:
        print(
            f"{system:8s} {row['QueryID']:8s} {status} "
            f"lat={record['latency_ms']}ms refusal={record['refusal_correct']} "
            f"route={record['routing_match']} tool={record['tool_hit']} "
            f"schema={record['schema_ok']}",
            flush=True,
        )
    return record


def run_items(items, token, log_path=LOG_PATH):
    jobs = []
    for sheet, qid in items:
        row = find_query(sheet, qid)
        for system in ("gabay", "baseline"):
            jobs.append((system, row, sheet, token, log_path))
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        list(pool.map(_run_single, jobs))


def mean(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    return sum(values) / len(values)


def write_results(records, path=RESULTS_PATH):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Runs"
    ws.append(RESULTS_HEADER)
    for r in records:
        ws.append([
            r["system"], r["sheet"], r["qid"], r.get("query_text", ""),
            r["complexity"], r["expected_agent"], r["expected_tool"],
            r["ground_truth_source"], r["primary_metric"], r["reply"],
            r["success"], r["refusal_correct"], r["routing_match"],
            r["tool_hit"], r["schema_ok"], r["latency_ms"], r["tokens"],
            r["error"],
        ])
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions

    metrics = ["success", "refusal_correct", "routing_match", "tool_hit", "schema_ok",
               "latency_ms", "tokens"]
    comp = wb.create_sheet("Comparison")
    comp.append(["Metric", "GabayMean", "BaselineMean", "RPI_Percent_Gabay_vs_Baseline"])
    for m in metrics:
        g = mean([r[m] for r in records if r["system"] == "gabay"])
        b = mean([r[m] for r in records if r["system"] == "baseline"])
        if g is None or b in (None, 0):
            rpi = "n/a"
        else:
            rpi = round((g - b) / abs(b) * 100, 2)
        comp.append([m,
                     round(g, 4) if g is not None else "n/a",
                     round(b, 4) if b is not None else "n/a",
                     rpi])
    comp.append([])
    comp.append(["Note", "RPI = (gabay - baseline) / |baseline| * 100. "
                 "For latency_ms lower is better (negative RPI favors gabay). "
                 "tool_hit is gabay-only (baseline tool choice unobservable via API telemetry); "
                 "baseline routing_match is degenerate (single agent by construction)."])
    wb.save(path)
    print(f"wrote {path} ({len(records)} rows)")


def workbook_check():
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "gen_rag_benchmark", "scripts/gen-rag-benchmark-v2.py")
    gen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gen)
    errors = gen.check_workbook()
    total = sum(len(gen.load_sheet(n)) for n in gen.SHEET_NAMES)
    print(f"workbook total rows: {total}")
    if errors or total != 140:
        for line in errors:
            print(line)
        print("FAIL workbook check")
        return False
    print("PASS workbook check (140)")
    return True


def main(argv):
    global WORKERS, LOG_PATH, RESULTS_PATH
    if "--workers" in argv:
        WORKERS = int(argv[argv.index("--workers") + 1])
    if "--log-path" in argv:
        LOG_PATH = argv[argv.index("--log-path") + 1]
    if "--results-path" in argv:
        RESULTS_PATH = argv[argv.index("--results-path") + 1]
    subset_stride = 0
    subset_offset = 0
    if "--subset-half" in argv:
        subset_stride = 2
    if "--subset-second-half" in argv:
        subset_stride = 2
        subset_offset = 1
    if "--smoke" in argv:
        token = login()
        print("login ok (JWT in memory only)")
        open(LOG_PATH, "w", encoding="utf-8").write("")
        run_items(SMOKE, token, LOG_PATH)
        data = load_results()
        n = data["rows"]
        ok = (
            n == 8
            and all(r.get("success") for r in data["records"])
            and {r.get("system") for r in data["records"]} == {"gabay", "baseline"}
        )
        print(f"smoke rows: {n}")
        if ok:
            print("PASS smoke: 8 rows, both systems replied")
            return 0
        print("FAIL smoke: expected 8 successful rows (4 queries x 2 systems)")
        return 1

    if "--full" in argv:
        resume_after = None
        if "--resume-after" in argv:
            idx = argv.index("--resume-after")
            try:
                resume_after = argv[idx + 1]
            except IndexError:
                print("FAIL: --resume-after requires a QID")
                return 1
        print("workbook check (before):")
        if not workbook_check():
            return 1
        token = login()
        print("login ok (JWT in memory only)")
        queries = all_queries()
        print(f"queries loaded: {len(queries)}")
        items = [(q["_sheet"], q["QueryID"]) for q in queries]
        if subset_stride:
            kept, counters = [], {}
            for sheet, qid in items:
                counters[sheet] = counters.get(sheet, 0)
                if counters[sheet] % subset_stride == subset_offset:
                    kept.append((sheet, qid))
                counters[sheet] += 1
            items = kept
            print(f"subset stride {subset_stride}: {len(items)} query items")
        if resume_after:
            if resume_after not in [qid for _, qid in items]:
                print(f"FAIL: resume QID {resume_after} not in workbook order")
                return 1
            skip = True
            kept = []
            for item in items:
                if skip:
                    if item[1] == resume_after:
                        skip = False
                    continue
                kept.append(item)
            items = kept
            print(f"resuming after {resume_after}: {len(items)} query items remain")
        else:
            open(LOG_PATH, "w", encoding="utf-8").write("")
        run_items(items, token, LOG_PATH)
        data = load_results(LOG_PATH)
        print(f"total logged rows: {data['rows']}")
        write_results(data["records"], RESULTS_PATH)
        print("workbook check (after):")
        if not workbook_check():
            return 1
        return 0

    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
