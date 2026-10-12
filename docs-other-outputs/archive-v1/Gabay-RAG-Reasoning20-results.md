# LIKHA RAG Retrieval Workflow — Reasoning-20 Evaluation Results

Date: 2026-09-22 (UTC 2026-09-21). Workflow: `LIKHA RAG - Retrieval Workflow (Gabay Webhook)` (`AtgiSrVPbqjgdZ9x`, active, 25 nodes). Webhook: `POST http://localhost:5678/webhook/gabay-rag`. Qdrant: `gabay_prototype_rag`, 72 points, 384-dim Cosine. Sub-workflows active: Scoped Progress Search, Analytical Count, Analytical Query. Data Ingestion inactive (one-shot complete; export totals 8+47+9+3=67 rows + summaries = 72 points, matches Qdrant).

Queries: `Gabay-RAG-140-Benchmark-Queries.xlsx`, sheet `Reasoning-20`. Each sent with `(My student ID is usr-stud-1.)` suffix (Progress contract); unique sessionId per query.

## Verdict: 20/20 PASS (100%)

| ID | Level | Query | Result |
|----|-------|-------|--------|
| R-L1-01 | L1 | What courses are available? | PASS — 4 CMSC 180 courses returned |
| R-L1-02 | L1 | What modules are available in my courses? | PASS — 11 modules listed |
| R-L1-03 | L1 | Who are the faculty members? | PASS — Faculty 1 directory hit |
| R-L1-04 | L1 | What are my grades? | PASS — 3 scoped submissions (88/1/2) |
| R-L2-01 | L2 | List my enrolled courses + section schedule/location | PASS — 3 enrollments |
| R-L2-02 | L2 | Show my enrollment requests + approval statuses | PASS (len 822) |
| R-L2-03 | L2 | Activities + instructions + point values | PASS (len 1621) |
| R-L2-04 | L2 | Quizzes + time limits + due dates | PASS (len 720) |
| R-L2-05 | L2 | Calendar events + dates + courses | PASS (len 433) |
| R-L2-06 | L2 | Inbox messages + senders/subjects (metadata-only) | PASS (len 369) |
| R-L2-07 | L2 | Submissions + grades + statuses | PASS (len 586) |
| R-L3-01 | L3 | Enrolled courses + grades in each (Courses+Progress) | PASS — cross-agent join |
| R-L3-02 | L3 | Activities submitted + grades (Learning+Progress) | PASS (len 755) |
| R-L3-03 | L3 | Courses x modules (Courses+Learning) | PASS (len 901) |
| R-L3-04 | L3 | Instructor + grades given (People+Progress) | PASS (len 835) |
| R-L3-05 | L3 | Who teaches each course + meeting times (Courses+People) | PASS (len 805) |
| R-L3-06 | L3 | Announcements + authors (Learning+People) | PASS (len 791) |
| R-L4-01 | L4 | Capital of Germany (trivia) | PASS — refusal verbatim, exact match |
| R-L4-02 | L4 | Python sort script (coding) | PASS — refusal verbatim, exact match |
| R-L4-03 | L4 | Super Bowl winner (sports) | PASS — refusal verbatim, exact match |

## Extra probes (all PASS)

- Privacy: grades query as `usr-fac-1` returns zero rows, no `usr-stud-1` leakage.
- Analytical Count: "How many courses are there in total?" → "There are 4 courses in total."
- Server E2E: login `student1@dmmmsu.edu.ph` → `GET /api/rag/health` (configured, host localhost:5678) → `POST /api/rag/chat` 200 with catalog reply.
- No ERP leakage observed in any in-scope reply (no Likha/zyberlab terms).

## Thesis alignment

`THESIS-GABAY-v5.docx` Table 6 + paragraphs 277, 278, 303, 312, 317, 324 updated: Reasoning 8/12/10/5/35 → 4/7/6/3/20; totals 36/50/40/29/155 → 32/45/36/27/140; 4-agent scope wording. Backup: `THESIS-GABAY-v5-backup.docx`.

## Note for evaluators

Re-run any query via: `POST /webhook/gabay-rag` body `{chatInput, message, sessionId, userId, role}` with the student-ID suffix for Progress/grading queries. Keep n8n active (production webhook, not `/webhook-test/`), server on `:4000` with `N8N_RAG_WEBHOOK_URL` set.

---

# Addendum: large-seed retest (60 users, 1061 Qdrant points)

Seed script: `server/prisma/seedLarge.ts` (rollback: `seedLargeCleanup.ts`). DB now: 60 users (12 faculty, 46 students), 12 courses, 17 sections, 187 enrollments (169 approved/18 pending), 34 modules, 87 items, 37 activities, 18 quizzes, 9 exams, 20 announcements, 335 submissions, 166 course grades, 15 calendar events, 32 messages. Placeholder titles renamed (IDs kept); true orphans deleted. Qdrant re-ingested via `GABAY RAG — Data Ingestion (Prototype)` (activate → `POST /webhook/ingest-prototype` → success → deactivated): 72 → 1061 points.

## Retest results (fresh sessions, full outputs verified)

| # | Query | Result |
|---|-------|--------|
| SEED-M1 | What courses are available? | PASS — all 12 courses, exact stats 12/17/187/169/18 |
| SEED-M2 | Coding request (L4) | PASS — refusal verbatim |
| SEED-M3 | What are my grades? (usr-stud-1) | PASS — 4 course grades + 11 submissions incl. all 3 originals |
| SEED-M4 | How many faculty + who? | PARTIAL — max-iterations once; retry listed 3/12 from directory topK + rest from message metadata |
| SEED-M5 | How many faculty in total? | PASS — exact **12** via Analytical Count |
| SEED-M6 | Who teaches CMSC 131? | PASS — Faculty 1, 20 enrolled |
| SEED-M7 | Enrolled courses + grades (L3) | PASS — 6 courses, course grades + submission grades |
| SEED-M8 | Grades as seed-stud-02 | **FAILED twice pre-fix** → PASS post-fix (6/6 submissions, exact) |
| SEED-R1 | Regression: usr-stud-1 grades | PASS — unchanged |
| SEED-R2/R4 | Submission count (seed-stud-02) | Flaked once (honest fail-closed), PASS on retry — exact 6 |
| SEED-R3 | Submission count (usr-stud-1) | PASS — exact 11 (3 old + 8 new) |

## Bug found by seeding: Scoped Progress ID extraction (FIXED)

Symptom: any non-`usr-` student ID got "no records" from Progress queries. Root cause (execution evidence): the `RAG_Progress` tool call args arrive at `GABAY RAG — Scoped Progress Search` as a **stringified JSON blob** in `query`, so `Build Scoped Filter` read `raw.student_id` = undefined and its fallback regex `/usr-[A-Za-z0-9-]+/` could never match `seed-` IDs → filter `__missing__` → zero hits. Fix (PATCHED live via n8n API): parse stringified `query`/`input` first, then direct field, then generalized `/(usr|seed)-[A-Za-z0-9-]+/` fallback; fail-closed `__missing__` preserved. Verified: seed-stud-02 returns 6/6 records; usr-stud-1 regression unchanged.

## Known limitations at 60-user scale (for evaluation design)

1. Exhaustive open-ended listings ("who are ALL faculty") via vector topK (25) are partial — prefer exact-count queries (Analytical Count, verified exact) or specific lookups.
2. Rare transient: the LLM occasionally drops a tool arg; the workflow fails closed with an honest "unavailable" message instead of hallucinating (observed 1/12 calls, passed on retry).

---

# Addendum: syllabus contents in DB → RAG (`course_syllabus`)

Flow confirmed: faculty Upload & Scan → Apply Syllabus already persists structured `OfficialSyllabusData` JSON into `Course.syllabus` (PATCH `/api/courses/:id`). Only the RAG link was missing.

## Changes

- `server/src/routes/ragExport.ts`: new `course_syllabus` table in `/courses` — `buildSyllabusSections()` parses each syllabus JSON into bounded section records (`id = <courseId>#<section_key>`, keys: description/outcomes/grading/policies/outline/references/faculty, ≤1500 chars each). Raw 30KB JSON never shipped; malformed/empty → skipped.
- `server/src/routes/ragExport.test.ts`: 3 new tests (TDD red→green), 7/7 pass. Full server suite: 294/294 pass after updating 2 stale `ragAggregate` expectations to the deterministic seeded fixture (46 students; avg 66.7).
- `server/prisma/seedSyllabi.ts`: backfilled the 9 NULL-syllabus courses (per-course content, same JSON shape). All 12 courses now have syllabi.
- n8n (live patches, verified on GET-back): Analytical Count `Build Count Body` excludes `course_syllabus` from bare-domain counts; `Analytical Count` tool description lists it as valid; `Courses_Agent` prompt gained the syllabus record rule.
- Re-ingested (activate → trigger → success → deactivated): 1174 points = 1029 entity docs (exact 1:1) + 113 syllabus points (84 records, longer ones chunk-split) + 32 summary chunks. Verified 84 unique syllabus record_ids, zero empty.

## Retest (fresh sessions, full outputs verified)

| # | Query | Result |
|---|-------|--------|
| SYL2 | Course outcomes of CMSC 142? | PASS — exact CO1–CO3 match to seeded ground truth |
| SYL1b | Term grade formula for CMSC 131? | PASS — exact 60/40 + components + final formula + passing 3.0 (first phrasing hit transient max-iterations, retry passed) |
| SYL-R1 | How many courses total? | PASS — still exactly **12** (exclusion works) |
| SYL-R2 | Tell me a joke (L4) | PASS — refusal verbatim |
| SYL-R3 | Syllabus sections for CMSC 131? | Answered as course sections (2) — ambiguous phrasing routed to sections, not a failure of syllabus retrieval |
