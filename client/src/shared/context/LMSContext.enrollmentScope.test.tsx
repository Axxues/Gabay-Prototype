// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

// Directus-shaped rows, exactly like the live Likha ERP stores them.
const directusCourse = {
  id: 'c1',
  code: 'CMSC 180',
  title: 'CMSC 180',
  instructor_id: 'u-fac-1',
  published: true,
};

const directusApprovedRow = {
  id: 'req-approved-1',
  course_id: 'c1',
  student_id: 'u-stud-1',
  student_name: 'Stud One',
  type: 'self_join',
  status: 'approved',
  requested_at: '2026-10-01T00:00:00.000Z',
};

const fetchedPaths: string[] = [];

// Deferred content/assessment/files fills belong to later migration tasks
// and still read Express — return empties for those shapes here.
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  fetchedPaths.push(path);
  if (path.includes('/submissions')) return { submissions: [] };
  if (path.includes('/modules')) return { modules: [] };
  if (path.includes('/announcements')) return { announcements: [] };
  if (path.includes('/discussions')) return { discussions: [] };
  if (path.includes('/quizzes')) return { quizzes: [] };
  if (path.includes('/exams')) return { exams: [] };
  if (path.includes('/activities')) return { activities: [] };
  if (path.includes('/grades')) return { grades: [] };
  if (path.includes('/spr')) return { config: null };
  if (path.includes('/folders')) return { folders: [] };
  if (path.includes('/files')) return { files: [] };
  throw new Error(`unmocked: ${path}`);
});

const loginLikhaMock = vi.fn(async () => ({
  token: 't-likha',
  user: {
    id: 'u-fac-1',
    first_name: 'Faculty',
    last_name: 'One',
    email: 'faculty1@dmmmsu.edu.ph',
    role: { name: 'Faculty' },
  },
}));
const getCoursesMock = vi.fn(async () => [{ ...directusCourse }]);
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => [
  { id: 'u-fac-1', first_name: 'Faculty', last_name: 'One', email: 'faculty1@dmmmsu.edu.ph', role: { name: 'Faculty' } },
]);
const getMessagesMock = vi.fn(async () => []);
const getCalendarMock = vi.fn(async () => []);
const getGroupsMock = vi.fn(async () => []);
const getSlotsMock = vi.fn(async () => []);
const getSectionsMock = vi.fn(async () => []);
const getRequestsMock = vi.fn(async (courseId?: string, status?: string) => {
  if (courseId === 'c1' && status === 'approved') return [{ ...directusApprovedRow }];
  return [];
});

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

let doLogin: (() => Promise<any>) | null = null;
let cachedRequests: any[] | null = null;

const Probe: React.FC = () => {
  const { db, login } = useLMS();
  cachedRequests = db.enrollmentRequests as any[];
  doLogin = () => login('faculty1@dmmmsu.edu.ph', 'pw');
  return null;
};

// Bootstrap Express paths removed by the Likha-direct migration. Per-course
// content/assessment/files loops still read Express (later tasks) and are
// intentionally NOT in this set.
const removedBootstrapPaths = new Set([
  '/api/auth/login',
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

describe('bootstrap enrollment-request scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchedPaths.length = 0;
    doLogin = null;
    cachedRequests = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('caches approved requests alongside pending ones (People + gradebook rosters)', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      await doLogin!();
    });
    await waitFor(() => {
      expect(cachedRequests).toContainEqual(expect.objectContaining({ id: 'req-approved-1', status: 'approved' }));
    });
    // Approved rows arrived via Likha, not the removed Express scope paths.
    expect(getRequestsMock).toHaveBeenCalledWith('c1', 'approved');
    expect(fetchedPaths.filter(isRemovedBootstrapPath)).toEqual([]);
  });
});
