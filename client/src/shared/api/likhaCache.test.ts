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
});
