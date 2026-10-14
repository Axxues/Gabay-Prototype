# Likha ERP Complete Relational Normalization & Zero-JSON Design

**Date:** October 14, 2026  
**Status:** Approved for Implementation Planning  
**Target Backend:** Likha ERP (`https://gabay.zyberlab.com`)  
**Compliance Directive:** `AGENTS.md` Zero-REST-DDL Rule (Browser Subagent / UI interactive execution for Directus schema mutations)

---

## 1. Executive Summary

This specification establishes the blueprint for **complete relational database normalization** across all Likha ERP LMS collections and the total elimination of all raw JSON fields.

### Core Objectives:
1. **Zero-JSON Architecture:** Completely eliminate every single `json` type field across all Likha ERP collections. Every nested structure (syllabus, rubrics, questions, replies, configs) will be normalized into true first-class relational collections and foreign key relationships.
2. **Missing Collections Creation:** Create the missing operational collections identified in the audit:
   - `announcement_replies`
   - `discussion_replies`
   - `notifications`
   - `submission_rubric_scores`
   - `submission_comments`
   - `chat_groups_directus_users` (M2M junction)
3. **Comprehensive Feature Folders:** Structure all 34+ Likha LMS collections into 5 logical feature folders:
   - 📁 `Academics & Courses` (`academics_courses`)
   - 📁 `Assessments & Grading` (`assessments_grading`)
   - 📁 `Communications` (`communications`)
   - 📁 `Enrollments & Access` (`enrollments_access`)
   - 📁 `Syllabus Management` (`syllabus_management`)
4. **Relational Data Unpacking Pipeline:** Automated script to unpack any active JSON data in courses, activities, submissions, and communications into their normalized relational child records before field removal.
5. **Harmonized Client Adapters:** Update `client/src/shared/api/likhaLmsApi.ts` and `client/src/shared/context/LMSContext.tsx` to read and write exclusively through relational AST queries and nested child endpoints.
6. **Zero-Downtime Standard:** Zero unhandled server crashes, zero 502 Bad Gateway errors, and 100% test pass rate across all 731 platform tests.

---

## 2. Directus Feature Folders & Collection Allocation

All collections will be partitioned into 5 feature folders in Directus Data Model:

### 2.1 📁 `Academics & Courses` (`academics_courses`)
- `courses`
- `course_sections`
- `course_folders`
- `course_files`
- `modules`
- `module_items`
- `module_comments`

### 2.2 📁 `Assessments & Grading` (`assessments_grading`)
- `activities`
- `activities_files`
- `assessment_questions`
- `quizzes`
- `exams`
- `submissions`
- `submission_answers`
- `submission_rubric_scores`
- `submission_comments`
- `course_grades`
- `course_grading_terms`
- `spr_cells`
- `spr_configs`
- `rubric_criteria`
- `rubric_levels`

### 2.3 📁 `Communications` (`communications`)
- `announcements`
- `announcements_files`
- `announcement_replies`
- `discussions`
- `discussion_replies`
- `notifications`
- `chat_groups`
- `chat_groups_directus_users`
- `messages`

### 2.4 📁 `Enrollments & Access` (`enrollments_access`)
- `Course_Enrollments`
- `enrollment_requests`
- `calendar_events`
- `advising_slots`

### 2.5 📁 `Syllabus Management` (`syllabus_management`)
- `syllabi`
- `syllabus_course_info`
- `syllabus_course_maps`
- `syllabus_course_outcomes`
- `syllabus_faculty`
- `syllabus_grading_systems`
- `syllabus_institution`
- `syllabus_learning_plans`
- `syllabus_policies`
- `syllabus_program_outcomes`
- `syllabus_references`
- `syllabus_rubrics`
- `syllabus_signatories`

---

## 3. Missing Collections Schema Specifications

The following collections will be created in Directus Data Model via `browser_subagent` (or assist user in Directus UI):

### 3.1 `announcement_replies`
- **Folder:** `communications`
- **Fields:**
  - `id`: UUID (Primary Key, generated automatically)
  - `announcement_id`: Many-to-One -> `announcements` (`id`)
  - `author_id`: Many-to-One -> `directus_users` (`id`)
  - `content`: Text (WYSIWYG or markdown)
  - `created_at`: DateTime (Timestamp)

### 3.2 `discussion_replies`
- **Folder:** `communications`
- **Fields:**
  - `id`: UUID (Primary Key, generated automatically)
  - `discussion_id`: Many-to-One -> `discussions` (`id`)
  - `author_id`: Many-to-One -> `directus_users` (`id`)
  - `content`: Text (WYSIWYG or markdown)
  - `created_at`: DateTime (Timestamp)

### 3.3 `notifications`
- **Folder:** `communications`
- **Fields:**
  - `id`: UUID (Primary Key, generated automatically)
  - `user_id`: Many-to-One -> `directus_users` (`id`)
  - `title`: String (VARCHAR 255)
  - `message`: Text
  - `type`: String (VARCHAR 50: `announcement`, `grade`, `submission`, `reminder`, `system`)
  - `link`: String (VARCHAR 255)
  - `is_read`: Boolean (default: false)
  - `created_at`: DateTime (Timestamp)

### 3.4 `submission_rubric_scores`
- **Folder:** `assessments_grading`
- **Fields:**
  - `id`: UUID (Primary Key, generated automatically)
  - `submission_id`: Many-to-One -> `submissions` (`id`)
  - `criterion_id`: Many-to-One -> `rubric_criteria` (`id`)
  - `points_awarded`: Float / Decimal
  - `feedback`: Text

### 3.5 `submission_comments`
- **Folder:** `assessments_grading`
- **Fields:**
  - `id`: UUID (Primary Key, generated automatically)
  - `submission_id`: Many-to-One -> `submissions` (`id`)
  - `author_id`: Many-to-One -> `directus_users` (`id`)
  - `content`: Text
  - `created_at`: DateTime (Timestamp)

### 3.6 `chat_groups_directus_users`
- **Folder:** `communications`
- **Fields:**
  - `id`: Integer or UUID (Primary Key)
  - `chat_group_id`: Many-to-One -> `chat_groups` (`id`)
  - `directus_user_id`: Many-to-One -> `directus_users` (`id`)

---

## 4. Complete JSON Fields Elimination Matrix

Every legacy JSON field will be mapped to a normalized relational structure and subsequently deleted from Likha ERP:

| Collection | Legacy JSON Field | Relational Replacement Target | Post-Migration Action |
|---|---|---|---|
| `courses` | `syllabus` | Relational M2O `syllabus_id` -> `syllabi` (with child tables `syllabus_course_info`, `syllabus_course_outcomes`, `syllabus_learning_plans`, `syllabus_policies`, etc.) | **DELETE `courses.syllabus`** |
| `courses` | `spr_config` | Relational M2O `spr_config_id` -> `spr_configs` (or O2M from `spr_configs.course_id`) | **DELETE `courses.spr_config`** |
| `courses` | `grading_terms` | Relational O2M `course_grading_terms` (`course_id`) | **DELETE `courses.grading_terms`** |
| `courses` | `grades_released` | Explicit booleans `midterm_grades_released` and `final_grades_released` | **DELETE `courses.grades_released`** |
| `activities` | `rubric` | Relational O2M `rubric_criteria` (`activity_id`) & `rubric_levels` (`criterion_id`) | **DELETE `activities.rubric`** |
| `activities` | `questions` | Relational O2M `assessment_questions` (`activity_id`) | **DELETE `activities.questions`** |
| `quizzes` | `questions` | Relational O2M `assessment_questions` (`quiz_id`) | **DELETE `quizzes.questions`** |
| `exams` | `questions` | Relational O2M `assessment_questions` (`exam_id`) | **DELETE `exams.questions`** |
| `submissions` | `answers` | Relational O2M `submission_answers` (`submission_id`) | **DELETE `submissions.answers`** |
| `submissions` | `rubric_scores` | Relational O2M `submission_rubric_scores` (`submission_id`) | **DELETE `submissions.rubric_scores`** |
| `submissions` | `comments` | Relational O2M `submission_comments` (`submission_id`) | **DELETE `submissions.comments`** |
| `announcements` | `replies` | Relational O2M `announcement_replies` (`announcement_id`) | **DELETE `announcements.replies`** |
| `announcements` | `likes` | Integer count `likes_count` + normalized `announcement_likes` | **DELETE `announcements.likes`** |
| `discussions` | `replies` | Relational O2M `discussion_replies` (`discussion_id`) | **DELETE `discussions.replies`** |
| `module_comments` | `likes` | Integer count `likes_count` + normalized `module_comment_likes` | **DELETE `module_comments.likes`** |
| `chat_groups` | `member_ids` | Relational M2M junction `chat_groups_directus_users` | **DELETE `chat_groups.member_ids`** |
| `syllabi` | `content` | Redundant monolithic JSON: all data stored across 13 `syllabus_*` tables | **DELETE `syllabi.content`** |
| `course_grades` | `spr_cells` | Relational O2M `spr_cells` (`course_grade_id`) | **DELETE `course_grades.spr_cells`** |

---

## 5. Migration & Data Unpacking Pipeline

To preserve data integrity before deleting JSON fields, the unpacking script [`scripts/unpack-likha-json-data.ts`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/scripts/unpack-likha-json-data.ts) will execute the following:

1. **Course Syllabus Unpacking:**
   - Iterate each course with non-empty `syllabus` JSON.
   - If no corresponding `syllabi` record exists, create one with `course_id = course.id`.
   - Populate `syllabus_course_info` with `courseCode`, `courseTitle`, `credits`, `courseDescription`.
   - Populate `syllabus_institution` with `vision`, `mission`.
   - Populate `syllabus_course_outcomes` with each `courseOutcome` item (`code`, `statement`).
   - Populate `syllabus_learning_plans` with each `learningPlan` item (`week`, `topic`, `teachingActivities`).
   - Populate `syllabus_policies` with each `policy` item (`title`, `description`).
   - Link `courses.syllabus_id = syllabi.id`.
2. **Activity & Assessment Unpacking:**
   - Iterate activities with `rubric` JSON -> insert into `rubric_criteria` and `rubric_levels`.
   - Iterate activities/quizzes/exams with `questions` JSON -> insert into `assessment_questions`.
3. **Submissions Unpacking:**
   - Iterate submissions with `answers` JSON -> insert into `submission_answers`.
4. **Communications Unpacking:**
   - Iterate announcements with `replies` JSON -> insert into `announcement_replies`.
   - Iterate discussions with `replies` JSON -> insert into `discussion_replies`.

---

## 6. Client Adapters & LMSContext Harmonization

1. **API Client (`client/src/shared/api/likhaLmsApi.ts`):**
   - Query syllabus via relational AST:
     `fields=*,course_info.*,course_outcomes.*,learning_plans.*,policies.*,institution.*,grading_systems.*`
   - Query announcements and discussions with deep relational child replies:
     `fields=*,replies.*,author_id.id,author_id.first_name,author_id.last_name,author_id.avatar`
   - Native CRUD methods for `notifications`, `submission_rubric_scores`, `submission_comments`.
2. **Context Normalizers (`client/src/shared/context/LMSContext.tsx`):**
   - Update `normalizeCourse` to synthesize the course syllabus object from relational child records if queried, ensuring existing components (`CourseSyllabus`, `SyllabusEditor`, `CourseCard`) continue rendering seamlessly without changes to UI logic.

---

## 7. Zero-JSON Audit & Verification Standard

1. **Automated Zero-JSON Schema Audit:**
   - Run verification script [`scripts/verify-zero-json.ts`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/scripts/verify-zero-json.ts) querying `/fields` metadata from Directus.
   - **Pass Criterion:** The number of fields with `type === 'json'` across all LMS collections must be **EXACTLY 0**.
2. **Full Platform Regression Suite:**
   - `npm test` on server (51 files, 400 tests).
   - `npm test` on client (62 files, 331 tests).
   - **Pass Criterion:** 100% pass rate across all 731 tests.
3. **Visual Confirmation:**
   - Screenshot of Directus Data Model showing the 5 feature folders and all collections neatly nested.
