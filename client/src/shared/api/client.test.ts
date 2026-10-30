// src/api/client.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError, apiFetch, clearToken, getRefreshToken, getToken, setRefreshToken, setToken } from './client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // Node test env has no DOM localStorage; the token helpers need a stub.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
    });
  });
  it('attaches the bearer token', async () => {
    setToken('tok-123');
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) }));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/api/x');
    const calls = fetchMock.mock.calls as Array<Array<{ headers?: Record<string, string> }>>;
    expect(calls[0]?.[1]?.headers?.Authorization).toBe('Bearer tok-123');
  });
  it('throws ApiError with the server envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 401,
      json: async () => ({ error: { code: 'unauthorized', message: 'Nope.' } }),
    })));
    const err = await apiFetch('/api/x').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('unauthorized');
  });
  it('throws request_failed on non-JSON errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => { throw new Error('bad'); } })));
    const err = await apiFetch('/api/x').catch(e => e);
    expect((err as ApiError).code).toBe('request_failed');
  });

  it('clears token and dispatches SESSION_EXPIRED_EVENT on 401 when token is present', async () => {
    setToken('stale-jwt-token');
    const dispatchSpy = vi.fn();
    vi.stubGlobal('dispatchEvent', dispatchSpy);

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'unauthorized', message: 'Token expired' } }),
    })));

    await expect(apiFetch('/items/colleges')).rejects.toThrow();

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'gabay:session-expired' })
    );
  });

  it('does not dispatch SESSION_EXPIRED_EVENT on 401 when no token is present', async () => {
    const dispatchSpy = vi.fn();
    vi.stubGlobal('dispatchEvent', dispatchSpy);

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'unauthorized', message: 'Unauthorized' } }),
    })));

    await expect(apiFetch('/items/colleges')).rejects.toThrow();

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('does not dispatch SESSION_EXPIRED_EVENT on 401 for /auth/login credential failure', async () => {
    setToken('existing-token');
    const dispatchSpy = vi.fn();
    vi.stubGlobal('dispatchEvent', dispatchSpy);

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'invalid_credentials', message: 'Invalid credentials' } }),
    })));

    await expect(apiFetch('/auth/login')).rejects.toThrow();

    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});

describe('cross-tab token storage and persistence', () => {
  let localStore: Map<string, string>;
  let sessionStore: Map<string, string>;

  beforeEach(() => {
    vi.unstubAllGlobals();
    localStore = new Map<string, string>();
    sessionStore = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      getItem: (k: string) => localStore.get(k) ?? null,
      setItem: (k: string, v: string) => { localStore.set(k, String(v)); },
      removeItem: (k: string) => { localStore.delete(k); },
      clear: () => { localStore.clear(); },
    });

    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => sessionStore.get(k) ?? null,
      setItem: (k: string, v: string) => { sessionStore.set(k, String(v)); },
      removeItem: (k: string) => { sessionStore.delete(k); },
      clear: () => { sessionStore.clear(); },
    });
  });

  it('persists token to localStorage so new tabs can access it', () => {
    setToken('cross-tab-token');
    // localStorage must contain the token so another tab has it
    expect(localStore.get('gabay_token')).toBe('cross-tab-token');
  });

  it('persists refreshToken to localStorage so new tabs can access it', () => {
    setRefreshToken('cross-tab-refresh');
    expect(localStore.get('gabay_refresh_token')).toBe('cross-tab-refresh');
  });

  it('retrieves token in a simulated new tab where sessionStorage is empty', () => {
    // Tab 1 logged in and persisted to localStorage
    localStore.set('gabay_token', 'persisted-jwt');
    // Tab 2 opens with clean sessionStorage
    sessionStore.clear();

    expect(getToken()).toBe('persisted-jwt');
  });

  it('migrates legacy or orphan sessionStorage token into localStorage', () => {
    sessionStore.set('gabay_token', 'session-only-jwt');
    localStore.clear();

    expect(getToken()).toBe('session-only-jwt');
    // Now localStorage should have it so any other tab can read it
    expect(localStore.get('gabay_token')).toBe('session-only-jwt');
  });

  it('clears token and refreshToken from both localStorage and sessionStorage on clearToken', () => {
    localStore.set('gabay_token', 'tok1');
    localStore.set('gabay_refresh_token', 'ref1');
    sessionStore.set('gabay_token', 'tok1');
    sessionStore.set('gabay_refresh_token', 'ref1');

    clearToken();

    expect(localStore.get('gabay_token')).toBeUndefined();
    expect(localStore.get('gabay_refresh_token')).toBeUndefined();
    expect(sessionStore.get('gabay_token')).toBeUndefined();
    expect(sessionStore.get('gabay_refresh_token')).toBeUndefined();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
