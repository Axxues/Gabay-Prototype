// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const expressPaths: string[] = [];

// Bootstrap is Likha-primary: any Express call here is a regression
// (RAG excluded — out of scope and untouched by this migration).
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  expressPaths.push(path);
  throw new Error(`unmocked: ${path}`);
});

const loginLikhaMock = vi.fn(async () => ({
  token: 't-likha',
  user: {
    id: 'u1',
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    role: { name: 'Faculty' },
  },
}));
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
  getToken: () => null,
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: (...args: any[]) => (apiFetchMock as any)(...args),
  likhaLmsApi: {
    loginLikhaUser: (...args: any[]) => (loginLikhaMock as any)(...args),
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

let latestVisits: Record<string, string> | undefined;
let doLogin: (() => Promise<any>) | null = null;
let doVisit: ((tab: string, courseId?: string) => void) | null = null;

const Probe: React.FC = () => {
  const { activeUser, login, markTabVisited } = useLMS();
  latestVisits = (activeUser as any)?.lastVisitedAt;
  doLogin = () => login('test@example.com', 'pw');
  doVisit = (tab: string, courseId?: string) => markTabVisited(tab, courseId);
  return <div data-testid="visits">{JSON.stringify(latestVisits || {})}</div>;
};

describe('markTabVisited syncs the active session user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expressPaths.length = 0;
    latestVisits = undefined;
    doLogin = null;
    doVisit = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('viewing the Files tab stamps files:<courseId> without a page reload', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await act(async () => {
      await doLogin!();
    });
    expect(latestVisits?.['files:c1']).toBeUndefined();

    act(() => {
      doVisit!('files', 'c1');
    });

    await waitFor(() => {
      expect(latestVisits?.['files:c1']).toBeDefined();
    });
    expect(typeof latestVisits?.['files:c1']).toBe('string');
    const expressCalls = expressPaths.filter(
      (p) => p.startsWith('/api/') && !p.startsWith('/api/rag'),
    );
    expect(expressCalls).toEqual([]);
  });
});
