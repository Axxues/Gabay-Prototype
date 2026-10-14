# Frontend Performance & Caching Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accelerate the Gabay LMS frontend through in-memory Likha API caching, route and vendor code splitting, Directus WebP image optimization, input debouncing, and list pagination.

**Architecture:** Client-side progressive optimization with zero-dependency in-memory TTL caching and request deduplication in `likhaLmsApi.ts`, dynamic `React.lazy` chunking in `App.tsx`, Directus dynamic URL image transforms, and debounced filters.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Directus REST API (`https://gabay.zyberlab.com`).

**Spec:** [`docs/superpowers/specs/2026-10-15-frontend-performance-and-caching-optimization-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-15-frontend-performance-and-caching-optimization-design.md)

## Global Constraints
- **Authoritative Backend:** Likha ERP (`https://gabay.zyberlab.com`) remains the sole primary LMS database; zero schema changes.
- **RAG Microservice Scope:** Express server on port 4001 remains strictly for RAG queries and analytical telemetry.
- **Dependency Limits:** Zero new npm packages; all caching, debouncing, and memoization must use native modern React and TypeScript.
- **Test Integrity:** All 520 existing platform tests must remain 100% passing.

---

### Task 1: In-Memory Likha API TTL Cache & Request Deduplication

**Files:**
- Create: `client/src/shared/api/likhaCache.ts`
- Create: `client/src/shared/api/likhaCache.test.ts`
- Modify: `client/src/shared/api/likhaLmsApi.ts:40-80`
- Test: `client/src/shared/api/likhaLmsApi.test.ts`

**Interfaces:**
- Consumes: Directus HTTP GET/POST/PATCH/DELETE calls in `likhaRequest`.
- Produces: `likhaCache.get(key)`, `likhaCache.set(key, data, ttlMs)`, `likhaCache.invalidate(pattern)`, `likhaCache.clear()`.

- [ ] **Step 1: Write failing unit tests for in-memory TTL cache**

Create `client/src/shared/api/likhaCache.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { likhaCache } from './likhaCache';

describe('likhaCache', () => {
  beforeEach(() => {
    likhaCache.clear();
  });

  it('stores and retrieves cached data before TTL expires', () => {
    likhaCache.set('/items/courses', [{ id: 'c-1' }], 1000);
    expect(likhaCache.get('/items/courses')).toEqual([{ id: 'c-1' }]);
  });

  it('returns null after TTL expires', () => {
    vi.useFakeTimers();
    likhaCache.set('/items/courses', [{ id: 'c-1' }], 500);
    vi.advanceTimersByTime(501);
    expect(likhaCache.get('/items/courses')).toBeNull();
    vi.useRealTimers();
  });

  it('invalidates keys matching pattern', () => {
    likhaCache.set('/items/courses', [{ id: 'c-1' }], 10000);
    likhaCache.set('/items/courses/c-1', { id: 'c-1' }, 10000);
    likhaCache.set('/items/users', [{ id: 'u-1' }], 10000);

    likhaCache.invalidate('/items/courses');
    expect(likhaCache.get('/items/courses')).toBeNull();
    expect(likhaCache.get('/items/courses/c-1')).toBeNull();
    expect(likhaCache.get('/items/users')).toEqual([{ id: 'u-1' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=client -- src/shared/api/likhaCache.test.ts`  
Expected: FAIL with "Cannot find module './likhaCache'"

- [ ] **Step 3: Implement `client/src/shared/api/likhaCache.ts`**

```typescript
export interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

class LikhaCache {
  private store = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<any>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = 60000): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) return existingPromise;

    const fetchPromise = fetcher()
      .then((data) => {
        this.set(key, data, ttlMs);
        return data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  invalidate(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
  }
}

export const likhaCache = new LikhaCache();
```

- [ ] **Step 4: Wire cache into `likhaLmsApi.ts`**

In `client/src/shared/api/likhaLmsApi.ts`:
- Import `likhaCache`.
- In `likhaRequest`:
  - For `GET` requests: route through `likhaCache.getOrFetch(url, ...)`.
  - For `POST`, `PATCH`, `DELETE`: run the mutation, and call `likhaCache.invalidate(path.split('?')[0])`.
- In `auth.logout()`: call `likhaCache.clear()`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=client -- src/shared/api/likhaCache.test.ts src/shared/api/likhaLmsApi.test.ts`  
Expected: PASS (100%)

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/api/likhaCache.ts client/src/shared/api/likhaCache.test.ts client/src/shared/api/likhaLmsApi.ts
git commit -m "feat(cache): implement in-memory TTL caching and request deduplication for Likha ERP API"
```

---

### Task 2: Route & Vendor Code Splitting

**Files:**
- Modify: `client/vite.config.ts:80-95`
- Modify: `client/src/App.tsx:8-27, 240-340`

**Interfaces:**
- Consumes: `React.lazy`, `Suspense`, `AppSkeleton`.
- Produces: Smaller bundle entry chunk and split vendor chunks (`vendor-react`, `vendor-parsers`, `vendor-charts`).

- [ ] **Step 1: Configure manual vendor chunks in `client/vite.config.ts`**

In `client/vite.config.ts`:
```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-icons': ['lucide-react'],
        'vendor-parsers': ['pdfjs-dist', 'xlsx', 'mammoth'],
        'vendor-charts': ['recharts'],
      },
    },
  },
},
```

- [ ] **Step 2: Convert synchronous page imports in `client/src/App.tsx` to `React.lazy`**

Replace synchronous imports for deferred pages:
```typescript
const DashboardPage = React.lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CoursesPage = React.lazy(() => import('./features/courses/CoursesPage').then(m => ({ default: m.CoursesPage })));
const CreateCoursePage = React.lazy(() => import('./features/courses/CreateCoursePage').then(m => ({ default: m.CreateCoursePage })));
const CalendarPage = React.lazy(() => import('./features/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })));
const InboxPage = React.lazy(() => import('./features/inbox/InboxPage').then(m => ({ default: m.InboxPage })));
const ProfilePage = React.lazy(() => import('./features/auth/ProfilePage').then(m => ({ default: m.ProfilePage })));
const HistoryPage = React.lazy(() => import('./features/system/HistoryPage').then(m => ({ default: m.HistoryPage })));
const HelpPage = React.lazy(() => import('./features/system/HelpPage').then(m => ({ default: m.HelpPage })));
const EmptyPage = React.lazy(() => import('./features/system/EmptyPage').then(m => ({ default: m.EmptyPage })));
const ManageAccountsPage = React.lazy(() => import('./features/accounts/ManageAccountsPage').then(m => ({ default: m.ManageAccountsPage })));
const CreateAccountPage = React.lazy(() => import('./features/accounts/CreateAccountPage').then(m => ({ default: m.CreateAccountPage })));
const EditAccountPage = React.lazy(() => import('./features/accounts/EditAccountPage').then(m => ({ default: m.EditAccountPage })));
const GabayRAGPage = React.lazy(() => import('./features/rag/GabayRAGPage').then(m => ({ default: m.GabayRAGPage })));
const SpeedGraderModal = React.lazy(() => import('./features/assessments/components/grading/SpeedGraderModal').then(m => ({ default: m.SpeedGraderModal })));
```

Wrap route elements in `<React.Suspense fallback={<AppSkeleton />}>`.

- [ ] **Step 3: Run client build to verify chunk split output**

Run: `npm run build --workspace=client`  
Expected: Build succeeds with separate `vendor-parsers-[hash].js`, `vendor-charts-[hash].js`, `DashboardPage-[hash].js`, etc.

- [ ] **Step 4: Run unit tests to verify no regressions**

Run: `npm test --workspace=client -- src/shared/components/layout/AppRail.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/vite.config.ts client/src/App.tsx
git commit -m "perf(build): split routes and vendor libraries into lazy-loaded chunks with Suspense fallbacks"
```

---

### Task 3: Directus Dynamic WebP Image Optimization & Lazy Media

**Files:**
- Modify: `client/src/shared/utils/avatar.ts:1-30`
- Modify: `client/src/shared/components/common/CourseCard.tsx:1-50`
- Modify: `client/src/shared/context/LMSContext.tsx:resolveDirectusAssetUrl`
- Test: `client/src/shared/utils/avatar.test.ts`

**Interfaces:**
- Consumes: Asset IDs from Directus.
- Produces: `resolveDirectusAssetUrl(asset, { width, quality, format })` with WebP URL parameters.

- [ ] **Step 1: Write failing test for image transformation options**

In `client/src/shared/utils/avatar.test.ts`:
```typescript
it('appends webp format, quality, and width transformation parameters to Directus asset url', () => {
  const url = resolveDirectusAssetUrl('img-uuid-456', { width: 640, quality: 80, format: 'webp' });
  expect(url).toContain('https://gabay.zyberlab.com/assets/img-uuid-456?width=640&quality=80&format=webp');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=client -- src/shared/utils/avatar.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement WebP transformation parameters in `resolveDirectusAssetUrl`**

In `client/src/shared/utils/avatar.ts`:
```typescript
export interface AssetTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'auto' | 'png' | 'jpg';
}

export function resolveDirectusAssetUrl(
  asset: any,
  options?: AssetTransformOptions
): string {
  if (!asset) return '';
  const assetId = typeof asset === 'string' ? asset : asset.id || '';
  if (!assetId) return '';
  if (assetId.startsWith('http')) return assetId;

  let url = `https://gabay.zyberlab.com/assets/${assetId}`;
  const params: string[] = [];
  if (options?.width) params.push(`width=${options.width}`);
  if (options?.height) params.push(`height=${options.height}`);
  if (options?.quality) params.push(`quality=${options.quality}`);
  if (options?.format) params.push(`format=${options.format}`);

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  return url;
}
```

- [ ] **Step 4: Add `loading="lazy"` and `decoding="async"` to `<img />` tags in `CourseCard.tsx`**

In `CourseCard.tsx`:
```tsx
<img
  src={resolveDirectusAssetUrl(course.cover_image, { width: 640, quality: 80, format: 'webp' }) || defaultCourseCover(course.id)}
  alt={course.title}
  loading="lazy"
  decoding="async"
  className="w-full h-36 object-cover"
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=client -- src/shared/utils/avatar.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/utils/avatar.ts client/src/shared/utils/avatar.test.ts client/src/shared/components/common/CourseCard.tsx client/src/shared/context/LMSContext.tsx
git commit -m "perf(media): add Directus WebP dynamic transforms and native lazy loading to course cards and avatars"
```

---

### Task 4: Input Debouncing & List Pagination

**Files:**
- Create: `client/src/shared/hooks/useDebounce.ts`
- Create: `client/src/shared/hooks/useDebounce.test.ts`
- Modify: `client/src/features/courses/CoursesPage.tsx`
- Modify: `client/src/features/dashboard/DashboardPage.tsx`

**Interfaces:**
- Consumes: Raw text input state.
- Produces: `useDebounce(value, delayMs)`.

- [ ] **Step 1: Write failing unit tests for `useDebounce`**

Create `client/src/shared/hooks/useDebounce.test.ts`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('delays updating value until specified timeout has elapsed', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'initial' },
    });

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=client -- src/shared/hooks/useDebounce.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `client/src/shared/hooks/useDebounce.ts`**

```typescript
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
```

- [ ] **Step 4: Apply `useDebounce` and pagination to `CoursesPage.tsx`**

In `client/src/features/courses/CoursesPage.tsx`:
- Debounce `searchQuery` with `useDebounce(searchQuery, 250)`.
- Paginate filtered results (e.g. 12 cards per page with "Next / Prev" or "Show More" stepper).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test --workspace=client -- src/shared/hooks/useDebounce.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/shared/hooks/useDebounce.ts client/src/shared/hooks/useDebounce.test.ts client/src/features/courses/CoursesPage.tsx client/src/features/dashboard/DashboardPage.tsx
git commit -m "feat(ui): add useDebounce hook and paginate course catalog list to eliminate typing lag"
```

---

### Task 5: Component Memoization & Expensive Calculation Caching

**Files:**
- Modify: `client/src/shared/components/common/CourseCard.tsx`
- Modify: `client/src/features/assessments/components/grading/StudentGradebook.tsx`

**Interfaces:**
- Consumes: Course props, grading SPR calculations.
- Produces: Memoized `CourseCard` via `React.memo`, memoized SPR calculation maps via `useMemo`.

- [ ] **Step 1: Wrap `CourseCard` in `React.memo`**

In `CourseCard.tsx`:
```tsx
export const CourseCard = React.memo(CourseCardComponent, (prev, next) => {
  return (
    prev.course.id === next.course.id &&
    prev.course.published === next.course.published &&
    prev.course.enrolledCount === next.course.enrolledCount &&
    prev.isEnrolled === next.isEnrolled
  );
});
```

- [ ] **Step 2: Memoize SPR calculations in `StudentGradebook.tsx`**

In `StudentGradebook.tsx`:
- Wrap calculations of total grade percentage and weighted terms in `useMemo`.

- [ ] **Step 3: Run existing assessment & gradebook tests**

Run: `npm test --workspace=client -- src/features/assessments/components/grading/StudentGradebook.test.tsx`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/components/common/CourseCard.tsx client/src/features/assessments/components/grading/StudentGradebook.tsx
git commit -m "perf(render): memoize CourseCard and SPR gradebook aggregations to eliminate redundant re-renders"
```

---

### Task 6: Platform Regression & Performance Audit

**Files:**
- Modify: `task-full-likha-report.md`

**Interfaces:**
- Consumes: Test suites and Vite build output.
- Produces: Audited production bundle and updated canonical documentation.

- [ ] **Step 1: Run full server test suite**

Run: `npm test --workspace=server`  
Expected: 16 / 16 passed, 186 / 186 passed (100%).

- [ ] **Step 2: Run full client test suite**

Run: `npm test --workspace=client -- --run`  
Expected: 62 / 62 passed, 334+ / 334+ passed (100%).

- [ ] **Step 3: Execute production build and verify bundle sizes**

Run: `npm run build --workspace=client`  
Expected: Build passes with green bundle metrics and vendor chunk separation.

- [ ] **Step 4: Update canonical `task-full-likha-report.md`**

Document the frontend performance optimizations, chunk breakdown, and in-memory TTL caching layer.

- [ ] **Step 5: Commit documentation**

```bash
git add task-full-likha-report.md
git commit -m "docs(audit): document complete frontend performance optimizations and bundle chunking"
```
