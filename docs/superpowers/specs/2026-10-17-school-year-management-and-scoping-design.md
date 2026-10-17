# School Year Management and Scoping Design

## Intent & The Why
Our client needs a rigorous, institution-wide academic temporal structure: **every piece of data in the system (courses, student enrollments, users) must belong to a School Year** (format like `2025-2026`). 

In universities, academic terms and course catalogs are governed collegiate-by-collegiate: the **College Dean** sets and selects the active School Year for their college. 
To preserve clean historical records without overwhelming users, the system must:
1. Allow the Dean to manage and select the Current School Year for their College.
2. Filter courses so that by default only courses belonging to the college's selected School Year are shown, with a quick navigation switcher to explore past school years. Past courses remain fully viewable and accessible.
3. Require and associate every user account with a School Year upon registration or creation (reflecting their intake / registration academic year). Their accounts are never locked, they retain full system access across all school years, and the Dean/Admin can filter accounts by School Year in `ManageAccountsPage.tsx`.

---

## Goals, Non-Goals, and Anti-Goals

### Goals
- **College-Scoped School Years**: Model `SchoolYear` (`id`, `collegeId`, `year` [e.g. `"2025-2026"`], `isActive`, `createdAt`).
- **Dean Ownership**: Only the College Dean (or Superadmin/Chancellor) can create school years and designate the active school year for that college.
- **Data Tagging**:
  - `Course`: has `schoolYear: string` (e.g. `"2025-2026"`). Required upon course creation.
  - `User`: has `schoolYear?: string` (e.g. `"2025-2026"`). Tagged upon registration or account creation (representing their registration school year).
  - `PendingRegistration`: has `schoolYear: string`.
- **User Account Lifecycle (Per Client Directive)**:
  - Accounts with previous school years do not mutate or overwrite their registration school year tag.
  - Accounts are NEVER locked when a new school year begins; all users retain active system access.
  - Existing users without a `schoolYear` backfill gracefully to the active default school year (`"2025-2026"`).
- **Course Scoping & Historical Navigation**:
  - By default, course listings (`CoursesPage`, course selectors) filter to the college's active/selected school year.
  - Users can select a school year filter in the UI to view courses from previous academic years without losing access. Past courses remain fully viewable and accessible.
- **Account Management Filtering**:
  - Add a dedicated **School Year filter dropdown** to `ManageAccountsPage.tsx` alongside the existing Role and Program filters.
- **Registration & Creation Form Updates**:
  - When a student/faculty registers or is created under a college, their account is assigned to that college's active school year (or chosen from available school years).
- **Backend Safety (AGENTS.md Compliance)**:
  - Resilient local LMS state & Directus item compatibility without breaking REST DDL script calls.
  - Silent fallback handling for missing schema columns.

### Non-Goals
- We are not restructuring semester grading terms (`prelim`, `midterm`, `finals`); those exist within the school year.
- We are not locking or disabling user accounts across school year transitions.
- We are not making past courses read-only or archived unless explicitly requested.

### Anti-Goals
- Do NOT make school years global across all colleges (the client specifically requested it to be per college).
- Do NOT hide past courses permanently: users must have an easy filter switcher to access prior years.
- Do NOT make REST DDL calls to Directus (`/fields`, `/relations`) that could crash the live server.

---

## Data Models & Interfaces

### 1. `SchoolYear` Interface
In `client/src/shared/types/lms.ts`:
```typescript
export interface SchoolYear {
  id: string;
  collegeId: string;
  year: string; // e.g. "2025-2026"
  isActive: boolean;
  createdAt?: string;
}
```

### 2. Entity Associations
- `Course`:
  ```typescript
  export interface Course {
    // ...existing fields
    schoolYear?: string; // e.g. "2025-2026"
  }
  ```
- `User`:
  ```typescript
  export interface User {
    // ...existing fields
    schoolYear?: string; // e.g. "2025-2026"
  }
  ```
- `PendingRegistration`:
  ```typescript
  export interface PendingRegistration {
    // ...existing fields
    schoolYear?: string; // e.g. "2025-2026"
  }
  ```

### 3. Context & State Management (`LMSContext.tsx`)
- State: `schoolYears: SchoolYear[]`, `activeSchoolYearByCollege: Record<string, string>`
- Default data: College of Computer Science (`col-ccs`) initializes with active school year `2025-2026`.
- Methods:
  - `addSchoolYear(collegeId: string, year: string): Promise<{ success: boolean; message?: string }>`
  - `setActiveSchoolYear(collegeId: string, schoolYearId: string): Promise<{ success: boolean; message?: string }>`
  - `getSchoolYearsByCollege(collegeId: string): SchoolYear[]`
  - `getActiveSchoolYearForCollege(collegeId: string): SchoolYear | undefined`

---

## User Interface & User Experience

### 1. Academic Governance / College Management
- In `AcademicStructureTab.tsx`:
  - When viewing a College, display the **School Years** manager for that college.
  - Authorized for **Dean** of that college and **Chancellor/Superadmin**.
  - List configured school years with an "Active" badge.
  - "Add School Year" modal/input (format validation `YYYY-YYYY`).
  - Action button: "Set as Active School Year".

### 2. Course Catalog & Navigation
- In `CoursesPage.tsx`:
  - Filter toolbar includes a School Year selector: defaults to the user's college's active school year (or "All School Years").
  - Users can change the school year dropdown to navigate previous years' courses.
  - Past courses remain accessible and viewable.
- In `CreateCoursePage.tsx`:
  - `School Year` input/dropdown (pre-filled with the active school year of the course's parent college/program, required).

### 3. Account Management (`ManageAccountsPage.tsx`)
- In `ManageAccountsPage.tsx`:
  - Add a **School Year CustomDropdown** next to the Program dropdown.
  - Options: `All School Years`, plus each distinct school year present in the collegiate accounts list.
  - When selected, directory table filters to accounts matching the chosen school year.
  - Display the user's `schoolYear` as a badge or metadata column in the user row.

### 4. Registration & User Creation
- In `RegisterPage.tsx`:
  - When user selects their College, `schoolYear` is automatically populated with that college's active school year (or selectable if multiple are available).
- In `CreateAccountPage.tsx`:
  - Admin/Dean user creator includes a required `School Year` dropdown matching the selected college.

---

## Verification & Testing Strategy
- Unit tests for `LMSContext` school year CRUD and active year toggling.
- Unit tests for `courseScoping` school year filtering and fallback.
- Component tests for `ManageAccountsPage` school year filter.
- Component tests for `AcademicStructureTab` school year management.
- Full regression test run across client workspace (`npm test --workspace=client`).
