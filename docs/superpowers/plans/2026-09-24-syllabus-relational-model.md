# Production Relational Syllabus Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Course.syllabus` JSON persistence contract with versioned normalized SQL Server tables, section-specific APIs, a revision-aware editor, and an auditable migration that preserves current behavior.

**Architecture:** Add a `Syllabus` revision parent keyed to `Course`, scalar section tables, ordered child tables, global institutional catalogs, and composite-key junction tables. A server repository owns transactional reads, section replacement, revision creation, publishing, and legacy backfill. The API exposes typed section mutations while the client migrates from whole-object saves; the legacy JSON remains dual-written until parity and rollout checks pass.

**Tech Stack:** TypeScript, Express, Prisma 6, SQL Server, React 19, React Router, Vitest, existing `LMSContext`/`SyllabusView`, existing RAG exporter.

**Spec:** `docs/superpowers/specs/2026-09-24-syllabus-relational-design.md`

## Global Constraints

- Use `server/prisma/schema.prisma` as the schema source of truth and timestamped SQL Server migrations under `server/prisma/migrations`.
- Preserve `Course.syllabus` and all existing grading, RAG, file, and course behavior until the contract phase.
- Use `NVARCHAR` sizes, API-layer string validation, explicit `position` columns, foreign-key indexes, and SQL Server check constraints.
- A published revision is immutable; drafts require an expected `rowVersion` and return `409` on stale writes.
- Students can read only the current published revision; faculty and administrators require existing ownership checks.
- Every section replacement and revision publish is one database transaction.
- Preserve divergent curriculum-map CO statements, array ordering, source metadata, and unknown fields.
- Do not automatically match embedded faculty section labels to existing `CourseSection` rows.
- Do not change the seven RAG section keys or deterministic record IDs.
- Do not add comments to production code unless the user explicitly requests them.
- Do not commit changes unless the user explicitly requests a commit; leave reviewable working-tree changes.

---

### Task 1: Define Server DTOs and Pure Relational Mappers

**Files:**
- Create: `server/src/syllabi/contracts.ts`
- Create: `server/src/syllabi/mapper.ts`
- Create: `server/src/syllabi/fixtures.ts`
- Test: `server/src/syllabi/mapper.test.ts`

**Interfaces:**
- `SyllabusSectionKey` is the literal union: `institution | courseInfo | faculty | institutionalStatements | programOutcomes | courseOutcomes | requirements | gradingSystem | rubrics | policies | outline | learningPlan | courseMap | references | signatories | sourceDocument`.
- `SyllabusDocument` contains the existing `OfficialSyllabusData` fields plus `courseId`, `sourceDocument`, and no persistence-only fields.
- `SyllabusRevisionHeader` contains `id`, `courseId`, `revisionNo`, `status`, `schemaVersion`, `rowVersion`, `createdAt`, `updatedAt`, and `publishedAt`.
- `SyllabusWriteModel` contains the parent metadata and typed child collections that the repository writes.
- `mapLegacyToWriteModel(input: unknown, revisionId: string, courseId: string): SyllabusWriteModel` parses a canonical JSON object and produces ordered child rows.
- `mapWriteModelToDocument(model: SyllabusWriteModel): SyllabusDocument` reconstructs the API/editor shape.
- `getSection(model: SyllabusWriteModel, section: SyllabusSectionKey): unknown` returns one section payload.
- `replaceSection(model: SyllabusWriteModel, section: SyllabusSectionKey, value: unknown): SyllabusWriteModel` returns a new model with one section replaced while preserving all other sections.

The contracts must explicitly represent: institution fields; ten course-info fields; faculty schedules; four institutional statements; core values; graduate attributes; program outcomes; course outcomes; major/other requirements; grading formulas/components/passing grade; rubric categories and levels 1–4; policies; outline blocks/topics; learning-plan outcomes/topics/methods/resources/assessments/SDG data; course-map statement snapshots; CO–PO levels; references; signatory roles; source-document metadata; and extension paths.

- [ ] **Step 1: Write failing mapper tests**

Use a hand-authored fixture representing one course with at least two ordered outline blocks, two learning-plan weeks, two course outcomes, and two CO–PO links. Assert that mapping preserves positions, the divergent map statement, source metadata, and an unknown field under `$.extensions.example`; assert that reconstruction returns the same known fields and that `replaceSection` changes only the requested section.

```ts
it('round-trips ordered sections and preserves the map statement', () => {
  const model = mapLegacyToWriteModel(legacyFixture, 'syllabus-1', 'course-1');
  const document = mapWriteModelToDocument(model);
  expect(document.courseOutline.map((row) => row.timeFrame)).toEqual(['Prelim', 'Finals']);
  expect(document.courseMap[0].coStatement).toBe('Historical map wording');
  expect(document.learningPlan[0].topics).toEqual(['Arrays', 'Complexity']);
  expect(model.extensions).toEqual([{ path: '$.extensions.example', value: { enabled: true } }]);
});

it('replaces one section without mutating other sections', () => {
  const model = mapLegacyToWriteModel(legacyFixture, 'syllabus-1', 'course-1');
  const next = replaceSection(model, 'policies', ['New policy']);
  expect(next.policies).toEqual(['New policy']);
  expect(next.courseOutline).toEqual(model.courseOutline);
  expect(model.policies).not.toEqual(next.policies);
});
```

- [ ] **Step 2: Run the mapper tests red**

Run from `server/`:

```powershell
npm test -- --run src/syllabi/mapper.test.ts
```

Expected: FAIL because the contracts, mapper functions, and fixture module do not exist.

- [ ] **Step 3: Implement the contracts and pure mappers**

Implement explicit TypeScript interfaces and pure functions without Prisma imports. Use `JSON.parse` only after the existing `SyllabusNormalizationError` validation, reject arrays/primitives, convert ordered arrays to zero-based `position` values, represent empty alignment cells as absent links, and store unknown paths as `{ path, value }` extension records. The mapper must never sort semantic arrays; only catalog key indexes and deterministic extension paths are sorted.

- [ ] **Step 4: Run mapper tests green**

```powershell
npm test -- --run src/syllabi/mapper.test.ts
```

Expected: PASS with all round-trip and section-replacement cases.

- [ ] **Step 5: Run the existing normalization tests**

```powershell
npm test -- --run src/utils/syllabusNormalization.test.ts src/syllabi/mapper.test.ts
```

Expected: PASS; legacy normalization remains compatible with the new mapper.

---

### Task 2: Add Prisma Models and the Expand-Only SQL Server Migration

**Files:**
- Modify: `server/prisma/schema.prisma:24-46,449-479`
- Create: `server/prisma/migrations/20260924120000_add_relational_syllabus/migration.sql`
- Modify: `server/prisma/schema.sql` after Prisma generation
- Test: `server/prisma/relationalSyllabus.schema.test.ts`
- Test: `server/prisma/relationalSyllabus.integration.test.ts`

**Interfaces:**
- Add `Course.currentSyllabusId String?` and the inverse `Course.currentSyllabus Syllabus?` relation.
- Add `Syllabus` with `courseId`, `currentForCourse`, `parentSyllabusId`, `parent`, `children`, `revisionNo`, `status`, `schemaVersion`, `rowVersion`, `createdById`, `publishedById`, timestamps, and all owned section relations.
- Add `ProgramOutcome`, `CoreValue`, and `GraduateAttribute` catalog models with stable identity keys and catalog version.
- Add `SyllabusProgramOutcome`, `SyllabusCoreValue`, and `SyllabusGraduateAttribute` composite-key junction models.
- Add all scalar, ordered child, rubric-level, course-outcome, course-map, signatory, source-document, and extension models listed in the spec.
- Add `SyllabusMigrationAudit` with `courseId`, `revisionId`, `sourceChecksum`, `status`, counts, error text, and timestamps; unique `(courseId, sourceChecksum)`.
- Add `CourseFile.syllabusSourceDocuments` as the inverse of the optional source-document relation. Keep the existing polymorphic file fields unchanged.

The SQL migration must create tables in dependency order, add named foreign keys with `ON DELETE CASCADE` for owned syllabus children, use `ON DELETE SET NULL` for the source-file relation, and add indexes for every foreign key. Add SQL Server check constraints for revision status, requirement category, signatory role, rubric level, CO–PO level, and nonnegative positions/hours. Do not drop or rename `Course.syllabus` in this migration.

- [ ] **Step 1: Write schema contract tests**

The schema test must load the generated Prisma DMMF and assert the presence of every model named in the spec, the current pointer, the legacy field, required unique constraints, and the source-file relation. It must execute a disposable SQL Server migration/rollback in the integration suite to verify the migration preserves the legacy column and creates the expected constraints; it must not pass by grepping source text.

- [ ] **Step 2: Run the schema test red**

```powershell
npm test -- --run prisma/relationalSyllabus.schema.test.ts
```

Expected: FAIL because the new models and migration do not exist.

- [ ] **Step 3: Add the Prisma models and migration**

Use `String @db.NVarChar(64)` IDs, `String @db.NVarChar(256)` names/titles where appropriate, `String @db.NVarChar(Max)` for descriptions/payloads, `Int` for positions/hours/levels, and `DateTime` timestamps. Use composite `@@id` declarations for catalog junctions, rubric levels, and CO–PO links. Use explicit relation names for `Course.currentSyllabus` and `Syllabus.parentSyllabus` to avoid ambiguous Prisma relations.

- [ ] **Step 4: Validate and generate the Prisma client**

```powershell
npx prisma format --schema prisma/schema.prisma
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
```

Expected: all three commands exit 0. Stop any local `tsx src/index.ts` process before `prisma generate` if Windows reports an `EPERM` engine rename.

- [ ] **Step 5: Run schema tests green**

```powershell
npm test -- --run prisma/relationalSyllabus.schema.test.ts prisma/relationalSyllabus.integration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Build the server**

```powershell
npm run build --workspace=server
```

Expected: PASS with no TypeScript errors.

---

### Task 3: Implement the Transactional Repository and Idempotent Backfill

**Files:**
- Create: `server/src/syllabi/repository.ts`
- Create: `server/src/syllabi/repository.test.ts`
- Create: `server/prisma/backfillSyllabi.ts`
- Create: `server/prisma/backfillSyllabi.test.ts`
- Create: `server/prisma/verifySyllabiParity.ts`
- Modify: `server/package.json:6-13`

**Interfaces:**

```ts
export interface SyllabusRepository {
  getPublished(courseId: string): Promise<SyllabusDocument | null>;
  getRevision(courseId: string, revisionId: string): Promise<SyllabusDocument | null>;
  getRagSections(courseId: string): Promise<Record<'description' | 'outcomes' | 'grading' | 'policies' | 'outline' | 'references' | 'faculty', string>>;
  createDraft(courseId: string, createdById: string, sourceRevisionId?: string): Promise<SyllabusRevisionHeader>;
  replaceSection(courseId: string, revisionId: string, expectedRowVersion: number, section: SyllabusSectionKey, value: unknown): Promise<SyllabusRevisionHeader>;
  publish(courseId: string, revisionId: string, expectedRowVersion: number, publishedById: string): Promise<SyllabusRevisionHeader>;
  deleteDraft(courseId: string, revisionId: string): Promise<void>;
}
```

`createDraft` must copy every owned section from the source revision or initialize typed empty values. `replaceSection` must lock/read the draft, compare `rowVersion`, delete/reinsert only the selected section’s owned rows, increment `rowVersion`, and write an audit record. `publish` must reject incomplete drafts, set `publishedAt`, archive any prior published revision, update `Course.currentSyllabusId`, and increment the draft version in one transaction.

- [ ] **Step 1: Write failing repository tests**

Mock Prisma transaction behavior and assert: draft creation copies ordered children; a stale `rowVersion` returns a conflict; a section replacement touches only that section; publishing updates the current pointer; a failed child insert rolls back the parent version increment; and a source-file link is validated against the course.

- [ ] **Step 2: Run repository tests red**

```powershell
npm test -- --run src/syllabi/repository.test.ts
```

Expected: FAIL because the repository is not implemented.

- [ ] **Step 3: Implement repository reads and writes**

Use `prisma.$transaction` for every mutation. Select all owned relations in a fixed order, map rows through `mapWriteModelToDocument`, and return `null` for a missing/unauthorized revision. Generate IDs with the repository’s existing ID convention. Use `updateMany` or a version predicate for the expected `rowVersion` and throw a typed `SyllabusConflictError` when no row matches.

- [ ] **Step 4: Run repository tests green**

```powershell
npm test -- --run src/syllabi/repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing backfill tests**

Cover a canonical legacy row, a malformed row, duplicate catalog identities, divergent CO statements, source metadata without a file, concurrent source changes, and a second run. Assert per-course transaction boundaries and exact parity reconstruction.

- [ ] **Step 6: Run backfill tests red**

```powershell
npm test -- --run prisma/backfillSyllabi.test.ts
```

Expected: FAIL because the backfill entry point is absent.

- [ ] **Step 7: Implement backfill and parity commands**

For each `Course` with non-null `Course.syllabus`, compute a source checksum, upsert global catalogs, create revision 1 as published, write all child rows in one transaction, and record the audit result. If the source row changes after reading, use an optimistic predicate and mark a conflict instead of overwriting. Malformed rows are reported and skipped; database errors fail the command with a non-zero exit. A second run must produce zero creates/updates for already-current checksums.

Add scripts:

```json
"backfill-syllabi": "tsx prisma/backfillSyllabi.ts",
"verify-syllabi": "tsx prisma/verifySyllabiParity.ts"
```

- [ ] **Step 8: Run backfill tests and command help green**

```powershell
npm test -- --run prisma/backfillSyllabi.test.ts
npm run build --workspace=server
```

Expected: PASS. The live command is not run until the schema migration and parity checks are reviewed.

---

### Task 4: Add Section APIs, Revision APIs, and Validation

**Files:**
- Create: `server/src/syllabi/validation.ts`
- Create: `server/src/syllabi/validation.test.ts`
- Create: `server/src/utils/courseAccess.ts`
- Modify: `server/src/utils/courseAccess.test.ts`
- Create: `server/src/routes/syllabi.ts`
- Create: `server/src/routes/syllabi.test.ts`
- Modify: `server/src/index.ts:35-58`
- Modify: `server/src/routes/courses.ts:49-72,227-293` to use the shared access helpers and legacy dual-write adapter

**Interfaces:**

```ts
export type SyllabusApiErrorCode =
  | 'syllabus_not_found'
  | 'revision_conflict'
  | 'invalid_syllabus_section'
  | 'revision_not_publishable';

export function validateSectionPayload(section: SyllabusSectionKey, value: unknown): unknown;
export function parseExpectedRowVersion(req: Request): number;
```

- [ ] **Step 1: Write failing validation and route tests**

Cover all supported section keys, empty list replacement, invalid types, missing required publish fields, `401`, `403`, `404`, `409`, and `422`. Assert that a section PATCH calls `replaceSection` once with the route’s course/revision/version/section values.

- [ ] **Step 2: Run route tests red**

```powershell
npm test -- --run src/syllabi/validation.test.ts src/routes/syllabi.test.ts src/utils/courseAccess.test.ts
```

Expected: FAIL because routes, validators, and shared access helpers do not exist.

- [ ] **Step 3: Implement typed validation**

Use explicit TypeScript validators or the project’s existing validation conventions; do not add a new runtime dependency solely for this feature. Reject unknown top-level section names, invalid enum values, duplicate positions, invalid numeric ranges, and malformed nested objects before opening a transaction.

- [ ] **Step 4: Implement and mount the syllabus router**

Extract the existing `loadCourseOr404`, `assertCourseAccess`, and `assertCourseOwner` behavior into `server/src/utils/courseAccess.ts`, export typed helpers, and update `courses.ts` to import them without changing its current authorization responses. Mount `syllabusRouter` at `/api/courses` and implement the exact endpoints from the spec. Reuse the shared helpers plus `authenticateToken` and `requireRole`. Students receive only the current published document; faculty/admin receive drafts only for owned courses. Map typed errors to the existing error middleware.

- [ ] **Step 5: Add legacy dual-write adapter**

When the existing `PATCH /api/courses/:id` receives a legacy syllabus JSON string during rollout, normalize it into a draft revision, write relational rows, and update the legacy column in one service operation. A `null` legacy syllabus creates no draft and does not delete published history. Do not let the legacy handler write relational child rows directly.

- [ ] **Step 6: Run route and legacy tests green**

```powershell
npm test -- --run src/syllabi/validation.test.ts src/routes/syllabi.test.ts src/utils/courseAccess.test.ts src/routes/courses.test.ts
```

Expected: PASS.

- [ ] **Step 7: Build the server**

```powershell
npm run build --workspace=server
```

Expected: PASS.

---

### Task 5: Add Client API Contracts, Context Actions, and Revision State

**Files:**
- Create: `client/src/types/syllabusApi.ts`
- Create: `client/src/api/syllabus.ts`
- Create: `client/src/api/syllabus.test.ts`
- Modify: `client/src/context/LMSContext.tsx:121-125,1983-2029`
- Create: `client/src/context/LMSContext.syllabus.test.tsx`

**Interfaces:**

```ts
export interface SyllabusRevisionResponse {
  revision: {
    id: string;
    courseId: string;
    revisionNo: number;
    status: 'draft' | 'published' | 'archived';
    schemaVersion: string;
    rowVersion: number;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
  };
  syllabus: OfficialSyllabusData;
}

export interface SyllabusApi {
  getPublished(courseId: string): Promise<SyllabusRevisionResponse | null>;
  listRevisions(courseId: string): Promise<SyllabusRevisionResponse['revision'][]>;
  createDraft(courseId: string, sourceRevisionId?: string): Promise<SyllabusRevisionResponse>;
  updateSection(courseId: string, revisionId: string, rowVersion: number, section: SyllabusSectionKey, value: unknown): Promise<SyllabusRevisionResponse>;
  publish(courseId: string, revisionId: string, rowVersion: number): Promise<SyllabusRevisionResponse>;
}
```

- [ ] **Step 1: Write failing API/context tests**

Assert URL encoding, section names, `If-Match`/row-version headers, typed error mapping, draft state replacement, published-state refresh, and stale-version recovery. The tests must assert observable context state, not mock call existence alone.

- [ ] **Step 2: Run client tests red**

```powershell
npm test -- --run src/api/syllabus.test.ts src/context/LMSContext.syllabus.test.tsx
```

Expected: FAIL because the API module and actions do not exist.

- [ ] **Step 3: Implement the API client and context actions**

Use the existing `apiFetch` error behavior. Store the active revision metadata separately from the assembled document. Replace `updateCourseSyllabus` internally with `updateSection` calls or provide a compatibility wrapper that creates/updates a draft and reports a conflict. Keep `removeCourseSyllabus` as a draft-management action; do not delete published revisions or files.

- [ ] **Step 4: Run client tests green**

```powershell
npm test -- --run src/api/syllabus.test.ts src/context/LMSContext.syllabus.test.tsx
```

Expected: PASS.

---

### Task 6: Migrate `SyllabusView` to Draft/Published Section Editing

**Files:**
- Modify: `client/src/pages/SyllabusView.tsx:132-187,370-466,515-583,1108-3015`
- Create: `client/src/components/syllabus/SyllabusRevisionBar.tsx`
- Create: `client/src/components/syllabus/SyllabusRevisionBar.test.tsx`
- Create: `client/src/pages/SyllabusView.test.tsx`

**Interfaces:**
- `SyllabusRevisionBar` receives `revision`, `revisions`, `canEdit`, `isDirty`, and callbacks for selecting a revision, creating a draft, and publishing.
- The view receives `syllabus`, `revision`, `activeSection`, `saveSection`, `publish`, and `createDraft` from `useLMS`.
- Saving one editor section sends only that section and the current `rowVersion`; the previous document remains visible if the request fails.

- [ ] **Step 1: Write failing UI tests**

Test draft creation, published read-only state, section save, publish confirmation, revision selection, stale-version conflict recovery, and file-link behavior after upload.

- [ ] **Step 2: Run UI tests red**

```powershell
npm test -- --run src/components/syllabus/SyllabusRevisionBar.test.tsx src/pages/SyllabusView.test.tsx
```

Expected: FAIL because the revision bar and migrated view do not exist.

- [ ] **Step 3: Implement the revision bar and view adapter**

Keep the existing syllabus editor controls and section rendering. Replace whole-object save calls with section-specific mutations, add draft/published badges, show revision number/status, disable editing for published revisions, and use the existing alert/confirmation components for publish and conflict errors. Preserve upload flow, but attach the returned `CourseFile.id` to the source-document section after upload.

- [ ] **Step 4: Run UI tests green**

```powershell
npm test -- --run src/components/syllabus/SyllabusRevisionBar.test.tsx src/pages/SyllabusView.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run the client typecheck and build**

```powershell
npm run typecheck:client
npm run build:client
```

Expected: PASS for the syllabus changes. Existing unrelated type errors must be reported separately rather than hidden by casts.

---

### Task 7: Adapt RAG, Grading Gates, and Source-File Linking

**Files:**
- Modify: `server/src/routes/ragExport.ts:18-114`
- Modify: `server/src/routes/ragExport.test.ts:53-99`
- Modify: `client/src/context/LMSContext.tsx:1129-1137,3590-3634`
- Modify: `client/src/pages/CoursesPage.tsx:267-281`
- Modify: `client/src/pages/SyllabusView.tsx:515-583`
- Modify: `server/src/routes/files.ts:362-440`
- Create or modify: `server/src/routes/files.syllabus.test.ts`

**Interfaces:**
- RAG repository consumer exposes `getRagSections(courseId): Promise<Record<'description' | 'outcomes' | 'grading' | 'policies' | 'outline' | 'references' | 'faculty', string>>`.
- Source-document section accepts `{ fileName, fileSize, fileType, uploadedAt, courseFileId }` and rejects a `courseFileId` from another course.
- The grade gate considers a course ready only when `currentSyllabusId` points to a published revision with the required grading fields.

- [ ] **Step 1: Write failing compatibility tests**

Assert identical RAG record IDs and section keys, the 1,500-character bound, published-only grade gating, same-course file validation, and preservation of files when a draft is deleted.

- [ ] **Step 2: Run compatibility tests red**

```powershell
npm test -- --run src/routes/ragExport.test.ts src/routes/files.syllabus.test.ts
```

Expected: FAIL until consumers use the relational repository.

- [ ] **Step 3: Implement relational RAG and file linkage**

Build RAG records from the same seven assembled sections and retain deterministic IDs. Validate file ownership before attaching a `CourseFile`. Keep `CourseFile`’s polymorphic course/personal behavior unchanged. Update the client grade gate to query the published syllabus status rather than a raw JSON string.

- [ ] **Step 4: Run compatibility tests green**

```powershell
npm test -- --run src/routes/ragExport.test.ts src/routes/files.syllabus.test.ts
```

Expected: PASS.

---

### Task 8: Execute Parity, Rollout, and Full Verification

**Files:**
- Modify: `server/prisma/backfillSyllabi.ts`
- Modify: `server/prisma/verifySyllabiParity.ts`
- Modify: `server/package.json:6-13`
- Modify: `docs/superpowers/specs/2026-09-24-syllabus-relational-design.md` only if implementation discovers a concrete contract correction

**Interfaces:**
- `backfill-syllabi` returns scanned, created, updated, skipped, and conflicted counts and exits non-zero on operational database errors.
- `verify-syllabi` exits non-zero when any known field, position, catalog link, source field, extension path, or RAG section differs from the legacy canonical source.
- The migration audit table records source checksum, revision ID, result, counts, and error text for every course.

- [ ] **Step 1: Run the expand migration against a disposable/staging SQL Server database**

```powershell
npx prisma migrate deploy --schema prisma/schema.prisma
```

Expected: all new relational migrations apply successfully and the legacy `Course.syllabus` column remains.

- [ ] **Step 2: Run the backfill and parity verifier**

```powershell
npm run backfill-syllabi
npm run verify-syllabi
```

Expected: all 12 current courses are represented, malformed rows are explicitly reported, and parity exits 0.

- [ ] **Step 3: Run a second backfill to prove idempotence**

```powershell
npm run backfill-syllabi
```

Expected: zero duplicate creates, zero child-row churn, and zero parity differences.

- [ ] **Step 4: Run RAG regression and grading tests**

```powershell
npm test -- --run src/routes/ragExport.test.ts
npm test -- --run src/utils/gradingTerms.test.ts src/utils/spr.test.ts
```

Expected: PASS with unchanged RAG IDs/keys and gradebook behavior.

- [ ] **Step 5: Run all server and client tests**

```powershell
npm test --workspace=server -- --run
npm test
```

Expected: all server and client tests pass.

- [ ] **Step 6: Run lint, server build, client build, and typechecks**

```powershell
npm run lint
npm run build:server
npm run build:client
npm run typecheck:client
```

Expected: no new lint errors, successful builds, and no syllabus-related type errors. Report unrelated baseline failures separately.

- [ ] **Step 7: Verify the staged rollout**

Deploy the expand migration, run backfill, verify parity, enable relational reads, and monitor revision publish/conflict/audit events. Keep dual-write enabled until the client and RAG consumers are stable. Schedule the legacy-column removal as a separate reviewed migration after the compatibility window.

- [ ] **Step 8: Inspect the final diff without committing**

```powershell
git diff --check
git status --short
```

Expected: only intended syllabus files are changed in addition to the user’s pre-existing work; no secrets or generated artifacts are staged. Do not commit unless the user explicitly requests it.

## Coverage Check

- Revision lifecycle and current pointer: Tasks 1–4.
- Global catalogs and junction tables: Tasks 1–3.
- Ordered scalar/list/rubric/outline/learning-plan sections: Tasks 1–3.
- CO–PO matrix and historical statements: Tasks 1–3.
- Optional source-file relation and legacy payload preservation: Tasks 1–3 and 7.
- Section APIs, authorization, validation, transactions, and conflicts: Task 4.
- Client context and editor migration: Tasks 5–6.
- RAG, grading, and file behavior: Task 7.
- Idempotent backfill, parity, rollout, and rollback: Task 3 and Task 8.
- Tests, lint, builds, and typechecks: every task and Task 8.

## Final-Review Fix Wave (2026-09-25)

1. Legacy PATCH compatibility is explicit and safe: `PATCH /api/courses/:id` with a syllabus string creates/updates a draft via `replaceFromLegacy` and preserves the legacy column in the same service operation; it never publishes. Response now includes `syllabusCompat { mode: 'draft', published: false, message }` stating students keep seeing the last published revision until Publish.
2. `server/tsconfig.json` now includes `prisma/backfillSyllabi.ts` and `prisma/verifySyllabiParity.ts`; `npm run build --workspace=server` typechecks them (exit 0).
3. Legacy PATCH maps `SyllabusSourceFileError` and `SyllabusNormalizationError` to 422 `invalid_syllabus_section`, matching the section router. Covered by `coursesDualWrite.test.ts` (6/6 pass).
4. Revision history selection removed as misleading: `SyllabusRevisionBar` is scoped to the current revision only (no `revisions`/`onSelectRevision` select); `SyllabusView` passes only the active revision. Draft/published rules preserved: draft shows Publish, published shows read-only + Create draft. Covered by `SyllabusRevisionBar.test.tsx` (5/5) and `SyllabusView.test.tsx` (6/6).

Evidence: server full suite 72 files / 614 tests pass; client syllabus suite 30 tests pass; server build exit 0; client lint 0 errors (147 pre-existing warnings); client typecheck shows only pre-existing `isSyncing`/`banner` errors, none in syllabus files.
