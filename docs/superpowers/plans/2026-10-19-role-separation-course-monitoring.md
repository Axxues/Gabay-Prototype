# Role Separation & Jurisdiction Course Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement dedicated academic role separation (Admin, Dean, Chairperson, Faculty, Student) where administrative roles exclusively monitor courses within their collegiate/programmatic jurisdiction, delete leadership handover/reassign features, restrict course creation strictly to Chairpersons via Chair-Sheet uploads, and implement Option 1 (horizontal Program tabs + College switcher) course monitoring.

**Architecture:** Extend LMS role definitions and permission utilities to decouple faculty teaching features from administrative personas. Update course scoping to bind Chairpersons strictly to their handled program, Deans to their college, and Admins to the university. Remove manual course creation buttons for Faculty and delete all "Reassign Chair/Admin" handover modals. Build the Option 1 horizontal Program tabs and College filter bar in `DashboardPage` and `CoursesPage`.

**Tech Stack:** React 19, TypeScript 6.0, Tailwind CSS, Lucide Icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-role-separation-course-monitoring-design.md`

## Global Constraints
- Strictly preserve the Directus nodemon stability rule from `AGENTS.md` (no REST DDL calls).
- Faculty accounts must NOT have any manual course creation buttons or routes.
- Course creation is exclusively initiated by the Chairperson uploading and processing the collegiate Chair Sheet (`/courses/chair-sheet`).
- Chairpersons see only courses in their handled program.
- Deans see all courses in their college, with horizontal Program tabs to filter by program (Option 1).
- Admins see all courses in the university, with a College selector + Program tabs (Option 1).
- Leadership handover / "Reassign Chair" modals and buttons are completely deleted.
- Admin, Dean, and Chairperson enter courses in read-only / monitoring mode (no teaching/authoring features).

---

### Task 1: Role Definitions, Permissions & De-coupling Utilities

**Files:**
- Modify: `client/src/shared/types/lms.ts`
- Modify: `client/src/shared/utils/roles.ts`
- Test: `client/src/shared/utils/roles.test.ts`

- [ ] **Step 1: Write tests in `roles.test.ts` for dedicated roles and capabilities**
  - Test `getDisplayRoleLabel`: verifies 'Dean' and 'Chair' are resolved for both explicit roles and subroles.
  - Test `canCreateCourse(user, role)`: returns true ONLY for Chairperson role; returns false for Faculty, Dean, Admin, Student.
  - Test `isAdministrativeMonitor(user, role)`: returns true for Superadmin, Admin, Dean, Chairperson; returns false for Faculty, Student.
- [ ] **Step 2: Run tests to confirm failures**
  - Run: `npm test -- --run src/shared/utils/roles.test.ts`
- [ ] **Step 3: Update `lms.ts` and `roles.ts`**
  - Add `canCreateCourse` and `isAdministrativeMonitor`.
  - Update `getDisplayRoleLabel`, `isDeanRole`, `isChairRole`.
- [ ] **Step 4: Verify tests pass**
  - Run: `npm test -- --run src/shared/utils/roles.test.ts`
- [ ] **Step 5: Commit changes**
  - Git commit: `feat(rbac): implement dedicated role checking and decouple faculty creation permissions`

---

### Task 2: Remove "Reassign Chair" and Leadership Handover Workflows

**Files:**
- Modify: `client/src/features/accounts/ProgramDetailsPage.tsx`
- Modify: `client/src/features/accounts/DepartmentDetailsPage.tsx`
- Modify: `client/src/features/accounts/ManageAccountsPage.tsx`
- Test: `client/src/features/accounts/ProgramDetailsPage.test.tsx`
- Test: `client/src/features/accounts/DepartmentDetailsPage.test.tsx`

- [ ] **Step 1: Update existing tests in `ProgramDetailsPage.test.tsx` and `DepartmentDetailsPage.test.tsx`**
  - Remove assertions that click the handover button or open the leadership handover modal.
  - Assert that incumbent chairperson card displays the chairperson information without the "Reassign Chairperson" button.
- [ ] **Step 2: Remove handover triggers from `ProgramDetailsPage.tsx` & `DepartmentDetailsPage.tsx`**
  - Remove `isTransferModalOpen` state and `LeadershipTransferModal` import and usage.
  - Remove the "Reassign Chairperson" / "Leadership Handover" action buttons.
- [ ] **Step 3: Remove handover triggers from `ManageAccountsPage.tsx`**
  - Remove chair transfer / handover options from user action menus.
- [ ] **Step 4: Verify tests pass**
  - Run: `npm test -- --run src/features/accounts/ProgramDetailsPage.test.tsx src/features/accounts/DepartmentDetailsPage.test.tsx`
- [ ] **Step 5: Commit changes**
  - Git commit: `refactor(accounts): delete reassign chair and leadership handover features`

---

### Task 3: Jurisdictional Course Scoping Engine

**Files:**
- Modify: `client/src/shared/utils/courseScoping.ts`
- Test: `client/src/shared/utils/courseScoping.test.ts`

- [ ] **Step 1: Write unit tests in `courseScoping.test.ts` for strict jurisdiction**
  - Test Chairperson: only returns courses in their specific program; does NOT include courses authored by the chair in another program.
  - Test Dean: returns all courses across all programs in their college; does NOT require the dean to be an instructor.
  - Test Admin: returns all courses university-wide.
  - Test Faculty: returns only courses where `instructorId === activeUser.id`.
- [ ] **Step 2: Run tests to confirm failures**
  - Run: `npm test -- --run src/shared/utils/courseScoping.test.ts`
- [ ] **Step 3: Refactor `courseScoping.ts`**
  - Decouple `course.instructorId === activeUser.id` for administrative roles (Admin, Dean, Chair).
  - Enforce strict program-level matching for Chairperson.
  - Enforce collegiate matching for Dean.
  - Support program-level filtering for Dean and College+Program filtering for Admin.
- [ ] **Step 4: Verify tests pass**
  - Run: `npm test -- --run src/shared/utils/courseScoping.test.ts`
- [ ] **Step 5: Commit changes**
  - Git commit: `feat(courses): update course scoping engine for pure administrative monitoring`

---

### Task 4: Option 1 Course Monitoring UI in `DashboardPage`

**Files:**
- Modify: `client/src/features/dashboard/DashboardPage.tsx`
- Test: `client/src/features/dashboard/DashboardPage.test.tsx`

- [ ] **Step 1: Write tests for Option 1 Course Monitoring UI**
  - Test Faculty: sees "My Teaching Courses", does NOT see "Create Course" or "Upload Chair-Sheet" button.
  - Test Chairperson: sees program monitoring badge/header, sees "Upload Chair-Sheet" button, does NOT see "My Classes" teaching tab.
  - Test Dean: sees College header, sees horizontal Program tabs with live course count badges (`All Programs`, program 1, program 2), clicking a program tab filters the displayed courses.
  - Test Admin: sees College selector dropdown, selecting a college updates the horizontal Program tabs.
- [ ] **Step 2: Implement Option 1 UI in `DashboardPage.tsx`**
  - Add `selectedProgramId` state for filtering within the active college.
  - Add horizontal Program tabs component (`[ All Programs (X) ] [ Program A (Y) ] [ Program B (Z) ]`).
  - Add College selector dropdown for Admin/Superadmin.
  - Lock Chairperson to their assigned program.
  - Hide manual course creation buttons for all roles; keep "Upload Chair-Sheet" exclusively for Chairperson.
- [ ] **Step 3: Verify tests pass**
  - Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx`
- [ ] **Step 4: Commit changes**
  - Git commit: `feat(dashboard): implement option 1 horizontal program tabs and jurisdiction course monitor`

---

### Task 5: Course View Read-Only Audit Mode & Global Navigation Cleanup

**Files:**
- Modify: `client/src/features/courses/CoursesPage.tsx`
- Modify: `client/src/shared/components/common/GlobalSearchDialog.tsx`
- Modify: `client/src/App.tsx`
- Test: `client/src/features/courses/CoursesPage.test.tsx`

- [ ] **Step 1: Update `CoursesPage.tsx` and Route Guards**
  - When Admin, Dean, or Chairperson inspects a course, render in read-only audit mode (disable teaching/grading actions).
  - Remove "Create New Course Shell" from `GlobalSearchDialog.tsx`.
  - Ensure `/courses/chair-sheet` is guarded strictly to `RequireChair`.
- [ ] **Step 2: Verify `CoursesPage.test.tsx` passes**
  - Run: `npm test -- --run src/features/courses/CoursesPage.test.tsx`
- [ ] **Step 3: Commit changes**
  - Git commit: `feat(courses): enforce administrative audit mode and clean up navigation actions`

---

### Task 6: Full Integration Verification

- [ ] **Step 1: Run TypeScript check**
  - Run: `npm run typecheck` (`tsc -b`)
- [ ] **Step 2: Run complete Vitest suite**
  - Run: `npm test -- --run`
- [ ] **Step 3: Final review and report**
