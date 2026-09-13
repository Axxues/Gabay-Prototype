import { describe, expect, it } from 'vitest';
import { dedupeFileName } from './names.js';

describe('dedupeFileName', () => {
  it('keeps clean names and suffixes dupes', () => {
    expect(dedupeFileName('r.pdf', [])).toBe('r.pdf');
    expect(dedupeFileName('r.pdf', ['r.pdf'])).toBe('r (2).pdf');
    expect(dedupeFileName('r.pdf', ['r.pdf', 'r (2).pdf'])).toBe('r (3).pdf');
  });
});
