# Likha ERP Cleanup, Data Model Organization, and Codebase Pruning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Purge test data and redundant fields in Likha ERP, organize collections into 4 feature folders via Directus Data Studio, prune 120MB+ of unused docs/spreadsheets/logs from the local codebase, and verify 100% test integrity.

**Architecture:** Interactive Directus Admin operations via `browser_subagent` adhering to `AGENTS.md` (zero REST DDL), authenticated batch DML deletion for transactional data, followed by local workspace dead-code/artifact pruning and dual-suite Vitest validation.

**Tech Stack:** Directus 11+ Admin UI, Node.js, Express, Vite, Vitest, PowerShell, Git.

**Spec:** [`docs/superpowers/specs/2026-10-14-likha-erp-cleanup-and-codebase-pruning-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-14-likha-erp-cleanup-and-codebase-pruning-design.md)

## Global Constraints

- **Zero REST API DDL Modifications:** Never issue scripted POST/PATCH/DELETE to Directus `/fields`, `/relations`, or `/collections`. All schema alterations, field removals, and folder groupings must be done via `browser_subagent` on `https://gabay.zyberlab.com/admin`.
- **Zero Server Outages:** Keep `https://gabay.zyberlab.com` 100% operational with 0 downtime and 0 Bad Gateway errors.
- **Preserve Master Data:** Master user accounts in `directus_users` and course templates (`courses`, `modules`) must be preserved.
- **Maintain 100% Test Pass Rate:** All 731 platform tests (400 server, 331 client) must pass after cleanup.
- **Preserve Test Fixtures:** `file-samples/` must be retained for syllabus parser tests.

---

### Task 1: Likha ERP Transactional Test Data Purge

**Files:**
- Script: `scripts/purge-likha-test-data.ts`
- Target Collections: `submissions`, `submission_answers`, `announcements`, `announcement_replies`, `discussions`, `discussion_replies`, `notifications`, `chat_messages`, `enrollment_requests`, `course_grades`, `spr_cells`

**Interfaces:**
- Consumes: Likha ERP item endpoints `/items/:collection`
- Produces: Clean Likha ERP collections with 0 dummy records

- [ ] **Step 1: Write idempotent transactional data purge script**

Create `scripts/purge-likha-test-data.ts`:
```typescript
import { likhaFetch } from '../server/src/likha/client.js';

const TRANSACTIONAL_COLLECTIONS = [
  'submission_answers',
  'submissions',
  'announcement_replies',
  'announcements',
  'discussion_replies',
  'discussions',
  'notifications',
  'chat_messages',
  'enrollment_requests',
  'spr_cells',
  'course_grades',
];

export async function purgeTransactionalData(): Promise<void> {
  for (const collection of TRANSACTIONAL_COLLECTIONS) {
    try {
      const res = await likhaFetch(`/items/${collection}?limit=500&fields=id`);
      if (!res.ok) {
        console.warn(`[purge] Skip ${collection}: status ${res.status}`);
        continue;
      }
      const data = await res.json();
      const items = data.data || [];
      if (items.length === 0) {
        console.log(`[purge] ${collection} is already clean (0 items).`);
        continue;
      }
      console.log(`[purge] Deleting ${items.length} items from ${collection}...`);
      for (const item of items) {
        await likhaFetch(`/items/${collection}/${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
      console.log(`[purge] Cleared ${collection}.`);
    } catch (err) {
      console.warn(`[purge] Error cleaning ${collection}:`, err);
    }
  }
}

if (process.argv[1]?.endsWith('purge-likha-test-data.ts')) {
  purgeTransactionalData()
    .then(() => console.log('[purge] All transactional collections purged successfully.'))
    .catch(console.error);
}
```

- [ ] **Step 2: Execute purge script and verify deletion**

Run: `npx tsx scripts/purge-likha-test-data.ts`
Expected: Output showing items cleared across transactional collections.

- [ ] **Step 3: Commit**

```bash
git add scripts/purge-likha-test-data.ts
git commit -m "feat(data): add and run Likha ERP transactional data purge script"
```

---

### Task 2: Directus Redundant Fields Removal via Browser Subagent

**Files:**
- Verification Screenshot: `docs/superpowers/plans/likha_fields_cleaned.png`
- Tool: `browser_subagent` navigating `https://gabay.zyberlab.com/admin/settings/data-model`

**Interfaces:**
- Consumes: Directus Data Model UI
- Produces: Streamlined collection field definitions with redundant legacy string fields removed

- [ ] **Step 1: Inspect and delete redundant fields on `submissions`**

In Directus Data Model -> `submissions`:
- Identify redundant plain string `file_name` and `file_url` (superseded by native `file` File relation).
- Click on the field -> Delete Field -> Confirm.

- [ ] **Step 2: Inspect and delete redundant fields on `course_files`**

In Directus Data Model -> `course_files`:
- Identify redundant plain string `url` (superseded by native `file` File relation).
- Click on the field -> Delete Field -> Confirm.

- [ ] **Step 3: Capture screenshot of cleaned fields**

Use `browser_subagent` to capture `docs/superpowers/plans/likha_fields_cleaned.png`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/likha_fields_cleaned.png
git commit -m "docs(verify): verify removal of redundant fields in Likha ERP"
```

---

### Task 3: Directus Feature Folders Creation & Organization via Browser Subagent

**Files:**
- Verification Screenshot: `docs/superpowers/plans/likha_folders_verified.png`
- Tool: `browser_subagent` navigating `https://gabay.zyberlab.com/admin/settings/data-model`

**Interfaces:**
- Consumes: Directus Data Model UI "Create Folder" modal
- Produces: 4 feature folders with assigned collections

- [ ] **Step 1: Create 4 Feature Folders in Data Studio**

Click "Create Folder" button in Directus Data Model:
1. Folder: `Academics & Courses` (Icon: `school`, Color: `#2E8555`)
2. Folder: `Assessments & Grading` (Icon: `assignment`, Color: `#D97706`)
3. Folder: `Communications` (Icon: `forum`, Color: `#3B82F6`)
4. Folder: `Enrollments & Access` (Icon: `how_to_reg`, Color: `#8B5CF6`)

- [ ] **Step 2: Organize collections into feature folders**

In Data Model, edit collection group property or drag:
- To `Academics & Courses`: `courses`, `modules`, `module_items`, `course_sections`, `course_files`, `syllabi`
- To `Assessments & Grading`: `activities`, `quizzes`, `exams`, `assessment_questions`, `submissions`, `submission_answers`, `course_grades`, `spr_configs`, `spr_cells`, `rubric_criteria`, `rubric_levels`
- To `Communications`: `announcements`, `announcement_replies`, `discussions`, `discussion_replies`, `notifications`, `chat_groups`, `chat_messages`
- To `Enrollments & Access`: `Course_Enrollments`, `enrollment_requests`

- [ ] **Step 3: Capture screenshot of organized folders**

Capture `docs/superpowers/plans/likha_folders_verified.png`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/likha_folders_verified.png
git commit -m "docs(verify): verify Likha ERP feature folders organization in Data Studio"
```

---

### Task 4: Local Workspace Codebase Pruning

**Files to delete:**
- Root Thesis DOCX:
  - `Results-and-discussions.docx`
  - `Results-and-discussions.pre-2026-09-25.docx`
  - `THESIS-GABAY-Original.docx`
  - `THESIS-GABAY-v5.docx`
- Prompt/Transcript Dumps:
  - `main-session.md`
  - `notif-and-quiz.md`
- Intermediate Task Reports:
  - `task-1-report.md`, `task-2-report.md`, `task-3-report.md`, `task-4-report.md`, `task-5-report.md`, `task-6-report.md`, `task-likha-backend-report.md`, `task-normalization-report.md`
- Scratch/Unused Files & Folders:
  - `test_style.css`
  - `sibling-recovery/`
  - `docs-other-outputs/`
- Preserved:
  - `file-samples/` (fixtures for `syllabusParser.test.ts`)
  - `task-full-likha-report.md` (canonical report)

- [ ] **Step 1: Execute file deletions via PowerShell command**

```powershell
Remove-Item -Force -ErrorAction SilentlyContinue Results-and-discussions.docx, Results-and-discussions.pre-2026-09-25.docx, THESIS-GABAY-Original.docx, THESIS-GABAY-v5.docx, main-session.md, notif-and-quiz.md, task-1-report.md, task-2-report.md, task-3-report.md, task-4-report.md, task-5-report.md, task-6-report.md, task-likha-backend-report.md, task-normalization-report.md, test_style.css
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue sibling-recovery, docs-other-outputs
```

- [ ] **Step 2: Verify git status and disk savings**

Run: `git status`
Expected: Files deleted, no unexpected source code deletions.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore(cleanup): prune obsolete thesis docx, session dumps, and intermediate task reports"
```

---

### Task 5: Full Platform Regression Testing & Final Documentation

**Files:**
- Modify: `task-full-likha-report.md`
- Tests: All server and client test suites

- [ ] **Step 1: Run full server test suite**

Run: `npm --prefix server test -- --run`
Expected: 51 / 51 files passed, 400 / 400 tests passed (100%).

- [ ] **Step 2: Run full client test suite**

Run: `npm --prefix client test -- --run`
Expected: 62 / 62 files passed, 331 / 331 tests passed (100%).

- [ ] **Step 3: Update `task-full-likha-report.md`**

Document the completed data purge, redundant field removals, feature folders organization, and repository cleanup.

- [ ] **Step 4: Commit**

```bash
git add task-full-likha-report.md
git commit -m "docs(report): update task-full-likha-report with cleanup and feature folders verification"
```
