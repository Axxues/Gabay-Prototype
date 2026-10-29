import sys
import json
import urllib.request
from pathlib import Path

rag_dir = Path(r"D:\4thesis\GabaySystem\Gabay-Prototype\rag-service")
sys.path.insert(0, str(rag_dir))
from app.core.config import get_settings

settings = get_settings()

fields_to_add = [
    {
        "field": "status",
        "type": "string",
        "schema": {
            "data_type": "varchar",
            "default_value": "pending",
            "max_length": 50,
            "is_nullable": True,
        },
        "meta": {
            "interface": "select-dropdown",
            "options": {
                "choices": [
                    {"text": "Pending", "value": "pending"},
                    {"text": "Verified", "value": "verified"},
                    {"text": "Rejected", "value": "rejected"},
                    {"text": "Expired", "value": "expired"},
                ]
            },
        },
    },
    {
        "field": "expires_at",
        "type": "dateTime",
        "schema": {
            "is_nullable": True,
        },
        "meta": {
            "interface": "datetime",
        },
    },
    {
        "field": "school_year",
        "type": "string",
        "schema": {
            "data_type": "varchar",
            "max_length": 50,
            "is_nullable": True,
        },
        "meta": {
            "interface": "input",
        },
    },
]

# Check existing fields
check_url = f"{settings.likha_url}/fields/pending_registrations"
check_req = urllib.request.Request(
    check_url,
    headers={
        "Authorization": f"Bearer {settings.likha_token}",
        "User-Agent": "curl/8.5.0",
    }
)

with urllib.request.urlopen(check_req) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    existing_fields = {f.get("field") for f in data.get("data", [])}
    print(f"Existing fields in pending_registrations: {existing_fields}")

for field_def in fields_to_add:
    f_name = field_def["field"]
    if f_name in existing_fields:
        print(f"Field '{f_name}' already exists in pending_registrations.")
        continue

    url = f"{settings.likha_url}/fields/pending_registrations"
    payload = json.dumps(field_def).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.likha_token}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.5.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            print(f"Successfully added field '{f_name}' to pending_registrations")
    except urllib.error.HTTPError as e:
        print(f"Failed to add field '{f_name}': HTTP {e.code} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"Error adding field '{f_name}': {e}")

# Clear system cache
cache_req = urllib.request.Request(
    f"{settings.likha_url}/utils/cache/clear",
    data=json.dumps({"cache": "system"}).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {settings.likha_token}",
        "Content-Type": "application/json",
        "User-Agent": "curl/8.5.0",
    },
    method="POST"
)
try:
    with urllib.request.urlopen(cache_req) as resp:
        print("System cache cleared successfully.")
except Exception as e:
    print(f"Cache clear warning: {e}")
