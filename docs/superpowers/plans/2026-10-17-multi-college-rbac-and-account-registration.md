# Multi-College RBAC, Self-Registration, and Verification Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement university-wide multi-college architecture, strict single-seat role hierarchy (1 Chancellor, 1 Dean per college, 1 Chair per department), leadership succession, universal self-registration with email activation, and a 30-day expiring verification queue in `ManageAccountsPage`.

**Architecture:** Extend core LMS domain types with dynamic `College`, `Department`, `AdminSubrole`, and `VerificationStatus`; implement a reactive staging queue in `LMSContext` (`pendingRegistrations`) with 30-day auto-cancellation; build public `/register` and `/activate` workflows; remove manual admin account creation; and revamp `ManageAccountsPage` with scoped verification queues, leadership handover modals, and an academic structure management tab for the Chancellor.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind CSS, Lucide React, Likha Directus client data layer.

**Spec:** [`docs/superpowers/specs/2026-10-17-multi-college-rbac-and-account-registration-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-17-multi-college-rbac-and-account-registration-design.md)

---

## Global Constraints

- **Zero Likha ERP REST DDL Alterations:** No `/fields`, `/relations`, or `/collections` REST API calls per `AGENTS.md`. Client data operations use standard item CRUD and local reactive caching.
- **Node & Test Environment Path:** When executing test and build commands, prepend the Node.js directory to `$env:PATH`: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"`.
- **Strict Single-Seat Invariants:** Exactly 1 Chancellor (`superadmin`) university-wide, 1 Dean per college, and 1 Chairperson per department at all times.
- **Strict Removal of Direct Creation:** The "Create new account" button in `ManageAccountsPage` must be completely removed; all new accounts originate via self-registration.
- **30-Day Auto-Cancellation:** Any pending registration exceeding 30 days without admin verification must automatically cancel.

---

## Review Focus

1. **Unverified Login Prevention:** An unverified registrant attempting to sign in on `/login` must be rejected with a clear message showing remaining expiration days (e.g., *"Pending Admin Verification: Expires in 24 days"*).
2. **Chair vs Dean Scope Boundary:** A Chairperson must only see and verify pending registrations for their assigned department; a Dean must see and verify pending registrations across all departments in their college.
3. **Leadership Succession Invariant:** When a Dean or Chair transfers their role to a successor, the successor is elevated to admin and the predecessor is stepped down to faculty in an atomic transition, leaving exactly 1 leader.
4. **ID Number Validation:** Registration must reject invalid ID numbers and enforce format `XXX-XXXX-X` (e.g. `202-6001-A` or numeric `202-6001-1`).
5. **Dual-Role Navigation:** Deans and Chairpersons must have access to both their administrative console (`/accounts`) and standard faculty teaching workspace (`/courses`, `/modules`, `/syllabus`, `/assessments`, `/grades`).

---

### Task 1: Core Domain Types & Hierarchy Models

**Files:**
- Modify: `client/src/shared/types/lms.ts:1-25`
- Test: `client/src/shared/types/lms.rbac.test.ts`

**Interfaces:**
- Produces: `College`, `Department`, `UserRole`, `AdminSubrole`, `VerificationStatus`, `PendingRegistration`, extended `User`.

- [ ] **Step 1: Write unit tests for new domain types and interfaces**

Create `client/src/shared/types/lms.rbac.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type { College, Department, User, UserRole, AdminSubrole, PendingRegistration } from './lms';

describe('LMS RBAC & Hierarchy Types', () => {
  it('supports superadmin and extended user roles', () => {
    const roles: UserRole[] = ['superadmin', 'admin', 'faculty', 'staff', 'student'];
    expect(roles).toContain('superadmin');
  });

  it('correctly models a College and Department structure', () => {
    const college: College = {
      id: 'col-ccs',
      name: 'College of Computer Science',
      code: 'CCS',
      deanId: 'user-dean-1'
    };
    const dept: Department = {
      id: 'dept-it',
      collegeId: 'col-ccs',
      name: 'Department of Information Technology',
      code: 'IT',
      chairpersonId: 'user-chair-1'
    };
    expect(college.code).toBe('CCS');
    expect(dept.collegeId).toBe(college.id);
  });

  it('supports PendingRegistration with 30-day expiration fields', () => {
    const pending: PendingRegistration = {
      id: 'reg-1',
      firstName: 'Maria',
      lastName: 'Santos',
      fullName: 'Maria Santos',
      email: 'msantos@dmmmsu.edu.ph',
      role: 'faculty',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      studentId: '202-6001-1',
      password: 'password123',
      emailVerified: true,
      activationToken: 'token-abc',
      registeredAt: '2026-10-17T00:00:00.000Z',
      expiresAt: '2026-11-16T00:00:00.000Z',
      status: 'pending'
    };
    expect(pending.status).toBe('pending');
    expect(pending.emailVerified).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/shared/types/lms.rbac.test.ts`  
Expected: FAIL with missing type exports.

- [ ] **Step 3: Update `client/src/shared/types/lms.ts`**

Update `client/src/shared/types/lms.ts`:
```typescript
export type UserRole = 'superadmin' | 'admin' | 'faculty' | 'staff' | 'student';
export type AdminSubrole = 'chancellor' | 'dean' | 'chairperson';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface College {
  id: string;
  name: string;
  code: string;
  deanId?: string;
}

export interface Department {
  id: string;
  collegeId: string;
  name: string;
  code: string;
  chairpersonId?: string;
}

export interface PendingRegistration {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName: string;
  email: string;
  role: 'student' | 'faculty' | 'staff';
  collegeId: string;
  collegeName: string;
  department: string;
  studentId: string;
  password: string;
  emailVerified: boolean;
  activationToken: string;
  registeredAt: string;
  expiresAt: string;
  status: VerificationStatus;
}
```
And add optional fields to `User`:
```typescript
  firstName?: string;
  middleName?: string;
  lastName?: string;
  adminSubrole?: AdminSubrole;
  collegeId?: string;
  collegeName?: string;
  verificationStatus?: VerificationStatus;
  emailVerified?: boolean;
  registeredAt?: string;
  verificationExpiresAt?: string;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/shared/types/lms.rbac.test.ts`  
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/types/lms.ts client/src/shared/types/lms.rbac.test.ts
git commit -m "feat(types): add College, Department, AdminSubrole, and PendingRegistration models"
```

---

### Task 2: Dynamic Colleges & Departments Data Store

**Files:**
- Create: `client/src/shared/data/collegesData.ts`
- Test: `client/src/shared/data/collegesData.test.ts`

**Interfaces:**
- Consumes: `College`, `Department` from `../types/lms`.
- Produces: `DEFAULT_COLLEGES`, `DEFAULT_DEPARTMENTS`, `getColleges()`, `getDepartmentsByCollege()`, `getCollegeById()`, `getDepartmentByName()`.

- [ ] **Step 1: Write test for colleges and departments helper functions**

Create `client/src/shared/data/collegesData.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLLEGES,
  DEFAULT_DEPARTMENTS,
  getColleges,
  getDepartmentsByCollege,
  getCollegeById,
  getDepartmentByName
} from './collegesData';

describe('Colleges & Departments Data Store', () => {
  it('contains initial university colleges', () => {
    const colleges = getColleges();
    expect(colleges.length).toBeGreaterThanOrEqual(2);
    expect(colleges.some(c => c.code === 'CCS')).toBe(true);
  });

  it('retrieves departments belonging to a specific college', () => {
    const ccsDepts = getDepartmentsByCollege('col-ccs');
    expect(ccsDepts.length).toBeGreaterThanOrEqual(3);
    expect(ccsDepts.some(d => d.name === 'Department of Computer Science')).toBe(true);
    expect(ccsDepts.some(d => d.name === 'Department of Information Technology')).toBe(true);
  });

  it('retrieves a college by ID and department by name', () => {
    const ccs = getCollegeById('col-ccs');
    expect(ccs?.name).toBe('College of Computer Science');
    const csDept = getDepartmentByName('Department of Computer Science');
    expect(csDept?.code).toBe('CS');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/shared/data/collegesData.test.ts`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `client/src/shared/data/collegesData.ts`**

Define `DEFAULT_COLLEGES` (CCS, College of Education, College of Engineering) and `DEFAULT_DEPARTMENTS` (CS, IT, IS, Elementary Ed, Secondary Ed, Civil Eng, Electrical Eng) and implement getter helper functions with safety fallbacks.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/shared/data/collegesData.test.ts`  
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/data/collegesData.ts client/src/shared/data/collegesData.test.ts
git commit -m "feat(data): implement dynamic colleges and departments dataset and accessors"
```

---

### Task 3: LMSContext Registration Staging, Verification Queue & Leadership Transfer

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:55-250, 2980-3200`
- Test: `client/src/shared/context/LMSContext.rbac.test.tsx`

**Interfaces:**
- Consumes: `PendingRegistration`, `College`, `Department`, `AdminSubrole`, `UserRole`.
- Produces: `colleges`, `departments`, `pendingRegistrations`, `registerAccount()`, `activateEmail()`, `verifyRegistration()`, `rejectRegistration()`, `transferLeadership()`, `addCollege()`, `addDepartment()`.

- [ ] **Step 1: Write integration tests for registration lifecycle and single-seat handover**

Create `client/src/shared/context/LMSContext.rbac.test.tsx` testing:
1. `registerAccount()` creates a pending registration expiring in 30 days.
2. `activateEmail()` verifies the token and marks email verified.
3. Unverified account is rejected at `login()` with countdown message.
4. `verifyRegistration()` creates active user and unlocks login.
5. Registrations older than 30 days are automatically marked `expired` / cancelled.
6. `transferLeadership()` promotes successor to admin/dean/chair and steps predecessor down to faculty.

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/shared/context/LMSContext.rbac.test.tsx`  
Expected: FAIL with missing context properties.

- [ ] **Step 3: Implement methods in `LMSContext.tsx`**

1. Add state: `colleges`, `departments`, `pendingRegistrations`.
2. Implement `registerAccount(payload)` generating unique token, 30-day `expiresAt` (`new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()`).
3. Implement `activateEmail(token)` finding matching token and updating `emailVerified = true`.
4. Implement `verifyRegistration(id)`: checks expiration; if valid, calls `createUser()` with mapped verified user, updates registration status to `verified`.
5. Implement `rejectRegistration(id)`: marks status `rejected`.
6. Implement `purgeExpiredRegistrations()`: scans and updates items where `Date.now() >= new Date(expiresAt).getTime()`.
7. Implement `transferLeadership(roleType, currentLeaderId, successorId, unitId)`: atomically updates predecessor to `role: 'faculty'` and successor to `role: 'admin', adminSubrole: roleType`.
8. Intercept `login(email, password)`: check `pendingRegistrations` matching email; if pending/unverified, reject with exact days remaining.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/shared/context/LMSContext.rbac.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.rbac.test.tsx
git commit -m "feat(context): implement registration staging, 30-day expiration, and leadership succession"
```

---

### Task 4: Role-Based Navigation & Dual Workspace Routing

**Files:**
- Modify: `client/src/shared/config/navigation.ts:1-52`
- Modify: `client/src/shared/config/routes.ts:1-55`
- Modify: `client/src/App.tsx:75-105, 300-350`
- Test: `client/src/shared/config/rbacNavigation.test.ts`

**Interfaces:**
- Consumes: `activeRole`, `activeUser.adminSubrole`.
- Produces: Scoped main navigation items; `canAccessAccountManagement(role, adminSubrole)`; public route `/register` and `/activate`.

- [ ] **Step 1: Write test for navigation visibility and route guards**

Create `client/src/shared/config/rbacNavigation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MAIN_NAV, isVisible } from './navigation';

describe('RBAC Navigation Permissions', () => {
  it('allows superadmin and admin to view Manage College Accounts', () => {
    const accountsItem = MAIN_NAV.find(i => i.id === 'accounts');
    expect(accountsItem).toBeDefined();
    expect(isVisible(accountsItem!, 'superadmin')).toBe(true);
    expect(isVisible(accountsItem!, 'admin')).toBe(true);
  });

  it('hides Manage College Accounts from regular faculty, staff, and students', () => {
    const accountsItem = MAIN_NAV.find(i => i.id === 'accounts');
    expect(isVisible(accountsItem!, 'faculty')).toBe(false);
    expect(isVisible(accountsItem!, 'staff')).toBe(false);
    expect(isVisible(accountsItem!, 'student')).toBe(false);
  });

  it('ensures faculty teaching tabs remain visible to admin (dual role)', () => {
    const coursesItem = MAIN_NAV.find(i => i.id === 'lms');
    expect(isVisible(coursesItem!, 'admin')).toBe(true);
    expect(isVisible(coursesItem!, 'superadmin')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/shared/config/rbacNavigation.test.ts`  
Expected: FAIL with `superadmin` role not in `MAIN_NAV` or `roles`.

- [ ] **Step 3: Update `navigation.ts`, `routes.ts`, and `App.tsx`**

1. In `navigation.ts`: include `superadmin` in `ALL` roles and update `accounts` item `roles: ['superadmin', 'admin']`.
2. In `routes.ts`: add `register: '/register'` and `activate: '/activate'`.
3. In `App.tsx`:
   - Register public routes `<Route path="/register" element={<RegisterPage />} />` and `<Route path="/activate" element={<ActivatePage />} />`.
   - Update `RequireAdmin` guard to allow `activeRole === 'admin' || activeRole === 'superadmin'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/shared/config/rbacNavigation.test.ts`  
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/config/navigation.ts client/src/shared/config/routes.ts client/src/App.tsx client/src/shared/config/rbacNavigation.test.ts
git commit -m "feat(nav): configure superadmin, admin, and dual workspace navigation routes"
```

---

### Task 5: Self-Registration Page & Email Activation Flow

**Files:**
- Create: `client/src/features/auth/RegisterPage.tsx`
- Modify: `client/src/features/auth/LoginPage.tsx:180-240`
- Test: `client/src/features/auth/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `registerAccount`, `activateEmail`, `getColleges`, `getDepartmentsByCollege`.
- Produces: Interactive registration form; email activation modal; link from `/login` to `/register`.

- [ ] **Step 1: Write test for RegisterPage form and validation**

Create `client/src/features/auth/RegisterPage.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    registerAccount: vi.fn().mockResolvedValue({ id: 'reg-1', activationToken: 'test-token' }),
    colleges: [{ id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' }],
    departments: [{ id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS' }],
    showAlert: vi.fn(),
  })
}));

describe('RegisterPage Component', () => {
  it('renders all required registration inputs', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText(/first name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/last name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/name@dmmmsu\.edu\.ph/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/features/auth/RegisterPage.test.tsx`  
Expected: FAIL with component missing.

- [ ] **Step 3: Implement `RegisterPage.tsx` and update `LoginPage.tsx`**

1. Build `RegisterPage.tsx`: First Name, Middle Name, Last Name, Role selector (Student/Faculty/Staff), dynamic College & Department selection, Institutional Email, ID Number formatted `XXX-XXXX-X`, Password and confirmation.
2. Render email activation dialog upon successful registration with simulated activation link.
3. In `LoginPage.tsx`: add clear link: *"Don't have an account? Sign up here"* routing to `/register`.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/features/auth/RegisterPage.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/auth/RegisterPage.tsx client/src/features/auth/LoginPage.tsx client/src/features/auth/RegisterPage.test.tsx
git commit -m "feat(auth): implement public self-registration page and activation workflow"
```

---

### Task 6: Revamped Manage Accounts Console with 30-Day Verification Queue & Leadership Transfer

**Files:**
- Modify: `client/src/features/accounts/ManageAccountsPage.tsx:360-450, 480-760`
- Create: `client/src/features/accounts/components/LeadershipTransferModal.tsx`
- Create: `client/src/features/accounts/components/AcademicStructureTab.tsx`
- Test: `client/src/features/accounts/ManageAccountsPage.rbac.test.tsx`

**Interfaces:**
- Consumes: `pendingRegistrations`, `verifyRegistration`, `rejectRegistration`, `transferLeadership`, `colleges`, `departments`, `activeRole`, `activeUser`.
- Produces: Scoped verification queue; days remaining countdown badge; removal of "Create new account" button; single-seat leadership handover modal; Superadmin academic structure configuration tab.

- [ ] **Step 1: Write tests for ManageAccountsPage verification queue and removal of manual creation**

Create `client/src/features/accounts/ManageAccountsPage.rbac.test.tsx`:
1. Verify "Create new account" button is absent.
2. Verify "Verification Queue" tab displays pending applicants with "Expires in X days" badge.
3. Verify Chairperson only sees pending applicants from their department.
4. Verify Dean sees pending applicants across the college.
5. Verify clicking "Verify" triggers `verifyRegistration()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/ManageAccountsPage.rbac.test.tsx`  
Expected: FAIL.

- [ ] **Step 3: Implement components and update `ManageAccountsPage.tsx`**

1. Remove `<button onClick={handleOpenCreateModal}>Create new account</button>`.
2. Add tabs: "Active Accounts" (`users`), "Pending Verifications" (`pendingRegistrations` with count badge), and "Academic Structure" (only rendered if `activeRole === 'superadmin'`).
3. Build `LeadershipTransferModal.tsx`: displays current seat holder, selects from eligible faculty in unit, calls `transferLeadership()`.
4. Build `AcademicStructureTab.tsx`: enables the Chancellor to view/create colleges and departments, and assign the initial Dean or Chair.
5. Integrate expiration countdown helper: calculates days remaining from `expiresAt`, displays red/amber badge, and disables actions if expired.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"; npm test --workspace=client -- --run src/features/accounts/ManageAccountsPage.rbac.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/accounts/ManageAccountsPage.tsx client/src/features/accounts/components/ client/src/features/accounts/ManageAccountsPage.rbac.test.tsx
git commit -m "feat(accounts): revamp Manage Accounts with 30-day verification queue and leadership transfer"
```

---

### Task 7: Full System Verification, Typecheck & Integration Build

**Files:**
- Test: All unit test suites across `client`

- [ ] **Step 1: Run TypeScript typecheck across client**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm run typecheck:client
```
Expected: Clean output with 0 type errors.

- [ ] **Step 2: Run full unit test suite**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm test --workspace=client -- --run
```
Expected: All tests pass with 100% success rate.

- [ ] **Step 3: Run production client build**

Run:
```powershell
$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;$env:PATH"
npm run build:client
```
Expected: Successful Vite build output with generated assets in `client/dist`.

- [ ] **Step 4: Final commit and tag**

```bash
git add .
git commit -m "chore: complete multi-college RBAC, self-registration, and verification implementation"
```
