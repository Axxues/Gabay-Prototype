# Phase 4 — Frontend Rewrite (API-backed LMSContext) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The React app runs entirely on the Phase 2 REST API: no `mockData.json` import, no localStorage LMS persistence, every CRUD function async over HTTP, with the JSON file deleted atomically in the same change that removes its last import.

**Architecture:** New `src/api/client.ts` (`apiFetch` attaches the `gabay_token` Bearer, parses JSON, throws typed `ApiError` on `{ error }` bodies). `LMSContext` keeps its exported names and the `MockDatabase`-shaped client cache (built from API responses), but every server-backed function becomes `async` and every caller is updated to `await` — `tsc` is the safety net that finds every call site. Reply/comment/submit flows drop their client-side `createNotification` calls (the server creates notifications inline). Client-side scorers and pure utils stay untouched. Browser-local state stays browser-local: theme/accent prefs, `lastVisitedAt` visit stamps (localStorage map merged into the presented user), navigation `historyLogs` (localStorage), alert/confirm/drawer UI state. `commonsTemplates` moves from JSON to a static `src/data/commonsTemplates.ts` constant (code, per the `syllabusData.ts` precedent — it is a content catalog, not placeholder data).

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind; vitest with mocked `global.fetch` (no live DB needed except Task 8).

**Spec:** `docs/superpowers/specs/2026-09-13-sql-server-migration-design.md` (§§1, 4–5)

## Global Constraints

- No `mockData.json` at end of phase: deleted in Task 6 atomically with its last import removal (deleting earlier breaks the Vite build — ruled in Phase 3).
- No localStorage LMS persistence at end of phase: `STORAGE_KEY_DB` writes/reads/merge blocks removed; session replaced by `gabay_token` (localStorage) + Bearer header. UI prefs (theme/accent), visit stamps, and history logs stay in localStorage.
- Every server-backed context function becomes `async`; `login` already is. Pure selectors and scorers stay sync.
- Server is the source of truth: mutations `await apiFetch`, then refresh the affected cache scope; errors surface via `lastError` + existing `showAlert`.
- Prisma MSSQL has no enums: client sends plain strings from the existing TS unions; no client change needed.
- `NVARCHAR(MAX)` blobs arrive parsed (objects/arrays) — client code keeps consuming them as today.
- Enrollment stays derived: section/enrollment reads come from request endpoints; `User.courseSections`/`enrolledCourseIds` in the cache are maintained client-side from request responses (same logic as today, fed by API data).
- Shell is Windows PowerShell 5.1: never use `&&` to chain commands.
- Tasks 1–7 verify offline (`tsc`, vitest with mocked fetch, `vite build`, dev boot). Task 8 touches the live DB + seeded accounts and is gated on the pending SQL restart — BLOCKED with the exact error if unreachable, no workarounds.

---

## File structure

- `src/api/client.ts` (new) — `apiFetch`, `ApiError`, token helpers.
- `src/api/client.test.ts` (new) — mocked-fetch unit tests.
- `src/context/LMSContext.tsx` (modify, in slices Tasks 1–6) — async API-backed functions, bootstrap loader, `isLoading`/`lastError`, local visit/history state, import/fallback removal.
- `src/data/commonsTemplates.ts` (new) — static catalog moved out of JSON.
- `src/data/mockData.json` (DELETE in Task 6, same commit as last import removal).
- `src/pages/*`, `src/components/**/*` (modify as callers — `await` fixes dictated by `tsc`, per task scope).

---

### Task 1: API client + auth + bootstrap + loading states

**Files:**
- Create: `src/api/client.ts`, `src/api/client.test.ts`
- Modify: `src/context/LMSContext.tsx` (auth slice only: `login`, `logout`, session restore, `isLoading`, `lastError`, bootstrap loader, `STORAGE_KEY_SESSION` removal)

**Interfaces:**
- Consumes: Phase 2 `POST /api/auth/login`, `GET /api/auth/me`
- Produces: `apiFetch(path, options?)`, `getToken`, `setToken`, `clearToken` consumed by Tasks 2–6. `login(emailOrId, password)` keeps its exact signature and return shape; `logout()` clears token + cache and reloads auth state (no page reload).

- [ ] **Step 1: Create `src/api/client.ts`**

```ts
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TOKEN_KEY = 'gabay_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions {
  method?: string;
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | T;
  if (!res.ok || (data && typeof data === 'object' && 'error' in (data as object))) {
    const err = (data as { error?: { code?: string; message?: string } })?.error;
    throw new ApiError(res.status, err?.code || 'request_failed', err?.message || `Request failed (${res.status}).`);
  }
  return data as T;
}
```

- [ ] **Step 2: Create `src/api/client.test.ts`** (mock `global.fetch`)

```ts
// src/api/client.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError, apiFetch, clearToken, setToken } from './client.js';

describe('apiFetch', () => {
  beforeEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });
  it('attaches the bearer token', async () => {
    setToken('tok-123');
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/api/x');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-123');
  });
  it('throws ApiError with the server envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 401,
      json: async () => ({ error: { code: 'unauthorized', message: 'Nope.' } }),
    })));
    const err = await apiFetch('/api/x').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('unauthorized');
  });
  it('throws request_failed on non-JSON errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => { throw new Error('bad'); } })));
    const err = await apiFetch('/api/x').catch(e => e);
    expect((err as ApiError).code).toBe('request_failed');
  });
});
```

Adjust the import path to match the repo's vitest resolution for `src/` (check how `src/utils/*.test.ts` import their subjects — mirror that style; if they use `./x` without extension, use `./client`).

- [ ] **Step 3: Rewrite the auth slice of `LMSContext.tsx`**

Replace the session-restore block (reads `STORAGE_KEY_SESSION`, matches against `initialMockData.users`) with: if `getToken()` exists, `GET /api/auth/me` → set user + `isAuthenticated: true`; on 401, `clearToken()` and stay logged out. Delete the `STORAGE_KEY_SESSION` constant and its read/write/remove calls. Rewrite `login(emailOrId, password)` to `POST /api/auth/login { email: emailOrId, password }` → `setToken(token)` → set user → trigger bootstrap (Step 4). Keep its return shape `{ success, message? }` (message from caught `ApiError`, generic fallback `'Login failed.'`). Rewrite `logout()` to `clearToken()` + reset cache to empty + `isAuthenticated: false` (no localStorage DB keys touched — those die in Task 6).

- [ ] **Step 4: Add bootstrap loader + `isLoading`/`lastError`**

Add context values `isLoading: boolean`, `lastError: string | null`, plus internal `refreshAll()` that on login/me loads: courses (`GET /api/courses?enrolled=<userId>` for students, all for faculty/admin per current visibility logic), notifications (`GET /api/notifications?limit=200`), messages (`GET /api/messages`), calendar (`GET /api/calendar`), and assembles the `MockDatabase`-shaped cache (other collections load empty here; Tasks 2–5 fill their loaders). `isLoading` is true during bootstrap; any failure sets `lastError` + `showAlert`. Export both new values in the provider value object and add them to the context interface. DO NOT change other slices in this task.

- [ ] **Step 5: Verify**

Run: `npx tsc -b` — expect PASS (auth callers already await `login`; new values are additive).
Run: `npx vitest run src/api/client.test.ts` — expect 3/3 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/api/client.ts src/api/client.test.ts src/context/LMSContext.tsx
git commit -m "feat(client): API client, token auth, bootstrap loader"
```

---

### Task 2: Courses, sections, requests, people, users slices

**Files:**
- Modify: `src/context/LMSContext.tsx` (course/request/user slices only), plus caller `await` fixes dictated by `tsc` (expected files: `CoursesPage`, `PeopleView`, `PendingRequestsPage`, `CreateCoursePage`, `SectionChooserPage`/`SectionSelectionPage`, `DashboardPage` invitations, `NotificationBell` approvals — fix exactly what `tsc` reports, no drive-by refactors)

**Interfaces:**
- Consumes: `apiFetch` (Task 1); Phase 2 users/courses/requests endpoints
- Produces: async course/request/user functions with unchanged names. `joinCourseByCode` keeps `{ success, message, course? }` shape (now async).

Function → endpoint map (exact; convert each, then refresh the course/request cache scope):
- `createCourse` → `POST /api/courses`; `updateSyllabus`-adjacent course PATCHes stay in Task 5 scope — only plain course create/update here
- `joinCourseByCode` → `POST /api/courses/join { code }` (pending → success message "awaiting approval" path preserved)
- `requestJoinCourse` → same join endpoint; `inviteStudent/enrollStudentsInCourse/enrollPerson` → `POST /api/courses/:id/invites` per student; `createEnrollmentRequest` → join or invites per type arg (`self_join` → join endpoint; `faculty_enroll` → invites)
- `approveEnrollmentRequests/rejectEnrollmentRequests` (arrays) → per-id approve/reject endpoints in sequence; `studentApproveInvitation` → accept; `studentDeclineInvitation` → decline
- `getPendingRequests/getPendingRequestsForCourse` → `GET .../requests?status=pending` (async; callers awaited); `getPendingRequestsForStudent` → client-side filter of a new `myRequests` cache filled at bootstrap via `GET /api/requests/mine`? NO invented endpoint — derive from course requests already cached per active course + a `GET` per enrolled course at bootstrap. Simplest faithful: bootstrap loads requests for each enrolled/taught course into cache; the getter filters cache (stays sync). Document the choice.
- `chooseSection/selectSection` → `POST .../choose-section`; `requestSectionSwitch` → `POST .../switch-section`
- `createSection/updateSection/deleteSection/getCourseSections/getStudentSection/getMyRequest` → sections/requests endpoints; `User.courseSections` in cache maintained from choose-section responses (current logic, API-fed)
- `createUser/updateUser/deleteUser` (admin) → users endpoints; `regenerateCourseJoinCode` → PATCH course joinCode (server generates? Client generates today — keep client-generated code string sent via PATCH; no new endpoint)
- `importCommonsTemplate` → builds the module payload client-side from the static catalog (Task 5 moves the data; THIS task converts its `createModule`/`addModuleItem` calls to awaited API versions from Task 3? NO — cross-task ordering: Task 2 must NOT depend on Task 3. Rule: Task 2 converts only course/request/user functions; `importCommonsTemplate` moves to Task 3 (module creation lives there). Record the move in the report.

- [ ] **Steps:** convert per map, run `npx tsc -b` and fix EVERY reported caller (await/async), run `npx vitest run` (full client suite — expect all green, pure utils unaffected), commit (`feat(client): API-backed courses, sections, requests, users`).

---

### Task 3: Modules, announcements, discussions slices + drop client notifications

**Files:**
- Modify: `src/context/LMSContext.tsx` (module/announcement/discussion slices), `src/pages/ModulesView.tsx` + `src/pages/AnnouncementsView.tsx` (DELETE the `createNotification` calls in comment/reply submit handlers — server creates them inline; keep the `addModuleComment`/`addAnnouncementReply` calls, now awaited), plus `tsc`-dictated caller fixes (`AddModuleItemPage`, `ModulesView`, `AnnouncementsView`, `CreateAnnouncementPage`, `importCommonsTemplate` moved here from Task 2)

**Interfaces:**
- Consumes: `apiFetch`; Phase 2 modules/assignments/announcements/discussions endpoints
- Produces: async module/announcement/discussion functions. `updateModule` keeps folder-rename behavior via server (no client change needed beyond await). `deleteModule/deleteAnnouncement` keep no-cascade semantics (server-side).

Function → endpoint map:
- `createModule/updateModule/deleteModule/addModuleItem/updateModuleItem/deleteModuleItem` → modules endpoints (file fields pass through; server files them)
- `addModuleComment/deleteModuleComment/editModuleComment/toggleLikeModuleComment` → comments endpoints; `markModuleCommentsRead` becomes: mark matching cached notifications read LOCALLY + `POST /api/notifications/read-all`? NO invented semantics — server has per-id read + typed read-all. Exact: mark local + `POST /api/notifications/read-all { type: 'module_comment_reply' }`? That would clear ALL module notifications, but client semantics clear only that module's. Faithful port: fetch own notifications, filter `relatedId === moduleId`, `POST /:id/read` each. Implement that.
- `createAnnouncement/deleteAnnouncement/togglePinAnnouncement/toggleLikeAnnouncement/addAnnouncementReply` → announcements endpoints; `markAnnouncementRead` → `POST .../read` + local cache update
- `createDiscussion` + discussion replies/likes/lock/pin → discussions endpoints
- `toggleLikeDiscussionReply`, `toggleLockDiscussion`, `togglePinDiscussion` → matching endpoints
- `importCommonsTemplate` (moved from Task 2): read template from static catalog (Task 5 creates the file — ORDERING: Task 3 needs the static file to exist. Ruling: Task 3 creates `src/data/commonsTemplates.ts` as part of this task by moving the array verbatim out of `mockData.json`... NO — file deletion is Task 6 atomic. Copy (not move): Task 3 creates the static file as a copy; Task 6 deletes the JSON. Duplication is temporary and intentional; ledger it.)

- [ ] **Steps:** convert per map, delete the two `createNotification` call sites, run `tsc` + fix callers, run full vitest, commit (`feat(client): API-backed modules, announcements, discussions`).

---

### Task 4: Assignments, submissions, quizzes, activities, grades slices

**Files:**
- Modify: `src/context/LMSContext.tsx` (assignment/submission/quiz/activity/grade slices), plus `tsc`-dictated caller fixes (`AssignmentsView`, `ActivitiesView`, `QuizzesView`, `CreateQuizPage`, `CreateActivityPage`, `CreateAssignmentPage`, `SpeedGraderModal`, `FacultyGradebook`, `StudentGradebook`, `DashboardPage` To-Do)

**Interfaces:**
- Consumes: `apiFetch`; Phase 2 assignments/assessments/grades endpoints; client scorers (`activities.ts`, quiz scoring in `QuizzesView`) stay untouched
- Produces: async functions; grading flows preserved end-to-end.

Function → endpoint map:
- `createAssignment` + assignment update/delete (whatever names exist: grep `Assignment` mutators) → assignments endpoints with array↔pass-through fields as today (server parses blobs)
- `recordQuizSubmission(quizId, studentId, answers)` → client keeps computing nothing new: it POSTs `{ answers }` to `/api/quizzes/:id/submit` and returns the server submission mapped to the `Submission` shape (score display continues to use the existing client-side scorer for instant feedback; gradebook reads the server row). Signature becomes `Promise<Submission>`.
- `recordActivitySubmission` → same pattern against `/api/activities/:id/submit` (essay-pending status preserved from server row)
- SpeedGrader grade actions → `POST /api/submissions/:id/grade`; submission comments → comments endpoint
- Gradebook reads → `GET /api/courses/:id/grades` (faculty all / student own); `updateCourseGrade`-style writers → PUT grades endpoint (grep exact names)
- `deleteActivity`, quiz deletes → DELETE endpoints

- [ ] **Steps:** convert per map, `tsc` + caller fixes, full vitest, commit (`feat(client): API-backed assignments, submissions, quizzes, activities, grades`).

---

### Task 5: Messages, calendar, notifications, files, syllabus, history slices

**Files:**
- Modify: `src/context/LMSContext.tsx` (message/calendar/notification/file/syllabus/history slices), plus `tsc`-dictated caller fixes (`InboxPage`, `CalendarPage`, `CreateEventPage`, `NotificationBell`, `FilesView`, `FilePickerModal`, `SyllabusView`, `HistoryDrawer`, `HelpDrawer`, dashboard widgets, LMS panels badges)
- Create: `src/data/commonsTemplates.ts` IF Task 3 did not already create it (check first — exactly one creator; if it exists, only import it)

**Interfaces:**
- Consumes: `apiFetch`; Phase 2 messages/calendar/notifications/files endpoints
- Produces: async functions; local-only state preserved.

Function → endpoint map:
- `sendMessage/markThreadAsRead/toggleMessageReaction/createChatGroup` → messages/groups endpoints
- `addCalendarEvent/updateCalendarEvent/deleteCalendarEvent/createAdvisingSlot/bookAdvisingSlot` (+ cancel, if exists) → calendar/advising endpoints
- `getNotifications/getUnreadNotificationCount` → derived from cached notifications (stays SYNC, cache-fed); `markNotificationRead/markAllNotificationsRead/createNotification` → notification endpoints (keep the direct-`createNotification` function for the bell panel's generic uses? The reply flows no longer call it (Task 3 removed those); remaining callers (if any) map to per-id read/all-read; grep and convert each remaining call site to the matching endpoint, deleting the generic client-side creator)
- `createCourseFolder/uploadCourseFile/deleteCourseFile/deleteCourseFolder/updateFileVisibility/renameCourseFile` → files endpoints; `ensureAreaFolder/ensureModuleFolder/fileUploadToArea` → DELETE these three client functions entirely and inline the server behavior at their call sites (server now owns filing): announcement composer calls plain upload-then-attach? NO — server files announcement attachments inline on announcement create (Phase 2 Task 6), so the composer just sends attachments; module items send file fields; syllabus apply sends the file. Convert each call site to the owning endpoint and remove the helpers. `useCourseFiles` aggregation keeps working (it reads `db.courseFiles` + virtual sources — now API-fed rows).
- `updateCourseSyllabus/removeCourseSyllabus` → PATCH course `syllabus` (object pass-through; server stringifies) / PATCH null
- `logHistory/clearHistory` → localStorage-backed (browser navigation log is inherently local; keep implementation, remove nothing)
- `commonsTemplates` reads → static import (create file here ONLY if Task 3 did not)

- [ ] **Steps:** convert per map, delete the three filing helpers + generic creator as specified, `tsc` + caller fixes, full vitest, commit (`feat(client): API-backed messages, calendar, notifications, files, syllabus`).

---

### Task 6: Delete mockData.json + remove all mock/localStorage logic (atomic)

**Files:**
- Modify: `src/context/LMSContext.tsx` (remove import + every fallback/merge/reset block + `STORAGE_KEY_DB` machinery)
- Delete: `src/data/mockData.json` (SAME commit as the last import removal — atomic, build never breaks)
- Test: repo-wide grep proof + full verification

**Interfaces:**
- Consumes: Tasks 1–5 (no caller may reference mock data after this)
- Produces: zero mock references. Terminal code task.

- [ ] **Step 1: Remove the import + fallback/merge/reset blocks**

Delete `import initialMockData from '../data/mockData.json'` and every block that reads it (load fallbacks for announcements/discussions/files/messages/chatGroups/modules/courses/users, session-user match, `resetData`'s `setDb(initialMockData...)`). Delete `resetData` entirely; convert its callers (grep `resetData`) — settings/debug UI triggers a logout + cache clear instead (exact: replace body with `logout()` call? `logout` clears token+cache per Task 1 — wire callers to `logout()`). Delete `STORAGE_KEY_DB` + all legacy-version keys + every `localStorage.getItem/setItem/removeItem` touching them (theme/accent/session-token/visits/history keys STAY).

- [ ] **Step 2: Delete the JSON file + prove zero references**

```bash
Remove-Item -LiteralPath src/data/mockData.json
```

Then grep (all must return NOTHING):
- `mockData` in `src/` (case-insensitive)
- `initialMockData` in `src/`
- `gabay_lms_db` in `src/` (the v6 key + legacy keys + backup key)
- `resetData` in `src/`

Record each grep + empty output in the report. Any hit is a defect in Tasks 1–5 — fix minimally in the owning slice (same commit allowed for stragglers), do NOT redesign.

- [ ] **Step 3: Verify**

Run: `npx tsc -b` — expect PASS.
Run: `npx vitest run` — expect all PASS (pure suites + client tests).
Run: `npm run build` — expect success (proves no dangling JSON import).
Boot check: `npm run dev` + `Invoke-RestMethod http://localhost:5173/` — expect HTTP 200 (login page renders without DB; login itself will fail gracefully — that is Task 8's territory).

- [ ] **Step 4: Commit**

```bash
git add src/context/LMSContext.tsx src/data/mockData.json <any other caller files touched>
git commit -m "feat(client): remove mock JSON database and localStorage persistence"
```

Use `git status` to enumerate the exact add list (must include the deleted `src/data/mockData.json`).

---

### Task 7: Offline verification (typecheck, tests, build, boot)

**Files:**
- Test only: no source changes unless verification exposes a defect (then fix minimally in the owning file, re-run its covering tests, record in report)

**Interfaces:**
- Consumes: Tasks 1–6
- Produces: verification evidence only.

- [ ] **Step 1: Run the full offline suite**

Run: `npx tsc -b` — expect PASS.
Run: `npx vitest run` — expect all PASS; record exact file/test counts.
Run: `npm run build` — expect success; record output tail.

- [ ] **Step 2: Boot + render smoke (no DB)**

Start `npm run dev` (Vite) + `npm --prefix server run dev` (API). `GET /api/health` → `{ ok: true }`. `GET http://localhost:5173/` → 200. Login attempt with any credentials → login form shows the server error message (not a crash, not a hang) — the app degrades gracefully without DB data.

- [ ] **Step 3: Report, no commit** (unless a defect fix landed — then commit per fix loop).

---

### Task 8: Live end-to-end against seeded GabayPrototype (DB-gated)

**Files:**
- Test only: manual matrix as the 4 seeded roles (no source changes unless a defect forces a fix)

**Interfaces:**
- Consumes: everything + live DB + Phase 3 seed rows + Task 10's API smoke (run it first if not yet done)
- Produces: end-to-end proof. Terminal task of Phase 4.

- [ ] **Step 1: Faculty journey**

Login as Faculty 1 → create course → create sections → create module + file item → post announcement with attachment → create quiz + activity → verify Files auto-folders → logout.

- [ ] **Step 2: Student journey**

Login as Student 1 → join by code → awaiting-approval state → (faculty approves in another session) → choose section → submit quiz/activity → verify auto-score display → verify Files/announcement scoping.

- [ ] **Step 3: Admin + cross-checks**

Login as Dean 1 → People/pending queue + bell approvals visible; grades PUT + student gradebook shows them; notifications bell + per-tab badges increment and clear on view.

- [ ] **Step 4: Record + gate**

Record each journey step PASS/FAIL with one-line evidence. If the DB is unreachable, report BLOCKED with the exact error (max two attempts). This task MUST NOT be marked complete on mocked evidence — live passes or BLOCKED, nothing else.

- [ ] **Step 5: No commit unless a defect fix landed.**

---

## Self-Review

**1. Spec coverage:** §1 data layer + §4 rewrite → Tasks 1–5 (every context slice mapped to endpoints; names preserved; async conversion with tsc-evidenced caller fixes); §4 removal list → Task 6 (import + fallbacks + reset + STORAGE keys + atomic file deletion with grep proof); §4 verification → Task 7 (tsc/vitest/build/boot); §5 end-to-end → Task 8 (4-role journeys). Empty-state honesty preserved (no mock rows reintroduced). No gaps within Phase 4 scope.

**2. Placeholder scan:** No TBD/TODO; Task 1 carries full code; Tasks 2–5 carry exact function→endpoint maps with named caller files and the tsc-driven caller-fix method; Task 6 carries exact grep proofs; Tasks 7–8 carry exact commands with expected outputs and BLOCKED paths. Cross-task moves (`importCommonsTemplate` → Task 3, commons file single-creator rule, filing-helper deletion) are explicit with ordering rules.

**3. Type consistency:** `apiFetch`, `getToken/setToken/clearToken`, `isLoading`, `lastError` named identically across tasks; `MockDatabase` cache type retained so component props don't churn; endpoint paths match Phase 2 routers verbatim (`/api/auth/*`, `/api/courses/join`, `/choose-section`, `/read-all`, `/uploads`); `gabay_token` is the single session key named in Task 1 and the spec.
