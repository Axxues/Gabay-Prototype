#!/usr/bin/env python3
"""Read-only recon: snapshot schemas needed for the assessment collection split.

Dumps field lists (name/type/meta essentials) for the assessment-related
collections to scripts/migrations/_recon-assessment-schemas.json so the split
migration can be authored against the real live shape. No writes performed.

Usage:
    LIKHA_TOKEN=... python scripts/migrations/recon-assessment-schemas.py
Also reports row counts by assessment_type in `activities`.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from urllib.parse import quote

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
            content = resp.read().decode("utf-8")
            return {"ok": True, "status": resp.status, "data": json.loads(content) if content else {}}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return {"ok": False, "status": e.code, "data": parsed}


COLLECTIONS = [
    "activities",
    "quizzes",
    "module_items",
    "submissions",
    "assessment_questions",
    "rubric_criteria",
]


def main():
    out = {}
    for col in COLLECTIONS:
        res = api_request(f"/fields/{col}")
        if not res["ok"]:
            print(f"FAILED {col}: {res['status']} {json.dumps(res['data'])[:200]}")
            out[col] = {"error": res["status"]}
            continue
        fields = []
        for f in res["data"].get("data", []):
            fmeta = f.get("meta") or {}
            fschema = f.get("schema") or {}
            rel = (f.get("meta") or {}).get("relation")
            entry = {
                "field": f["field"],
                "type": f.get("type"),
                "interface": fmeta.get("interface"),
                "special": fmeta.get("special"),
                "nullable": (fschema or {}).get("is_nullable"),
                "fk": (fschema or {}).get("foreign_key_collection") or (fschema or {}).get("foreign_key_table"),
            }
            if f.get("meta") and f["meta"].get("collection_key"):
                entry["relation"] = f["meta"].get("collection_key")
            fields.append(entry)
        out[col] = {"fields": fields}
        print(
            f"{col}: {len(fields)} fields: "
            + ", ".join(f"{x['field']}:{x['type']}" + (f"(rel->{x['fk']})" if x["fk"] else "") for x in fields)
        )

    # Row counts in activities grouped by assessment_type (via items fetch, tolerating errors)
    res = api_request("/items/activities?fields=id,assessment_type,course_id&limit=2000")
    if res["ok"]:
        rows = res["data"].get("data", [])
        from collections import Counter
        counts = Counter((r.get("assessment_type") or "<null>") for r in rows)
        out["_activityRowCounts"] = dict(counts)
        print("activities rows:", dict(counts))
        course_ids = {r.get("course_id") for r in rows}
        out["_courses"] = sorted(c for c in course_ids if c)
        print("distinct courses:", len(course_ids))
    else:
        print("activities count FAILED:", res["status"], json.dumps(res["data"])[:300])

    # module_items shape sample (2 rows) to see how assessment links are stored
    res = api_request("/items/module_items?limit=3")
    if res["ok"]:
        sample = res["data"].get("data", [])
        out["_moduleItemSample"] = sample
        print("module_items sample keys:", sorted({k for r in sample for k in r.keys()}))

    snap = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_recon-assessment-schemas.json")
    with open(snap, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2)
    print("snapshot written:", snap)


if __name__ == "__main__":
    main()
