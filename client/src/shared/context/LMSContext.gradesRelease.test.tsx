// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const seededCourse = {
  id: 'c1',
  code: 'C1',
  title: 'T',
  section: 'S',
  term: 'T',
  instructorId: 'u1',
  instructorName: 'N',
  published: true,
  enrolledCount: 0,
};

// Login is Likha-only (Task 2): only the grades-release feature path still
// reads Express here. Any other Express call throws loudly.
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  if (path === '/api/courses/c1/grades-release')
    return { course: { id: 'c1', gradesReleased: JSON.stringify({ midterm: true }) } };
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
const getCoursesMock = vi.fn(async () => [{ ...seededCourse }]);
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

let latestCourses: any[] = [];
let doLogin: (() => Promise<any>) | null = null;
let doRelease: (() => Promise<void>) | null = null;

const Probe: React.FC = () => {
  const ctx = useLMS() as any;
  latestCourses = ctx.db.courses;
  doLogin = () => ctx.login('test@example.com', 'pw');
  doRelease = () => ctx.setGradesReleased('c1', 'midterm', true);
  return <div data-testid="probe">{String(latestCourses?.length ?? 0)}</div>;
};

describe('setGradesReleased releases midterm grades', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestCourses = [];
    doLogin = null;
    doRelease = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('course gradesReleased reflects the release after setGradesReleased', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await act(async () => {
      await doLogin!();
    });
    expect(loginLikhaMock).toHaveBeenCalledWith('test@example.com', 'pw');
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/auth/login', expect.anything());

    await act(async () => {
      await doRelease!();
    });
    await waitFor(() => {
      expect(latestCourses.find(c => c.id === 'c1')?.gradesReleased).toEqual({ midterm: true });
    });
  });
});
