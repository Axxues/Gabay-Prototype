# User Profile Onboarding and Academic Rollover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement mandatory profile completion with first-login redirection to `/profile`, a persistent reminder banner, role-specific profile fields for students and faculty/staff, and school-year rollover auto-incrementing for year level and teaching experience.

**Architecture:** Extend the LMS `User` data model with normalized student and faculty attributes. Integrate profile completion check utilities that drive login navigation and render a persistent banner in `AppShell`. Build rich interactive profile editing sections in `ProfilePage.tsx` and academic governance edit capabilities in `EditAccountPage.tsx`, and augment `setActiveSchoolYear` to automatically increment student year levels (capped at 4) and faculty teaching tenure upon rollover.

**Tech Stack:** React 19, TypeScript, React Router 7, Tailwind CSS, Lucide icons, Vitest, Testing Library.

**Spec:** [docs/superpowers/specs/2026-10-18-user-profile-onboarding-and-academic-rollover-design.md](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-18-user-profile-onboarding-and-academic-rollover-design.md)

## Global Constraints
- Do not make REST API calls to `/fields` or `/relations` or attempt DDL alterations on Directus / Likha ERP (mandatory directive in AGENTS.md).
- User navigation must NOT be hard-blocked: the user is redirected to `/profile` upon initial login, but can navigate anywhere while the persistent notification banner stays active.
- Student year levels default to 1, cannot be edited by the student, can be edited by Dean / Chairperson, and auto-increment up to 4 upon rollover.
- Educational degrees must support Bachelors, Masters, Post-Masters, Doctorate, and Post-Doctorate with institution, graduation year, and specialization.

## Review Focus
1. Present address auto-sync: When "Same as permanent address" is checked, typing into permanent address immediately mirrors into present address and prevents manual editing.
2. Parent vs Guardian toggle: Switching to guardian mode requires guardian fields and does not fail on missing mother/father fields.
3. Year level upper bound: Student rollover at year level 4 remains at 4 and never exceeds 4.
4. Non-student faculty rollover: Faculty teaching years increment on rollover regardless of starting value (defaults to 0 + 1).
5. First login redirect edge case: Users with already complete profiles continue directly to `/dashboard`.

---

### Task 1: Profile Types and Validation Utilities

**Files:**
- Modify: `client/src/shared/types/lms.ts`
- Create: `client/src/shared/utils/profileCompletion.ts`
- Create: `client/src/shared/utils/profileCompletion.test.ts`

**Interfaces:**
- Consumes: `User`, `UserRole` from `client/src/shared/types/lms.ts`
- Produces: `isProfileComplete(user: Partial<User> | null | undefined): boolean`, `NormalizedPersonName`, `EducationalDegree`, `DegreeLevel`

- [ ] **Step 1: Write failing unit test for `isProfileComplete`**

```typescript
// client/src/shared/utils/profileCompletion.test.ts
import { describe, it, expect } from 'vitest';
import { isProfileComplete } from './profileCompletion';
import type { User } from '../types/lms';

describe('isProfileComplete', () => {
  it('returns false for newly registered student with missing fields', () => {
    const student = { role: 'student', yearLevel: 1 } as User;
    expect(isProfileComplete(student)).toBe(false);
  });

  it('returns true for student with all required profile information', () => {
    const student = {
      role: 'student',
      birthday: '2004-05-15',
      permanentAddress: '123 Main St, City',
      presentAddress: '123 Main St, City',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Maria', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09987654321',
      yearLevel: 1,
    } as User;
    expect(isProfileComplete(student)).toBe(true);
  });

  it('returns true for student with guardian info when hasGuardianOnly is true', () => {
    const student = {
      role: 'student',
      birthday: '2004-05-15',
      permanentAddress: '123 Main St, City',
      presentAddress: '456 College Dorm, City',
      sameAsPermanentAddress: false,
      contactNumber: '09123456789',
      hasGuardianOnly: true,
      guardianName: { firstName: 'Pedro', lastName: 'Santos' },
      parentContactNumber: '09987654321',
      yearLevel: 2,
    } as User;
    expect(isProfileComplete(student)).toBe(true);
  });

  it('returns false for faculty with missing educational background', () => {
    const faculty = {
      role: 'faculty',
      address: '789 Faculty Village',
      contactNumber: '09112223333',
      birthday: '1985-10-20',
      yearsOfTeaching: 5,
      educationalBackground: []
    } as User;
    expect(isProfileComplete(faculty)).toBe(false);
  });

  it('returns true for faculty with complete background', () => {
    const faculty = {
      role: 'faculty',
      address: '789 Faculty Village',
      contactNumber: '09112223333',
      birthday: '1985-10-20',
      yearsOfTeaching: 5,
      educationalBackground: [
        {
          id: 'deg-1',
          degreeLevel: 'bachelors',
          school: 'DMMMSU',
          yearGraduated: 2007,
          specialization: 'Computer Science'
        }
      ]
    } as User;
    expect(isProfileComplete(faculty)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/shared/utils/profileCompletion.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement types and `profileCompletion.ts`**

Update `client/src/shared/types/lms.ts` with `NormalizedPersonName`, `DegreeLevel`, `EducationalDegree`, and profile fields on `User`.
Create `client/src/shared/utils/profileCompletion.ts` with validation logic for students, faculty, and staff.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/shared/utils/profileCompletion.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/types/lms.ts client/src/shared/utils/profileCompletion.ts client/src/shared/utils/profileCompletion.test.ts
git commit -m "feat(profile): add profile completion types and validation utility"
```

---

### Task 2: Persistent Profile Incomplete Notification Banner

**Files:**
- Create: `client/src/shared/components/layout/ProfileIncompleteBanner.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/shared/components/layout/ProfileIncompleteBanner.test.tsx`

**Interfaces:**
- Consumes: `useLMS()`, `isProfileComplete()`
- Produces: `ProfileIncompleteBanner` rendered inside `AppShell`

- [ ] **Step 1: Write unit test for `ProfileIncompleteBanner`**

Test that when `isProfileComplete(activeUser)` is false, banner renders warning message and link button to `/profile`; when true, renders null.

- [ ] **Step 2: Run test to verify failure**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/shared/components/layout/ProfileIncompleteBanner.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `ProfileIncompleteBanner` and insert into `AppShell` in `App.tsx`**

Place the banner directly below `Topbar` in `AppShell` so it stays visible regardless of the active route.

- [ ] **Step 4: Run test to verify pass**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/shared/components/layout/ProfileIncompleteBanner.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/components/layout/ProfileIncompleteBanner.tsx client/src/shared/components/layout/ProfileIncompleteBanner.test.tsx client/src/App.tsx
git commit -m "feat(layout): add persistent banner for incomplete user profile"
```

---

### Task 3: Login Redirect to `/profile` for Incomplete Accounts

**Files:**
- Modify: `client/src/features/auth/LoginPage.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/features/auth/LoginPage.profileRedirect.test.tsx`

**Interfaces:**
- Consumes: `isProfileComplete`, `login()` from `LMSContext`
- Produces: conditional navigation to `/profile` if profile incomplete, `/dashboard` if complete

- [ ] **Step 1: Write failing test in `LoginPage.profileRedirect.test.tsx`**

Verify that on successful login:
- If user profile is incomplete, user is navigated to `/profile`.
- If user profile is complete, user is navigated to `/dashboard`.

- [ ] **Step 2: Run test to verify failure**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/features/auth/LoginPage.profileRedirect.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `LoginPage.tsx` and `LoginRoute` in `App.tsx`**

Return user object or check `isProfileComplete` from current session user upon login. If `!isProfileComplete`, navigate to `/profile`.

- [ ] **Step 4: Run test to verify pass**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/features/auth/LoginPage.profileRedirect.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/auth/LoginPage.tsx client/src/App.tsx client/src/features/auth/LoginPage.profileRedirect.test.tsx
git commit -m "feat(auth): redirect newly approved or incomplete accounts to profile on login"
```

---

### Task 4: Student Profile Form Component and Integration in `ProfilePage`

**Files:**
- Create: `client/src/features/auth/components/StudentProfileForm.tsx`
- Modify: `client/src/features/auth/ProfilePage.tsx`
- Create: `client/src/features/auth/components/StudentProfileForm.test.tsx`

**Interfaces:**
- Consumes: `User`, `updateUser`
- Produces: Form with Birthday, Permanent Address, Same-As Checkbox, Present Address, Contact Number, Parents/Guardian Toggle & Inputs, Parent Contact Number, Read-only Year Level.

- [ ] **Step 1: Write failing unit test for `StudentProfileForm`**

Test:
- Checking "Same as permanent address" copies permanent address to present address and disables the present address input.
- Switching to "Guardian" shows guardian name inputs and hides mother/father inputs.
- Year level input is disabled with clear badge indicating it can only be modified by Program Chair or Dean.
- Submitting saves data via `updateUser`.

- [ ] **Step 2: Run test to verify failure**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/features/auth/components/StudentProfileForm.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `StudentProfileForm.tsx` and embed in `ProfilePage.tsx`**

Add the form to the Overview tab or dedicated Profile Information section in `ProfilePage.tsx`.

- [ ] **Step 4: Run test to verify pass**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/features/auth/components/StudentProfileForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/auth/components/StudentProfileForm.tsx client/src/features/auth/components/StudentProfileForm.test.tsx client/src/features/auth/ProfilePage.tsx
git commit -m "feat(profile): implement student profile details and parental normalization"
```

---

### Task 5: Faculty/Staff Profile Form Component and Integration in `ProfilePage`

**Files:**
- Create: `client/src/features/auth/components/FacultyProfileForm.tsx`
- Modify: `client/src/features/auth/ProfilePage.tsx`
- Create: `client/src/features/auth/components/FacultyProfileForm.test.tsx`

**Interfaces:**
- Consumes: `User`, `EducationalDegree`, `updateUser`
- Produces: Form with Address, Contact Number, Birthday, Years of Teaching Experience, and Dynamic Degree List (Bachelors, Masters, Post-Masters, Doctorate, Post-Doctorate).

- [ ] **Step 1: Write failing unit test for `FacultyProfileForm`**

Test:
- Can add multiple degrees with degree level, school, year graduated, and specialization.
- Can remove a degree.
- Shows years of teaching experience with badge indicating auto-increment on school year rollover.
- Submitting saves data via `updateUser`.

- [ ] **Step 2: Run test to verify failure**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/features/auth/components/FacultyProfileForm.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `FacultyProfileForm.tsx` and embed in `ProfilePage.tsx`**

Conditionally render `FacultyProfileForm` when `activeRole === 'faculty' || activeRole === 'staff'`.

- [ ] **Step 4: Run test to verify pass**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/features/auth/components/FacultyProfileForm.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/auth/components/FacultyProfileForm.tsx client/src/features/auth/components/FacultyProfileForm.test.tsx client/src/features/auth/ProfilePage.tsx
git commit -m "feat(profile): implement faculty and staff profile details with multiple degrees"
```

---

### Task 6: School Year Rollover Auto-Increment

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx`
- Create: `client/src/shared/context/LMSContext.rolloverIncrement.test.tsx`

**Interfaces:**
- Consumes: `setActiveSchoolYear(collegeId, targetYear)`
- Produces: Incremented `yearLevel` (min(4, yearLevel + 1)) for students in the college, incremented `yearsOfTeaching` ((yearsOfTeaching || 0) + 1) for faculty in the college.

- [ ] **Step 1: Write failing unit test for rollover increment**

Test:
- When `setActiveSchoolYear` is called for a college:
  - Student at year level 1 becomes year level 2.
  - Student at year level 4 remains year level 4 (capped).
  - Faculty with 3 years becomes 4 years.
  - Students of another college remain unchanged.

- [ ] **Step 2: Run test to verify failure**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/shared/context/LMSContext.rolloverIncrement.test.tsx`
Expected: FAIL

- [ ] **Step 3: Update `setActiveSchoolYear` in `LMSContext.tsx`**

In `setActiveSchoolYear`, map over `db.users` (and state users):
For matching college:
- If `role === 'student'`, `yearLevel: Math.min(4, (u.yearLevel || 1) + 1)`
- If `role === 'faculty' || role === 'staff'`, `yearsOfTeaching: (u.yearsOfTeaching || 0) + 1`

- [ ] **Step 4: Run test to verify pass**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/shared/context/LMSContext.rolloverIncrement.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.rolloverIncrement.test.tsx
git commit -m "feat(rollover): auto-increment student year levels and faculty teaching experience on school year rollover"
```

---

### Task 7: Dean and Chairperson Student Year Level Management

**Files:**
- Modify: `client/src/features/accounts/EditAccountPage.tsx`
- Create: `client/src/features/accounts/EditAccountPage.yearLevel.test.tsx`

**Interfaces:**
- Consumes: `activeRole`, `activeUser.adminSubrole`, `user.yearLevel`
- Produces: Dropdown / selector for Year Level (1 to 4) when editing student accounts by Dean or Chairperson.

- [ ] **Step 1: Write failing test in `EditAccountPage.yearLevel.test.tsx`**

Verify that:
- When editing a student account, a Year Level selector (1-4) is visible and editable.
- Saving updates `yearLevel` in the user's record via `updateUser`.

- [ ] **Step 2: Run test to verify failure**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/features/accounts/EditAccountPage.yearLevel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Add Year Level field to `EditAccountPage.tsx`**

Add year level state and input when `formRole === 'student'`.

- [ ] **Step 4: Run test to verify pass**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run client/src/features/accounts/EditAccountPage.yearLevel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/accounts/EditAccountPage.tsx client/src/features/accounts/EditAccountPage.yearLevel.test.tsx
git commit -m "feat(accounts): allow deans and chairpersons to modify student year level"
```

---

### Task 8: Full Suite Verification & Regression Check

**Files:**
- All modified files

- [ ] **Step 1: Run complete client test suite**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm test -- run`
Expected: All tests pass without regressions.

- [ ] **Step 2: Run TypeScript typecheck**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;" + $env:PATH; npm run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit all remaining changes**

```bash
git commit -m "chore: final verification for profile onboarding and rollover suite"
```
