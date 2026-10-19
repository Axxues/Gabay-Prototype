# Architecture Design: Academic Role Separation & Jurisdiction Course Monitoring

## 1. Executive Summary & Intent
Gabay LMS is undergoing a fundamental institutional role restructuring. In higher education governance, administrative leadership accounts (Chancellor/Admin, College Dean, Program Chairperson) serve quality assurance, accreditation audit, curriculum monitoring, and institutional oversight functions rather than instructional course delivery.
Under this design:
1. **Strict Dedicated Accounts**: Each user account is provisioned for a single dedicated persona (`faculty`, `dean`, `chairperson`, `admin`, `student`, `staff`).
2. **De-coupling of Dual-Role Faculty/Admin**:
   - Deans, Chairs, and Admins will no longer have teaching course shells, classes, or course-authoring features of their own.
   - Deans, Chairs, and Admins cannot create courses manually.
3. **Course Provisioning Restricted to Chair**:
   - Faculty members do **not** manually create course shells.
   - Course creation is exclusively driven by the **Chairperson** uploading and committing the collegiate **Chair Sheet** (`chair-sheet.xlsx`), which provisions official courses and maps them to assigned faculty instructors.
4. **Jurisdiction-Scoped Monitoring (Option 1: Horizontal Program Tabs + College Switcher)**:
   - **Chairperson**: Sees and monitors only courses belonging to the specific degree program they head. Locked to their program, with an `Upload Chair-Sheet` action button.
   - **Dean**: Monitors courses across all programs in their college. Uses horizontal **Program Tabs** with live course count badges (`[ All Programs (32) ] [ BS Computer Science (18) ] [ BS Info Tech (14) ]`).
   - **Admin / Superadmin**: Monitors courses institution-wide across the entire university. Uses a **College Selector** dropdown + horizontal **Program Tabs** with live course counts.
   - **Faculty**: Sees and manages only their assigned courses where `course.instructorId === activeUser.id`.
   - **Student**: Sees only their enrolled courses.
5. **Deletion of Handover Workflows**:
   - "Reassign Chair", "Reassign Admin", and leadership handover modal dialogs are completely removed from the system.

---

## 2. Jurisdictional Matrix

| Role | Scope Level | Scope Filtering | Manual Course Creation | Chair-Sheet Upload | Monitoring Mode | Teaching Mode |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Admin / Chancellor** | University-Wide | College Selector + Program Tabs | No | No | Full University Audit | No |
| **College Dean** | College-Wide | Fixed College + Program Tabs | No | No | College-Wide Audit | No |
| **Program Chairperson** | Program-Wide | Locked to handled program | No | **Yes** | Program-Wide Audit | No |
| **Faculty Instructor** | Personal Roster | Locked to assigned courses (`instructorId`) | No | No | No | **Full Instruction** |
| **Enrolled Student** | Personal Roster | Locked to enrolled courses | No | No | No | **Learning/Study** |

---

## 3. UI/UX Specifications (Option 1)

### 3.1 Chairperson Dashboard & Course Monitoring View
- **Header**:
  - Badge: `Program: <Program Name> (e.g., Computer Science)`
  - Total Courses indicator: `18 courses`
  - Action Button: `<Upload Chair-Sheet>` (triggers `ChairSheetUploadView`)
  - No "Create Course" manual form button.
- **Course List**:
  - Displays all courses in their program for the active academic year.
  - Clicking any course opens it in **Supervisory Audit Mode** (read-only inspection of syllabus status, learning modules, assessment items, grade submissions, and student roster).

### 3.2 Dean Dashboard & Course Monitoring View
- **Header**:
  - College Badge: `<College Name> (e.g., College of Computer Science)`
  - No "Upload Chair-Sheet" or "Create Course" buttons.
- **Horizontal Program Tabs Bar**:
  - Clean pill/tab bar above the course grid:
    - `[ All Programs (32) ]`
    - `[ BS Computer Science (18) ]`
    - `[ BS Information Technology (14) ]`
  - Tabs show live course count badges for each program.
  - Clicking a tab instantaneously filters the course grid without reloading or changing routes.
- **Controls**:
  - Quick text search (code, title, instructor name).
  - Term filter (`All Terms`, `1st Semester`, `2nd Semester`, `Summer`).
  - School Year selector (`AY 2025-2026`).

### 3.3 Admin / Superadmin Dashboard & Course Monitoring View
- **Header**:
  - Jurisdiction: `University-Wide Academic Oversight`
- **College Selector Dropdown**:
  - Positioned at top-left:
    - `[ All Colleges ▼ ]` / `[ College of Computer Science (CCS) ▼ ]` / `[ College of Education (COE) ▼ ]` ...
- **Dynamic Horizontal Program Tabs**:
  - When a college is selected, displays tabs for that college's programs (e.g. `[ All Programs ] [ CS ] [ IT ]`).
  - When "All Colleges" is selected, shows an all-programs summary.
- **Controls**:
  - Free-text search, term selector, and active academic year selector.

### 3.4 Faculty Dashboard & Course Management
- Displays: "My Teaching Courses".
- Only lists courses where `course.instructorId === activeUser.id`.
- "Create Course" button is completely removed.
- Full authoring permissions for their courses (create modules, draft syllabi, create assignments/quizzes, submit grades).

---

## 4. Deletions & Cleanups
1. **Remove Handover Modals & Actions:**
   - Remove `LeadershipTransferModal` usage from `ProgramDetailsPage.tsx` and `DepartmentDetailsPage.tsx`.
   - Remove "Handover Leadership" / "Reassign Chairperson" buttons and confirmation modals.
   - Remove chair handover triggers from `ManageAccountsPage.tsx`.
2. **Remove Manual Course Creation:**
   - Remove manual `CreateCoursePage` route for non-chair roles.
   - Redirect `/courses/new` and `/courses/chair-sheet` strictly to `ChairSheetUploadView` accessible by Chairpersons only.

---

## 5. Backend Alignment (Likha ERP / Directus)
- Directus roles `Administrator`, `Dean`, `Chairperson`, `Faculty`, `Student`, and `Staff` are maintained as discrete roles.
- `courses` collection permissions:
  - Faculty: Read and Update their own courses (`instructorId == $CURRENT_USER.id`). No `create` permission.
  - Chairperson: Read, Create, and Update on courses in their program (enables Chair-Sheet course batch generation).
  - Dean: Read on all courses in their college.
  - Administrator: Full Read/Audit.
