# Design Specification: Likha ERP True Backend & Automation Engine for Gabay LMS

**Date:** 2026-10-13  
**Status:** Approved  
**Topic:** Establishing Likha ERP as the True Backend and Automation Engine of Gabay  
**Target:** Likha ERP (`https://gabay.zyberlab.com`) & Gabay Client/Server

---

## 1. Overview & Goals

The goal of this architectural transformation is to turn Likha ERP into the single source of truth, true backend, and event-driven automation engine for the Gabay Learning Management System (LMS). 

### Key Objectives
1. **Full Relational Schema Modeling:** Register native Directus One-to-Many (`O2M`), Many-to-One (`M2O`), and file relationships across all LMS collections, enabling deep nested querying (`?fields=*,activities.*,modules.items.*`).
2. **Rich Directus UI Fields & Interfaces:** Configure rich text (WYSIWYG/Markdown), ISO Datetime pickers, status toggles, dropdown selection fields, and Directus native file/image assets.
3. **Likha ERP Automation Flows:** Implement 4 core event-driven Flows directly in Likha ERP using Event Hooks, Webhooks, CRON schedules, and operations (`read`, `create`, `update`, `run-script`, `condition`).
4. **Direct-to-Likha Client Integration:** Gabay web client connects directly to Likha ERP for all LMS data, user authentication, and file storage, retiring duplicate Express CRUD proxy routes.
5. **Decoupled Express RAG Microservice:** The Express server is retained purely as a specialized microservice on port 4001 for RAG vector retrieval, n8n webhook telemetry, and benchmark evaluation.

---

## 2. Architecture & Data Flow

```
                      +---------------------------------------+
                      |          Gabay Web Client             |
                      |     (React 19 + Vite Frontend)        |
                      +-------------------+-------------------+
                                          |
                +-------------------------+-------------------------+
                | Direct LMS Operations                             | Dedicated RAG &
                | (Auth, CRUD, Files,                               | Benchmarking
                | Deep Relational Queries)                          |
                v                                                   v
+-------------------------------+                   +-------------------------------+
|       Likha ERP Backend       |                   |    Express RAG Microservice   |
|   (Directus on Zyberlab)      |                   |          (Port 4001)          |
|-------------------------------|                   |-------------------------------|
| - 44 Relational Collections   |                   | - /api/rag (n8n Webhook Proxy)|
| - Native /files Cloud Storage |                   | - /api/rag-aggregate (Eval)   |
| - Directus Authentication     |                   | - /api/rag-baseline (Eval)    |
| - 4 Event-Driven Flows:       |                   | - n8n Execution Telemetry     |
|   * Notification Publishing   |                   +-------------------------------+
|   * Submission SPR Auto-Grade |
|   * Enrollment Alerts         |
|   * Due Date CRON Reminders   |
+-------------------------------+
```

---

## 3. Relational Schema & UI Presentation Configuration

### 3.1 Relational Relationships (`/relations`)

We establish the following Directus foreign key and relational junction definitions:

| Parent Collection | Relation Type | Child Collection | Foreign Key Field | Nested Query Field Name |
|---|---|---|---|---|
| `courses` | O2M / M2O | `activities` | `course_id` | `courses.activities` |
| `courses` | O2M / M2O | `modules` | `course_id` | `courses.modules` |
| `modules` | O2M / M2O | `module_items` | `module_id` | `modules.items` |
| `courses` | O2M / M2O | `course_files` | `course_id` | `courses.course_files` |
| `courses` | O2M / M2O | `course_grades` | `course_id` | `courses.course_grades` |
| `courses` | O2M / M2O | `syllabi` | `course_id` | `courses.syllabi` |
| `courses` | M2O | `directus_users` | `instructor_id` | `courses.instructor_id` |
| `activities` | O2M / M2O | `assessment_questions` | `activity_id` | `activities.questions` |
| `activities` | O2M / M2O | `rubric_criteria` | `activity_id` | `activities.rubrics` |
| `rubric_criteria` | O2M / M2O | `rubric_levels` | `criterion_id` | `rubric_criteria.levels` |
| `activities` | O2M / M2O | `submissions` | `activity_id` | `activities.submissions` |
| `submissions` | O2M / M2O | `submission_answers` | `submission_id` | `submissions.answers` |
| `submissions` | M2O | `directus_users` | `student_id` | `submissions.student_id` |
| `course_grades` | O2M / M2O | `spr_cells` | `course_grade_id` | `course_grades.spr_cells` |
| `syllabi` | O2M / M2O | `syllabus_learning_plans` | `syllabus_id` | `syllabi.learning_plans` |
| `syllabi` | O2M / M2O | `syllabus_course_maps` | `syllabus_id` | `syllabi.course_maps` |
| `syllabi` | O2M / M2O | `syllabus_rubrics` | `syllabus_id` | `syllabi.rubrics` |
| `syllabi` | O2M / M2O | `syllabus_policies` | `syllabus_id` | `syllabi.policies` |
| `syllabi` | O2M / M2O | `syllabus_references` | `syllabus_id` | `syllabi.references` |
| `syllabi` | O2M / M2O | `syllabus_signatories` | `syllabus_id` | `syllabi.signatories` |

### 3.2 Cloud File & Asset Relationships
* `activities.attachment_file_id` $\rightarrow$ `directus_files.id` (M2O)
* `submissions.attachment_file_id` $\rightarrow$ `directus_files.id` (M2O)
* `courses.cover_image` $\rightarrow$ `directus_files.id` (M2O)
* `course_files.directus_file_id` $\rightarrow$ `directus_files.id` (M2O)
* `syllabi.document_file_id` $\rightarrow$ `directus_files.id` (M2O)

### 3.3 UI Field Presentation Metadata
* **Rich Text / WYSIWYG:** `activities.description`, `announcements.content`, `syllabus_policies.content` configured with `meta.interface = 'input-rich-text-html'`.
* **Selection / Dropdowns:** `activities.category` (`assignment`, `quiz`, `exam`, `project`), `activities.term` (`prelim`, `midterm`, `finals`), `activities.format` configured with `meta.interface = 'select-dropdown'`.
* **Switches:** `published`, `is_released` configured with `meta.interface = 'boolean'`.
* **Datetimes:** `activities.due_date`, `available_from`, `available_until` configured with `meta.interface = 'datetime'`.

---

## 4. Likha ERP Automation Engine (Flows & Operations)

### Flow 1: Academic Notifications on Activity / Announcement Publish
* **ID:** `flow-gabay-publish-notify`
* **Trigger:** `event` (Event Hook) on `activities` and `announcements` on action `items.create`, `items.update`.
* **Filter:** `payload.published = true`.
* **Operations:**
  1. `read_enrollments`: Read `enrollment_requests` for course `{{ $trigger.payload.course_id }}` where `status = 'approved'`.
  2. `format_notifications`: Run script to transform student IDs into notification payloads.
  3. `create_notifications`: Create data in `notifications`.

### Flow 2: Automated Submission Grading & SPR Aggregation
* **ID:** `flow-gabay-submission-spr`
* **Trigger:** `event` on `submissions` on action `items.update`.
* **Filter:** `$trigger.payload.score` is set and status is `'graded'`.
* **Operations:**
  1. `read_activity`: Query parent activity (`total_points`, `term`, `category`, `course_id`).
  2. `compute_spr`: Calculate percentage and determine component key.
  3. `upsert_spr_cell`: Insert/update `spr_cells` row for `(student_id, course_id, term, cell_key)`.
  4. `update_course_grade`: Recalculate and update student's average in `course_grades`.

### Flow 3: Course Enrollment Processing & Faculty Alert
* **ID:** `flow-gabay-enrollment-alert`
* **Trigger:** `event` on `enrollment_requests` on action `items.create`.
* **Operations:**
  1. `read_course`: Read instructor ID and course title.
  2. `alert_instructor`: Create notification for instructor.
  3. `auto_approve_check`: If open course enrollment, update status to `'approved'`.

### Flow 4: Scheduled Due Date Reminder
* **ID:** `flow-gabay-due-date-cron`
* **Trigger:** `schedule` (CRON `0 */6 * * *` — every 6 hours).
* **Operations:**
  1. `find_impending_activities`: Query activities where `due_date >= $now` and `due_date <= $now + 24 hours` and `published = true`.
  2. `find_pending_students`: Query students with no submission for those activities.
  3. `dispatch_reminders`: Create urgent warning notifications in `notifications`.

---

## 5. Client Direct-to-Likha Integration

### 5.1 Direct Authentication
* Client signs in directly via `POST ${LIKHA_URL}/auth/login`.
* Access token stored in local auth state; header `Authorization: Bearer <token>` dispatched with each request.
* Profile retrieved from `GET ${LIKHA_URL}/users/me?fields=*,role.*`.

### 5.2 Deep Relational Single-Query Hydration
* Client consumes Directus REST API with nested relations:
  * Course view: `GET ${LIKHA_URL}/items/courses/${id}?fields=*,activities.*,modules.*,modules.items.*,course_files.*`
  * Gradebook view: `GET ${LIKHA_URL}/items/course_grades?filter[course_id][_eq]=${id}&fields=*,spr_cells.*,student_id.*`
  * Syllabus view: `GET ${LIKHA_URL}/items/syllabi?filter[course_id][_eq]=${id}&fields=*,learning_plans.*,course_maps.*,rubrics.*,policies.*,references.*,signatories.*`

### 5.3 Direct Cloud File Uploads
* Files posted via `POST ${LIKHA_URL}/files` with `multipart/form-data`.
* Asset URLs referenced directly as `${LIKHA_URL}/assets/:id` with public read permissions.

---

## 6. Express Microservice Role

* Express runs on `port 4001` strictly for:
  * `POST /api/rag`: n8n agent workflow execution & telemetry parsing.
  * `POST /api/rag-aggregate`: Natural language analytical aggregation.
  * `POST /api/rag-baseline`: 140/155 test query benchmark suite.
* Generic CRUD routes for courses, modules, activities, submissions, and users are disabled/retired from Express to enforce Likha ERP as the single true backend.

---

## 7. Migration & Testing Plan

### 7.1 Automated Migration Script (`initLikhaRelationalAndFlows.ts`)
* Idempotent script connecting with admin credentials:
  1. Ensures all Directus `/relations` exist.
  2. Updates `/fields` with UI interface types.
  3. Provisions `/flows` and `/operations`.

### 7.2 Verification Suites
1. **Likha Schema & Flows Integration Test:**
   * Verify deep nested queries return child relations without separate API requests.
   * Verify creating/publishing an activity triggers Flow 1 (notifications generated).
   * Verify updating a submission score triggers Flow 2 (`spr_cells` updated).
2. **Client Vitest Suite:**
   * All 60 test suites (320 tests) pass with updated direct Likha contracts.
3. **Server RAG Vitest Suite:**
   * All RAG microservice tests pass with 100% green coverage.
4. **Browser Subagent Journey Verification:**
   * Live browser test: Login $\rightarrow$ Course Dashboard $\rightarrow$ Create Activity $\rightarrow$ Verify Automated Notification $\rightarrow$ Student Submission $\rightarrow$ Grading & SPR Calculation $\rightarrow$ File and Syllabus View.
