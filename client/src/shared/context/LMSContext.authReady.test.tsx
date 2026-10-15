// @vitest-environment jsdom
// Regression test: route guards gate on `authReady` from useLMS(). When the
// context did not provide it, every protected route rendered the loading
// skeleton forever (undefined is falsy).
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const sessionUser = {
  id: 'u9',
  name: 'Session User',
  email: 'session@example.com',
  role: 'faculty',
  avatar: 'a',
  department: 'CS',
  title: 'Instructor',
} as any;

let tokenInStore: string | null = null;

const fetchedPaths: string[] = [];

const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  fetchedPaths.push(path);
  if (path === '/api/auth/me') return { user: { ...sessionUser } };
  throw new Error(`unmocked: ${path}`);
});

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
  // No `auth` namespace: session restore still falls back to /api/auth/me
  // (Task 2 owns restore); bootstrap reads below come from Likha.
  likhaLmsApi: {
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

const Probe: React.FC = () => {
  const { authReady, currentUser } = useLMS();
  seenAuthReady.push(authReady);
  seenUserId = (currentUser as any)?.id;
  return null;
};

// Bootstrap Express paths removed by the Likha-direct migration.
const removedBootstrapPaths = new Set([
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
  });

  test('resolves true after the token -> /api/auth/me restore settles', async () => {
    tokenInStore = 'stored-token';
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await waitFor(() => {
      expect(seenAuthReady[seenAuthReady.length - 1]).toBe(true);
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/auth/me');
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
    // Restore itself still uses /api/auth/me (Task 2 scope); everything
    // else on the bootstrap path must come from Likha.
    await waitFor(() => {
      expect(getCoursesMock).toHaveBeenCalled();
    });
    expect(fetchedPaths.filter(isRemovedBootstrapPath)).toEqual([]);
  });

  test('resolves true even when restore fails with a 401', async () => {
    tokenInStore = 'stale-token';
    apiFetchMock.mockRejectedValueOnce(
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
  });
});
