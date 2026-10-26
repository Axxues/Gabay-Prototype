#!/usr/bin/env python3
"""
Create pending_registrations collection in Likha ERP.
Strict adherence to likha-erp-api safety protocols:
- Conventional User-Agent: curl/8.5.0
- Token from environment or fallback
- Verify existence before creating
- No PATCH /relations calls
- System cache clear after schema updates
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

def get_existing_collections():
    res = api_request("/collections")
    if res.get("error"):
        print(f"Failed to fetch collections: {res}")
        return set()
    return {c["collection"] for c in res.get("data", [])}

def get_existing_fields(collection):
    res = api_request(f"/fields/{collection}")
    if res.get("error"):
        return set()
    return {f["field"] for f in res.get("data", [])}

def ensure_collection(name, fields_spec):
    existing = get_existing_collections()
    if name not in existing:
        print(f"Creating collection '{name}'...")
        payload = {
            "collection": name,
            "schema": {},
            "fields": [
                {
                    "field": "id",
                    "type": "string",
                    "schema": {
                        "is_primary_key": True,
                        "has_auto_increment": False,
                    },
                }
            ],
        }
        res = api_request("/collections", method="POST", payload=payload)
        if res.get("error"):
            print(f"Error creating collection '{name}': {res}")
            return False
        print(f"Collection '{name}' created successfully.")
    else:
        print(f"Collection '{name}' already exists.")

    existing_fields = get_existing_fields(name)
    for field_spec in fields_spec:
        f_name = field_spec["field"]
        if f_name not in existing_fields:
            print(f"Adding field '{f_name}' to '{name}'...")
            res = api_request(f"/fields/{name}", method="POST", payload=field_spec)
            if res.get("error"):
                print(f"Error adding field '{f_name}': {res}")
            else:
                print(f"Field '{f_name}' added.")
        else:
            print(f"Field '{f_name}' already exists in '{name}'.")

    return True

def main():
    print(f"Connecting to Likha ERP: {LIKHA_URL}")

    pending_fields = [
        {"field": "first_name", "type": "string", "schema": {"is_nullable": False}},
        {"field": "middle_name", "type": "string", "schema": {"is_nullable": True}},
        {"field": "last_name", "type": "string", "schema": {"is_nullable": False}},
        {"field": "full_name", "type": "string", "schema": {"is_nullable": False}},
        {"field": "email", "type": "string", "schema": {"is_nullable": False}},
        {"field": "role", "type": "string", "schema": {"is_nullable": True}},
        {"field": "college_id", "type": "string", "schema": {"is_nullable": False}},
        {"field": "college_name", "type": "string", "schema": {"is_nullable": False}},
        {"field": "department", "type": "string", "schema": {"is_nullable": False}},
        {"field": "program", "type": "string", "schema": {"is_nullable": True}},
        {"field": "student_id", "type": "string", "schema": {"is_nullable": False}},
        {"field": "email_verified", "type": "boolean", "schema": {"is_nullable": False, "default_value": False}},
        {"field": "activation_token", "type": "string", "schema": {"is_nullable": False}},
        {"field": "registered_at", "type": "dateTime", "schema": {"is_nullable": False}},
    ]

    ok = ensure_collection("pending_registrations", pending_fields)

    if ok:
        print("Clearing Directus schema cache...")
        cache_res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
        print(f"Cache clear result: {cache_res}")
        print("pending_registrations collection successfully created and registered.")
    else:
        print("Encountered errors during collection creation.")
        sys.exit(1)

if __name__ == "__main__":
    main()
