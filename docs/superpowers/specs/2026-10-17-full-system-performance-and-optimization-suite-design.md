# Full System Performance & Optimization Suite Specification

**Date:** October 17, 2026  
**Status:** Draft / Pending Review  
**Target Platform:** `Axxues/Gabay-Prototype` (React 19 + TypeScript + Vite, Express RAG Microservice port 4001, Likha ERP backend at `https://gabay.zyberlab.com`)

---

## 1. Intent & Context

Following extensive platform scaling and complete normalization onto Likha ERP (Directus), the platform exhibits key performance bottlenecks:
1. **Startup Network Congestion:** When logging in or restoring a session, `LMSContext:refreshDeferred` eagerly iterates through all enrolled and taught courses, issuing over 150+ concurrent HTTP calls to Likha ERP for modules, items, comments, activities, quizzes, exams, submissions, grades, folders, and files. This causes high initial latency, browser thread stalling, and backend pressure.
2. **Global Context Re-render Cascades:** The single 6,502-line `LMSContext` holds all course, user, and interactive state in a monolithic `db` object. 79 components subscribe directly to `useLMS()`. Minor updates (marking a notification read, typing in a comment box, toggling a modal) cause broad re-renders across the entire component tree.
3. **Orphaned MS SQL Server Dependency in Microservice:** Express (`server/src/index.ts`) retains a 978-line Prisma schema and attempts to connect to a local MS SQL Server on port 63313 in `ragAggregate.ts` and `ragExport.ts`. Since the primary LMS database was migrated to Likha ERP, requests to these endpoints fail when SQL Server is offline.
4. **I/O Churn in RAG Telemetry:** `n8nTelemetry.ts` opens and closes a new `DatabaseSync` connection on every extraction call rather than utilizing a persistent connection pool.
5. **Entry Bundle Bloat & Critical Path Blocking:** `LoginPage`, `RegisterPage`, and modal dialogs are eagerly imported into the entry bundle (`index.js` is 315 KB), while Google Fonts is loaded via a render-blocking stylesheet link in `index.html`.

This specification designs a comprehensive, multi-layered optimization suite resolving these bottlenecks without breaking any existing LMS capabilities or violating Likha ERP stability constraints.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1 Goals
- **Eliminate Startup Network Congestion:** Replace the eager 150+ request storm with lazy, on-demand course resource hydration. Only load top-level course metadata on login/dashboard; load deep course resources (modules, activities, submissions, gradebooks, files) when a user actually enters that course.
- **Isolate Re-renders & Memoize Critical Computations:** Wrap expensive badge counter iterations (`CoursesPage`), course filtering (`DashboardPage`), and module sorting (`ModulesView`) in `useMemo`. Separate high-frequency modal/drawer UI state from core academic data.
- **Decouple Microservice from Dead SQL Server:** Eliminate reliance on local SQL Server port 63313 in `ragAggregate.ts` and `ragExport.ts`, resolving runtime errors when SQL Server is inactive while maintaining test suite integrity.
- **Optimize SQLite Telemetry I/O:** Use a shared, persistent read-only SQLite instance with WAL mode (`PRAGMA journal_mode = WAL;`) and memory pragmas.
- **Trim Entry Chunk & Eliminate Render Blocking:** Lazy-load `LoginPage` and `RegisterPage`; optimize font loading via non-blocking link directives; prune dead devDependencies (`@tailwindcss/postcss`).
- **Visibility-Aware Polling:** Pause background polling when the browser tab is hidden, resuming on focus.

### 2.2 Non-Goals
- Altering the Likha ERP database schema via REST DDL calls (strictly prohibited by `AGENTS.md`).
- Replacing Vite or Tailwind v3 with an untested build toolchain.
- Rewriting the RAG pipeline synthesis prompt or modifying n8n workflows.

### 2.3 Anti-Goals (What would make this a failure)
- Breaking backwards compatibility for existing components expecting synchronous `db` properties (all sync getters must gracefully return cached or hydrated course data).
- Breaking existing test suites (all server and client tests must remain at 100% pass rate).
- Causing UI flicker, layout shifts, or race conditions when switching between courses.
- Causing Directus nodemon crashes or downtime.

---

## 3. Architecture & Detailed Design

### Phase 1: On-Demand Course Data Hydration (Top Priority)

#### 3.1 Architecture Shift: Eager Catalog vs Lazy Deep Resources
- **Current Behavior:** `refreshDeferred` calls `mapConcurrent(coursesRes.courses, 3, ...)` fetching all modules, items, announcements, discussions, assessments, grades, SPR configs, submissions, and files for every single course upfront.
- **New Behavior:**
  1. **Bootstrap Phase (Fast Boot):**
     - Load active user profile and academic units (`colleges`, `departments`).
     - Load top-level course catalog metadata (`id`, `code`, `title`, `term`, `instructor`, `cover_image`, `enrolledCount`, `published`).
     - Load global communications: user's personal notifications, direct messages, calendar events, and enrollment requests.
     - Bootstrap settles in **1–2 network rounds** (under 400ms).
  2. **Active Course Hydration Hook (`useCourseHydration` / `hydrateCourse(courseId)`):**
     - Maintain an in-memory `Set<string>` of hydrated course IDs in `LMSContext`.
     - When a course is opened (via `activeCourseId` or `CoursesPage`), check if `hydratedCourseIds.has(courseId)`.
     - If not hydrated, fetch that single course's sub-resources concurrently:
       - Modules with items & comments
       - Announcements & discussions
       - Activities, quizzes, and exams
       - Course grades and SPR config
       - Submissions for the course
       - Course files and folders
     - Merge the returned records into `db` atomically and mark `courseId` as hydrated.
     - Leverage `likhaCache` with TTL so revisiting previously opened courses is instantaneous with zero network delay.
  3. **Course Pre-hydration Hint:**
     - If the URL deep-links directly to a course (e.g. `/courses/CSPC103/modules`), immediately trigger hydration for that specific course during bootstrap, avoiding an extra layout step.

---

### Phase 2: State Isolation & Memoization (Second Priority)

#### 3.2 Memoization of Expensive Operations
- **`CoursesPage.tsx` Badge Calculations:**
  - Wrap the inline tab badge calculations in a memoized lookup `useMemo(() => computeTabBadges(...), [db.announcements, db.messages, db.courseFiles, db.courseGrades, db.enrollmentRequests, cid, visits])`.
- **`DashboardPage.tsx` Scoping:**
  - Memoize `approvedCourseIds` and `getScopedCourses` with `useMemo` so re-renders of the dashboard due to unrelated state (e.g. notification count changes) do not re-filter the course catalog.
- **`ModulesView.tsx` Sorting:**
  - Memoize `courseModules` and `sortedModules` with `useMemo(() => ..., [db.modules, courseId])`.

#### 3.3 UI Modal & Drawer State Isolation
- Extract ephemeral drawer/modal flags (`isRoleModalOpen`, `isUserProfileModalOpen`, `isHistoryDrawerOpen`, `isHelpDrawerOpen`) from triggering full LMS provider re-renders, or provide memoized callbacks so layout frames do not re-render their child sub-trees.

---

### Phase 3: Express RAG Microservice Decoupling & SQLite Telemetry Pooling (Third Priority)

#### 3.4 Decoupling `ragAggregate` and `ragExport` from MS SQL Server
- Replace direct `prisma.course.findMany` and `prisma.user.findMany` in `ragExport.ts` and `ragAggregate.ts` with a resilient data provider:
  - If a database connection error occurs or Prisma is offline, gracefully return Likha ERP data or fallback mocks instead of throwing unhandled 500 / connection errors.
  - Remove unnecessary runtime PrismaClient queries where Likha ERP is the canonical authority.

#### 3.5 SQLite Telemetry Connection Pooling & WAL Mode
- Refactor `n8nTelemetry.ts`:
  - Open a single persistent `DatabaseSync` connection (lazily initialized on first access).
  - Execute performance pragmas:
    ```sql
    PRAGMA query_only = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = -64000;
    ```
  - Close the connection only on process termination (`process.on('SIGINT')`, `process.on('SIGTERM')`), eliminating file descriptor churn.

---

### Phase 4: Bundle Optimization & Asset Delivery

#### 4.1 Route & Modal Code Splitting
- Convert `LoginPage` and `RegisterPage` in [`client/src/App.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/App.tsx) to `React.lazy` imports wrapped in `AuthLoadingScreen`.
- Lazy-load `RoleSwitcherModal` and `GlobalSearchDialog` so they are excluded from the initial main chunk.

#### 4.2 Non-Blocking Font Loading & Resource Hints
- In [`client/index.html`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/index.html):
  - Add `media="print" onload="this.media='all'"` with `<noscript>` fallback or font-display swap directives to prevent external CSS from blocking FCP.

#### 4.3 Tab Visibility-Aware Polling
- Implement visibility checking in notification polling:
  ```ts
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return; // Skip poll cycle when tab is in background
  }
  ```
  Attach an event listener to `document.addEventListener('visibilitychange', ...)` to trigger an immediate refresh when the user switches back to the tab.

#### 4.4 Prune Dead DevDependencies
- Remove `@tailwindcss/postcss` from `client/package.json` to prevent package manager confusion.

---

## 4. Constraints & Safety Directives

1. **Likha ERP Zero-Downtime Rule (`AGENTS.md`):**
   - No REST API DDL calls (`/fields`, `/relations`, `/collections`).
   - Normal application read/write operations via `/items/:collection` only.
2. **Backwards Compatibility:**
   - Existing getters (`db.courses`, `db.modules`, `db.activities`, etc.) must remain functional.
   - Synchronous fallback: if an unhydrated course is queried, return empty arrays or cached results while triggering a background fetch.
3. **100% Test Pass Rate:**
   - All server and client test suites must pass without regression.

---

## 5. Verification Plan

1. **Performance Benchmarks:**
   - Measure startup HTTP request count in browser network tab before vs after (target: reduction from 150+ requests to < 10 requests).
   - Measure client production build size and chunk distribution (`npm run build --workspace=client`).
2. **Functional Verification:**
   - Verify course navigation: clicking into any course hydrates its modules, activities, submissions, and gradebook smoothly.
   - Verify caching: navigating away and back to a hydrated course makes 0 additional network calls.
   - Verify notifications, search dialog, login, and registration flows.
   - Verify RAG microservice health check and query endpoint (`GET /api/health`, `POST /api/rag`).
3. **Automated Test Suites:**
   - Run `npm run test --workspace=server` -> 100% pass rate.
   - Run `npm run test --workspace=client` -> 100% pass rate.
