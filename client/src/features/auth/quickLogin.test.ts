import { describe, expect, it } from 'vitest';
import { parseQuickLoginAccounts } from './quickLogin';

const encode = (value: unknown) => btoa(JSON.stringify(value));

describe('parseQuickLoginAccounts', () => {
  it('returns no accounts when no local configuration exists', () => {
    expect(parseQuickLoginAccounts(undefined, true)).toEqual([]);
    expect(parseQuickLoginAccounts('', true)).toEqual([]);
  });

  it('never exposes local accounts outside development', () => {
    const raw = encode([{ label: 'Admin', email: 'admin@example.edu', password: 'secret', tone: 'admin' }]);
    expect(parseQuickLoginAccounts(raw, false)).toEqual([]);
  });

  it('parses valid base64 JSON accounts', () => {
    const raw = encode([
      { label: 'Admin', email: 'admin@example.edu', password: 'secret', tone: 'admin' },
      { label: 'Student', email: 'student@example.edu', password: 'secret2', tone: 'student' },
    ]);

    expect(parseQuickLoginAccounts(raw, true)).toEqual([
      { label: 'Admin', email: 'admin@example.edu', password: 'secret', tone: 'admin' },
      { label: 'Student', email: 'student@example.edu', password: 'secret2', tone: 'student' },
    ]);
  });

  it('drops malformed entries instead of throwing', () => {
    const raw = encode([
      { label: 'Admin', email: 'admin@example.edu', password: 'secret', tone: 'admin' },
      { label: 'No email', password: 'secret' },
      null,
      'nope',
    ]);

    expect(parseQuickLoginAccounts(raw, true)).toEqual([
      { label: 'Admin', email: 'admin@example.edu', password: 'secret', tone: 'admin' },
    ]);
  });

  it('returns an empty list for invalid base64 or JSON', () => {
    expect(parseQuickLoginAccounts('not-base64!!', true)).toEqual([]);
    expect(parseQuickLoginAccounts(btoa('{not-json'), true)).toEqual([]);
    expect(parseQuickLoginAccounts(btoa('"a string"'), true)).toEqual([]);
  });
});
