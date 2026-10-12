# Syllabus Task 1 Report

## Status

Implemented the expanded published syllabus RAG projection with TDD.

- Defined `RagSectionKey` (sixteen public keys) and `RagSectionKeyOrder` in `server/src/syllabi/contracts.ts`, plus `RagSectionRecord` (`syllabusId`, `revisionNo`, `status: 'published'`, `sectionKey`, `sectionText`) and `RagSectionMap`.
- Created `server/src/syllabi/runtime.ts` with the shared `getRagSyllabusRepository()` singleton.
- Extended `PrismaSyllabusRepository.getRagSections()` from seven to sixteen keys with deterministic public-only builders for `institution`, `institutional_statement`, `program_outcomes`, `core_values`, `graduate_attributes`, `requirements`, `rubrics`, `learning_plan`, and `course_map`.
- Added `getRagSectionRecords()` returning per-section records with `syllabusId`, `revisionNo`, and `status: 'published'`; drafts and missing revisions yield empty sections / zero records.
- Old seven keys (`description`, `outcomes`, `grading`, `policies`, `outline`, `references`, `faculty`) keep byte-stable text; new builders never read drafts, audit tables, source payloads (`fileDataUrl`, `legacyPayload`), extension fields, signatory data, actor IDs, or consultation/schedule/room details.
- Export route untouched in behavior: `RagSyllabusSectionSource` now accepts partial section maps so existing seven-key export flow keeps working until Task 2 enriches it.
- No commits or subagents used.

## TDD Evidence

RED observed before implementation in `server/src/syllabi/task1RagProjection.test.ts`:

- Missing `runtime.ts` module and sixteen-key contract.
- Missing `getRagSectionRecords` method.
- Seven-key-only projection (nine new keys absent, no published metadata).

Each RED was followed by focused GREEN verification. Existing seven-key assertions were updated to sixteen keys while asserting old values unchanged; sparse mocks prove missing/empty child collections yield `''` consistently with current behavior.

## Tests and Build

- New Task 1 suite: 3 passed.
- Syllabus focused suites (`repository`, `repositoryReads`, `ragExport`, `files.syllabus`, `mapper`): 51 passed.
- Full server suite: 76 test files, 678 tests passed.
- Server TypeScript build: passed with `npm run build --workspace=server`.
- `git diff --check`: clean for Task 1 files (only pre-existing LF/CRLF warnings on unrelated files).

## Files

- `server/src/syllabi/contracts.ts` (RagSectionKey, order, record, map)
- `server/src/syllabi/runtime.ts` (new singleton provider)
- `server/src/syllabi/repository.ts` (sixteen-key builders, records with metadata, published-only)
- `server/src/syllabi/repository.test.ts` (sixteen-key + stability assertions)
- `server/src/syllabi/task1RagProjection.test.ts` (new RED/GREEN suite: keys, metadata, stability, exclusions)
- `server/src/routes/files.syllabus.test.ts` (sixteen-key empty-sections assertion)
- `server/src/routes/ragExport.ts` (source interface accepts partial maps; emitted seven keys unchanged)
- `task-1-report.md`

## Concerns

- Test output includes existing expected stderr and Node SQLite experimental warnings; no test failures occurred.
- Full-suite totals include compiled `dist/` duplicates alongside `src/` (pre-existing config); reported as observed.
- `dist/` artifacts from the verification build were left in place; `dist/` is not tracked.
- Existing unrelated working-tree changes were not modified.
