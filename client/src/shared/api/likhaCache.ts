/**
 * In-Memory TTL Cache and Request Deduplication Store for Likha ERP API calls.
 * Provides high-speed client memory caching for read operations and auto-invalidation
 * on mutations. Zero external dependencies.
 */

export interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
  staleAt: number;
}

class LikhaCache {
  private store = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<any>>();
  // ponytail: brief negative cache — final fetch failures (after the
  // 403 -> service-token retry inside rawLikhaFetch) are remembered for 20s
  // so one denied/broken collection cannot stampede every call site.
  private failures = new Map<string, { until: number; error: unknown }>();
  private static FAILURE_TTL_MS = 20000;

  getEntry<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return { data: entry.data as T, isStale: now > entry.staleAt };
  }

  get<T>(key: string): T | null {
    const entry = this.getEntry<T>(key);
    return entry ? entry.data : null;
  }

  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    const now = Date.now();
    this.store.set(key, {
      data,
      staleAt: now + Math.floor(ttlMs * 0.5),
      expiresAt: now + ttlMs,
    });
  }

  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number = 60000): Promise<T> {
    const entry = this.getEntry<T>(key);

    // Stale-While-Revalidate: Return cached data immediately if still valid,
    // and revalidate asynchronously in background if stale.
    if (entry !== null) {
      if (entry.isStale && !this.inFlight.has(key)) {
        void this.triggerRevalidation(key, fetcher, ttlMs).catch(() => {});
      }
      return entry.data;
    }

    const failure = this.failures.get(key);
    if (failure) {
      if (Date.now() < failure.until) throw failure.error;
      this.failures.delete(key);
    }

    const existingPromise = this.inFlight.get(key);
    if (existingPromise) return existingPromise;

    return this.triggerRevalidation(key, fetcher, ttlMs);
  }

  private triggerRevalidation<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    const fetchPromise = fetcher()
      .then((data) => {
        this.set(key, data, ttlMs);
        this.failures.delete(key);
        return data;
      })
      .catch((error: unknown) => {
        this.failures.set(key, { until: Date.now() + LikhaCache.FAILURE_TTL_MS, error });
        throw error;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, fetchPromise);
    return fetchPromise;
  }

  invalidate(prefixOrPattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(prefixOrPattern)) {
        this.store.delete(key);
      }
    }
    for (const key of this.failures.keys()) {
      if (key.includes(prefixOrPattern)) {
        this.failures.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
    this.inFlight.clear();
    this.failures.clear();
  }
}

export const likhaCache = new LikhaCache();
