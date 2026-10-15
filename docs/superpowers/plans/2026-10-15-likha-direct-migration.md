# Likha-Direct Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every client fetch to the Express `server/` middleman except RAG, so Likha ERP (`https://gabay.zyberlab.com`) is the only backend.

**Architecture:** Flip each `LMSContext` data function from Express-primary (`apiFetch('/api/...')`, proxied to dead `localhost:4001` routes) to Likha-primary (`likhaLmsApi.<area>.<method>`). `apiFetch` stays for RAG only (`client/src/shared/api/rag.ts`, proxied to the Express RAG microservice). Existing vitest suites that mock Express paths are rewritten to mock `likhaLmsApi`.

**Tech Stack:** React + TypeScript, Vitest + Testing Library (jsdom), Directus REST via `likhaLmsApi`, PowerShell 5.1 shell.

**Spec:** User directive 2026-10-15 ("apart from the RAG, the true backend should only be Likha ERP without the server/ as the middleman") + `AGENTS.md` Likha-ERP directive (no backend DDL via code/REST — schema changes go through the `browser_subagent` on `https://gabay.zyberlab.com/admin`).

## Global Constraints

- RAG calls (`/api/rag`, `/api/rag-baseline`, `/api/rag-aggregate`, `/api/rag-export` via `client/src/shared/api/rag.ts` + `GabayChatContext.tsx`) are OUT OF SCOPE and must keep working through the Vite `/api` proxy.
- NEVER create/modify Likha collections, fields, relations, or Flows from code or scripts. If a task needs a missing backend field/table, stop that subtask and record it as a `browser_subagent` follow-up instead of working around it in client code.
- TDD: every behavior change gets a failing test first; watch it fail for the right reason before implementing.
- `npx vitest run <files>` for affected suites must pass; full client suite (68 files / 349 tests baseline) must stay green except the 7 listed test files whose Express mocks are intentionally rewritten.
- All shell commands run with `workdir: D:\4thesis\GabaySystem\Gabay-Prototype` (repo root) or `client` for client-scoped commands. PowerShell syntax only.

---

## Current-State Inventory (verified 2026-10-15)

125 `apiFetch` call sites in `client/src` (non-test): `LMSContext.tsx` 115, `syllabus.ts` 7, `rag.ts` 2 (KEEP), `client.ts` 1 (definition). 7 test files mock Express paths and assert on them: `LMSContext.updateUser/syllabus/markTabVisited/gradesRelease/enrollmentScope/authReady` tests + `shared/api/syllabus.test.ts`.

Express → Likha mapping (from `client/src/shared/api/likhaLmsApi.ts` method list):

| Express call | Likha equivalent (exists today) | Gap |
|---|---|---|
| GET/POST/PATCH/DELETE `/api/courses` | `courses.getCourses/getCourse/createCourse/updateCourse/deleteCourse` | none |
| sections GET/POST | `sections.getSections/createSection` | ADD `updateSection`, `deleteSection` |
| requests pending/approved/mine/join/approve/reject | `requests.getRequests/createRequest/updateRequest` | ADD `deleteRequest` if remove-feature needs it |
| modules/items/comments | `modules.*` (all 8 methods) | none |
| activities/quizzes/exams CRUD | `assessments.*` (all 9 methods) | none |
| submit/manual-grade/grades-release | `submissions.submitAssessment/gradeSubmission` | `grades-release` semantics → verify-then-map (Task 6) |
| grades/SPR config | `grades.*` (all 4 methods) | none |
| announcements/discussions/replies | `communications.*` | likes/reads have NO method → Task 8 decision |
| notifications/messages/groups/thread-read/read-all | `communications.getNotifications/markNotificationRead/getMessages/sendMessage/getChatGroups/createChatGroup` | ADD `markAllRead`, `markThreadRead` (or loop single-call) |
| calendar/advising CRUD | `communications.getCalendarEvents/createCalendarEvent/getAdvisingSlots/bookAdvisingSlot` | ADD `update/deleteCalendarEvent`, `create/deleteAdvisingSlot` |
| users CRUD | `users.getUsers/updateUser` | ADD `users.deleteUser` (Directus `DELETE /users/:id`) |
| files/folders/upload | `files.uploadFile/getCourseFiles/createCourseFile` | ADD file/folder update/delete; retarget Vite upload plugin |
| syllabus revisions protocol | NONE (`likhaLmsApi.syllabus` is get/create/update only) | Task 10 decision, do NOT improvise |
| `/api/rag*` | n/a — stays on Express | KEEP |

---

### Task 1: Bootstrap reads → Likha-primary

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:849-1140` (`refreshAll`: courses, users, notifications, messages, calendar, groups, advising, requests, sections, per-course scope)
- Modify tests: `LMSContext.enrollmentScope.test.tsx`, `LMSContext.authReady.test.tsx`, `LMSContext.markTabVisited.test.tsx` (rewrite `apiFetchMock` Express paths to a `likhaLmsApi` mock returning Directus-shaped rows; keep one Express-fallback-missing assertion if fallback is removed entirely)

**Interfaces:**
- Consumes: `likhaLmsApi.getCoursesWithRelations()`, `users.getUsers()`, `getNotifications(userId)`, `getMessages()`, `communications.getCalendarEvents/getChatGroups/getAdvisingSlots()`, `requests.getRequests()`, `sections.getSections()`
- Produces: `db` populated with zero `apiFetch('/api/...')` calls on the bootstrap path (RAG untouched)

- [ ] **Step 1: Write the failing test.** Extend `LMSContext.userDirectoryRoles.test.tsx` (already mocks `likhaLmsApi`; already green) with a bootstrap-shape test, or add to the task's touched suite, e.g. assert no Express fallback fires during `refreshAll`:

```tsx
test('bootstrap performs zero Express /api calls when Likha answers', async () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await doLogin!();
  });
  await waitFor(() => {
    expect((seenUsers || []).length).toBe(4);
  });
  const expressCalls = (apiFetchMock.mock.calls as any[][]).filter(([p]) =>
    String(p).startsWith('/api/') && !String(p).startsWith('/api/rag'),
  );
  expect(expressCalls).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/context/LMSContext.userDirectoryRoles.test.tsx` (workdir: `client`)
Expected: FAIL — `expressCalls` contains `/api/courses`, `/api/notifications?limit=200`, `/api/messages`, `/api/calendar`, `/api/groups`, `/api/advising`, `/api/requests/mine`.

- [ ] **Step 3: Write minimal implementation.** In `refreshAll`, replace each Express fallback block with its Likha call. Pattern per block (courses example, ~line 889):

```ts
// Fall back to Express / test mock if Likha didn't yield courses
if (resolvedCourses.length === 0) {
  const [coursesSettled, notificationsSettled, messagesSettled, calendarSettled] = await Promise.allSettled([
    apiFetch<{ courses: Course[] }>(coursesPath),
    ...
```

becomes Likha-primary with the same `resolvedCourses`/`notificationsRes`/`messagesRes`/`calendarRes` variable names so downstream code is untouched. Same treatment for groups/advising (~line 1013), per-course sections/requests scope (~line 1037), `/api/requests/mine` (~line 1067), and the users block (~line 909, keep `fresh.users = [user, ...others]` shape). Delete each replaced `apiFetch` import usage; do NOT delete the `apiFetch` import itself yet (later tasks still use it).

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/context/LMSContext.userDirectoryRoles.test.tsx src/shared/context/LMSContext.enrollmentScope.test.tsx src/shared/context/LMSContext.authReady.test.tsx src/shared/context/LMSContext.markTabVisited.test.tsx` (workdir: `client`)
Expected: PASS. (The three rewritten suites now mock `likhaLmsApi` instead of Express paths, using the `loginLikhaMock`/`getUsersMock` closure pattern from `LMSContext.userDirectoryRoles.test.tsx`.)

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.*.test.tsx
git commit -m "refactor(client): likha-direct bootstrap reads"
```

---

### Task 2: Auth → Likha-only (remove Express login fallback)

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:1390-1439` (`login`), `:1302-1353` (session restore)
- Modify tests: `LMSContext.authReady.test.tsx`, `LMSContext.markTabVisited.test.tsx`, `LMSContext.gradesRelease.test.tsx`, `LMSContext.updateUser.test.tsx`, `LMSContext.enrollmentScope.test.tsx` (replace `/api/auth/login` + `/api/auth/me` mocks with `loginLikhaUser` / `auth.getMe` mocks)

**Interfaces:**
- Consumes: `likhaLmsApi.loginLikhaUser(email, password) -> { token, user }`, `likhaLmsApi.auth.getMe()`
- Produces: `login()` succeeds/fails purely on Likha; Express `POST /api/auth/login` call deleted

- [ ] **Step 1: Write the failing test.** In `LMSContext.authReady.test.tsx` style, assert login never touches Express:

```tsx
test('login performs zero Express calls', async () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await doLogin!();
  });
  await waitFor(() => {
    expect(loginResult).toEqual({ success: true });
  });
  expect(apiFetchMock).not.toHaveBeenCalled();
});
```

(`Probe` captures the `login()` return into `loginResult`; `likhaLmsApi.loginLikhaUser` mock returns `{ token: 't', user: { id: 'u1', first_name: 'F', last_name: 'L', email: 'f@x', role: { name: 'Instructor' } } }`.)

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/context/LMSContext.authReady.test.tsx` (workdir: `client`)
Expected: FAIL — `apiFetchMock` received `/api/...` calls (Express fallback path executes).

- [ ] **Step 3: Write minimal implementation.** Delete the Express fallback block in `login()` (~lines 1426-1434):

```ts
try {
  const { token, user } = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: { email: emailOrId, password },
  });
  setToken(token);
  setCurrentUser(user);
  await refreshAll(user);
  return { success: true };
} catch (err) {
  ...
}
```

Replace with a Likha failure return: `return { success: false, message: 'Login failed.' };`. Same for session restore (~lines 1339-1353): if `auth.getMe()` yields no user, `clearToken(); return;` with no `apiFetch('/api/auth/me')` attempt. Keep the existing role-mapping lines (1311-1317, 1396-1402) byte-identical.

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/context/LMSContext.authReady.test.tsx src/shared/context/LMSContext.markTabVisited.test.tsx src/shared/context/LMSContext.gradesRelease.test.tsx src/shared/context/LMSContext.updateUser.test.tsx src/shared/context/LMSContext.enrollmentScope.test.tsx` (workdir: `client`)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.*.test.tsx
git commit -m "refactor(client): likha-only auth, drop express login fallback"
```

---

### Task 3: Users CRUD → `likhaLmsApi.users` (+ add `deleteUser`)

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:160-172` (add `deleteUser`)
- Modify: `client/src/shared/context/LMSContext.tsx:2360-2470` (`createUser`, `updateUser`, `deleteUser`)
- Modify test: `client/src/shared/context/LMSContext.updateUser.test.tsx`

**Interfaces:**
- Consumes: `likhaLmsApi.users.getUsers/updateUser/deleteUser`
- Produces: `users.deleteUser(id)` issuing Directus `DELETE /users/:id`; zero `/api/users` calls in `LMSContext.tsx`

- [ ] **Step 1: Write the failing test.** In `likhaLmsApi.test.ts` style:

```ts
it('deletes a user via Directus users endpoint', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as any);
  await likhaLmsApi.users.deleteUser('u-1');
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/users/u-1'),
    expect.objectContaining({ method: 'DELETE' })
  );
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/api/likhaLmsApi.test.ts` (workdir: `client`)
Expected: FAIL with `deleteUser is not a function`.

- [ ] **Step 3: Write minimal implementation.** Add beside `updateUser` in `likhaLmsApi.ts`:

```ts
async deleteUser(id: string): Promise<void> {
  await likhaRequest(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
},
```

Then rewrite `createUser`/`updateUser`/`deleteUser` in `LMSContext.tsx` (~lines 2360-2470) to call `likhaLmsApi.users.*` and map the Directus row back to `User` with the canonical role mapping (`faculty|instructor` → `faculty`, `admin` → `admin`, `staff` → `staff`, else `student` — same predicate as the directory mapping).

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/api/likhaLmsApi.test.ts src/shared/context/LMSContext.updateUser.test.tsx` (workdir: `client`)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.updateUser.test.tsx
git commit -m "refactor(client): users CRUD via likha-direct"
```

---

### Task 4: Courses, sections, enrollment requests

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts` (add `sections.updateSection`, `sections.deleteSection`, `requests.deleteRequest` ONLY if a call site needs them)
- Modify: `client/src/shared/context/LMSContext.tsx:1573` (createCourse), `:2540-2556` (join-code PATCH), `:2714-2740` (update/delete course), `:2318-2345`, `:2512`, `:4706-4761`, `:4881-4918`, `:4970-5157` (requests flows), `:4570-4665` (sections), `:4987-5033` (course delete)

**Interfaces:**
- Consumes: `likhaLmsApi.courses.*`, `sections.getSections/createSection`, `requests.getRequests/createRequest/updateRequest`
- Produces: zero `/api/courses*`, `/api/sections*` calls outside RAG

- [ ] **Step 1: Write the failing test.** New `LMSContext.coursesLikha.test.tsx` (copy the `LMSContext.userDirectoryRoles.test.tsx` harness: `vi.mock('../api/client')` with `likhaLmsApi` closures + `apiFetchMock`): drive `createCourse` via a `Probe` exposing context functions, assert `likhaLmsApi.courses.createCourse` called and `apiFetchMock` never called with `/api/courses`:

```tsx
test('createCourse writes through Likha, never Express', async () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    createResult = await doCreateCourse!({ code: 'CS 101', title: 'Intro' });
  });
  expect(createCourseMock).toHaveBeenCalledTimes(1);
  const expressCalls = (apiFetchMock.mock.calls as any[][]).filter(([p]) => String(p).startsWith('/api/courses'));
  expect(expressCalls).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/context/LMSContext.coursesLikha.test.tsx` (workdir: `client`)
Expected: FAIL — `createCourseMock` has 0 calls; `apiFetchMock` received `/api/courses`.

- [ ] **Step 3: Write minimal implementation.** Per function, replace the `apiFetch` call with the `likhaLmsApi` equivalent, preserving the surrounding `setDb` update and return shape. Added methods follow the existing file pattern, e.g.:

```ts
async updateSection(id: string, updates: any): Promise<any> {
  return likhaRequest(`/items/sections/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
},
```

(Confirm the collection path segment against the sibling `getSections`/`createSection` implementations in the same file — do NOT guess a different collection name.)

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/context/LMSContext.coursesLikha.test.tsx src/shared/context/LMSContext.enrollmentScope.test.tsx` (workdir: `client`)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.coursesLikha.test.tsx client/src/shared/context/LMSContext.enrollmentScope.test.tsx
git commit -m "refactor(client): courses, sections, requests via likha-direct"
```

---

### Task 5: Modules, items, comments

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:1629-1865` (module/item CRUD), `:2952-3046` (module comments + delete), plus `useCourseFiles.ts` read fallbacks if they call `/api/...` (verify with grep; migrate only what exists)
- Test: extend `LMSContext.coursesLikha.test.tsx`-style coverage with a new `LMSContext.modulesLikha.test.tsx` if no existing suite covers these paths

**Interfaces:**
- Consumes: `likhaLmsApi.modules.getModulesWithItems/createModule/updateModule/deleteModule/createModuleItem/updateModuleItem/deleteModuleItem/getComments/addComment`
- Produces: zero `/api/.../modules`, `/api/modules/*` calls

- [ ] **Step 1: Write the failing test.** Same harness shape as Task 4, driving `createModule` + `addModuleItem`:

```tsx
test('createModule writes through Likha, never Express', async () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await doCreateModule!({ courseId: 'c1', title: 'Week 1' });
  });
  expect(createModuleMock).toHaveBeenCalledTimes(1);
  expect(apiFetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/'), expect.anything());
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/context/LMSContext.modulesLikha.test.tsx` (workdir: `client`)
Expected: FAIL — `createModuleMock` 0 calls.

- [ ] **Step 3: Write minimal implementation.** Replace each `apiFetch` module/item/comment call with the matching `likhaLmsApi.modules.*` call, preserving `setDb` updates. The Likha methods already exist for the full set — no new API methods expected.

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/context/LMSContext.modulesLikha.test.tsx` (workdir: `client`)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.modulesLikha.test.tsx
git commit -m "refactor(client): modules, items, comments via likha-direct"
```

---

### Task 6: Assessments, submissions, manual grading, grades-release

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:1156-1159` (assessment bootstrap reads), `:1224-1234` (submissions reads), `:1887-1955` (quiz create/submit), `:1983-2049` (exam create/submit), `:2118-2267` (activity CRUD), `:2809-2905` (grading + comments), `:2740`, `:2860` (grades-release, manual-grade)
- Modify test: `LMSContext.gradesRelease.test.tsx`, `LMSContext.syllabus.test.tsx` (assessment bootstrap mocks at lines 97-101)

**Interfaces:**
- Consumes: `likhaLmsApi.assessments.*`, `submissions.getSubmissions/submitAssessment/gradeSubmission/addRubricScore/addSubmissionComment`
- Produces: zero `/api/quizzes`, `/api/exams`, `/api/activities`, `/api/*/submissions` calls; `grades-release` mapped or explicitly deferred (see Step 3)

- [ ] **Step 1: Write the failing test.** Bootstrap-level, in `LMSContext.syllabus.test.tsx` style but asserting Likha:

```tsx
test('assessment bootstrap reads through Likha, never Express', async () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await doLogin!();
  });
  await waitFor(() => {
    expect(getQuizzesMock).toHaveBeenCalled();
  });
  const expressCalls = (apiFetchMock.mock.calls as any[][]).filter(([p]) =>
    /\/api\/(quizzes|exams|activities)/.test(String(p)),
  );
  expect(expressCalls).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/context/LMSContext.syllabus.test.tsx` (workdir: `client`)
Expected: FAIL — Express `/api/quizzes?courseId=...` calls present, Likha mocks uncalled.

- [ ] **Step 3: Write minimal implementation.** Replace reads (1156-1159, 1224-1234) and writes (1887+) with `assessments.*` / `submissions.*`. Mapping notes: quiz/exam/activity submit → `submissions.submitAssessment`; `manual-grade` → `submissions.gradeSubmission`; `grades-release` (`:2740`) → read its function body first: if it flips a per-course release flag, map to `courses.updateCourse` with the same field name the Likha course row already carries; if no such field exists, DO NOT invent schema — leave that single call site on Express, mark it `// likha-gap: grades-release needs backend field (browser_subagent follow-up)`, and record it in the task summary. Same rule for anything else without a Likha counterpart.

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/context/LMSContext.syllabus.test.tsx src/shared/context/LMSContext.gradesRelease.test.tsx` (workdir: `client`)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.syllabus.test.tsx client/src/shared/context/LMSContext.gradesRelease.test.tsx
git commit -m "refactor(client): assessments and submissions via likha-direct"
```

---

### Task 7: Grades + SPR

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx:1159` (`/grades` bootstrap read), `:1194-1210` (SPR bootstrap), `:4298` (save grade), `:4335-4336` (SPR+grades reads), `:4366`, `:4465` (SPR save/update)
- Test: new `LMSContext.gradesSprLikha.test.tsx` (same harness shape as Task 4)

**Interfaces:**
- Consumes: `likhaLmsApi.grades.getCourseGrades/saveGradeWithCells/getSPRConfig/saveSPRConfig`
- Produces: zero `/api/courses/*/grades`, `/api/courses/*/spr` calls

- [ ] **Step 1: Write the failing test.**

```tsx
test('gradebook bootstrap reads through Likha, never Express', async () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await doLogin!();
  });
  await waitFor(() => {
    expect(getCourseGradesMock).toHaveBeenCalled();
  });
  const expressCalls = (apiFetchMock.mock.calls as any[][]).filter(([p]) => /\/api\/courses\/.+\/(grades|spr)/.test(String(p)));
  expect(expressCalls).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/context/LMSContext.gradesSprLikha.test.tsx` (workdir: `client`)
Expected: FAIL — Express grade/SPR calls present.

- [ ] **Step 3: Write minimal implementation.** Map reads and both SPR/grade writes to `grades.*`. Preserve the `sprCells` payload shape the gradebook UI consumes — the Likha methods already carry it (`saveGradeWithCells(courseId, studentId, cells)`).

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/context/LMSContext.gradesSprLikha.test.tsx` (workdir: `client`)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.gradesSprLikha.test.tsx
git commit -m "refactor(client): grades and SPR via likha-direct"
```

---

### Task 8: Communications (announcements, discussions, notifications, messages, groups, calendar, advising)

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts` (ADD `markAllNotificationsRead`, `markThreadRead`, calendar update/delete, advising create/delete — only the ones a call site needs, each following the existing `likhaRequest` pattern)
- Modify: `client/src/shared/context/LMSContext.tsx:3115-3300` (messages/groups/advising/calendar), `:3363-3576` (announcements + replies + likes + reads), `:3625-3703` (notifications), `:3731-3892` (discussions + replies + likes), `:1120-1122` (bootstrap reads)

**Interfaces:**
- Consumes: `likhaLmsApi.communications.*` (existing + added)
- Produces: zero non-RAG `/api/announcements`, `/api/discussions`, `/api/messages`, `/api/groups`, `/api/calendar`, `/api/advising`, `/api/notifications` calls

- [ ] **Step 1: Write the failing test.** New `LMSContext.communicationsLikha.test.tsx`:

```tsx
test('sendMessage writes through Likha, never Express', async () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await doSendMessage!({ courseId: 'c1', subject: 'Hi', body: 'Hello' });
  });
  expect(sendMessageMock).toHaveBeenCalledTimes(1);
  expect(apiFetchMock).not.toHaveBeenCalledWith('/api/messages', expect.anything());
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/context/LMSContext.communicationsLikha.test.tsx` (workdir: `client`)
Expected: FAIL — `sendMessageMock` 0 calls.

- [ ] **Step 3: Write minimal implementation.** Migrate reads first (1120-1122, bootstrap uses `getAnnouncements/getDiscussions` which exist), then writes. For likes (`:3068`, `:3517`, `:3892`), reads (`:3576`), thread-read (`:3224`), read-all (`:3651`): check whether a backing Directus collection/field is already reachable through existing `communications.*` methods. If yes, use it. If no, DO NOT invent schema and DO NOT silently drop the feature: keep that single call site on Express with a `// likha-gap: <what> needs backend support (browser_subagent follow-up)` comment and list it in the commit message body. Consistency beats completeness here — the sweep task reports remaining gaps instead of hiding them.

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/context/LMSContext.communicationsLikha.test.tsx` (workdir: `client`)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.communicationsLikha.test.tsx
git commit -m "refactor(client): communications via likha-direct"
```

---

### Task 9: Files, folders, uploads (+ `/uploads` proxy)

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts` (ADD file/folder update/delete following the `createCourseFile` pattern)
- Modify: `client/src/shared/context/LMSContext.tsx:1262-1263` (folders/files bootstrap), `:3926-4222` (folder/file CRUD + `fetch('/api/courses/.../files/upload')` at `:4005`)
- Modify: `client/vite.config.ts:44-57,106-108` (upload plugin target + `/uploads` proxy)
- Modify: `client/src/shared/utils/fileUploader.ts` (switch from Vite-middleware upload to `likhaLmsApi.files.uploadFile`)

**Interfaces:**
- Consumes: `likhaLmsApi.files.uploadFile/getCourseFiles/createCourseFile` (+ added update/delete)
- Produces: zero `/api/courses/*/folders`, `/api/courses/*/files`, `/api/files/*`, `/api/folders/*` calls; `/uploads` proxy entry removed (Likha serves absolute `/assets/` URLs; `client/public/uploads` serves dev-local files directly)

- [ ] **Step 1: Write the failing test.** New `LMSContext.filesLikha.test.tsx`:

```tsx
test('file listing reads through Likha, never Express', async () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await doLogin!();
  });
  await waitFor(() => {
    expect(getCourseFilesMock).toHaveBeenCalled();
  });
  const expressCalls = (apiFetchMock.mock.calls as any[][]).filter(([p]) => /\/api\/(courses\/.+\/(folders|files)|files|folders)/.test(String(p)));
  expect(expressCalls).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npx vitest run src/shared/context/LMSContext.filesLikha.test.tsx` (workdir: `client`)
Expected: FAIL — Express folders/files calls present.

- [ ] **Step 3: Write minimal implementation.** Migrate folder/file CRUD to `files.*`; route the `:4005` multipart upload through `likhaLmsApi.files.uploadFile` (it already does Directus `/files` multipart — see `likhaLmsApi.test.ts` "submits a file directly"). In `vite.config.ts`, delete the `'/uploads': 'http://localhost:4001'` proxy line (the Express static mount is gone, so the proxy only 404s; Vite serves `client/public/uploads` directly). Retarget `fileUploadPlugin` candidates to `client/public/uploads` or delete the plugin if `fileUploader.ts` no longer calls `/api/upload` — check callers with grep first, keep whichever half is still referenced.

- [ ] **Step 4: Run test to verify it passes.**

Run: `npx vitest run src/shared/context/LMSContext.filesLikha.test.tsx` (workdir: `client`)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx client/vite.config.ts client/src/shared/utils/fileUploader.ts client/src/shared/context/LMSContext.filesLikha.test.tsx
git commit -m "refactor(client): files and uploads via likha-direct"
```

---

### Task 10: Syllabus revision protocol — DECISION (no code until decided)

**Files:** None yet. Read-only: `client/src/shared/api/syllabus.ts` (82 lines, 7 Express calls), `client/src/shared/api/syllabus.test.ts` (asserts Express revision URLs), `client/src/shared/context/LMSContext.syllabus.test.tsx` (mocks the revision protocol), `likhaLmsApi.syllabus.*` (`getSyllabus/createSyllabus/updateSyllabus` only).

**Context:** The Express syllabus router implemented a draft → revise → publish protocol with row-version concurrency (`If-Match`). It was deleted with `server/`. The Likha side has flat get/create/update only. There is no mechanical mapping.

- [ ] **Step 1: Present the decision to the human partner with these three options and a recommendation:**

```text
Option A (recommended): read-only syllabus from Likha (getSyllabus) + disable
  editing UI with a "managed in Likha ERP" notice until the revision tables
  exist. Smallest diff, zero invented schema.
Option B: reimplement the revision protocol on Likha collections. Requires
  new backend tables/fields -> browser_subagent work on the LIVE ERP first,
  then client mapping. Largest, riskiest.
Option C: defer — leave syllabus.ts on Express (documented exception) until
  A or B is scheduled.
```

- [ ] **Step 2: Implement ONLY the chosen option** as its own TDD task (test + code + suite run), following the same 5-step shape as Tasks 1-9.
- [ ] **Step 3: Commit.**

```bash
git add client/src/shared/api/syllabus.ts client/src/shared/api/syllabus.test.ts client/src/shared/context/LMSContext.tsx
git commit -m "refactor(client): syllabus <chosen-option>"
```

---

### Task 11: Final sweep + gate

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx` (remove `apiFetch` import IFF zero non-test usages remain outside `rag.ts`/`syllabus.ts`-exception paths)
- Modify: `client/vite.config.ts` (keep `/api` proxy — RAG needs it; confirm `/uploads` removal from Task 9)

**Interfaces:**
- Consumes: all previous tasks
- Produces: grep-clean tree, green suite, gap list

- [ ] **Step 1: Run the gate grep and confirm zero non-RAG Express calls.**

Run (workdir repo root):
```powershell
Get-ChildItem client/src -Recurse -Include *.ts,*.tsx | Where-Object { $_.Name -notlike '*.test.*' } | Select-String -Pattern "apiFetch\s*[<(]" | ForEach-Object { "$($_.Filename):$($_.LineNumber)" }
```

Expected: only `client.ts` (definition) and `rag.ts` (2 RAG calls) remain. Every other hit is a missed migration — send it back to its task, do not fix inline.

- [ ] **Step 2: Run the FULL client suite.**

Run: `npx vitest run` (workdir: `client`)
Expected: all files pass (baseline was 68 files / 349 tests; count grows with the new `*Likha.test.tsx` files).

- [ ] **Step 3: Manual smoke (needs both dev servers + Likha access).** Start `npm run dev:client` and `npm run dev:server` (two terminals; `dev:all` is broken in PowerShell). Log in, confirm: Manage-accounts counts, one course page with modules, one quiz list, one gradebook view, one file listing, one RAG chat message. Record any `likha-gap` leftovers from Tasks 6/8/10 in the final summary.

- [ ] **Step 4: Commit (only if Step 1-2 changed files).**

```bash
git add -A
git commit -m "chore(client): final likha-direct sweep"
```

---

## Self-Review

1. **Spec coverage:** every `/api/*` family in the inventory maps to a task (auth→2, bootstrap→1, users→3, courses/sections/requests→4, modules→5, assessments→6, grades/SPR→7, communications→8, files→9, syllabus→10, gate→11). RAG explicitly excluded everywhere. `likha-gap` rule + Task 10 + AGENTS.md constraint handling covers the no-backend-DDL requirement.
2. **Placeholder scan:** no TBD/TODO; each step names exact files, lines, commands, and expected outputs. New-API additions cite the sibling pattern to copy. Decision points (grades-release, likes/reads, syllabus) name the fallback explicitly instead of hand-waving.
3. **Type consistency:** `likhaLmsApi` method names in tasks match the verified inventory (`getCoursesWithRelations`, `saveGradeWithCells`, `bookAdvisingSlot`, etc.); test harness pattern matches the proven `LMSContext.userDirectoryRoles.test.tsx` closure style (direct factory references break vitest hoisting — noted in Task 1).
