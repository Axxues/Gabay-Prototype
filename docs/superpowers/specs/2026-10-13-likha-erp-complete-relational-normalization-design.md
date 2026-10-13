# Design Spec: Likha ERP Complete Relational Normalization & Native Directus O2M Interfaces

**Status:** Approved  
**Date:** October 13, 2026  
**Topic:** Complete 3NF relational normalization and Directus UI One-to-Many interface configuration across Likha ERP  
**Location:** `docs/superpowers/specs/2026-10-13-likha-erp-complete-relational-normalization-design.md`  

---

## 1. Context & Motivation

During initial deployment of Likha ERP (`https://gabay.zyberlab.com`), physical database columns of type `json` remained on several parent collections (`activities.questions`, `activities.rubric`, `quizzes.questions`, `exams.questions`, `submissions.answers`, `course_grades.spr_cells`).

When viewing records in the Likha ERP Admin UI (e.g. Editing an Item in `Activities`), Directus prioritized the physical `json` columns and rendered raw code editor inputs (`input-code`) displaying stringified JSON arrays (e.g. `["q-act-mv5rdrq0-0", ...]` and `[{"title": "Technical Accuracy", "max_points": 60}]`) instead of native relational tables.

This document specifies the complete 3NF normalization:
1. Migrating and unpacking all legacy JSON data into dedicated child collections.
2. Dropping redundant physical JSON columns in Postgres/Directus.
3. Registering native Directus One-to-Many (`list-o2m`) alias fields with customized table views, inline creation modals, and reordering.
4. Harmonizing server repositories and client API queries to operate exclusively with deep-nested relational queries (`fields=*,questions.*,rubrics.*,answers.*`).

---

## 2. Normalization & Field Migration Matrix

| Parent Collection | Legacy Physical Field | Target Relational Collection | Foreign Key Column | Directus One-to-Many Alias Field | Interface & Display Template |
|---|---|---|---|---|---|
| `activities` | `questions` (json) | `assessment_questions` | `activity_id` | `questions` (`alias`, `special: ["o2m"]`) | `list-o2m`: `{{question_type}}: {{question_text}} ({{points}} pts)` |
| `activities` | `rubric` (json) | `rubric_criteria` | `activity_id` | `rubric` (`alias`, `special: ["o2m"]`) | `list-o2m`: `{{title}} — {{max_points}} pts` |
| `quizzes` | `questions` (json) | `assessment_questions` | `quiz_id` | `questions` (`alias`, `special: ["o2m"]`) | `list-o2m`: `{{question_type}}: {{question_text}} ({{points}} pts)` |
| `exams` | `questions` (json) | `assessment_questions` | `exam_id` | `questions` (`alias`, `special: ["o2m"]`) | `list-o2m`: `{{question_type}}: {{question_text}} ({{points}} pts)` |
| `submissions` | `answers` (json) | `submission_answers` | `submission_id` | `answers` (`alias`, `special: ["o2m"]`) | `list-o2m`: `Q: {{question_id}} -> {{student_answer}} ({{awarded_points}} pts)` |
| `course_grades` | `spr_cells` (json) | `spr_cells` | `course_grade_id` | `spr_cells` (`alias`, `special: ["o2m"]`) | `list-o2m`: `{{term}} / {{component_key}}: {{score}}` |

---

## 3. Directus UI Presentation Specification

For each parent collection, the Directus One-to-Many field will be configured with the following UI presentation metadata:

### 3.1. `activities.questions`
- **Field Type:** `alias` with `meta.special = ["o2m"]`
- **Interface:** `list-o2m`
- **Table Columns:** `order`, `question_text`, `question_type`, `points`
- **Options:**
  - `enableCreate`: `true`
  - `enableSelect`: `false` (each question is owned by its activity)
  - `sortField`: `order`
- **Item Form Modal:** Opens inline drawer to edit question text, type (essay / multiple_choice / short_answer), points, options, and correct answer.

### 3.2. `activities.rubric`
- **Field Type:** `alias` with `meta.special = ["o2m"]`
- **Interface:** `list-o2m`
- **Table Columns:** `order`, `title`, `max_points`, `description`
- **Options:**
  - `enableCreate`: `true`
  - `sortField`: `order`
- **Item Form Modal:** Opens inline drawer to edit criterion title, description, max points, and nested `rubric_levels` (`levels` O2M).

### 3.3. `quizzes.questions` & `exams.questions`
- **Field Type:** `alias` with `meta.special = ["o2m"]`
- **Interface:** `list-o2m`
- **Table Columns:** `order`, `question_text`, `question_type`, `points`
- **Options:**
  - `enableCreate`: `true`
  - `sortField`: `order`

### 3.4. `submissions.answers`
- **Field Type:** `alias` with `meta.special = ["o2m"]`
- **Interface:** `list-o2m`
- **Table Columns:** `question_id`, `student_answer`, `awarded_points`, `feedback`

---

## 4. Repository & Client API Harmonization

### 4.1. Server Repository Updates (`server/src/likha/repositories/`)
- **`assessmentsRepo.ts`:**
  - `createActivity` & `saveActivity`:
    - Remove serialization of `questions` and `rubric` into physical JSON fields.
    - Insert child questions into `assessment_questions` (`activity_id = activityId`) and rubrics into `rubric_criteria` (`activity_id = activityId`).
  - `getActivities`:
    - Query Likha ERP with relational fields: `GET /items/activities?fields=*,questions.*,rubrics.*`.
    - Map returned relational arrays directly into the application model.
  - `createQuiz` & `createExam`:
    - Remove serialization of `questions` into physical JSON fields.
    - Write child questions directly into `assessment_questions` (`quiz_id` or `exam_id`).
  - `recordSubmission`:
    - Omit `answers` from root submission payload.
    - Insert child answers into `submission_answers` (`submission_id = subId`).
- **`gradesRepo.ts`:**
  - Write manual cells to `spr_cells` child table (`course_grade_id = id`).
  - Query grades with `fields=*,spr_cells.*`.

### 4.2. Client API Updates (`client/src/shared/api/likhaLmsApi.ts`)
- `getActivitiesWithRelations`: Query with `fields=*,questions.*,rubrics.*`.
- `saveActivity`: Write child questions and rubrics directly to relational endpoints or nested O2M payloads.
- `submitActivity`: Write student responses to `submission_answers`.

---

## 5. Migration Execution Plan

The migration will be implemented as a deterministic TypeScript script `server/src/likha/migrations/normalizeLikhaRelationalData.ts`:

1. **Phase 1: Data Unpacking & Child Row Verification**
   - For all `activities`, parse any remaining data in `questions` or `rubric` and ensure corresponding rows exist in `assessment_questions` and `rubric_criteria`.
   - For all `quizzes` and `exams`, ensure all questions exist in `assessment_questions`.
   - For all `submissions`, ensure all answers exist in `submission_answers`.
   - For all `course_grades`, ensure all cell records exist in `spr_cells`.
2. **Phase 2: Drop Physical JSON Columns**
   - Call `DELETE /fields/activities/questions`
   - Call `DELETE /fields/activities/rubric`
   - Call `DELETE /fields/quizzes/questions`
   - Call `DELETE /fields/exams/questions`
   - Call `DELETE /fields/submissions/answers`
   - Call `DELETE /fields/course_grades/spr_cells`
3. **Phase 3: Register Directus O2M Alias Fields & UI Metadata**
   - Call `POST /fields/activities` with alias `questions` (`special: ["o2m"]`, `interface: "list-o2m"`).
   - Call `POST /fields/activities` with alias `rubric` (`special: ["o2m"]`, `interface: "list-o2m"`).
   - Call `POST /fields/quizzes` with alias `questions` (`special: ["o2m"]`, `interface: "list-o2m"`).
   - Call `POST /fields/exams` with alias `questions` (`special: ["o2m"]`, `interface: "list-o2m"`).
   - Call `POST /fields/submissions` with alias `answers` (`special: ["o2m"]`, `interface: "list-o2m"`).
   - Call `POST /fields/course_grades` with alias `spr_cells` (`special: ["o2m"]`, `interface: "list-o2m"`).
4. **Phase 4: Directus Relations Refresh**
   - Ensure `POST /relations` binds each alias field to its foreign key target.

---

## 6. Verification & Test Plan

1. **Unit & Integration Tests:**
   - Create `server/src/likha/migrations/normalizeLikhaRelationalData.test.ts` to test data unpacking, field deletion, alias creation, and relation verification.
   - Run complete server test suite (`npx vitest run` in `server/`) — must pass 100%.
   - Run complete client test suite (`npx vitest run` in `client/`) — must pass 100%.
2. **Live Browser Verification:**
   - Launch browser subagent to verify the Likha Admin Activities view:
     - Verify that the raw JSON code editors are completely gone.
     - Verify that native Directus One-to-Many list tables (`list-o2m`) are rendered for both Questions and Rubrics.
     - Capture screenshot evidence.
