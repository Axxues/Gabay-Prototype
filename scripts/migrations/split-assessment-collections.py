#!/usr/bin/env python3
"""
Split per-assessment-type collections out of `activities`.

Phase A (default): create `assignments`, `projects`, `presentations` (fields
cloned from activities minus `assessment_type` — the collection IS the type),
add per-type FK string columns to submissions / assessment_questions /
rubric_criteria / module_items, copy migrated rows, and mirror the
`activities` permissions onto the new collections.

Phase B (--delete-legacy): after validating Phase A, re-point child rows and
delete the corresponding `activities` rows. Destructive; requires the flag.

Safety conventions (likha-erp-api):
- User-Agent curl/8.5.0 (Cloudflare WAF), URL-encoded filters.
- Idempotent: safe to re-run. Rows are keyed 1:1 by id.
- Item mutations only — NEVER PATCH /relations.
- Attachment junction rows are deleted before their parent rows (FK safety).
- System cache cleared at the end.

Usage:
    LIKHA_TOKEN=... python scripts/migrations/split-assessment-collections.py
    LIKHA_TOKEN=... python scripts/migrations/split-assessment-collections.py --delete-legacy
"""

import json
import os
import sys
import urllib.error
import urllib.request

LIKHA_URL = os.environ.get("LIKHA_URL", "https://gabay.zyberlab.com").rstrip("/")
LIKHA_TOKEN = os.environ.get("LIKHA_TOKEN", "")

if not LIKHA_TOKEN:
    sys.exit("LIKHA_TOKEN is required (never commit it).")

HEADERS = {
    "Authorization": f"Bearer {LIKHA_TOKEN}",
    "Content-Type": "application/json",
    "User-Agent": "curl/8.5.0",
}


def api_request(path, method="GET", payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(LIKHA_URL + path, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return {"ok": True, "status": resp.status, "data": json.loads(content) if content else {}}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body}
        return {"ok": False, "status": e.code, "data": parsed}


TYPE_TO_COLLECTION = {
    "assignment": "assignments",
    "project": "projects",
    "presentation": "presentations",
}
NEW_COLLECTIONS = list(TYPE_TO_COLLECTION.values())

ACTIVITY_CLONE_FIELDS = [
    ("course_id", "string", {}, {"interface": "input", "width": "half", "note": "Courses.id"}),
    ("title", "string", {}, {"interface": "input", "width": "half"}),
    ("description", "text", {}, {"interface": "input-multiline"}),
    ("term", "string", {}, {"interface": "input", "width": "half"}),
    ("format", "string", {}, {"interface": "input", "width": "half"}),
    ("category", "string", {}, {"interface": "input", "width": "half"}),
    ("weight", "float", {}, {"interface": "input", "width": "half"}),
    ("total_points", "integer", {}, {"interface": "input", "width": "half"}),
    ("due_date", "dateTime", {}, {"interface": "datetime", "width": "half"}),
    ("available_from", "dateTime", {}, {"interface": "datetime", "width": "half"}),
    ("available_until", "dateTime", {}, {"interface": "datetime", "width": "half"}),
    ("published", "boolean", {}, {"interface": "boolean", "width": "half"}),
    ("metadata", "json", {}, {"interface": "input-code", "width": "full"}),
    ("instructions", "text", {}, {"interface": "input-multiline"}),
    ("submission_types", "json", {}, {"interface": "input-code", "width": "full"}),
    ("rubric", "json", {}, {"interface": "input-code", "width": "full",
                            "note": "Legacy inline rubric; live criteria live in rubric_criteria"}),
    ("file_name", "string", {}, {"interface": "input", "width": "half"}),
    ("file_url", "string", {}, {"interface": "input", "width": "half"}),
    ("file_size", "string", {}, {"interface": "input", "width": "half"}),
    ("section_restriction", "string", {}, {"interface": "input", "width": "half"}),
    ("attachments", "json", {}, {"interface": "input-code", "width": "full",
                                 "note": "Attachment docs {directus_files_id, name, url, ...}"}),
]

# Child collections that gain the three per-type FK columns.
FK_COLUMN_TARGETS = ["submissions", "assessment_questions", "rubric_criteria", "module_items"]


def collection_names(payload):
    """Tolerate /collections shapes: list of dicts, dict keyed by name, or raw string."""
    data = payload.get("data") if isinstance(payload, dict) else None
    names = set()
    if isinstance(data, list):
        for c in data:
            if isinstance(c, dict) and "collection" in c:
                names.add(c["collection"])
    elif isinstance(data, dict):
        names.update(str(k) for k in data)
    elif isinstance(data, str):
        try:
            parsed = json.loads(data)
            names |= collection_names({"data": parsed})
        except Exception:
            pass
    return names


def ensure_collection_with_fields(name, field_specs):
    cols = api_request("/collections")
    existing = collection_names(cols)
    if name not in existing:
        res = api_request("/collections", method="POST", payload={
            "collection": name,
            "schema": {},
            "fields": [{
                "field": "id",
                "type": "string",
                "schema": {"is_primary_key": True, "has_auto_increment": False},
                "meta": {"interface": "input", "readonly": True},
            }],
        })
        if not res["ok"]:
            print(f"FAILED create collection {name}: {res['status']} {json.dumps(res['data'])[:300]}")
            return False
        print(f"create collection {name}")
    else:
        print(f"skip   collection {name} (exists)")
    present = fields_for(name)
    for field, ftype, schema_extra, meta in field_specs:
        if field in present:
            continue
        schema = {"is_nullable": True}
        schema.update(schema_extra)
        res = api_request(f"/fields/{name}", method="POST", payload={
            "field": field, "type": ftype, "meta": meta, "schema": schema,
        })
        if not res["ok"]:
            print(f"FAILED {name}.{field}: {res['status']} {json.dumps(res['data'])[:200]}")
        else:
            print(f"create {name}.{field}")


def fields_for(collection):
    res = api_request(f"/fields/{collection}")
    if not res["ok"]:
        sys.exit(f"Cannot read fields for {collection}: {res['status']}")
    return {f["field"] for f in res["data"].get("data", [])}


def add_type_fk_columns():
    for collection in FK_COLUMN_TARGETS:
        present = fields_for(collection)
        for f in ("assignment_id", "project_id", "presentation_id"):
            if f in present:
                print(f"skip   {collection}.{f}")
                continue
            res = api_request(f"/fields/{collection}", method="POST", payload={
                "field": f, "type": "string",
                "meta": {"interface": "input", "width": "half",
                         "note": "Assignments.id / Projects.id / Presentations.id"},
                "schema": {"is_nullable": True},
            })
            if res["ok"]:
                print(f"create {collection}.{f}")
            else:
                print(f"FAILED {collection}.{f}: {res['status']} {json.dumps(res['data'])[:200]}")


def fetch_migrated_rows():
    q = ("/items/activities?filter%5Bassessment_type%5D%5B_in%5D=assignment%2Cproject%2Cpresentation"
         "&fields=*%2Cattachments.directus_files_id.*&limit=2000")
    res = api_request(q)
    if not res["ok"]:
        sys.exit(f"Cannot fetch activities: {res['status']} {json.dumps(res['data'])[:300]}")
    return res["data"].get("data", []), res["ok"]


def phase_a():
    print("=== Phase A: collections, FK columns, row copy, permissions ===")
    print("-- 1. collections + cloned fields")
    for name in NEW_COLLECTIONS:
        ensure_collection_with_fields(name, ACTIVITY_CLONE_FIELDS)

    print("-- 2. per-type FK columns on child collections")
    add_type_fk_columns()

    print("-- 3. copy rows")
    rows, _ = fetch_migrated_rows()
    print(f"fetched {len(rows)} activities rows to migrate")
    for row in rows:
        target = TYPE_TO_COLLECTION.get(row.get("assessment_type"))
        if not target:
            continue
        payload = dict(row)
        payload.pop("assessment_type", None)
        existing_row = api_request(f"/items/{target}/{row['id']}")
        if existing_row.get("ok") and existing_row["data"].get("data"):
            print(f"skip   {target}/{row['id']} (already exists)")
            continue
        res = api_request(f"/items/{target}", method="POST", payload=payload)
        if not res["ok"]:
            print(f"FAILED {target}/{row['id']}: {res['status']} {json.dumps(res['data'])[:300]}")
        else:
            print(f"copy   {row['assessment_type']} {row['id']} -> {target}")

    print("-- 4. mirror activities permissions")
    mirror_activities_permissions()
    clear_cache()


def mirror_activities_permissions():
    res = api_request("/permissions?filter%5Bcollection%5D%5B_eq%5D=activities&limit=-1")
    if not res["ok"]:
        print("FAILED reading activities permissions:", res["status"])
        return
    policy_actions = {}
    for p in res["data"].get("data", []):
        policy_actions.setdefault(p["policy"], set()).add(p["action"])
    for policy, actions in policy_actions.items():
        for collection in NEW_COLLECTIONS:
            for action in actions:
                existing = api_request(
                    "/permissions?filter%5Bpolicy%5D%5B_eq%5D=" + policy
                    + "&filter%5Bcollection%5D%5B_eq%5D=" + collection
                    + "&filter%5Baction%5D%5B_eq%5D=" + action
                )
                if existing.get("ok") and existing["data"].get("data"):
                    print(f"skip   {collection} {action} (policy {policy[:8]}...)")
                    continue
                res = api_request("/permissions", method="POST", payload={
                    "policy": policy,
                    "collection": collection,
                    "action": action,
                    "fields": ["*"],
                })
                if not res["ok"]:
                    print(f"FAILED {collection} {action} policy {policy[:8]}: {res['status']}")
                else:
                    print(f"grant  {collection} {action} -> policy {policy[:8]}...")


def phase_b():
    print("=== Phase B: re-point child rows, then delete legacy activities rows ===")
    rows, _ = fetch_migrated_rows()
    ids_by_type = {}
    for row in rows:
        ids_by_type.setdefault(row.get("assessment_type"), []).append(row["id"])
    if not any(ids_by_type.values()):
        print("nothing left to migrate")
    for rtype, ids in ids_by_type.items():
        if not ids:
            continue
        col = f"{rtype}_id"
        filter_str = "%2C".join(ids)
        print(f"-- re-point assessment_questions.{col} ({len(ids)} rows)")
        res = api_request(
            f"/items/assessment_questions?filter%5Bactivity_id%5D%5B_in%5D={filter_str}&limit=-1")
        for q in (res.get("data", {}).get("data") or []):
            api_request(f"/items/assessment_questions/{q['id']}", method="PATCH",
                        payload={"activity_id": None, col: q["activity_id"]})
        print(f"-- re-point rubric_criteria.{col}")
        res = api_request(
            f"/items/rubric_criteria?filter%5Bactivity_id%5D%5B_in%5D={filter_str}&limit=-1")
        for c in (res.get("data", {}).get("data") or []):
            api_request(f"/items/rubric_criteria/{c['id']}", method="PATCH",
                        payload={"activity_id": None, col: c["activity_id"]})
        print(f"-- re-point submissions.{col} + null activity_id")
        res = api_request(
            f"/items/submissions?filter%5Bactivity_id%5D%5B_in%5D={filter_str}&limit=-1&fields=*")
        for s in (res.get("data", {}).get("data") or []):
            api_request(f"/items/submissions/{s['id']}", method="PATCH",
                        payload={
                            "activity_id": None, col: s["activity_id"],
                            "submission_type": rtype,
                        })
        # module_items keeps its legacy activity_id (plain string, no FK) for
        # older clients; add the per-type column for current reads/writes.
        print(f"-- stamp module_items.{col}")
        res = api_request(
            f"/items/module_items?filter%5Bactivity_id%5D%5B_in%5D={filter_str}&limit=-1")
        for m in (res.get("data", {}).get("data") or []):
            api_request(f"/items/module_items/{m['id']}", method="PATCH",
                        payload={col: m["activity_id"]})

        print(f"-- delete {len(ids)} legacy activities rows")
        delete_junction_rows_then_activities(ids)
    clear_cache()


def delete_junction_rows_then_activities(activity_ids):
    junction = "activities_files"
    res = api_request(f"/fields/{junction}")
    parent_fk = None
    if res["ok"]:
        for f in res["data"].get("data", []):
            if (f.get("schema") or {}).get("foreign_key_collection") == "activities":
                parent_fk = f["field"]
                break
    if parent_fk:
        q = f"/items/{junction}?filter%5B{parent_fk}%5D%5B_in%5D=" + "%2C".join(activity_ids) + "&limit=-1"
        rows = api_request(q)
        junction_rows = (rows.get("data", {}).get("data") or []) if rows.get("ok") else []
        for r in junction_rows:
            api_request(f"/items/{junction}/{r['id']}", method="DELETE")
        print(f"deleted {len(junction_rows)} junction rows from {junction}")
    elif res["ok"]:
        print(f"no parent FK on {junction}; skipping junction cleanup")
    else:
        print(f"{junction} not present; skipping junction cleanup")

    deleted = failed = 0
    for aid in activity_ids:
        res = api_request(f"/items/activities/{aid}", method="DELETE")
        if res["ok"]:
            deleted += 1
        else:
            failed += 1
            print(f"FAILED delete activities/{aid}: {res['status']} {json.dumps(res['data'])[:200]}")
    print(f"deleted {deleted} activities rows ({failed} failed)")


def clear_cache():
    res = api_request("/utils/cache/clear", method="POST", payload={"cache": "system"})
    print("cache clear:", res["status"] if res.get("ok") else res)


def main():
    if "--delete-legacy" in sys.argv:
        phase_b()
    else:
        phase_a()


if __name__ == "__main__":
    main()
