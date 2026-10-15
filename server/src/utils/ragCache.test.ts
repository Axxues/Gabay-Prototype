import { describe, expect, it, beforeEach, vi } from 'vitest';
import { RagCache } from './ragCache.js';

describe('RagCache', () => {
  let cache: RagCache;

  beforeEach(() => {
    cache = new RagCache({ maxEntries: 3, defaultTtlMs: 1000 });
  });

  it('stores and retrieves a cached response', () => {
    const res = { reply: 'Calculus is study of change.', sources: [] };
    cache.set('u1', 'student', 'what is calculus?', res);

    const hit = cache.get('u1', 'student', 'what is calculus?');
    expect(hit).toEqual(res);
  });

  it('isolates cache by userId and role', () => {
    const res1 = { reply: 'Student answer', sources: [] };
    const res2 = { reply: 'Teacher answer', sources: [] };

    cache.set('u1', 'student', 'grades', res1);
    cache.set('u2', 'faculty', 'grades', res2);

    expect(cache.get('u1', 'student', 'grades')).toEqual(res1);
    expect(cache.get('u2', 'faculty', 'grades')).toEqual(res2);
    expect(cache.get('u1', 'faculty', 'grades')).toBeNull();
    expect(cache.get('u3', 'student', 'grades')).toBeNull();
  });

  it('normalizes casing and multiple spaces', () => {
    const res = { reply: 'Machine learning answer', sources: [] };
    cache.set('u1', 'student', 'What is machine learning?', res);

    expect(cache.get('u1', 'student', 'what   is   machine learning?')).toEqual(res);
    expect(cache.get('u1', 'student', '  WHAT IS MACHINE LEARNING?  ')).toEqual(res);
  });

  it('expires items after TTL', () => {
    vi.useFakeTimers();
    try {
      const res = { reply: 'Temporary data', sources: [] };
      cache.set('u1', 'student', 'temp', res, 500);

      expect(cache.get('u1', 'student', 'temp')).toEqual(res);

      vi.advanceTimersByTime(501);
      expect(cache.get('u1', 'student', 'temp')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('evicts least recently used item when maxEntries is exceeded', () => {
    cache.set('u1', 'student', 'q1', { reply: 'a1', sources: [] });
    cache.set('u1', 'student', 'q2', { reply: 'a2', sources: [] });
    cache.set('u1', 'student', 'q3', { reply: 'a3', sources: [] });

    expect(cache.size()).toBe(3);

    // Access q1 so q2 becomes LRU
    cache.get('u1', 'student', 'q1');

    // Add q4
    cache.set('u1', 'student', 'q4', { reply: 'a4', sources: [] });

    expect(cache.size()).toBe(3);
    expect(cache.get('u1', 'student', 'q1')).not.toBeNull();
    expect(cache.get('u1', 'student', 'q3')).not.toBeNull();
    expect(cache.get('u1', 'student', 'q4')).not.toBeNull();
    // q2 should have been evicted
    expect(cache.get('u1', 'student', 'q2')).toBeNull();
  });

  it('clears all entries', () => {
    cache.set('u1', 'student', 'q1', { reply: 'a1', sources: [] });
    cache.set('u1', 'student', 'q2', { reply: 'a2', sources: [] });
    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('u1', 'student', 'q1')).toBeNull();
  });
});
