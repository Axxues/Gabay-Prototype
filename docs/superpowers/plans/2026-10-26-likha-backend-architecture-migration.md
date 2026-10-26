# Likha ERP Backend Architecture Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate client-side looping mutations, migrate local storage pseudo-databases (`STORAGE_KEY_LEADERSHIP_TENURES`, `STORAGE_KEY_GOVERNANCE_AUDIT_LOGS`, `STORAGE_KEY_PENDING_REGISTRATIONS`) into authoritative Likha ERP Directus collections, enforce atomic deep relational writes for assessments and grading, and ensure enrollment and academic lifecycle processes are fully backed by Likha ERP.

**Architecture:**
1. **Atomic Assessment & Submission Operations:** Transition `saveActivity`, `saveQuiz`, `saveExam`, and `submitActivity` in `likhaLmsApi.ts` from sequential client loops into atomic Directus nested relational payloads.
2. **Atomic Grading & Rubric Scoring:** Consolidate `gradeSubmission` in `LMSContext.tsx` and `likhaLmsApi.ts` into a single unified call preventing partial grade states.
3. **Batch SPR Ingestion:** Replace looping `POST /items/spr_cells` calls in `saveGradeWithCells` with Directus batch creation.
4. **Relational Junction Synchronization:** Ensure `approveEnrollmentRequests` reliably creates the `Course_Enrollments` junction in Likha ERP instead of keeping it in client memory.
5. **Governance & Leadership Collections in Likha ERP:** Safely create `leadership_tenures` and `governance_audit_logs` collections in Likha ERP using direct scripts conforming to `likha-erp-api` safety rules, then rewire `LMSContext.tsx` to read/write from Likha ERP.
6. **Cross-Device Pending Registrations:** Safely create `pending_registrations` in Likha ERP to ensure registration queues and verification are synchronized across all administrative devices.

**Tech Stack:** TypeScript, React, Vitest, Directus / Likha ERP (PostgreSQL), Vite, Python 3 / Node.js scripting.

**Spec:** Codebase Architectural Audit and Agent Guidelines in [AGENTS.md](file:///d:/4thesis/GabaySystem/Gabay-Prototype/AGENTS.md) and [.agents/skills/likha-erp-api/SKILL.md](file:///d:/4thesis/GabaySystem/Gabay-Prototype/.agents/skills/likha-erp-api/SKILL.md).

---

## Global Constraints & Safety Protocols

- **CRITICAL CRASH VECTOR:** NEVER `PATCH /relations` under any circumstance.
- **Cloudflare WAF / User-Agent:** All API writes (`POST`, `PATCH`, `DELETE`) executed by scripts or client fetchers MUST send `User-Agent: curl/8.5.0` or a standard client header to avoid `HTTP 403 error code: 1010`.
- **URL-Encoding:** All filter queries must URL-encode brackets (`filter%5Bkey%5D%5B_eq%5D`).
- **Shell Variable Protection:** Script and flow payloads must be written via dedicated script files with UTF-8 encoding.
- **Zero Frontend Service Credentials:** Client bundle must use active user JWT tokens only; administrative backend setup operations must use isolated migration scripts with `LIKHA_TOKEN` from environment.
- **Tests & Regression:** All 156 test suites (1,012+ tests) must pass cleanly after every task.

---

### Task 1: Atomic Deep Relational Writes for Activities, Quizzes & Exams

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:780-860, 1460-1510`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: Activity / Quiz / Exam payload with child `questions` and `rubric` arrays
- Produces: Single atomic `POST` or `PATCH` to `/items/activities`, `/items/quizzes`, or `/items/exams` with nested child objects or atomic batching

- [ ] **Step 1: Write failing test in `likhaLmsApi.test.ts` asserting atomic relational activity creation**
  Verify that `saveActivity` dispatches a single atomic request (or clean parent+bulk child) instead of individual sequential `POST` requests per question and criterion.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
- [ ] **Step 3: Refactor `saveActivity`, `saveQuiz`, and `saveExam` in `likhaLmsApi.ts`**
  - Replace sequential question/rubric loops with atomic batch payloads or nested relational Directus structures.
  - On update (`isUpdate = true`), handle child records cleanly without duplicate collisions.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
  git commit -m "refactor(api): use atomic relational writes for activities, quizzes, and exams"
  ```

---

### Task 2: Atomic Submission & Student Answers Ingestion

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:1512-1540`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: Submission payload with `answers` list
- Produces: Atomic submission persistence without unhandled swallowed loops

- [ ] **Step 1: Write failing test in `likhaLmsApi.test.ts` for atomic submission creation**
  Verify `submitActivity` sends child answers via Directus batch endpoint (`POST /items/submission_answers` with array) or nested payload in a single network round-trip.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
- [ ] **Step 3: Refactor `submitActivity` in `likhaLmsApi.ts`**
  - Format answers into a single array payload.
  - Post all answers in a single batch call (`POST /items/submission_answers` with `[ {...}, {...} ]`) instead of a looping `for` loop with `.catch(() => {})`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm --prefix client test src/shared/api/likhaLmsApi.test.ts`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
  git commit -m "refactor(api): batch submission answers into a single atomic write"
  ```

---

### Task 3: Consolidated Submission Grading & Rubric Scoring

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:850-890`
- Modify: `client/src/shared/context/LMSContext.tsx:6555-6610`
- Test: `client/src/features/assessments/components/grading/AssessmentsGrading.test.tsx`
- Test: `client/src/shared/context/LMSContext.gradesRelease.test.tsx`

**Interfaces:**
- Consumes: `submissionId: string`, `grade: number`, `rubricScores: Record<string, number>`, `commentText?: string`
- Produces: Consolidated grading operation eliminating partial failure states

- [ ] **Step 1: Write failing test verifying consolidated grading**
  Verify `gradeSubmission` batches rubric criteria scores via single bulk call (`POST /items/submission_rubric_scores` with array) rather than individual per-item promises.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/features/assessments/components/grading/AssessmentsGrading.test.tsx`
- [ ] **Step 3: Refactor `likhaLmsApi.submissions.addRubricScoresBatch` and `LMSContext.tsx:6555-6610`**
  - Implement `addRubricScoresBatch(submissionId, scores)` in `likhaLmsApi.ts` using Directus array POST.
  - Update `gradeSubmission` in `LMSContext.tsx` to call the batch endpoint.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm --prefix client test src/features/assessments/components/grading/AssessmentsGrading.test.tsx src/shared/context/LMSContext.gradesRelease.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/features/assessments/components/grading/AssessmentsGrading.test.tsx
  git commit -m "refactor(grading): consolidate rubric scores into bulk persistence"
  ```

---

### Task 4: Batch Student Permanent Record (SPR) Cell Upserts

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:909-940`
- Test: `client/src/shared/context/LMSContext.gradesSprLikha.test.tsx`

**Interfaces:**
- Consumes: `courseId: string`, `studentId: string`, `cells: Array<{ task_id: string; score: number }>`
- Produces: Single batch request for `spr_cells` instead of N sequential HTTP round trips

- [ ] **Step 1: Write test for batch SPR cells write in `likhaLmsApi.test.ts`**
  Assert `saveGradeWithCells` posts the entire array of cell records in a single Directus batch call.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/shared/context/LMSContext.gradesSprLikha.test.tsx`
- [ ] **Step 3: Refactor `saveGradeWithCells` in `likhaLmsApi.ts`**
  - Find or create `course_grades` row.
  - Send all `spr_cells` in a single `POST /items/spr_cells` array payload: `body: JSON.stringify(cellsPayload)`.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm --prefix client test src/shared/context/LMSContext.gradesSprLikha.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.gradesSprLikha.test.tsx
  git commit -m "perf(spr): batch spr_cells persistence into a single request"
  ```

---

### Task 5: Course Enrollment Junction Persistence on Approval

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:8449-8540`
- Test: `client/src/features/courses/PendingRequestsPage.test.tsx`
- Test: `client/src/shared/context/LMSContext.enrollmentScope.test.tsx`

**Interfaces:**
- Consumes: `requestIds: string[]`
- Produces: Updates `enrollment_requests` status to approved AND creates `Course_Enrollments` junction records in Likha ERP

- [ ] **Step 1: Write failing test in `PendingRequestsPage.test.tsx` verifying `Course_Enrollments` creation**
  Assert that approving a student request calls `likhaLmsApi.courses.enrollStudent` / `createCourseEnrollment` in addition to updating the request status.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/features/courses/PendingRequestsPage.test.tsx`
- [ ] **Step 3: Implement `enrollStudent` / batch enrollment in `likhaLmsApi.ts` and call it in `approveEnrollmentRequests`**
  - In `LMSContext.tsx:8449-8540`, after updating `enrollment_requests`, issue creation of `Course_Enrollments` for the approved students so the enrollment is stored permanently in Likha ERP.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm --prefix client test src/features/courses/PendingRequestsPage.test.tsx src/shared/context/LMSContext.enrollmentScope.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/features/courses/PendingRequestsPage.test.tsx
  git commit -m "fix(enrollment): persist approved student enrollments to Course_Enrollments in Likha ERP"
  ```

---

### Task 6: Provision `leadership_tenures` and `governance_audit_logs` in Likha ERP

**Files:**
- Create: `scripts/migrations/create-governance-collections.py`
- Test: Directus API verification with `GET /collections/leadership_tenures` and `GET /collections/governance_audit_logs`

**Interfaces:**
- Produces:
  - `leadership_tenures` collection with schema fields: `id` (string PK), `role` (string), `unit_id` (string), `unit_name` (string), `unit_type` (string), `leader_id` (string), `leader_name` (string), `leader_email` (string), `start_date` (timestamp), `end_date` (timestamp nullable), `status` (string), `appointed_by` (string), `transition_notes` (text), `created_at` (timestamp)
  - `governance_audit_logs` collection with schema fields: `id` (string PK), `timestamp` (timestamp), `event_type` (string), `title` (string), `description` (text), `actor_id` (string), `actor_name` (string), `actor_role` (string), `unit_id` (string), `unit_type` (string), `target_id` (string), `target_type` (string), `metadata` (json)

- [ ] **Step 1: Write migration script `scripts/migrations/create-governance-collections.py`**
  Following Likha ERP API rules:
  - Check existence before creation (`GET /collections/{name}`).
  - Send `User-Agent: curl/8.5.0`.
  - Use `Bearer ${LIKHA_TOKEN}` from environment.
  - Create collection via `POST /collections`.
  - Add fields via `POST /fields/{collection}`.
  - Clear schema cache via `POST /utils/cache/clear {"cache":"system"}`.
- [ ] **Step 2: Execute script to provision collections on `https://gabay.zyberlab.com`**
  Run: `python scripts/migrations/create-governance-collections.py`
  Verify `200 OK` responses and absence of 502/crash.
- [ ] **Step 3: Commit migration script**
  ```bash
  git add scripts/migrations/create-governance-collections.py
  git commit -m "feat(backend): provision leadership_tenures and governance_audit_logs collections in Likha ERP"
  ```

---

### Task 7: Wire Governance & Leadership Tenures to Likha ERP API

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts`
- Modify: `client/src/shared/context/LMSContext.tsx:5090-5160`
- Test: `client/src/shared/context/LMSContext.leadershipTenures.test.tsx`
- Test: `client/src/features/accounts/components/LeadershipTimelineTab.test.tsx`

**Interfaces:**
- Consumes: `likhaLmsApi.governance.getTenures()`, `createTenure()`, `updateTenure()`, `getAuditLogs()`, `createAuditLog()`
- Produces: Real multi-device persisted governance audit logs and leadership succession

- [ ] **Step 1: Write failing test in `LMSContext.leadershipTenures.test.tsx` verifying Likha ERP persistence**
  Verify `transferLeadership` calls `likhaLmsApi.governance.createTenure` and `createAuditLog`.
- [ ] **Step 2: Run test to verify it fails**
  Run: `npm --prefix client test src/shared/context/LMSContext.leadershipTenures.test.tsx`
- [ ] **Step 3: Add governance namespace to `likhaLmsApi.ts` and integrate in `LMSContext.tsx`**
  - Add `likhaLmsApi.governance` with methods for tenures and audit logs.
  - In `LMSContext.tsx`, load tenures and logs from Likha ERP during initialization/refresh.
  - In `transferLeadership` and `logGovernanceEvent`, persist to Likha ERP first, then update local state.
- [ ] **Step 4: Run tests to verify they pass**
  Run: `npm --prefix client test src/shared/context/LMSContext.leadershipTenures.test.tsx src/features/accounts/components/LeadershipTimelineTab.test.tsx`
  Expected: PASS
- [ ] **Step 5: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.leadershipTenures.test.tsx
  git commit -m "feat(governance): persist leadership tenures and audit logs to Likha ERP"
  ```

---

### Task 8: Cross-Device Pending Registrations Persistence in Likha ERP

**Files:**
- Create: `scripts/migrations/create-pending-registrations-collection.py`
- Modify: `client/src/shared/api/likhaLmsApi.ts`
- Modify: `client/src/shared/context/LMSContext.tsx:4645-4830`
- Test: `client/src/features/auth/RegisterPage.test.tsx`
- Test: `client/src/features/accounts/ManageAccountsPage.rbac.test.tsx`

**Interfaces:**
- Produces: `pending_registrations` collection in Likha ERP.
- Replaces: `localStorage` queue (`STORAGE_KEY_PENDING_REGISTRATIONS`) with multi-device shared queue.

- [ ] **Step 1: Write and run migration script to provision `pending_registrations` in Likha ERP**
  Fields: `id`, `first_name`, `middle_name`, `last_name`, `email`, `role`, `college_id`, `college_name`, `department`, `program`, `student_id`, `email_verified`, `activation_token`, `registered_at`.
- [ ] **Step 2: Write failing test in `RegisterPage.test.tsx` asserting registration persistence to Likha API**
  Verify `registerAccount` calls `likhaLmsApi.auth.submitRegistration` and posts to Likha ERP.
- [ ] **Step 3: Run test to verify it fails**
  Run: `npm --prefix client test src/features/auth/RegisterPage.test.tsx`
- [ ] **Step 4: Update `likhaLmsApi.ts` and `LMSContext.tsx`**
  - Add registration endpoints (`getPendingRegistrations`, `submitRegistration`, `deletePendingRegistration`).
  - Update `registerAccount`, `verifyRegistration`, and `rejectRegistration` to sync with Likha ERP.
- [ ] **Step 5: Run tests to verify they pass**
  Run: `npm --prefix client test src/features/auth/RegisterPage.test.tsx src/features/accounts/ManageAccountsPage.rbac.test.tsx`
  Expected: PASS
- [ ] **Step 6: Commit**
  ```bash
  git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/features/auth/RegisterPage.test.tsx
  git commit -m "feat(auth): persist pending registrations to Likha ERP across all devices"
  ```

---

### Task 9: Full System Verification and Regression Testing

**Files:**
- Verify: All client features and test suites

- [ ] **Step 1: Run complete test suite**
  Run: `npm --prefix client test`
  Expected: All 156+ test suites pass cleanly.
- [ ] **Step 2: Run full production build**
  Run: `npm --prefix client run build`
  Expected: Build succeeds with 0 errors.
- [ ] **Step 3: Verify backend health**
  Run: `curl.exe -s -H "User-Agent: curl/8.5.0" "https://gabay.zyberlab.com/server/ping"`
  Expected: `pong` (200 OK).
- [ ] **Step 4: Commit**
  ```bash
  git commit --allow-empty -m "chore: verify complete system health and tests passing"
  ```
