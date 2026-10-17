# School Year Management and Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive college-scoped School Year management, tagging all courses, users, and registrations with required school years, allowing Deans to create and designate active school years, filtering courses with past-year navigation, and providing school year directory filters in account management.

**Architecture:** Extend LMS domain models with `SchoolYear` entity and collegiate scoping. Integrate state and persistence in `LMSContext.tsx` with default active school years (`2025-2026`). Extend `ManageAccountsPage.tsx` with school year filtering, `CoursesPage.tsx` with school year filtering and historical browsing, `AcademicStructureTab.tsx` with Dean-governed school year management, and registration/course-creation flows with school year associations.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Directus item layer.

**Spec:** `docs/superpowers/specs/2026-10-17-school-year-management-and-scoping-design.md`

## Global Constraints
- Zero Directus REST DDL modifications (`/fields`, `/relations`, `/collections`) per `AGENTS.md`. Only standard item reads/writes (`/items/:collection`).
- Dean ownership: only the College Dean of that college (and Chancellor/Superadmin) can create or change the active school year for a college.
- Past courses remain accessible and interactive; changing active school year does not delete or lock past courses or user accounts.
- Accounts with previous school years retain their registration school year and maintain active system access.
- 100% test pass rate across `client` workspace.

## Review Focus
1. User registration without explicit school year fallback: must automatically default to the selected college's active school year.
2. Courses created without school year: must inherit the active school year of the instructor's / program's college.
3. CoursesPage filtering: defaults to active school year, but selecting "All" or a previous year displays historical courses properly.
4. ManageAccountsPage filtering: filters accounts accurately when switching between "All School Years" and specific years (e.g. "2025-2026").
5. Academic Governance RBAC: ensures only Dean and Superadmin can add or switch active school years for a college.

---

### Task 1: School Year Types, Initial Data & LMSContext State Management

**Files:**
- Modify: `client/src/shared/types/lms.ts`
- Modify: `client/src/shared/data/collegesData.ts`
- Modify: `client/src/shared/context/LMSContext.tsx`
- Test: `client/src/shared/context/LMSContext.schoolYear.test.tsx`

**Interfaces:**
- Produces:
  - `SchoolYear`: `{ id: string; collegeId: string; year: string; isActive: boolean; createdAt?: string; }`
  - `Course.schoolYear?: string`
  - `User.schoolYear?: string`
  - `PendingRegistration.schoolYear?: string`
  - `schoolYears: SchoolYear[]` in `LMSContext`
  - `addSchoolYear(collegeId: string, year: string): Promise<{ success: boolean; message?: string }>`
  - `setActiveSchoolYear(collegeId: string, schoolYearId: string): Promise<{ success: boolean; message?: string }>`
  - `getSchoolYearsByCollege(collegeId: string): SchoolYear[]`
  - `getActiveSchoolYearForCollege(collegeId: string): SchoolYear | undefined`

- [ ] **Step 1: Write failing test for School Year state management**
  Create `client/src/shared/context/LMSContext.schoolYear.test.tsx` verifying `addSchoolYear`, `setActiveSchoolYear`, default active school year for `col-ccs`, and user/course school year assignment.

- [ ] **Step 2: Run test to verify it fails**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/shared/context/LMSContext.schoolYear.test.tsx`
  Expected: FAIL (types or methods not found).

- [ ] **Step 3: Implement SchoolYear model and LMSContext methods**
  - Add `SchoolYear` to `client/src/shared/types/lms.ts`.
  - Add `schoolYear?: string` to `Course`, `User`, `PendingRegistration`.
  - Add `DEFAULT_SCHOOL_YEARS` in `client/src/shared/data/collegesData.ts` (defaulting `col-ccs` to `2025-2026`, active).
  - Implement `schoolYears`, `addSchoolYear`, `setActiveSchoolYear`, `getSchoolYearsByCollege`, `getActiveSchoolYearForCollege` in `LMSContext.tsx`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/shared/context/LMSContext.schoolYear.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run: `git add client/src/shared/types/lms.ts client/src/shared/data/collegesData.ts client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.schoolYear.test.tsx && git commit -m "feat(context): add collegiate SchoolYear model and state management"`

---

### Task 2: Academic Governance Dean School Year Management UI

**Files:**
- Modify: `client/src/features/accounts/components/AcademicStructureTab.tsx`
- Test: `client/src/features/accounts/components/AcademicStructureTab.schoolYear.test.tsx`

**Interfaces:**
- Consumes: `schoolYears`, `addSchoolYear`, `setActiveSchoolYear`, `activeUser`, `activeRole` from `LMSContext`.
- Produces: School Year management section in College view/card with "Add School Year" modal and "Set Active" toggle.

- [ ] **Step 1: Write failing test for School Year UI in Academic Structure**
  Create `client/src/features/accounts/components/AcademicStructureTab.schoolYear.test.tsx` testing that Dean can view school years for their college, add a new school year (e.g. `2026-2027`), and set it as active.

- [ ] **Step 2: Run test to verify it fails**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/components/AcademicStructureTab.schoolYear.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implement School Year controls in AcademicStructureTab.tsx**
  - Add collegiate School Year management section/card or modal in `AcademicStructureTab.tsx`.
  - Validate year format (e.g., `YYYY-YYYY`).
  - Render active badge and "Set as Active" action button for Dean/Superadmin.

- [ ] **Step 4: Run test to verify it passes**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/components/AcademicStructureTab.schoolYear.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run: `git add client/src/features/accounts/components/AcademicStructureTab.tsx client/src/features/accounts/components/AcademicStructureTab.schoolYear.test.tsx && git commit -m "feat(governance): add Dean school year governance and activation controls"`

---

### Task 3: Account Management & Registration School Year Tagging and Filtering

**Files:**
- Modify: `client/src/features/accounts/ManageAccountsPage.tsx`
- Modify: `client/src/features/auth/RegisterPage.tsx`
- Modify: `client/src/features/accounts/CreateAccountPage.tsx`
- Test: `client/src/features/accounts/ManageAccountsPage.schoolYear.test.tsx`

**Interfaces:**
- Consumes: `user.schoolYear`, `pendingRegistration.schoolYear`, `schoolYears` from `LMSContext`.
- Produces:
  - School Year CustomDropdown filter in `ManageAccountsPage.tsx`.
  - Automatic tagging of new users and registrations with active school year.

- [ ] **Step 1: Write failing test for School Year filtering in ManageAccountsPage**
  Create `client/src/features/accounts/ManageAccountsPage.schoolYear.test.tsx` verifying:
  - Filter shows "All School Years" plus available years.
  - Selecting "2025-2026" filters directory to accounts matching `schoolYear === '2025-2026'`.
  - User rows display school year badge.

- [ ] **Step 2: Run test to verify it fails**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/ManageAccountsPage.schoolYear.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implement School Year filter and display in ManageAccountsPage, RegisterPage, and CreateAccountPage**
  - Add `schoolYearFilter` state and dropdown in `ManageAccountsPage.tsx`.
  - Render school year badge in user directory table/cards.
  - Associate `schoolYear` in `RegisterPage.tsx` and `CreateAccountPage.tsx`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/ManageAccountsPage.schoolYear.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run: `git add client/src/features/accounts/ManageAccountsPage.tsx client/src/features/auth/RegisterPage.tsx client/src/features/accounts/CreateAccountPage.tsx client/src/features/accounts/ManageAccountsPage.schoolYear.test.tsx && git commit -m "feat(accounts): add school year directory filter and registration association"`

---

### Task 4: Courses Page School Year Filter and Past-Year Navigation

**Files:**
- Modify: `client/src/features/courses/CoursesPage.tsx`
- Modify: `client/src/features/courses/CreateCoursePage.tsx`
- Test: `client/src/features/courses/CoursesPage.schoolYear.test.tsx`

**Interfaces:**
- Consumes: `courses`, `getActiveSchoolYearForCollege`, `getSchoolYearsByCollege`, `activeUser` from `LMSContext`.
- Produces:
  - School Year dropdown switcher in `CoursesPage.tsx`.
  - Required School Year selection in `CreateCoursePage.tsx`.

- [ ] **Step 1: Write failing test for CoursesPage school year filter and navigation**
  Create `client/src/features/courses/CoursesPage.schoolYear.test.tsx` verifying:
  - Default view filters to the active school year of the college.
  - Selecting another school year displays courses from that past school year.
  - Past courses remain accessible.

- [ ] **Step 2: Run test to verify it fails**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/courses/CoursesPage.schoolYear.test.tsx`
  Expected: FAIL.

- [ ] **Step 3: Implement School Year filter in CoursesPage and CreateCoursePage**
  - Add school year selector in `CoursesPage.tsx` defaulting to active school year.
  - Support switching to past school years or "All School Years".
  - Add required School Year selector in `CreateCoursePage.tsx`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/courses/CoursesPage.schoolYear.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Commit**
  Run: `git add client/src/features/courses/CoursesPage.tsx client/src/features/courses/CreateCoursePage.tsx client/src/features/courses/CoursesPage.schoolYear.test.tsx && git commit -m "feat(courses): add school year catalog filter, creation tagging, and past-year navigation"`

---

### Task 5: Full Regression & Production Build Gate

**Files:**
- Verification: Full client test suite (`npm test --workspace=client`)
- Verification: Client production build (`npm run build --workspace=client`)

- [ ] **Step 1: Run full client test suite**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run`
  Verify all test files pass (100% pass rate).

- [ ] **Step 2: Run client production build**
  Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm run build --workspace=client`
  Verify 0 TypeScript and build errors.

- [ ] **Step 3: Report results and summary**
