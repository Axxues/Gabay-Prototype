# Full Likha ERP Backend, Rich Interfaces & Automation Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Likha ERP as the complete, full-lifecycle backend for all LMS operations by configuring rich field interfaces, building complete execution DAGs for all 4 automation flows, expanding `likhaLmsApi.ts` for all LMS domains, and refactoring `LMSContext.tsx` to directly consume Likha ERP while isolating Express to RAG.

**Architecture:** The client connects directly to Likha ERP (`https://gabay.zyberlab.com`) for all authentication, data queries, relational child hydration, and file uploads. Business logic for notifications and gradebook SPR aggregation executes natively in Likha ERP Flows. Express on port 4001 is retained strictly as an AI / RAG microservice.

**Tech Stack:** Directus REST API, Likha ERP (`https://gabay.zyberlab.com`), Directus Flows & Operations, TypeScript, React 19, Vite, Express (RAG microservice), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-full-likha-erp-backend-and-automations-design.md`

## Global Constraints
- Target Likha ERP URL: `https://gabay.zyberlab.com`
- 🚨 **NO REST API DDL/SCHEMA CALLS TO LIKHA ERP:** Per `AGENTS.md`, never use curl, Node scripts, or REST endpoints (`/fields`, `/relations`, `/collections`) to alter schema. All Directus field interface and Flow DAG updates must strictly use `browser_subagent`.
- Zero breaking changes to client UI features; all 61 client Vitest test suites (323 tests) must continue passing.
- Retain Express strictly on port 4001 for `/api/health`, `/api/rag`, `/api/rag-baseline`, `/api/rag-aggregate`, and `/api/rag-export`.

---

### Task 1: Directus Rich Field Interfaces Configuration via Browser Subagent

**Files:**
- Visual Inspection & Configuration via `browser_subagent` navigating `https://gabay.zyberlab.com/admin/settings/data-model`

**Interfaces:**
- Configures rich Directus field interfaces: WYSIWYG, Datetime, Toggle, Dropdown, Color, and One-to-Many across `activities`, `courses`, `submissions`, `announcements`, and `modules`.

- [ ] **Step 1: Inspect and configure `activities` field interfaces in Directus Admin**

Use `browser_subagent` to open `https://gabay.zyberlab.com/admin/settings/data-model/activities`:
1. Check `instructions` / `description` field: set interface to **WYSIWYG** (or Markdown).
2. Check `due_date`, `available_from`, `available_until`: verify/set interface to **Datetime**.
3. Check `published`, `allow_late_submission`: set interface to **Toggle**.
4. Check `term`: set interface to **Dropdown** (`prelim`, `midterm`, `finals`).
5. Save field settings and capture screenshot.

- [ ] **Step 2: Inspect and configure `courses` and `submissions` field interfaces in Directus Admin**

Use `browser_subagent` to open:
1. `https://gabay.zyberlab.com/admin/settings/data-model/courses`: set `color` to **Color** picker, `published` to **Toggle**, `term` to **Dropdown**.
2. `https://gabay.zyberlab.com/admin/settings/data-model/submissions`: set `status` to **Dropdown** (`draft`, `submitted`, `graded`, `late`), `submitted_at` to **Datetime**, `feedback` to **WYSIWYG** or **Textarea**.
3. Save field settings and capture screenshot.

- [ ] **Step 3: Inspect and configure `announcements` and `modules` field interfaces**

Use `browser_subagent` to open:
1. `https://gabay.zyberlab.com/admin/settings/data-model/announcements`: set `content` to **WYSIWYG**, `published` to **Toggle**, `date` to **Datetime**.
2. `https://gabay.zyberlab.com/admin/settings/data-model/modules`: verify `items` relation interface is **One-to-Many (`list-o2m`)**.
3. Capture screenshot.

---

### Task 2: Populate Complete Operation DAGs for Likha Automation Flows

**Files:**
- Configuration via `browser_subagent` navigating `https://gabay.zyberlab.com/admin/settings/flows`

**Interfaces:**
- Builds complete execution graphs (Read Data, Create Data, Transform) for the 4 LMS flows.

- [ ] **Step 1: Configure operations for `gabay-publish-notification-flow`**

Use `browser_subagent` on `https://gabay.zyberlab.com/admin/settings/flows`:
1. Open `gabay-publish-notification-flow`.
2. Connect an operation after Trigger: **Read Data** on `enrollment_requests` filtering by `course_id = {{$trigger.payload.course_id}}` and `status = approved`.
3. Connect next operation: **Create Data** on `notifications` creating notification records for enrolled students (`"New activity published"`).
4. Save the flow and capture screenshot of the connected operation DAG.

- [ ] **Step 2: Configure operations for `gabay-submission-spr-flow`**

Use `browser_subagent` on `https://gabay.zyberlab.com/admin/settings/flows`:
1. Open `gabay-submission-spr-flow`.
2. Connect operation after Trigger: **Read Data** on `activities` to read the activity's `course_id` and `title`.
3. Connect next operation: **Create Data** on `spr_cells` to upsert the score record (`student_id`, `task_id`, `score`).
4. Connect next operation: **Create Data** on `notifications` to alert the student that their submission has been graded.
5. Save the flow and capture screenshot of the connected operation DAG.

- [ ] **Step 3: Configure operations for `gabay-enrollment-alert-flow` and `gabay-due-date-reminder-cron`**

Use `browser_subagent` on `https://gabay.zyberlab.com/admin/settings/flows`:
1. Open `gabay-enrollment-alert-flow`: Add operation to read course instructor and create notification for faculty.
2. Open `gabay-due-date-reminder-cron`: Add operation to read upcoming activities and create reminder notifications for pending students.
3. Save both flows and capture screenshot.

---

### Task 3: Comprehensive Likha Client API Adapter (`client/src/shared/api/likhaLmsApi.ts`)

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: Likha ERP Directus endpoints (`/auth/login`, `/users/me`, `/items/*`, `/files`)
- Produces: Complete typed domain methods (`auth`, `courses`, `modules`, `assessments`, `submissions`, `grades`, `communications`, `files`) with automatic service token fallback on 403.

- [ ] **Step 1: Write unit tests covering full Likha API client adapter**

In `client/src/shared/api/likhaLmsApi.test.ts`, add test cases:
1. `login` and token storage.
2. `getCoursesWithRelations` and `createCourse`.
3. `getModulesWithItems` and `createModule`.
4. `saveActivity` with relational `assessment_questions` and `rubric_criteria`.
5. `saveGradeWithCells` with relational `spr_cells`.
6. Automatic service token fallback on HTTP 403 error.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run client/src/shared/api/likhaLmsApi.test.ts`  
Expected: FAIL (missing domain methods).

- [ ] **Step 3: Implement comprehensive domain methods in `likhaLmsApi.ts`**

In `client/src/shared/api/likhaLmsApi.ts`:
1. Implement `auth`: `login(email, password)`, `getMe()`, `getUsers()`, `updateUser(id, data)`.
2. Implement `courses`: `getCourses(studentId?)`, `getCourse(id)`, `createCourse(data)`, `updateCourse(id, data)`, `deleteCourse(id)`.
3. Implement `sections` & `requests`: `getSections`, `getEnrollmentRequests`, `updateEnrollmentRequest`.
4. Implement `modules`: `getModulesWithItems`, `createModule`, `updateModule`, `deleteModule`, `createModuleItem`, `updateModuleItem`, `deleteModuleItem`, `addModuleComment`.
5. Implement `assessments`: `getActivities`, `saveActivity`, `deleteActivity`, `getQuizzes`, `saveQuiz`, `deleteQuiz`, `getExams`, `saveExam`, `deleteExam`.
6. Implement `submissions`: `getSubmissions`, `submitAssessment`, `gradeSubmission`.
7. Implement `grades`: `getCourseGrades`, `getSPRConfig`, `saveSPRConfig`, `saveGradeWithCells`.
8. Implement `communications`: `getAnnouncements`, `createAnnouncement`, `addAnnouncementReply`, `getDiscussions`, `createDiscussion`, `addDiscussionReply`, `getNotifications`, `markNotificationRead`, `getMessages`, `sendMessage`, `getCalendarEvents`.
9. Implement `files`: `uploadFile`, `getCourseFiles`.
10. Wrap fetch calls in a helper that retries with the authenticated service token if status is 403.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run client/src/shared/api/likhaLmsApi.test.ts`  
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
git commit -m "feat(client): implement comprehensive direct-to-Likha API client with service token fallback"
```

---

### Task 4: LMSContext Harmonization to Direct Likha ERP

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx`
- Test: Run all client Vitest suites (`npm run test --workspace=client -- --run`)

**Interfaces:**
- Consumes: `likhaLmsApi` from Task 3
- Produces: Fully functional `LMSContext` routing all CRUD actions directly to Likha ERP while maintaining 100% UI contract.

- [ ] **Step 1: Refactor `LMSContext.tsx` to consume `likhaLmsApi`**

In `client/src/shared/context/LMSContext.tsx`:
1. In `login`: call `likhaLmsApi.auth.login(identifier, password)`.
2. In `refreshAll` / `loadInitialData`: replace `apiFetch` calls with `likhaLmsApi.courses.getCourses()`, `likhaLmsApi.communications.getNotifications()`, `likhaLmsApi.communications.getMessages()`, `likhaLmsApi.communications.getCalendarEvents()`, `likhaLmsApi.users.getUsers()`.
3. In `createCourse`, `updateCourse`: call `likhaLmsApi.courses.*`.
4. In `createModule`, `updateModule`, `deleteModule`, `addModuleItem`, `updateModuleItem`: call `likhaLmsApi.modules.*`.
5. In `createQuiz`, `createExam`, `createActivity`, `updateActivity`: call `likhaLmsApi.assessments.*`.
6. In `submitQuiz`, `submitExam`, `submitActivity`, `gradeSubmission`: call `likhaLmsApi.submissions.*`.
7. In `saveSPRConfig`, `updateCourseGrades`: call `likhaLmsApi.grades.*`.
8. In `createAnnouncement`, `createDiscussion`, `sendMessage`: call `likhaLmsApi.communications.*`.
9. Remove redundant client-side notification inserts (now handled by Likha Flows).

- [ ] **Step 2: Run all client test suites to verify zero regressions**

Run: `npm run test --workspace=client -- --run`  
Expected: All 61 test files passed (323+ tests).

- [ ] **Step 3: Commit**

```bash
git add client/src/shared/context/LMSContext.tsx
git commit -m "refactor(context): migrate all LMSContext CRUD actions directly to Likha ERP"
```

---

### Task 5: Express Microservice Decoupling (Port 4001 Strictly for RAG)

**Files:**
- Modify: `server/src/index.ts`
- Test: Run server Vitest suite (`npm run test --workspace=server`)

**Interfaces:**
- Consumes: n8n webhook proxies and telemetry SQLite
- Produces: Lean Express microservice serving only `/api/rag*` and `/api/health`.

- [ ] **Step 1: Prune legacy monolithic LMS routes from `server/src/index.ts`**

In `server/src/index.ts`:
1. Clearly document and comment out legacy LMS Express router mounts (`/api/courses`, `/api/modules`, `/api/quizzes`, `/api/activities`, `/api/exams`, `/api/submissions`, `/api/grades`, `/api/files`, `/api/announcements`, etc.) which are now served directly by Likha ERP.
2. Keep `/api/health`, `/api/rag`, `/api/rag-baseline`, `/api/rag-aggregate`, `/api/rag-export`.
3. Keep static `/uploads` for backward compatibility with local file links.

- [ ] **Step 2: Run server test suites to verify zero regressions**

Run: `npm run test --workspace=server`  
Expected: 51 test files pass (400 tests).

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "refactor(server): decouple Express to dedicated RAG and telemetry microservice"
```

---

### Task 6: Full System Integration & Live Browser Verification

**Files:**
- Test: Live browser subagent end-to-end verification
- Create: `task-full-likha-report.md`

- [ ] **Step 1: Start local development servers**

1. Express RAG microservice on port 4001: `npm run dev:server`
2. Vite LMS client on port 5173: `npm run dev:client`

- [ ] **Step 2: Live Browser Verification of Likha ERP Admin**

Use `browser_subagent` navigating `https://gabay.zyberlab.com/admin`:
1. Verify rich field interfaces on Activities (`instructions` has WYSIWYG, `due_date` has Datetime picker, `term` has Dropdown).
2. Verify all 4 Automation Flows have active, populated operation graphs.
3. Capture screenshot evidence.

- [ ] **Step 3: Live Browser Verification of Gabay LMS Frontend**

Use `browser_subagent` navigating `http://localhost:5173`:
1. Log in as Faculty 1 (`faculty1@dmmmsu.edu.ph`).
2. Navigate to CS 101 Courses, Modules, and Activities.
3. Create a new activity with formatted instructions and questions.
4. Verify activity renders in the LMS view.
5. Log in as Student 1, submit the activity.
6. Verify Likha Flow triggers create real notifications in the notification bell.
7. Capture screenshot and recording evidence.

- [ ] **Step 4: Stop dev servers and generate completion report**

1. Stop dev servers on ports 4001 and 5173.
2. Create `task-full-likha-report.md` documenting:
   - Rich Directus UI interfaces configured
   - Complete operation DAGs on all 4 automation flows
   - 100% test pass rate across both suites (723 tests)
   - Zero HTTP 502 server crashes
3. Commit:
```bash
git add task-full-likha-report.md
git commit -m "docs(report): complete verification report for full Likha ERP backend and automations"
```
