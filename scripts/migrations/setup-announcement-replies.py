#!/usr/bin/env python3
"""
Setup fields and permissions for announcement_replies and module_comments.
Strict adherence to likha-erp-api safety protocols:
- User-Agent: curl/8.5.0
- URL-encoded filter params
- Idempotency checks before creation
- Clear cache at the end
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
        return []
    return [f["field"] for f in res.get("data", [])]

def ensure_field(collection, field_def):
    existing = get_existing_fields(collection)
    field_name = field_def["field"]
    if field_name in existing:
        print(f"Field {collection}.{field_name} already exists.")
        return True

    res = api_request(f"/fields/{collection}", method="POST", payload=field_def)
    if res.get("error"):
        print(f"Failed to create field {collection}.{field_name}: {res}")
        return False
    print(f"Created field {collection}.{field_name}")
    return True

def get_existing_permissions(policy_id):
    path = f"/permissions?filter%5Bpolicy%5D%5B_eq%5D={policy_id}&limit=-1"
    res = api_request(path)
    if res.get("error"):
        print(f"Error getting permissions for policy {policy_id}: {res}")
        return []
    return res.get("data", [])

def ensure_permission(policy_id, collection, action, fields=None, permissions=None):
    if fields is None:
        fields = ["*"]
    existing = get_existing_permissions(policy_id)
    for p in existing:
        if p.get("collection") == collection and p.get("action") == action:
            print(f"Permission already exists: {collection} {action} (policy: {policy_id})")
            return True

    payload = {
        "policy": policy_id,
        "collection": collection,
        "action": action,
        "fields": fields,
    }
    if permissions is not None:
        payload["permissions"] = permissions

    res = api_request("/permissions", method="POST", payload=payload)
    if res.get("error"):
        print(f"Failed to create permission {collection} {action}: {res}")
        return False
    print(f"Created permission: {collection} {action} (policy: {policy_id})")
    return True

def main():
    print("Step 1: Setting up fields for announcement_replies...")
    announcement_reply_fields = [
        {
            "field": "announcement_id",
            "type": "string",
            "schema": {"data_type": "character varying", "max_length": 255, "is_nullable": True}
        },
        {
            "field": "author_id",
            "type": "string",
            "schema": {"data_type": "character varying", "max_length": 255, "is_nullable": True}
        },
        {
            "field": "author_name",
            "type": "string",
            "schema": {"data_type": "character varying", "max_length": 255, "is_nullable": True}
        },
        {
            "field": "author_avatar",
            "type": "text",
            "schema": {"data_type": "text", "is_nullable": True}
        },
        {
            "field": "author_role",
            "type": "string",
            "schema": {"data_type": "character varying", "max_length": 64, "is_nullable": True}
        },
        {
            "field": "content",
            "type": "text",
            "schema": {"data_type": "text", "is_nullable": True}
        },
        {
            "field": "parent_id",
            "type": "string",
            "schema": {"data_type": "character varying", "max_length": 255, "is_nullable": True}
        },
        {
            "field": "created_at",
            "type": "dateTime",
            "schema": {"data_type": "timestamp without time zone", "is_nullable": True}
        },
        {
            "field": "likes",
            "type": "integer",
            "schema": {"data_type": "integer", "default_value": 0, "is_nullable": True}
        },
        {
            "field": "liked_by",
            "type": "json",
            "schema": {"data_type": "json", "is_nullable": True}
        },
    ]

    for f in announcement_reply_fields:
        ensure_field("announcement_replies", f)

    print("\nStep 2: Setting up auxiliary fields on module_comments...")
    module_comment_fields = [
        {
            "field": "author_avatar",
            "type": "text",
            "schema": {"data_type": "text", "is_nullable": True}
        },
        {
            "field": "author_role",
            "type": "string",
            "schema": {"data_type": "character varying", "max_length": 64, "is_nullable": True}
        },
        {
            "field": "likes",
            "type": "integer",
            "schema": {"data_type": "integer", "default_value": 0, "is_nullable": True}
        },
        {
            "field": "liked_by",
            "type": "json",
            "schema": {"data_type": "json", "is_nullable": True}
        },
    ]

    for f in module_comment_fields:
        ensure_field("module_comments", f)

    print("\nStep 3: Granting announcement_replies permissions across all roles...")
    policies = {
        "student": "b94b9d3f-97a3-4324-81c1-fac7e61b2bff",
        "faculty": "2c0557f5-411a-4099-a954-2eab21b14936",
        "chair": "65a96b8a-1250-424b-b731-4796b889f4b9",
        "dean": "292995bc-5edf-442e-93f8-440bc17a119a",
        "staff": "814a85b0-b934-40f8-a9b6-f590c02d9a96",
    }

    actions = ["create", "read", "update", "delete"]
    for role_name, policy_id in policies.items():
        print(f"Configuring policy: {role_name} ({policy_id})...")
        for act in actions:
            ensure_permission(policy_id, "announcement_replies", act)
            # Ensure staff has module_comments as well
            if role_name == "staff":
                ensure_permission(policy_id, "module_comments", act)

    print("\nStep 4: Clearing Directus schema cache...")
    cache_res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print(f"Cache cleared: {cache_res}")
    print("\nDone!")

if __name__ == "__main__":
    main()
