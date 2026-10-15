# High-Impact Performance & Caching Core (Phase 1) — Design Specification

**Date:** 2026-10-15  
**Status:** Approved  
**Author:** AI Pair Programmer & JV  
**Scope:** Phase 1 of 2 (Core Performance: Sub-Route Splitting, Network Preconnect, Server Compression, RAG Response Caching, Sparse Fieldsets)

---

## 1. Overview & Context

Following the initial frontend optimizations (in-memory Likha API TTL caching, vendor chunking, WebP dynamic transformations, debounced inputs, and course pagination), bundle profiling and latency audits revealed key remaining bottlenecks:
1. **Monolithic Course Page Chunk:** `CoursesPage-*.js` currently bundles 13 sub-views (`SyllabusView`, `FacultyGradebook`, `QuizzesView`, etc.) into a single **672 KB** chunk, forcing clients to download document parsers and large gradebook tables even when only checking announcements or modules.
2. **Delayed Likha Handshake:** The browser waits for JavaScript execution before discovering and connecting to `https://gabay.zyberlab.com`, adding 150–350ms of DNS resolution and TLS handshake latency to initial page loads.
3. **Uncompressed Server Telemetry & RAG Payloads:** The Express backend on port 4001 transfers raw JSON for RAG baseline benchmarks and aggregate telemetry without HTTP compression.
4. **Repeated RAG Query Latency:** Identical or re-submitted questions in Gabay RAG re-invoke the n8n webhook and LLM pipeline every time, incurring 3–8 seconds of latency and token consumption.
5. **Broad API Wildcard Queries:** High-frequency list views query deep wildcard relations (`fields=*`) when only a fraction of summary fields are needed.

This specification defines the architecture, interfaces, and verification requirements for **Phase 1: High-Impact Performance & Caching Core**.

---

## 2. Goals & Non-Goals

### Goals
- **Shrink CoursesPage Chunk:** Reduce `CoursesPage-*.js` from **672 KB down to ~120 KB** by lazy-loading all 13 course sub-views with Suspense.
- **Fast Backend Handshake:** Eliminate DNS/TLS latency on initial load via early preconnect hints in `client/index.html`.
- **Zero-Dependency Server Compression:** Implement a native `node:zlib` Gzip streaming compression middleware for JSON responses over 1 KB on `/server`.
- **Sub-5ms RAG Response Caching:** Provide an in-memory, user-scoped TTL cache on `/server/src/routes/rag.ts` for instant responses on identical queries.
- **Sparse Directus Fieldsets:** Restrict high-frequency queries (`courses`, `notifications`) to explicit field lists.
- **Zero New External Dependencies:** Rely strictly on native React 19, Vite, Node 22 (`node:zlib`, `http.Agent`), and existing TypeScript types.
- **100% Platform Test Compatibility:** Maintain 100% pass rate across all 529 server and client tests.

### Non-Goals (Deferred to Phase 2)
- Virtual DOM windowing for rosters/inboxes (`react-window` / viewport virtualization).
- Full `LMSContext` splitting into separate sliced context providers.
- Progressive Web App (PWA) Service Worker offline caching.
- Any DDL or schema alterations to Likha ERP (per `AGENTS.md`).

---

## 3. Detailed Architecture & Design

### 3.1 Sub-Route Code Splitting in `CoursesPage.tsx`
Currently, `client/src/features/courses/CoursesPage.tsx` statically imports all sub-tabs:
- `ModulesView`
- `SyllabusView`
- `AssessmentsOverviewView`
- `ActivitiesView`
- `AssignmentsView`
- `ProjectsView`
- `PresentationsView`
- `QuizzesView`
- `ExamsView`
- `PeopleView`
- `AnnouncementsView`
- `FilesView`
- `FacultyGradebook`
- `StudentGradebook`

#### Design
Convert each sub-view into a dynamic import:
```typescript
const ModulesView = React.lazy(() => import('../modules/ModulesView').then(m => ({ default: m.ModulesView })));
const SyllabusView = React.lazy(() => import('../syllabus/SyllabusView').then(m => ({ default: m.SyllabusView })));
const AssessmentsOverviewView = React.lazy(() => import('../assessments/AssessmentsOverviewView').then(m => ({ default: m.AssessmentsOverviewView })));
const ActivitiesView = React.lazy(() => import('../assessments/ActivitiesView').then(m => ({ default: m.ActivitiesView })));
const AssignmentsView = React.lazy(() => import('../assessments/AssignmentsView').then(m => ({ default: m.AssignmentsView })));
const ProjectsView = React.lazy(() => import('../assessments/ProjectsView').then(m => ({ default: m.ProjectsView })));
const PresentationsView = React.lazy(() => import('../assessments/PresentationsView').then(m => ({ default: m.PresentationsView })));
const QuizzesView = React.lazy(() => import('../assessments/QuizzesView').then(m => ({ default: m.QuizzesView })));
const ExamsView = React.lazy(() => import('../assessments/ExamsView').then(m => ({ default: m.ExamsView })));
const PeopleView = React.lazy(() => import('../people/PeopleView').then(m => ({ default: m.PeopleView })));
const AnnouncementsView = React.lazy(() => import('../inbox/AnnouncementsView').then(m => ({ default: m.AnnouncementsView })));
const FilesView = React.lazy(() => import('../files/FilesView').then(m => ({ default: m.FilesView })));
const FacultyGradebook = React.lazy(() => import('../assessments/components/grading/FacultyGradebook').then(m => ({ default: m.FacultyGradebook })));
const StudentGradebook = React.lazy(() => import('../assessments/components/grading/StudentGradebook').then(m => ({ default: m.StudentGradebook })));
```

Wrap the active sub-tab switch render in `<React.Suspense fallback={<CourseSubTabSkeleton />}>`.
`CourseSubTabSkeleton` renders a pulse-animated container matching standard tab padding and header height to prevent visual jump.

---

### 3.2 Network Preconnect & DNS Hints (`client/index.html`)
Add resource hints inside `<head>` in `client/index.html`:
```html
<!-- Likha ERP Backend Preconnect -->
<link rel="preconnect" href="https://gabay.zyberlab.com" crossorigin />
<link rel="dns-prefetch" href="https://gabay.zyberlab.com" />
```
Preserve the existing Citizen's Charter AI widget script at line 21 unchanged.

---

### 3.3 Express Native Compression & Socket Pooling (`server/src`)

#### Native Gzip Middleware (`server/src/middleware/compression.ts`)
Implement standard Express middleware leveraging `node:zlib`:
- Checks `req.headers['accept-encoding']?.includes('gzip')`.
- If client supports gzip, wraps `res.write` and `res.end` with `zlib.createGzip()`.
- Sets `Content-Encoding: gzip` and removes `Content-Length` (using chunked transfer) when compressed payload size exceeds 1,024 bytes.
- Mount before route handlers in `server/src/index.ts`:
  ```typescript
  import { nativeCompression } from './middleware/compression.js';
  app.use(nativeCompression());
  ```

#### Keep-Alive HTTP Agent (`server/src/utils/httpAgent.ts`)
Configure persistent socket pooling for calls proxying to n8n (`http://localhost:5678`) and Likha ERP:
```typescript
import http from 'node:http';
import https from 'node:https';

export const httpKeepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 50,
  keepAliveMsecs: 30000,
});

export const httpsKeepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  keepAliveMsecs: 30000,
});
```

#### SQLite WAL Mode
In `server/src/utils/n8nTelemetry.ts`, execute WAL pragma on database handle initialization:
```typescript
db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
```

---

### 3.4 User-Scoped RAG Response Cache (`server/src/utils/ragCache.ts`)

#### Cache Structure
- In-memory bounded LRU map with maximum capacity of 200 entries.
- TTL: 15 minutes (900,000 ms).
- Cache Key: SHA-256 hash of `${userId}:${role}:${normalizedMessage}` where `normalizedMessage` is trimmed, lowercased, and collapsed of excess whitespace.

#### Cache Entry Schema
```typescript
interface RagCacheEntry {
  reply: string;
  sources: Array<{ label: string; detail: string }>;
  chart?: any;
  cachedAt: number;
  expiresAt: number;
}
```

#### Routing Flow (`server/src/routes/rag.ts`)
1. On `POST /api/rag/chat`:
   - Compute `key = generateRagCacheKey(req.auth.sub, req.auth.role, message)`.
   - Call `ragCache.get(key)`.
   - If hit and not expired:
     - Set response header `X-Cache: HIT`.
     - Return `{ reply, sources, chart }` immediately (< 5ms).
   - If miss:
     - Proxy request to n8n webhook.
     - On successful response (HTTP 200 with non-empty reply):
       - Store in `ragCache.set(key, result)`.
       - Set response header `X-Cache: MISS`.
       - Return result.
     - On upstream error (502/404): do not cache.

---

### 3.5 Directus Sparse Fieldsets (`likhaLmsApi.ts` & `LMSContext.tsx`)
Optimize high-frequency listing endpoints to specify explicit query fields:
- **Notifications Query:**
  - Endpoint: `/items/notifications`
  - Query: `fields=id,title,message,type,is_read,created_at,link&sort=-created_at&limit=50`
- **Courses Card Overview:**
  - Query: `fields=id,code,title,department,term,units,enrolledCount,published,cover_image.*,instructor.id,instructor.first_name,instructor.last_name,sections.*`
- Preserves full normalization in `LMSContext.tsx` with defensive fallback defaults.

---

## 4. Error Handling & Edge Cases

| Scenario | Handling Strategy |
|---|---|
| Sub-chunk network failure | React Suspense boundary catches chunk load rejection; displays inline retry button. |
| Client lacks gzip support | Compression middleware detects absence of `gzip` in `Accept-Encoding` and streams plain JSON. |
| Payload under 1 KB | Compression middleware skips small payloads to avoid gzip header overhead. |
| RAG cache corruption | Cache validation purges malformed entry and delegates to live n8n pipeline. |
| Upstream n8n error (502) | Errors are never stored in cache; returns standard `ApiError(502)` response. |
| Missing fields in sparse queries | `LMSContext.tsx` normalizers default missing properties to safe empty values (`[]`, `""`, `0`). |

---

## 5. Verification & Testing Strategy

1. **Unit Tests:**
   - `server/src/utils/ragCache.test.ts`:
     - Test cache hits return identical content and `X-Cache: HIT`.
     - Test TTL expiration evicts stale items after 15 minutes.
     - Test user isolation: different student IDs yield independent cache entries for identical prompts.
   - `server/src/middleware/compression.test.ts`:
     - Test responses > 1 KB are gzipped when requested.
     - Test responses < 1 KB remain uncompressed.
   - `client/src/features/courses/CoursesPage.test.tsx`:
     - Verify sub-tab switching renders lazy-loaded components under Suspense.
2. **Platform Regression:**
   - Run full server test suite: `npm test --workspace=server` (186/186 passed).
   - Run full client test suite: `npm test --workspace=client -- run` (343/343 passed).
3. **Bundle Chunk Audit:**
   - Run `npx vite build` in `client`.
   - Assert `CoursesPage-*.js` shrinks from 672 KB to ~120 KB and emits separate sub-tab chunks (`SyllabusView-*.js`, `FacultyGradebook-*.js`, `PeopleView-*.js`, etc.).

---

## 6. Spec Self-Review Checklist

- [x] **Placeholder scan:** No "TBD", "TODO", or unresolved sections.
- [x] **Internal consistency:** Matches existing Vite, React 19, Express 4.21, and Directus Likha ERP architecture.
- [x] **Scope check:** Strictly focused on Phase 1 core optimizations; Phase 2 (virtual scrolling & context slicing) cleanly separated.
- [x] **Ambiguity check:** Cache keys, TTL durations, threshold sizes, and field lists are explicitly defined.
