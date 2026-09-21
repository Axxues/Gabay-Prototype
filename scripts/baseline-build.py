"""Clone GABAY workflow as inactive baseline draft (Task 1).

Usage:
    python scripts/baseline-build.py --verify-clone   # validate clone exists, name exact, active=false
    python scripts/baseline-build.py                  # build clone from source via n8n API
"""

import json
import sys
import urllib.request
import urllib.error

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


if __name__ == "__main__":
    if "--verify-clone" in sys.argv:
        sys.exit(verify_clone())
    build_clone()
