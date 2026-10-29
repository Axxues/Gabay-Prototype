#!/usr/bin/env python3
"""
Setup proper Staff policy permissions in Directus.
Follows likha-erp-api safety protocols:
- User-Agent: curl/8.5.0
- URL-encoded filter params
- Idempotency checks (check existing permissions before POSTing)
- Clear Directus cache at the end
"""

import socket
import os
import sys
import json
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
            print(f"  [EXISTS] {collection} {action}")
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
        print(f"  [FAILED] {collection} {action}: {res}")
        return False
    print(f"  [CREATED] {collection} {action}")
    return True

def main():
    staff_policy_id = "814a85b0-b934-40f8-a9b6-f590c02d9a96"
    print(f"Configuring permissions for Staff policy: {staff_policy_id}")

    # Read-only collections for Staff
    read_only_collections = [
        "courses",
        "course_sections",
        "course_files",
        "course_folders",
        "syllabi",
        "announcements",
        "announcements_files",
        "modules",
        "module_items",
        "activities",
        "activities_files",
        "assessment_questions",
        "quizzes",
        "exams",
        "rubric_criteria",
        "advising_slots",
        "submissions",
        "submission_answers",
        "submission_comments",
        "submission_rubric_scores",
        "course_grades",
        "colleges",
        "departments",
        "school_years",
        "directus_roles",
    ]

    print("\n--- 1. Ensuring read permissions on core academic collections ---")
    for col in read_only_collections:
        ensure_permission(staff_policy_id, col, "read")

    # Multi-action collections for Staff
    crud_map = {
        # Messaging & Inbox
        "messages": ["create", "read", "update", "delete"],
        "chat_groups": ["create", "read", "update"],
        "notifications": ["create", "read", "update"],
        # Calendar
        "calendar_events": ["create", "read", "update", "delete"],
        # Enrollments & Registrar duties
        "Course_Enrollments": ["create", "read", "update", "delete"],
        "enrollment_requests": ["create", "read", "update", "delete"],
        "spr_configs": ["create", "read", "update"],
        "spr_cells": ["create", "read", "update"],
        # Discussions & Community
        "discussions": ["create", "read", "update"],
        "discussion_replies": ["create", "read", "update", "delete"],
        "module_comments": ["create", "read", "update", "delete"],
        "announcement_replies": ["create", "read", "update", "delete"],
        # Governance & Registrations
        "governance_audit_logs": ["create", "read"],
        "leadership_tenures": ["create", "read", "update"],
        "pending_registrations": ["create", "read", "update", "delete"],
        # Files
        "directus_files": ["create", "read", "update"],
    }

    print("\n--- 2. Ensuring CRUD permissions on operational collections ---")
    for col, actions in crud_map.items():
        for act in actions:
            ensure_permission(staff_policy_id, col, act)

    # Users permission: read active, update self
    print("\n--- 3. Ensuring directus_users permissions ---")
    user_readable_fields = [
        "id", "first_name", "middle_name", "last_name", "email",
        "avatar", "department", "title", "student_id", "banner",
        "role", "user_role", "status", "location", "description",
        "appearance", "theme_dark", "theme_light", "language"
    ]
    user_updatable_fields = [
        "first_name", "middle_name", "last_name", "avatar", "banner",
        "password", "title", "description", "location", "appearance",
        "theme_dark", "theme_light", "email_notifications", "tags", "language"
    ]
    ensure_permission(
        staff_policy_id,
        "directus_users",
        "read",
        fields=user_readable_fields,
        permissions={"status": {"_eq": "active"}},
    )
    ensure_permission(
        staff_policy_id,
        "directus_users",
        "update",
        fields=user_updatable_fields,
        permissions={"id": {"_eq": "$CURRENT_USER"}},
    )

    # Cache clear
    print("\n--- 4. Clearing Directus schema cache ---")
    cache_res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print(f"Cache clear result: {cache_res}")
    print("\nStaff permissions setup complete!")

if __name__ == "__main__":
    main()
