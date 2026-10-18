# Chair-Sheet Course Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize LMS course creation to the department Chairperson via an Excel "chair-sheet" upload with automated faculty verification, in-table editing, and bulk course shell generation.

**Architecture:** The in-browser `xlsx` library parses uploaded `.xlsx` files into raw course rows. A specialized verification utility matches names against eligible faculty (`db.users` with faculty role, or chair/dean designations). An editable preview table lets the Chair adjust names and course metadata live with real-time re-verification. The save action is strictly gated until all instructors are verified, after which courses are generated via `likhaLmsApi` and assigned to professors with immutable core metadata.

**Tech Stack:** React 19, TypeScript, `xlsx`, Vitest, Tailwind CSS, Lucide icons, Likha LMS API.

**Spec:** `docs/superpowers/specs/2026-10-18-chair-sheet-course-creation-design.md`

## Global Constraints

- Never use Directus / REST API DDL endpoints (`/fields`, `/relations`, `/collections`).
- Individual course creation is disabled for all users (faculty, dean, admin, student).
- Only Chairperson (`isChairRole(activeUser, activeRole)`) has the authority to upload chair-sheets.
- All non-chair users attempting to navigate to course creation receive an institutional access notice.
- Assigned professors can edit course content (modules, syllabus, assessments) but cannot modify Course Code, Title, or Section.
- Include extensible validation structure ready for future curriculum checklist comparison.

## Review Focus

1. Excel cells with trailing/leading spaces (e.g. `'Charlie '`) must be trimmed automatically during parsing.
2. Case-insensitive and middle-name variations (e.g. middle initial vs full middle name) must match properly.
3. Unmatched rows must prevent saving and clearly highlight what failed.
4. Non-chair users must be locked out of chair-sheet upload and course creation.
5. In-table cell edits or picking a faculty from dropdown must immediately re-verify the row.

---

### Task 1: Chair-Sheet Parser and Faculty Verification Engine

**Files:**
- Create: `client/src/features/courses/utils/chairSheetParser.ts`
- Test: `client/src/features/courses/utils/chairSheetParser.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RawChairSheetRow {
    firstName: string;
    middleName: string;
    lastName: string;
    courseCode: string;
    descriptiveTitle: string;
    yearAndSection: string;
  }

  export interface ValidatedChairSheetRow extends RawChairSheetRow {
    id: string;
    facultyStatus: 'valid' | 'invalid';
    matchedUser?: User | null;
    facultyErrorMessage?: string;
    suggestedUser?: User | null;
    checklistStatus?: 'valid' | 'invalid' | 'unverified';
  }

  export function parseChairSheet(data: ArrayBuffer): RawChairSheetRow[];
  export function matchFaculty(row: RawChairSheetRow, users: User[]): { status: 'valid' | 'invalid'; user?: User; suggestion?: User; error?: string };
  export function validateChairSheetRows(rows: RawChairSheetRow[], users: User[]): ValidatedChairSheetRow[];
  ```

- [ ] **Step 1: Write the failing unit tests for `chairSheetParser.ts`**
  - Test parsing workbook buffer with sample columns: First Name, Middle Name, Last Name, Course Code, Descriptive Title, Year and Section.
  - Test whitespace trimming.
  - Test exact and case-insensitive faculty matching against `db.users` (including faculty, deans, and chairs).
  - Test unmatched / misspelled names returning `invalid` with suggested faculty.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test client/src/features/courses/utils/chairSheetParser.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Implement `chairSheetParser.ts`**
  - Implement workbook parsing via `xlsx.read` and `xlsx.utils.sheet_to_json`.
  - Implement faculty matching logic against `User[]`, checking `role === 'faculty'` or `isChairRole` or `isDeanRole`.
  - Provide Levenshtein / fuzzy similarity suggestion for misspelled names.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test client/src/features/courses/utils/chairSheetParser.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit changes**
  Run: `git add client/src/features/courses/utils/` and `git commit -m "feat(courses): implement chair sheet parser and faculty verification engine"`

---

### Task 2: Update LMSContext createCourse for Assigned Instructors

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:3095-3145`
- Test: `client/src/shared/context/LMSContext.coursesLikha.test.tsx`

**Interfaces:**
- Consumes: `createCourse(courseData: Partial<Course>)`
- Produces: support for `instructorId` and `instructorName` in `courseData` rather than always hardcoding to `activeUser`.

- [ ] **Step 1: Write failing test in `LMSContext.coursesLikha.test.tsx`**
  - Verify that calling `createCourse({ instructorId: 'u-other', instructorName: 'Prof Other', ... })` persists and returns the specified instructor rather than the active user.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test client/src/shared/context/LMSContext.coursesLikha.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Update `createCourse` in `LMSContext.tsx`**
  - Use `courseData.instructorId || activeUser.id` and `courseData.instructorName || activeUser.name`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test client/src/shared/context/LMSContext.coursesLikha.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit changes**
  Run: `git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.coursesLikha.test.tsx` and `git commit -m "feat(lms): allow createCourse to specify instructor metadata"`

---

### Task 3: Build Chair-Sheet Upload & Editable Preview Table

**Files:**
- Create: `client/src/features/courses/components/ChairSheetPreviewTable.tsx`
- Create: `client/src/features/courses/components/ChairSheetUploadView.tsx`
- Test: `client/src/features/courses/components/ChairSheetUploadView.test.tsx`

**Interfaces:**
- Consumes: `parseChairSheet`, `validateChairSheetRows`, `useLMS` (`db.users`, `createCourse`, `getActiveSchoolYearForCollege`)
- Produces: `ChairSheetUploadView` component for uploading, editing in-table, verifying, and generating courses.

- [ ] **Step 1: Write failing test for `ChairSheetUploadView.test.tsx`**
  - Test file drop/upload parses data and renders preview table rows.
  - Test that unmatched faculty rows display error badge and disable the Approve button.
  - Test editing a misspelled name in an input updates verification in real-time.
  - Test picking a faculty from dropdown populates names and marks row valid.
  - Test that when all rows are valid, clicking Approve triggers course creation.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test client/src/features/courses/components/ChairSheetUploadView.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implement `ChairSheetPreviewTable.tsx` and `ChairSheetUploadView.tsx`**
  - File upload zone with drag-and-drop and file input.
  - Interactive table with inputs for `firstName`, `middleName`, `lastName`, `courseCode`, `descriptiveTitle`, `yearAndSection`.
  - Status column with badges (Green "Verified", Red "Not Found") and faculty dropdown picker.
  - Delete row button.
  - Summary metrics (Total courses, Verified instructors, Unresolved errors).
  - Bulk approval executor with progress indicator and navigation to courses upon completion.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test client/src/features/courses/components/ChairSheetUploadView.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit changes**
  Run: `git add client/src/features/courses/components/` and `git commit -m "feat(courses): implement chair sheet upload and editable preview table"`

---

### Task 4: RBAC & Navigation Integration

**Files:**
- Modify: `client/src/shared/config/routes.ts`
- Modify: `client/src/App.tsx`
- Modify: `client/src/features/dashboard/DashboardPage.tsx`
- Create: `client/src/features/courses/ChairSheetRBAC.test.tsx`

**Interfaces:**
- Disables individual course creation button on Dashboard for all users.
- Renders "Upload Chair-Sheet" button for users matching `isChairRole(activeUser, activeRole)`.
- Protects `/courses/new` and `/courses/chair-sheet` routes: renders `ChairSheetUploadView` for Chair, redirects/shows access warning for non-chairs.

- [ ] **Step 1: Write failing RBAC test `ChairSheetRBAC.test.tsx`**
  - Verify standard faculty, dean, and admin do not see individual "Create course" button on Dashboard.
  - Verify Chairperson sees "Upload Chair-Sheet" button.
  - Verify non-chair visiting `/courses/chair-sheet` or `/courses/new` is blocked.

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm test client/src/features/courses/ChairSheetRBAC.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Update `DashboardPage.tsx`, `routes.ts`, and `App.tsx`**
  - Replace individual course creation button with Chair-Sheet upload for Chairperson only.
  - Route `/courses/new` and `/courses/chair-sheet` to `ChairSheetUploadView` with chair check.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test client/src/features/courses/ChairSheetRBAC.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit changes**
  Run: `git add client/src/shared/config/routes.ts client/src/App.tsx client/src/features/dashboard/DashboardPage.tsx client/src/features/courses/ChairSheetRBAC.test.tsx` and `git commit -m "feat(courses): enforce chair-only course creation RBAC and routes"`

---

### Task 5: End-to-End Verification with Real Sample Spreadsheet

**Files:**
- Test: `client/src/features/courses/ChairSheetE2E.test.tsx`

- [ ] **Step 1: Write E2E test using the real `file-samples/chair-sheet/chair-sheet.xlsx`**
  - Read `file-samples/chair-sheet/chair-sheet.xlsx` as binary buffer.
  - Feed into parser.
  - Verify all 3 courses (CSCC 103, CCSC 303, CSPC 112) are detected with faculty Charlie Seli Marzan and Raymund Ezekiel Dilan.
  - Verify mock users matched.
  - Test intentional misspelling scenario (e.g. changing 'Charlie' to 'Charly'), confirm save is gated, fix via table, and confirm approval succeeds.

- [ ] **Step 2: Run test to verify it passes**
  Run: `npm test client/src/features/courses/ChairSheetE2E.test.tsx`
  Expected: PASS.

- [ ] **Step 3: Run full client test suite and typecheck**
  Run: `npm run typecheck --workspace=client`
  Run: `npm run test --workspace=client`
  Expected: All passing.

- [ ] **Step 4: Commit changes**
  Run: `git add client/src/features/courses/ChairSheetE2E.test.tsx` and `git commit -m "test(courses): add end-to-end integration test for chair sheet course creation"`
