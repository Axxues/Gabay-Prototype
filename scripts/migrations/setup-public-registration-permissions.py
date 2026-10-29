import os
import sys
import json
import urllib.request
from pathlib import Path

rag_dir = Path(r"D:\4thesis\GabaySystem\Gabay-Prototype\rag-service")
sys.path.insert(0, str(rag_dir))
from app.core.config import get_settings

settings = get_settings()
PUBLIC_POLICY_ID = "abf8a154-5b1c-4a46-ac9c-7300570f4f17"

# Check existing permissions for Public on pending_registrations
url = f"{settings.likha_url}/permissions?filter%5Bcollection%5D%5B_eq%5D=pending_registrations&filter%5Bpolicy%5D%5B_eq%5D={PUBLIC_POLICY_ID}"
req = urllib.request.Request(
    url,
    headers={
        "Authorization": f"Bearer {settings.likha_token}",
        "User-Agent": "curl/8.5.0",
    }
)

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode("utf-8"))
    existing_actions = {p["action"] for p in data.get("data", [])}
    print(f"Existing Public actions on pending_registrations: {existing_actions}")

actions_to_add = ["update", "delete"]
for action in actions_to_add:
    if action in existing_actions:
        print(f"Action '{action}' already exists for Public policy.")
        continue

    perm_payload = {
        "collection": "pending_registrations",
        "action": action,
        "policy": PUBLIC_POLICY_ID,
        "fields": ["*"],
        "permissions": None,
        "validation": None,
        "presets": None,
    }

    create_req = urllib.request.Request(
        f"{settings.likha_url}/permissions",
        data=json.dumps(perm_payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.likha_token}",
            "Content-Type": "application/json",
            "User-Agent": "curl/8.5.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(create_req) as create_resp:
            result = json.loads(create_resp.read().decode("utf-8"))
            print(f"Successfully granted '{action}' on pending_registrations to Public policy (ID: {result.get('data', {}).get('id')})")
    except urllib.error.HTTPError as e:
        print(f"Failed to grant '{action}': HTTP {e.code} - {e.read().decode('utf-8')}")

# Refresh Directus system cache
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
