# Dynamic Academic Hierarchy Governance & Delegated Leadership Appointments Design

## 1. Intent & Context

Gabay LMS previously maintained an academic structure (colleges and departments) that was either seeded from static defaults or restricted to Chancellor-only inspection. The user has requested that:
1. Academic hierarchy management (colleges and departments) is **fully dynamic**.
2. The **Chancellor (`superadmin`)** has institutional authority to:
   - Create new colleges and assign a Dean to them in an integrated workflow.
   - Create new departments under any college and assign a Chairperson to them in an integrated workflow.
   - Reassign or transfer Deans and Chairpersons university-wide.
3. The **Dean (`admin` with `adminSubrole: 'dean'`)** has delegated authority to:
   - Access the Academic Structure console scoped strictly to their assigned college.
   - Create new departments within their college and assign a Chairperson to them in an integrated workflow.
   - Reassign or transfer Chairpersons for departments within their college.
   - Cannot create colleges or reassign the Dean seat (governed exclusively by the Chancellor).
4. All newly created colleges and departments must immediately become available across the entire platform, including the self-registration form (`/register`), directory filters, and course assignments.

---

## 2. Invariants & Architecture Constraints

1. **Strict Single-Seat Leadership Invariants**:
   - Exactly **1 Chancellor** university-wide (`superadmin`).
   - At most **1 Dean** per college.
   - At most **1 Chairperson** per department.
   - If an already-occupied seat is reassigned, the predecessor is atomically stepped down to faculty (`role: 'faculty'`, `adminSubrole: undefined`), ensuring no ghost administrators or duplicated seats exist.

2. **Hierarchical Scope Boundaries**:
   - **Chancellor (`superadmin`)**:
     - Global visibility of all colleges and departments across the university.
     - Can add colleges, add departments to any college, and appoint/reassign both Deans and Chairpersons from any faculty member university-wide.
     - Active Directory, metric cards, and pending verifications cover all university accounts.
   - **Dean (`admin` with `adminSubrole === 'dean'`)**:
     - **Strict College-Only Scope**: All capabilities in Account Management are strictly bounded to the Dean's assigned college (`activeUser.collegeId`):
       - **Academic Structure**: Only sees their assigned college card and its departments. Cannot create colleges or reassign the Dean seat.
       - **Department Provisioning & Chair Appointments**: Can create departments in their college and appoint/reassign Chairpersons. Candidate selection dropdown is strictly filtered to faculty belonging to their college.
       - **Active Directory & Metrics**: User directory table, summary cards (`Total`, `Faculty`, `Students`, etc.), and department filters are strictly scoped to users within their college.
       - **Pending Verifications**: Scoped to registrants within their college.
   - **Chairperson & Faculty & Students**:
     - No access to the Academic Structure management tab.

3. **Multi-Unit Vacancy & Succession Invariant**:
   - When a faculty member who currently holds a leadership position (e.g. Chair of Dept A or Dean of College A) is appointed to a new leadership seat (e.g. Dean of College B or Chair of Dept B):
     - Their prior leadership seat is atomically vacated (`deanId: undefined` or `chairpersonId: undefined`), preventing orphaned or duplicate seats.
     - The single-seat invariant is strictly maintained across all units.

4. **Zero Likha ERP REST DDL Modifications**:
   - In accordance with `AGENTS.md`, no Directus REST DDL calls (`/fields`, `/relations`, `/collections`) are permitted.
   - Colleges and departments are persisted in local LMS context with browser storage sync (`STORAGE_KEY_COLLEGES`, `STORAGE_KEY_DEPARTMENTS`), instantly shared across components via `LMSContext`.

---

## 3. User Experience & Component Specifications

### 3.1. Tab Navigation in Account Management (`client/src/features/accounts/ManageAccountsPage.tsx`)
- The **"Academic Structure"** tab header is unlocked for both `superadmin` and Deans (`activeRole === 'admin' && activeUser?.adminSubrole === 'dean'`).
- When viewed by a Dean, the tab displays a badge showing their college code (e.g. "Academic Structure (CCS)").
- Route guards permit both `superadmin` and `admin` to access `/accounts`.

### 3.2. Scoped Academic Structure Console (`client/src/features/accounts/components/AcademicStructureTab.tsx`)
- **Header Section**:
  - **Chancellor View**: Shows total colleges and total departments count. Provides two action buttons: `+ Add College` and `+ Add Department`.
  - **Dean View**: Header reflects "College Academic Structure: [College Name]". Provides a single action button: `+ Add Department` (automatically scoped to the Dean's college). `+ Add College` is hidden.
- **College Cards**:
  - Chancellor sees all colleges.
  - Dean sees only their assigned college (matching `college.id === activeUser.collegeId` or fallback by name).
  - **Dean Seat Card in College Header**:
    - For Chancellor: Shows current Dean with "Reassign" button (or "Appoint" if unassigned).
    - For Dean: Shows current Dean with badge `(You)` or `(Current Dean)`, without a Reassign button.
- **Departments Table in College**:
  - Lists all departments under the college.
  - For each department, displays the current Chairperson:
    - If assigned: Shows avatar, name, and "Reassign" button (available to both Chancellor and the college Dean).
    - If unassigned: Shows warning pill "No Chair Appointed" and "Appoint" button (available to both Chancellor and the college Dean).

### 3.3. In-Place Unified Creation Modals
1. **Create College Modal (Chancellor Only)**:
   - Fields:
     - College Name (e.g., "College of Allied Health Sciences")
     - College Code (e.g., "CAHS")
     - Initial Dean: Dropdown listing eligible faculty/admins (`role: 'faculty' | 'admin'`), with option `Leave Unassigned (Appoint Later)`.
   - On submission: creates the college and, if a Dean is selected, atomically appoints them as Dean.
2. **Add Department Modal (Chancellor & Dean)**:
   - Fields:
     - Parent College:
       - For Chancellor: Selectable dropdown of all colleges.
       - For Dean: Locked / disabled dropdown fixed to the Dean's college.
     - Department Name (e.g., "Department of Nursing")
     - Department Code (e.g., "NURS")
     - Initial Chairperson: Dropdown listing eligible candidates with option `Leave Unassigned (Appoint Later)`.
       - For Dean: Candidate dropdown prioritizes or lists faculty from their college.
   - On submission: creates the department and, if a Chairperson is selected, atomically appoints them as Chairperson.

### 3.4. Dynamic Synchronization
- **Self-Registration (`RegisterPage.tsx`)**:
  - The College dropdown reads directly from `colleges`. Any dynamically created college shows up instantly.
  - The Department dropdown reads from `departments` filtered by the selected `collegeId`. Any dynamically created department shows up instantly.
- **Active Directory Filters (`ManageAccountsPage.tsx`)**:
  - Department filter dropdown dynamically populates with all departments from `departments`.

---

## 4. State Management & API Contracts (`LMSContext.tsx`)

1. **`addCollege(college: College, initialDeanId?: string): Promise<College>`**:
   - Appends the new college to `colleges` state and persists to `localStorage`.
   - If `initialDeanId` is provided:
     - Promotes the candidate to `role: 'admin'`, `adminSubrole: 'dean'`, `collegeId: college.id`, `collegeName: college.name`.
     - Updates `college.deanId = initialDeanId`.
     - Preserves single-seat invariant (if seat was previously held, steps predecessor down).

2. **`addDepartment(department: Department, initialChairId?: string): Promise<Department>`**:
   - Appends the new department to `departments` state and persists to `localStorage`.
   - If `initialChairId` is provided:
     - Promotes the candidate to `role: 'admin'`, `adminSubrole: 'chairperson'`, `collegeId: department.collegeId`, `department: department.name`.
     - Updates `department.chairpersonId = initialChairId`.
     - Preserves single-seat invariant (if seat was previously held, steps predecessor down).

3. **`transferLeadership(roleType, currentLeaderId, successorId, unitId)`**:
   - Existing robust implementation handles reassignment and predecessor demotion for both Deans and Chairpersons.

---

## 5. Verification & Testing Plan

1. **Unit & Integration Tests**:
   - **Access Control Test**:
     - Dean can see the "Academic Structure" tab and view their own college.
     - Dean cannot see other colleges in the Academic Structure console.
     - Dean cannot see the "+ Add College" button or "Reassign" Dean button.
     - Chancellor sees all colleges, "+ Add College", and can reassign any Dean or Chair.
   - **Unified Creation & Appointment Test**:
     - Chancellor creates a college and selects a faculty member as initial Dean -> College created, faculty promoted to Dean, single-seat maintained.
     - Dean creates a department and selects a faculty member as initial Chair -> Department created under Dean's college, faculty promoted to Chair.
   - **Dynamic Registration Sync Test**:
     - Newly added college and department immediately appear in `RegisterPage` dropdowns without full page reload.
2. **Regression Check**:
   - Run full Vitest suite (`npm test --workspace=client -- --run`).
   - Run TypeScript typecheck (`tsc -b`).
