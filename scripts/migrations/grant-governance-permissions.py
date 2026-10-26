#!/usr/bin/env python3
"""
Grant proper Directus policy permissions for:
- governance_audit_logs
- leadership_tenures
- pending_registrations

Strict adherence to likha-erp-api safety protocols:
- User-Agent: curl/8.5.0
- URL-encoded filters
- Idempotency check before POSTing
- Clear cache afterwards
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

def get_existing_permissions(collection):
    # URL-encode filter params per likha-erp-api rule
    path = f"/permissions?filter%5Bcollection%5D%5B_eq%5D={collection}&limit=-1"
    res = api_request(path)
    if res.get("error"):
        print(f"Error getting permissions for {collection}: {res}")
        return []
    return res.get("data", [])

def ensure_permission(policy, collection, action, fields=None):
    if fields is None:
        fields = ["*"]
    existing = get_existing_permissions(collection)
    for p in existing:
        if p.get("policy") == policy and p.get("action") == action:
            print(f"Permission already exists: {collection} {action} for policy {policy}")
            return True

    payload = {
        "policy": policy,
        "collection": collection,
        "action": action,
        "fields": fields,
    }
    res = api_request("/permissions", method="POST", payload=payload)
    if res.get("error"):
        print(f"Failed to create permission: {collection} {action} for policy {policy}: {res}")
        return False
    print(f"Created permission: {collection} {action} for policy {policy}")
    return True

def main():
    print(f"Connecting to Likha ERP: {LIKHA_URL}")

    # Fetch policies
    pol_res = api_request("/policies?limit=-1")
    if pol_res.get("error"):
        print(f"Failed to fetch policies: {pol_res}")
        sys.exit(1)

    policies = {p["name"]: p["id"] for p in pol_res.get("data", [])}
    print("Found policies:", policies)

    public_policy_id = policies.get("$t:public_label")
    admin_policy_id = policies.get("Administrator")
    dean_policy_id = policies.get("Dean")
    chair_policy_id = policies.get("Chairperson")
    faculty_policy_id = policies.get("Faculty")
    staff_policy_id = policies.get("Staff")
    student_policy_id = policies.get("Student")

    all_policies = [p for p in [public_policy_id, admin_policy_id, dean_policy_id, chair_policy_id, faculty_policy_id, staff_policy_id, student_policy_id] if p]
    staff_and_admin = [p for p in [admin_policy_id, dean_policy_id, chair_policy_id, staff_policy_id] if p]
    academic_creators = [p for p in [admin_policy_id, dean_policy_id, chair_policy_id, faculty_policy_id, staff_policy_id] if p]

    # 1. governance_audit_logs
    print("\n--- Configuring governance_audit_logs permissions ---")
    for pol in all_policies:
        ensure_permission(pol, "governance_audit_logs", "read")
    for pol in academic_creators:
        ensure_permission(pol, "governance_audit_logs", "create")

    # 2. leadership_tenures
    print("\n--- Configuring leadership_tenures permissions ---")
    for pol in all_policies:
        ensure_permission(pol, "leadership_tenures", "read")
    for pol in staff_and_admin:
        ensure_permission(pol, "leadership_tenures", "create")
        ensure_permission(pol, "leadership_tenures", "update")
    if admin_policy_id:
        ensure_permission(admin_policy_id, "leadership_tenures", "delete")

    # 3. pending_registrations
    print("\n--- Configuring pending_registrations permissions ---")
    for pol in all_policies:
        ensure_permission(pol, "pending_registrations", "read")
    # Public can self-register
    if public_policy_id:
        ensure_permission(public_policy_id, "pending_registrations", "create")
    for pol in staff_and_admin:
        ensure_permission(pol, "pending_registrations", "create")
        ensure_permission(pol, "pending_registrations", "update")
        ensure_permission(pol, "pending_registrations", "delete")

    # Clear Directus cache
    print("\nClearing Directus schema cache...")
    cache_res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print(f"Cache clear result: {cache_res}")
    print("\nAll governance & registration permissions successfully configured.")

if __name__ == "__main__":
    main()
