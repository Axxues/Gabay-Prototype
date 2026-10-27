#!/usr/bin/env python3
"""
Setup assessment fields in Likha ERP:
- Add available_from, available_until, delayed_until, file fields to quizzes
- Add assessment_type, metadata, instructions, submission_types, rubric, file fields to activities
- Strictly follow likha-erp-api safety protocols:
  * Conventional User-Agent: curl/8.5.0
  * Verify existence before creating
  * Never patch /relations
  * Clear system cache after schema updates
"""

import os
import sys
import json
import urllib.request
import urllib.error

LIKHA_URL = os.environ.get("LIKHA_URL", "https://gabay.zyberlab.com").rstrip("/")
LIKHA_TOKEN = os.environ.get("LIKHA_TOKEN", "zPcFhx76dgLG_PQP1pxP_myAuhBO1aZX")

HEADERS = {
    "Authorization": f"Bearer {LIKHA_TOKEN}",
    "Content-Type": "application/json",
    "User-Agent": "curl/8.5.0",
}

def api_request(path, method="GET", payload=None):
    url = f"{LIKHA_URL}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8", errors="replace")
        try:
            err_json = json.loads(err_content)
        except Exception:
            err_json = {"raw": err_content}
        return {"error": True, "status": e.code, "details": err_json}

def get_existing_fields(collection):
    res = api_request(f"/fields/{collection}")
    if res.get("error"):
        print(f"Error fetching fields for {collection}: {res}")
        return set()
    return {f["field"] for f in res.get("data", [])}

def ensure_fields(collection, fields_spec):
    existing = get_existing_fields(collection)
    added_any = False
    for spec in fields_spec:
        f_name = spec["field"]
        if f_name not in existing:
            print(f"Adding field '{f_name}' to '{collection}'...")
            res = api_request(f"/fields/{collection}", method="POST", payload=spec)
            if res.get("error"):
                print(f"  Error adding '{f_name}': {res}")
            else:
                print(f"  Field '{f_name}' added successfully.")
                added_any = True
        else:
            print(f"Field '{f_name}' already exists in '{collection}'.")
    return added_any

def main():
    print(f"Connecting to Likha ERP: {LIKHA_URL}")

    # Fields for activities
    activity_fields = [
        {"field": "assessment_type", "type": "string", "schema": {"is_nullable": True}},
        {"field": "metadata", "type": "json", "schema": {"is_nullable": True}},
        {"field": "instructions", "type": "text", "schema": {"is_nullable": True}},
        {"field": "submission_types", "type": "json", "schema": {"is_nullable": True}},
        {"field": "rubric", "type": "json", "schema": {"is_nullable": True}},
        {"field": "file_name", "type": "string", "schema": {"is_nullable": True}},
        {"field": "file_url", "type": "string", "schema": {"is_nullable": True}},
        {"field": "file_size", "type": "string", "schema": {"is_nullable": True}},
    ]

    # Fields for quizzes
    quiz_fields = [
        {"field": "available_from", "type": "dateTime", "schema": {"is_nullable": True}},
        {"field": "available_until", "type": "dateTime", "schema": {"is_nullable": True}},
        {"field": "delayed_until", "type": "dateTime", "schema": {"is_nullable": True}},
        {"field": "file_name", "type": "string", "schema": {"is_nullable": True}},
        {"field": "file_url", "type": "string", "schema": {"is_nullable": True}},
        {"field": "file_size", "type": "string", "schema": {"is_nullable": True}},
    ]

    print("\nEnsuring activities fields...")
    act_changed = ensure_fields("activities", activity_fields)

    print("\nEnsuring quizzes fields...")
    quiz_changed = ensure_fields("quizzes", quiz_fields)

    # Always clear cache to ensure Directus picks up any changes
    print("\nClearing Directus schema cache...")
    cache_res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print(f"Cache clear result: {cache_res}")
    print("\nBackend assessment fields verification and setup complete!")

if __name__ == "__main__":
    main()
