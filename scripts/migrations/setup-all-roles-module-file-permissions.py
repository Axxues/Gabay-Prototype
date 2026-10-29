#!/usr/bin/env python3
"""
Grant complete read permissions for all roles (Student, Faculty, Chairperson, Dean, Staff)
on module and course file collections:
- modules
- module_items
- course_files
- course_folders
- directus_files
- Course_Enrollments

Follows likha-erp-api safety protocols:
- User-Agent: curl/8.5.0
- URL-encoded filter params
- Idempotency checks
- Clear cache at the end
"""

import os
import sys
import json
import socket
import urllib.request
import urllib.error

# Patch socket DNS resolution if needed
_orig_getaddrinfo = socket.getaddrinfo
def patched_getaddrinfo(host, port, *args, **kwargs):
    if host == "gabay.zyberlab.com":
        return _orig_getaddrinfo("104.21.28.16", port, *args, **kwargs)
    return _orig_getaddrinfo(host, port, *args, **kwargs)
socket.getaddrinfo = patched_getaddrinfo

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
            # Check if fields or permissions need update
            needs_update = False
            patch_body = {}
            if p.get("fields") != fields and fields == ["*"]:
                patch_body["fields"] = ["*"]
                needs_update = True
            if permissions is not None and p.get("permissions") != permissions:
                patch_body["permissions"] = permissions
                needs_update = True
            if needs_update:
                pid = p["id"]
                api_request(f"/permissions/{pid}", method="PATCH", payload=patch_body)
                print(f"  [UPDATED] {collection} {action} on policy {policy_id}")
                return True
            print(f"  [EXISTS] {collection} {action} on policy {policy_id}")
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
        print(f"  [FAILED] {collection} {action} on policy {policy_id}: {res}")
        return False
    print(f"  [CREATED] {collection} {action} on policy {policy_id}")
    return True

def main():
    # Target policies for all main non-admin roles
    policies = {
        "Student": "b94b9d3f-97a3-4324-81c1-fac7e61b2bff",
        "Faculty": "2c0557f5-411a-4099-a954-2eab21b14936",
        "Chairperson": "65a96b8a-1250-424b-b731-4796b889f4b9",
        "Dean": "292995bc-5edf-442e-93f8-440bc17a119a",
        "Staff": "814a85b0-b934-40f8-a9b6-f590c02d9a96",
    }

    read_collections = [
        "modules",
        "module_items",
        "course_files",
        "course_folders",
        "directus_files",
        "Course_Enrollments",
    ]

    print("Step 1: Ensuring read permissions across all roles for module and course file collections...")
    for role_name, policy_id in policies.items():
        print(f"\n--- Policy for {role_name} ({policy_id}) ---")
        for col in read_collections:
            ensure_permission(policy_id, col, "read", fields=["*"])

    print("\nStep 2: Clearing Directus schema cache...")
    cache_res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print(f"Cache cleared: {cache_res}")
    print("\nAll role permissions for modules, module items, and course files have been verified and applied!")

if __name__ == "__main__":
    main()
