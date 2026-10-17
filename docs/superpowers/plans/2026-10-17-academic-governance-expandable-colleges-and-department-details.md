# Academic Governance: Expandable College Cards & Department Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an expandable/collapsible hierarchical view of colleges on the Academic Governance page and a dedicated Department Details console (`/governance/departments/:deptId`) for inspecting department health, metrics, member directories, and performing in-place Chairperson appointments.

**Architecture:** Extend React Router navigation with `/governance/departments/:deptId` under `RequireAdmin`. Enhance `AcademicStructureTab` with independent college card collapse/expand states and department row click-navigation. Implement `DepartmentDetailsPage` consuming `LMSContext` state (`db.users`, `db.courses`, `colleges`, `departments`, `transferLeadership`), providing in-place leadership management, 4-metric statistics, and tabbed directories (Faculty, Courses, Students) with strict Dean collegiate scoping.

**Tech Stack:** React 19, TypeScript 5.9, React Router 7, Tailwind CSS, Lucide React, Vitest, Testing Library.

**Spec:** [`docs/superpowers/specs/2026-10-17-academic-governance-expandable-colleges-and-department-details-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-17-academic-governance-expandable-colleges-and-department-details-design.md)

## Global Constraints

- Zero Likha ERP REST DDL modifications: strictly no `/fields`, `/relations`, `/collections`, or `/roles` API calls per `AGENTS.md`.
- Strict single-seat leadership invariants: at most 1 Dean per college, at most 1 Chairperson per department. Reassignment automatically steps down predecessors to faculty.
- Collegiate scoping: Deans are strictly isolated to their own college (`activeUser.collegeId`).
- React Rules of Hooks: All hooks called unconditionally at top level without early returns.
- Environment path requirement on Windows: Prepend Git and Node for any commands:
  `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"`

## Review Focus

1. **Non-existent department ID:** When accessing `/governance/departments/invalid-id`, the page must render a graceful "Department Not Found" state with a return button rather than throwing undefined errors.
2. **Dean Cross-College Scoping Violation:** When a Dean navigates to a department ID belonging to another college, the page must render an "Unauthorized" banner and hide sensitive directories and appointment actions.
3. **Event Propagation on College Collapse:** Clicking the "Reassign / Appoint Dean" button or child controls inside the college header must not trigger college collapse/expand toggling.
4. **Chairperson Handover Unit Alignment:** Performing Chairperson handover on the department details page must update the successor's `department` and `collegeId` on their user record and session.
5. **Empty Directory Handling:** When a newly created department has 0 courses, 0 faculty, or 0 students, each tab must render an informative empty state without breaking the table layout.

---

### Task 1: Routing & Navigation Infrastructure for Department Details

**Files:**
- Modify: `client/src/shared/config/routes.ts:45-55`
- Modify: `client/src/App.tsx:25-30,260-265`
- Test: `client/src/shared/config/rbacNavigation.test.ts:40-60`

**Interfaces:**
- Consumes: `pathToTab(pathname: string)` in `routes.ts`, `AppShell` in `App.tsx`
- Produces: `pathToTab('/governance/departments/dept-cs') -> { tab: 'governance', subTab: 'department-details', departmentId: 'dept-cs' }`, registered route `/governance/departments/:deptId`

- [ ] **Step 1: Write the failing test**

In `client/src/shared/config/rbacNavigation.test.ts`, add test cases asserting that `pathToTab` parses `/governance/departments/:deptId`:
```ts
    expect(pathToTab('/governance/departments/dept-cs')).toEqual({
      tab: 'governance',
      subTab: 'department-details',
      departmentId: 'dept-cs',
    });
    expect(pathToTab('/governance/departments/dept%201')).toEqual({
      tab: 'governance',
      subTab: 'department-details',
      departmentId: 'dept 1',
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/shared/config/rbacNavigation.test.ts`
Expected: FAIL with `expected { tab: 'governance' } to deeply equal { tab: 'governance', subTab: 'department-details', departmentId: 'dept-cs' }`

- [ ] **Step 3: Implement route parsing and registration**

1. In `client/src/shared/config/routes.ts`:
   Update `pathToTab`:
   ```ts
   if (first === 'governance') {
     if (second === 'departments' && third) {
       return { tab: 'governance', subTab: 'department-details', departmentId: decodeURIComponent(third) };
     }
     return { tab: 'governance' };
   }
   ```
2. In `client/src/App.tsx`:
   Lazy load `DepartmentDetailsPage`:
   ```tsx
   const DepartmentDetailsPage = React.lazy(() => import('./features/accounts/DepartmentDetailsPage').then(m => ({ default: m.DepartmentDetailsPage })));
   ```
   Add route under `RequireAdmin`:
   ```tsx
   <Route path="/governance/departments/:deptId" element={<RequireAdmin><RouteWithNav element={(nav) => <DepartmentDetailsPage onNavigateTab={nav.handleNavigateTab} />} /></RequireAdmin>} />
   ```
   (Provide placeholder export in `client/src/features/accounts/DepartmentDetailsPage.tsx` so compilation passes).

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/shared/config/rbacNavigation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/config/routes.ts client/src/App.tsx client/src/shared/config/rbacNavigation.test.ts client/src/features/accounts/DepartmentDetailsPage.tsx
git commit -m "feat(routes): register department details route and url parser"
```

---

### Task 2: Expandable College Cards & Navigable Department Rows in AcademicStructureTab

**Files:**
- Modify: `client/src/features/accounts/components/AcademicStructureTab.tsx:250-455`
- Test: `client/src/features/accounts/AcademicGovernancePage.test.tsx`

**Interfaces:**
- Consumes: `useLMS()`, `colleges`, `departments`, `useNavigate()`
- Produces: Interactive college card expand/collapse toggle with chevron, clickable department rows navigating to `/governance/departments/:deptId`

- [ ] **Step 1: Write the failing test**

In `client/src/features/accounts/AcademicGovernancePage.test.tsx`, add tests:
1. `collapses and expands college card hiding and showing department rows on click`:
   - Renders `AcademicGovernancePage`.
   - Verifies Department of Computer Science is initially visible.
   - Clicks the college collapse toggle button.
   - Verifies Department of Computer Science is hidden.
   - Clicks the college expand toggle button.
   - Verifies Department of Computer Science is visible again.
2. `navigates to department details page when department row is clicked`:
   - Clicks on the Department of Computer Science row.
   - Verifies navigation was called with `/governance/departments/dept-cs` (or corresponding department ID).

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/AcademicGovernancePage.test.tsx`
Expected: FAIL (collapse toggle not yet implemented)

- [ ] **Step 3: Implement expand/collapse and clickable department rows in `AcademicStructureTab.tsx`**

1. In `AcademicStructureTab.tsx`:
   - Add state: `const [collapsedColleges, setCollapsedColleges] = useState<Record<string, boolean>>({});`
   - Helper function:
     ```ts
     const toggleCollegeCollapse = (collegeId: string) => {
       setCollapsedColleges(prev => ({ ...prev, [collegeId]: !prev[collegeId] }));
     };
     ```
   - In College Header:
     - Add a button or clickable area with `ChevronDown` (when expanded) / `ChevronRight` (when collapsed).
     - Ensure Dean box buttons have `e.stopPropagation()` so reassigning dean does not toggle collapse.
   - In Department Listing:
     - Wrap department list in conditional rendering: `{!isCollapsed && ( ... )}`.
     - When collapsed, display a subtle helper bar: `e.g. <div className="px-5 py-2.5 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between"><span>{collegeDepts.length} departments collapsed</span><button onClick={() => toggleCollegeCollapse(college.id)} className="text-primary font-bold hover:underline">Expand</button></div>`.
     - In each department row, make the row clickable:
       ```tsx
       <div
         key={dept.id}
         onClick={() => navigate(`/governance/departments/${encodeURIComponent(dept.id)}`)}
         className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/40 cursor-pointer transition-colors group"
       >
         ...
       </div>
       ```
     - Prevent row navigation when clicking the Chairperson Reassign / Appoint button via `e.stopPropagation()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/AcademicGovernancePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/accounts/components/AcademicStructureTab.tsx client/src/features/accounts/AcademicGovernancePage.test.tsx
git commit -m "feat(governance): implement expandable college cards and department click navigation"
```

---

### Task 3: Department Details Console Component (`DepartmentDetailsPage.tsx`)

**Files:**
- Create: `client/src/features/accounts/DepartmentDetailsPage.tsx`
- Create: `client/src/features/accounts/DepartmentDetailsPage.test.tsx`

**Interfaces:**
- Consumes: `useParams<{ deptId: string }>()`, `useLMS()`, `transferLeadership`, `db.users`, `db.courses`, `colleges`, `departments`
- Produces: Complete `DepartmentDetailsPage` component with Breadcrumb header, in-place Chairperson appointment modal, 4-metric statistics grid, tabbed directories (Faculty, Courses, Students), and Dean collegiate authorization guards.

- [ ] **Step 1: Write the failing tests**

In `client/src/features/accounts/DepartmentDetailsPage.test.tsx`, write tests verifying:
1. `renders department header, breadcrumbs, and parent college`:
   - Renders `/governance/departments/dept-cs`.
   - Asserts breadcrumbs contain "Academic Governance" and "Department of Computer Science".
   - Asserts parent college "College of Computer Science" is displayed.
2. `displays 4 department metrics accurately`:
   - Checks Total Faculty, Total Students, Active Courses, Class Sections cards.
3. `renders chairperson card and executes in-place appointment`:
   - Shows current Chairperson (Marcus Brody).
   - Clicks "Reassign Chairperson" button.
   - Selects eligible faculty candidate and confirms handover.
   - Verifies `transferLeadership` was called with `'chairperson'`, predecessor, successor, and department ID.
4. `switches between Faculty, Courses, and Student directory tabs`:
   - Verifies Faculty roster table displays department instructors.
   - Clicks "Courses" tab: verifies department courses with status badges (`Published`/`Draft`).
   - Clicks "Students" tab: verifies enrolled students and verification status.
5. `renders unauthorized notice if a Dean attempts to view a department from another college`:
   - Mock activeUser as Dean of College of Education.
   - Accesses Department of Computer Science (College of Computer Science).
   - Asserts "Access Restricted" banner is shown with button to return to Governance.
6. `renders department not found notice if invalid ID is provided`:
   - Accesses `/governance/departments/nonexistent`.
   - Asserts "Department Not Found" message.

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/DepartmentDetailsPage.test.tsx`
Expected: FAIL (component not yet fully implemented)

- [ ] **Step 3: Implement `DepartmentDetailsPage.tsx`**

Build `DepartmentDetailsPage.tsx` adhering to the design specification:
1. **Header & Context:**
   - Use `useParams<{ deptId: string }>()`. Look up `dept = departments.find(d => d.id === deptId)`.
   - Breadcrumb navigation: `Academic Governance > [College Name] > [Department Name]`.
   - Back button calling `navigate('/governance')`.
2. **Scoping & Guards:**
   - If `!dept`: render "Department Not Found" card with back button.
   - If `isDean && dept.collegeId !== effectiveDeanCollegeId`: render Access Restricted alert.
3. **Chairperson Card & Leadership Appointment:**
   - Display Chairperson avatar, name, email, title.
   - "Reassign Chairperson" / "Appoint Chairperson" button.
   - In-place modal selecting eligible candidates (`role === 'faculty' || role === 'admin'`).
   - Calls `transferLeadership('chairperson', dept.chairpersonId || 'none', selectedCandidateId, dept.id)`.
4. **Metrics Grid:**
   - Faculty count: `db.users.filter(u => u.role === 'faculty' && (u.department === dept.name || u.department === dept.code))`
   - Student count: `db.users.filter(u => u.role === 'student' && (u.department === dept.name || u.department === dept.code))`
   - Courses count: `db.courses.filter(c => facultyIds.has(c.instructorId))`
   - Sections count: `db.courseSections.filter(s => courseIds.has(s.courseId))`
5. **Tabbed Directories (`faculty` | `courses` | `students`):**
   - Faculty table with Avatar, Name, Email, Title, Courses Taught, and Chairperson badge.
   - Courses table with Code, Title, Instructor Name, Enrolled Count, Section Count, and Status (`Published` / `Draft`).
   - Students table with Name, Student ID, Email, and Status (`user.verificationStatus`).
   - Informative empty states when directories have 0 items.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/DepartmentDetailsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/accounts/DepartmentDetailsPage.tsx client/src/features/accounts/DepartmentDetailsPage.test.tsx
git commit -m "feat(governance): implement dedicated department details page with metrics and leadership appointment"
```

---

### Task 4: Full Regression Verification & Production Build Gate

**Files:**
- Verified: All client test suites, linter, and production build

**Interfaces:**
- Consumes: Complete client codebase
- Produces: 100% test pass rate, 0 lint warnings, clean production bundle

- [ ] **Step 1: Run linter on modified files**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npx oxlint client/src/features/accounts/DepartmentDetailsPage.tsx client/src/features/accounts/components/AcademicStructureTab.tsx client/src/shared/config/routes.ts client/src/App.tsx`
Expected: 0 warnings, 0 errors

- [ ] **Step 2: Run full client test suite**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run`
Expected: 100% test files PASS (580+ tests passing, 0 failures)

- [ ] **Step 3: Run client production build**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm run build --workspace=client`
Expected: 0 errors, build generated cleanly (`tsc -b && vite build`)

- [ ] **Step 4: Commit and stage final branch state**

```bash
git status
```
Confirm clean working tree.
