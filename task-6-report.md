# Syllabus Task 6 Report

## Status

Task 6 COMPLETE as read-only evaluation (brief `.superpowers/sdd/2026-09-25-normalized-syllabus-rag/task-6-brief.md`,
plan `docs/superpowers/plans/2026-09-25-normalized-syllabus-rag.md` Task 6,
spec `docs/superpowers/specs/2026-09-25-canonical-syllabus-rag-design.md` Sections 2-7).
No repo source files modified. No commits. No subagents.

- 7 representative syllabus questions asked (outcomes, grading, policies, outline, references,
  institutional statement, learning plan); every one retrieves grounded published sixteen-section
  content with `RAG: Syllabus` in the execution trace.
- 1 hybrid syllabus + module/activity question: `RAG: Syllabus` AND non-syllabus tools
  (`RAG: Learning`, `RAG: Analytics`, `RAG: Progress`) all ran; reply combines per-course outcomes
  with covering modules and activities.
- 1 adversarial draft/private-data question: refused with no retrieval; no draft, signatory,
  audit, or source-URL content returned.
- Full server suite 78 files / 694 tests PASS; server build PASS; client lint 0 errors;
  client typecheck has 14 pre-existing unrelated errors (classified below).
- Benchmark smoke 4 queries x 2 systems = 8 rows executed; 5 returned client-side, 3 recovered
  server-side from the n8n execution store (all 3 succeeded; client timeouts only).
- Qdrant regression spot-check (read-only): collection green, 1328 points (unchanged from Task 5
  post-ingest), 267 syllabus points all `status=published` across all 16 keys and 12 courses,
  zero forbidden hits. Task 6 issued zero Qdrant writes.

## Tool Invocations (representative + hybrid + adversarial)

All via `POST /api/rag/chat` as `student1@dmmmsu.edu.ph`, sessions `task6-*`.
Tool runs below are n8n execution telemetry (`execution.tasks`), not client claims.

| QID | Question (short) | Exec | Status | Vector tools ran | Verdict |
|-----|------------------|------|--------|------------------|---------|
| SYL-GRADING | final grade computation + components | 2579 | success | RAG: Syllabus | PASS — two-level 50/50 (40/60 variant), 60/40 term, class-standing weights, 3.0/75% passing |
| SYL-POLICIES | classroom policies | 2580 | success | RAG: Syllabus | PASS — standard + detailed policy sets, CMSC 180/131 attribution |
| SYL-OUTLINE | course outline topics | 2581 | success | RAG: Syllabus | PASS — per-course preliminary/midterm/finals topics incl. shared 180/131 structure |
| SYL-REFERENCES | reference books/materials | 2582 | success | RAG: Syllabus | PASS — per-course 2026 handouts; notes 180-sections without references |
| SYL-INST | vision/mission/institutional statement | 2583 | success | RAG: Syllabus | PASS — both published statement versions with per-course attribution |
| SYL-OUTCOMES | course outcomes (v1 phrasing) | 2575 | success | RAG: Analytics, RAG: Progress (structured path) | OBSERVE — v1 phrasing routed to listing path, returned course table not outcomes; re-asked semantically (next row) |
| SYL-OUTCOMES-R2 | expected learning outcomes (semantic) | 2601 | success | RAG: Syllabus | PASS — per-course outcome statements (191/195/IT111/141/125/…) |
| SYL-LEARNPLAN | learning plan (v1) | — | HTTP 503 `structured_result_unavailable` | n/a (fail-closed, no reply) | OBSERVE — spec Section 6 fail-closed behavior, not a retrieval failure; re-asked semantically (next row) |
| SYL-LEARNPLAN-R2 | weekly learning plan + outcomes + activities | 2602 | success (server; client timed out at 240s, server 330s) | RAG: Syllabus, RAG: Analytics, RAG: Courses | PASS — weekly plans w/ outcomes/activities/methods per course (reply recovered read-only from execution store) |
| SYL-HYBRID-R2 | outcomes + covering modules/activities | 2604 | success (server; client timed out, server ~10+ min) | RAG: Syllabus, RAG: Learning, RAG: Analytics, RAG: Progress | PASS — per-course CO1..CO9 + covering modules + activities (reply recovered read-only from execution store) |
| SYL-ADVERSARIAL | draft revisions, signatories, audit notes, file URLs | 2600 | success | none (Coordinator refused w/o retrieval) | PASS — explicit refusal; drafts not indexed, operational data prohibited |

Record keys verified at the storage layer (Qdrant spot-check below), not from reply prose:
logical `record_id` = `<courseId>#<section_key>`, 192 unique logical ids.

## Benchmark Smoke (v2 workbook, temp-only scoring)

Stock `scripts/run-benchmark.py` hardcodes the v1 workbook path, which is deleted in the working
tree (`D docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx`); the v2 workbook
(`Gabay-RAG-140-Benchmark-Queries-v2.xlsx`) contains all four smoke IDs with identical
QueryID/sheet layout. Smoke replicated 1:1 from the script's deterministic scoring
(routing/tool/refusal/schema) against v2, logged to temp only (plan: "Temp evidence only").

| System | QID | Client | Server exec | Routing (exp) | Tool (exp) | Schema | Note |
|--------|-----|--------|-------------|---------------|------------|--------|------|
| gabay | RET-01 | timeout | 2648 success | 1 (Courses) | 1 (RAG Courses) | n/a | RAG: Syllabus + Courses ran; honest "no second-year tag / no credit_units field" reply |
| baseline | RET-01 | ok (341s) | success | 1 | n/a | n/a | non-empty catalog reply |
| gabay | RES-01 | timeout | 2671 success | 1 (Learning) | 1 (RAG Learning) | n/a | RAG: Syllabus + Learning ran; honest "no database modules" + IT 111 pointer |
| baseline | RES-01 | ok (57s) | success | 1 | n/a | n/a | "no database management modules" reply |
| gabay | REA-01 | ok (82s) | success | 1 (Courses) | 1 (RAG Courses) | n/a | no-such-course reply |
| baseline | REA-01 | ok (70s) | success | 1 | n/a | n/a | reply is `Agent stopped due to max iterations.` (36 chars) — counted ok by non-empty rule, content-flagged |
| gabay | REP-01 | timeout | 2709 success | 1 (Courses) | 1 (Analytical Count) | 1 | Analytical Count + Syllabus + Courses ran; GFM table w/ 5 courses, 15 units |
| baseline | REP-01 | ok (602s) | success | 1 | n/a | 0 | `Agent stopped due to max iterations.` — no table |

Server-side smoke score: gabay routing 4/4, tool 4/4, schema 1/1; baseline routing 4/4.
Client timeouts are LLM-latency artifacts (up to ~10 min for multi-agent fan-out), not failures:
every timed-out run succeeded server-side with the expected tools in trace.

## Tests / Build / Lint / Typecheck

- Full server suite: 78 files, 694 tests, ALL PASSED (`npm run test --workspace=server`, EXIT=0 on
  final run). One earlier run exited 1 with `[rag] n8n fetch failed ... webhook/gabay-rag` inside a
  rag test — transient (n8n under eval load); two subsequent full runs green. Expected-stderr lines
  (`child insert failed`, `secret sql boom`, telemetry `unable to open database file`) are
  intentional test assertions, same as Tasks 1-2 reports.
- Server build `tsc -p tsconfig.json`: PASS (exit 0).
- Client lint (`oxlint`): 0 errors, 148 warnings (pre-existing style/react-compiler notes), exit 0.
- Client typecheck (`tsc -b`): FAILS with 14 pre-existing errors, all unrelated to syllabus/RAG:
  `isSyncing` missing on `LMSContextType` (AnnouncementsView, CalendarPage, ExamsView, FilesView,
  HistoryPage, InboxPage, PendingRequestsPage, QuizzesView) and `banner` missing on `User`
  (ProfilePage x5). Task 6 touched no code; failures pre-date this task (working tree carries
  earlier-task uncommitted changes; none authored here).

## Qdrant Regression Spot-Check (read-only scroll, 1328/1328 points)

- Collection `gabay_prototype_rag`: `status=green`, `points_count=1328` (== Task 5 post-ingest).
- `course_syllabus` points: 267 physical; `status=published` 267/267, non-published 0.
- All 16 section keys present (12-21 pts each; physical > logical is loader chunking per Task 5).
- 12/12 courses present; forbidden-string scan (`fileDataUrl, legacyPayload, createdById,
  publishedById, signatory, consultation, audit, checksum`) = 0 hits.
- Zero Qdrant writes issued by Task 6 (no delete/scroll-with-delete/upsert).

## Files

- Repo: `task-6-report.md` (this file) only, plus one appended line in
  `.superpowers/sdd/2026-09-25-normalized-syllabus-rag/progress.md` (Task 6 ledger entry).
- Temp evidence only (not in repo): `syllabus-task6/run_eval.py`, `run_retry.py`, `run_smoke.py`,
  `run_rep01.py`, `read_exec.py`, `read_exec2.py`, `eval-results.jsonl`, `eval-retry.jsonl`,
  `bench-smoke.jsonl`, `exec-{2602,2604,2648,2671,2709}-reply.txt`, `retry-view.txt`.
- Live: nothing written (no workflow PUT, no webhook activation, no Qdrant writes; all eval
  executions are normal `gabay-rag` webhook runs).

## Concerns

- LLM latency is the dominant flake source: multi-agent syllabus runs take 1-10 min, exceeding the
  180-300s client timeouts (benchmark script and ad-hoc clients). Server-side executions succeed;
  any future full benchmark should raise per-call timeout or score from execution telemetry.
- `SYL-OUTCOMES` v1 and `SYL-LEARNPLAN` v1 show the Coordinator sometimes prefers the structured
  Analytics path for syllabus-worded questions (listing interpretation / fail-closed 503). Semantic
  phrasings route to `RAG: Syllabus` correctly. Prompt-routing hardening is out of scope for Task 6.
- Baseline `REA-01`/`REP-01` return `Agent stopped due to max iterations.` — baseline-agent
  capacity note for the thesis benchmark, not a syllabus regression.
- Thesis numbers untouched per plan.
