# Academic Structure Deletion and Cascading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable administrators (Chancellor/Superadmin) and Deans to safely delete colleges and departments in the LMS academic hierarchy, enforcing strict blocker checks (no assigned leaders, no enrolled/affiliated users), displaying explanatory blocker modals when deletion is prohibited, and supporting automated cascading department deletion when removing an empty college.

**Architecture:** Extend `LMSContext` with domain validation helpers and deletion methods (`deleteCollege`, `deleteDepartment`) that clean up React state, persist to `localStorage`, and synchronize with Likha ERP Directus item deletion endpoints (`DELETE /items/colleges/:id` and `DELETE /items/departments/:id`). Integrate interactive deletion triggers, a blocker modal, and a destructive confirmation modal in `AcademicStructureTab.tsx`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind CSS, Lucide Icons, Directus REST API.

**Spec:** Inline requirements agreed with user:
1. Superadmin/Chancellor can delete colleges and departments.
2. College Dean can delete departments belonging to their college (cannot delete colleges).
3. Deletion is blocked if there is an assigned leader (Dean or Chairperson) or any affiliated users in the unit.
4. If blocked, display a modal explaining that the unit still has users/leaders.
5. If eligible, display a confirmation modal. Deleting a college cascades to all its empty child departments.

## Global Constraints
- Zero Directus DDL/schema modifications (`/fields`, `/relations`, `/collections`) per `AGENTS.md`. Only standard item deletions (`DELETE /items/colleges/:id`, `DELETE /items/departments/:id`).
- Respect role permissions: Chancellor/Superadmin can delete colleges and departments; Dean can delete only departments in their college; Chairpersons/Faculty/Students cannot delete either.
- Maintain documentation integrity and preserve existing test coverage.

## Review Focus
1. Attempting to delete a department with active students/faculty or an assigned chairperson must be blocked and return descriptive reasons.
2. Attempting to delete a college that contains child departments where even one department has an assigned chairperson or enrolled user must be blocked.
3. Deleting a college whose child departments are all empty must cascade-delete the child departments both locally and in Likha ERP.
4. Dean attempting to delete a department in another college must be rejected with a permission error.
5. Deletion must persist across browser reloads via `localStorage` and Directus backend sync.

---

### Task 1: LMS Context Academic Unit Deletion Engine & Validation Methods

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx`
- Create: `client/src/shared/context/LMSContext.academicStructureDelete.test.tsx`

**Steps:**
- [ ] 1. Write comprehensive tests in `client/src/shared/context/LMSContext.academicStructureDelete.test.tsx` testing:
  - Department deletion blocked when a chairperson is assigned.
  - Department deletion blocked when users are affiliated with the department (`user.department === dept.name` or `user.departmentId === dept.id`).
  - Department deletion succeeds when empty and leaderless; removes from `departments` and calls `likhaLmsApi.academicStructure.deleteDepartment`.
  - College deletion blocked when a dean is assigned.
  - College deletion blocked when users are affiliated anywhere in the college or its departments.
  - College deletion blocked when any child department has a chairperson.
  - College deletion succeeds when college and child departments are empty; removes college and all child departments from state, `localStorage`, and calls `deleteDepartment` for each child and `deleteCollege`.
  - Dean permission enforcement (can delete own college's department, rejected for other colleges, cannot delete college).
- [ ] 2. Run test to verify RED:
  `npm test --workspace=client -- --run src/shared/context/LMSContext.academicStructureDelete.test.tsx`
- [ ] 3. Update `LMSContextType` in `client/src/shared/context/LMSContext.tsx` to declare:
  - `deleteCollege: (collegeId: string) => Promise<{ success: boolean; message: string; blockers?: string[] }>;`
  - `deleteDepartment: (departmentId: string) => Promise<{ success: boolean; message: string; blockers?: string[] }>;`
  - `getCollegeDeleteBlockers: (collegeId: string) => string[];`
  - `getDepartmentDeleteBlockers: (departmentId: string) => string[];`
- [ ] 4. Implement `getDepartmentDeleteBlockers`, `getCollegeDeleteBlockers`, `deleteDepartment`, and `deleteCollege` in `LMSContext.tsx`:
  - Enforce role scoping (Chancellor for colleges and departments; Dean for departments in `deanCollegeId`).
  - Calculate blockers cleanly (check `deanId`, `chairpersonId`, `db.users` matching college or department).
  - Perform state removal, `safeSetLocalStorage`, and best-effort Directus `likhaLmsApi.academicStructure.deleteDepartment` / `deleteCollege`.
- [ ] 5. Run test to verify GREEN:
  `npm test --workspace=client -- --run src/shared/context/LMSContext.academicStructureDelete.test.tsx`
- [ ] 6. Commit Task 1:
  `git commit -m "feat(context): add college and department deletion engine with validation and cascading"`

---

### Task 2: AcademicStructureTab UI Controls, Blocker Modal & Confirmation Modal

**Files:**
- Modify: `client/src/features/accounts/components/AcademicStructureTab.tsx`
- Modify: `client/src/features/accounts/components/AcademicStructureTab.test.tsx`

**Steps:**
- [ ] 1. Add unit tests in `AcademicStructureTab.test.tsx` testing:
  - Delete button renders for Chancellor on colleges and departments.
  - Delete button renders for Dean on departments in their college, but NOT on colleges.
  - Clicking delete when unit has blockers opens the Blocker Modal displaying the specific reasons.
  - Clicking delete when unit is eligible opens the Confirmation Modal (displaying cascade warning if college has child departments).
  - Confirming deletion triggers `deleteCollege` or `deleteDepartment` and shows success notification.
- [ ] 2. Run test to verify RED:
  `npm test --workspace=client -- --run src/features/accounts/components/AcademicStructureTab.test.tsx`
- [ ] 3. Update `AcademicStructureTab.tsx`:
  - Consume `deleteCollege`, `deleteDepartment`, `getCollegeDeleteBlockers`, and `getDepartmentDeleteBlockers` from `useLMS()`.
  - Add state for blocker modal (`blockerModalData: { title: string; unitName: string; blockers: string[] } | null`).
  - Add state for confirmation modal (`deleteConfirmModalData: { type: 'college' | 'department'; id: string; name: string; code: string; childDepartments?: Department[] } | null`).
  - Add Delete button (Trash2 icon) in College header row for Superadmin/Chancellor.
  - Add Delete button (Trash2 icon) in Department row for Superadmin/Chancellor or Dean of parent college.
  - Implement Blocker Modal (`DialogFrame` with Warning icon, explanation, list of blockers, and Close button).
  - Implement Confirmation Modal (`DialogFrame` with destructive style, cascade details if child departments exist, Cancel, and Delete buttons).
- [ ] 4. Run test to verify GREEN:
  `npm test --workspace=client -- --run src/features/accounts/components/AcademicStructureTab.test.tsx`
- [ ] 5. Commit Task 2:
  `git commit -m "feat(accounts): add academic unit deletion controls with blocker and confirmation modals"`

---

### Task 3: Full End-to-End Regression Gate & Production Build

**Files:**
- Verify: Full repository

**Steps:**
- [ ] 1. Run all client tests:
  `npm test --workspace=client -- --run`
- [ ] 2. Run client production build and typecheck:
  `npm run build --workspace=client`
- [ ] 3. Self-review git status and git diff.
