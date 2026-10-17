# Retire Legacy Backend & SQL Server Connections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely eliminate all remaining client `apiFetch` calls to dead Express `/api/` endpoints, migrate social interactivity and grade release to Directus Likha ERP with error-tolerant local state, and purge legacy SQL Server connection strings and Prisma migrations from the server repository.

**Architecture:** Extend `likhaLmsApi.ts` with Directus item mutations for module comments, message reactions, announcements, and discussion replies. Refactor `LMSContext.tsx` to handle all seven remaining LMS operations natively with optimistic local state and silent error suppression, eliminating `apiFetch` from `LMSContext`. Delete legacy SQL Server Prisma migrations on the server while maintaining the zero-dependency in-memory compatibility store for RAG telemetry.

**Tech Stack:** React 19, TypeScript, Directus REST API (`likhaLmsApi`), Vitest, Testing Library.

**Spec:** [`docs/superpowers/specs/2026-10-17-retire-legacy-backend-and-sql-server-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-17-retire-legacy-backend-and-sql-server-design.md)

## Global Constraints

- Zero Likha ERP REST DDL modifications (`/fields`, `/relations`, `/collections`) per `AGENTS.md`. Only standard item reads/writes (`/items/:collection`).
- Zero calls to Express `/api/` for core LMS operations; the Express server on port 4001 is strictly a RAG microservice (`/api/rag*`, `/api/health`).
- Error-tolerant persistence for optional Directus fields (`grades_released`, `liked_by`, `reaction`, etc.): never trigger failure `showAlert` modals when schema lacks custom fields.
- 100% test pass rate across all client and server test suites.
- Clean `tsc -b && vite build` with 0 TypeScript compilation errors.

## Review Focus

1. Grade release toggles must not display a "Grade Release Failed" alert if Directus lacks a custom `grades_released` column.
2. Liking a module comment or announcement must update the UI heart counter immediately, even when offline or if Directus returns a 400 unknown field error.
3. Message reaction toggle-off must remove the reaction in state and send `null` or empty string to the backend without error.
4. Server RAG telemetry and baseline routes must continue to pass tests after the deletion of `server/prisma/migrations/`.
5. Full client test suite must pass with 0 regressions across all 88+ test files.

---

### Task 1: Likha LMS Client API Item Mutation Extensions

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Produces:
  - `likhaLmsApi.modules.updateComment(id: string, updates: Record<string, any>): Promise<any>`
  - `likhaLmsApi.modules.deleteComment(id: string): Promise<void>`
  - `likhaLmsApi.communications.updateMessageReaction(id: string, reaction: string | null): Promise<any>`
  - `likhaLmsApi.communications.updateAnnouncement(id: string, updates: Record<string, any>): Promise<any>`
  - `likhaLmsApi.communications.updateDiscussionReply(id: string, updates: Record<string, any>): Promise<any>`

- [ ] **Step 1: Write the failing tests in `client/src/shared/api/likhaLmsApi.test.ts`**

```ts
it('updates a module comment via Directus items endpoint', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { id: 'mc-1', content: 'Edited comment' } }),
  } as any);
  const result = await likhaLmsApi.modules.updateComment('mc-1', { content: 'Edited comment' });
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/items/module_comments/mc-1'),
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ content: 'Edited comment' }),
    })
  );
  expect(result.content).toBe('Edited comment');
});

it('deletes a module comment via Directus items endpoint', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({}),
  } as any);
  await likhaLmsApi.modules.deleteComment('mc-1');
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/items/module_comments/mc-1'),
    expect.objectContaining({ method: 'DELETE' })
  );
});

it('updates a message reaction via Directus items endpoint', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { id: 'msg-1', reaction: '👍' } }),
  } as any);
  const result = await likhaLmsApi.communications.updateMessageReaction('msg-1', '👍');
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/items/messages/msg-1'),
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ reaction: '👍' }),
    })
  );
  expect(result.reaction).toBe('👍');
});

it('updates an announcement via Directus items endpoint', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { id: 'ann-1', pinned: true } }),
  } as any);
  const result = await likhaLmsApi.communications.updateAnnouncement('ann-1', { pinned: true });
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/items/announcements/ann-1'),
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ pinned: true }),
    })
  );
  expect(result.pinned).toBe(true);
});

it('updates a discussion reply via Directus items endpoint', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { id: 'dr-1', likes: 5 } }),
  } as any);
  const result = await likhaLmsApi.communications.updateDiscussionReply('dr-1', { likes: 5 });
  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('/items/discussion_replies/dr-1'),
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ likes: 5 }),
    })
  );
  expect(result.likes).toBe(5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/shared/api/likhaLmsApi.test.ts`
Expected: FAIL (missing methods on `likhaLmsApi.modules` and `likhaLmsApi.communications`)

- [ ] **Step 3: Implement the mutation methods in `client/src/shared/api/likhaLmsApi.ts`**

In `modules`:
```ts
async updateComment(id: string, updates: any): Promise<any> {
  return likhaRequest(`/items/module_comments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
},

async deleteComment(id: string): Promise<void> {
  await likhaRequest(`/items/module_comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
},
```

In `communications`:
```ts
async updateMessageReaction(id: string, reaction: string | null): Promise<any> {
  return likhaRequest(`/items/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ reaction }),
  });
},

async updateAnnouncement(id: string, updates: any): Promise<any> {
  return likhaRequest(`/items/announcements/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
},

async updateDiscussionReply(id: string, updates: any): Promise<any> {
  return likhaRequest(`/items/discussion_replies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/shared/api/likhaLmsApi.test.ts`
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/api/likhaLmsApi.test.ts
git commit -m "feat(api): add Directus mutation methods for comments, reactions, and social interactions"
```

---

### Task 2: LMSContext Migration: Zero-Express LMS Operations

**Files:**
- Modify: `client/src/shared/context/LMSContext.tsx`
- Test: Create `client/src/shared/context/LMSContext.zeroExpress.test.tsx`

**Interfaces:**
- Consumes: `likhaLmsApi.modules`, `likhaLmsApi.communications`, `likhaLmsApi.courses`
- Produces: `LMSContext` with zero Express `/api/` calls for LMS actions.

- [ ] **Step 1: Write the failing tests in `client/src/shared/context/LMSContext.zeroExpress.test.tsx`**

Test that invoking `setGradesReleased`, `editModuleComment`, `deleteModuleComment`, `toggleLikeModuleComment`, `toggleMessageReaction`, `toggleLikeAnnouncement`, `markAnnouncementRead`, and `toggleLikeDiscussionReply` makes zero calls to Express `apiFetch`, updates local state optimistically, and survives schema absences silently.

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/shared/context/LMSContext.zeroExpress.test.tsx`
Expected: FAIL (calls still made to `apiFetch`)

- [ ] **Step 3: Refactor the seven methods in `client/src/shared/context/LMSContext.tsx`**

1. In `setGradesReleased`:
   - Update `courses` state optimistically with `gradesReleased[term]`.
   - Attempt `likhaLmsApi.courses.updateCourse(courseId, { grades_released: ... }).catch(() => {})`.
   - Show success alert `"${term} grades are now visible to students"`.
   - Never roll back on backend absence.
2. In `editModuleComment`:
   - Update `modules.comments` state.
   - Call `likhaLmsApi.modules.updateComment(commentId, { content: newContent.trim() }).catch(() => {})`.
3. In `deleteModuleComment`:
   - Filter comment out of state.
   - Call `likhaLmsApi.modules.deleteComment(commentId).catch(() => {})`.
4. In `toggleLikeModuleComment`:
   - Toggle user in `likedBy` in state.
   - Catch Likha sync errors silently.
5. In `toggleMessageReaction`:
   - Toggle reaction in `messages` state.
   - Call `likhaLmsApi.communications.updateMessageReaction(messageId, nextReaction).catch(() => {})`.
6. In `toggleLikeAnnouncement` and `markAnnouncementRead`:
   - Update `likedBy` and `readBy` arrays in state.
   - Call `likhaLmsApi.communications.updateAnnouncement(id, ...).catch(() => {})`.
7. In `toggleLikeDiscussionReply`:
   - Update `replies.likedBy` in state.
   - Call `likhaLmsApi.communications.updateDiscussionReply(replyId, ...).catch(() => {})`.
8. Remove unused `apiFetch` import and purge legacy comments referencing Express `/api/auth/me` or `/api/courses` fallbacks.

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run src/shared/context/LMSContext.zeroExpress.test.tsx`
Expected: PASS

- [ ] **Step 5: Run client test suite regression**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run`
Expected: 89 / 89 test files PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/context/LMSContext.tsx client/src/shared/context/LMSContext.zeroExpress.test.tsx
git commit -m "refactor(context): migrate all remaining LMS operations to Likha ERP and optimistic state"
```

---

### Task 3: Server-Side SQL Server & Prisma Migrations Purge

**Files:**
- Delete: `server/prisma/migrations/`
- Verify: `server/.env`, `server/.env.example`
- Verify: `server/src/db.ts`

- [ ] **Step 1: Verify `server/.env` and `server/.env.example` have zero SQL Server connection strings**

Ensure no `DATABASE_URL` with `sqlserver://` exists.

- [ ] **Step 2: Delete `server/prisma/migrations/`**

Remove the obsolete `server/prisma/migrations/` directory containing SQL Server migration files.

- [ ] **Step 3: Run server test suite**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=server -- --run`
Expected: 18 / 18 test files PASS (198 / 198 tests)

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "chore(server): purge legacy SQL Server migrations and connection configurations"
```

---

### Task 4: Full End-to-End Regression & Production Build Gate

**Files:**
- None (verification only)

- [ ] **Step 1: Run full client test suite**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=client -- --run`
Expected: 100% test files PASS

- [ ] **Step 2: Run full server test suite**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm test --workspace=server -- --run`
Expected: 18 / 18 test files PASS

- [ ] **Step 3: Run client production build & typecheck**

Run: `$env:PATH = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;C:\Users\elain\AppData\Local\GitHubDesktop\app-3.6.7\resources\app\git\cmd;$env:PATH"; npm run build --workspace=client`
Expected: Code 0 (clean build with 0 TypeScript errors)
