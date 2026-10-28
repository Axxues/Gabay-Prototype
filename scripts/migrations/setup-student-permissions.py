#!/usr/bin/env python3
"""
Setup proper Student policy permissions and decouple Faculty policy from Student role.
Strict adherence to likha-erp-api safety protocols:
- User-Agent: curl/8.5.0
- URL-encoded filter params
- Idempotency checks
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
            # Check if permissions rule matches
            if permissions is not None and p.get("permissions") != permissions:
                # Update rule
                pid = p["id"]
                upd_res = api_request(f"/permissions/{pid}", method="PATCH", payload={"permissions": permissions, "fields": fields})
                print(f"Updated permission rule for {collection} {action}: {upd_res}")
                return True
            print(f"Permission already exists: {collection} {action}")
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
    print(f"Created permission: {collection} {action}")
    return True

def main():
    student_policy_id = "b94b9d3f-97a3-4324-81c1-fac7e61b2bff"
    student_role_id = "98a212b2-9482-4ca5-8f67-825699575f3c"
    faculty_policy_id = "2c0557f5-411a-4099-a954-2eab21b14936"

    print("Step 1: Granting Student policy all legitimate LMS permissions...")

    read_only_collections = [
        "activities",
        "activities_files",
        "announcements",
        "assessment_questions",
        "calendar_events",
        "Course_Enrollments",
        "course_files",
        "course_folders",
        "course_grades",
        "course_sections",
        "exams",
        "module_items",
        "modules",
        "quizzes",
        "rubric_criteria",
        "spr_cells",
        "spr_configs",
        "submission_rubric_scores",
        "syllabi",
    ]

    for col in read_only_collections:
        ensure_permission(student_policy_id, col, "read")

    # Interactive / student submission collections
    crud_collections = {
        "submissions": ["create", "read", "update"],
        "submission_answers": ["create", "read", "update"],
        "submission_comments": ["create", "read", "update"],
        "module_comments": ["create", "read", "update", "delete"],
        "discussions": ["create", "read", "update"],
        "chat_groups": ["create", "read", "update"],
        "messages": ["create", "read", "update"],
        "notifications": ["create", "read", "update"],
        "advising_slots": ["read", "update"],
    }

    for col, actions in crud_collections.items():
        for act in actions:
            ensure_permission(student_policy_id, col, act)

    # enrollment_requests permissions for Student:
    # Read: ONLY own requests OR approved requests (for course roster hydration)
    # Never other students' pending requests!
    print("Step 2: Configuring enrollment_requests permissions for Student policy...")
    enr_read_rule = {
        "_or": [
            {"student_id": {"_eq": "$CURRENT_USER"}},
            {"status": {"_eq": "approved"}}
        ]
    }
    ensure_permission(student_policy_id, "enrollment_requests", "read", permissions=enr_read_rule)
    ensure_permission(student_policy_id, "enrollment_requests", "create")
    enr_update_rule = {
        "student_id": {"_eq": "$CURRENT_USER"}
    }
    ensure_permission(student_policy_id, "enrollment_requests", "update", permissions=enr_update_rule)

    print("Step 2b: Configuring directus_users and directus_files permissions for Student policy...")
    user_updatable_fields = [
        "first_name",
        "middle_name",
        "last_name",
        "avatar",
        "banner",
        "password",
        "title",
        "description",
        "location",
        "appearance",
        "theme_dark",
        "theme_light",
        "email_notifications",
        "tags",
        "language",
    ]
    user_readable_fields = [
        "id",
        "first_name",
        "middle_name",
        "last_name",
        "email",
        "avatar",
        "department",
        "title",
        "student_id",
        "banner",
        "role",
        "user_role",
        "status",
        "location",
        "description",
        "appearance",
        "theme_dark",
        "theme_light",
        "language",
    ]
    ensure_permission(student_policy_id, "directus_users", "read", fields=user_readable_fields, permissions={"status": {"_eq": "active"}})
    ensure_permission(student_policy_id, "directus_users", "update", fields=user_updatable_fields, permissions={"id": {"_eq": "$CURRENT_USER"}})
    ensure_permission(student_policy_id, "directus_files", "create")
    ensure_permission(student_policy_id, "directus_files", "read")
    ensure_permission(student_policy_id, "directus_files", "update", permissions={"uploaded_by": {"_eq": "$CURRENT_USER"}})

    print("Step 3: Decoupling Faculty policy from Student role in directus_access...")
    # Find directus_access record for student_role_id with faculty_policy_id
    access_list = api_request(f"/access?filter%5Brole%5D%5B_eq%5D={student_role_id}&limit=-1").get("data", [])
    for acc in access_list:
        if acc.get("policy") == faculty_policy_id:
            acc_id = acc.get("id")
            print(f"Deleting directus_access record {acc_id} linking Student role to Faculty policy...")
            del_res = api_request(f"/access/{acc_id}", method="DELETE")
            print(f"Deleted directus_access {acc_id}: {del_res}")

    print("Step 4: Clearing Directus schema cache...")
    cache_res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print(f"Cache cleared: {cache_res}")
    print("Done!")

if __name__ == "__main__":
    main()
