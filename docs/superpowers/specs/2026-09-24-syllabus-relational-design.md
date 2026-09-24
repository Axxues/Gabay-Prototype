# Production Relational Syllabus Model

**Date:** 2026-09-24
**Status:** Design approved in conversation; specification review pending
**Scope:** Replace the per-course syllabus JSON blob with a versioned, normalized relational model while preserving the existing LMS behavior during rollout.

## 1. Context

The current database stores one nullable `NVARCHAR(MAX)` syllabus JSON string in `Course.syllabus`. The live `GabayPrototype` database contains 12 valid non-null syllabi. The payload contains repeated institutional records, ordered academic content, faculty section assignments, and a course-outcome/program-outcome matrix that is not represented relationally.

The replacement must be production-grade, preserve the current editor and downstream consumers, and avoid data loss. The current JSON column remains available during the migration and is removed only after parity verification and rollout completion.

## 2. Goals

- Store each syllabus revision in normalized SQL Server tables.
- Support immutable published revisions and mutable drafts.
- Link revisions to versioned global catalogs through junction tables.
- Preserve all ordered arrays through explicit `position` columns.
- Replace the dynamic `poAlignments` object with a real junction table.
- Preserve historical curriculum-map statements that differ from course-outcome statements.
- Provide section-specific CRUD APIs with ownership, validation, transactions, and optimistic concurrency.
- Migrate the existing editor to the new API and revision lifecycle.
- Preserve the current seven RAG section keys and deterministic record IDs.
- Support an idempotent, auditable backfill from the legacy JSON.
- Preserve unknown fields in a controlled extension table.
- Retain source-document metadata and optionally link it to an existing `CourseFile`.

## 3. Non-goals

- Changing `Course.gradingTerms`, `Course.gradesReleased`, `Course.sprConfig`, or `CourseGrade.sprCells` in this release.
- Replacing the PDF/DOCX parser.
- Redesigning personal file storage or making every `CourseFile` belong to a course.
- Changing the existing RAG ingestion contract or requiring new n8n workflow code.
- Automatically treating embedded faculty section labels as existing `CourseSection` rows.
- Removing the legacy JSON column in the initial migration.

## 4. Decisions

| Decision | Selection |
| --- | --- |
| Revision history | Versioned revisions with draft and published states |
| Shared institutional records | Global catalogs linked by junction tables |
| Unknown fields | Strict relational schema plus extension records |
| Client/API migration | New section-specific API and full-stack editor migration |
| Course-map statements | Preserve the map statement as a historical snapshot |
| Source documents | Optional `CourseFile` relation; unmatched legacy metadata is retained |
| RAG | Preserve the existing seven section keys and IDs |
| Rollout | Expand, backfill, dual-write, switch reads, contract later |

## 5. Relational model

### 5.1 Revision parent and lifecycle

`Syllabus` represents one revision of one course. It contains:

- `id`
- `courseId` with a foreign key to `Course`
- `revisionNo` unique within a course
- `status`: `draft`, `published`, or `archived`
- `schemaVersion`
- `parentSyllabusId` nullable self-reference for lineage
- `rowVersion` for optimistic concurrency
- `createdById` and optional `publishedById`
- `createdAt`, `updatedAt`, and `publishedAt`

`Course` receives a nullable `currentSyllabusId` pointer to the active published revision. A published revision is immutable. Draft revisions may be edited, but every section mutation increments `rowVersion` and requires the caller's expected version. Publishing validates required sections, marks the revision published, and updates the course pointer in one transaction.

The application prevents a course from pointing at a revision belonging to another course. The implementation also adds a database/index strategy appropriate for SQL Server to enforce one active published revision per course.

### 5.2 Global catalogs

The following are shared, append-only catalog entities:

- `ProgramOutcome`: stable outcome number, description, catalog version, timestamps
- `CoreValue`: acronym, keyword, description, catalog version, timestamps
- `GraduateAttribute`: stable attribute number, title, description, catalog version, timestamps

Revisions link to them through composite-key junction tables:

- `SyllabusProgramOutcome(revisionId, programOutcomeId, position)`
- `SyllabusCoreValue(revisionId, coreValueId, position)`
- `SyllabusGraduateAttribute(revisionId, graduateAttributeId, position)`

Catalog edits create a new catalog version rather than changing rows referenced by historical revisions.

### 5.3 One-to-one scalar sections

Each revision has at most one row in each table:

- `SyllabusInstitution`: university, college, form code, revision
- `SyllabusCourseInfo`: code, title, semester, academic year, type, credit, lecture hours, lab hours, prerequisite, description
- `SyllabusInstitutionalStatement`: philosophy, vision, mission, goal
- `SyllabusGradingSystem`: term formula, final formula, passing grade
- `SyllabusSourceDocument`: file name, file size, file type, upload time, optional `courseFileId`, legacy source URL, and a deprecated `legacyPayload` field for unmatched inline data

`SyllabusSourceDocument.courseFileId` is nullable and uses `SetNull` behavior when a file is deleted. The application validates that a linked file belongs to the same course. Unmatched legacy URLs and inline payloads are retained in `legacyPayload` until file reconciliation is complete; normal API responses use the linked file metadata when available and never expose the migration payload.

### 5.4 Faculty and ordered academic content

- `SyllabusFaculty`: revision FK, name, consultation, position, optional explicit user link
- `SyllabusFacultySection`: faculty FK, section label, schedule, room, position, optional explicit `CourseSection` FK
- `SyllabusRequirement`: revision FK, category (`major` or `other`), text, position
- `SyllabusPolicy`: revision FK, text, position
- `SyllabusGradingComponent`: revision FK, text, position
- `SyllabusRubric`: revision FK, category, position
- `SyllabusRubricLevel`: composite key `(rubricId, level)`, description
- `SyllabusOutlineBlock`: revision FK, timeframe, title, position
- `SyllabusOutlineTopic`: outline-block FK, text, position
- `SyllabusLearningPlan`: revision FK, week, laboratory hours, lecture hours, position
- `SyllabusLearningPlanOutcome`: learning-plan FK, text, position
- `SyllabusLearningPlanTopic`: learning-plan FK, text, position
- `SyllabusLearningPlanMethod`: learning-plan FK, text, position
- `SyllabusLearningPlanResource`: learning-plan FK, text, position
- `SyllabusLearningPlanAssessment`: learning-plan FK, text, position
- `SyllabusLearningPlanSdg`: learning-plan FK, goal, title, description, optional target

### 5.5 Outcomes and curriculum map

- `SyllabusCourseOutcome`: revision FK, outcome number, statement, position
- `SyllabusCourseMap`: revision FK, course-outcome FK, map CO number, historical CO statement, position
- `SyllabusCourseMapProgramOutcome`: composite key `(courseMapId, programOutcomeId)`, level constrained to `I`, `P`, or `D`

Empty alignment cells are not stored as junction rows. The map statement is retained even when it differs from the corresponding course-outcome statement.

### 5.6 References, signatories, and extensions

- `SyllabusReference`: revision FK, citation, year, optional DOI/publisher, position
- `SyllabusSignatory`: revision FK, role, name, title, position; roles are prepared, recommending approval, and approved
- `SyllabusExtensionField`: revision FK, JSON path, serialized value, value type; unique `(revisionId, path)`
- `SyllabusMigrationAudit`: course FK, revision FK, source checksum, result, counts, error text, and timestamps; unique `(courseId, sourceChecksum)`

The extension table preserves fields introduced by a newer syllabus schema or retained legacy data without weakening relational constraints for known fields. The audit table makes backfill and parity outcomes reviewable without storing operational errors in the syllabus content itself.

### 5.7 Database constraints and indexes

Every foreign key receives an index. The migration adds unique constraints for revision numbers, catalog identities, parent/position pairs, and composite junction keys. Check constraints enforce rubric levels 1–4, CO–PO levels I/P/D, requirement categories `major`/`other`, nonnegative positions/hours, valid signatory roles, and valid revision statuses. Deleting a course cascades to its revisions and owned child rows. Deleting a source file does not delete the syllabus or its historical metadata.

## 6. API design

The current whole-object JSON API is replaced by a section-oriented API.

- `GET /api/courses/:courseId/syllabus`: return the assembled current published syllabus.
- `GET /api/courses/:courseId/syllabus/revisions`: return revision history and status.
- `POST /api/courses/:courseId/syllabus/revisions`: create a draft from the current published revision or a template.
- `GET /api/courses/:courseId/syllabus/revisions/:revisionId`: return one assembled revision.
- `PATCH /api/courses/:courseId/syllabus/revisions/:revisionId/sections/:section`: replace one typed section and its ordered children atomically.
- `POST /api/courses/:courseId/syllabus/revisions/:revisionId/publish`: validate and publish a draft.
- `DELETE /api/courses/:courseId/syllabus/revisions/:revisionId`: delete an unpublished draft only.

Supported section keys include `institution`, `courseInfo`, `faculty`, `institutionalStatements`, `programOutcomes`, `courseOutcomes`, `requirements`, `gradingSystem`, `rubrics`, `policies`, `outline`, `learningPlan`, `courseMap`, `references`, `signatories`, and `sourceDocument`.

Every section payload is validated against a typed server schema. A section replacement uses one database transaction, increments `rowVersion`, and returns the updated revision. The `If-Match`/expected-version precondition returns `409` when a client has stale data. Validation errors return `422`; authorization and ownership failures retain the existing `401`/`403` behavior. Students can read only published revisions; faculty and administrators can manage drafts for owned courses.

## 7. Client migration

`SyllabusView` keeps its current presentation but changes its persistence layer from whole-object saves to section mutations. The client loads the assembled syllabus separately from the course list, shows draft/published status and revision history, and sends the current `rowVersion` with every section update. Failed section updates leave the previous client state intact. Publishing refreshes the current published revision and invalidates syllabus-related queries.

The client DTO mirrors the normalized API, while an adapter can still assemble the legacy `OfficialSyllabusData` shape for existing editor components. The adapter is not a database persistence format.

## 8. RAG and grading compatibility

The RAG exporter reads relational data and reconstructs the same seven aggregate sections currently emitted: description, outcomes, grading, policies, outline, references, and faculty. Record IDs remain `<courseId>#<section_key>`, and the existing text bounds remain unchanged. This avoids an immediate n8n/Qdrant contract change.

Course grading continues to use the published syllabus for the grade gate, formula parsing, outline term detection, and grading-term overrides. `gradingTerms`, `gradesReleased`, and SPR data remain separate fields in this release.

## 9. Migration and rollout

1. **Expand:** add the new tables, relations, indexes, checks, and `Course.currentSyllabusId`; retain `Course.syllabus`.
2. **Implement the repository:** map canonical JSON to relational rows and reconstruct the API DTO without changing the UI contract yet.
3. **Backfill:** process each course in its own transaction, create catalog records idempotently, preserve positions and extension fields, and write an audit report.
4. **Parity:** reconstruct every backfilled revision and compare it with the canonical source JSON, including ordered children, divergent CO statements, source metadata, and catalog junctions.
5. **Dual-write:** section API writes update relational rows and the legacy JSON during the compatibility window.
6. **Switch reads:** use relational data for the new API and RAG exporter, with an explicit legacy fallback only for rows not yet backfilled.
7. **Contract:** after production verification and a completed compatibility window, remove legacy writes and schedule a separate migration to drop `Course.syllabus`.

The backfill is idempotent, reports scanned/created/updated/skipped/conflicted counts, fails on operational database errors, and never silently overwrites a concurrent edit. A migration audit record identifies the source row, revision, checksum, and result for every course.

## 10. Testing strategy

- Mapper unit tests cover every section, ordering rule, catalog junction, extension path, and source-document representation.
- SQL Server integration tests cover foreign keys, cascades, uniqueness, check constraints, transactions, rollback, and optimistic version conflicts.
- Backfill tests cover empty rows, malformed rows, duplicate catalogs, preserved positions, divergent CO statements, source metadata, idempotent reruns, and concurrent updates.
- API tests cover role/ownership authorization, draft isolation, section validation, `409` conflicts, publish validation, and transaction rollback.
- Client tests cover draft creation, section editing, history, publish transitions, stale-version handling, and source-file linking.
- RAG regression tests compare record IDs, section keys, and bounded content before and after the relational rollout.
- A parity test processes all current live syllabi and fails if any known field is lost.

## 11. Operations and rollback

Deployment exposes migration and backfill summaries, validation failures, conflicts, and revision publish audit events. Failed backfill rows remain available for inspection and can be retried without duplicating catalog or child records. The legacy JSON remains available until the contract phase, providing a rollback path if relational parity or API verification fails. Rollback never deletes source files or published revision history.

## 12. Acceptance criteria

- All syllabus sections are stored in normalized tables with foreign keys, indexes, ordering constraints, and explicit extension storage.
- Published revisions are immutable, drafts are versioned, and only the current published revision is visible to students.
- Section API writes are transactional, authorized, validated, and conflict-safe.
- All 12 current live syllabi backfill without known-field loss and pass reconstruction parity checks.
- The existing editor uses section-specific APIs and revision lifecycle behavior.
- RAG record IDs and section keys remain backward compatible.
- Source metadata is retained and real files can be linked without deleting files when a syllabus is removed.
- Migration, backfill, and verification commands are documented and repeatable.
