# Likha ERP Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Gabay-Prototype backend to use Likha ERP (`https://gabay.zyberlab.com/`) via `@likha-erp/likha-sdk` for authentication, user management, and LMS collection data persistence, preserving frontend API contracts and multi-agent RAG reasoning.

**Architecture:** Express on port 4001 continues as the API gateway for the Vite frontend. Database calls across route handlers are refactored from direct Prisma queries to a modular Likha ERP repository layer (`server/src/likha/repositories/`). Collections and fields in Likha ERP are provisioned and seeded via automated scripts.

**Tech Stack:** Express.js, TypeScript, Node.js, `@likha-erp/likha-sdk`, `@directus/sdk`, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-12-likha-erp-backend-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-12-likha-erp-backend-design.md)

## Global Constraints
- Target Likha ERP Domain: `https://gabay.zyberlab.com/`
- Admin Service Account: `jayveegenetareyes@gmail.com` / `qwerty12345`
- Frontend API contracts (`/api/*`) must remain 100% backward compatible without regressions.
- Multi-agent RAG pipelines, n8n webhook triggers, and accuracy benchmark evaluators must remain functional.
- Zero TypeScript build errors on both `server/` and `client/`.

---

### Task 1: Environment & SDK Dependency Setup

**Files:**
- Modify: `server/package.json`
- Modify: `server/src/env.ts`
- Modify: `server/.env`
- Modify: `server/.env.example`
- Create: `server/src/likha/client.ts`
- Create: `server/src/likha/types.ts`
- Test: `server/src/likha/client.test.ts`

**Interfaces:**
- Produces: `getLikhaAdminClient()`, `createLikhaUserClient(token: string)`, `testLikhaConnection()`

- [ ] **Step 1: Install `@likha-erp/likha-sdk`**

Run:
```bash
cd server && npm install @likha-erp/likha-sdk
```

- [ ] **Step 2: Update environment variable definitions**

Add Likha configurations to `server/src/env.ts`, `server/.env`, and `server/.env.example`:
```typescript
// server/src/env.ts
export const LIKHA_URL = process.env.LIKHA_URL || 'https://gabay.zyberlab.com';
export const LIKHA_ADMIN_EMAIL = process.env.LIKHA_ADMIN_EMAIL || 'jayveegenetareyes@gmail.com';
export const LIKHA_ADMIN_PASSWORD = process.env.LIKHA_ADMIN_PASSWORD || 'qwerty12345';
```

- [ ] **Step 3: Implement Likha client singleton & types**

Create `server/src/likha/types.ts` and `server/src/likha/client.ts`:
```typescript
// server/src/likha/client.ts
import { createLikha, authentication, rest, staticToken } from '@likha-erp/likha-sdk';
import { LIKHA_URL, LIKHA_ADMIN_EMAIL, LIKHA_ADMIN_PASSWORD } from '../env.js';

let adminToken: string | null = null;
let adminTokenExpiry: number = 0;

export async function getLikhaAdminToken(): Promise<string> {
  const now = Date.now();
  if (adminToken && now < adminTokenExpiry) {
    return adminToken;
  }
  const res = await fetch(`${LIKHA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LIKHA_ADMIN_EMAIL, password: LIKHA_ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Likha ERP Admin login failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { data?: { access_token?: string; expires?: number } };
  adminToken = body.data?.access_token || '';
  adminTokenExpiry = now + ((body.data?.expires || 900) - 60) * 1000;
  return adminToken;
}

export function getLikhaAdminClient() {
  return createLikha(LIKHA_URL).with(rest());
}

export function createLikhaUserClient(token: string) {
  return createLikha(LIKHA_URL).with(staticToken(token)).with(rest());
}

export async function testLikhaConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${LIKHA_URL}/server/ping`);
    return res.ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Write test for Likha client connection**

Create `server/src/likha/client.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { testLikhaConnection, getLikhaAdminToken } from './client.js';

describe('Likha Client', () => {
  it('connects to Likha ERP server', async () => {
    const pingOk = await testLikhaConnection();
    expect(pingOk).toBe(true);
  });

  it('authenticates admin service account', async () => {
    const token = await getLikhaAdminToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 5: Run tests and verify PASS**

Run: `npx vitest run src/likha/client.test.ts` in `server/`
Expected: PASS (2 tests pass)

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/src/env.ts server/src/likha/ server/.env.example
git commit -m "feat(likha): add SDK dependency and client singleton"
```

---

### Task 2: Automated Schema Provisioning Script

**Files:**
- Create: `scripts/provision-likha-schema.ts`
- Modify: `server/package.json` (add npm run script `likha:provision`)

**Interfaces:**
- Produces: CLI script that provisions all 14 LMS collections, fields, and role permissions on `https://gabay.zyberlab.com/`.

- [ ] **Step 1: Write schema provisioning script**

Create `scripts/provision-likha-schema.ts` with definitions for:
- `courses`
- `course_sections`
- `enrollment_requests`
- `modules`
- `module_items`
- `module_comments`
- `activities`
- `quizzes`
- `exams`
- `submissions`
- `announcements`
- `discussions`
- `messages`
- `chat_groups`
- `calendar_events`
- `advising_slots`
- `course_files` & `course_folders`
- `course_grades`
- `syllabi`

The script:
1. Obtains admin bearer token.
2. Queries `GET /collections`.
3. Posts missing collections via `POST /collections`.
4. Queries `GET /fields/:collection` and creates missing fields via `POST /fields/:collection`.
5. Grants full permissions to Administrator, Faculty, Student, and Staff roles.

- [ ] **Step 2: Run provisioning script against Likha ERP**

Run:
```bash
npx tsx scripts/provision-likha-schema.ts
```
Expected: All 14 collections created or confirmed existing with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/provision-likha-schema.ts server/package.json
git commit -m "feat(likha): add automated schema provisioning script"
```

---

### Task 3: Data Seeding Script

**Files:**
- Create: `scripts/seed-likha-data.ts`
- Modify: `server/package.json` (add npm run script `likha:seed`)

**Interfaces:**
- Produces: CLI script that seeds default test users, courses, syllabus, and assessments into Likha ERP.

- [ ] **Step 1: Write data seeding script**

Create `scripts/seed-likha-data.ts`:
- Check/create faculty user (`faculty1@dmmmsu.edu.ph` / `faculty2026`) with Faculty role (`2e1047c9-1f10-4ae2-b131-6345c7814a6b`).
- Check/create student user (`student1@dmmmsu.edu.ph` / `gabay2026`) with Student role (`98a212b2-9482-4ca5-8f67-825699575f3c`).
- Seed standard courses: `CS 101`, `CS 102`, `CS 103`.
- Seed course sections, modules, activities, and official syllabus JSON.

- [ ] **Step 2: Execute data seeding script**

Run:
```bash
npx tsx scripts/seed-likha-data.ts
```
Expected: Seed records created or updated cleanly.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-likha-data.ts server/package.json
git commit -m "feat(likha): add data seeding script for users, courses, and syllabi"
```

---

### Task 4: Authentication & User Management Repository

**Files:**
- Create: `server/src/likha/repositories/usersRepo.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/routes/users.ts`
- Create: `server/src/routes/auth.likha.test.ts`

**Interfaces:**
- Produces: `authenticateUser(email, password)`, `getUserById(id)`, `getAllUsers()`, `updateUserProfile(id, updates)`

- [ ] **Step 1: Implement `usersRepo.ts`**

Map Likha ERP `directus_users` to Gabay `User`:
- Authenticate via `POST /auth/login` on Likha ERP.
- Retrieve user profile with role lookup:
  - `f927940e-7f3f-49d4-8c80-a6ccd2167e18` -> `'admin'`
  - `2e1047c9-1f10-4ae2-b131-6345c7814a6b` -> `'faculty'`
  - `98a212b2-9482-4ca5-8f67-825699575f3c` -> `'student'`
  - `c7d14be0-4259-46d7-b4b6-37db1221a0e9` -> `'staff'`
- Map `first_name`, `last_name`, `student_id`, `department`, `banner`, `avatar`.

- [ ] **Step 2: Refactor `server/src/routes/auth.ts` and `users.ts`**

Update `auth.ts` to call `usersRepo.authenticateUser` and return `{ user, token }`.
Update `users.ts` to query `usersRepo.getAllUsers` and `updateUserProfile`.

- [ ] **Step 3: Write test in `server/src/routes/auth.likha.test.ts`**

Verify login endpoint responds with 200 and mapped user for valid Likha credentials, and 401 for invalid credentials.

- [ ] **Step 4: Run tests and verify PASS**

Run: `npx vitest run src/routes/auth.likha.test.ts` in `server/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/likha/repositories/usersRepo.ts server/src/routes/auth.ts server/src/routes/users.ts server/src/routes/auth.likha.test.ts
git commit -m "feat(likha): implement users repository and refactor auth route"
```

---

### Task 5: Courses, Sections & Requests Repositories

**Files:**
- Create: `server/src/likha/repositories/coursesRepo.ts`
- Modify: `server/src/routes/courses.ts`
- Modify: `server/src/routes/requests.ts`
- Create: `server/src/routes/courses.likha.test.ts`

**Interfaces:**
- Produces: `getCourses()`, `getCourseById()`, `createCourse()`, `updateCourse()`, `getCourseSections()`, `getEnrollmentRequests()`, `createEnrollmentRequest()`, `resolveEnrollmentRequest()`

- [ ] **Step 1: Implement `coursesRepo.ts`**

Connect to `courses`, `course_sections`, and `enrollment_requests` collections in Likha ERP.
Handle JSON parsing of `grading_terms`, `grades_released`, `syllabus`, and `spr_config`.

- [ ] **Step 2: Refactor `server/src/routes/courses.ts` and `requests.ts`**

Replace `prisma.course.*` and `prisma.enrollmentRequest.*` with `coursesRepo` functions.

- [ ] **Step 3: Write test in `server/src/routes/courses.likha.test.ts`**

Test listing courses, retrieving a course, and creating an enrollment request.

- [ ] **Step 4: Run tests and verify PASS**

Run: `npx vitest run src/routes/courses.likha.test.ts` in `server/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/likha/repositories/coursesRepo.ts server/src/routes/courses.ts server/src/routes/requests.ts server/src/routes/courses.likha.test.ts
git commit -m "feat(likha): implement courses repository and refactor course routes"
```

---

### Task 6: Modules, Assessments & Submissions Repositories

**Files:**
- Create: `server/src/likha/repositories/modulesRepo.ts`
- Create: `server/src/likha/repositories/assessmentsRepo.ts`
- Modify: `server/src/routes/modules.ts`
- Modify: `server/src/routes/assessments.ts`
- Create: `server/src/routes/assessments.likha.test.ts`

**Interfaces:**
- Produces: `getModules(courseId)`, `createModule()`, `addModuleItem()`, `getActivities(courseId)`, `getQuizzes(courseId)`, `getExams(courseId)`, `recordSubmission()`, `gradeSubmission()`

- [ ] **Step 1: Implement `modulesRepo.ts` and `assessmentsRepo.ts`**

Query and mutate `modules`, `module_items`, `activities`, `quizzes`, `exams`, and `submissions` in Likha ERP.
Preserve rubric scoring and submission answer serialization.

- [ ] **Step 2: Refactor `server/src/routes/modules.ts` and `assessments.ts`**

Connect route handlers to `modulesRepo` and `assessmentsRepo`.

- [ ] **Step 3: Run assessment test suite**

Run: `npx vitest run src/routes/assessments.likha.test.ts` in `server/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/likha/repositories/modulesRepo.ts server/src/likha/repositories/assessmentsRepo.ts server/src/routes/modules.ts server/src/routes/assessments.ts server/src/routes/assessments.likha.test.ts
git commit -m "feat(likha): implement modules and assessments repositories"
```

---

### Task 7: Syllabi, Files, Communications & Grades Repositories

**Files:**
- Create: `server/src/likha/repositories/syllabiRepo.ts`
- Create: `server/src/likha/repositories/filesRepo.ts`
- Create: `server/src/likha/repositories/communicationsRepo.ts`
- Create: `server/src/likha/repositories/gradesRepo.ts`
- Modify: `server/src/routes/syllabi.ts`
- Modify: `server/src/routes/files.ts`
- Modify: `server/src/routes/messages.ts`
- Modify: `server/src/routes/announcements.ts`
- Modify: `server/src/routes/calendar.ts`
- Modify: `server/src/routes/grades.ts`
- Modify: `server/src/routes/spr.ts`

**Interfaces:**
- Produces: `getCourseSyllabus()`, `updateSyllabusSection()`, `getRAGContext()`, `getCourseFiles()`, `getMessages()`, `getAnnouncements()`, `getGrades()`, `saveSPRConfig()`

- [ ] **Step 1: Implement remaining Likha repositories**

Implement `syllabiRepo`, `filesRepo`, `communicationsRepo`, `gradesRepo` interacting with corresponding Likha ERP collections.
Ensure `syllabiRepo.getRAGContext` outputs the exact text structure required by RAG agents and benchmark evaluators.

- [ ] **Step 2: Refactor corresponding route files**

Wire Express routes to the new repositories.

- [ ] **Step 3: Run full server test suite**

Run: `npm test` in `server/`
Expected: All test suites pass (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add server/src/likha/repositories/ server/src/routes/
git commit -m "feat(likha): complete remaining repositories and route handlers"
```

---

### Task 8: End-to-End System Verification

**Files:**
- None (system-wide validation)

**Interfaces:**
- Verifies: Full server test suite, full client test suite, TypeScript builds, and live browser user journeys.

- [ ] **Step 1: Run complete server test suite**

Run: `npm test` in `server/`
Expected: 100% passed (exit code 0).

- [ ] **Step 2: Run complete client test suite**

Run: `npx vitest run` in `client/`
Expected: 60/60 files passed, 320/320 tests passed (exit code 0).

- [ ] **Step 3: Verify TypeScript builds**

Run: `npm run build` in `server/`
Expected: Exit code 0.
Run: `npm run build` in `client/`
Expected: Exit code 0.

- [ ] **Step 4: Run live browser E2E session**

Verify:
- Login with Likha user (`jayveegenetareyes@gmail.com` as admin, `faculty1@dmmmsu.edu.ph` as faculty, `student1@dmmmsu.edu.ph` as student).
- View Dashboard, Courses, Syllabus, and Assessments.
- Submit a query to GABAY RAG Chatbot (`/gabay-rag`) and confirm streaming response.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: complete Likha ERP backend refactoring with full verification"
```
