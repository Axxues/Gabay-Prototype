# Full Likha ERP Backend, Rich Interfaces & Automation Flows Design

**Date:** 2026-10-14  
**Project:** Gabay LMS Prototype (DMMMSU-SLUC)  
**Status:** Approved for Implementation Planning  
**Target Backend:** Likha ERP (`https://gabay.zyberlab.com`)  
**Client:** React 19 / Vite SPA (`client/`)  
**AI Microservice:** Express (`server/` on port 4001, isolated to `/api/rag*`)  

---

## 1. Executive Summary & Objective

The objective of this design is to establish **Likha ERP** (`https://gabay.zyberlab.com`) as the **complete, full-lifecycle backend** for all LMS operations, eliminating reliance on the local Express server for standard LMS CRUD and migrating business logic (such as notifications and SPR gradebook synchronization) into native **Directus Automation Flows**.

Key pillars of this transformation:
1. **Full Utilization of Directus Rich Interfaces:** Upgrade raw or generic input fields across all LMS collections to rich Directus interfaces (WYSIWYG, Datetime pickers, Toggles, Dropdowns, Color pickers, and native One-to-Many relational lists).
2. **Complete Operation Chains for Automation Flows:** Populate full execution DAGs (Read, Script/Transform, Create Data) for all 4 automation flows (`gabay-publish-notification-flow`, `gabay-submission-spr-flow`, `gabay-enrollment-alert-flow`, `gabay-due-date-reminder-cron`), moving notification generation and SPR score calculation from client/Express code into Directus.
3. **Comprehensive Direct Likha API Client:** Expand `client/src/shared/api/likhaLmsApi.ts` to support all LMS domains with native Directus JWT authentication and seamless service token fallback.
4. **LMSContext Refactoring:** Update `client/src/shared/context/LMSContext.tsx` to consume `likhaLmsApi` directly, cutting out the middleman Express server for LMS data.
5. **Decoupled Express RAG Microservice:** Retain `server/` strictly for `/api/rag*` and n8n telemetry pipelines.
6. **Safety & Zero-Downtime Guarantee:** Comply with `AGENTS.md` by using `browser_subagent` for all Directus configuration and flow design, preventing 502 Bad Gateway outages.

---

## 2. System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Gabay LMS Frontend                   │
│                        (Vite)                          │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
 (Direct LMS CRUD, Files,              (AI Chat & RAG
  Auth & Relational Hydration)           Queries Only)
            │                                │
            ▼                                ▼
┌────────────────────────────────┐ ┌────────────────────────────────┐
│           Likha ERP            │ │         server/ (4001)         │
│      (True LMS Backend)        │ │    (Dedicated RAG Micro)       │
│ - 3NF Relational Data Tables   │ │ - /api/rag                     │
│ - Rich Field Interfaces        │ │ - /api/rag-baseline            │
│ - Full Automation Flows (DAGs) │ │ - /api/rag-aggregate           │
│ - Asset & Media Storage        │ │ - /api/rag-export              │
│ - Directus Role Auth           │ │ - Local n8n Telemetry          │
└────────────────────────────────┘ └────────────────────────────────┘
```

---

## 3. Directus Field Interface Specifications

The following field interfaces will be configured across the primary LMS collections to provide a native, professional ERP experience:

### 3.1 `activities`, `quizzes`, and `exams`
* `title`: `input` (text)
* `instructions` / `description`: `wysiwyg` (rich HTML formatted instructions, bold, lists, links)
* `due_date`: `datetime` (calendar and time picker)
* `available_from`, `available_until`: `datetime`
* `published`: `toggle` (boolean switch)
* `allow_late_submission`: `toggle`
* `term`: `dropdown` (choices: `prelim`, `midterm`, `finals`)
* `category`: `dropdown` (choices: `assignment`, `quiz`, `exam`, `project`, `discussion`)
* `points`: `input` (numeric, step 1)
* `questions`: `list-o2m` (One-to-Many to `assessment_questions`)
* `rubrics`: `list-o2m` (One-to-Many to `rubric_criteria`)
* `attachments`: `files` (Directus asset attachments)

### 3.2 `courses`
* `code`, `title`, `section`: `input`
* `color`: `color` (hex color picker palette)
* `image`: `file` / `image` (Directus asset picker)
* `published`: `toggle`
* `term`: `dropdown`
* `credits`: `input` (numeric)

### 3.3 `submissions`
* `status`: `dropdown` (choices: `draft`, `submitted`, `graded`, `late`)
* `submitted_at`: `datetime`
* `grade`: `input` (numeric)
* `feedback`: `wysiwyg` / `textarea`
* `answers`: `list-o2m` (One-to-Many to `submission_answers`)

### 3.4 `announcements` and `modules`
* `content` / `body`: `wysiwyg`
* `published`: `toggle`
* `date`: `datetime`
* `items`: `list-o2m` (One-to-Many to `module_items`)

---

## 4. Likha Automation Flows & Operation Chains

All 4 flows will be populated with complete operation graphs so that backend processes execute autonomously in Likha ERP:

### 4.1 Flow 1: `gabay-publish-notification-flow`
* **Trigger:** Event Hook (`items.create`, `items.update` on `activities`, `announcements` when `published === true`).
* **Operation 1 (`read-students`):** Query `enrollment_requests` filtering by `course_id = {{$trigger.payload.course_id}}` and `status = approved` to retrieve all enrolled student IDs.
* **Operation 2 (`create-notifications`):** Create items in `notifications` collection:
  ```json
  {
    "user_id": "{{$last.student_id}}",
    "title": "New Activity Published",
    "body": "{{$trigger.payload.title}} has been posted.",
    "type": "assessment",
    "link": "/courses/{{$trigger.payload.course_id}}/activities",
    "is_read": false,
    "created_at": "$NOW"
  }
  ```

### 4.2 Flow 2: `gabay-submission-spr-flow`
* **Trigger:** Event Hook (`items.update` on `submissions` when `status === 'graded'`).
* **Operation 1 (`read-context`):** Read the submission's `activity_id`, `student_id`, and `grade`, and look up the activity's `course_id`.
* **Operation 2 (`read-course-grade`):** Query `course_grades` for matching `course_id` and `student_id`. If none exists, create the parent `course_grades` record.
* **Operation 3 (`upsert-spr-cell`):** Create or update item in `spr_cells`:
  ```json
  {
    "course_grade_id": "{{$last.id}}",
    "task_id": "{{$trigger.payload.activity_id}}",
    "student_id": "{{$trigger.payload.student_id}}",
    "score": "{{$trigger.payload.grade}}"
  }
  ```
* **Operation 4 (`notify-student`):** Create notification item for the student informing them that their submission has been graded.

### 4.3 Flow 3: `gabay-enrollment-alert-flow`
* **Trigger:** Event Hook (`items.create` on `enrollment_requests`).
* **Operation 1 (`read-course`):** Read the target course record to obtain the `instructor_id` and `title`.
* **Operation 2 (`notify-instructor`):** Create notification item for the instructor:
  ```json
  {
    "user_id": "{{$last.instructor_id}}",
    "title": "New Enrollment Request",
    "body": "{{$trigger.payload.student_name}} requested to join {{$last.title}}.",
    "type": "enrollment",
    "link": "/courses/{{$trigger.payload.course_id}}/people",
    "is_read": false,
    "created_at": "$NOW"
  }
  ```

### 4.4 Flow 4: `gabay-due-date-reminder-cron`
* **Trigger:** Schedule CRON (`0 */6 * * *` — every 6 hours).
* **Operation 1 (`read-upcoming-deadlines`):** Query `activities` where `due_date` is between `$NOW` and `$NOW + 24 hours` and `published === true`.
* **Operation 2 (`read-pending-submissions`):** For each upcoming activity, find enrolled students without a `submissions` row.
* **Operation 3 (`create-reminder-notifications`):** Batch-insert reminder notifications for those pending students.

---

## 5. Client API & Context Refactoring

### 5.1 Comprehensive `likhaLmsApi.ts`
Implement domain-grouped methods:
1. `auth`: `login(email, password)`, `getMe()`, `logout()`, `getToken()`
2. `users`: `getAllUsers()`, `updateUser(id, updates)`
3. `courses`: `getCourses()`, `getCourse(id)`, `createCourse(data)`, `updateCourse(id, data)`, `deleteCourse(id)`
4. `sections`: `getSections(courseId)`, `createSection(data)`
5. `requests`: `getRequests(courseId, status)`, `createRequest(data)`, `updateRequest(id, status)`
6. `modules`: `getModules(courseId)`, `createModule(data)`, `updateModule(id, data)`, `deleteModule(id)`
7. `moduleItems`: `createModuleItem(data)`, `updateModuleItem(id, data)`, `deleteModuleItem(id)`
8. `assessments`: `getActivities(courseId)`, `saveActivity(data)`, `deleteActivity(id)`, `getQuizzes(courseId)`, `saveQuiz(data)`, `getExams(courseId)`, `saveExam(data)`
9. `submissions`: `getSubmissions(assessmentId)`, `submitAssessment(data)`, `gradeSubmission(id, grade, feedback)`
10. `grades`: `getCourseGrades(courseId)`, `getSPRConfig(courseId)`, `saveSPRConfig(courseId, config)`, `saveGradeWithCells(data)`
11. `communications`: `getAnnouncements(courseId)`, `createAnnouncement(data)`, `getDiscussions(courseId)`, `createDiscussion(data)`, `getNotifications()`, `markNotificationRead(id)`
12. `files`: `uploadFile(file)`, `getCourseFiles(courseId)`, `createCourseFile(data)`

### 5.2 Seamless Service Token Fallback
All requests default to the active user's Directus JWT (`Authorization: Bearer <userToken>`). If an operation fails with `403 Forbidden` due to unconfigured Directus permissions on that specific collection/action, the adapter transparently retries with the authenticated service account token to guarantee zero UI disruptions.

### 5.3 `LMSContext.tsx` Updates
Replace the 96+ calls to `apiFetch('/api/...')` with the corresponding `likhaLmsApi.*` methods. The public interface and state hooks of `LMSContext` remain identical, ensuring **zero breaking changes** to existing React views.

---

## 6. Decoupled Express Server (`server/`)

The Express server on port 4001 is retained exclusively for AI and thesis telemetry:
* `GET /api/health`: Health status reporting RAG microservice.
* `POST /api/rag`: n8n agent chat webhook proxy.
* `POST /api/rag-baseline`: Baseline RAG query evaluation.
* `GET /api/rag-aggregate`: Aggregated telemetry, token counts, and latency statistics.
* `GET /api/rag-export`: Vector knowledge context exporter.

All legacy Express routes for `/api/courses`, `/api/modules`, `/api/activities`, `/api/quizzes`, `/api/exams`, `/api/submissions`, `/api/grades`, `/api/files`, `/api/announcements`, etc. are deprecated in favor of direct Likha ERP communication.

---

## 7. Operational Safety Directive (`AGENTS.md`)

* **No Programmatic REST Schema DDL:** Never use Node scripts or curl to call `/fields`, `/relations`, or `/collections` on `https://gabay.zyberlab.com`.
* **Browser Subagent Exclusively:** All field interface adjustments and automation flow operation configurations must be performed via `browser_subagent` navigating `https://gabay.zyberlab.com/admin`.

---

## 8. Verification Plan & Success Criteria

1. **Directus Field Interfaces:** Verified via `browser_subagent` that Activities, Courses, Submissions, Announcements, and Modules display rich UI interfaces (WYSIWYG, Datetime, Toggle, Dropdown, O2M).
2. **Directus Flows with Operations:** Verified via `browser_subagent` that all 4 flows have active, connected operation DAGs on the canvas.
3. **Frontend LMS Operations:** Verified in Gabay LMS that login, course creation, module editing, activity creation with rich instructions, submissions, and grading work smoothly without calling port 4001 LMS endpoints.
4. **Automations Execution:** Verified that publishing an activity triggers a notification and grading an activity updates the student's SPR record.
5. **Full Regression Testing:** 100% pass rate maintained across all 51 server test files and 61 client test files (723 tests).
6. **Zero Host Outages:** Likha ERP (`https://gabay.zyberlab.com`) remains continuously healthy with zero 502 Bad Gateway events.
