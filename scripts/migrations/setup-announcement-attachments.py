#!/usr/bin/env python3
"""
Setup proper permissions for announcements_files junction collection,
add source_area and source_id fields to course_files, and backfill
existing announcement attachments.

Strict adherence to likha-erp-api safety protocols:
- User-Agent: curl/8.5.0
- URL-encoded filter params
- Idempotency checks
- Clear system cache at the end
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
            if permissions is not None and p.get("permissions") != permissions:
                pid = p["id"]
                upd_res = api_request(f"/permissions/{pid}", method="PATCH", payload={"permissions": permissions, "fields": fields})
                print(f"Updated permission rule for {collection} {action}: {upd_res}")
                return True
            print(f"Permission already exists: {collection} {action} on policy {policy_id}")
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
    print(f"Created permission: {collection} {action} on policy {policy_id}")
    return True

def ensure_field(collection, field_name, field_type="string"):
    fields_res = api_request(f"/fields/{collection}")
    existing_fields = [f.get("field") for f in fields_res.get("data", [])]
    if field_name in existing_fields:
        print(f"Field {collection}.{field_name} already exists.")
        return True

    payload = {
        "field": field_name,
        "type": field_type,
        "schema": {
            "is_nullable": True,
        },
        "meta": {
            "hidden": False,
            "readonly": False,
        }
    }
    res = api_request(f"/fields/{collection}", method="POST", payload=payload)
    if res.get("error"):
        print(f"Failed to create field {collection}.{field_name}: {res}")
        return False
    print(f"Created field {collection}.{field_name}")
    return True

def clear_cache():
    print("Clearing Directus system cache...")
    res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print("Cache clear result:", res)

def main():
    student_policy_id = "b94b9d3f-97a3-4324-81c1-fac7e61b2bff"
    faculty_policy_id = "2c0557f5-411a-4099-a954-2eab21b14936"
    dean_policy_id = "292995bc-5edf-442e-93f8-440bc17a119a"
    chair_policy_id = "65a96b8a-1250-424b-b731-4796b889f4b9"
    staff_policy_id = "814a85b0-b934-40f8-a9b6-f590c02d9a96"

    print("Step 1: Grant permissions on announcements_files...")
    # Student: read
    ensure_permission(student_policy_id, "announcements_files", "read")

    # Faculty: create, read, update, delete, share
    for act in ["create", "read", "update", "delete", "share"]:
        ensure_permission(faculty_policy_id, "announcements_files", act)

    # Dean & Chair: create, read, update, delete, share
    for act in ["create", "read", "update", "delete", "share"]:
        ensure_permission(dean_policy_id, "announcements_files", act)
        ensure_permission(chair_policy_id, "announcements_files", act)

    # Staff: read
    ensure_permission(staff_policy_id, "announcements_files", "read")

    print("\nStep 2: Ensure source_area and source_id on course_files...")
    ensure_field("course_files", "source_area", "string")
    ensure_field("course_files", "source_id", "string")

    print("\nStep 3: Backfill Test Announcement 1 attachments...")
    ann_id = "24973513-6a32-4303-8a71-3faee4a7b53e"
    target_files = [
        "a0a300fe-03b9-47c2-9021-108cded9d9fa",  # Diagram.png
        "cef73bc5-d004-44cc-bcaf-8bcaa24e07d6",  # ThesisManuscript-AntiCheating.docx
        "ca6f1fff-f684-4260-ac76-e4e838a21eb2",  # Application for Ethics Review...
    ]

    # Check existing junction rows
    existing_af = api_request(f"/items/announcements_files?filter%5Bannouncements_id%5D%5B_eq%5D={ann_id}&limit=-1")
    existing_file_ids = {row.get("directus_files_id") for row in existing_af.get("data", [])}

    for fid in target_files:
        if fid not in existing_file_ids:
            res = api_request("/items/announcements_files", method="POST", payload={
                "announcements_id": ann_id,
                "directus_files_id": fid
            })
            print(f"Linked file {fid} to announcement {ann_id}: {res.get('data', {}).get('id')}")
        else:
            print(f"File {fid} already linked to announcement {ann_id}")

    # Backfill course_files metadata
    cf_res = api_request(f"/items/course_files?filter%5Bcourse_id%5D%5B_eq%5D=185703b1-ca62-448b-9fc3-0a23e63fcfc1&limit=-1")
    for cf in cf_res.get("data", []):
        if cf.get("file") in target_files:
            cf_id = cf.get("id")
            api_request(f"/items/course_files/{cf_id}", method="PATCH", payload={
                "source_area": "announcements",
                "source_id": ann_id
            })
            print(f"Updated course_file {cf_id} ({cf.get('name')}) with source_area and source_id")

    clear_cache()
    print("\nMigration completed successfully!")

if __name__ == "__main__":
    main()
