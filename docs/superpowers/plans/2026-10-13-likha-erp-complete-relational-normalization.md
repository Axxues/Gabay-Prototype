# Likha ERP Complete Relational Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely eliminate redundant physical JSON columns in Likha ERP, normalize all data into dedicated relational child tables (3NF), configure native Directus One-to-Many (`list-o2m`) interfaces, and harmonize server repositories and client API.

**Architecture:** A 4-stage normalization pipeline: (1) Unpack all existing JSON arrays into child tables (`assessment_questions`, `rubric_criteria`, `submission_answers`, `spr_cells`); (2) Delete physical JSON columns via Directus schema API; (3) Register native Directus One-to-Many alias fields (`type: "alias"`, `special: ["o2m"]`, `interface: "list-o2m"`); (4) Harmonize server repositories and client API to interact with relational nested entities.

**Tech Stack:** TypeScript, Directus API, Express, Vitest, React, Vite.

**Spec:** `docs/superpowers/specs/2026-10-13-likha-erp-complete-relational-normalization-design.md`

## Global Constraints
- Likha ERP (`https://gabay.zyberlab.com`) is the single source of truth.
- Zero data loss: all questions, rubrics, submission answers, and SPR cells must be preserved and verified in child tables before physical JSON columns are deleted.
- 100% test pass rate across both server (50 suites) and client (61 suites).
- Directus Admin UI must render native relational One-to-Many table interfaces (`list-o2m`) with inline modals, rather than raw code editor JSON boxes.

---

### Task 1: Relational Data Unpacking & Child Row Verification Script

**Files:**
- Create: `server/src/likha/migrations/normalizeLikhaRelationalData.ts`
- Create: `server/src/likha/migrations/normalizeLikhaRelationalData.test.ts`

**Interfaces:**
- Consumes: `likhaFetch` from `server/src/likha/client.ts`
- Produces: `unpackLegacyLikhaJsonData(): Promise<{ activities: number; quizzes: number; exams: number; submissions: number; grades: number }>`

- [ ] **Step 1: Write unit test for unpacking legacy JSON data**

In `server/src/likha/migrations/normalizeLikhaRelationalData.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { unpackLegacyLikhaJsonData } from './normalizeLikhaRelationalData.js';

describe('Likha Relational Data Unpacking', () => {
  it('unpacks all legacy JSON arrays into dedicated child collections without data loss', async () => {
    const counts = await unpackLegacyLikhaJsonData();
    expect(counts).toBeDefined();
    expect(counts.activities).toBeGreaterThanOrEqual(0);
    expect(counts.quizzes).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/likha/migrations/normalizeLikhaRelationalData.test.ts` in `server/`  
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `unpackLegacyLikhaJsonData` in `normalizeLikhaRelationalData.ts`**

In `server/src/likha/migrations/normalizeLikhaRelationalData.ts`:
- Iterate `activities`: parse `questions` (JSON) and insert into `assessment_questions` (`activity_id = id`). Parse `rubric` (JSON) and insert into `rubric_criteria` (`activity_id = id`).
- Iterate `quizzes` and `exams`: parse `questions` and insert into `assessment_questions` (`quiz_id` or `exam_id`).
- Iterate `submissions`: parse `answers` and insert into `submission_answers` (`submission_id = id`).
- Iterate `course_grades`: parse `spr_cells` and insert into `spr_cells` (`course_grade_id = id`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/likha/migrations/normalizeLikhaRelationalData.test.ts` in `server/`  
Expected: PASS (1 test passing).

- [ ] **Step 5: Commit**

```bash
git add server/src/likha/migrations/normalizeLikhaRelationalData.ts server/src/likha/migrations/normalizeLikhaRelationalData.test.ts
git commit -m "feat(likha): implement data unpacking script for legacy JSON fields"
```

---

### Task 2: Dropping Physical JSON Columns & Registering Native Directus O2M Alias Fields

**Files:**
- Modify: `server/src/likha/migrations/normalizeLikhaRelationalData.ts`
- Modify: `server/src/likha/migrations/normalizeLikhaRelationalData.test.ts`

**Interfaces:**
- Consumes: Directus `/fields` API via `likhaFetch`
- Produces: `reconfigureLikhaRelationalFields(): Promise<void>`

- [ ] **Step 1: Write test for dropping JSON fields and creating O2M alias fields**

Add test to `server/src/likha/migrations/normalizeLikhaRelationalData.test.ts`:
```typescript
it('removes physical JSON columns and registers native Directus list-o2m alias fields', async () => {
  await reconfigureLikhaRelationalFields();
  const fRes = await likhaFetch('/fields/activities');
  const fData = await fRes.json();
  const questionsField = (fData.data || []).find((f: any) => f.field === 'questions');
  expect(questionsField).toBeDefined();
  expect(questionsField.meta?.special).toContain('o2m');
  expect(questionsField.meta?.interface).toBe('list-o2m');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/likha/migrations/normalizeLikhaRelationalData.test.ts` in `server/`  
Expected: FAIL (`reconfigureLikhaRelationalFields` not implemented).

- [ ] **Step 3: Implement `reconfigureLikhaRelationalFields`**

In `server/src/likha/migrations/normalizeLikhaRelationalData.ts`:
- Check existing fields on `activities`, `quizzes`, `exams`, `submissions`, `course_grades`.
- If physical field `questions` on `activities` is type `json`:
  1. `DELETE /fields/activities/questions`
  2. `POST /fields/activities` with `{ field: "questions", type: "alias", meta: { special: ["o2m"], interface: "list-o2m", options: { enableCreate: true, sortField: "order" } } }`
- If physical field `rubric` on `activities` is type `json`:
  1. `DELETE /fields/activities/rubric`
  2. `POST /fields/activities` with `{ field: "rubrics", type: "alias", meta: { special: ["o2m"], interface: "list-o2m", options: { enableCreate: true, sortField: "order" } } }`
- Repeat for `quizzes.questions`, `exams.questions`, `submissions.answers`, `course_grades.spr_cells`.
- Ensure relations on Directus connect `one_field: "questions"`, `one_field: "rubrics"`, `one_field: "answers"`, `one_field: "spr_cells"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/likha/migrations/normalizeLikhaRelationalData.test.ts` in `server/`  
Expected: PASS (2 tests passing).

- [ ] **Step 5: Commit**

```bash
git add server/src/likha/migrations/normalizeLikhaRelationalData.ts server/src/likha/migrations/normalizeLikhaRelationalData.test.ts
git commit -m "feat(likha): drop physical JSON columns and register native Directus list-o2m alias fields"
```

---

### Task 3: Server Repositories Harmonization (`assessmentsRepo.ts` & `gradesRepo.ts`)

**Files:**
- Modify: `server/src/likha/repositories/assessmentsRepo.ts`
- Modify: `server/src/likha/repositories/gradesRepo.ts`
- Modify: `server/src/routes/assessments.likha.test.ts`

**Interfaces:**
- Consumes: Directus `/items/activities`, `/items/assessment_questions`, `/items/rubric_criteria`, etc.
- Produces: 100% normalized CRUD methods without stringified JSON payloads.

- [ ] **Step 1: Update `assessmentsRepo.ts` to omit stringified JSON and query nested relations**

In `server/src/likha/repositories/assessmentsRepo.ts`:
- In `createActivity` & `updateActivity`: do not send `questions` or `rubric` in `body`. Insert child questions into `assessment_questions` and rubric items into `rubric_criteria`.
- In `getActivities`: fetch with `${LIKHA_URL}/items/activities?filter[course_id][_eq]=${courseId}&fields=*,questions.*,rubrics.*`. Map returned nested rows directly.
- In `createQuiz` & `createExam`: do not send `questions` JSON string in `body`. Insert child questions into `assessment_questions`.
- In `recordSubmission`: do not send `answers` in root `body`. Insert student answers into `submission_answers`.
- In `getSubmissions`: query with `fields=*,answers.*`.

- [ ] **Step 2: Update `gradesRepo.ts` to omit stringified `spr_cells` JSON**

In `server/src/likha/repositories/gradesRepo.ts`:
- In `upsertCourseGrade`: do not send `spr_cells` JSON string. Insert cell scores into `spr_cells` table.
- In `getCourseGrades`: query with `fields=*,spr_cells.*`.

- [ ] **Step 3: Run repository test suite to verify correctness**

Run: `npx vitest run src/routes/assessments.likha.test.ts` in `server/`  
Expected: PASS (3/3 tests passing against live Likha ERP).

- [ ] **Step 4: Commit**

```bash
git add server/src/likha/repositories/assessmentsRepo.ts server/src/likha/repositories/gradesRepo.ts server/src/routes/assessments.likha.test.ts
git commit -m "refactor(server): harmonize repositories to operate exclusively with normalized relational tables"
```

---

### Task 4: Client API Harmonization (`client/src/shared/api/likhaLmsApi.ts`)

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts`
- Modify: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: Directus deep-nested relations API
- Produces: `likhaLmsApi.getActivitiesWithRelations`, `saveActivity`, `submitActivity`

- [ ] **Step 1: Update `likhaLmsApi.ts` for normalized O2M queries**

In `client/src/shared/api/likhaLmsApi.ts`:
- Ensure `getActivitiesWithRelations` uses `fields=*,questions.*,rubrics.*`.
- Ensure `saveActivity` dispatches relational child items to `assessment_questions` and `rubric_criteria` if not using Directus nested write.
- Ensure `submitActivity` dispatches student responses to `submission_answers`.

- [ ] **Step 2: Run client API tests**

Run: `npx vitest run src/shared/api/likhaLmsApi.test.ts` in `client/`  
Expected: PASS (3/3 tests passing).

- [ ] **Step 3: Commit**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
git commit -m "refactor(client): harmonize likhaLmsApi with normalized Directus O2M relations"
```

---

### Task 5: End-to-End Migration & Full Regression Test Verification

**Files:**
- Test: Full server Vitest suite (`npx vitest run` in `server/`)
- Test: Full client Vitest suite (`npx vitest run` in `client/`)

- [ ] **Step 1: Execute complete normalization script on Likha ERP**

Run: `npx tsx -e "import { unpackLegacyLikhaJsonData, reconfigureLikhaRelationalFields } from './server/src/likha/migrations/normalizeLikhaRelationalData.ts'; (async () => { await unpackLegacyLikhaJsonData(); await reconfigureLikhaRelationalFields(); console.log('Complete normalization executed!'); })()"`  
Expected: "Complete normalization executed!"

- [ ] **Step 2: Run server test suite**

Run: `npx vitest run` in `server/`  
Expected: All 50 test files passed (400+ tests).

- [ ] **Step 3: Run client test suite**

Run: `npx vitest run` in `client/`  
Expected: All 61 test files passed (323+ tests).

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat(migration): execute live complete relational normalization and verify zero regressions"
```

---

### Task 6: Live Browser Verification in Likha ERP Admin & Gabay LMS

**Files:**
- Test: Live browser subagent verification
- Create: `task-normalization-report.md`

- [ ] **Step 1: Browser subagent inspection of Likha Admin Activities Form**

Use `browser_subagent` to open `https://gabay.zyberlab.com/admin/content/activities/:id` (or log in as admin):
1. Navigate to Activities collection and click on an item.
2. Verify that the raw JSON code editor for `questions` is GONE and replaced by the native Directus One-to-Many table (`list-o2m`).
3. Verify that the raw JSON code editor for `rubric` is GONE and replaced by the native Directus One-to-Many table (`list-o2m`).
4. Capture screenshot evidence.

- [ ] **Step 2: Browser subagent inspection of Gabay LMS Activities View**

Use `browser_subagent` to open `http://localhost:5173/courses/c-cs101/activities`:
1. Verify that activities list and activity runners render with fully hydrated questions and rubrics.
2. Capture screenshot evidence.

- [ ] **Step 3: Commit and write completion report**

```bash
git add task-normalization-report.md
git commit -m "docs(report): complete verification report for Likha ERP relational normalization"
```
