# Likha ERP (Directus) Relational Cascade Configuration Matrix

This document provides the exhaustive list of relationship constraints that must be configured in Likha ERP (`https://gabay.zyberlab.com/admin`) to support server-side relational cascade deletion, eliminating the need for client-side procedural multi-fetch deletion scripts.

---

## 1. Modules & Learning Items

| Collection (Child) | Field (Foreign Key) | Related Collection (Parent) | Action On Delete | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `module_items` | `module_id` | `modules` | **CASCADE** | Deleting a module deletes all its learning items |
| `module_comments` | `module_id` | `modules` | **CASCADE** | Deleting a module deletes all its comments |
| `modules` | `prerequisite_module_id` | `modules` | **SET NULL** | Deleting a prerequisite clears the reference on other modules |

---

## 2. Assessments (Activities, Quizzes, Exams)

| Collection (Child) | Field (Foreign Key) | Related Collection (Parent) | Action On Delete | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `assessment_questions` | `activity_id` | `activities` | **CASCADE** | Deleting activity cascades questions |
| `assessment_questions` | `quiz_id` | `quizzes` | **CASCADE** | Deleting quiz cascades questions |
| `assessment_questions` | `exam_id` | `exams` | **CASCADE** | Deleting exam cascades questions |
| `rubric_criteria` | `activity_id` | `activities` | **CASCADE** | Deleting activity cascades rubrics |
| `activities_files` | `activities_id` | `activities` | **CASCADE** | Deleting activity cascades file junctions |
| `submissions` | `activity_id` | `activities` | **CASCADE** | Deleting activity cascades submissions |
| `submissions` | `quiz_id` | `quizzes` | **CASCADE** | Deleting quiz cascades submissions |
| `submissions` | `exam_id` | `exams` | **CASCADE** | Deleting exam cascades submissions |
| `submission_answers` | `submission_id` | `submissions` | **CASCADE** | Deleting submission cascades answers |
| `submission_comments` | `submission_id` | `submissions` | **CASCADE** | Deleting submission cascades comments |
| `submission_rubric_scores` | `submission_id` | `submissions` | **CASCADE** | Deleting submission cascades rubric scores |

---

## 3. Communications & Social

| Collection (Child) | Field (Foreign Key) | Related Collection (Parent) | Action On Delete | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `announcement_replies` | `announcement_id` | `announcements` | **CASCADE** | Deleting announcement cascades replies |
| `discussion_replies` | `discussion_id` | `discussions` | **CASCADE** | Deleting discussion cascades replies |

---

## 4. Syllabi & Curriculum

| Collection (Child) | Field (Foreign Key) | Related Collection (Parent) | Action On Delete | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `syllabus_signatories` | `syllabus_id` | `syllabi` | **CASCADE** | Deleting syllabus cascades signatories |
| `syllabus_references` | `syllabus_id` | `syllabi` | **CASCADE** | Deleting syllabus cascades references |
| `syllabus_policies` | `syllabus_id` | `syllabi` | **CASCADE** | Deleting syllabus cascades policies |
| `syllabus_rubrics` | `syllabus_id` | `syllabi` | **CASCADE** | Deleting syllabus cascades rubrics |
| `syllabus_learning_plans` | `syllabus_id` | `syllabi` | **CASCADE** | Deleting syllabus cascades learning plans |
| `syllabus_course_maps` | `syllabus_id` | `syllabi` | **CASCADE** | Deleting syllabus cascades course maps |

---

## 5. Course-Level Relationships

| Collection (Child) | Field (Foreign Key) | Related Collection (Parent) | Action On Delete | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `modules` | `course_id` | `courses` | **CASCADE** | Deleting course cascades modules |
| `activities` | `course_id` | `courses` | **CASCADE** | Deleting course cascades activities |
| `quizzes` | `course_id` | `courses` | **CASCADE** | Deleting course cascades quizzes |
| `exams` | `course_id` | `courses` | **CASCADE** | Deleting course cascades exams |
| `syllabi` | `course_id` | `courses` | **CASCADE** | Deleting course cascades syllabi |
| `Course_Enrollments` | `course_id` | `courses` | **CASCADE** | Deleting course cascades enrollments |
| `course_grades` | `course_id` | `courses` | **CASCADE** | Deleting course cascades grades |
| `course_sections` | `course_id` | `courses` | **CASCADE** | Deleting course cascades sections |
| `course_files` | `course_id` | `courses` | **CASCADE** | Deleting course cascades course files |
| `course_folders` | `course_id` | `courses` | **CASCADE** | Deleting course cascades folders |
| `enrollment_requests` | `course_id` | `courses` | **CASCADE** | Deleting course cascades requests |
| `announcements` | `course_id` | `courses` | **CASCADE** | Deleting course cascades announcements |
| `discussions` | `course_id` | `courses` | **CASCADE** | Deleting course cascades discussions |
| `messages` | `course_id` | `courses` | **CASCADE** | Deleting course cascades chat messages |
| `chat_groups` | `course_id` | `courses` | **CASCADE** | Deleting course cascades chat groups |
| `calendar_events` | `course_id` | `courses` | **CASCADE** | Deleting course cascades calendar events |
| `spr_configs` | `course_id` | `courses` | **CASCADE** | Deleting course cascades SPR configs |
| `spr_cells` | `config_id` | `spr_configs` | **CASCADE** | Deleting SPR config cascades cells |

---

## How to Configure in Directus Admin

1. Open `https://gabay.zyberlab.com/admin` and sign in.
2. Go to **Settings > Data Model**.
3. For each child collection above, click on the specified foreign key field.
4. Navigate to the **Relationship** tab.
5. Under **"On Delete"**, select **CASCADE** (or **SET NULL** for prerequisite pointers).
6. Click the checkmark to save.
