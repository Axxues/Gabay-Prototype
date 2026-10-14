# Likha ERP Cleanup, Data Model Organization, and Codebase Pruning Design Spec

**Date:** October 14, 2026  
**Status:** Draft / Review  
**Repository:** `Axxues/Gabay-Prototype`  
**Directus Instance:** `https://gabay.zyberlab.com`  

---

## 1. Objectives & Scope

1. **Purge Transactional Data:** Delete old transactional/test records in Likha ERP collections (`submissions`, `submission_answers`, `assessment_questions`, `announcements`, `announcement_replies`, `discussions`, `discussion_replies`, `notifications`, `chat_messages`, `enrollment_requests`, `course_grades`, `spr_cells`), while preserving master users (`directus_users`) and core course templates (`courses`, `modules`).
2. **Remove Redundant Fields in Likha ERP:** Using `browser_subagent` in Directus Data Studio (`/admin/settings/data-model`), inspect LMS collections and safely remove redundant fields superseded by native relational and media fields (e.g. redundant plain strings `file_url`, `file_name` where native Directus `file` exists).
3. **Organize Collections into Feature Folders in Directus:** Create 4 feature folders in Directus Data Studio and organize collections:
   - **📁 Academics & Courses:** `courses`, `modules`, `module_items`, `course_sections`, `course_files`, `syllabi`.
   - **📁 Assessments & Grading:** `activities`, `quizzes`, `exams`, `assessment_questions`, `submissions`, `submission_answers`, `course_grades`, `spr_configs`, `spr_cells`, `rubric_criteria`, `rubric_levels`.
   - **📁 Communications:** `announcements`, `announcement_replies`, `discussions`, `discussion_replies`, `notifications`, `chat_groups`, `chat_messages`.
   - **📁 Enrollments & Access:** `Course_Enrollments`, `enrollment_requests`.
4. **Prune Workspace Codebase:** Remove unnecessary root files in `D:\4thesis\GabaySystem\Gabay-Prototype\`:
   - Thesis docx files (120MB+): `Results-and-discussions.docx`, `Results-and-discussions.pre-2026-09-25.docx`, `THESIS-GABAY-Original.docx`, `THESIS-GABAY-v5.docx`.
   - Prompt/transcript dumps: `main-session.md`, `notif-and-quiz.md`.
   - Intermediate task reports: `task-1-report.md` through `task-6-report.md`, `task-likha-backend-report.md`, `task-normalization-report.md` (retaining consolidated `task-full-likha-report.md`).
   - Temporary spreadsheets and folders: `docs-other-outputs/`, `sibling-recovery/`, `test_style.css`.
   - Strictly preserve all active code and test fixtures (`file-samples/`).
5. **Verify Full System Integrity:** Ensure all 731 tests (400 server, 331 client) remain passing and Likha ERP experiences zero downtime.

---

## 2. Technical Strategy & Safety Constraints

### 2.1 AGENTS.md Directus Production Directive
- **Zero REST API DDL:** No curl or script calls to Directus `/fields`, `/relations`, or `/collections`.
- Field removals and folder creations **MUST** be performed via `browser_subagent` interacting directly with `https://gabay.zyberlab.com/admin/settings/data-model`.
- Item deletions (data purge) use authorized application item endpoints (`/items/:collection/:id` with HTTP DELETE) or UI multi-select deletion, which are standard DML operations and do not trigger schema/nodemon reloads.

### 2.2 Feature Folder Schema in Directus
Directus organizes collections in folders using the `directus_collections.group` field. When creating a folder in Data Studio:
- Directus creates a folder collection entry (type `folder`) with a display name, icon, and color.
- Collections assigned to that group display neatly nested inside that folder in the left navigation and Data Studio overview.

---

## 3. Phased Implementation Plan

### Phase 1: Likha ERP Data Purge
- Execute bulk purge of transactional rows via authenticated service calls:
  - `submissions` and `submission_answers`
  - `announcements` and `announcement_replies`
  - `discussions` and `discussion_replies`
  - `notifications`
  - `chat_messages`
  - `enrollment_requests`
  - `course_grades` and `spr_cells`
- Preserve core `courses` master records, `directus_users`, and official syllabus templates.

### Phase 2: Redundant Field Inspection & Removal (Browser Subagent)
- Navigate `browser_subagent` to `https://gabay.zyberlab.com/admin/settings/data-model`.
- On `submissions`: Remove redundant plain text string `file_url` and `file_name` (since `file` is now the native Directus File relation).
- On `course_files`: Remove redundant string `url` (since `file` is the native Directus File relation).
- Inspect collections for deprecated or duplicate columns and remove them cleanly.

### Phase 3: Directus Feature Folders Organization (Browser Subagent)
- Create 4 Folders in Directus Data Studio:
  1. `Academics & Courses` (icon: `school`, color: `#2E8555`)
  2. `Assessments & Grading` (icon: `assignment`, color: `#D97706`)
  3. `Communications` (icon: `forum`, color: `#3B82F6`)
  4. `Enrollments & Access` (icon: `how_to_reg`, color: `#8B5CF6`)
- Assign each LMS collection to its respective group/folder.
- Capture visual confirmation screenshot `docs/superpowers/plans/likha_folders_verified.png`.

### Phase 4: Local Workspace Codebase Pruning
- Delete large root docx files:
  - `Results-and-discussions.docx`
  - `Results-and-discussions.pre-2026-09-25.docx`
  - `THESIS-GABAY-Original.docx`
  - `THESIS-GABAY-v5.docx`
- Delete chat log dumps:
  - `main-session.md`
  - `notif-and-quiz.md`
- Delete intermediate task reports (preserving `task-full-likha-report.md`):
  - `task-1-report.md`, `task-2-report.md`, `task-3-report.md`, `task-4-report.md`, `task-5-report.md`, `task-6-report.md`, `task-likha-backend-report.md`, `task-normalization-report.md`
- Delete temporary artifacts:
  - `test_style.css`
  - `sibling-recovery/`
  - `docs-other-outputs/`
- Keep `file-samples/` (required for test fixtures in `syllabusParser.test.ts`).

### Phase 5: Verification & Zero-Regression Check
- Run `npm --prefix server test -- --run` (all 400 tests pass).
- Run `npm --prefix client test -- --run` (all 331 tests pass).
- Total: 731 / 731 tests passing.
- Commit all changes with clean git history.
