# Assignments → Activities Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the Assignment entity everywhere — one Activity entity only — across database schema, server API, client code, file names, and UI copy.

**Architecture:** Absorb classic Assignment rows into the Activity table (new nullable classic columns + `format` discriminator, IDs preserved so submission/module links survive), merge the assignments router into the activities router, fold `db.assignments` into `db.activities`, merge the list/creation pages, and rename every identifier. Stored row-ID/link-key VALUES (`asg-*`, `asg-activity-*`, …) are preserved byte-for-byte (see Global Constraints).

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind (client); Express + Prisma + SQL Server (server); vitest everywhere.

**Spec:** User requirement (2026-09-17): "scan through the whole system and change all of the assignments to activities. I want everything changed including in the database, schemas, file names, etc. because there should be no assignments in the system, only activities." No prior spec doc exists; this plan is the spec carrier.

## Global Constraints

- Row-ID and link-key VALUES in the database are preserved (`asg-*` row ids, `asg-activity-`/`asg-quiz-`/`asg-exam-` link keys, `asg-file-` virtual ids become `act-file-` only where client-cache-local). Rationale: opaque keys, exact-match lookups only; rewriting values risks orphaning submissions with zero user-visible benefit. Schema/table/column names, code, routes, files, UI copy: fully renamed.
- New rows use the `act-` id prefix (`newId('act')`), never `newId('asg')`.
- `format: 'classic' | 'questionset'` discriminator on Activity is REQUIRED (grade math differs: classic = raw-id key ÷ pointsPossible; question-set = `asg-activity-<id>` key ÷ 100). Never guess format — migration sets `'classic'` for moved rows; question-set writes set `'questionset'`.
- One behavior change per task; run the stated tests after every task; stop on red.
- Generated/appendix docs are OUT of scope (`docs/`, `main-session.md`, `notif-and-quiz.md`, `sibling-recovery/`, `file-samples/`).
- Final gate (Task 8) must show zero case-sensitive `assignment`/`Assignment` matches in `client/src`, `server/src`, `server/prisma/schema.prisma`, `server/prisma/schema.sql`.

---

## Locked naming table (applies to every task)

| Before | After |
|---|---|
| Prisma `model Assignment` / table `Assignment` | Rows moved to `Activity`; model/table dropped |
| `prisma.assignment` | `prisma.activity` |
| `Submission.assignmentId: String?` | `Submission.activityKey: String?` (values preserved) |
| `ModuleItem.assignmentId: String?` | `ModuleItem.activityId: String?` (values preserved) |
| `ModuleItem.type 'assignment'` | `'activity'` |
| SPR `linkedSource.kind 'assignment'` | `'activity'` |
| `AssessmentSourceIndex.assignmentIds`, `moduleTitleByAssignment` | `classicActivityIds`, `moduleTitleByClassicActivity` (both still `Set<string>`/`Map<string,string>`) |
| `Assignment` TS type | Merged into `Activity`: all classic fields optional + `format: 'classic' \| 'questionset'` |
| `db.assignments: Assignment[]` | Folded into `db.activities: Activity[]` |
| `createAssignment/updateAssignment/deleteAssignment/submitAssignment` | `createActivity/updateActivity/deleteActivity/submitActivity` (unified; classic payload carries `format: 'classic'`) |
| `buildAssignmentPayload` | `buildActivityPayload` (same `(courseId, form, published)` signature) |
| `mockAssignmentId` (ActivitiesView) | `mockActivityKey` |
| `newId('asg')` | `newId('act')` |
| Virtual file ids `asg-file-<id>` | `act-file-<id>` (client-cache-only; update `deleteCourseFile` regex + `useCourseFiles` builders together) |
| `GET/POST /api/courses/:id/assignments` | `GET /api/activities?courseId=` (extended) / `POST /api/activities` (extended) |
| `PATCH/DELETE /api/assignments/:assignmentId` | `PATCH/DELETE /api/activities/:id` (extended) |
| `GET/POST /api/assignments/:id/submissions` | `GET/POST /api/activities/:id/submissions` (classic list/create semantics ported) |
| `POST /submissions/:submissionId/grade`, `/comments` | Unchanged paths; moved into `assessments.ts` |
| `AssignmentsView.tsx` (+ test) | `ActivitiesView.tsx` (+ test); runner `ActivitiesView.tsx` → `ActivityRunnerView.tsx` (+ test) |
| `CreateAssignmentPage.tsx` (+ test) | Merged into `CreateActivityPage.tsx`; file deleted |
| `server/src/routes/assignments.ts` (+ test) | Merged into `server/src/routes/assessments.ts`; file deleted; cases merged into `assessments.test.ts` |
| Nav `{ id: 'assignments', label: 'Activities' }` | `{ id: 'activities', label: 'Activities' }` |
| UI copy `Assignment(s)` | `Activit(y|ies)` (sentence case preserved) |

---

### Task 1: Database migration (schema + data move)

**Files:**
- Modify: `server/prisma/schema.prisma` (`model Activity`, drop `model Assignment`, `model Submission`, `model ModuleItem`)
- Create: `server/prisma/migrations/20260917000000_merge_assignments_into_activities/migration.sql`
- Modify: `server/prisma/schema.sql` (mirror the same DDL)
- Test: `server/src/routes/assignments.test.ts` (failing-first: new activity-format acceptance test, deleted in Task 2 after port)

**Interfaces:**
- Consumes: live `Assignment` rows, `Submission.activityKey`-to-be values, `ModuleItem.assignmentId`-to-be values.
- Produces: `Activity` with classic columns + `format`; `prisma.activity` as the only activity store. Later tasks rely on exact column names below.

- [ ] **Step 1: Back up and record row counts**

```bash
git status --porcelain -- client/src server/src server/prisma
```

```sql
-- Run against the dev database before touching anything; save the numbers.
SELECT COUNT(*) AS assignment_rows FROM [Assignment];
SELECT COUNT(*) AS activity_rows FROM [Activity];
SELECT COUNT(*) AS submissions_pointing_at_assignments
FROM [Submission] WHERE [assignmentId] LIKE 'asg-%' AND [assignmentId] NOT LIKE 'asg-activity-%'
  AND [assignmentId] NOT LIKE 'asg-quiz-%' AND [assignmentId] NOT LIKE 'asg-exam-%';
```

- [ ] **Step 2: Edit `schema.prisma` — extend `Activity`, drop `Assignment`, rename link fields**

```prisma
model Activity {
  id                 String         @id @db.NVarChar(64)
  courseId           String         @db.NVarChar(64)
  title              String         @db.NVarChar(256)
  instructions       String         @db.NVarChar(Max)
  pointsPossible     Float
  dueDate            DateTime?
  published          Boolean        @default(false)
  term               String?        @db.NVarChar(16) // grading term (prelim|midterm|finals), nullable = legacy rows
  format             String         @db.NVarChar(16) // 'classic' | 'questionset'
  submissionTypes    String?        @db.NVarChar(64) // classic only, JSON array string
  category           String?        @db.NVarChar(64) // classic only
  weight             Float? // classic only
  rubric             String?        @db.NVarChar(Max) // classic only, JSON array string
  fileName           String?        @db.NVarChar(256) // classic only
  fileUrl            String?        @db.NVarChar(1024) // classic only
  fileSize           String?        @db.NVarChar(32) // classic only
  availableFrom      DateTime? // classic only
  availableUntil     DateTime? // classic only
  sectionRestriction String?        @db.NVarChar(128) // classic only
  questions          QuizQuestion[]
  submissions        Submission[]
}
```

Delete the entire `model Assignment { ... }` block. In `model Submission`, rename `assignmentId String? @db.NVarChar(64)` to `activityKey String? @db.NVarChar(64)`. In `model ModuleItem`, rename `assignmentId String? @db.NVarChar(64)` to `activityId String? @db.NVarChar(64)`.

- [ ] **Step 3: Write the migration SQL** (`server/prisma/migrations/20260917000000_merge_assignments_into_activities/migration.sql`)

```sql
-- 1. Extend Activity with classic columns + discriminator.
ALTER TABLE [Activity] ADD [format] NVARCHAR(16) NOT NULL DEFAULT 'questionset';
ALTER TABLE [Activity] ADD [submissionTypes] NVARCHAR(64) NULL;
ALTER TABLE [Activity] ADD [category] NVARCHAR(64) NULL;
ALTER TABLE [Activity] ADD [weight] FLOAT NULL;
ALTER TABLE [Activity] ADD [rubric] NVARCHAR(MAX) NULL;
ALTER TABLE [Activity] ADD [fileName] NVARCHAR(256) NULL;
ALTER TABLE [Activity] ADD [fileUrl] NVARCHAR(1024) NULL;
ALTER TABLE [Activity] ADD [fileSize] NVARCHAR(32) NULL;
ALTER TABLE [Activity] ADD [availableFrom] DATETIME2 NULL;
ALTER TABLE [Activity] ADD [availableUntil] DATETIME2 NULL;
ALTER TABLE [Activity] ADD [sectionRestriction] NVARCHAR(128) NULL;

-- 2. Backfill existing question-set rows explicitly.
UPDATE [Activity] SET [format] = 'questionset' WHERE [format] IS NULL OR [format] = '';

-- 3. Move classic rows 1:1, IDs preserved, format forced.
INSERT INTO [Activity]
  ([id],[courseId],[title],[instructions],[pointsPossible],[dueDate],[published],[term],[format],
   [submissionTypes],[category],[weight],[rubric],[fileName],[fileUrl],[fileSize],
   [availableFrom],[availableUntil],[sectionRestriction])
SELECT [id],[courseId],[title],[instructions],[pointsPossible],[dueDate],[published],[term],'classic',
   [submissionTypes],[category],[weight],[rubric],[fileName],[fileUrl],[fileSize],
   [availableFrom],[availableUntil],[sectionRestriction]
FROM [Assignment];

-- 4. Rename link columns (values preserved).
EXEC sp_rename 'Submission.assignmentId', 'activityKey', 'COLUMN';
EXEC sp_rename 'ModuleItem.assignmentId', 'activityId', 'COLUMN';

-- 5. Drop the absorbed table.
DROP TABLE [Assignment];
```

- [ ] **Step 4: Mirror the DDL into `server/prisma/schema.sql`** (same ALTER/UPDATE/INSERT/sp_rename/DROP statements, in the same order).

- [ ] **Step 5: Validate and apply**

```bash
npx prisma validate
npx prisma migrate dev --name merge_assignments_into_activities
```

Expected: validate passes; migrate applies cleanly.

- [ ] **Step 6: Verify counts (must match Step 1 exactly)**

```sql
SELECT COUNT(*) AS activity_rows_after FROM [Activity];
-- activity_rows_after MUST equal assignment_rows + activity_rows from Step 1.
SELECT COUNT(*) AS classic_rows FROM [Activity] WHERE [format] = 'classic';
-- classic_rows MUST equal assignment_rows from Step 1.
SELECT [id] FROM [Activity] WHERE [format] = 'classic' AND [title] IS NULL;
-- MUST return zero rows.
```

- [ ] **Step 7: Regenerate client and commit**

```bash
npx prisma generate
git add server/prisma/schema.prisma server/prisma/schema.sql server/prisma/migrations/20260917000000_merge_assignments_into_activities/migration.sql
git commit -m "feat: merge Assignment table into Activity (classic format rows preserved)"
```

---

### Task 2: Server router merge (assignments → activities)

**Files:**
- Modify: `server/src/routes/assessments.ts` (extend activity router: classic fields, classic submissions sub-routes, grade/comments moves)
- Delete: `server/src/routes/assignments.ts`
- Modify: `server/src/routes/assignments.test.ts` → move cases into `server/src/routes/assessments.test.ts`, then delete file
- Modify: `server/src/index.ts` (remove `assignmentsRouter` import + mount)
- Modify: `server/src/routes/modules.ts` (ITEM_STRING_FIELDS `'assignmentId'` → `'activityId'`; filing/lookup code using `prev.assignmentId`/`data.assignmentId` — read file first, rename identifiers only, values preserved)
- Modify: `server/src/routes/courses.ts` (1 assignment match — read line, rename)
- Modify: `server/src/routes/calendar.ts` (1 assignment match — read line, rename)

**Interfaces:**
- Consumes: Task 1 schema (`prisma.activity` with classic columns + `format`; `Submission.activityKey`; `ModuleItem.activityId`).
- Produces: single activities surface. Later tasks rely on these exact endpoints/fields.

Endpoint table (extend the `buildAssessmentRouter('activity')` branch; quiz/exam branches untouched):

| Old (delete) | New (extend) | Notes |
|---|---|---|
| `GET /api/courses/:id/assignments` → `{ assignments }` | `GET /api/activities?courseId=` returns `{ activities }` incl. `format: 'classic'` rows with parsed `submissionTypes`/`rubric` arrays | Reuse `mapQuestionsFor`; add classic field mapping identical to old `mapAssignment` |
| `POST /api/courses/:id/assignments` | `POST /api/activities` accepts classic body (`instructions`, `pointsPossible`, `dueDate`, `submissionTypes`, `category`, `weight`, `rubric`, file fields, `availableFrom/Until`, `sectionRestriction`, `term` default `'midterm'`) and sets `format: 'classic'`; question-set body sets `format: 'questionset'` | Keep old 400 validations + `ASSIGNMENT_STRING_MAX` guard (rename const to `ACTIVITY_STRING_MAX`) |
| `PATCH /api/assignments/:assignmentId` | `PATCH /api/activities/:id` accepts the union of classic + question-set fields | Keep "all classic fields supported" semantics |
| `DELETE /api/assignments/:assignmentId` | `DELETE /api/activities/:id` | Same ownership guard |
| `GET /api/assignments/:id/submissions` | `GET /api/activities/:id/submissions` | Classic semantics: query `{ activityKey: row.id }` (renamed field, same values) |
| `POST /api/assignments/:id/submissions` | `POST /api/activities/:id/submissions` | Classic file/text submission create, same validation |
| `POST /submissions/:submissionId/grade`, `/comments` | Move verbatim into `assessments.ts` | Paths unchanged |
| `newId('asg')` | `newId('act')` | New rows only |

- [ ] **Step 1: Write the failing test** — in `server/src/routes/assessments.test.ts`, add (read the file's existing mock/app harness first and follow it exactly):

```ts
it('POST /api/activities accepts classic fields and stores format classic', async () => {
  // ... existing jwt/prisma mocks, faculty auth ...
  const res = await request.post('/api/activities').set('Authorization', 'Bearer x').send({
    courseId: 'c1', title: 'Lab 1', instructions: 'Do it', pointsPossible: 50,
    dueDate: '2026-10-01', submissionTypes: ['online_text'], category: 'lab', format: 'classic',
  });
  expect(res.status).toBe(201);
  expect(prisma.activity.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ format: 'classic', title: 'Lab 1' }) })
  );
});
```

- [ ] **Step 2: Run it, expect FAIL** (`activity.create` never called with classic shape / 404).

Run: `npx vitest run src/routes/assessments.test.ts` (from `server/`). Expected: FAIL.

- [ ] **Step 3: Implement the router merge** per the endpoint table above. Rename `syntheticAssignmentId` → `syntheticActivityKey` (values `asg-quiz-`/`asg-activity-`/`asg-exam-` preserved). Update `index.ts`, `modules.ts`, `courses.ts`, `calendar.ts` matches.

- [ ] **Step 4: Port `assignments.test.ts` cases** into `assessments.test.ts` (same assertions, new paths/fields), delete `assignments.test.ts` + `assignments.ts`.

- [ ] **Step 5: Run server suite**

Run: `npx vitest run` (from `server/`). Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/assessments.ts server/src/routes/assessments.test.ts server/src/index.ts server/src/routes/modules.ts server/src/routes/courses.ts server/src/routes/calendar.ts
git rm server/src/routes/assignments.ts server/src/routes/assignments.test.ts
git commit -m "feat: merge assignments router into activities router"
```

---

### Task 3: Client domain types (single Activity type)

**Files:**
- Modify: `client/src/types/lms.ts` (delete `Assignment`, extend `Activity`, rename link fields)
- Test: `client/src/utils/spr.test.ts` (update `makeAssignment` helper + assignment routing tests to the merged type)

**Interfaces:**
- Consumes: Task 2 API shapes (`format`, classic fields on activity JSON).
- Produces: `Activity` (with `format`, classic optionals), `SPRColumn.linkedSource.kind: 'activity'` only, `Submission.activityKey`, `ModuleItem.activityId`. Tasks 4–6 rely on these exact names.

- [ ] **Step 1: Failing test** — extend `spr.test.ts` `makeAssignment` usage: change the "routes tagged classic assignments" test to build the row as `Activity` with `format: 'classic'`. Run: expect FAIL (`Assignment` type / `kind: 'assignment'` mismatch).

- [ ] **Step 2: Edit `lms.ts`**

```ts
export interface Activity {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  term: TermId;
  questions: QuizQuestion[];
  pointsPossible: number;
  dueDate?: string;
  published: boolean;
  format: 'classic' | 'questionset';
  submissionTypes?: string[];
  category?: string;
  weight?: number;
  rubric?: RubricCriterion[];
  fileName?: string;
  fileUrl?: string;
  fileSize?: string;
  availableFrom?: string;
  availableUntil?: string;
  sectionRestriction?: string;
}
```

Delete `export interface Assignment`. On `Submission`: rename `assignmentId?: string` → `activityKey?: string`. On `ModuleItem`: rename `assignmentId?: string | null` → `activityId?: string | null`. On `SPRColumn.linkedSource`: kind union `'assignment' | 'activity' | 'quiz' | 'exam'` → `'activity' | 'quiz' | 'exam'`. Update `MockDatabase`: delete `assignments?: Assignment[]` (activities array carries both formats).

- [ ] **Step 3: Update `spr.ts` scoring** — fold the `'assignment'` branch of `autoScoreFraction` into the `'activity'` branch:

```ts
} else if (link.kind === 'activity') {
  const source = activities.find((a) => a.id === link.sourceId);
  if (!source) return null;
  if (source.format === 'classic') {
    if (typeof source.pointsPossible !== 'number' || source.pointsPossible <= 0) return null;
    assignmentKey = link.sourceId;
    divisor = source.pointsPossible;
  } else {
    if (typeof source.pointsPossible !== 'number' || source.pointsPossible <= 0) return null;
    assignmentKey = `asg-activity-${link.sourceId}`;
    divisor = 100;
  }
}
```

(`asg-activity-` value preserved per Global Constraints.)

- [ ] **Step 4: Run**

Run: `npx vitest run src/utils/spr.test.ts` + `npx tsc --noEmit` (from `client/`). tsc WILL still fail (Tasks 4–6 pending) — record the error list as the Task 4 worklist; spr tests must PASS.

- [ ] **Step 5: Commit** (`git add client/src/types/lms.ts client/src/utils/spr.ts client/src/utils/spr.test.ts`, message `feat: merge Assignment type into Activity`).

---

### Task 4: Client store (LMSContext)

**Files:**
- Modify: `client/src/context/LMSContext.tsx` (~75 assignment lines: CRUD, bootstrap fetch/merge, badges, normalizers)
- Test: existing suites that mock the store (`AssignmentsView.test.tsx` etc. updated in Task 6)

**Interfaces:**
- Consumes: Task 3 types; Task 2 endpoints.
- Produces: `db.activities` (both formats), `createActivity/updateActivity/deleteActivity/submitActivity` (unified, `format` param), no `db.assignments`. Task 5–6 rely on these names.

- [ ] **Step 1: Fold bootstrap** — replace the assignments fetch (`/api/courses/.../assignments`) with nothing (activities fetch already covers all formats); replace `mergeById(prev.assignments, …)` with merge into `prev.activities`; delete `normalizeAssignment`, fold classic normalization into `normalizeActivity` (`format: raw.format === 'classic' ? 'classic' : 'questionset'`, classic optionals passthrough).
- [ ] **Step 2: Merge CRUD** — `createAssignment` body → into `createActivity` (accept classic fields + `format`; keep `buildAssignmentPayload` logic under `buildActivityPayload` in `ActivityFormFields.tsx`, Task 5). `updateAssignment` → `updateActivity` (union of fields; keep the "all classic fields supported" comment, retitled). `deleteAssignment` → `deleteActivity` (also drop submissions filtered by raw id AND `asg-activity-` key, as today). `submitAssignment` → `submitActivity` hitting `POST /api/activities/:id/submissions` (classic) — keep the question-set `POST /:id/submit` path as the `format === 'questionset'` branch.
- [ ] **Step 3: Rename `assignmentId` → `activityKey`** on every submission read/write/filter in the file (values untouched); rename `ModuleItem` link writes to `activityId`.
- [ ] **Step 4: Run** `npx tsc --noEmit`; fix ONLY store errors; record remaining component errors as Task 5 worklist.
- [ ] **Step 5: Commit** (`feat: fold assignment store into activities store`).

---

### Task 5: Client pages + components merge/rename

**Files (exact):**
- `git mv client/src/pages/AssignmentsView.tsx client/src/pages/ActivitiesView.tsx` AFTER `git mv client/src/pages/ActivitiesView.tsx client/src/pages/ActivityRunnerView.tsx` (same for `.test.tsx` files); update `CoursesPage.tsx` import/render, `SourceFilter.test.tsx` import.
- Merge `CreateAssignmentPage.tsx` into `CreateActivityPage.tsx` (CreateAssignmentPage already handles classic + question_set via `ActivityFormFields`; keep that logic, rename props `onAssignmentCreated` → `onActivityCreated`), delete file + merge its test into `CreateActivityPage` coverage (check if `CreateActivityPage.test.tsx` exists first; if missing, rename the test file).
- `ActivityFormFields.tsx`: `buildAssignmentPayload` → `buildActivityPayload` (add `format`), `ActivityFormValue` keeps classic fields.
- `assessmentSource.ts`: `assignmentIds` → `classicActivityIds`, `moduleTitleByAssignment` → `moduleTitleByClassicActivity`; `item.type === 'assignment'` → `'activity'`; `item.assignmentId` → `item.activityId` (keep `asg-activity-` prefix parse).
- `AddModuleItemPage.tsx` (48 lines): `assignmentId` → `activityId`, item `type: 'assignment'` → `'activity'`, `questionSetLinkOf` unchanged.
- `useCourseFiles.ts` + test: `asg-file-` → `act-file-` virtual ids + `deleteCourseFile` regex in `LMSContext.tsx` (update together; grep-verify).
- `SpeedGraderModal.tsx`, `CoursesPage.tsx` badges, `LMSContextPanel.tsx`, `DashboardPage.tsx`, `ModulesView.tsx`, `GlobalSearchDialog.tsx`, `notifiers.ts`, `CalendarEventFormDialog.tsx`, `CreateEventPage.tsx`, `HelpPage.tsx`, `RoleSwitcherModal.tsx`, `SyllabusView.tsx`, `navigation.ts` (`id: 'assignments'` → `'activities'`), `Topbar.tsx`, `ProfilePage.tsx`, `InboxPage.tsx`, `HistoryPage.tsx`, `CalendarPage.tsx`, `QuizzesView.tsx`, `ExamsView.tsx`, `CreateCoursePage.tsx`, `CreateAccountPage.tsx`, `EditAccountPage.tsx`, `FilesView.test.tsx`, `ModulesView.test.tsx`, `DashboardPage.test.tsx`, `ActivityFormFields.test.ts`, `data/syllabusData.ts`: mechanical rename per the Locked naming table + sentence-case UI copy (`Assignment`→`Activity`, `assignment`→`activity`, `ASSIGNMENT`→`ACTIVITY`).

- [ ] **Step 1: Failing test** — new `ActivitiesView.test.tsx` (renamed) case: db with one classic-format + one questionset activity renders both titles. Run: FAIL (file/import mismatch until rename lands).
- [ ] **Step 2: Perform `git mv` renames first**, fix imports, then identifier renames file-by-file.
- [ ] **Step 3: Run** `npx tsc --noEmit` (must pass) + `npx vitest run src/pages/AssignmentsView.test.tsx src/pages/ActivitiesView.test.tsx src/pages/SourceFilter.test.tsx` (renamed paths).
- [ ] **Step 4: Commit** (`feat: merge assignment pages into activities pages`).

---

### Task 6: Long-tail + tests sweep

**Files:** every remaining file from the scope inventory not covered in Tasks 2–5 (the 1–5 line hits: `StudentGradebook.tsx`, `FacultyGradebook.tsx` + its test, `useCourseFiles.ts`, `ExamsView.tsx`, `QuizzesView.tsx`, `server/src/routes/submissions.test.ts`, `assessments.test.ts`, `courses.test.ts`, `HelpPage.tsx`, etc.).

- [ ] **Step 1: Apply the Locked naming table** mechanically; never rename `asg-` key VALUES.
- [ ] **Step 2: Run full suites** — `npx vitest run` in `client/` and `server/`, plus `npx tsc --noEmit` in `client/`. Fix fallout in place (same task; still one behavior change total).
- [ ] **Step 3: Commit** (`feat: rename remaining assignment references to activities`).

---

### Task 7: Final verification gate (evidence before completion)

- [ ] **Step 1: Zero-reference gate**

```bash
Select-String -Path "client/src" -Pattern "assignment" -CaseSensitive | Measure-Object
Select-String -Path "client/src" -Pattern "Assignment" | Measure-Object
Select-String -Path "server/src","server/prisma/schema.prisma","server/prisma/schema.sql" -Pattern "assignment" -CaseSensitive | Measure-Object
Select-String -Path "server/src","server/prisma/schema.prisma","server/prisma/schema.sql" -Pattern "Assignment" | Measure-Object
```

Expected: all four return 0. (Allowed `asg-` key-namespace literals do not match these patterns.)

- [ ] **Step 2: File-name gate**

```bash
Get-ChildItem client/src,server/src,server/prisma -Recurse | Where-Object { $_.Name -match "Assignment" } | Measure-Object
```

Expected: 0.

- [ ] **Step 3: Full green**

```bash
npx tsc --noEmit            # client/, exit 0
npx vitest run              # client/, 0 failures
npx vitest run              # server/, 0 failures
npx prisma validate         # server/, passes
```

- [ ] **Step 4: Smoke** — start server + client, create a classic activity, submit as student, grade it, confirm the gradebook column appears under the right term and Excel export includes it.

---

## Self-Review

**1. Spec coverage:** user asked for database + schemas + file names + everything. Covered: Task 1 (schema/migration/schema.sql), Task 2 (API/routes), Task 3 (types), Task 4 (store), Task 5 (pages/files), Task 6 (long tail + tests), Task 7 (file-name + zero-reference gates). UI copy covered via naming table + Task 5/6. Appendix docs explicitly excluded with rationale.
**2. Placeholder scan:** no TBD/TODO; every task names exact files, exact code/commands, exact test gates. Endpoint table and naming table give literal strings (no "similar to" without content — merges reference the exact source semantics with file:line anchors).
**3. Type consistency:** `format: 'classic' | 'questionset'` spelled identically in schema (Task 1), type (Task 3), tests, and server writes (Task 2). `activityKey` (Submission) vs `activityId` (ModuleItem + Submission FK left untouched) kept distinct everywhere. `act-file-` vs preserved `asg-activity-` values distinguished in Constraints + Tasks 5–6.
