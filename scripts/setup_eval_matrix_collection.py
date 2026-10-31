#!/usr/bin/env python3
"""One-time setup of the `gabay_syllabus_eval_matrix` collection on Likha ERP (Directus).

Idempotent: exits 0 without writing if the collection already exists.
Config: LIKHA_URL / LIKHA_TOKEN from the environment, else from an env file
(default: the main checkout's rag-service/.env, override with --env <path>).
Protocol: User-Agent on every request, filters URL-encoded, never PATCH /relations.
"""
import argparse
import json
import os
import sys

COL = "gabay_syllabus_eval_matrix"
DEFAULT_ENV = r"D:\4thesis\GabaySystem\Gabay-Prototype\rag-service\.env"
DEFAULT_URL = "https://gabay.zyberlab.com"
UA = "curl/8.5.0"

try:
    import requests
except ImportError:
    requests = None
    import urllib.error
    import urllib.request


def load_env(path):
    out = {}
    if not os.path.isfile(path):
        return out
    try:
        from dotenv import dotenv_values
        return {k: v for k, v in dotenv_values(path).items() if v is not None}
    except ImportError:
        pass
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


class Likha:
    def __init__(self, url, token):
        self.url = url.rstrip("/")
        self.token = token

    def req(self, method, path, body=None):
        headers = {
            "User-Agent": UA,
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
        }
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        assert not (method == "PATCH" and path.startswith("/relations")), "PATCH /relations is forbidden"
        full = self.url + path
        if requests is not None:
            r = requests.request(method, full, headers=headers, data=data, timeout=60)
            status, text = r.status_code, r.text
        else:
            rq = urllib.request.Request(full, data=data, headers=headers, method=method)
            try:
                with urllib.request.urlopen(rq, timeout=60) as r:
                    status, text = r.status, r.read().decode("utf-8")
            except urllib.error.HTTPError as e:
                status, text = e.code, e.read().decode("utf-8", "replace")
        try:
            payload = json.loads(text) if text else None
        except ValueError:
            payload = text
        return status, payload

    def must(self, method, path, body=None, ok=(200, 201, 204)):
        status, payload = self.req(method, path, body)
        if status not in ok:
            sys.exit(f"BLOCKED: {method} {path} -> {status}\n{self._redact(json.dumps(payload, indent=2) if not isinstance(payload, str) else payload)}")
        return payload

    def _redact(self, s):
        return s.replace(self.token, "***") if self.token else s


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--env", default=DEFAULT_ENV, help="path to env file with LIKHA_URL / LIKHA_TOKEN")
    args = ap.parse_args()

    file_env = load_env(args.env)
    url = os.environ.get("LIKHA_URL") or file_env.get("LIKHA_URL") or DEFAULT_URL
    token = os.environ.get("LIKHA_TOKEN") or file_env.get("LIKHA_TOKEN")
    if not token:
        sys.exit(f"LIKHA_TOKEN not found in environment or {args.env}")
    api = Likha(url, token)

    status, _ = api.req("GET", f"/fields/{COL}")
    if status == 200:
        print(f"{COL} exists, skipping")
        return
    if status != 403:
        sys.exit(f"BLOCKED: GET /fields/{COL} -> {status} (expected 200 or 403)")

    fields = [
        {"field": "id", "type": "uuid",
         "meta": {"special": ["uuid"], "interface": "input", "readonly": True, "hidden": True},
         "schema": {"is_primary_key": True, "length": 36, "has_auto_increment": False}},
        {"field": "scope_id", "type": "string", "meta": {"interface": "input", "required": True},
         "schema": {"is_unique": True, "is_nullable": False}},
        {"field": "sections", "type": "json", "meta": {"interface": "input-code", "options": {"language": "json"}}},
        {"field": "version", "type": "integer", "meta": {"interface": "input"}, "schema": {"default_value": 1}},
        {"field": "updated_by_name", "type": "string", "meta": {"interface": "input"}},
    ]
    res = api.must("POST", "/collections", {
        "collection": COL,
        "meta": {"icon": "grid_on", "note": "Syllabus evaluation matrix (per scope)", "accountability": "all"},
        "schema": {},
        "fields": fields,
    })
    print(f"created collection: {res['data']['collection']}")

    audit = [
        ("date_created", "timestamp", "date-created", "datetime"),
        ("user_created", "uuid", "user-created", "select-dropdown-m2o"),
        ("date_updated", "timestamp", "date-updated", "datetime"),
        ("user_updated", "uuid", "user-updated", "select-dropdown-m2o"),
    ]
    for name, typ, special, iface in audit:
        res = api.must("POST", f"/fields/{COL}", {
            "field": name, "type": typ,
            "meta": {"special": [special], "interface": iface, "readonly": True, "hidden": True},
            "schema": {},
        })
        print(f"created field: {res['data']['field']}")

    for name in ("user_created", "user_updated"):
        api.must("POST", "/relations", {
            "collection": COL, "field": name, "related_collection": "directus_users",
            "meta": {"sort_field": "id"},
            "schema": {"on_delete": "SET NULL"},
        })
        print(f"created relation: {COL}.{name} -> directus_users.id")

    perms = api.must("GET", "/permissions?filter%5Bcollection%5D%5B_eq%5D=syllabi&limit=-1")["data"]
    mirrored = []
    for p in perms:
        if p.get("action") not in ("read", "create", "update"):
            continue
        body = {
            "collection": COL,
            "action": p["action"],
            "permissions": p.get("permissions"),
            "validation": p.get("validation"),
            "fields": ["*"],
        }
        # Directus 11 uses policies; older versions use roles.
        for k in ("policy", "role"):
            if p.get(k):
                body[k] = p[k]
        if p["action"] == "create":
            body["presets"] = {"user_created": "$CURRENT_USER"}
        res = api.must("POST", "/permissions", body)
        mirrored.append((body.get("policy") or body.get("role"), p["action"], res["data"]["id"]))
        print(f"created permission: id={res['data']['id']}")
    if mirrored:
        print(f"{'policy/role':<38} {'action':<8} id")
        for who, action, pid in mirrored:
            print(f"{who!s:<38} {action:<8} {pid}")
    else:
        print("WARNING: no read/create/update permissions found on 'syllabi'; nothing mirrored")

    api.must("POST", "/utils/cache/clear", {"cache": "system"})
    print("cleared system cache")

    fl = api.must("GET", f"/fields/{COL}")["data"]
    print("fields:", ", ".join(f"{f['field']}:{f['type']}" for f in fl))
    items = api.must("GET", f"/items/{COL}?limit=1")
    if not isinstance(items.get("data"), list):
        sys.exit(f"BLOCKED: GET /items/{COL} did not return an items array")
    print(f"verified: GET /items/{COL}?limit=1 -> {items['data']}")


if __name__ == "__main__":
    main()
