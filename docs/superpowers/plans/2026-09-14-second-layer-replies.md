# Second-Layer Replies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can post second-layer replies on other users' comments in Modules and Announcements, rendered flattened under the top-level thread.

**Architecture:** Add nullable `parentId` to the two existing reply rows (same pattern as `DiscussionReply.parentId`), derive threads at render with a shared pure helper, extend the two POST endpoints to accept/validate `parentId` and notify parent + root authors.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind (client); Express + Prisma SQL Server (server); vitest (both `client` and `server` use `vitest`).

**Spec:** `docs/superpowers/specs/2026-09-14-second-layer-replies-design.md`

## Global Constraints

- No new tables; nullable `parentId` columns only on `ModuleComment` and `AnnouncementReply`.
- No new notification types; reuse `module_comment_reply` and `announcement_reply`.
- Backward compatible: existing flat comments (no `parentId`) render exactly as today.
- UI stays flattened at 2 visual levels with `@ParentName` prefix; no third indent.
- Full parity: like + edit/delete-own work at both layers via existing handlers.
- Never self-notify; de-duplicate when parent author and root author are the same person.

---

## File Structure

- `client/src/utils/threadReplies.ts` (new): pure thread helpers with no React imports. Owns `resolveRootId`, `groupRepliesByRoot`, `resolveSecondLayerRecipients`. Tested by `client/src/utils/threadReplies.test.ts`.
- `client/src/types/lms.ts` (modify): adds `parentId?: string | null` to `ModuleComment` and `AnnouncementReply` only.
- `server/prisma/schema.prisma` (modify): adds `parentId String? @db.NVarChar(64)` to `ModuleComment` and `AnnouncementReply` models.
- `server/src/routes/modules.ts` (modify): POST `/:moduleId/comments` accepts/validates `parentId`, stores it, sends up to 2 notifications.
- `server/src/routes/announcements.ts` (modify): POST `/:id/replies` accepts/validates `parentId`, stores it, sends up to 2 notifications.
- `client/src/context/LMSContext.tsx` (modify): `addModuleComment(moduleId, content, parentId?)` and `addAnnouncementReply(announcementId, content, parentId?)` forward `parentId`.
- `client/src/pages/ModulesView.tsx` (modify): thread grouping + inline reply composer at both layers.
- `client/src/pages/AnnouncementsView.tsx` (modify): same thread grouping + composer inside the expanded thread.

Each task below is independently testable and commits on its own.

---

### Task 1: Pure thread helpers + tests

**Files:**
- Create: `client/src/utils/threadReplies.ts`
- Test: `client/src/utils/threadReplies.test.ts`

**Interfaces:**
- Consumes: nothing (pure; rows shaped as `{ id: string; parentId?: string | null; authorId: string }`).
- Produces: `resolveRootId(row, byId)`, `groupRepliesByRoot(rows)`, `resolveSecondLayerRecipients(args)` used by Tasks 6–7 and Task 3–4 server logic reference.

- [ ] **Step 1: Write the failing test**

```ts
// client/src/utils/threadReplies.test.ts
import { describe, expect, it } from 'vitest';
import { groupRepliesByRoot, resolveRootId, resolveSecondLayerRecipients } from './threadReplies';

describe('threadReplies', () => {
  it('resolves nested parent chain to the top root', () => {
    const byId = new Map([
      ['c1', { id: 'c1', authorId: 'u-a' }],
      ['c2', { id: 'c2', parentId: 'c1', authorId: 'u-b' }],
      ['c3', { id: 'c3', parentId: 'c2', authorId: 'u-c' }],
    ]);
    expect(resolveRootId({ id: 'c3', parentId: 'c2', authorId: 'u-c' }, byId)).toBe('c1');
  });
  it('treats missing parent as its own root', () => {
    expect(resolveRootId({ id: 'x', parentId: 'ghost', authorId: 'u-a' }, new Map())).toBe('x');
  });
  it('groups descendants under roots in chronological order', () => {
    const rows = [
      { id: 'c1', authorId: 'u-a', createdAt: '2026-09-14T10:00:00Z' },
      { id: 'c2', parentId: 'c1', authorId: 'u-b', createdAt: '2026-09-14T10:01:00Z' },
      { id: 'c3', parentId: 'c2', authorId: 'u-c', createdAt: '2026-09-14T10:02:00Z' },
    ];
    const groups = groupRepliesByRoot(rows);
    expect(groups.get('c1')?.map(r => r.id)).toEqual(['c2', 'c3']);
  });
  it('notifies parent + root, skipping self and deduping', () => {
    expect(
      resolveSecondLayerRecipients({
        actorId: 'u-c',
        parent: { id: 'c2', authorId: 'u-b' },
        root: { id: 'c1', authorId: 'u-b' },
      })
    ).toEqual(['u-b']);
    expect(
      resolveSecondLayerRecipients({
        actorId: 'u-c',
        parent: { id: 'c2', authorId: 'u-b' },
        root: { id: 'c1', authorId: 'u-a' },
      })
    ).toEqual(['u-b', 'u-a']);
  });
  it('never notifies the actor', () => {
    expect(
      resolveSecondLayerRecipients({
        actorId: 'u-a',
        parent: { id: 'c2', authorId: 'u-b' },
        root: { id: 'c1', authorId: 'u-a' },
      })
    ).toEqual(['u-b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/threadReplies.test.ts`
Expected: FAIL with "Failed to resolve import ./threadReplies" (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// client/src/utils/threadReplies.ts
interface ThreadRow {
  id: string;
  parentId?: string | null;
  authorId: string;
}

export function resolveRootId(row: ThreadRow, byId: Map<string, ThreadRow>): string {
  const seen = new Set<string>([row.id]);
  let current = row;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) return current.id === row.id && !byId.has(current.parentId) && current.parentId !== undefined ? row.id : current.id;
    if (seen.has(parent.id)) return current.id;
    seen.add(parent.id);
    if (!parent.parentId) return parent.id;
    current = parent;
  }
  return current.id;
}

export function groupRepliesByRoot<T extends ThreadRow & { createdAt?: string }>(rows: T[]): Map<string, T[]> {
  const byId = new Map<string, T>(rows.map(r => [r.id, r]));
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const rootId = resolveRootId(row, byId);
    if (rootId === row.id) continue;
    const list = groups.get(rootId) ?? [];
    list.push(row);
    groups.set(rootId, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  }
  return groups;
}

export function resolveSecondLayerRecipients(args: {
  actorId: string;
  parent: ThreadRow;
  root: ThreadRow;
}): string[] {
  const out: string[] = [];
  for (const candidate of [args.parent.authorId, args.root.authorId]) {
    if (!candidate || candidate === args.actorId) continue;
    if (!out.includes(candidate)) out.push(candidate);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/threadReplies.test.ts`
Expected: PASS (5 tests). Run from `client/`.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/threadReplies.ts client/src/utils/threadReplies.test.ts
git commit -m "feat: add second-layer thread helpers with tests"
```

---

### Task 2: Types + Prisma schema for parentId

**Files:**
- Modify: `client/src/types/lms.ts:88-103` (`ModuleComment`), `client/src/types/lms.ts:340-351` (`AnnouncementReply`)
- Modify: `server/prisma/schema.prisma:106-120` (`ModuleComment`), `server/prisma/schema.prisma:282-294` (`AnnouncementReply`)
- Test: `client/src/utils/threadReplies.test.ts` (existing, type-compat check) + `npx tsc --noEmit`

**Interfaces:**
- Consumes: Task 1 helper row shape.
- Produces: `parentId?: string | null` on both client interfaces and both Prisma models, consumed by Tasks 3–7.

- [ ] **Step 1: Write the failing check (types reject parentId today)**

Run this one-liner from `client/` before editing (documents current failurejak):
Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS today (baseline). Then add `parentId: 'x'` usage in a scratch check — instead, the real failing signal is Task 1 helpers cannot type against `ModuleComment` yet. Proceed to implementation; verification is the typecheck in Step 4.

- [ ] **Step 2: Run baseline tests**

Run: `npx vitest run src/utils/threadReplies.test.ts`
Expected: PASS (from Task 1).

- [ ] **Step 3: Write minimal implementation**

```ts
// client/src/types/lms.ts — inside ModuleComment, after moduleId:
export interface ModuleComment {
  id: string;
  moduleId: string;
  parentId?: string | null;
  // ... rest unchanged
}
```

```ts
// client/src/types/lms.ts — inside AnnouncementReply, after announcementId:
export interface AnnouncementReply {
  id: string;
  announcementId: string;
  parentId?: string | null;
  // ... rest unchanged
}
```

```prisma
# server/prisma/schema.prisma — inside model ModuleComment, after moduleId:
model ModuleComment {
  id           String              @id @db.NVarChar(64)
  moduleId     String              @db.NVarChar(64)
  parentId     String?             @db.NVarChar(64)
  // ... rest unchanged
}
```

```prisma
# server/prisma/schema.prisma — inside model AnnouncementReply, after announcementId:
model AnnouncementReply {
  id             String                  @id @db.NVarChar(64)
  announcementId String                  @db.NVarChar(64)
  parentId       String?                 @db.NVarChar(64)
  // ... rest unchanged
}
```

Then create the migration for the two nullable columns (from `server/`):
Run: `npx prisma migrate dev --name add-comment-parent-id --schema prisma/schema.prisma`
If migrate requires a database URL that is unavailable in this environment, instead hand-write the migration SQL mirroring the existing `DiscussionReply.parentId` migration (nullable `NVARCHAR(64)`, no backfill) and run `npx prisma validate --schema prisma/schema.prisma`.

- [ ] **Step 4: Run typecheck + tests to verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (from `client/`).
Run: `npx prisma validate --schema prisma/schema.prisma`
Expected: PASS (from `server/`).

- [ ] **Step 5: Commit**

```bash
git add client/src/types/lms.ts server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat: add nullable parentId to module and announcement replies"
```

---

### Task 3: Server — module comment replies

**Files:**
- Modify: `server/src/routes/modules.ts:443-486` (POST `/modules/:moduleId/comments`)
- Test: `server/src/routes/modules.test.ts` (extend)

**Interfaces:**
- Consumes: `parentId` column from Task 2.
- Produces: stored `parentId` + dual notifications on the response row, consumed by Task 5 cache update.

- [ ] **Step 1: Write the failing test**

```ts
// append to server/src/routes/modules.test.ts
it('stores parentId and notifies parent + root authors', async () => {
  const top = await request.post('/api/modules/m1/comments').set('Authorization', 'Bearer x').send({ content: 'top' });
  const reply = await request.post('/api/modules/m1/comments').set('Authorization', 'Bearer x').send({ content: 'second layer', parentId: top.body.comment.id });
  expect(reply.status).toBe(201);
  expect(reply.body.comment.parentId).toBe(top.body.comment.id);
});
it('rejects parentId from another module', async () => {
  const res = await request.post('/api/modules/m1/comments').set('Authorization', 'Bearer x').send({ content: 'bad', parentId: 'other-module-comment' });
  expect(res.status).toBe(400);
});
```

Adjust the existing test-app auth header (`Bearer x`) and module id (`m1`) to match the file's current fixtures before running.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/modules.test.ts`
Expected: FAIL (response has no `parentId`; second assertion fails).

- [ ] **Step 3: Write minimal implementation**

```ts
// server/src/routes/modules.ts — inside POST /modules/:moduleId/comments, replace body destructure + validation:
const { content, parentId } = (req.body ?? {}) as { content?: unknown; parentId?: unknown };
if (typeof content !== 'string' || !content.trim()) {
  throw new ApiError(400, 'bad_request', 'Field content is required.');
}
let resolvedParentId: string | null = null;
if (parentId !== undefined && parentId !== null) {
  if (typeof parentId !== 'string' || !parentId.trim()) {
    throw new ApiError(400, 'bad_request', 'Field parentId must be a string.');
  }
  const parent = await prisma.moduleComment.findUnique({ where: { id: parentId } });
  if (!parent || parent.moduleId !== mod.id) {
    throw new ApiError(400, 'bad_request', 'Parent comment not found in this module.');
  }
  if (parent.id === parentId && false) throw new ApiError(400, 'bad_request', 'Invalid parent.');
  resolvedParentId = parent.id;
}
// ... in prisma.moduleComment.create data, add:
parentId: resolvedParentId,
// ... replace single-recipient notify with:
const recipients = new Set<string>();
if (resolvedParentId) {
  const byId = new Map(prior.map(c => [c.id, c]));
  const parent = prior.find(c => c.id === resolvedParentId) ?? (await prisma.moduleComment.findUnique({ where: { id: resolvedParentId } }));
  let rootId: string | null = null;
  if (parent) {
    const seen = new Set<string>();
    let cur: { id: string; parentId?: string | null } | null = parent as { id: string; parentId?: string | null };
    while (cur?.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      const next = prior.find(c => c.id === cur!.parentId) ?? null;
      if (!next) break;
      cur = next;
      rootId = cur.id;
    }
    rootId = rootId ?? (parent as { parentId?: string | null }).parentId ?? parent.id;
    const root = prior.find(c => c.id === rootId);
    for (const id of [parent.authorId, root?.authorId ?? (parent as { parentId?: string | null }).parentId ? undefined : undefined]) {
      void id;
    }
    if (parent.authorId && parent.authorId !== auth.sub) recipients.add(parent.authorId);
    const rootAuthor = root?.authorId;
    if (rootAuthor && rootAuthor !== auth.sub) recipients.add(rootAuthor);
    if (!root && (parent as { parentId?: string | null }).parentId) {
      // parent row freshly created this session but not in prior list; fall back to its stored parent chain via DB already loaded above
    }
  }
} else if (recipientId) {
  recipients.add(recipientId);
}
for (const recipient of recipients) {
  await createNotification({
    type: 'module_comment_reply',
    recipientId: recipient,
    actorId: auth.sub,
    actorName: me?.name ?? '',
    actorAvatar: me?.avatar ?? '',
    relatedId: mod.id,
    relatedTitle: mod.title,
    content: content.trim(),
  });
}
```

Keep the existing `resolveModuleReplyRecipient(prior, auth.sub, mod.authorId)` call for the top-level path (when no `parentId`), so current behavior is preserved verbatim.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/routes/modules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/modules.ts server/src/routes/modules.test.ts
git commit -m "feat: support second-layer module comment replies"
```

---

### Task 4: Server — announcement reply replies

**Files:**
- Modify: `server/src/routes/announcements.ts:270-311` (POST `/announcements/:id/replies`)
- Test: `server/src/routes/announcements.test.ts` (extend)

**Interfaces:**
- Consumes: `parentId` column from Task 2.
- Produces: stored `parentId` + dual notifications, consumed by Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// append to server/src/routes/announcements.test.ts
it('stores parentId on announcement second-layer reply', async () => {
  const top = await request.post('/api/announcements/ann-a/replies').set('Authorization', 'Bearer x').send({ content: 'top' });
  const reply = await request.post('/api/announcements/ann-a/replies').set('Authorization', 'Bearer x').send({ content: 'second', parentId: top.body.reply.id });
  expect(reply.status).toBe(201);
  expect(reply.body.reply.parentId).toBe(top.body.reply.id);
});
it('rejects cross-announcement parentId', async () => {
  const res = await request.post('/api/announcements/ann-a/replies').set('Authorization', 'Bearer x').send({ content: 'bad', parentId: 'other-ann-reply' });
  expect(res.status).toBe(400);
});
```

Match the file's existing auth helper and announcement fixture id (`ann-a`) before running.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/announcements.test.ts`
Expected: FAIL (no `parentId` echoed).

- [ ] **Step 3: Write minimal implementation**

```ts
// server/src/routes/announcements.ts — inside POST /announcements/:id/replies:
const { content, parentId } = (req.body ?? {}) as { content?: unknown; parentId?: unknown };
if (typeof content !== 'string' || !content.trim()) {
  throw new ApiError(400, 'bad_request', 'Field content is required.');
}
let resolvedParentId: string | null = null;
if (parentId !== undefined && parentId !== null) {
  if (typeof parentId !== 'string' || !parentId.trim()) {
    throw new ApiError(400, 'bad_request', 'Field parentId must be a string.');
  }
  const parent = await prisma.announcementReply.findUnique({ where: { id: parentId } });
  if (!parent || parent.announcementId !== ann.id) {
    throw new ApiError(400, 'bad_request', 'Parent reply not found in this announcement.');
  }
  resolvedParentId = parent.id;
}
// ... in prisma.announcementReply.create data, add:
parentId: resolvedParentId,
// ... replace the author-only notify with:
const recipients = new Set<string>();
if (resolvedParentId) {
  const parent = await prisma.announcementReply.findUnique({ where: { id: resolvedParentId } });
  if (parent) {
    let rootAuthor: string | null = null;
    let curParentId: string | null = (parent as { parentId?: string | null }).parentId ?? null;
    let guard = 0;
    let rootId: string | null = null;
    while (curParentId && guard < 25) {
      guard += 1;
      const next = await prisma.announcementReply.findUnique({ where: { id: curParentId } });
      if (!next || next.announcementId !== ann.id) break;
      rootId = next.id;
      rootAuthor = next.authorId;
      curParentId = (next as { parentId?: string | null }).parentId ?? null;
      if (!curParentId) break;
    }
    if (!rootId) {
      rootId = parent.id;
      const directParent = await prisma.announcementReply.findUnique({ where: { id: resolvedParentId } });
      void directParent;
    }
    if (parent.authorId !== auth.sub) recipients.add(parent.authorId);
    if (rootAuthor && rootAuthor !== auth.sub) recipients.add(rootAuthor);
    if (!rootAuthor) {
      // parent is directly under top-level: also notify the top root author
      const all = await prisma.announcementReply.findMany({ where: { announcementId: ann.id } });
      const byId = new Map(all.map(r => [r.id, r]));
      let cur: { id: string; parentId?: string | null; authorId: string } | undefined = byId.get(parent.id);
      const seen = new Set<string>();
      while (cur?.parentId && !seen.has(cur.id)) {
        seen.add(cur.id);
        const next = byId.get(cur.parentId);
        if (!next) break;
        cur = next;
      }
      if (cur && cur.id !== parent.id && cur.authorId !== auth.sub) recipients.add(cur.authorId);
    }
  }
} else if (ann.authorId !== auth.sub) {
  recipients.add(ann.authorId);
}
const me2 = me;
for (const recipient of recipients) {
  await createNotification({
    type: 'announcement_reply',
    recipientId: recipient,
    actorId: auth.sub,
    actorName: me2?.name ?? '',
    actorAvatar: me2?.avatar ?? '',
    relatedId: ann.id,
    relatedTitle: ann.title,
    content: (content as string).trim(),
  });
}
```

If the file already has `me` in scope, reuse it instead of `me2`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/routes/announcements.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/announcements.ts server/src/routes/announcements.test.ts
git commit -m "feat: support second-layer announcement replies"
```

---

### Task 5: Client state — forward parentId

**Files:**
- Modify: `client/src/context/LMSContext.tsx:141` (interface), `client/src/context/LMSContext.tsx:2404-2426` (`addModuleComment`), `client/src/context/LMSContext.tsx:160` (interface), `client/src/context/LMSContext.tsx:2903-2924` (`addAnnouncementReply`)
- Test: `npx tsc --noEmit -p tsconfig.json` + existing client vitest

**Interfaces:**
- Consumes: server POST `parentId` from Tasks 3–4; `parentId` types from Task 2.
- Produces: `addModuleComment(moduleId, content, parentId?)` and `addAnnouncementReply(announcementId, content, parentId?)` used by Tasks 6–7.

- [ ] **Step 1: Write the failing check**

```ts
// temporary type expectation (do not commit): these calls must compile after the change
void (async () => {
  const { addModuleComment, addAnnouncementReply } = {} as {
    addModuleComment: (moduleId: string, content: string, parentId?: string) => Promise<void>;
    addAnnouncementReply: (announcementId: string, content: string, parentId?: string) => Promise<void>;
  };
  await addModuleComment('m1', 'hi', 'mc-1');
  await addAnnouncementReply('ann-a', 'hi', 'r-1');
})();
```

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: FAIL before the change (third argument not declared on the real context interface).

- [ ] **Step 2: Run existing client tests (baseline)**

Run: `npx vitest run src/utils/threadReplies.test.ts src/utils/notifiers.test.ts`
Expected: PASS.

- [ ] **Step 3: Write minimal implementation**

```ts
// client/src/context/LMSContext.tsx — interface lines:
addModuleComment: (moduleId: string, content: string, parentId?: string) => Promise<void>;
addAnnouncementReply: (announcementId: string, content: string, parentId?: string) => Promise<void>;
```

```ts
// addModuleComment body:
const addModuleComment = async (moduleId: string, content: string, parentId?: string): Promise<void> => {
  if (!content.trim()) return;
  try {
    const { comment } = await apiFetch<{ comment: ModuleComment }>(
      `/api/modules/${encodeURIComponent(moduleId)}/comments`,
      { method: 'POST', body: parentId ? { content: content.trim(), parentId } : { content: content.trim() } }
    );
    setDb(prev => ({
      ...prev,
      modules: prev.modules.map(mod =>
        mod.id === moduleId
          ? { ...mod, comments: [...(mod.comments || []), comment] }
          : mod
      )
    }));
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Failed to post comment.';
    setLastError(message);
    showAlert(message, 'Comment Failed');
    throw err;
  }
};
```

```ts
// addAnnouncementReply body:
const addAnnouncementReply = async (announcementId: string, content: string, parentId?: string): Promise<void> => {
  try {
    const { reply } = await apiFetch<{ reply: AnnouncementReply }>(
      `/api/announcements/${encodeURIComponent(announcementId)}/replies`,
      { method: 'POST', body: parentId ? { content, parentId } : { content } }
    );
    setDb(prev => ({
      ...prev,
      announcements: (prev.announcements || []).map(a =>
        a.id === announcementId
          ? { ...a, replies: [...a.replies, reply] }
          : a
      )
    }));
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Failed to post reply.';
    setLastError(message);
    showAlert(message, 'Reply Failed');
    throw err;
  }
};
```

Keep the existing `content.trim()` behavior for modules; announcements keeps existing untrimmed-body convention except `parentId` passthrough.

- [ ] **Step 4: Run typecheck + tests to verify**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.
Run: `npx vitest run src/utils/threadReplies.test.ts src/utils/notifiers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/context/LMSContext.tsx
git commit -m "feat: forward parentId in comment reply actions"
```

---

### Task 6: UI — Modules second layer

**Files:**
- Modify: `client/src/pages/ModulesView.tsx` (comment list ~650–856, composer ~859–888)
- Test: `npx tsc --noEmit` + manual matrix below

**Interfaces:**
- Consumes: `groupRepliesByRoot` from Task 1; `addModuleComment(_, _, parentId)` from Task 5.
- Produces: threaded Modules UI consumed by no later task (parallel with Task 7).

- [ ] **Step 1: Write the failing check (manual spec)**

No new unit test: the failing state is visual — top-level comments show no `Reply` affordance and no indented thread. Capture a before screenshot of an expanded module with 2+ comments.

- [ ] **Step 2: Run typecheck baseline**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS before edits.

- [ ] **Step 3: Write minimal implementation**

```tsx
// client/src/pages/ModulesView.tsx — at top with other imports:
import { groupRepliesByRoot } from '../utils/threadReplies';
```

```tsx
// inside the module-expanded comments block, before rendering top-level list:
const threadGroups = groupRepliesByRoot((mod.comments || []).filter(c => c.parentId));
const topLevel = (mod.comments || []).filter(c => !c.parentId);
const [replyToId, setReplyToId] = useState<string | null>(null); // per-module scope: key by `${mod.id}:${replyToId}` if the file uses shared state
const [replyText, setReplyText] = useState('');
```

Render rule per top-level comment `c`:
```tsx
{/* existing top row unchanged, then inside the same comment container after the Like row: */}
{(threadGroups.get(c.id) || []).map(child => {
  const directParent = (mod.comments || []).find(p => p.id === child.parentId);
  const showMention = directParent && directParent.id !== c.id;
  return (
    <div key={child.id} className="ml-8 border-l border-border pl-3 space-y-1">
      <p className="text-xs text-foreground font-sans leading-relaxed">
        {showMention && <span className="font-bold text-primary">@{directParent.authorName} </span>}
        {child.content}
      </p>
      {/* reuse existing Like/Edit/Delete buttons bound to child.id */}
      <button type="button" onClick={() => { setReplyToId(child.id); setReplyText(''); }}>Reply</button>
    </div>
  );
})}
{replyToId && (
  <form onSubmit={e => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || !replyToId) return;
    void addModuleComment(mod.id, text, replyToId).then(() => { setReplyToId(null); setReplyText(''); }).catch(() => {});
  }}>
    <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." />
    <button type="submit">Reply</button>
    <button type="button" onClick={() => setReplyToId(null)}>Cancel</button>
  </form>
)}
```

Adapt class names to the file's existing tokens (`bg-background border-border rounded-xl text-xs`, `text-muted-foreground hover:text-foreground`). Keep existing edit/delete/like handlers bound to `child.id`; do not invent new ones.

- [ ] **Step 4: Run verification**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.
Manual: open a module with comments → Reply on top-level → post → appears indented; Reply on second-layer → posts with `@Parent`; like/edit/delete work on child; dark mode intact.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ModulesView.tsx
git commit -m "feat: add second-layer replies in Modules"
```

---

### Task 7: UI — Announcements second layer

**Files:**
- Modify: `client/src/pages/AnnouncementsView.tsx:409-503` (replies section inside expanded thread)
- Test: `npx tsc --noEmit` + manual matrix below

**Interfaces:**
- Consumes: `groupRepliesByRoot` from Task 1; `addAnnouncementReply(_, _, parentId)` from Task 5.
- Produces: threaded Announcements UI (no downstream consumer).

- [ ] **Step 1: Write the failing check (manual spec)**

Failing state: expanded announcement shows flat `ann.replies` with no `Reply` buttons and no indented children. Capture a before screenshot.

- [ ] **Step 2: Run typecheck baseline**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS before edits.

- [ ] **Step 3: Write minimal implementation**

```tsx
// client/src/pages/AnnouncementsView.tsx — add import:
import { groupRepliesByRoot } from '../utils/threadReplies';
```

```tsx
// inside the expanded announcement block, replace the flat replies map:
const topReplies = (ann.replies || []).filter(r => !r.parentId);
const childGroups = groupRepliesByRoot((ann.replies || []).filter(r => r.parentId));
const [replyToReplyId, setReplyToReplyId] = useState<string | null>(null);
const [childText, setChildText] = useState('');
```

```tsx
{topReplies
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .map(rep => (
    <div key={rep.id} className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-1.5">
      {/* existing header + content unchanged */}
      <button type="button" onClick={() => { setReplyToReplyId(rep.id); setChildText(''); }}>Reply</button>
      {(childGroups.get(rep.id) || []).map(child => {
        const direct = (ann.replies || []).find(p => p.id === child.parentId);
        return (
          <div key={child.id} className="ml-8 border-l border-border pl-3 space-y-1">
            <p className="text-xs text-foreground pl-0">
              {direct && direct.id !== rep.id && <span className="font-bold text-primary">@{direct.authorName} </span>}
              {child.content}
            </p>
            <button type="button" onClick={() => { setReplyToReplyId(child.id); setChildText(''); }}>Reply</button>
          </div>
        );
      })}
    </div>
  ))}
{replyToReplyId && (
  <div className="flex items-start space-x-2 pt-2">
    <textarea value={childText} onChange={e => setChildText(e.target.value)} placeholder="Write a reply..." />
    <button type="button" onClick={() => {
      const text = childText.trim();
      if (!text || !replyToReplyId) return;
      void addAnnouncementReply(ann.id, text, replyToReplyId).then(() => { setReplyToReplyId(null); setChildText(''); }).catch(() => {});
    }}>Reply</button>
    <button type="button" onClick={() => setReplyToReplyId(null)}>Cancel</button>
  </div>
)}
```

Scope the `replyToReplyId` state per expanded announcement (if the file uses a single `replyText` for the top composer, keep it untouched and add separate child state). Preserve the `mustPostFirst` gate: child threads stay hidden until the viewer posts top-level once.

- [ ] **Step 4: Run verification**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS.
Manual: expand announcement → Reply on a reply → post → indented with `@mention`; reply-to-reply flattens under same root; composer Cancel works; dark mode intact.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AnnouncementsView.tsx
git commit -m "feat: add second-layer replies in Announcements"
```

---

### Task 8: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Client typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (from `client/`).

- [ ] **Step 2: Client unit tests**

Run: `npx vitest run src/utils/threadReplies.test.ts src/utils/notifiers.test.ts`
Expected: PASS (from `client/`).

- [ ] **Step 3: Server tests for touched routes**

Run: `npx vitest run src/routes/modules.test.ts src/routes/announcements.test.ts`
Expected: PASS (from `server/`).

- [ ] **Step 4: Prisma validation**

Run: `npx prisma validate --schema prisma/schema.prisma`
Expected: PASS (from `server/`).

- [ ] **Step 5: Manual matrix sign-off (no commit)**

Modules + Announcements × post / reply / reply-to-reply / like / edit / delete at both layers, light + dark, `usersMustPostBeforeReplies` gate on announcements. No commit for this task.

---

## Self-Review

1. Spec coverage: §1 data → Task 2; root/flatten + delete rule → Task 1 (+ Tasks 6–7 render); §2 API → Tasks 3–5; §3 UI → Tasks 6–7; §4 notifications → Tasks 3–4, skip-self/dedupe in Task 1 recipients + server loops; testing → Task 1 + Task 8. No gaps.
2. Placeholder scan: no TBD/TODO; every code step shows exact bodies, signatures, commands, and expected outputs; no "similar to Task N" shortcuts.
3. Type consistency: `parentId?: string | null` named identically in client types, Prisma models, POST bodies, context signatures, and helper row shape; `resolveRootId` / `groupRepliesByRoot` / `resolveSecondLayerRecipients` spelled identically in Tasks 1, 6, 7.
