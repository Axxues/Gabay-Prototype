"""Clone GABAY workflow as inactive baseline draft (Task 1) + strip to single agent (Task 2).

Usage:
    python scripts/baseline-build.py --verify-clone   # validate clone exists, name exact, active=false
    python scripts/baseline-build.py --verify-single  # validate single-agent baseline, active=true
    python scripts/baseline-build.py                  # build clone from source via n8n API
    python scripts/baseline-build.py --strip          # strip clone to single agent + activate
    python scripts/baseline-build.py --smoke          # one-query smoke test against baseline webhook
"""

import json
import sys
import urllib.request
import urllib.error
import uuid

API = "http://localhost:5678/api/v1"
KEY_PATH = "C:/Users/JV/AppData/Local/Temp/opencode/n8nkey.txt"
SOURCE_ID = "AtgiSrVPbqjgdZ9x"
CLONE_NAME = "Baseline Single-Agent RAG (Gabay Webhook)"
ID_PATH = "scripts/.baseline-id"


def _read_key():
    with open(KEY_PATH, "r", encoding="utf-8") as f:
        return f.read().strip()


def api(method, path, body=None):
    key = _read_key()
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        API + path,
        data=data,
        headers={"X-N8N-API-KEY": key, "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8") or "{}"
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"n8n API {method} {path} failed: {e.code} {detail}")


def baseline_id():
    with open(ID_PATH, "r", encoding="utf-8") as f:
        return f.read().strip()


def get_workflow(wid):
    return api("GET", f"/workflows/{wid}")


def verify_clone():
    bid = baseline_id()
    if not bid:
        print("FAIL: baseline id is empty")
        return 1
    w = get_workflow(bid)
    name = w.get("name")
    if name != CLONE_NAME:
        print(f"FAIL: expected name {CLONE_NAME!r}, got {name!r}")
        return 1
    if w.get("active") is not False:
        print(f"FAIL: expected active=false, got active={w.get('active')!r}")
        return 1
    print(f"PASS: clone {bid} name matches and active=false")
    return 0


REMOVE = {
    "Coordinator_Agent",
    "Courses_Agent",
    "Learning_Agent",
    "People_Agent",
    "Progress_Agent",
    "Coordinator Groq Model (120B)",
    "Groq Chat Model",
    "Gemini Flash Coordinator",
    "NVIDIA Nemotron Coordinator",
    "Mistral Small Coordinator",
    "Mistral Small OA",
}

BASELINE_SYSTEM_MESSAGE = (
    "You are GABAY baseline, a single agent for the Gabay LMS prototype. "
    "Answer only from your tools. "
    "Scope is strictly courses and enrollment, learning content and assessments, "
    "people and calendar, grades and progress. "
    "Refuse anything else with: "
    "I am sorry, but I can only answer questions related to the Gabay LMS prototype. "
    "My scope is strictly limited to LMS matters such as courses and enrollment, "
    "learning content and assessments, people and calendar, grades and progress. "
    "How can I assist you with the LMS today? "
    "For grades and progress, copy the student_id exactly from the sentence "
    "\"(My student ID is <id>.)\" at the end of the user message "
    "(never invent one, never ask the user for it) and use the user's question as the query."
)

BASELINE_WEBHOOK_PATH = "gabay-baseline-rag"


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
        # Plan deviation (runtime-required): the plan's rebuild omits the
        # Embeddings node, but the Qdrant tools fail without it
        # ("A Embedding sub-node must be connected and enabled").
        # Same links as the source workflow.
        "Embeddings HuggingFace Inference": {
            "ai_embedding": [
                [
                    {"node": "RAG: Courses", "type": "ai_embedding", "index": 0},
                    {"node": "RAG: Learning", "type": "ai_embedding", "index": 0},
                    {"node": "RAG: People", "type": "ai_embedding", "index": 0},
                ]
            ]
        },
    }


def verify_single():
    bid = baseline_id()
    if not bid:
        print("FAIL: baseline id is empty")
        return 1
    w = get_workflow(bid)
    names = [n["name"] for n in w["nodes"]]
    if "Baseline_Agent" not in names:
        print("FAIL: Baseline_Agent missing")
        return 1
    if "Coordinator_Agent" in names:
        print("FAIL: Coordinator_Agent still present")
        return 1
    leftovers = sorted(n for n in names if n in REMOVE)
    if leftovers:
        print(f"FAIL: removed nodes still present: {leftovers}")
        return 1
    for n in w["nodes"]:
        if n["name"] == "Gabay Webhook":
            path = n.get("parameters", {}).get("path")
            if path != BASELINE_WEBHOOK_PATH:
                print(f"FAIL: webhook path {path!r} != {BASELINE_WEBHOOK_PATH!r}")
                return 1
    if w.get("active") is not True:
        print(f"FAIL: expected active=true, got active={w.get('active')!r}")
        return 1
    print(f"PASS: single-agent baseline {bid} active with Baseline_Agent")
    return 0


def build_clone():
    src = get_workflow(SOURCE_ID)
    payload = {
        "name": CLONE_NAME,
        "nodes": src["nodes"],
        "connections": src["connections"],
        "settings": src.get("settings", {}),
    }
    created = api("POST", "/workflows", payload)
    new_id = created.get("id", "")
    if not new_id:
        raise RuntimeError(f"clone POST returned no id: {created}")
    with open(ID_PATH, "w", encoding="utf-8") as f:
        f.write(str(new_id))
    print("BASELINE_ID=" + str(new_id))
    return str(new_id)


def strip_clone():
    bid = baseline_id()
    if not bid:
        print("FAIL: baseline id is empty")
        return 1
    if bid == SOURCE_ID:
        print(f"FAIL: refusing to touch source workflow {SOURCE_ID}")
        return 1
    w = get_workflow(bid)
    nodes = [n for n in w["nodes"] if n["name"] not in REMOVE]
    nodes = [n for n in nodes if n["name"] != "Baseline_Agent"]
    for n in nodes:
        # Every node carries a webhookId copied verbatim by the Task 1 clone;
        # any duplicate of an active trigger (chat trigger, wait, webhook)
        # makes n8n refuse activation with 409. Fresh ids, clone-only change.
        if "webhookId" in n:
            n["webhookId"] = str(uuid.uuid4())
        if n["name"] == "Gabay Webhook":
            n["parameters"]["path"] = BASELINE_WEBHOOK_PATH
            # webhookId must be unique vs the source workflow's "gabay-rag"
            # or activation returns 409; path itself stays exactly gabay-baseline-rag.
            n["webhookId"] = BASELINE_WEBHOOK_PATH
        # Task 1 cloned node ids verbatim, so the clone's trigger node ids
        # equal the source's; n8n keys webhook registration by node id.
        # Fresh ids, clone-only change; connections reference nodes by name.
        if n["name"] in ("Gabay Webhook", "When chat message received"):
            n["id"] = str(uuid.uuid4())
    # Plan deviation (runtime-required): plan snippet says typeVersion 1, but V1
    # defaults to Conversational Agent which rejects the structured RAG tools
    # ("please use Tools Agent instead"). 1.7 matches Coordinator_Agent and
    # supports direct ai_tool/ai_languageModel/ai_memory wiring.
    baseline = {
        "name": "Baseline_Agent",
        "type": "@n8n/n8n-nodes-langchain.agent",
        "typeVersion": 1.7,
        "position": [800, 300],
        "parameters": {
            "options": {"systemMessage": BASELINE_SYSTEM_MESSAGE, "maxIterations": 8}
        },
    }
    nodes.append(baseline)
    payload = {
        "name": w.get("name", CLONE_NAME),
        "nodes": nodes,
        "connections": rebuild_single_agent_connections(),
        "settings": w.get("settings", {}),
    }
    api("PUT", f"/workflows/{bid}", payload)
    api("POST", f"/workflows/{bid}/activate", {})
    print(f"STRIPPED_AND_ACTIVATED={bid}")
    return 0


def smoke_test():
    import urllib.request

    url = "http://localhost:5678/webhook/" + BASELINE_WEBHOOK_PATH
    query = "List available courses (My student ID is STU-2024-001.)"
    body = json.dumps(
        {
            "chatInput": query,
            "message": query,
            "sessionId": "task2-smoke",
            "userId": "STU-2024-001",
            "role": "student",
        }
    ).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        print(f"FAIL: smoke POST {e.code} {detail[:2000]}")
        return 1
    text = raw.strip()
    if not text:
        print("FAIL: smoke reply empty")
        return 1
    print(f"PASS: smoke reply {len(text)} chars: {text[:500]}")
    return 0


if __name__ == "__main__":
    if "--verify-clone" in sys.argv:
        sys.exit(verify_clone())
    if "--verify-single" in sys.argv:
        sys.exit(verify_single())
    if "--strip" in sys.argv:
        sys.exit(strip_clone())
    if "--smoke" in sys.argv:
        sys.exit(smoke_test())
    build_clone()
