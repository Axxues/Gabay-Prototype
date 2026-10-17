# Design Specification: Complete Retirement of Legacy Backend & Residual SQL Server Connections

## 1. Executive Summary & Problem Statement

The Gabay LMS architecture has migrated its primary data storage, authentication, and core relational models to Likha ERP (Directus at `https://gabay.zyberlab.com`). The Node.js/Express server on port 4001 was decoupled to serve exclusively as a high-performance RAG microservice and analytical telemetry engine.

However, an audit of the codebase revealed several residual connections to the previous backend architecture and legacy SQL Server database:
1. **Client-Side Legacy Calls (`LMSContext.tsx`):** Seven operations still invoke `apiFetch` against dead Express `/api/` endpoints:
   - `releaseGrades`: calls `PATCH /api/courses/:id/grades-release`
   - `editModuleComment`: calls `PATCH /api/modules/:id/comments/:id`
   - `deleteModuleComment`: calls `DELETE /api/modules/:id/comments/:id`
   - `toggleLikeModuleComment`: calls `POST /api/modules/:id/comments/:id/like`
   - `toggleMessageReaction`: calls `POST/DELETE /api/messages/:id/react`
   - `toggleLikeAnnouncement`: calls `POST /api/announcements/:id/like`
   - `markAnnouncementRead`: calls `POST /api/announcements/:id/read`
   - `toggleLikeDiscussionReply`: calls `POST /api/discussions/:id/replies/:id/like`
   Because the Express server no longer exposes these routes, invoking any of them triggers HTTP 404 or unhandled errors in production.
2. **Server-Side SQL Server Residuals:**
   - `server/.env` and `server/.env.example` still declare `DATABASE_URL="sqlserver://localhost:1433;database=GabayLMS;..."`.
   - `server/prisma/migrations/` contains 10 legacy SQL Server migration directories.
3. **Dead Code & Comments:** Outdated comments across `LMSContext.tsx` referring to Express `/api/auth/me` or `/api/courses` fallbacks.

This specification defines the plan to eliminate all legacy backend dependencies, route the remaining client operations natively through `likhaLmsApi` or state management, purge the SQL Server configurations, and verify the entire system passes tests and builds cleanly.

---

## 2. Goals & Non-Goals

### Goals
- **Zero Express Calls for LMS Features:** Completely eliminate all remaining `apiFetch` calls in `client/src/shared/context/LMSContext.tsx` targeting non-RAG `/api/` endpoints.
- **Direct Likha ERP Integration:** Implement Directus endpoints in `likhaLmsApi.ts` for module comments (`updateComment`, `deleteComment`), message reactions, announcements, and discussion replies.
- **Resilient Social Interactions & Grade Release:** In `LMSContext.tsx`, implement optimistic state updates paired with best-effort, error-tolerant persistence to Likha ERP for `setGradesReleased`, `toggleLikeModuleComment`, `toggleMessageReaction`, `toggleLikeAnnouncement`, `markAnnouncementRead`, and `toggleLikeDiscussionReply`. If a field is missing in Directus, catch and tolerate the error silently so that user-facing `showAlert` failure modals are eliminated.
- **Purge SQL Server Configuration:** Remove any residual `DATABASE_URL` SQL Server connection strings from `server/.env` and `server/.env.example`.
- **Remove Obsolete Prisma Migrations:** Remove `server/prisma/migrations/` (which contains legacy SQL Server DDL migrations), while keeping `@prisma/client` types to ensure zero disruption to the 18 existing RAG microservice test suites.
- **100% Quality Gate:** All client test files, server test files, and production builds (`tsc -b && vite build`) must pass without errors.

### Non-Goals
- Altering Likha ERP Directus schema via scripted REST DDL endpoints (`/fields`, `/relations`), in strict compliance with `AGENTS.md`.
- Modifying the RAG microservice endpoints (`/api/rag`, `/api/rag-baseline`, `/api/rag-aggregate`, `/api/rag-export`).

---

## 3. Technical Design & Builder Decisions

### 3.1 Client API Layer (`client/src/shared/api/likhaLmsApi.ts`)

Extend `likhaLmsApi` modules with missing item CRUD operations:

1. **`modules` controller:**
   - `updateComment(commentId: string, updates: { content: string })`: `PATCH /items/module_comments/:id`
   - `deleteComment(commentId: string)`: `DELETE /items/module_comments/:id`

2. **`communications` controller:**
   - `updateMessageReaction(messageId: string, reaction: string | null)`: `PATCH /items/messages/:id` updating `reaction` field.
   - `updateAnnouncement(id: string, updates: Record<string, any>)`: `PATCH /items/announcements/:id` updating `pinned`, `likes`, etc.
   - `updateDiscussionReply(replyId: string, updates: Record<string, any>)`: `PATCH /items/discussion_replies/:id` updating `likes` or content.

### 3.2 LMS Context Refactoring (`client/src/shared/context/LMSContext.tsx`)

Replace the remaining `apiFetch` call sites with native `likhaLmsApi` calls and resilient state management:

1. **`setGradesReleased(courseId, term, released)`:**
   - Optimistically update `db.courses.gradesReleased[term]`.
   - Best-effort persist to Likha ERP via `likhaLmsApi.courses.updateCourse(courseId, { grades_released: ... })`.
   - Tolerate schema absence gracefully; do not roll back local state or trigger a modal error alert.

2. **`editModuleComment(moduleId, commentId, newContent)`:**
   - Optimistically update `db.modules.comments`.
   - Call `likhaLmsApi.modules.updateComment(commentId, { content: newContent.trim() })`.

3. **`deleteModuleComment(moduleId, commentId)`:**
   - Optimistically filter out comment from `db.modules.comments`.
   - Call `likhaLmsApi.modules.deleteComment(commentId)`.

4. **`toggleLikeModuleComment(moduleId, commentId)`:**
   - Optimistically toggle user ID in `likedBy` array in local state.
   - Fire best-effort API sync, catching errors silently without modal disruption.

5. **`toggleMessageReaction(messageId, reaction)`:**
   - Optimistically toggle reaction in local state `db.messages`.
   - Call `likhaLmsApi.communications.updateMessageReaction(messageId, nextReaction)` with silent error tolerance.

6. **`toggleLikeAnnouncement(id)` & `markAnnouncementRead(id)`:**
   - Optimistically update `likedBy` / `readBy` arrays in local state `db.announcements`.
   - Fire best-effort API sync with silent error tolerance.

7. **`toggleLikeDiscussionReply(discussionId, replyId)`:**
   - Optimistically update `likedBy` array in local state `db.discussions`.
   - Fire best-effort API sync with silent error tolerance.

8. **Clean Up Legacy Comments & Fallbacks:**
   - Remove stale comments referencing Express `/api/auth/me` or `/api/courses` fallbacks.
   - Remove `apiFetch` from `LMSContext.tsx`.

### 3.3 Server-Side Cleanup

1. **Environment Configuration (`server/.env` and `server/.env.example`):**
   - Confirm complete removal of the `DATABASE_URL="sqlserver://..."` string.
   - Retain only RAG-relevant keys (Upstash, Gemini, Groq, n8n, Likha ERP service credentials).

2. **Prisma Migrations Removal:**
   - Delete `server/prisma/migrations/`.
   - Retain in-memory compatibility store in `server/src/db.ts` and `@prisma/client` type imports to ensure all 18 existing RAG microservice and telemetry test suites remain 100% green.

---

## 4. Test & Verification Plan

1. **Unit Tests for New Likha Methods:**
   - Add unit tests in `client/src/shared/api/likhaLmsApi.test.ts` verifying `updateComment`, `deleteComment`, `updateMessageReaction`, and `updateDiscussionReply`.
2. **Context Migration Verification:**
   - Add unit tests verifying `setGradesReleased`, `editModuleComment`, `deleteModuleComment`, `toggleLikeModuleComment`, `toggleMessageReaction`, `toggleLikeAnnouncement`, and `toggleLikeDiscussionReply` execute without making any calls to Express `/api/`.
3. **Full Regression Suites:**
   - Client test suite: `npm test --workspace=client -- --run`
   - Server test suite: `npm test --workspace=server -- --run`
   - Client production build: `npm run build --workspace=client`
