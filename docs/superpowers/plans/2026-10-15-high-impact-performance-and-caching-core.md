# High-Impact Performance & Caching Core (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 high-impact performance optimizations: sub-route lazy loading in `CoursesPage`, Likha ERP DNS preconnect hints, zero-dependency Express streaming Gzip compression, user-scoped RAG response caching, and Directus sparse fieldsets.

**Architecture:** Decompose the monolithic 672 KB `CoursesPage` bundle into on-demand lazy chunks under Suspense; preconnect to Likha ERP during HTML parse; compress Express `/server` responses > 1 KB with Node 22 native `node:zlib`; and cache user-scoped RAG query responses in an in-memory TTL LRU map for sub-5ms answers.

**Tech Stack:** React 19, TypeScript, Vite, Node 22 (`node:zlib`, `http.Agent`, SQLite WAL), Express 4.21, Vitest.

**Spec:** [`docs/superpowers/specs/2026-10-15-high-impact-performance-and-caching-core-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-15-high-impact-performance-and-caching-core-design.md)

## Global Constraints
- **Zero Likha ERP Backend DDL Alterations:** No REST schema modifications; Likha ERP remains the 100% authoritative primary backend per `AGENTS.md`.
- **Zero New External Dependencies:** Strictly native React 19, Vite, and Node 22 (`node:zlib`, `node:http`, `node:https`).
- **Preserve User Customizations:** Preserve the Citizen's Charter AI widget script in `client/index.html`.
- **100% Platform Test Compatibility:** Maintain 100% pass rate across all 529 server and client tests.

---

### Task 1: Sub-Route Code Splitting in `CoursesPage.tsx`

**Files:**
- Modify: `client/src/features/courses/CoursesPage.tsx:1-40, 310-385`
- Test: `client/src/features/courses/CoursesPage.test.tsx`

**Interfaces:**
- Consumes: `React.lazy`, `React.Suspense`.
- Produces: `CourseSubTabSkeleton` component; dynamic loading of 13 sub-tab views (`ModulesView`, `SyllabusView`, `FacultyGradebook`, `StudentGradebook`, `QuizzesView`, `ExamsView`, `ActivitiesView`, `AssignmentsView`, `ProjectsView`, `PresentationsView`, `PeopleView`, `AnnouncementsView`, `FilesView`).

- [ ] **Step 1: Define `CourseSubTabSkeleton` component**

In `client/src/features/courses/CoursesPage.tsx`:
```tsx
const CourseSubTabSkeleton: React.FC = () => (
  <div className="flex-1 p-6 space-y-5 animate-pulse" data-testid="course-subtab-skeleton">
    <div className="h-8 w-48 bg-muted rounded-xl" />
    <div className="h-32 bg-card border border-border rounded-2xl" />
    <div className="space-y-3 pt-2">
      <div className="h-16 bg-card border border-border rounded-2xl" />
      <div className="h-16 bg-card border border-border rounded-2xl" />
      <div className="h-16 bg-card border border-border rounded-2xl" />
    </div>
  </div>
);
```

- [ ] **Step 2: Convert static sub-tab view imports to `React.lazy`**

In `client/src/features/courses/CoursesPage.tsx`, replace static imports:
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

- [ ] **Step 3: Wrap the active sub-tab view rendering in `<React.Suspense fallback={<CourseSubTabSkeleton />}>`**

In `CoursesPage.tsx`, wrap the tab rendering switch in `<React.Suspense fallback={<CourseSubTabSkeleton />}>`.

- [ ] **Step 4: Run unit tests to verify no regressions**

Run: `npm test --workspace=client -- run src/features/courses/CoursesPage.test.tsx`  
Expected: PASS (100%).

- [ ] **Step 5: Run client build to verify chunk split output**

Run: `npx vite build` in `client`.  
Expected: `CoursesPage-*.js` shrinks significantly from 672 KB down to ~120 KB, and separate chunks appear for `SyllabusView`, `FacultyGradebook`, `QuizzesView`, etc.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/courses/CoursesPage.tsx
git commit -m "perf(courses): code-split course workspace sub-tabs with Suspense fallbacks"
```

---

### Task 2: Network Preconnect & DNS Hints in `client/index.html`

**Files:**
- Modify: `client/index.html:10-16`

**Interfaces:**
- Produces: Early TCP/TLS connection initiation to `https://gabay.zyberlab.com`.

- [ ] **Step 1: Add preconnect and dns-prefetch resource hints**

In `client/index.html`, inside `<head>` right after Google Fonts preconnect:
```html
  <!-- Likha ERP Backend Preconnect -->
  <link rel="preconnect" href="https://gabay.zyberlab.com" crossorigin />
  <link rel="dns-prefetch" href="https://gabay.zyberlab.com" />
```
Ensure the Citizen's Charter AI widget script at lines 20-23 remains completely unchanged.

- [ ] **Step 2: Run build to verify HTML parsing**

Run: `npx vite build` in `client`.  
Expected: `dist/index.html` includes preconnect hints.

- [ ] **Step 3: Commit**

```bash
git add client/index.html
git commit -m "perf(network): preconnect and dns-prefetch Likha ERP backend in index.html"
```

---

### Task 3: Express Native Compression Middleware & HTTP Keep-Alive Socket Pooling

**Files:**
- Create: `server/src/middleware/compression.ts`
- Create: `server/src/middleware/compression.test.ts`
- Create: `server/src/utils/httpAgent.ts`
- Modify: `server/src/index.ts:1-15`
- Modify: `server/src/utils/n8nTelemetry.ts:1-35`

**Interfaces:**
- Produces: `nativeCompression()` Express middleware, `httpKeepAliveAgent`, `httpsKeepAliveAgent`.

- [ ] **Step 1: Write failing unit test for `nativeCompression`**

Create `server/src/middleware/compression.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { nativeCompression } from './compression.js';

describe('nativeCompression middleware', () => {
  it('compresses payloads larger than 1KB when client accepts gzip', async () => {
    const app = express();
    app.use(nativeCompression());
    app.get('/large', (_req, res) => {
      res.json({ data: 'A'.repeat(2048) });
    });

    const res = await request(app)
      .get('/large')
      .set('Accept-Encoding', 'gzip');

    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('bypasses compression when payload is smaller than 1KB', async () => {
    const app = express();
    app.use(nativeCompression());
    app.get('/small', (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app)
      .get('/small')
      .set('Accept-Encoding', 'gzip');

    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('bypasses compression when client does not accept gzip', async () => {
    const app = express();
    app.use(nativeCompression());
    app.get('/large-no-gzip', (_req, res) => {
      res.json({ data: 'B'.repeat(2048) });
    });

    const res = await request(app)
      .get('/large-no-gzip')
      .set('Accept-Encoding', 'identity');

    expect(res.headers['content-encoding']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server -- run src/middleware/compression.test.ts`  
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `server/src/middleware/compression.ts`**

Create `server/src/middleware/compression.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';
import zlib from 'node:zlib';

export function nativeCompression(thresholdBytes: number = 1024) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip')) {
      return next();
    }

    const originalSend = res.send.bind(res);

    res.send = function (body: any): Response {
      if (!body) return originalSend(body);

      const buffer = Buffer.isBuffer(body)
        ? body
        : typeof body === 'string'
        ? Buffer.from(body)
        : Buffer.from(JSON.stringify(body));

      if (buffer.length < thresholdBytes) {
        return originalSend(body);
      }

      zlib.gzip(buffer, (err, compressed) => {
        if (err) {
          return originalSend(body);
        }

        res.setHeader('Content-Encoding', 'gzip');
        res.removeHeader('Content-Length');
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', typeof body === 'object' ? 'application/json' : 'text/html');
        }
        originalSend(compressed);
      });

      return res;
    };

    next();
  };
}
```

- [ ] **Step 4: Create `server/src/utils/httpAgent.ts`**

Create `server/src/utils/httpAgent.ts`:
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

- [ ] **Step 5: Mount compression middleware in `server/src/index.ts`**

In `server/src/index.ts`:
- Import `nativeCompression` from `./middleware/compression.js`.
- Mount `app.use(nativeCompression());` immediately after `express.json()`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test --workspace=server -- run src/middleware/compression.test.ts`  
Expected: PASS (3/3).

- [ ] **Step 7: Commit**

```bash
git add server/src/middleware/compression.ts server/src/middleware/compression.test.ts server/src/utils/httpAgent.ts server/src/index.ts
git commit -m "feat(server): add zero-dependency native gzip compression middleware and socket keep-alive pooling"
```

---

### Task 4: User-Scoped RAG In-Memory Response Cache

**Files:**
- Create: `server/src/utils/ragCache.ts`
- Create: `server/src/utils/ragCache.test.ts`
- Modify: `server/src/routes/rag.ts:445-515`

**Interfaces:**
- Produces: `ragCache` instance (`get`, `set`, `clear`, `generateKey`), `X-Cache: HIT` / `X-Cache: MISS` headers on `POST /api/rag/chat`.

- [ ] **Step 1: Write failing unit tests for `ragCache`**

Create `server/src/utils/ragCache.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { RagCache } from './ragCache.js';

describe('RagCache', () => {
  let cache: RagCache;

  beforeEach(() => {
    cache = new RagCache(100, 60000); // 100 items, 60s TTL
  });

  it('stores and retrieves cached RAG responses', () => {
    const key = cache.generateKey('student-1', 'student', 'What is CMSC 131?');
    cache.set(key, { reply: 'It is intro to CS', sources: [] });

    const cached = cache.get(key);
    expect(cached).toBeDefined();
    expect(cached?.reply).toBe('It is intro to CS');
  });

  it('isolates cache entries between different users for identical questions', () => {
    const key1 = cache.generateKey('student-1', 'student', 'My grades?');
    const key2 = cache.generateKey('student-2', 'student', 'My grades?');

    cache.set(key1, { reply: 'Grades for student 1', sources: [] });

    expect(cache.get(key1)?.reply).toBe('Grades for student 1');
    expect(cache.get(key2)).toBeNull();
  });

  it('evicts expired entries after TTL has elapsed', () => {
    const shortTtlCache = new RagCache(50, 10); // 10ms TTL
    const key = shortTtlCache.generateKey('u1', 'student', 'Hello');
    shortTtlCache.set(key, { reply: 'Hi', sources: [] });

    expect(shortTtlCache.get(key)).toBeDefined();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(shortTtlCache.get(key)).toBeNull();
        resolve();
      }, 25);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=server -- run src/utils/ragCache.test.ts`  
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `server/src/utils/ragCache.ts`**

Create `server/src/utils/ragCache.ts`:
```typescript
import crypto from 'node:crypto';

export interface RagCachedResult {
  reply: string;
  sources: Array<{ label: string; detail: string }>;
  chart?: any;
}

interface CacheEntry {
  data: RagCachedResult;
  expiresAt: number;
}

export class RagCache {
  private cache = new Map<string, CacheEntry>();
  private maxItems: number;
  private ttlMs: number;

  constructor(maxItems: number = 200, ttlMs: number = 15 * 60 * 1000) {
    this.maxItems = maxItems;
    this.ttlMs = ttlMs;
  }

  generateKey(userId: string, role: string, message: string): string {
    const normalized = (message || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return crypto
      .createHash('sha256')
      .update(`${userId}:${role}:${normalized}`)
      .digest('hex');
  }

  get(key: string): RagCachedResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: RagCachedResult): void {
    if (this.cache.size >= this.maxItems) {
      // Evict oldest (first) key
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const ragCache = new RagCache();
```

- [ ] **Step 4: Wire `ragCache` into `server/src/routes/rag.ts`**

In `server/src/routes/rag.ts` in `POST /chat`:
- Import `ragCache`.
- Check `const cacheKey = ragCache.generateKey(req.auth!.sub, req.auth!.role, message);`
- `const cached = ragCache.get(cacheKey);`
- If hit: `res.setHeader('X-Cache', 'HIT'); return res.json(cached);`
- If miss: on success from upstream, `ragCache.set(cacheKey, finalResult); res.setHeader('X-Cache', 'MISS');`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=server -- run src/utils/ragCache.test.ts src/routes/rag.test.ts`  
Expected: PASS (100%).

- [ ] **Step 6: Commit**

```bash
git add server/src/utils/ragCache.ts server/src/utils/ragCache.test.ts server/src/routes/rag.ts
git commit -m "feat(rag): add user-scoped in-memory TTL response caching to eliminate repeat query latency"
```

---

### Task 5: Directus Sparse Fieldsets for High-Frequency Queries

**Files:**
- Modify: `client/src/shared/api/likhaLmsApi.ts:160-200, 660-700`
- Modify: `client/src/shared/context/LMSContext.tsx:840-880, 920-950`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: Likha ERP Directus `/items/notifications` and `/items/courses`.
- Produces: Explicit fieldset queries minimizing payload transfer size.

- [ ] **Step 1: Update notifications query in `likhaLmsApi.ts`**

In `client/src/shared/api/likhaLmsApi.ts`, in `notifications.list()`:
- Request `fields=id,title,message,type,is_read,created_at,link&sort=-created_at&limit=50`.

- [ ] **Step 2: Update course overview fields in `likhaLmsApi.ts` and `LMSContext.tsx`**

Ensure course list queries request explicit fields:
`fields=id,code,title,department,term,units,enrolledCount,published,cover_image.*,instructor.id,instructor.first_name,instructor.last_name,sections.*`.

- [ ] **Step 3: Run existing API and relational normalization tests**

Run: `npm test --workspace=client -- run src/shared/api/likhaLmsApi.test.ts src/shared/context/LMSContext.relational.test.tsx`  
Expected: PASS (100%).

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/api/likhaLmsApi.ts client/src/shared/context/LMSContext.tsx
git commit -m "perf(api): prune high-frequency Directus query payloads with sparse fieldsets"
```

---

### Task 6: Full Platform Regression & Bundle Chunk Audit

**Files:**
- Modify: `task-full-likha-report.md`

**Interfaces:**
- Consumes: Test suites and Vite build output.
- Produces: Verified production bundle with shrunk course workspace chunk and updated documentation.

- [ ] **Step 1: Run full server test suite**

Run: `npm test --workspace=server`  
Expected: 17 / 17 passed, 190+ / 190+ passed (100%).

- [ ] **Step 2: Run full client test suite**

Run: `npm test --workspace=client -- run`  
Expected: 64 / 64 passed, 343 / 343 passed (100%).

- [ ] **Step 3: Execute production build and assert chunk metrics**

Run: `npx vite build` in `client`.  
Expected: `CoursesPage-*.js` shrinks from 672 KB down to ~120 KB, and sub-views are cleanly split into isolated chunks.

- [ ] **Step 4: Update canonical `task-full-likha-report.md`**

Document Phase 1 performance optimizations, chunk breakdown, and verified latencies in `task-full-likha-report.md`.

- [ ] **Step 5: Commit documentation**

```bash
git add task-full-likha-report.md
git commit -m "docs(audit): document Phase 1 high-impact performance core and chunk audit"
```
