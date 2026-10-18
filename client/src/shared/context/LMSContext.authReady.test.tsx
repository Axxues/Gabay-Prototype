// @vitest-environment jsdom
// Regression test: route guards gate on `authReady` from useLMS(). When the
// context did not provide it, every protected route rendered the loading
// skeleton forever (undefined is falsy).
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

// Directus-shaped session user: role comes back as an expanded object,
// exactly like the live Likha ERP stores it.
const likhaSessionUser = {
  id: 'u9',
  first_name: 'Session',
  last_name: 'User',
  email: 'session@example.com',
  role: { name: 'Faculty' },
};

let tokenInStore: string | null = null;

const fetchedPaths: string[] = [];

// Auth is Likha-only: any Express call recorded here is a regression.
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  fetchedPaths.push(path);
  throw new Error(`unmocked: ${path}`);
});

const loginLikhaMock = vi.fn(async () => ({
  token: 't',
  user: {
    id: 'u1',
    first_name: 'F',
    last_name: 'L',
    email: 'f@x',
    role: { name: 'Instructor' },
  },
}));
const getMeMock = vi.fn(async () => ({ ...likhaSessionUser }));
const getCoursesMock = vi.fn(async () => []);
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => []);
const getMessagesMock = vi.fn(async () => []);
const getCalendarMock = vi.fn(async () => []);
const getGroupsMock = vi.fn(async () => []);
const getSlotsMock = vi.fn(async () => []);
const getSectionsMock = vi.fn(async () => []);
const getRequestsMock = vi.fn(async () => []);

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  getToken: () => tokenInStore,
  setToken: vi.fn(),
  clearToken: vi.fn(() => {
    tokenInStore = null;
  }),
  apiFetch: (...args: any[]) => (apiFetchMock as any)(...args),
  // Likha-only auth (Task 2): session restore reads auth.getMe, login reads
  // loginLikhaUser; bootstrap reads below come from Likha.
  likhaLmsApi: {
    loginLikhaUser: (...args: any[]) => (loginLikhaMock as any)(...args),
    auth: {
      getMe: (...args: any[]) => (getMeMock as any)(...args),
    },
    getCoursesWithRelations: (...args: any[]) => (getCoursesMock as any)(...args),
    getNotifications: (...args: any[]) => (getNotifsMock as any)(...args),
    users: {
      getUsers: (...args: any[]) => (getUsersMock as any)(...args),
    },
    communications: {
      getMessages: (...args: any[]) => (getMessagesMock as any)(...args),
      getCalendarEvents: (...args: any[]) => (getCalendarMock as any)(...args),
      getChatGroups: (...args: any[]) => (getGroupsMock as any)(...args),
      getAdvisingSlots: (...args: any[]) => (getSlotsMock as any)(...args),
    },
    requests: {
      getRequests: (...args: any[]) => (getRequestsMock as any)(...args),
    },
    sections: {
      getSections: (...args: any[]) => (getSectionsMock as any)(...args),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let seenAuthReady: unknown[] = [];
let seenUserId: unknown = undefined;
let doLogin: (() => Promise<any>) | null = null;
let loginResult: unknown = undefined;

const Probe: React.FC = () => {
  const { authReady, currentUser, login } = useLMS();
  seenAuthReady.push(authReady);
  seenUserId = (currentUser as any)?.id;
  doLogin = () => login('f@x', 'pw');
  return null;
};

// Express auth + bootstrap paths removed by the Likha-direct migration.
const removedBootstrapPaths = new Set([
  '/api/auth/login',
  '/api/auth/me',
  '/api/courses',
  '/api/users',
  '/api/notifications?limit=200',
  '/api/messages',
  '/api/calendar',
  '/api/groups',
  '/api/advising',
  '/api/requests/mine',
]);
const isRemovedBootstrapPath = (p: string) =>
  removedBootstrapPaths.has(p) || /\/api\/courses\/.+\/(sections|requests)/.test(p);

describe('authReady session-restore gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenInStore = null;
    fetchedPaths.length = 0;
    seenAuthReady = [];
    seenUserId = undefined;
    doLogin = null;
    loginResult = undefined;
    try {
      localStorage.clear();
    } catch {}
  });

  test('resolves true immediately when there is no stored token', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await waitFor(() => {
      expect(seenAuthReady[seenAuthReady.length - 1]).toBe(true);
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(getMeMock).not.toHaveBeenCalled();
  });

  test('resolves true after the token -> Likha getMe restore settles', async () => {
    tokenInStore = 'stored-token';
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await waitFor(() => {
      expect(seenAuthReady[seenAuthReady.length - 1]).toBe(true);
    });
    expect(getMeMock).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/auth/me');
    expect(seenUserId).toBe('u9');
  });

  test('bootstrap after restore fires no removed Express paths', async () => {
    tokenInStore = 'stored-token';
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await waitFor(() => {
      expect(seenAuthReady[seenAuthReady.length - 1]).toBe(true);
    });
    // Restore itself now reads Likha getMe (Task 2); everything else on the
    // bootstrap path must come from Likha too.
    await waitFor(() => {
      expect(getCoursesMock).toHaveBeenCalled();
    });
    expect(fetchedPaths.filter(isRemovedBootstrapPath)).toEqual([]);
  });

  test('resolves true even when restore fails with a 401', async () => {
    tokenInStore = 'stale-token';
    getMeMock.mockRejectedValueOnce(
      Object.assign(new Error('Invalid or expired token.'), { status: 401 })
    );
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await waitFor(() => {
      expect(seenAuthReady[seenAuthReady.length - 1]).toBe(true);
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/auth/me');
  });

  test('login performs zero Express calls', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      loginResult = await doLogin!();
    });
    await waitFor(() => {
      expect(loginResult).toMatchObject({ success: true });
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  test('login failure performs zero Express calls', async () => {
    loginLikhaMock.mockRejectedValueOnce(new Error('Likha ERP offline'));
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      loginResult = await doLogin!();
    });
    expect(loginResult).toEqual({ success: false, message: 'Login failed.' });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  test('restore failure performs zero Express calls', async () => {
    tokenInStore = 'stored-token';
    getMeMock.mockRejectedValueOnce(new Error('Likha ERP offline'));
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await waitFor(() => {
      expect(seenAuthReady[seenAuthReady.length - 1]).toBe(true);
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/auth/me');
  });
});
