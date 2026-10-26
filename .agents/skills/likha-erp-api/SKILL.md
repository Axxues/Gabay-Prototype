---
name: likha-erp-api
description: Project skill for working with Likha ERP platform APIs — collections, fields, relations, flows, dashboards, print templates, and public endpoints. Read before any Likha ERP API work.
---

# Likha ERP API

Read before any API work on a Likha ERP project. Every rule below came from a real production failure.

## Conventions

- `https://your-domain.com` — project URL. Token in env var `LIKHA_TOKEN`, never committed.
- Prefix every artifact your app creates (collections, junctions, flows, roles, policies) with a consistent `app_`-style prefix. On shared instances, never touch collections outside your prefix.
- System collections: `system_users`, `system_files`, `system_relations`, `system_flows`, `system_panels`, `system_permissions`, `system_access`.

## Request layer

- **Send a conventional User-Agent.** Hosted instances sit behind a WAF that blocks `Python-urllib/*` and similar on writes (`403 error code: 1010`). Always send `User-Agent: curl/8.5.0` or use curl directly. GETs are unaffected.
- **URL-encode filter params** — `filter%5Bkey%5D%5B_eq%5D`, not raw brackets (intermittent proxy failures).
- **Missing-field GETs return 403, not 404.** Existence-check via `GET /fields/{col}` + search, or POST and tolerate 400.
- **Write effects are async** — flows stamp fields after the POST returns; re-fetch before verifying.
- **Readonly is a UI concept** — readonly fields accept explicit values via API (backdating seeds/migrations).
- **Creating at final status skips `items.update` flows** — set derived fields (timestamps, warranties, totals) explicitly in the create payload.
- **No dedupe on `/panels`, `/dashboards`, `/flows`, `/operations`** — GET-filter by name before POSTing. Build op chains tail-first, then PATCH `flow.operation` to the first op's id.
- **NEVER PATCH `/relations` — it crashes the server.** Any `PATCH /relations/{collection}/{field}` exits the process mid-request; nodemon does NOT auto-restart (type `rs` + Enter; docker → `docker compose restart`). `POST /relations` is safe. To change relation behavior post-creation, fix at DB level via `likha_sql` + `POST /utils/cache/clear {"cache":"system"}` — or recreate the relation.
- **Shell `$` expansion corrupts options** — `python -c "... $trigger ..."` inside double quotes silently strips `$trigger`/`$last`/`$full` → flows die silently. Always patch ops containing `$` tokens from a script file, never inline. Verify stored options after.
- **Windows**: open HTTP-fetched JSON with `encoding='utf-8'` (cp1252 dies on smart quotes).

## Data model

- **Folders** = collection with `schema: null`; membership = `PATCH /collections/{name} meta.group="<Folder>"`.
- **`meta.accountability:"all"` does NOT create audit fields.** Create `user_created`/`date_created`/`user_updated`/`date_updated` explicitly (uuid/timestamp, specials `user-created`/`date-created`/`user-updated`/`date-updated`, readonly+hidden), then POST the two M2O relations to `system_users` — else "relationship not configured".
- **Reverse O2M aliases** come from `meta.one_field` on the relation POST — then PATCH `/fields/{col}/{alias}` to `interface: list-o2m`, set `options.template`, and `meta.group` for tab placement.
- **M2M**: `junction_field` on BOTH junction→parent relations + alias `list-m2m`/`files`. Missing second side = "relationship not configured". Fix via `likha_sql`, not PATCH /relations.
- **Prefer O2M junction-with-payload** when links carry data (role, price) — inline-editable via `list-o2m`, no `junction_field` issues.
- **Junction FK fields must not be `hidden`** — breaks `list-m2m`/`files`.
- **Cascade deletes**: `one_deselect_action` can't be PATCHed — delete junction rows first, or DB FK `ON DELETE CASCADE` + update the relations registry + cache clear.
- **Tab layouts**: group field = `type: alias`, `special: ["alias","group","no-data"]`; children point via `meta.group`; `meta.translations` for tab labels.
- **Singletons**: POST → `ROUTE_NOT_FOUND`; use PATCH.
- **list-o2m**: `options.fields:["a","b"]` renders real table columns; add `options.sortField`, `enableLink/Create/Select/SearchFilter`. Hide pure junctions via collection `meta.hidden:true`. M2O pickers need `options.template` or they show raw UUIDs.
- **Geometry fields**: `geometry.Point` / `geometry.MultiPolygon` / `geometry` — never `type:"point"`. GeoJSON payloads are **lng first**. Map options: `{basemap:"OpenStreetMap", defaultView:{center:{lat,lng},zoom}}` (no token needed).

## Permissions & tenancy

- **`$CURRENT_USER` is NOT a valid `schema.default_value`** (500 invalid uuid) — use permission presets: `presets: {"created_by": "$CURRENT_USER"}` on each role's create permission. Deep paths like `$CURRENT_USER.app_store` work in presets and filters.
- **Multi-tenant pattern**: tenant root collection; `tenant` M2O on every entity + on `system_users`; role filter `{tenant:{_eq:"$CURRENT_USER.tenant"}}`; junctions filter via parent; create presets stamp tenant; admin role unfiltered. Serials embed tenant code (`DOC-SITE1-2026-0001`).
- **Append-only collections**: remove update/delete perms for staff (managers keep all); `created_by` readonly + preset; flow-stamped fields readonly (blank = pending).

## Automation

- **Event flow options**: `scope` = EVENT names (`["items.create"]`), `collections` = collection names, `type: "action"`, `async: true`. Collections in `scope` → never fires, silently. `{{$trigger.collection}}` interpolates the collection name → one dynamic flow across many collections.
- **`$trigger` shape** for items.update = `{payload:{changedFields}, keys:[ids], collection, event}` — `payload` is NOT double-nested.
- **Gate inside Run Script, not Condition** — an op that `throw`s routes to `reject` (null) and stops the chain cleanly.
- **`resolve`/`reject` targets are unique** — unlink existing resolve before inserting an op.
- **`emitEvents: false`** on every op that writes back to the trigger collection (loop prevention).
- **`item-update` key**: literal, `{{$last.key}}`, or `{{$trigger.keys[0]}}`.
- **Serial numbering**: items.create event → `likha_sql` computes next `PREFIX-YYYY-NNNN` → item-update writes `{{sql_1.rows.0.serial}}`.
- **Webhook triggers are GET** — `POST /flows/trigger/{id}` 403s unless `options.method:"POST"`. Response body = last op's return. Set `options.error_on_reject:true` on API/chart flows.
- **`likha_sql` returns `{sql, binding, rows:[...]}`** — template `{{sql_1.rows.0.col}}`; in Run Script unwrap `data.sql_1.rows || data.sql_1`. `UPDATE` returns `rows:[]`. `{{sql_1.0.x}}` stores literal "undefined". Interpolated input is NOT escaped — `String(s).replace(/'/g,"''")` in a validate op first.
- **Run Script output must be JSON-safe** — no functions (`formatter` → "could not be cloned"); use string templates `'{b}: {c}'`.
- **Send Email needs `EMAIL_*` env** on the server or silently sends nothing.

## Dashboards & panels

- **`GET /extensions?limit=-1`** enumerates all panel/interface/operation types (`schema.type` + `schema.name`). Type ids are NOT inferable from display names — read them here. Custom ops like `likha_sql` are extensions too. `GET /extensions/sources/index.js` serves the deployed bundle — grep it to verify a deploy landed; extension updates need a backend redeploy + client hard-refresh.
- **Panel types**: `echarts-panel`, `likhaHeatmap-panel`, `choropleth-map-panel`, `table-view-panel`, `calendar-panel`, `likhaButtonLink-panel`, `flow-triggers-panel`.
- **`echarts-panel`** options: `{flow:{key:<flow-uuid>, collection:"system_flows"}}`. Panel GETs `/flows/trigger/{id}`; last op must return a plain ECharts option (no functions). Recipe: webhook trigger, `accountability:"all"`, `error_on_reject:true`; ops `likha_sql` → Run Script returning the option.
- **Metric panel**: `{collection, field:"id", function:count|sum|avg|min|max, filter:{...}, sortField:null}` — `$NOW` works in filters. Pre-verify with `/items/{col}?aggregate[count]=id`.
- **Grid**: dashboard ~56 units wide; metrics ~8×9, echarts ~27×22; `show_header:true` renders `name`.
- **`likhaHeatmap-panel`**: queries the collection itself (no flow). Options `{collection, geoField, field?, filter?, popupFields?, autoFitBounds, defaultCenter(GeoJSON Point), defaultZoom, colorScheme(coolwarm|viridis|plasma|grayscale|spectral), heatmapRadius, heatmapIntensity, showCircleLayer, enableClustering, clusterRadius, clusterAggregation(count|sum|avg|min|max), clusterCategories}`. `field` must be a real numeric field or OMIT it. Options UI is buggy — configure via `PATCH /panels/{id}`.
- **`csv` fields** store a JSON-array string — expand in SQL with `jsonb_array_elements_text(col::jsonb)`, never `string_to_array`.

## Print templates

- **`print` field**: `type:"alias"`, `special:["alias","no-data"]`, `interface:"print"`, `options:{templateSelection:{collection:"print_template", key:"<template-row-uuid>"}, fields:["*.*.*"]}`.
- **LiquidJS context** = item resolved to `fields` depth: M2O → nested object; O2M → array of junction rows. Filters `default`, `date`, `upcase`, `capitalize`, `replace`, `newline_to_br`, `{% case %}` all work.
- **Letterhead**: `settings` M2O → settings singleton, stamped by an items.create flow (`emitEvents:false`, `permissions:"$full"`); backfill once. Template reads `{{ settings.org_name }}`. Multi-tenant: one settings row per tenant, templates unchanged.
- **`csv` fields reach templates as JSON strings** — `{% assign t = field | split: ',' %}` then `| replace:'[','' | replace:']','' | replace:'"',''`.
- **Multiple `print` alias fields per collection are fine** — separate `templateSelection` each.
- **QR codes**: `api.qrserver.com` img → portal verify URL. Re-fetch template UUIDs by name — terminal output clips long ids.

## Public endpoints & portals

- **Public webhook flow**: `trigger:"webhook"`, `accountability:"all"`, `options.method:"GET"|"POST"`. `data.$trigger.body` / `data.$trigger.query` in ops; last op's return = response body; thrown error → `{}` (clients treat as not-found).
- **Chain**: validate (required fields + `String(s).replace(/'/g,"''")` escape) → `likha_sql` → respond (sanitized/masked).
- **Raw `likha_sql` INSERT emits NO items.create** — serial/stamp flows are bypassed; compute serial + due dates in the INSERT's CTE.
- **Shared-secret tracking**: ref + mobile number pairs; **mask PII** in verify responses (`first_name || ' ' || left(last_name,1) || '.'`).
- **Portal SPA**: static host + `basename`, GH-Pages 404→`sessionStorage` bounce; routes `/` `/request` `/track/:ref/:key` `/verify/:serial`; verify UNIONs printable collections.

Full guides: https://docs.likhaerp.com/guides/
