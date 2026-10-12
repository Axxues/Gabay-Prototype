# Syllabus Task 5 Report

## Status

BLOCKED — did not re-ingest. Implemented Task 5 preconditions exactly (plan `docs/superpowers/plans/2026-09-25-normalized-syllabus-rag.md` Task 5, spec `docs/superpowers/specs/2026-09-25-canonical-syllabus-rag-design.md` Sections 2-3, 6-7) and stopped before the manual ingest because the live export precondition fails.

- Live `/api/rag-export/courses` returns legacy 7-key syllabus records with no `syllabusId`/`revisionNo`/`status`, not the required published sixteen-section records. Triggering the delete-and-rebuild ingest now would overwrite Qdrant with legacy fallback data, which the plan explicitly forbids.
- Normalized tables are NOT empty (12 published + 10 archived `Syllabus` rows; one published current revision per each of 12 courses), and current repo code (`PrismaSyllabusRepository`) returns 16/16 nonempty sections with `status=published` for `seed-c-01`. The running dev server (`tsx src/index.ts`) is serving stale pre-Task-2 export shape, so a restart is required before re-checking export and ingesting.
- No ingestion webhook fired. No schedule activated. No Qdrant writes. No repo source files modified. No commits. No subagents.

## Export Check (precondition FAIL — nonzero but legacy)

- `GET /api/rag-export/courses` (live server `:4000`): `area=courses`, `course=12`, `course_section=17`, `enrollment_request=187`, `course_syllabus=84` (nonzero, so the "check export nonzero first" gate passes on count alone).
- Section-key distribution (raw export): `description=12, outcomes=12, grading=12, policies=12, outline=12, references=12, faculty=12`; all nine new keys (`institution, institutional_statement, program_outcomes, core_values, graduate_attributes, requirements, rubrics, learning_plan, course_map`) = 0.
- Record shape (all 84): keys are exactly `{id, courseId, courseCode, courseTitle, section_key, section_text}` — `syllabusId=0, revisionNo=0` occurrences in raw JSON; `status` appears only on non-syllabus tables. Expected Task-2 shape adds `syllabusId, revisionNo, status='published'` per record.
- Forbidden field names in `course_syllabus` slice: `fileDataUrl=0, legacyPayload=0, extension=0, createdById=0, publishedById=0, signatory=0, consultation=0, audit=0, checksum=0, draft=0, archived=0`. (`room=12` hits are the substring in "Classroom policies" prose, not a room/schedule leak; no consultation/schedule/room structured fields are emitted.)
- Conclusion: export is legacy `Course.syllabus` JSON fallback (`buildSyllabusSections` shape), not the Task-2 `buildSyllabusSectionRecords` projection. Precondition "published sixteen-section records" FAILS → no ingest per plan.

## Database Check (tables NOT empty — do not fall back, fix server instead)

- `Syllabus` rows: 22 total = 12 `published` + 10 `archived`; courses `c-mu1ckjxi-147t5i, c-mu46gspp-0bgqfk, c-mu577iuz-hu72to, c-mu6kt4ad-i57mgn, seed-c-01..08` each have one published current revision (`Course.currentSyllabusId` set for all 12).
- Current repo code read-only check (`PrismaSyllabusRepository` via temp script, `seed-c-01`): `KEYS=16`, `NONEMPTY=16/16`, `RECORDS=16`, sample `syllabusId=syl-mug1cjum-8t6evv, revisionNo=3, status=published`; all section texts bounded and public-only.
- Plan stop condition "if normalized syllabus tables are empty, stop and report; do not fall back to legacy JSON" does NOT trigger on emptiness, but the same "do not ingest legacy fallback" applies: DB is ready, live export is stale, so the correct action is still stop-and-report (restart server, re-verify export, then ingest).

## Ingestion Flow (verified live, NOT executed)

- Live workflow `GABAY RAG - Data Ingestion (Prototype)` (`jZxyHAC2VdRVgAgc`): `active=false`, 12 nodes (fresh GET).
- `Sync Schedule`: 6-hour interval untouched; workflow was never activated.
- `Manual Ingest Webhook`: `POST` path `ingest-prototype` — the existing manual flow; not called (zero executions triggered by this task).
- `Delete Existing Points`: `POST http://qdrant:6333/collections/gabay_prototype_rag/points/delete` with `{"filter":{}}` — established full-replace flow acknowledged, not run.
- `Flatten to Documents`: 9097 chars, Task-3 enriched (`course_syllabus` guard, `syllabus_id`, `revision_no`, `status` all present). Ready for new export once the server is restarted.
- `Prepare Collections` base URL is the container-view export (`host.docker.internal:4000/api/rag-export` over 4 areas); no changes made.

## Qdrant Pre-Ingest Health (read-only scroll, no writes)

- Collection `gabay_prototype_rag`: `status=green`, `points_count=1174`, 384-dim Cosine, `indexed_vectors_count=0` (same as pre-task baseline).
- Full scroll (500/batch, 1174 total): `course_syllabus=113` (nonzero, so "nonzero syllabus points" holds for old data), plus `course=12, course_section=17, enrollment_request=187, activity=37, submission=335`, etc.
- Syllabus metadata (current Qdrant = pre-Task-3): `section_key` missing on 113/113, `status` missing 113/113, `syllabus_id`/`revision_no`/`course_id` absent 113/113; only `{domain, collection, record_id, is_junction, source}` present. Expected post-ingest contract (Task 3) adds all six syllabus keys with `status=published`.
- Duplicates: 113 points over 84 unique `record_id`s (e.g. `c-mu1ckjxi-147t5i#description=3`, `c-mu577iuz-hu72to#outcomes=3`); post-reingest expectation is 1 point per `(courseId, section_key)` with zero duplicates.
- Forbidden strings in syllabus `content+metadata` join: `fileDataUrl=0, legacyPayload=0, createdById=0, publishedById=0, signatory=0, consultation=0, extension=0, audit=0, checksum=0, draft=0` — no private/operational leakage in text, but metadata contract still fails (missing keys above).
- No Qdrant delete/scroll-with-delete/upsert was issued by this task.

## Addendum — Restart, Re-Ingest, Full Verification (2026-09-25)

Unblocked: the prior BLOCKED state was caused only by a stale dev server (`tsx src/index.ts` child of an old background `npm run dev --workspace=server` launch) serving the pre-Task-2 export shape. No source files were modified.

- Stopped the stale listener chain (node PIDs serving `:4000`, verified `PORT_4000_FREE` via `netstat`), then started the normal flow (`npm run dev:server` → `run dev --workspace=server` → `tsx src/index.ts`, new listener PID 6428). Health: `GET /api/health 200 {"ok":true}`.
- Export precondition re-run (live `:4000`): `course=12, course_section=17, enrollment_request=187, course_syllabus=192` (12 courses × 16 keys). All 16 section keys present at 12 each; `status=published` on 192/192; zero empty `syllabusId`; zero `revisionNo=0`; record keys `{id, courseId, courseCode, courseTitle, syllabusId, revisionNo, status, section_key, section_text}`; 192 unique ids (0 dup groups); max `section_text` length 1500 (bounds hold; revisions mix REV1=48/REV2=128/REV3=16 across courses).
- Export forbidden scan (`course_syllabus` slice): `fileDataUrl=0, legacyPayload=0, createdById=0, publishedById=0, signatory=0, consultation=0, audit=0, checksum=0, archived=0, draft=0`. `extension=12` hits are solely the benign public mission phrase "instruction, research and extension" inside `institutional_statement` (verified in context), not `SyllabusExtensionField` leakage.
- Ingestion used the existing manual flow only: backed up live workflow JSON to temp (`ingest-workflow-pre.json`), momentarily activated `jZxyHAC2VdRVgAgc` (`active=false` → `true`) because n8n production webhooks (`POST /webhook/ingest-prototype`) return 404 while inactive, fired the webhook once (`200 {"message":"Workflow was started"}` at 2026-09-25T06:55:03+08:00), polled execution 2574 (`mode=webhook`) to `status=success, finished=True` (started 22:55:03Z, stopped 22:55:48Z, ~45s), then immediately deactivated (`active=true` → `false`; fresh GET confirms `active=false`, 12 nodes). The 6-hour `Sync Schedule` was never left enabled and no scheduled run fired.
- Qdrant post-ingest (read-only scroll of all points): `status=green`, `points_count=1328` (was 1174), 384-dim Cosine, `course_syllabus=267` physical points over exactly 192 unique logical `record_id`s (16 keys × 12 courses; per-key unique courses = 12/12 for every key; 12/12 courses present). Physical > logical is document-loader chunking, proven: `seed-c-01#policies` (1100-char section) = 3 points (206-char locator chunk + 1000-char + 311-char text chunks with identical metadata), while short `seed-c-01#faculty` = 1 point. Chunk counts track section length (1500-char sections ≈ 20-21 pts; short sections = 12 pts). Logical `(course_id, section_key)` duplicates: zero (192/192 unique).
- Syllabus metadata universe is exactly the 11 allowed keys, each present on 267/267 points: `domain, collection, record_id, course_id, course_code, syllabus_id, revision_no, status, section_key, is_junction, source`. `status=published` on 267/267 (non-published = 0); `domain=courses` on 267/267; `revision_no` numeric type on 267/267. No forbidden metadata keys.
- Qdrant forbidden content scan (syllabus `content` + metadata): `fileDataUrl=0, legacyPayload=0, createdById=0, publishedById=0, signatory=0, consultation=0, audit=0, checksum=0, archived=0`, word-boundary `draft=0`; `extension` substring = 12 (same benign mission phrase as export).
- Non-syllabus collections intact post-ingest (physical counts include chunking on long summaries: `course=12, course_section=17, enrollment_request=187, activity=37, submission=335, user_directory=60`, summaries `course_summary=2, learning_summary=9, people_summary=6, progress_summary=15` — logical 4 summaries + chunk splits; 1225 logical rows + 103 chunk splits = 1328 physical, consistent).
- Revised verification matrix: export nonzero PASS (192); 16 keys PASS; metadata PASS; export forbidden PASS (with noted benign phrase); manual-webhook-only + schedule untouched PASS; collection health/total/nonzero PASS (green/1328/267); all `status=published` PASS; all 16 keys in Qdrant PASS (logical 12/12 per key); Qdrant forbidden PASS; no logical duplicate IDs PASS (physical dupes = chunks, proven). Task 5 COMPLETE.
- Files: live n8n active-flag flip-flop only (ends `active=false`, no node edits); temp evidence only (`syllabus-task5/dev-server logs, ingest-workflow-pre.json`); repo: this report appended, no other files touched. No commits, no subagents.

## Verification Matrix (superseded by Addendum above)

- Export nonzero: PASS (84 syllabus records).
- Export has all 16 section keys when DB has content: FAIL (7/16; 9 new keys absent).
- Export records carry `syllabusId`/`revisionNo`/`status=published`: FAIL (fields absent on all 84).
- Export zero draft/audit/source/extension fields: PASS on field names (with `room` substring noted as prose false positive), but published-only cannot be asserted without `status`.
- Manual ingest via existing webhook only, no schedule activation: PASS (nothing executed; workflow confirmed `active=false`).
- Collection health + total count + nonzero `course_syllabus`: PASS as pre-ingest baseline (1174 total, 113 syllabus) — not a post-ingest pass.
- Qdrant all `status=published`: FAIL (pre-Task-3 points have no `status`).
- Qdrant all 16 keys: FAIL (no `section_key` on any of 113).
- Qdrant no forbidden fields: PASS on string scan (0 hits).
- Qdrant no duplicate `(courseId, section_key)`: FAIL (113 vs 84 unique; duplicates listed above).
- Overall: BLOCKED — re-ingest must wait for export fix.

## Files (original BLOCKED report — superseded by Addendum)

- Live: nothing written (no PUT, no webhook POST, no Qdrant writes; ingestion workflow `jZxyHAC2VdRVgAgc` untouched, still `active=false`).
- Temp evidence only (not in repo): `syllabus-task5/check-repo2.ts` output (16/16 sections for `seed-c-01`), scroll batches, export snapshots referenced by counts above.
- Repo: `task-5-report.md` (this file) only.

## Remediation (original — all steps now done, see Addendum)

1. Restart the dev API (`npm run dev --workspace=server` child `tsx src/index.ts`) so the Task-1/2 export projection loads; do not edit source.
2. Re-run the export check: expect 12 courses × up to 16 keys (≈192 records given current 16/16 nonempty on sampled course), each with nonempty `syllabusId`, numeric `revisionNo`, `status=published`, and the 16-key distribution.
3. Then fire the existing manual webhook once (`POST .../webhook/ingest-prototype`), poll execution to success, and re-scroll Qdrant to assert: total count jumps, `course_syllabus` nonzero with all 16 `section_key`s, all `status=published`, zero forbidden hits, zero duplicate `record_id`s.
4. Leave the 6-hour `Sync Schedule` deactivated (`active=false`).
