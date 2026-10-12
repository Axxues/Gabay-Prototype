# Likha ERP True Backend & Automation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Likha ERP as the single source of truth, true backend, and event-driven automation engine for the Gabay LMS, registering all Directus relational fields and flows, and connecting the Gabay web client directly to Likha ERP while decoupling Express to a dedicated RAG microservice.

**Architecture:** We programmatically register formal Directus One-to-Many (`O2M`), Many-to-One (`M2O`), and file relationships across all 44 Likha collections, along with rich field interfaces (WYSIWYG, Datetime, status dropdowns, toggles). We deploy 4 native Likha Flows for academic notifications, submission grading & SPR score aggregation, enrollment alerts, and scheduled due-date reminders. The Gabay frontend connects directly to Likha ERP using Directus REST/SDK with single-query relational hydration, while Express is retained strictly as an AI/RAG microservice on port 4001.

**Tech Stack:** TypeScript, Directus REST API / SDK, Likha ERP (`https://gabay.zyberlab.com`), Directus Flows & Operations, React 19, Vite, Express (RAG microservice), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-likha-erp-true-backend-and-automation-design.md`

## Global Constraints
- Target Likha ERP URL: `https://gabay.zyberlab.com`
- All schema migrations must be idempotent (`POST` / `PATCH` checking existing items)
- Retain public access permission (Permission ID 80) on `directus_files` for asset rendering
- Zero breaking changes to client UI features; all 60 client Vitest suites (320 tests) must continue passing
- Express server retained strictly on port 4001 for `/api/rag`, `/api/rag-aggregate`, `/api/rag-baseline`, and n8n telemetry

---

### Task 1: Likha Relational Schema Migration Script (`POST /relations` & UI Interfaces)

**Files:**
- Create: `server/src/likha/migrations/initLikhaRelationalAndFlows.ts`
- Test: `server/src/likha/migrations/initLikhaRelationalAndFlows.test.ts`
- Modify: `server/src/likha/client.ts`

**Interfaces:**
- Consumes: `likhaFetch`, `getLikhaAdminToken` from `server/src/likha/client.ts`
- Produces: `ensureLikhaRelationalSchema(): Promise<void>` in `initLikhaRelationalAndFlows.ts`

- [ ] **Step 1: Write the failing test for relational schema migration**

```ts
// server/src/likha/migrations/initLikhaRelationalAndFlows.test.ts
import { describe, it, expect } from 'vitest';
import { ensureLikhaRelationalSchema } from './initLikhaRelationalAndFlows.js';
import { likhaFetch } from '../client.js';

describe('Likha Relational Schema Migration', () => {
  it('registers formal O2M and M2O relations across core LMS collections', async () => {
    await ensureLikhaRelationalSchema();
    const res = await likhaFetch('/relations');
    expect(res.ok).toBe(true);
    const data = await res.json();
    const rels = data.data.map((r: any) => `${r.collection}.${r.field} -> ${r.related_collection}`);
    expect(rels).toContain('activities.course_id -> courses');
    expect(rels).toContain('modules.course_id -> courses');
    expect(rels).toContain('module_items.module_id -> modules');
    expect(rels).toContain('assessment_questions.activity_id -> activities');
    expect(rels).toContain('submissions.activity_id -> activities');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/likha/migrations/initLikhaRelationalAndFlows.test.ts`  
Expected: FAIL ("Cannot find module './initLikhaRelationalAndFlows.js'")

- [ ] **Step 3: Implement relational schema registration and field interfaces**

Create `server/src/likha/migrations/initLikhaRelationalAndFlows.ts` implementing `ensureLikhaRelationalSchema`:
* Queries `GET /relations` to discover existing relationships.
* Iterates through the 20 relational pairs (`activities.course_id`, `modules.course_id`, `module_items.module_id`, `assessment_questions.activity_id`, `rubric_criteria.activity_id`, `submissions.activity_id`, `submission_answers.submission_id`, `course_grades.spr_cells`, `syllabi.*`) and registers missing ones via `POST /relations`.
* Updates UI field interfaces via `PATCH /fields/:collection/:field` for rich text, datetimes, dropdowns, and toggles.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/likha/migrations/initLikhaRelationalAndFlows.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run: `git add server/src/likha/migrations/initLikhaRelationalAndFlows.ts server/src/likha/migrations/initLikhaRelationalAndFlows.test.ts && git commit -m "feat(likha): register full relational schema and UI interfaces in Likha ERP"`

---

### Task 2: Provisioning Likha ERP Automation Flows (`POST /flows` & `POST /operations`)

**Files:**
- Modify: `server/src/likha/migrations/initLikhaRelationalAndFlows.ts`
- Test: `server/src/likha/migrations/initLikhaFlows.test.ts`

**Interfaces:**
- Consumes: `ensureLikhaRelationalSchema` from Task 1
- Produces: `ensureLikhaAutomationFlows(): Promise<void>` in `initLikhaRelationalAndFlows.ts`

- [ ] **Step 1: Write the failing test for Likha automation flows**

```ts
// server/src/likha/migrations/initLikhaFlows.test.ts
import { describe, it, expect } from 'vitest';
import { ensureLikhaAutomationFlows } from './initLikhaRelationalAndFlows.js';
import { likhaFetch } from '../client.js';

describe('Likha Automation Flows Provisioning', () => {
  it('provisions all 4 core LMS automation flows in Likha ERP', async () => {
    await ensureLikhaAutomationFlows();
    const res = await likhaFetch('/flows');
    expect(res.ok).toBe(true);
    const data = await res.json();
    const flowNames = data.data.map((f: any) => f.name);
    expect(flowNames).toContain('gabay-publish-notification-flow');
    expect(flowNames).toContain('gabay-submission-spr-flow');
    expect(flowNames).toContain('gabay-enrollment-alert-flow');
    expect(flowNames).toContain('gabay-due-date-reminder-cron');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/src/likha/migrations/initLikhaFlows.test.ts`  
Expected: FAIL ("ensureLikhaAutomationFlows is not a function")

- [ ] **Step 3: Implement `ensureLikhaAutomationFlows`**

In `server/src/likha/migrations/initLikhaRelationalAndFlows.ts`:
* Programmatically provisions the 4 Flows with their respective triggers:
  1. `gabay-publish-notification-flow` (Event Hook on `activities` / `announcements` create & update when `published = true`)
  2. `gabay-submission-spr-flow` (Event Hook on `submissions` update when `score` is set)
  3. `gabay-enrollment-alert-flow` (Event Hook on `enrollment_requests` create)
  4. `gabay-due-date-reminder-cron` (Schedule CRON trigger `0 */6 * * *`)
* Chained operations created via `POST /operations` for reading course/enrollment rows and inserting `notifications` and `spr_cells`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/src/likha/migrations/initLikhaFlows.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run: `git add server/src/likha/migrations/initLikhaRelationalAndFlows.ts server/src/likha/migrations/initLikhaFlows.test.ts && git commit -m "feat(flows): deploy native Likha ERP automation flows for notifications, grading, and reminders"`

---

### Task 3: Client Direct-to-Likha API Client (`client/src/shared/api/`)

**Files:**
- Modify: `client/src/shared/api/client.ts`
- Modify: `client/src/shared/api/syllabus.ts`
- Create: `client/src/shared/api/likhaLmsApi.ts`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: `LIKHA_URL` (`https://gabay.zyberlab.com`)
- Produces: `likhaLmsApi` exporting `getCoursesWithRelations`, `getActivitiesWithSubmissions`, `uploadLikhaFile`, `loginLikhaUser`

- [ ] **Step 1: Write the failing test for Direct-to-Likha API client**

```ts
// client/src/shared/api/likhaLmsApi.test.ts
import { describe, it, expect, vi } from 'vitest';
import { likhaLmsApi } from './likhaLmsApi';

describe('Likha LMS Direct API Client', () => {
  it('requests courses with deep nested relations via Directus fields parameter', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'c-1', title: 'Test Course', activities: [], modules: [] }] })
    } as any);

    const courses = await likhaLmsApi.getCoursesWithRelations();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/courses?fields=*,activities.*,modules.*,modules.items.*,course_files.*'),
      expect.any(Object)
    );
    expect(courses[0].id).toBe('c-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/shared/api/likhaLmsApi.test.ts`  
Expected: FAIL ("Cannot find module './likhaLmsApi'")

- [ ] **Step 3: Implement `likhaLmsApi.ts`**

Create `client/src/shared/api/likhaLmsApi.ts`:
* Manages Directus Bearer auth tokens in local storage.
* Implements deep relational fetchers (`getCoursesWithRelations`, `getActivityDetails`, `saveActivity`, `submitAssignment`, `getNotifications`).
* Direct multipart upload to `${LIKHA_URL}/files`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/shared/api/likhaLmsApi.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit changes**

Run: `git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts client/src/shared/api/client.ts && git commit -m "feat(client): implement direct-to-Likha API client with relational hydration"`

---

### Task 4: Streamlining LMSContext & Client Features for Direct-to-Likha Operation

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx`
- Modify: `client/src/features/courses/CoursesPage.tsx`
- Modify: `client/src/features/assessments/ActivitiesView.tsx`
- Test: Run client test suite (`npx vitest run`)

**Interfaces:**
- Consumes: `likhaLmsApi` from Task 3
- Produces: Fully functional `LMSContext` dispatching CRUD directly to Likha ERP

- [ ] **Step 1: Update LMSContext to utilize direct Likha API**

In `client/src/shared/context/LMSContext.tsx`:
* Route user login and token checks directly to `${LIKHA_URL}/auth/login` and `/users/me`.
* Hydrate course listings and details through `likhaLmsApi.getCoursesWithRelations()`.
* Direct activity and announcement publishing through Likha ERP `/items/*`.

- [ ] **Step 2: Run all client test suites to verify zero regressions**

Run: `npx vitest run` in `client/`  
Expected: All 60 test suites (320 tests) pass.

- [ ] **Step 3: Commit changes**

Run: `git add client/src/shared/context/LMSContext.tsx && git commit -m "feat(context): integrate direct Likha ERP data layer across client LMSContext"`

---

### Task 5: Express Microservice Decoupling (Port 4001)

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/src/routes/rag.ts`
- Modify: `server/src/routes/ragAggregate.ts`
- Test: Run server test suite (`npx vitest run`)

**Interfaces:**
- Consumes: RAG pipelines, n8n webhook proxies
- Produces: Lean Express microservice strictly on `/api/rag*`

- [ ] **Step 1: Streamline Express routes in `server/src/index.ts`**

Update `server/src/index.ts` to clearly delineate that standard LMS CRUD is served directly by Likha ERP, preserving `/api/rag`, `/api/rag-aggregate`, `/api/rag-baseline`, and health checks.

- [ ] **Step 2: Run all server test suites to verify zero regressions**

Run: `npx vitest run` in `server/`  
Expected: All 48 test suites (397 tests) pass.

- [ ] **Step 3: Commit changes**

Run: `git add server/src/index.ts && git commit -m "refactor(server): decouple Express to dedicated RAG and telemetry microservice"`

---

### Task 6: Full System Integration & Live Browser Verification

**Files:**
- Test: Run browser subagent end-to-end verification
- Create: `task-likha-backend-report.md`

**Interfaces:**
- End-to-end verification of Faculty, Student, and Automation workflows in live browser session.

- [ ] **Step 1: Execute Schema & Flows Migration on Likha ERP**

Run: `npx tsx -e "import { ensureLikhaRelationalSchema, ensureLikhaAutomationFlows } from './server/src/likha/migrations/initLikhaRelationalAndFlows.js'; (async () => { await ensureLikhaRelationalSchema(); await ensureLikhaAutomationFlows(); console.log('Likha migration complete!'); })()"`  
Expected: Successful execution with all relations and flows registered in Likha ERP.

- [ ] **Step 2: Run complete client and server test suites**

Run:
1. `npx vitest run` in `client/`
2. `npx vitest run` in `server/`  
Expected: 100% passing across both suites.

- [ ] **Step 3: Live Browser Verification with Browser Subagent**

Launch browser subagent to:
1. Log in to `http://localhost:5173`.
2. Navigate to course activities, create a new activity with attachments.
3. Verify that Likha Flow generated the corresponding notification in the notification bell.
4. Verify syllabus and files explorer load with relational single-roundtrip hydrations.
5. Capture screenshot evidence.

- [ ] **Step 4: Commit and generate final report**

Run: `git add . && git commit -m "feat(final): complete full system verification for Likha ERP true backend and automation"`
