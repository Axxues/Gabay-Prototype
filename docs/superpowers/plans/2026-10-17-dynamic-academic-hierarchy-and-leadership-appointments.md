# Dynamic Academic Hierarchy Governance & Delegated Leadership Appointments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide dynamic multi-college and department creation with in-place leadership appointment, unlocking scoped governance for Deans to manage departments and appoint chairs within their college while Chancellor retains university-wide authority.

**Architecture:** Extend `LMSContext` to support atomic in-place leadership appointments during unit creation (`addCollege`, `addDepartment`) with multi-unit vacancy cleanup. Update `AcademicStructureTab` with unified creation modals and role-based scoping (Chancellor sees all, Dean sees and provisions within their college only). Scope `ManageAccountsPage` so Deans see the Academic Structure tab and their Active Directory, metrics, and candidate pools are strictly bounded to their college.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, Tailwind CSS, Lucide React, Context API, localStorage.

**Spec:** `docs/superpowers/specs/2026-10-17-dynamic-academic-hierarchy-and-leadership-appointments-design.md`

## Global Constraints

- Strict single-seat leadership invariants: 1 Chancellor overall, at most 1 Dean per college, at most 1 Chairperson per department.
- Atomic seat vacation: if a successor currently heads another unit, that prior unit is automatically vacated.
- Zero Likha ERP REST DDL alterations (`/fields`, `/relations`, `/collections`) per `AGENTS.md`.
- Dean scope strictly bounded to their assigned college (`activeUser.collegeId`).
- Backward compatibility with existing user records, courses, and pending registration queues.

## Review Focus

1. **Predecessor and Successor Session Sync**: Appointing an active user as Dean or Chair must immediately update their active session and privileges without requiring re-login.
2. **Prior Unit Leadership Cleanup**: Appointing a Chairperson of Department A as Dean of College B must vacate Department A's `chairpersonId` to prevent ghost chairs.
3. **Dean Academic Structure Isolation**: A Dean must never see "+ Add College" or "Reassign" on their Dean card, and must never see departments of other colleges.
4. **Active Directory Scoping for Dean**: A Dean on `/accounts` must only see users and metrics for their college; students and faculty from other colleges must be filtered out.
5. **Instant Registration Dropdown Sync**: Creating a new college or department in Academic Structure must immediately appear in `/register` dropdowns.

---

### Task 1: LMSContext In-Place Unit Creation with Leadership Appointment & Atomic Seat Vacation

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:280-305, 3540-3625`
- Test: `client/src/shared/context/LMSContext.academicStructure.test.tsx`

**Interfaces:**
- Consumes: `College`, `Department`, `UserRole`, `STORAGE_KEY_COLLEGES`, `STORAGE_KEY_DEPARTMENTS` from `client/src/shared/types/lms.ts`
- Produces:
  ```ts
  addCollege: (college: College, initialDeanId?: string) => Promise<College>;
  addDepartment: (department: Department, initialChairId?: string) => Promise<Department>;
  transferLeadership: (roleType: 'dean' | 'chairperson', currentLeaderId: string, successorId: string, unitId: string) => Promise<{ success: boolean; message: string }>;
  ```

- [ ] **Step 1: Write the failing tests for enhanced `addCollege`, `addDepartment`, and atomic seat vacation**

Create `client/src/shared/context/LMSContext.academicStructure.test.tsx` testing:
1. `addCollege(newCol, initialDeanId)`: persists the college and promotes `initialDeanId` to `role: 'admin'`, `adminSubrole: 'dean'`, `collegeId: newCol.id`.
2. `addDepartment(newDept, initialChairId)`: persists the department under `newDept.collegeId` and promotes `initialChairId` to `role: 'admin'`, `adminSubrole: 'chairperson'`, `department: newDept.name`.
3. Multi-unit cleanup: appointing a user who is already a Chairperson of Dept 1 to be Dean of College 2 vacates Dept 1's `chairpersonId`.

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run src/shared/context/LMSContext.academicStructure.test.tsx
```
Expected: FAIL with missing `initialDeanId` / `initialChairId` handling or vacancy assertion failure.

- [ ] **Step 3: Implement atomic unit creation & leadership promotion in `client/src/shared/context/LMSContext.tsx`**

1. Update `LMSContextType` interface:
   ```ts
   addCollege: (college: College, initialDeanId?: string) => Promise<College>;
   addDepartment: (department: Department, initialChairId?: string) => Promise<Department>;
   ```
2. Update `transferLeadership`:
   - When setting `successorId` on `unitId`, also scan other colleges and departments to clear any prior seats where `c.deanId === successorId && c.id !== unitId` or `d.chairpersonId === successorId && d.id !== unitId`.
3. Update `addCollege(college, initialDeanId)`:
   - If `initialDeanId` is provided and not `'none'`, call `transferLeadership('dean', 'none', initialDeanId, college.id)` and set `college.deanId = initialDeanId`.
   - Update `colleges` state and persist to `localStorage`.
4. Update `addDepartment(department, initialChairId)`:
   - If `initialChairId` is provided and not `'none'`, call `transferLeadership('chairperson', 'none', initialChairId, department.id)` and set `department.chairpersonId = initialChairId`.
   - Update `departments` state and persist to `localStorage`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run src/shared/context/LMSContext.academicStructure.test.tsx
```
Expected: PASS (all tests green).

- [ ] **Step 5: Commit changes**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.academicStructure.test.tsx
git commit -m "feat(context): support in-place leadership appointment and atomic cross-unit seat vacation"
```

---

### Task 2: Scoped Academic Structure Console with Unified Creation & Chair Appointment

**Files:**
- Modify: `client/src/features/accounts/components/AcademicStructureTab.tsx`
- Test: `client/src/features/accounts/components/AcademicStructureTab.test.tsx`

**Interfaces:**
- Consumes: `useLMS()`, `colleges`, `departments`, `addCollege`, `addDepartment`, `transferLeadership`, `db.users`, `activeRole`, `activeUser`
- Produces: `AcademicStructureTab` component supporting Chancellor view (all colleges, add college, assign deans/chairs) and Dean view (scoped to Dean's college, add department, assign chairs from Dean's college).

- [ ] **Step 1: Write the failing tests for `AcademicStructureTab` role scoping and unified creation**

Create `client/src/features/accounts/components/AcademicStructureTab.test.tsx` testing:
1. When rendered for Chancellor (`superadmin`):
   - Displays `+ Add College` button.
   - Shows all colleges in the system.
   - Shows "Reassign" button for College Deans.
2. When rendered for Dean (`admin` with `adminSubrole: 'dean'`, `collegeId: 'col-ccs'`):
   - Does NOT display `+ Add College` button.
   - Only displays the Dean's college (`col-ccs`) and its departments.
   - Displays `+ Add Department` button (which defaults/locks to `col-ccs`).
   - Does NOT display "Reassign" button on the Dean card.
   - Displays "Appoint" or "Reassign" button on departments, with candidate dropdown restricted to faculty from `col-ccs`.
3. In "Create College" modal: shows initial Dean selector.
4. In "Add Department" modal: shows initial Chairperson selector.

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run src/features/accounts/components/AcademicStructureTab.test.tsx
```
Expected: FAIL (scoping not yet implemented in `AcademicStructureTab`).

- [ ] **Step 3: Update `AcademicStructureTab.tsx` with role scoping & integrated modal selectors**

1. Derive viewer role and college scope:
   ```ts
   const isChancellor = activeRole === 'superadmin' || activeUser?.adminSubrole === 'chancellor';
   const isDean = activeRole === 'admin' && activeUser?.adminSubrole === 'dean';
   const viewerCollegeId = activeUser?.collegeId;
   const visibleColleges = isChancellor
     ? (colleges || [])
     : (colleges || []).filter(c => c.id === viewerCollegeId || c.name.toLowerCase() === activeUser?.collegeName?.toLowerCase());
   ```
2. In Dean view header:
   - Hide `+ Add College` button.
   - Show `+ Add Department` button, which opens the Add Dept modal with `deptCollegeId` pre-filled and locked to `viewerCollegeId`.
   - On the college Dean card, if `isDean`, render a `(Current Dean)` badge without the "Reassign" button.
3. Candidate filtering:
   - For Dean appointing a Chair: filter `db.users` to `(u.role === 'faculty' || u.role === 'admin') && (u.collegeId === viewerCollegeId || u.collegeName?.toLowerCase() === activeUser?.collegeName?.toLowerCase())`.
   - For Chancellor: allow all eligible faculty/admin university-wide.
4. In "Create College" modal:
   - Add state `initialDeanId` (default `''`).
   - Add select dropdown for "Initial Dean (Optional)" with option "Leave Unassigned (Appoint Later)".
   - Pass `initialDeanId` to `addCollege(newCol, initialDeanId)`.
5. In "Add Department" modal:
   - If `isDean`, disable or hide the College select input (locks to Dean's college).
   - Add state `initialChairId` (default `''`).
   - Add select dropdown for "Initial Chairperson (Optional)" with option "Leave Unassigned (Appoint Later)".
   - Pass `initialChairId` to `addDepartment(newDept, initialChairId)`.

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run src/features/accounts/components/AcademicStructureTab.test.tsx
```
Expected: PASS (all tests green).

- [ ] **Step 5: Commit changes**

```bash
git add client/src/features/accounts/components/AcademicStructureTab.tsx client/src/features/accounts/components/AcademicStructureTab.test.tsx
git commit -m "feat(accounts): implement scoped academic structure console with unified creation & appointments"
```

---

### Task 3: ManageAccountsPage Dean Access & Full Collegiate Scoping

**Files:**
- Modify: `client/src/features/accounts/ManageAccountsPage.tsx:535-555, 1070-1085, 210-270`
- Test: `client/src/features/accounts/ManageAccountsPage.deanScope.test.tsx`

**Interfaces:**
- Consumes: `activeRole`, `activeUser`, `scopedPendingRegistrations`, `AcademicStructureTab`
- Produces: Unlocked "Academic Structure" tab for Deans, with Active Directory table, summary metrics cards, and filters strictly scoped to the Dean's college.

- [ ] **Step 1: Write the failing tests for Dean scoping in `ManageAccountsPage`**

Create `client/src/features/accounts/ManageAccountsPage.deanScope.test.tsx` testing:
1. When logged in as Dean (`activeRole: 'admin', activeUser: { id: 'u-dean', adminSubrole: 'dean', collegeId: 'col-ccs', collegeName: 'College of Computer Science' }`):
   - The "Academic Structure" tab button is rendered and clickable.
   - Clicking "Academic Structure" renders the scoped console.
   - In "Active Directory": only users belonging to `col-ccs` are rendered in the directory table. Users from `College of Education` are filtered out.
   - Summary metric cards (`Total`, `Faculty`, `Students`) reflect the count of users in `col-ccs` only.
   - The department filter dropdown only lists departments under `col-ccs`.

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run src/features/accounts/ManageAccountsPage.deanScope.test.tsx
```
Expected: FAIL (Dean cannot see Academic Structure tab or users are not yet college-scoped).

- [ ] **Step 3: Implement Dean collegiate scoping in `ManageAccountsPage.tsx`**

1. Update tab access check:
   ```ts
   const canAccessAcademicStructure = activeRole === 'superadmin' || (activeRole === 'admin' && activeUser?.adminSubrole === 'dean');
   ```
   Render the tab button if `canAccessAcademicStructure`.
   Render `<AcademicStructureTab />` if `activeMainTab === 'academic-structure' && canAccessAcademicStructure`.
2. Scope directory users for Deans:
   ```ts
   const isDean = activeRole === 'admin' && activeUser?.adminSubrole === 'dean';
   const deanCollegeId = activeUser?.collegeId;
   const deanCollegeName = activeUser?.collegeName?.toLowerCase();

   const scopedDirectoryUsers = useMemo(() => {
     const allUsers = db?.users || [];
     if (!isDean) return allUsers;
     return allUsers.filter(u => {
       if (deanCollegeId && u.collegeId === deanCollegeId) return true;
       if (deanCollegeName && u.collegeName && u.collegeName.toLowerCase() === deanCollegeName) return true;
       return false;
     });
   }, [db?.users, isDean, deanCollegeId, deanCollegeName]);
   ```
3. Use `scopedDirectoryUsers` for:
   - `stats` calculation (`total`, `faculty`, `students`, `admins`, `staff`).
   - `filteredUsers` filtering.
4. Scope department filter options:
   ```ts
   const availableDepartments = useMemo(() => {
     if (isDean && deanCollegeId) {
       return (departments || []).filter(d => d.collegeId === deanCollegeId);
     }
     return departments || [];
   }, [departments, isDean, deanCollegeId]);
   ```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run src/features/accounts/ManageAccountsPage.deanScope.test.tsx
```
Expected: PASS (all tests green).

- [ ] **Step 5: Commit changes**

```bash
git add client/src/features/accounts/ManageAccountsPage.tsx client/src/features/accounts/ManageAccountsPage.deanScope.test.tsx
git commit -m "feat(accounts): unlock academic structure and enforce college-scoped active directory for deans"
```

---

### Task 4: Dynamic Self-Registration Sync & Full Regression Suite

**Files:**
- Test: `client/src/features/auth/RegisterPage.dynamicSync.test.tsx`
- Run: Full Vitest suite (`npm test --workspace=client -- --run`) and TypeScript build (`tsc -b && vite build`)

- [ ] **Step 1: Write integration test proving dynamic registration synchronization**

Create `client/src/features/auth/RegisterPage.dynamicSync.test.tsx`:
1. Render `RegisterPage`.
2. Verify that initially rendered colleges include default colleges.
3. Simulate creating a new College ("College of Allied Health Sciences", "CAHS") and Department ("Department of Nursing", "NURS") via context methods.
4. Verify that selecting the new college immediately populates the new department in the registration dropdowns.

- [ ] **Step 2: Run test to verify it passes**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run src/features/auth/RegisterPage.dynamicSync.test.tsx
```
Expected: PASS.

- [ ] **Step 3: Run full test suite & typecheck to verify zero regressions**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run
npm run build --workspace=client
```
Expected: All 85+ test files pass, 0 TypeScript errors, clean production bundle.

- [ ] **Step 4: Commit changes**

```bash
git add client/src/features/auth/RegisterPage.dynamicSync.test.tsx
git commit -m "test(auth): verify dynamic academic structure synchronization with registration flow"
```
