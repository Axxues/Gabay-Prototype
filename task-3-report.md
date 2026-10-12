# Syllabus Task 3 Report

## Status

Implemented Syllabus Task 3 (plan `docs/superpowers/plans/2026-09-25-normalized-syllabus-rag.md`, spec `docs/superpowers/specs/2026-09-25-canonical-syllabus-rag-design.md` Sections 2-7) on live ingestion workflow `jZxyHAC2VdRVgAgc` only.

- Backed up all 11 live workflows to `C:\Users\JV\AppData\Local\Temp\opencode\syllabus-task3-backup\` (one JSON per workflow id, including `jZxyHAC2VdRVgAgc.json`).
- Updated ONLY the `Flatten to Documents` Code node (`n8n-nodes-base.code`, typeVersion 2) so `course_syllabus` records preserve the spec metadata: `domain`, `collection`, `record_id`, `course_id`, `course_code`, `syllabus_id`, `revision_no` (number), `status`, `section_key`, `is_junction: false`, `source: gabay-prototype:course_syllabus/<record_id>`.
- New keys are added only when the export provides them, so old exports without `syllabusId`/`revisionNo`/`status` keep working and simply omit those keys.
- Non-syllabus collections are untouched (generic flatten path unchanged; progress `student_id` rule preserved; summaries unchanged).
- PUT the full workflow back and re-fetched (fresh GET) to assert exact construction.
- No Qdrant delete/re-ingest, no E2E runs, no commits, no subagents. No repo source files modified.

## Fixture Evidence (persisted Code node executed locally)

Harness `C:\Users\JV\AppData\Local\Temp\opencode\syllabus-task3-fixture.cjs` stubs `$('Prepare Collections')` / `$input` and runs the exact persisted `jsCode`:

- `old-code-drops-syllabus-fields`: PASS — backup code run against the NEW enriched record drops all six syllabus keys.
- `new-code-old-fixture-omits-absent-keys`: PASS — new code run against the OLD legacy record omits absent `syllabus_id`/`revision_no`/`status` while keeping `course_id`, `course_code`, `section_key`.
- `new-code-old-fixture-base`: PASS — old fixture keeps `domain=courses`, `collection=course_syllabus`, `record_id=c-01#description`, `is_junction=false`, `source=gabay-prototype:course_syllabus/c-01#description`.
- `new-code-new-fixture-exact`: PASS — new code run against the NEW record yields exactly (key-order-insensitive): `{domain:courses, collection:course_syllabus, record_id:c-01#outcomes, course_id:c-01, course_code:CMSC131, syllabus_id:syl-001, revision_no:3, status:published, section_key:outcomes, is_junction:false, source:gabay-prototype:course_syllabus/c-01#outcomes}`.
- `new-code-revision-is-number`: PASS — `revision_no` is a number.
- `new-code-control-unaffected`: PASS — plain `course` record gains no syllabus keys.

Result: `ALL FIXTURE CHECKS PASSED` (6/6).

## Live PUT/GET Evidence

- Target: `GABAY RAG - Data Ingestion (Prototype)` (`jZxyHAC2VdRVgAgc`), 12 nodes, `active=false` before and after.
- PUT: full-workflow `PUT /api/v1/workflows/jZxyHAC2VdRVgAgc` with only `Flatten to Documents.parameters.jsCode` replaced (7907 → 9097 chars). Response `id=jZxyHAC2VdRVgAgc`.
- Fresh GET asserts:
  - `CODE_MATCH_FILE True` (live `jsCode` byte-equals `syllabus-task3-flatten-new.js`, SHA `ee88bbbb8ca54dad`).
  - Contains `t.collection === 'course_syllabus'` guard plus `meta.course_id`, `meta.course_code`, `meta.syllabus_id`, `meta.revision_no`, `meta.status`, `meta.section_key` (all HAS).
  - `OTHER_NODES_IDENTICAL True`, `CONNS_SAME True`, `NODE_COUNT 12/12`, `OLD_CODE_DIFFERS True`.
  - No other workflow was PUT.

## Files

- Live only: n8n workflow `jZxyHAC2VdRVgAgc` (`Flatten to Documents` node).
- Temp evidence (not in repo): `syllabus-task3-backup/*.json` (11 files), `syllabus-task3-flatten-current.js`, `syllabus-task3-flatten-new.js`, `syllabus-task3-fixture.cjs`, `syllabus-task3-verify.py`.
- Repo: `task-3-report.md` (this file) only.

## Concerns

- Key order in the live metadata object places base keys (`is_junction`, `source`) before the appended syllabus keys; Qdrant payload semantics are order-insensitive and the fixture asserts the exact key/value set. The report's canonical JSON shows spec order for readability.
- `git diff --check` is not applicable to this untracked report file; no tracked repo files were modified by this task.
- Re-ingest (Task 5) intentionally not run; Qdrant still holds pre-Task-3 points until that step.
