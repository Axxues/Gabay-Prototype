#!/usr/bin/env python3
"""
Complete the assessment grading tables.

`submissions`, `submission_comments` and `submission_rubric_scores` exist on the
live Directus instance, but `submission_comments` / `submission_rubric_scores`
were stubs with only an `id` column, and `submissions` was missing `feedback`.
Directus answers a query on a non-existent field with HTTP 403
("You don't have permission to access field 'x' ... or it does not exist"), so
every student load of a submission detail 403'd.

This script only ADDS missing scalar fields (no relations, no PATCH /relations,
no deletes). It is idempotent: existing fields are skipped.

Usage:
    LIKHA_TOKEN=... python scripts/migrations/fix-assessment-grading-columns.py

Safety: User-Agent is set for the Cloudflare WAF, all filter params are
URL-encoded, and the system cache is cleared at the end.
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
            content = resp.read().decode("utf-8")
            return {"ok": True, "status": resp.status, "data": json.loads(content) if content else {}}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return {"ok": False, "status": e.code, "data": parsed}


# (collection, field, type, schema overrides, meta)
FIELDS = [
    # Feedback thread rows read by the student activity/assignment pages.
    ("submission_comments", "submission_id", "string", {"max_length": 255},
     {"interface": "input", "width": "half", "note": "Submissions.id"}),
    ("submission_comments", "author_id", "string", {"max_length": 255},
     {"interface": "input", "width": "half", "note": "Directus user id or student id"}),
    ("submission_comments", "author_name", "string", {"max_length": 255},
     {"interface": "input", "width": "half"}),
    ("submission_comments", "author_role", "string", {"max_length": 50},
     {"interface": "select-dropdown", "options": {"choices": [
         {"text": "Instructor", "value": "faculty"},
         {"text": "Student", "value": "student"},
     ]}, "width": "half"}),
    ("submission_comments", "content", "text", {},
     {"interface": "input-multiline"}),
    ("submission_comments", "created_at", "dateTime", {},
     {"interface": "datetime", "width": "half"}),

    # Rubric criterion scores written by the SpeedGrader.
    ("submission_rubric_scores", "submission_id", "string", {"max_length": 255},
     {"interface": "input", "width": "half"}),
    ("submission_rubric_scores", "criterion_id", "string", {"max_length": 255},
     {"interface": "input", "width": "half"}),
    ("submission_rubric_scores", "points_awarded", "float", {},
     {"interface": "input", "width": "half"}),
    ("submission_rubric_scores", "feedback", "text", {},
     {"interface": "input-multiline"}),

    # Mirrored grader note so students can read it off the submission itself.
    ("submissions", "feedback", "text", {},
     {"interface": "input-multiline", "note": "Mirrored grader feedback"}),
]


def existing_fields(collection):
    res = api_request(f"/fields/{collection}")
    if not res["ok"]:
        sys.exit(f"Cannot read fields for {collection}: {res['status']} {res['data']}")
    return {f["field"] for f in res["data"].get("data", [])}


def main():
    touched = 0
    for collection, field, ftype, schema_extra, meta in FIELDS:
        present = existing_fields(collection)
        if field in present:
            print(f"skip   {collection}.{field} (exists)")
            continue

        schema = {"is_nullable": True}
        schema.update(schema_extra)
        payload = {"field": field, "type": ftype, "meta": meta, "schema": schema}
        res = api_request(f"/fields/{collection}", method="POST", payload=payload)
        if not res["ok"]:
            print(f"FAILED {collection}.{field}: {res['status']} {json.dumps(res['data'])[:400]}")
            continue
        print(f"create {collection}.{field} -> {res['status']}")
        touched += 1

    cache = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print(f"cache clear: {cache['status']}")
    print(f"done: {touched} field(s) created")


if __name__ == "__main__":
    main()
