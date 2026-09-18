# Second-Layer Replies on Modules & Announcements — Design

Date: 2026-09-14 | Approach: A (`parentId` on existing rows) | Status: approved §§1–4 in chat

## Context

Gabay Prototype is a React + TypeScript + Vite LMS with an Express + Prisma (SQL Server) backend. Modules (`ModuleComment`) and Announcements (`AnnouncementReply`) currently support only flat, top-level comments. Discussions already support nesting via `DiscussionReply.parentId`. This spec adds a second reply layer to Modules and Announcements.

Agreed decisions: nested-but-flattened at 2 visual levels with `@mention`; full parity (like + edit/delete own on both layers); notify direct-parent author + top-level root author, skipping self.

## §1 Data model

- Add optional `parentId?: string | null` to client `ModuleComment` (`client/src/types/lms.ts:88`) and `AnnouncementReply` (`:340`), mirroring `DiscussionReply.parentId` (`:380`).
- Semantics: no `parentId` = top-level. With `parentId` = reply to that row id.
- Thread root resolution: walk `parentId` chain to the ancestor with no `parentId`. Cycles are guarded (visited-set, treat cycle entry as root).
- Existing rows unaffected (nullable, no backfill).
- Deletes: deleting a parent keeps children. Children re-resolve to grandparent/root; deleted parent renders as italic `[deleted]` placeholder row so the thread stays readable. Matches current Modules soft-delete UX.
- Server: nullable `parentId` column on `ModuleComment` / `AnnouncementReply` tables. No new tables. Seed data unchanged.

## §2 API / state

- Backward-compatible signatures:
  - `addModuleComment(moduleId, content, parentId?)` (`client/src/context/LMSContext.tsx:2404`)
  - `addAnnouncementReply(announcementId, content, parentId?)` (`:2903`)
  - Edit / delete / like signatures unchanged (operate on row id at any layer).
- Endpoints accept optional `parentId` in POST body:
  - `POST /api/modules/:id/comments` with `{ content, parentId? }`
  - Announcement reply POST with `{ content, parentId? }`
- Validation: parent must exist in the same module/announcement; `parentId` equal to the new row id rejected. Invalid → 400, client shows existing `Comment Failed` alert, thread unchanged.
- Response shape unchanged plus `parentId`.
- Client cache: same `setDb` map-append as today; threading derived at render. No optimistic insert; failure keeps composer text.

## §3 UI

Files: `client/src/pages/ModulesView.tsx` (composer ~:859, list ~:650–856), `client/src/pages/AnnouncementsView.tsx` (replies ~:409–503).

- Top-level ordering unchanged.
- Under each top-level comment, an indented thread container (`ml-8 border-l border-border pl-3 space-y-2`) lists all descendants chronologically.
- Each row keeps current styling (avatar, name, role chip, timestamp, content, Like/Edit/Delete) and gains a `Reply` button. One inline composer open at a time under the target row, labelled `Reply to @Name`, with Cancel.
- Reply-to-reply renders in the same flat list with `@DirectParentName` prefix; no third indent level.
- Announcements `usersMustPostBeforeReplies` gate unchanged: hidden peer threads until the viewer posts top-level once.
- Deleted parent row shows `[deleted]` placeholder; children remain.

## §4 Notifications, permissions, testing

- Permissions: whoever can post a top-level comment can post a second-layer reply. Edit/delete own only. Like open to viewers, reusing current handlers.
- Notifications: server notifies direct-parent author + top-level root author, skipping self and de-duplicating when identical. Reuses `module_comment_reply` / `announcement_reply` types; bell panel and tab badges work unchanged.
- Stale parent (deleted between open and send): server stores reply under the resolved top root so it is not lost.
- Testing:
  - New vitest pure helpers: `resolveRootId(row, byId)` (chain walk, cycle guard, missing-parent → self-as-root) and `resolveSecondLayerRecipients(reply, parent, root, actorId)` (parent + root, skip self, dedupe).
  - `npx tsc --noEmit` clean.
  - Manual matrix: Modules + Announcements × post / reply / reply-to-reply / like / edit / delete at both layers, light + dark; verify flattening, `@mention`, and badge/bell counts.

## Out of scope

- Third visual indent level; thread collapsing/pagination; editing another user's reply; new notification types; changes to Discussions flow.
