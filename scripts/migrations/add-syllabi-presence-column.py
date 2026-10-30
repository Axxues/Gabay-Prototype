#!/usr/bin/env python3
"""
Move syllabus collaboration presence out of `syllabi.content`.

Presence heartbeats used to read the draft row, merge presence into the parsed
JSON and write the whole `content` column back. A heartbeat whose read happened
just before a content save would therefore overwrite the newer syllabus data
with the older copy it had read - edits silently disappeared ("sometimes the
contents isn't saving").

A dedicated nullable `presence` JSON column lets heartbeats write presence
without touching `content`. Older drafts keep working: readers fall back to
`content.presence` when the new column is null.

Idempotent: skips when the field already exists.
Usage: LIKHA_TOKEN=... python scripts/migrations/add-syllabi-presence-column.py
"""

import json
import os
import sys
import urllib.error
import urllib.request

LIKHA_URL = os.environ.get("LIKHA_URL", "https://gabay.zyberlab.com").rstrip("/")
LIKHA_TOKEN = os.environ.get("LIKHA_TOKEN", "")

if not LIKHA_TOKEN:
    sys.exit("LIKHA_TOKEN is required (never commit it).")

HEADERS = {
    "Authorization": f"Bearer {LIKHA_TOKEN}",
    "Content-Type": "application/json",
    "User-Agent": "curl/8.5.0",
}


def api_request(path, method="GET", payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(LIKHA_URL + path, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return {"ok": True, "status": resp.status, "data": json.loads(raw) if raw else {}}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return {"ok": False, "status": e.code, "data": parsed}


def main():
    fields = api_request("/fields/syllabi")
    if not fields["ok"]:
        sys.exit(f"Cannot read syllabi fields: {fields['status']} {fields['data']}")
    existing = {f["field"] for f in fields["data"].get("data", [])}

    if "presence" in existing:
        print("skip   syllabi.presence (exists)")
    else:
        res = api_request(
            "/fields/syllabi",
            method="POST",
            payload={
                "field": "presence",
                "type": "json",
                "meta": {"interface": "input-code", "note": "Ephemeral collaborator presence"},
                "schema": {"is_nullable": True},
            },
        )
        if not res["ok"]:
            sys.exit(f"FAILED syllabi.presence: {res['status']} {json.dumps(res['data'])[:400]}")
        print(f"create syllabi.presence -> {res['status']}")

    cache = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print(f"cache clear: {cache['status']}")


if __name__ == "__main__":
    main()
