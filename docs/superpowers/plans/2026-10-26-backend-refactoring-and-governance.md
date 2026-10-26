# Backend Refactoring & Architecture Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate client-orchestrated cascade deletions, eradicate embedded superadmin credentials (`jayveegenetareyes@gmail.com`) from the frontend bundle, configure native relational integrity (`ON DELETE CASCADE`) in Likha ERP, and simplify the client API layer to single-request operations.

**Architecture:** 
1. Directus Data Model Relationships: Configure `ON DELETE CASCADE` on foreign key relations linking child tables to parents (`courses`, `modules`, `activities`, `quizzes`, `exams`, `announcements`, `discussions`, `syllabi`). Configure `ON DELETE SET NULL` on prerequisite pointers.
2. Client Security Hardening: Remove `getLikhaServiceToken` and `likhaElevatedRequest` from `client/src/shared/api/likhaLmsApi.ts`. Eliminate client-side procedural multi-table cascades (`deleteCourseCascade`, multi-fetch loops in `deleteModule`).
3. Verification & Governance: Verify all deletion routines with standard user credentials and assert zero credential leakage in build bundles.

**Tech Stack:** TypeScript, React, Vitest, Directus / Likha ERP (PostgreSQL), Vite.

**Spec:** Codebase scan and architectural directive in [AGENTS.md](file:///d:/4thesis/GabaySystem/Gabay-Prototype/AGENTS.md).

## Global Constraints

- Never use curl, Node scripts, or REST endpoints for Directus schema or backend DDL modifications per `AGENTS.md` (must use browser subagent or Directus Admin UI).
- Never place superadmin or service account credentials in the client bundle.
- Client API mutations must use single HTTP endpoints (`DELETE /items/:collection/:id`), relying on backend relational integrity.
- All existing tests in `likhaLmsApi.test.ts` and `LMSContext.*.test.tsx` must pass cleanly without network elevation.

## Review Focus

1. Course Deletion: `DELETE /items/courses/:id` must delete the course and all child records in a single database transaction without throwing foreign key errors.
2. Module Deletion: `DELETE /items/modules/:id` must cascade delete `module_items` and `module_comments`, and clear `prerequisite_module_id` on other modules.
3. Assessment Deletion: Deleting activities, quizzes, or exams must cascade questions, rubrics, submissions, and files without manual client loops.
4. Token Security: No occurrence of `jayveegenetareyes@gmail.com` or `qwerty12345` anywhere in `client/src/`.
5. Error Resilience: If a user lacks permission to delete a resource, Directus returns 403 and the UI surfaces the authorization failure instead of masking it with superadmin elevation.

---

### Task 1: Document Backend Relational Settings Matrix for Likha ERP

**Files:**
- Create: `docs/superpowers/plans/likha-relational-cascade-matrix.md`

**Interfaces:**
- Specifies the exact target collections, fields, and `On Delete` actions to configure in Directus Admin UI (`https://gabay.zyberlab.com/admin`).

- [ ] **Step 1: Write the relational cascade specification document**
  Define the full list of foreign key relations across the system:
  - `module_items.module_id` -> `CASCADE`
  - `module_comments.module_id` -> `CASCADE`
  - `modules.prerequisite_module_id` -> `SET NULL`
  - `assessment_questions.activity_id / quiz_id / exam_id` -> `CASCADE`
  - `rubric_criteria.activity_id` -> `CASCADE`
  - `activities_files.activities_id` -> `CASCADE`
  - `announcement_replies.announcement_id` -> `CASCADE`
  - `discussion_replies.discussion_id` -> `CASCADE`
  - `submissions.activity_id / quiz_id / exam_id / course_id` -> `CASCADE`
  - `submission_answers.submission_id` -> `CASCADE`
  - `submission_comments.submission_id` -> `CASCADE`
  - `submission_rubric_scores.submission_id` -> `CASCADE`
  - `syllabus_signatories.syllabus_id` -> `CASCADE`
  - `syllabus_references.syllabus_id` -> `CASCADE`
  - `syllabus_policies.syllabus_id` -> `CASCADE`
  - `syllabus_rubrics.syllabus_id` -> `CASCADE`
  - `syllabus_learning_plans.syllabus_id` -> `CASCADE`
  - `syllabus_course_maps.syllabus_id` -> `CASCADE`
  - Course junction children (`Course_Enrollments`, `course_grades`, `course_sections`, `course_files`, `course_folders`, `enrollment_requests`, `announcements`, `discussions`, `modules`, `activities`, `quizzes`, `exams`, `syllabi`) referencing `course_id` -> `CASCADE`
- [ ] **Step 2: Commit documentation**
  ```bash
  git add docs/superpowers/plans/likha-relational-cascade-matrix.md
  git commit -m "docs: define Likha ERP relational cascade matrix"
  ```

---

### Task 2: Remove Hardcoded Superadmin Credentials & Client Elevation

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:90-125, 290-325, 2060-2075`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: User JWT token from `client/src/shared/api/client.ts` (`getToken`)
- Produces: Standard authenticated `likhaRequest`, removing `getLikhaServiceToken` and `likhaElevatedRequest`

- [ ] **Step 1: Write failing test in `likhaLmsApi.test.ts` verifying service credentials do not exist**
  Assert that `getLikhaServiceToken` is removed or returns null, and no hardcoded credentials exist in `likhaLmsApi`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
- [ ] **Step 3: Remove `getLikhaServiceToken` and `likhaElevatedRequest` from `likhaLmsApi.ts`**
  - Delete `jayveegenetareyes@gmail.com` and `qwerty12345`.
  - Replace calls to `likhaElevatedRequest` with standard `likhaRequest`.
  - Remove exported shims `getLikhaServiceToken`, `getLikhaUploadServiceToken`, and `likhaElevatedRequest`.
- [ ] **Step 4: Update test mocks in `likhaLmsApi.test.ts`**
  Replace tests expecting service token elevation with tests verifying RBAC errors propagate properly.
- [ ] **Step 5: Run tests to verify they pass**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
  Expected: PASS
- [ ] **Step 6: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
  git commit -m "security: remove hardcoded service credentials and client elevation from likhaLmsApi"
  ```

---

### Task 3: Streamline `deleteCourse` and Deprecate `deleteCourseCascade`

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:670-975`
- Modify: `client/src/shared/context/LMSContext.tsx:3625-3645`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: `courseId: string`
- Produces: `likhaLmsApi.courses.deleteCourse(id: string): Promise<void>` (single `DELETE /items/courses/:id` call)

- [ ] **Step 1: Write test for simplified `deleteCourse`**
  Verify that `deleteCourse` makes a single `DELETE /items/courses/:id` call and invalidates relevant caches.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
- [ ] **Step 3: Refactor `deleteCourse` in `likhaLmsApi.ts` and remove procedural 300-line cascade**
  - Implement clean, single-request `deleteCourse(id: string)`.
  - Redirect `deleteCourseCascade` to call `deleteCourse` for backward compatibility.
  - In `LMSContext.tsx`, ensure `deleteCourse` invokes `likhaLmsApi.courses.deleteCourse(courseId)`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/shared/api/likhaLmsApi.test.ts
  git commit -m "refactor: simplify deleteCourse to single-request backend cascade"
  ```

---

### Task 4: Streamline `deleteModule` and Assessment Deletion Methods

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:1060-1140, 1175-1265`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: `id: string`
- Produces: Single-request `deleteModule`, `deleteActivity`, `deleteQuiz`, `deleteExam`

- [ ] **Step 1: Write tests for single-request `deleteModule` and assessment deletions**
  Verify `deleteModule(id)` issues `DELETE /items/modules/:id` directly without discovery queries.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
- [ ] **Step 3: Simplify `deleteModule` in `likhaLmsApi.ts`**
  Replace procedural discovery/deletion in `deleteModule` with a direct `likhaRequest(/items/modules/:id, { method: 'DELETE' })`.
- [ ] **Step 4: Verify assessment deletion endpoints in `likhaLmsApi.ts`**
  Ensure `deleteActivity`, `deleteQuiz`, and `deleteExam` cleanly delegate deletion to Directus.
- [ ] **Step 5: Run tests to verify they pass**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
  Expected: PASS
- [ ] **Step 6: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
  git commit -m "refactor: simplify deleteModule and assessments to direct backend operations"
  ```

---

### Task 5: End-to-End Build and Security Verification

**Files:**
- Verify: Full repository build and bundle checks

- [ ] **Step 1: Run full test suite**
  Run: `npm --prefix client test`
  Expected: All LMSContext and API test suites pass.
- [ ] **Step 2: Run production bundle build**
  Run: `npm --prefix client run build`
  Expected: Build succeeds with 0 errors.
- [ ] **Step 3: Grep built bundle for leaked credentials**
  Run: `Select-String -Path "client/dist/**/*.js" -Pattern "jayveegenetareyes|qwerty12345"`
  Expected: Zero matches in client distribution.
- [ ] **Step 4: Commit**
  ```bash
  git commit --allow-empty -m "chore: verify clean production build without credential leakage"
  ```
