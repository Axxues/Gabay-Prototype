import { describe, expect, it } from 'vitest';
import { parseJsonField, stringifyJsonField } from './jsonFields.js';

describe('jsonFields', () => {
  it('parses valid JSON', () => {
    expect(parseJsonField<string[]>(`["file"]`, [])).toEqual(['file']);
  });
  it('falls back on null and garbage', () => {
    expect(parseJsonField<string[]>(null, ['x'])).toEqual(['x']);
    expect(parseJsonField<Record<string, number>>('{oops', {})).toEqual({});
  });
  it('round-trips', () => {
    const v = { a: 1 };
    expect(parseJsonField(stringifyJsonField(v), {})).toEqual(v);
  });
});
