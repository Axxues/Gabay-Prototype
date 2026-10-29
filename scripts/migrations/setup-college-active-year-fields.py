#!/usr/bin/env python3
"""
Add active_school_year and active_semester fields to Directus colleges collection.
Ensures collegiate rollover persists to Directus backend so all roles (Dean, Chair, Faculty, Student)
share the exact same synchronized active academic year and semester across all sessions and devices.
"""

import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

rag_dir = Path(r"D:\4thesis\GabaySystem\Gabay-Prototype\rag-service")
sys.path.insert(0, str(rag_dir))
from app.core.config import get_settings

settings = get_settings()

fields_to_add = [
    {
        "field": "active_school_year",
        "type": "string",
        "schema": {
            "data_type": "varchar",
            "default_value": "2026-2027",
            "max_length": 50,
            "is_nullable": True,
        },
        "meta": {
            "interface": "input",
        },
    },
    {
        "field": "active_semester",
        "type": "string",
        "schema": {
            "data_type": "varchar",
            "default_value": "First",
            "max_length": 50,
            "is_nullable": True,
        },
        "meta": {
            "interface": "select-dropdown",
            "options": {
                "choices": [
                    {"text": "First Semester", "value": "First"},
                    {"text": "Second Semester", "value": "Second"},
                    {"text": "Mid-Year", "value": "Mid-Year"},
                ]
            },
        },
    },
]

headers = {
    "Authorization": f"Bearer {settings.likha_token}",
    "User-Agent": "curl/8.5.0",
    "Content-Type": "application/json",
}

# 1. Check existing fields on colleges
check_url = f"{settings.likha_url}/fields/colleges"
check_req = urllib.request.Request(check_url, headers=headers)

try:
    with urllib.request.urlopen(check_req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        existing_fields = {f.get("field") for f in data.get("data", [])}
        print(f"Existing fields in colleges: {existing_fields}")
except Exception as e:
    print(f"Failed to check fields: {e}")
    sys.exit(1)

# 2. Add fields if missing
for field_def in fields_to_add:
    f_name = field_def["field"]
    if f_name in existing_fields:
        print(f"Field '{f_name}' already exists in colleges.")
        continue

    url = f"{settings.likha_url}/fields/colleges"
    payload = json.dumps(field_def).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Added field '{f_name}' to colleges successfully.")
    except urllib.error.HTTPError as e:
        print(f"Failed to add field '{f_name}': {e.code} - {e.read().decode('utf-8')}")

# 3. Update existing college rows to have active_school_year="2026-2027" and active_semester="First"
colleges_url = f"{settings.likha_url}/items/colleges?limit=100"
col_req = urllib.request.Request(colleges_url, headers=headers)
try:
    with urllib.request.urlopen(col_req) as resp:
        cols_data = json.loads(resp.read().decode("utf-8")).get("data", [])
        for col in cols_data:
            col_id = col["id"]
            patch_url = f"{settings.likha_url}/items/colleges/{col_id}"
            patch_body = json.dumps({
                "active_school_year": "2026-2027",
                "active_semester": "First"
            }).encode("utf-8")
            patch_req = urllib.request.Request(patch_url, data=patch_body, headers=headers, method="PATCH")
            with urllib.request.urlopen(patch_req) as p_resp:
                print(f"Updated college '{col.get('name')}' ({col_id}) to 2026-2027 / First semester.")
except Exception as e:
    print(f"Failed to update colleges: {e}")

# 4. Grant update permissions on colleges to Dean and Admin policies
pol_req = urllib.request.Request(f"{settings.likha_url}/policies?limit=-1", headers=headers)
try:
    with urllib.request.urlopen(pol_req) as resp:
        pol_data = json.loads(resp.read().decode("utf-8")).get("data", [])
        policies = {p["name"]: p["id"] for p in pol_data}
        dean_policy = policies.get("Dean")
        admin_policy = policies.get("Administrator")
        chair_policy = policies.get("Chairperson")
        
        target_policies = [p for p in [dean_policy, admin_policy] if p]
        for pol_id in target_policies:
            # Check existing update perm
            perm_url = f"{settings.likha_url}/permissions?filter%5Bcollection%5D%5B_eq%5D=colleges&filter%5Bpolicy%5D%5B_eq%5D={pol_id}&filter%5Baction%5D%5B_eq%5D=update"
            perm_req = urllib.request.Request(perm_url, headers=headers)
            with urllib.request.urlopen(perm_req) as p_resp:
                perms = json.loads(p_resp.read().decode("utf-8")).get("data", [])
                if perms:
                    print(f"Update permission on colleges already exists for policy {pol_id}")
                else:
                    create_perm_req = urllib.request.Request(
                        f"{settings.likha_url}/permissions",
                        data=json.dumps({
                            "collection": "colleges",
                            "action": "update",
                            "policy": pol_id,
                            "fields": ["*"],
                        }).encode("utf-8"),
                        headers=headers,
                        method="POST"
                    )
                    with urllib.request.urlopen(create_perm_req) as cp_resp:
                        print(f"Granted update on colleges to policy {pol_id}")
except Exception as e:
    print(f"Failed setting permissions: {e}")

# 5. Clear Directus cache
cache_url = f"{settings.likha_url}/utils/cache/clear"
cache_payload = json.dumps({"cache": "system"}).encode("utf-8")
cache_req = urllib.request.Request(cache_url, data=cache_payload, headers=headers, method="POST")
try:
    with urllib.request.urlopen(cache_req) as resp:
        print("Cleared Directus system cache.")
except Exception as e:
    print(f"Failed to clear cache: {e}")
