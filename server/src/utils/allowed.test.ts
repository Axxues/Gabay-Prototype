import { describe, expect, it } from 'vitest';
import { REQUEST_STATUSES, REQUEST_TYPES, USER_ROLES, VISIBILITIES, isOneOf } from './allowed.js';

describe('allowed lists', () => {
  it('accepts each user role', () => {
    for (const r of ['admin', 'faculty', 'staff', 'student']) expect(isOneOf(r, USER_ROLES)).toBe(true);
  });
  it('rejects unknown roles and non-strings', () => {
    expect(isOneOf('superadmin', USER_ROLES)).toBe(false);
    expect(isOneOf(undefined, USER_ROLES)).toBe(false);
    expect(isOneOf(42, USER_ROLES)).toBe(false);
  });
  it('accepts request lifecycles', () => {
    expect(isOneOf('section_switch', REQUEST_TYPES)).toBe(true);
    expect(isOneOf('approved', REQUEST_STATUSES)).toBe(true);
  });
  it('accepts visibilities', () => {
    expect(isOneOf('restricted', VISIBILITIES)).toBe(true);
  });
});
