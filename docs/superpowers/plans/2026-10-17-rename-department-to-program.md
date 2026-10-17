# System-Wide Rename: Department to Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the academic unit terminology from "Department" to "Program" across the entire Gabay LMS prototype, including UI components, models, data layer, routing, and Likha ERP Directus backend.

**Architecture:** 
1. Introduce canonical `Program` interface in `client/src/shared/types/lms.ts` with `Department` alias for backwards compatibility.
2. Update data layer (`LMSContext.tsx`, `collegesData.ts`, `likhaLmsApi.ts`) with `programs` state accessors, `addProgram`, `deleteProgram`, and updated alert/blocker messages.
3. Update UI views, modals, filters, and forms across Academic Governance, Manage Accounts, Registration, Courses, People, and User Profiles to display "Program" and "Program Chairperson".
4. Update Likha ERP Directus backend via `browser_subagent` (Data Model labels, Content items, and User Directory affiliations) strictly following `AGENTS.md`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite, Vitest, Directus Admin UI via Browser Subagent.

---

## Global Constraints

- **MANDATORY DIRECTIVE (AGENTS.md):** NEVER use REST API DDL endpoints (`/fields`, `/relations`, `/collections`, etc.) for schema or backend modifications. All Directus schema and backend changes MUST be executed via `browser_subagent` in the Directus Admin UI (`https://gabay.zyberlab.com/admin`).
- **CRITICAL USER RULE:** NEVER modify or touch the account of Trinmar Boado (`trinmar.boado@gmail.com`).
- **Backwards Compatibility:** Retain `Department` type alias and fallback getters (`departments`, `departmentId`, `department`) so existing imports and tests continue to function.
- **Routing:** Primary route `/academic-governance/programs/:id` with redirect from `/academic-governance/departments/:id`.
- **Quality Gate:** 100% test pass rate across `client` workspace; 0 build/TypeScript errors (`npm run build --workspace=client`).

---

## Review Focus

1. **Academic Governance & Structure:** All buttons, titles, tables, and modals must read "Add Program", "Program Name", "Program Code", "Program Chairperson", and "Colleges & Programs".
2. **Registration & Account Management:** Dropdowns, table column headers, and filter pills must display "Program" and "All Programs" rather than "Department".
3. **Leadership Appointment & Deletion Modals:** Titles and messages must display "Appoint Program Chairperson", "Cannot Delete Program", and "Delete Academic Program".
4. **Likha ERP Sync:** Directus items continue to sync seamlessly with resilient item reads/writes (`/items/departments` or updated collection).
5. **No Regression:** All existing role-based access control (Admin, Dean, Chairperson, Faculty, Student) must continue to function identically.

---

### Task 1: Core Type & Data Layer Terminology Update

**Files:**
- Modify: `client/src/shared/types/lms.ts`
- Modify: `client/src/shared/data/collegesData.ts`
- Modify: `client/src/shared/context/LMSContext.tsx`
- Test: `client/src/shared/context/LMSContext.programRename.test.tsx`

**Steps:**
- [ ] Define canonical `Program` interface in `client/src/shared/types/lms.ts`:
  ```ts
  export interface Program {
    id: string;
    collegeId: string;
    name: string;
    code: string;
    chairpersonId?: string;
  }
  export type Department = Program;
  ```
- [ ] In `client/src/shared/data/collegesData.ts`, export `DEFAULT_PROGRAMS = DEFAULT_DEPARTMENTS`, rename default unit from "Department of Computer Science" to "Program in Computer Science", and export `getProgramsByCollege = getDepartmentsByCollege`.
- [ ] In `client/src/shared/context/LMSContext.tsx`:
  - Expose `programs: Program[]` on `LMSContextType` (aliasing `departments`).
  - Add `addProgram: (program: Omit<Program, 'id'>, initialChairId?: string) => Promise<{ success: boolean; message: string }>` aliasing `addDepartment`.
  - Add `deleteProgram: (programId: string) => Promise<{ success: boolean; message: string; blockers?: string[] }>` aliasing `deleteDepartment`.
  - Add `getProgramDeleteBlockers: (programId: string) => string[]` aliasing `getDepartmentDeleteBlockers`.
  - Update blocker & error messages to use "program" / "Program Chairperson" (e.g. "Permission denied: Only Administrators and Deans can delete academic programs", "Program has an assigned Program Chairperson", etc.).
- [ ] Create `client/src/shared/context/LMSContext.programRename.test.tsx` and verify that `programs`, `addProgram`, `deleteProgram`, and blocker messages return expected Program terminology.
- [ ] Run focused tests:
  `npm test --workspace=client -- --run src/shared/context/LMSContext.programRename.test.tsx`
- [ ] Commit: `feat(types): introduce Program domain model and update LMSContext data layer`

---

### Task 2: Academic Governance & Program Details Pages Update

**Files:**
- Create/Rename: `client/src/features/accounts/ProgramDetailsPage.tsx`
- Modify: `client/src/features/accounts/AcademicGovernancePage.tsx`
- Modify: `client/src/features/accounts/components/AcademicStructureTab.tsx`
- Modify: `client/src/shared/config/routes.ts`
- Modify: `client/src/App.tsx`
- Test: `client/src/features/accounts/ProgramDetailsPage.test.tsx`
- Modify: `client/src/features/accounts/components/AcademicStructureTab.test.tsx`

**Steps:**
- [ ] Create `client/src/features/accounts/ProgramDetailsPage.tsx` based on `DepartmentDetailsPage.tsx`:
  - Update all visible copy: "Program Details", "Program Faculty", "Program Students", "Program Chairperson", "Back to Academic Governance".
  - Re-export `DepartmentDetailsPage = ProgramDetailsPage` for backwards-compatible imports.
- [ ] Update `client/src/shared/config/routes.ts` and `client/src/App.tsx`:
  - Add `/academic-governance/programs/:id` routing to `ProgramDetailsPage`.
  - Add redirect route from `/academic-governance/departments/:id` to `/academic-governance/programs/:id`.
- [ ] Update `client/src/features/accounts/components/AcademicStructureTab.tsx`:
  - Update header button: "Add Program".
  - Update table headers: "Program Name", "Program Code", "Program Chairperson", "Actions".
  - Update modals: "Add New Program", "Appoint Program Chairperson", "Cannot Delete Program", "Delete Academic Program".
  - Update empty state: "No programs provisioned yet in this college".
- [ ] Update/rename `DepartmentDetailsPage.test.tsx` to `ProgramDetailsPage.test.tsx` and update `AcademicStructureTab.test.tsx` with "Program" queries.
- [ ] Run focused tests:
  `npm test --workspace=client -- --run src/features/accounts/ProgramDetailsPage.test.tsx src/features/accounts/components/AcademicStructureTab.test.tsx`
- [ ] Commit: `feat(accounts): update Academic Governance and Program Details pages to Program terminology`

---

### Task 3: Manage Accounts, Registration, Courses, and User Profile UI

**Files:**
- Modify: `client/src/features/accounts/ManageAccountsPage.tsx`
- Modify: `client/src/features/auth/RegisterPage.tsx`
- Modify: `client/src/features/courses/CreateCoursePage.tsx`
- Modify: `client/src/features/courses/CoursesPage.tsx`
- Modify: `client/src/features/people/PeopleView.tsx`
- Modify: `client/src/features/auth/ProfilePage.tsx`
- Test: `client/src/features/accounts/ManageAccountsPage.rbac.test.tsx`
- Test: `client/src/features/auth/RegisterPage.test.tsx`
- Test: `client/src/features/courses/CreateCoursePage.test.tsx`

**Steps:**
- [ ] In `client/src/features/accounts/ManageAccountsPage.tsx`:
  - Change filter label: "All Programs" (was "All Departments").
  - Change table column header: "Program" (was "Department").
  - Change pending applicant details & approval modals: "Program: {name}".
- [ ] In `client/src/features/auth/RegisterPage.tsx`:
  - Change form label: "Select Program" (was "Select Department").
  - Placeholder: "Choose your academic program".
- [ ] In `client/src/features/courses/CreateCoursePage.tsx`:
  - Change form label: "Select Program" (was "Select Department").
- [ ] In `client/src/features/courses/CoursesPage.tsx`, `client/src/features/people/PeopleView.tsx`, and `client/src/features/auth/ProfilePage.tsx`:
  - Change unit badges and labels from "Department" to "Program".
  - Change leadership seat title from "Department Chairperson" to "Program Chairperson".
- [ ] Run affected test suites to verify matching text:
  `npm test --workspace=client -- --run src/features/accounts/ManageAccountsPage.rbac.test.tsx src/features/auth/RegisterPage.test.tsx src/features/courses/CreateCoursePage.test.tsx`
- [ ] Commit: `feat(ui): update registration, accounts, courses, and user profile copy to Program`

---

### Task 4: Likha ERP Backend Updates via Browser Subagent

**Subagent Role:** Likha ERP Browser Subagent (`browser_subagent`)
**Target:** `https://gabay.zyberlab.com/admin` (Directus Admin UI)
**Credentials:** `jayveegenetareyes@gmail.com` / `qwerty12345`

**Steps:**
- [ ] Launch `browser_subagent` to log into Directus Admin UI at `https://gabay.zyberlab.com/admin`.
- [ ] Navigate to **Settings > Data Model**:
  - In `departments` collection settings: update Collection Name/Label to `Programs` (note: keep key as `departments` so API item endpoints stay intact, or update display templates to `Program Name` / `Program Code`).
  - Update field labels:
    - `name` -> Label "Program Name"
    - `code` -> Label "Program Code"
    - `chairperson_id` -> Label "Program Chairperson"
  - In `directus_users` collection:
    - Update field `department` label to "Program".
- [ ] Navigate to **Content > Programs** (`departments` items):
  - Rename item `Department of Computer Science` to `Program in Computer Science` (code: `CS`).
- [ ] Navigate to **User Directory** (`/admin/users`):
  - For all accounts (except `trinmar.boado@gmail.com` and `jayveegenetareyes@gmail.com`), update their Program/Department field to `Program in Computer Science`.
  - CRITICAL: Verify `trinmar.boado@gmail.com` is completely untouched.
- [ ] Navigate to **Settings > User Roles**:
  - Update `Chairperson` role description to: "Program Chairperson with program-scoped authority and faculty capabilities".
- [ ] Capture screenshot of Content list and Data Model.
- [ ] Report back with confirmation.

---

### Task 5: End-to-End Regression Gate & Production Build

**Steps:**
- [ ] Run full client test suite:
  `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run`
- [ ] Verify 100% of test suites PASS.
- [ ] Run client production build & typecheck:
  `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm run build --workspace=client`
- [ ] Verify 0 TypeScript errors and successful production artifact generation.
- [ ] Present completed summary and screenshots to user.
