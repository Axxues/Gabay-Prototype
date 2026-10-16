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

  it('deduplicates simultaneous in-flight fetch requests for identical key', async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return [{ id: 'c-1', title: 'Course 1' }];
    };

    const [res1, res2] = await Promise.all([
      likhaCache.getOrFetch('/items/courses', fetcher, 5000),
      likhaCache.getOrFetch('/items/courses', fetcher, 5000),
    ]);

    expect(res1).toEqual([{ id: 'c-1', title: 'Course 1' }]);
    expect(res2).toEqual([{ id: 'c-1', title: 'Course 1' }]);
    expect(callCount).toBe(1);
  });

  it('negative-caches final failures briefly so callers do not stampede', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const boom = new Error('forbidden');
    const fetcher = async () => {
      callCount++;
      throw boom;
    };

    await expect(likhaCache.getOrFetch('/items/denied', fetcher, 5000)).rejects.toBe(boom);
    await expect(likhaCache.getOrFetch('/items/denied', fetcher, 5000)).rejects.toBe(boom);
    expect(callCount).toBe(1);

    vi.advanceTimersByTime(20001);
    await expect(likhaCache.getOrFetch('/items/denied', fetcher, 5000)).rejects.toBe(boom);
    expect(callCount).toBe(2);
    vi.useRealTimers();
  });

  it('invalidate clears matching negative-cache entries so mutations retry immediately', async () => {
    const boom = new Error('forbidden');
    const fetcher = async () => {
      throw boom;
    };

    await expect(likhaCache.getOrFetch('/items/messages', fetcher, 5000)).rejects.toBe(boom);

    let retried = false;
    const recovered = async () => {
      retried = true;
      return [{ id: 'm-1' }];
    };
    likhaCache.invalidate('/items/messages');
    await expect(likhaCache.getOrFetch('/items/messages', recovered, 5000)).resolves.toEqual([{ id: 'm-1' }]);
    expect(retried).toBe(true);
  });

  it('implements stale-while-revalidate: returns stale data immediately and revalidates in background', async () => {
    vi.useFakeTimers();
    let counter = 1;
    const fetcher = async () => [{ version: counter++ }];

    // Initial fetch: counter = 1
    const res1 = await likhaCache.getOrFetch('/items/swr-test', fetcher, 1000);
    expect(res1).toEqual([{ version: 1 }]);

    // Advance 600ms (staleAt was at 500ms, expiresAt is at 1000ms)
    vi.advanceTimersByTime(600);

    // Call getOrFetch: returns stale data immediately (version 1) without blocking
    const res2 = await likhaCache.getOrFetch('/items/swr-test', fetcher, 1000);
    expect(res2).toEqual([{ version: 1 }]);

    // Allow background revalidation to complete
    await vi.runAllTimersAsync();

    // Next read gets the fresh background data (version 2)
    const res3 = likhaCache.get('/items/swr-test');
    expect(res3).toEqual([{ version: 2 }]);
    vi.useRealTimers();
  });
});
