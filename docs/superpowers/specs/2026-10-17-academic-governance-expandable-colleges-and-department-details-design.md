# Academic Governance: Expandable College Cards & Department Details Console Design

## 1. Intent & Purpose

The Academic Governance console allows institution administrators (Chancellor and Deans) to govern collegiate structures, departments, and leadership appointments. As colleges and departments scale, presenting a flat, always-open list of departments clutters the interface and prevents administrators from focusing on a specific collegiate unit. Furthermore, administrators need a dedicated view to inspect a department's operational health—including its appointed Chairperson, affiliated faculty roster, active course offerings, and enrolled students—and manage department-level leadership appointments directly in place.

This project delivers:
1. **Interactive Expandable/Collapsible College Cards:** Clean hierarchical visual organization on the Academic Governance page, allowing administrators to collapse colleges to hide their departments and expand them on demand.
2. **Dedicated Department Details Page (`/governance/departments/:deptId`):** A comprehensive operational console for an academic department featuring leadership management (in-place Chairperson handover), department metrics, faculty roster, course catalog, and student directory.

---

## 2. Goals, Non-Goals, & Anti-Goals

### Goals
- **Hierarchical College Card Collapse/Expand:** Enable collapsing and expanding college cards on `AcademicStructureTab` with visual chevron indicators and smooth transitions; default to expanded.
- **Deep-Linked Department Navigation:** Clicking any department item in the college card seamlessly navigates to `/governance/departments/:deptId`.
- **In-Place Chairperson Management:** Allow appointing or reassigning the Department Chairperson directly on the department details page, strictly respecting single-seat invariants via `transferLeadership`.
- **Department Metrics & Directories:** Surface real-time counts and tabular directories for faculty members, courses taught, and enrolled students in the department.
- **Role-Based Scoping Integrity:** Enforce Dean collegiate boundaries (a Dean can only view and manage departments within their assigned college) while Chancellor retains institution-wide access.
- **Zero Likha ERP REST DDL Modifications:** Adhere strictly to [`AGENTS.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/AGENTS.md); use existing client context state and standard item queries without triggering Directus schema endpoints.

### Non-Goals
- Curriculum syllabus editing inside the governance department view (syllabus authoring remains under course syllabus tools).
- Creating new Directus collections or altering backend table schemas.
- Student grade manipulation inside the department view (grading remains in Gradebook/SpeedGrader).

### Anti-Goals
- **No Accordion Exclusivity:** Collapsing one college must not forcibly collapse other colleges. Administrators must be able to have multiple colleges expanded or collapsed independently.
- **No Breaking Routing:** Navigating to a department details URL or using browser back/forward buttons must not crash layout panels or violate React Rules of Hooks.

---

## 3. User Experience & Architecture

### 3.1 Expandable / Collapsible College Cards (`AcademicStructureTab.tsx`)
- **State Management:** Local React state `collapsedCollegeIds: Set<string>` (or `Record<string, boolean>`).
- **Default State:** All colleges start expanded.
- **Toggle Mechanism:** Clicking the collapse/expand chevron button or the clickable college header toggles collapse state for that specific college.
- **Visual Design:**
  - Expanded state: Chevron points down (`ChevronDown`), departments list is visible below the header divider.
  - Collapsed state: Chevron points right (`ChevronRight`), departments list is hidden. An inline summary badge (e.g. `1 Department • Click to expand`) indicates hidden contents.
  - Action buttons (e.g., Dean "Reassign") maintain `e.stopPropagation()` so clicking leadership actions does not trigger collapse/expand.

### 3.2 Department Item Click Navigation
- In `AcademicStructureTab`, each department item is rendered as a clickable row with hover highlighting (`hover:bg-accent/40`, `cursor-pointer`).
- Clicking anywhere on the row (except the "Reassign / Appoint" button) invokes `navigate('/governance/departments/' + encodeURIComponent(dept.id))`.
- An affordance arrow (`ArrowRight` or `ExternalLink`) and department code badge visually reinforce that the item is navigable.

### 3.3 Routing & Navigation Infrastructure
- **Route Definition in `App.tsx`:**
  ```tsx
  <Route
    path="/governance/departments/:deptId"
    element={
      <RequireAdmin>
        <RouteWithNav element={(nav) => <DepartmentDetailsPage onNavigateTab={nav.handleNavigateTab} />} />
      </RequireAdmin>
    }
  />
  ```
- **Route Parsing in `client/src/shared/config/routes.ts`:**
  - Update `pathToTab(pathname: string)`:
    ```ts
    if (first === 'governance') {
      if (second === 'departments' && third) {
        return { tab: 'governance', subTab: 'department-details' };
      }
      return { tab: 'governance' };
    }
    ```
  - `isLmsSectionTab('governance')` remains `false`, ensuring that `LMSContextPanel` behaves cleanly and consistently.

### 3.4 Department Details Page (`DepartmentDetailsPage.tsx`)
A new component located at `client/src/features/accounts/DepartmentDetailsPage.tsx`:

#### Section 1: Header & Breadcrumb Context
- Breadcrumb: `Academic Governance > [Parent College Name] > [Department Name]`.
- Back Button: Navigates back to `/governance`.
- Title: Full Department Name with uppercase Code badge (e.g., `Department of Computer Science` `CS`).
- Parent College info with building icon and collegiate code (e.g., `College of Computer Science (CCS)`).

#### Section 2: Chairperson Leadership Console Card
- Incumbent Chairperson Card:
  - Avatar, full name, email, official title (`Department Chairperson`).
  - Active status pill (`Active Chairperson`).
- If no chair is appointed: Alert banner with warning icon (`No Chairperson Appointed`).
- Prominent Action:
  - **"Reassign Chairperson"** / **"Appoint Chairperson"** button.
  - Triggers appointment dialog with candidate selection:
    - **Candidate Pool (Builder Decision):** Eligible candidates are faculty members (`role === 'faculty' || role === 'admin'`) affiliated with the parent college (or institution-wide for Chancellor), prioritizing departmental faculty. This guarantees that newly created departments with 0 initial members are not blocked from appointing a chairperson.
    - Appointing a successor automatically updates their profile metadata (`department: targetDept.name`, `collegeId: targetDept.collegeId`), promotes them to chairperson, steps down the predecessor to faculty, and vacates any previous leadership seat via `transferLeadership()`.

#### Section 3: Key Department Metrics Cards
A 4-column metric grid:
1. **Total Faculty Members:** Total faculty accounts associated with this department (`u.role === 'faculty' && (u.department === dept.name || u.department === dept.code)`).
2. **Total Students Enrolled:** Total registered student accounts associated with this department (`u.role === 'student' && (u.department === dept.name || u.department === dept.code)`).
3. **Active Courses Offered:** Count of courses taught by department faculty, annotated with published vs. draft breakdown.
4. **Class Sections:** Total number of sections across all department courses.

#### Section 4: Segmented Directories & Catalog Tabs
A clean tabbed interface:
1. **Faculty Roster Tab:**
   - Table of faculty members (`avatar`, `name`, `email`, `title`, `courses count`).
   - Highlight tag for the current Chairperson (`Chairperson`).
2. **Courses Catalog Tab:**
   - Table of all courses taught by department faculty.
   - Columns: `Code`, `Title`, `Instructor`, `Enrolled Students`, `Sections Count`, `Status` (`Published` badge / `Draft` badge).
3. **Student Directory Tab:**
   - Table of students enrolled under the department (`name`, `studentId`, `email`, `status: user.verificationStatus`).

#### Section 5: Collegiate Boundary & Security Scoping
- **Chancellor / Superadmin:** Unrestricted institutional oversight across all colleges and departments.
- **Dean:** Scoped to departments within their assigned college (`dept.collegeId === activeUser.collegeId`). If a Dean navigates to a department outside their college, display an unauthorized notice with a button to return to `/governance`.
- **Chairperson:** Scoped to their own assigned department (`dept.id === activeUser.departmentId || dept.chairpersonId === activeUser.id || activeUser.department === dept.name`). If a Chairperson navigates to another department, display an unauthorized notice. Within their own department, Chairpersons can view operational metrics and initiate a handover of their seat.

---

## 4. Constraints & Invariants

1. **Strict Single-Seat Leadership:** At most 1 Dean per college, at most 1 Chairperson per department. Reassigning automatically steps down previous leaders.
2. **Collegiate & Departmental Scoping:** Deans are isolated to their college; Chairpersons to their department.
3. **AGENTS.md Zero DDL Directive:** Zero `/fields`, `/relations`, `/collections`, or `/roles` API calls.
4. **React Rules of Hooks:** All hooks in all components executed unconditionally at top level without early returns.

---

## 5. Builder Decisions & Implementer Choices

- **Student Query Pipeline:** Profile-based querying (`user.department === dept.name || user.department === dept.code`) matching `ManageAccountsPage` and `RegisterPage` canonical department affiliation, displaying `verificationStatus` in the Student Directory.
- **Course Catalog Scope:** Includes both published and draft courses with distinct status badges (`Published` in emerald, `Draft` in amber) to provide complete administrative oversight.
- **Chairperson Handover Candidate Pool:** College-scoped for Deans, institution-wide for Chancellor, allowing cross-unit promotions while ensuring proper profile unit re-alignment.
- **Visual Expand/Collapse Transition:** Smooth height and opacity transition with rotating chevron icon (`ChevronDown` vs `ChevronRight`), defaulting to expanded state.

