/**
 * In-Memory TTL Cache and Request Deduplication Store for Likha ERP API calls.
 * Provides high-speed client memory caching for read operations and auto-invalidation
 * on mutations. Zero external dependencies.
 */

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

  invalidate(prefixOrPattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(prefixOrPattern)) {
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
