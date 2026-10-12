# Syllabus Task 4 Report

## Status

Implemented Syllabus Task 4 (plan `docs/superpowers/plans/2026-09-25-normalized-syllabus-rag.md`, spec `docs/superpowers/specs/2026-09-25-canonical-syllabus-rag-design.md` Sections 4 and 7) on live main workflow `AtgiSrVPbqjgdZ9x` only.

- Backed up the live main workflow to `C:\Users\JV\AppData\Local\Temp\opencode\syllabus-task4-backup\AtgiSrVPbqjgdZ9x.json` (25 nodes, `active=true`, `updatedAt 2026-09-24T19:15:21.239Z`; identical to the Task 3-era backup, so no concurrent drift).
- Added `RAG: Syllabus` (`@n8n/n8n-nodes-langchain.vectorStoreQdrant`, typeVersion 1.3, `mode: retrieve-as-tool`, collection `gabay_prototype_rag`, `topK: 30`, existing Qdrant credential `BKVtLxmJDtkwMyn6`) with the spec filter `{"must":[{"key":"metadata.metadata.collection","match":{"value":"course_syllabus"}}]}`.
- Tool description covers all sixteen public section keys (verified `DESC16 True`): `institution`, `description` (course information), `faculty`, `institutional_statement`, `program_outcomes`, `core_values`, `graduate_attributes`, `requirements`, `grading`, `rubrics`, `policies`, `outline`, `learning_plan`, `outcomes` (course outcomes), `course_map`, `references`. Published revisions only; drafts and private operational data never indexed.
- Connected `RAG: Syllabus` to exactly three agents (`Coordinator_Agent`, `Courses_Agent`, `Learning_Agent`); `People_Agent` and `Progress_Agent` are not connected. Embeddings (`Embeddings HuggingFace Inference` → `ai_embedding`) extended to the new tool, mirroring the existing vector tools.
- `Courses_Agent`: `RAG: Courses` tool entry no longer claims syllabus content; new `RAG: Syllabus` tool entry added; record rules own `institution`, `description` (course information), `faculty`, `institutional_statement`, `policies`, `references`, and route `outcomes`/`learning_plan`/`grading`/`rubrics`/`outline`/`course_map` to `Learning_Agent`.
- `Learning_Agent`: new `RAG: Syllabus` tool entry added; record rules own `outcomes`, `learning_plan`, `grading`, `rubrics`, `outline`, `course_map`, and route `institution`/`description`/`faculty`/`institutional_statement`/`policies`/`references` to `Courses_Agent`.
- `Coordinator_Agent`: Rule 3 delegation lists syllabus subsection ownership per specialist; mandatory delegation gains a direct-semantic-syllabus rule (call `RAG: Syllabus` first, or delegate by subsection) plus the hybrid rule (syllabus + module/activity/content questions call `RAG: Syllabus` together with the matching domain vector tool and combine both results).
- `Analytical Count` untouched: its description already lists `course_syllabus` under valid `courses` collections, and snapshot-completeness semantics are preserved.
- PUT the full workflow back and re-fetched (fresh GET) to assert the contract.
- No ingestion, no Qdrant re-ingest, no E2E runs, no commits, no subagents. No repo source files modified.

## Live PUT/GET Evidence

- Target: `LIKHA RAG - Retrieval Workflow (Gabay Webhook)` (`AtgiSrVPbqjgdZ9x`), 25 → 26 nodes, `active=true` before and after.
- PUT: full-workflow `PUT /api/v1/workflows/AtgiSrVPbqjgdZ9x` with payload `{name, nodes, connections, settings}`. Response `id=AtgiSrVPbqjgdZ9x`, 26 nodes.
- Fresh GET asserts:
  - `NODE_COUNT 26`; new node `RAG: Syllabus` type `@n8n/n8n-nodes-langchain.vectorStoreQdrant`, typeVersion 1.3, `topK 30`, `mode retrieve-as-tool`, collection `gabay_prototype_rag`, exact spec filter.
  - `TARGETS ['Coordinator_Agent', 'Courses_Agent', 'Learning_Agent']` — exact three agent connections, no People/Progress leak.
  - `EMB ['RAG: Courses', 'RAG: Learning', 'RAG: People', 'RAG: Syllabus']` — embeddings wired.
  - Ownership prompts present in all three agents (`HAS True` × 3); tool description contains all 16 section keys.
  - `ANALYTICAL_HAS_SYLLABUS True` (unchanged node).
  - Node-level diff live-vs-backup: 22/25 unchanged; changed = only `Coordinator_Agent`, `Courses_Agent`, `Learning_Agent`; new = only `RAG: Syllabus`.

## Files

- Live only: n8n workflow `AtgiSrVPbqjgdZ9x` (new `RAG: Syllabus` node, three agent prompt edits, two connection edits).
- Temp evidence (not in repo): `syllabus-task4-backup/AtgiSrVPbqjgdZ9x.json`, `syllabus-task4-coord.txt`, `syllabus-task4-courses.txt`, `syllabus-task4-learning.txt`, `syllabus-task4-build.py`, `syllabus-task4-new.json`, `syllabus-task4-put.py`, `syllabus-task4-live.json`.
- Repo: `task-4-report.md` (this file) only.

## Concerns

- `RAG: Courses` keeps its existing `domain=courses` filter (which still matches `course_syllabus` points at the storage level); the Task 4 routing change is prompt-level per the plan — syllabus questions are directed to `RAG: Syllabus`, with no filter edits to existing tools and no baseline workflow redesign.
- `git diff --check` is not applicable to this untracked report file; no tracked repo files were modified by this task.
- Semantic/hybrid E2E evaluation is intentionally deferred to plan Tasks 5–6; Qdrant still holds pre-Task-3 points until re-ingestion.

## Addendum — RAG: Courses Syllabus Exclusion (2026-09-25)

Small live follow-up on main workflow `AtgiSrVPbqjgdZ9x` only: `RAG Courses` must exclude `course_syllabus` so `RAG: Syllabus` is the sole semantic syllabus source.

- Backed up live 26-node workflow (`active=true`, `updatedAt 2026-09-24T22:42:44.923Z`) to `C:\Users\JV\AppData\Local\Temp\opencode\syllabus-task4-courses-exclude\AtgiSrVPbqjgdZ9x.json`.
- Updated ONLY `RAG: Courses.parameters.options.searchFilterJson` to `{"must":[{"key":"metadata.metadata.domain","match":{"value":"courses"}}],"must_not":[{"key":"metadata.metadata.collection","match":{"value":"course_syllabus"}}]}`.
- Preserved `topK 60`, Qdrant credential `BKVtLxmJDtkwMyn6`, `mode retrieve-as-tool`, collection `gabay_prototype_rag`, and all connections.
- PUT full workflow (`{name, nodes, connections, settings}`) → `id=AtgiSrVPbqjgdZ9x`, 26 nodes; fresh GET asserts new filter, `SYL_FILTER` unchanged (`collection=course_syllabus`, `topK 30`), `conns_same True`, embeddings still `['RAG: Courses','RAG: Learning','RAG: People','RAG: Syllabus']`.
- Node-level diff live-vs-backup: only `RAG: Courses` changed (filter only); 25/26 nodes byte-identical.
- No E2E runs, no commits, no subagents. No repo source files modified beyond this report.
