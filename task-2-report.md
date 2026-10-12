# Syllabus Task 2 Report

## Status

Implemented the enriched RAG export and structured syllabus reads with TDD.

- `server/src/routes/ragExport.ts` now emits all sixteen `RagSectionKeyOrder` keys with `syllabusId`, `revisionNo`, and `status: 'published'` per record, joined from `getRagSectionRecords()`; `description` and every other key are the repository builder text verbatim (cap-only), so export text is strictly equal to `getRagSections()`.
- `server/src/routes/ragAggregate.ts` adds a custom logical `course_syllabus` branch backed by `PrismaSyllabusRepository` through the shared runtime singleton — no raw Prisma models added to the generic allowlist. Fields `courseId`, `courseCode`, `courseTitle`, `syllabusId`, `revisionNo`, `sectionKey`, `sectionText` (plus stable `id`); equality filters `courseId`, `courseCode`, `sectionKey`; `count`/`rows` metrics with limit/offset pagination; `recordIds` rejected with `recordIds are unsupported for composite-key tables`.
- Both routes wire the `server/src/syllabi/runtime.ts` provider (`getRagSyllabusRepository()`) as the default source; the export keeps its `setRagSyllabusRepository()` override for tests.
- Old record IDs preserved: `<courseId>#<section_key>` for all keys, including the original seven. Empty sections are filtered (no record); courses with no published syllabus contribute zero rows.
- Intentional omissions are documented in code comments on both routes: drafts/archived revisions, audit tables, source payloads (`fileDataUrl`, `legacyPayload`), extension values, actor IDs, signatory data, faculty user IDs, consultation/schedule/room details, internal IDs; sum/avg/min/max intentionally unsupported for the logical table in this phase.
- Removed the stray empty root `=` file.
- No commits or subagents used.

## TDD Evidence

RED observed before implementation in `server/src/routes/task2RagSyllabus.test.ts` (6 failed, 2 passed):

- Export emitted only the old seven keys with no `syllabusId`/`revisionNo`/`status`.
- `course_syllabus` structured reads returned `400 Unknown table 'course_syllabus' ...`.
- Default export source did not follow the runtime singleton mock.
- `recordIds` on `course_syllabus` returned the generic unknown-table message instead of the composite-key message.

Each RED was followed by focused GREEN verification (8/8 passed). One self-authored assertion bug (`expect(...).toBe(cond ? expect.any(Number) : 0)`) was fixed in the test itself; production code was unchanged for it. Existing seven-key export mocks keep passing untouched because the builder iterates all sixteen keys over partial maps and treats `getRagSectionRecords` as optional.

## Tests and Build

- New Task 2 suite (`task2RagSyllabus.test.ts`): 8 passed.
- Syllabus focused suites (`ragExport`, `ragAggregate`, `repository`, `task1RagProjection`, `repositoryReads`, `files.syllabus`): 69 passed.
- Full server suite: 78 test files, 694 tests passed.
- Server TypeScript build: passed with `npm run build --workspace=server` (exit 0; two type errors found and fixed during verification).
- `git diff --check` on Task 2 files: clean (only pre-existing LF/CRLF warnings on unrelated files).

## Files

- `server/src/routes/ragExport.ts` (sixteen-key records with published metadata, runtime provider default)
- `server/src/routes/ragAggregate.ts` (custom `course_syllabus` branch via runtime provider)
- `server/src/routes/task2RagSyllabus.test.ts` (new RED/GREEN suite: sixteen keys, metadata, strict description equality, empty-record filter, runtime wiring, structured rows/count/filters/pagination, recordIds rejection)
- `task-2-report.md`
- Removed: root `=` (stray empty file)

## Concerns

- Test output includes existing expected stderr and Node SQLite experimental warnings; no test failures occurred.
- Full-suite totals include compiled `dist/` duplicates alongside `src/` (pre-existing config); reported as observed.
- `dist/` artifacts from the verification build were left in place; `dist/` is not tracked.
- Existing unrelated working-tree changes (e.g. prior edits to `ragExport.test.ts`, `ragAggregate.test.ts`, `rag.ts`) were not modified.
- The legacy `buildSyllabusSections()` JSON-parse path is retained untouched for its existing unit tests; the live route uses only the repository-backed path.
