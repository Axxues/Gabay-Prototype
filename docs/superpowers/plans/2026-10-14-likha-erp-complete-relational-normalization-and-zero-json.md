# Likha ERP Complete Relational Normalization & Zero-JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 100% relational normalization across all Likha ERP LMS collections, eliminate every single `json` type field, create missing operational collections, and organize all collections into 5 feature folders with zero server outages and 100% test pass rate.

**Architecture:** Use `browser_subagent` for all Directus Data Model mutations (folder creation, missing collections, field removals) in strict compliance with `AGENTS.md`. Execute a typed data-unpacking script (`scripts/unpack-likha-json-data.ts`) to migrate active JSON records into relational child tables, harmonize client API adapters (`likhaLmsApi.ts`, `LMSContext.tsx`), and validate zero-JSON compliance via an automated schema inspector.

**Tech Stack:** Directus 11 (Likha ERP Data Studio), TypeScript, Node.js (scripts), React 18, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-14-likha-erp-complete-relational-normalization-and-zero-json-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-14-likha-erp-complete-relational-normalization-and-zero-json-design.md)

## Global Constraints
- **MANDATORY ZERO-REST-DDL RULE (`AGENTS.md`):** Never issue REST API DDL calls (`/fields`, `/relations`, `/collections`) to `https://gabay.zyberlab.com`. All schema mutations must be executed interactively in Directus Data Studio UI via `browser_subagent`.
- **Zero-JSON Standard:** No collection in Likha ERP may have any field of type `json` after Task 4.
- **Fixture Preservation:** Never delete test fixture files in `file-samples/` (`CSPC103-IKM-SYL-1stSemAY2026-2027.docx`, `CMSC131_Course_Orientation.pdf`).
- **Full Test Integrity:** Maintain 100% test pass rate across all 731 platform tests (400 server, 331 client).

---

### Task 1: Directus Schema Setup via Browser Subagent

**Files:**
- Create: `docs/superpowers/plans/likha_schema_setup_verified.png` (Screenshot evidence)
- Documentation: `docs/superpowers/plans/2026-10-14-likha-erp-complete-relational-normalization-and-zero-json.md`

**Interfaces:**
- Consumes: Directus Data Studio at `https://gabay.zyberlab.com/admin/settings/data-model`.
- Produces: 
  - 📁 `syllabus_management` folder (`syllabi`, `syllabus_course_info`, `syllabus_course_maps`, `syllabus_course_outcomes`, `syllabus_faculty`, `syllabus_grading_systems`, `syllabus_institution`, `syllabus_learning_plans`, `syllabus_policies`, `syllabus_program_outcomes`, `syllabus_references`, `syllabus_rubrics`, `syllabus_signatories`).
  - Missing collections: `announcement_replies`, `discussion_replies`, `notifications`, `submission_rubric_scores`, `submission_comments`, `chat_groups_directus_users`.
  - Relational fields: `courses.syllabus_id` (M2O `syllabi`), `courses.spr_config_id` (M2O `spr_configs`).

- [ ] **Step 1: Create `syllabus_management` feature folder**
  - Use `browser_subagent` in Directus Data Model.
  - Click "+" / "Create Folder" button.
  - Set folder name to `syllabus_management` (Display: "Syllabus Management").
  - Save folder.

- [ ] **Step 2: Create missing communication collections**
  - In Directus Data Model, create:
    - `announcement_replies` (Folder: `communications`) with fields `id` (pk), `announcement_id` (M2O `announcements`), `author_id` (M2O `directus_users`), `content` (text), `created_at` (dateTime).
    - `discussion_replies` (Folder: `communications`) with fields `id` (pk), `discussion_id` (M2O `discussions`), `author_id` (M2O `directus_users`), `content` (text), `created_at` (dateTime).
    - `notifications` (Folder: `communications`) with fields `id` (pk), `user_id` (M2O `directus_users`), `title` (string), `message` (text), `type` (string), `link` (string), `is_read` (boolean), `created_at` (dateTime).
    - `chat_groups_directus_users` (Folder: `communications` - junction) with fields `id` (pk), `chat_group_id` (M2O `chat_groups`), `directus_user_id` (M2O `directus_users`).

- [ ] **Step 3: Create missing assessment collections**
  - In Directus Data Model, create:
    - `submission_rubric_scores` (Folder: `assessments_grading`) with fields `id` (pk), `submission_id` (M2O `submissions`), `criterion_id` (M2O `rubric_criteria`), `points_awarded` (float), `feedback` (text).
    - `submission_comments` (Folder: `assessments_grading`) with fields `id` (pk), `submission_id` (M2O `submissions`), `author_id` (M2O `directus_users`), `content` (text), `created_at` (dateTime).

- [ ] **Step 4: Add foreign keys on `courses`**
  - In Directus Data Model (`/admin/settings/data-model/courses`):
    - Add `syllabus_id` as Many-to-One relationship to `syllabi`.
    - Add `spr_config_id` as Many-to-One relationship to `spr_configs`.

- [ ] **Step 5: Capture visual proof and commit**
  - Capture screenshot of Data Model showing folders and new collections.
  - Save to `docs/superpowers/plans/likha_schema_setup_verified.png`.
  - Commit: `git add docs/superpowers/plans/likha_schema_setup_verified.png; git commit -m "docs(verify): verify new collections and folders creation in Likha ERP"`

---

### Task 2: Relational Data Unpacking Pipeline

**Files:**
- Create: `scripts/unpack-likha-json-data.ts`
- Test: `server/src/likha/migrations/normalizeLikhaRelationalData.test.ts`

**Interfaces:**
- Consumes: Likha ERP `/items/courses`, `/items/activities`, `/items/submissions`, `/items/announcements`, `/items/discussions`.
- Produces: Populated normalized relational rows in `syllabi`, `syllabus_course_info`, `syllabus_course_outcomes`, `syllabus_learning_plans`, `syllabus_policies`, `rubric_criteria`, `assessment_questions`, `submission_answers`, `announcement_replies`, `discussion_replies`.

- [ ] **Step 1: Write `scripts/unpack-likha-json-data.ts`**
  - Write script that:
    1. Authenticates using service token.
    2. Fetches `courses`: parses `course.syllabus` JSON (if present) and unpacks into `syllabi` + 13 `syllabus_*` records, updating `courses.syllabus_id = syllabi.id`.
    3. Fetches `courses`: parses `course.spr_config` JSON (if present) and unpacks into `spr_configs` + `spr_cells`.
    4. Fetches `activities`: parses `questions` and `rubric` JSON into `assessment_questions`, `rubric_criteria`, and `rubric_levels`.
    5. Fetches `submissions`: parses `answers` JSON into `submission_answers`.
    6. Fetches `announcements`: parses `replies` JSON into `announcement_replies`.
    7. Fetches `discussions`: parses `replies` JSON into `discussion_replies`.

- [ ] **Step 2: Execute data unpacking script**
  - Run: `npx tsx scripts/unpack-likha-json-data.ts`
  - Verify script logs unpacking counts and confirms 0 errors.

- [ ] **Step 3: Run existing normalization test to verify data integrity**
  - Run: `npm test server/src/likha/migrations/normalizeLikhaRelationalData.test.ts`
  - Expected: PASS

- [ ] **Step 4: Commit unpacking script**
  - `git add scripts/unpack-likha-json-data.ts`
  - `git commit -m "feat(migration): implement and execute comprehensive Likha relational data unpacker"`

---

### Task 3: Client LMS Adapters & Context Harmonization

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts`
- Modify: `client/src/shared/context/LMSContext.tsx`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`
- Test: `client/src/shared/context/LMSContext.syllabus.test.tsx`

**Interfaces:**
- Consumes: Normalized Likha API endpoints `/items/syllabi`, `/items/announcements`, `/items/announcement_replies`, `/items/discussions`, `/items/discussion_replies`, `/items/notifications`.
- Produces: Seamless normalized Course, Syllabus, Activity, and Communication objects in LMSContext.

- [ ] **Step 1: Write failing test for relational syllabus and reply fetching**
  - Add test in `client/src/shared/api/likhaLmsApi.test.ts` testing `getSyllabus` with deep AST fields and `addAnnouncementReply` calling `/items/announcement_replies`.
  - Verify test fails before implementation if endpoints or query shapes differ.

- [ ] **Step 2: Update `client/src/shared/api/likhaLmsApi.ts`**
  - Implement:
    - `getSyllabus(courseId)` querying `/items/syllabi?filter[course_id][_eq]=...&fields=*,course_info.*,course_outcomes.*,learning_plans.*,policies.*`.
    - `getAnnouncements(courseId)` querying `/items/announcements?fields=*,replies.*,author_id.*`.
    - `getDiscussions(courseId)` querying `/items/discussions?fields=*,replies.*,author_id.*`.
    - `getNotifications(userId)` querying `/items/notifications?filter[user_id][_eq]=...`.
    - `addAnnouncementReply` posting to `/items/announcement_replies`.
    - `addDiscussionReply` posting to `/items/discussion_replies`.

- [ ] **Step 3: Update `client/src/shared/context/LMSContext.tsx`**
  - In `normalizeCourse`, synthesize course syllabus from relational `syllabus_id` / `syllabi` child record if raw JSON is absent.
  - In `normalizeAnnouncement`, synthesize `replies` from relational child records.
  - In `normalizeDiscussion`, synthesize `replies` from relational child records.

- [ ] **Step 4: Run client test suite**
  - Run: `npm test client/src/shared/api/likhaLmsApi.test.ts`
  - Run: `npm test client/src/shared/context/LMSContext.syllabus.test.tsx`
  - Expected: PASS

- [ ] **Step 5: Commit adapter and context changes**
  - `git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/shared/api/likhaLmsApi.test.ts`
  - `git commit -m "feat(client): harmonize likhaLmsApi and LMSContext with normalized relational endpoints"`

---

### Task 4: Complete Elimination of Legacy JSON Fields via Directus UI

**Files:**
- Visual Proof: `docs/superpowers/plans/likha_zero_json_verified.png`
- Documentation: `docs/superpowers/plans/2026-10-14-likha-erp-complete-relational-normalization-and-zero-json.md`

**Interfaces:**
- Consumes: Directus Data Studio collection field settings.
- Produces: Collections with zero JSON fields.

- [ ] **Step 1: Delete JSON fields from `courses` via Directus UI**
  - Using `browser_subagent`:
    - Open `/admin/settings/data-model/courses`.
    - Delete field `syllabus`.
    - Delete field `spr_config`.
    - Delete field `grading_terms`.
    - Delete field `grades_released`.

- [ ] **Step 2: Delete JSON fields from `activities`, `quizzes`, and `exams` via Directus UI**
  - Using `browser_subagent`:
    - In `activities`: delete `rubric` and `questions`.
    - In `quizzes`: delete `questions`.
    - In `exams`: delete `questions`.

- [ ] **Step 3: Delete JSON fields from `submissions` via Directus UI**
  - Using `browser_subagent`:
    - In `submissions`: delete `answers`, `rubric_scores`, `comments`.

- [ ] **Step 4: Delete JSON fields from `announcements`, `discussions`, `module_comments`, `chat_groups`, `syllabi`**
  - Using `browser_subagent`:
    - In `announcements`: delete `replies`, `likes`.
    - In `discussions`: delete `replies`.
    - In `module_comments`: delete `likes`.
    - In `chat_groups`: delete `member_ids`.
    - In `syllabi`: delete `content`.
    - In `course_grades`: delete `spr_cells` (if present).

- [ ] **Step 5: Capture visual proof and commit**
  - Capture screenshot of `courses` field list showing zero JSON fields.
  - Save to `docs/superpowers/plans/likha_zero_json_verified.png`.
  - Commit: `git add docs/superpowers/plans/likha_zero_json_verified.png; git commit -m "docs(verify): verify removal of all legacy JSON fields in Likha ERP"`

---

### Task 5: Zero-JSON Automated Audit & Full Platform Regression Testing

**Files:**
- Create: `scripts/verify-zero-json.ts`
- Modify: `task-full-likha-report.md`

**Interfaces:**
- Consumes: Likha ERP metadata `/fields`.
- Produces: Verified 0 JSON fields audit report + 100% test pass rate across 731 tests.

- [ ] **Step 1: Write and run `scripts/verify-zero-json.ts`**
  - Script fetches all fields from Directus across all collections.
  - Filters fields by `type === 'json'`.
  - Asserts count is exactly 0.
  - Run: `npx tsx scripts/verify-zero-json.ts`
  - Expected output: `SUCCESS: Zero JSON fields found across all Likha ERP collections.`

- [ ] **Step 2: Run server regression test suite**
  - Run: `npm test` on server
  - Expected: 51 / 51 files passed, 400 / 400 tests passed (100%).

- [ ] **Step 3: Run client regression test suite**
  - Run: `npm test -- --run` on client
  - Expected: 62 / 62 files passed, 331 / 331 tests passed (100%).

- [ ] **Step 4: Update canonical `task-full-likha-report.md`**
  - Document complete relational normalization, 5 feature folders, missing collections creation, and zero-JSON verification.

- [ ] **Step 5: Commit documentation and verification script**
  - `git add scripts/verify-zero-json.ts task-full-likha-report.md`
  - `git commit -m "chore(audit): verify zero JSON fields and document complete Likha relational normalization"`
