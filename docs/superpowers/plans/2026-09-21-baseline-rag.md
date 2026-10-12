# Baseline Single-Agent RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-agent n8n baseline on mimo-v2.5 with identical tools, wire it behind /api/rag-baseline, and run the 140-query workbook on both systems with full documentation.

**Architecture:** Clone the active GABAY workflow via n8n API and strip the coordinator plus 4 sub-agents down to one baseline agent holding all six tools. Mirror the existing rag route as a baseline route keyed by a second webhook env var. A Python runner posts every workbook query to both systems sequentially and writes results plus comparison.

**Tech Stack:** n8n REST API, mimo-v2.5 via OpenCode OpenAI-compatible node, Express TypeScript, Vitest, Python openpyxl.

**Spec:** docs/superpowers/specs/2026-09-21-baseline-rag-design.md

## Global Constraints

- Baseline model is mimo-v2.5 via the OpenCode node, never Groq.
- Webhook paths are distinct: /webhook/gabay-rag and /webhook/gabay-baseline-rag.
- Qdrant collection is gabay_prototype_rag with domain filters courses, learning, people; same topK as GABAY.
- Progress scoping uses the exact (My student ID is <id>.) suffix with STU-2024-001 in tests.
- L4 refusal text verbatim: I am sorry, but I can only answer questions related to the Gabay LMS prototype. My scope is strictly limited to LMS matters such as courses and enrollment, learning content and assessments, people and calendar, grades and progress. How can I assist you with the LMS today?
- No emojis anywhere. Sequential runs with pauses, never parallel blasts.

---

### Task 1: Clone GABAY workflow as inactive baseline draft

**Files:**
- Create: `scripts/baseline-build.py`
- Test: `python scripts/baseline-build.py --verify-clone`

**Interfaces:**
- Consumes: n8n API key, source workflow id AtgiSrVPbqjgdZ9x.
- Produces: `BASELINE_ID` printed and saved to `scripts/.baseline-id`, clone named exactly `Baseline Single-Agent RAG (Gabay Webhook)`, active=false.

- [ ] **Step 1: Write the failing check**

```python
def baseline_id():
    return open("scripts/.baseline-id").read().strip()
def get_workflow(wid):
    return api("GET", f"/workflows/{wid}")
def test_clone_exists():
    assert get_workflow(baseline_id())["name"] == "Baseline Single-Agent RAG (Gabay Webhook)"
```

- [ ] **Step 2: Run check to verify it fails**

Run: `python scripts/baseline-build.py --verify-clone`
Expected: FAIL with file not found.

- [ ] **Step 3: Write minimal clone**

```python
import urllib.request, json
KEY = open("C:/Users/JV/AppData/Local/Temp/opencode/n8nkey.txt").read().strip()
API = "http://localhost:5678/api/v1"
def api(method, path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, headers={"X-N8N-API-KEY": KEY, "Content-Type": "application/json"}, method=method)
    return json.load(urllib.request.urlopen(req, timeout=30))
src = api("GET", "/workflows/AtgiSrVPbqjgdZ9x")
payload = {"name": "Baseline Single-Agent RAG (Gabay Webhook)", "nodes": src["nodes"], "connections": src["connections"], "settings": src.get("settings", {})}
created = api("POST", "/workflows", payload)
open("scripts/.baseline-id", "w").write(created["id"])
print("BASELINE_ID=" + created["id"])
```

- [ ] **Step 4: Run clone and verify inactive**

Run: `python scripts/baseline-build.py --verify-clone`
Expected: PASS, workflow exists and active=false.

- [ ] **Step 5: Commit**

```bash
git add scripts/baseline-build.py
git commit -m "feat: clone gabay workflow as baseline draft"
```

### Task 2: Strip clone to single baseline agent on mimo-v2.5

**Files:**
- Modify: `scripts/baseline-build.py`
- Test: `python scripts/baseline-build.py --verify-single`

**Interfaces:**
- Consumes: `BASELINE_ID` from Task 1.
- Produces: one agent node `Baseline_Agent` wired to OpenCode mimo-v2.5 plus all six tools, webhook path `gabay-baseline-rag`, workflow active=true.

- [ ] **Step 1: Write the failing check**

```python
def test_single_agent():
    w = get_workflow(baseline_id())
    names = [n["name"] for n in w["nodes"]]
    assert "Baseline_Agent" in names
    assert "Coordinator_Agent" not in names
    assert w["active"] is True
```

- [ ] **Step 2: Run check to verify it fails**

Run: `python scripts/baseline-build.py --verify-single`
Expected: FAIL with Coordinator_Agent still present.

- [ ] **Step 3: Write minimal strip**

```python
REMOVE = {"Coordinator_Agent", "Courses_Agent", "Learning_Agent", "People_Agent", "Progress_Agent", "Coordinator Groq Model (120B)", "Groq Chat Model", "Gemini Flash Coordinator", "NVIDIA Nemotron Coordinator", "Mistral Small Coordinator", "Mistral Small OA"}
w = api("GET", f"/workflows/{bid}")
nodes = [n for n in w["nodes"] if n["name"] not in REMOVE]
for n in nodes:
    if n["name"] == "Gabay Webhook":
        n["parameters"]["path"] = "gabay-baseline-rag"
baseline = {"name": "Baseline_Agent", "type": "@n8n/n8n-nodes-langchain.agent", "typeVersion": 1, "position": [800, 300], "parameters": {"options": {"systemMessage": "You are GABAY baseline, a single agent for the Gabay LMS prototype. Answer only from your tools. Scope is strictly courses and enrollment, learning content and assessments, people and calendar, grades and progress. Refuse anything else with: I am sorry, but I can only answer questions related to the Gabay LMS prototype. My scope is strictly limited to LMS matters such as courses and enrollment, learning content and assessments, people and calendar, grades and progress. How can I assist you with the LMS today?"}}}
nodes.append(baseline)
api("PUT", f"/workflows/{bid}", {"nodes": nodes, "connections": rebuild_single_agent_connections()})
api("POST", f"/workflows/{bid}/activate", {})
```

```python
def rebuild_single_agent_connections():
    link = lambda node: {"main": [[{"node": node, "type": "main", "index": 0}]]}
    return {
        "Gabay Webhook": link("Normalize Input"),
        "Normalize Input": link("Rate Limit Wait"),
        "Rate Limit Wait": link("Baseline_Agent"),
        "Simple Memory": {"ai_memory": [[{"node": "Baseline_Agent", "type": "ai_memory", "index": 0}]]},
        "OpenCode": {"ai_languageModel": [[{"node": "Baseline_Agent", "type": "ai_languageModel", "index": 0}]]},
        "RAG: Courses": {"ai_tool": [[{"node": "Baseline_Agent", "type": "ai_tool", "index": 0}]]},
        "RAG: Learning": {"ai_tool": [[{"node": "Baseline_Agent", "type": "ai_tool", "index": 0}]]},
        "RAG: People": {"ai_tool": [[{"node": "Baseline_Agent", "type": "ai_tool", "index": 0}]]},
        "RAG: Progress": {"ai_tool": [[{"node": "Baseline_Agent", "type": "ai_tool", "index": 0}]]},
        "Analytical Count": {"ai_tool": [[{"node": "Baseline_Agent", "type": "ai_tool", "index": 0}]]},
        "RAG: Analytics": {"ai_tool": [[{"node": "Baseline_Agent", "type": "ai_tool", "index": 0}]]},
    }
```

Keeps Normalize Input to Rate Limit Wait to Baseline_Agent, OpenCode mimo-v2.5 to Baseline_Agent ai_languageModel, all six tools to Baseline_Agent ai_tool, memory to ai_memory.

- [ ] **Step 4: Run check plus one-query smoke test**

Run: `python scripts/baseline-build.py --verify-single`
Expected: PASS. Then POST one L1 query to the baseline webhook and confirm a non-empty LMS reply.

- [ ] **Step 5: Commit**

```bash
git add scripts/baseline-build.py
git commit -m "feat: single-agent baseline on mimo-v2.5"
```

### Task 3: Server wiring for /api/rag-baseline

**Files:**
- Create: `server/src/routes/ragBaseline.ts`
- Modify: `server/src/index.ts:19-21,54-56`
- Modify: `server/.env.example:11-13`
- Test: `server/src/routes/ragBaseline.test.ts`

**Interfaces:**
- Consumes: `rag.ts` exports `normalizeReply`, `extractChart`, intent helpers.
- Produces: `ragBaselineRouter` mounted at `/api/rag-baseline` with POST /chat and GET /progress/:sessionId reading `N8N_BASELINE_WEBHOOK_URL`.

- [ ] **Step 1: Write the failing test**

```ts
import request from "supertest";
import express from "express";
import { ragBaselineRouter } from "./ragBaseline.js";
const app = express(); app.use(express.json()); app.use("/api/rag-baseline", ragBaselineRouter);
it("401s without token", async () => {
  const res = await request(app).post("/api/rag-baseline/chat").send({ message: "hi" });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/ragBaseline.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal route**

```ts
import { Router } from "express";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { authenticateToken } from "../middleware/auth.js";
import { normalizeReply } from "./rag.js";
export const ragBaselineRouter = Router();
function baselineUrl(): string {
  const url = process.env.N8N_BASELINE_WEBHOOK_URL?.trim();
  if (!url) throw new ApiError(502, "rag_unavailable", "Baseline webhook is not configured.");
  return url;
}
ragBaselineRouter.post("/chat", authenticateToken, asyncHandler(async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) throw new ApiError(400, "bad_request", "Message is required.");
  const user = (req as unknown as { user: { sub: string; role: string } }).user;
  const sessionId = typeof req.body?.sessionId === "string" && req.body.sessionId.trim() ? req.body.sessionId.trim() : "default-session";
  const chatInput = `${message} (My student ID is ${user.sub}.)`;
  const r = await fetch(baselineUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatInput, message: chatInput, sessionId, userId: user.sub, role: user.role }) });
  const data = await r.json();
  const norm = normalizeReply(data, message);
  res.json({ ...norm, sessionId });
}));
```

Mount in index.ts plus document `N8N_BASELINE_WEBHOOK_URL=""` in .env.example.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/routes/ragBaseline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/ragBaseline.ts server/src/routes/ragBaseline.test.ts server/src/index.ts server/.env.example
git commit -m "feat: baseline rag route"
```

### Task 4: Runner plus 280-run evaluation and docs

**Files:**
- Create: `scripts/run-benchmark.py`
- Create: `docs-other-outputs/Gabay-RAG-140-Results.xlsx`
- Create: `docs-other-outputs/Gabay-RAG-140-run-log.jsonl`
- Test: `python scripts/run-benchmark.py --smoke`

**Interfaces:**
- Consumes: workbook from `scripts/gen-rag-benchmark.py --check` PASS, both webhooks live, Task 3 routes.
- Produces: results workbook with System column plus comparison sheet with Relative Performance Improvement per metric.

- [ ] **Step 1: Write the failing smoke check**

```python
def test_smoke_files():
    assert load_results()["rows"] == 8  # 4 queries x 2 systems
```

- [ ] **Step 2: Run smoke to verify it fails**

Run: `python scripts/run-benchmark.py --smoke`
Expected: FAIL with file not found.

- [ ] **Step 3: Write minimal runner**

```python
import time, json, openpyxl, urllib.request
SYSTEMS = {"gabay": "http://localhost:4000/api/rag/chat", "baseline": "http://localhost:4000/api/rag-baseline/chat"}
TOKEN = open("C:/Users/JV/AppData/Local/Temp/opencode/gabaytoken.txt").read().strip()
def post(system, text, session):
    body = json.dumps({"message": text, "sessionId": session}).encode()
    req = urllib.request.Request(SYSTEMS[system], data=body, headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN})
    return json.load(urllib.request.urlopen(req, timeout=120))
import openpyxl as _oxl
WB = "docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx"
def find_query(sheet, qid):
    ws = _oxl.load_workbook(WB)[sheet]
    keys = [c.value for c in ws[1]]
    for row in list(ws.rows)[1:]:
        d = dict(zip(keys, [c.value for c in row]))
        if d["QueryID"] == qid:
            return d
    raise KeyError(qid)
def send_text(row):
    return row["QueryText"] if "My student ID" in row["QueryText"] else row["QueryText"]
def log_jsonl(obj):
    open("docs-other-outputs/Gabay-RAG-140-run-log.jsonl", "a").write(json.dumps(obj) + "\n")
def load_results():
    return {"rows": sum(1 for _ in open("docs-other-outputs/Gabay-RAG-140-run-log.jsonl"))}
SMOKE = [("Retrieval", "RET-01"), ("Response", "RES-01"), ("Reasoning", "REA-01"), ("Report", "REP-01")]
for sheet, qid in SMOKE:
    for system in ("gabay", "baseline"):
        row = find_query(sheet, qid)
        out = post(system, send_text(row), f"smoke-{qid}-{system}")
        log_jsonl({"system": system, "qid": qid, "reply": out.get("reply", "")[:2000]})
        time.sleep(3)
```

Full mode iterates all 140 per system sequentially with 3s pauses, resume via `--resume-after QID`, then scores deterministic columns and writes comparison means.

- [ ] **Step 4: Run smoke to verify it passes**

Run: `python scripts/run-benchmark.py --smoke`
Expected: PASS with 8 logged rows and both systems replying.

- [ ] **Step 5: Run full evaluation and commit**

```bash
python scripts/run-benchmark.py --full
git add scripts/run-benchmark.py docs-other-outputs/Gabay-RAG-140-Results.xlsx docs-other-outputs/Gabay-RAG-140-run-log.jsonl
git commit -m "feat: 280-run benchmark results"
```
