// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

// Directus-shaped directory rows: role comes back as an expanded object
// (role name), exactly like the live Likha ERP stores them.
const directoryRows = [
  { id: 'u-fac', first_name: 'Faculty', last_name: 'Instructor 1', email: 'faculty1@dmmmsu.edu.ph', role: { name: 'Instructor' } },
  { id: 'u-staff', first_name: 'Staff', last_name: 'One', email: 'staff1@dmmmsu.edu.ph', role: { name: 'Staff' } },
  { id: 'u-stud', first_name: 'Dup', last_name: '', email: 'dup@dmmmsu.edu.ph', role: { name: 'Student' } },
];

const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  if (path === '/api/courses') return { courses: [] };
  if (path === '/api/notifications?limit=200') return { notifications: [] };
  if (path === '/api/messages') return { messages: [] };
  if (path === '/api/calendar') return { events: [] };
  if (path === '/api/groups') return { groups: [] };
  if (path === '/api/advising') return { slots: [] };
  if (path === '/api/requests/mine') return { requests: [] };
  throw new Error(`unmocked: ${path}`);
});

const loginLikhaMock = vi.fn(async () => ({
  token: 't-admin',
  user: {
    id: 'u-admin',
    first_name: 'Jayvee',
    last_name: 'Admin',
    email: 'admin@dmmmsu.edu.ph',
    role: { name: 'Administrator' },
  },
}));
const getCoursesMock = vi.fn(async () => []);
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => directoryRows);

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
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let doLogin: (() => Promise<any>) | null = null;
let seenUsers: any[] | null = null;

const Probe: React.FC = () => {
  const { db, login } = useLMS();
  seenUsers = db.users as any[];
  doLogin = () => login('admin@dmmmsu.edu.ph', 'pw');
  return null;
};

describe('user directory role mapping (Likha ERP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doLogin = null;
    seenUsers = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('maps Instructor/Staff/Administrator role names instead of lumping everyone as student', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      await doLogin!();
    });
    await waitFor(() => {
      expect((seenUsers || []).length).toBe(4);
    });
    const byId = Object.fromEntries((seenUsers || []).map((u: any) => [u.id, u.role]));
    expect(byId['u-fac']).toBe('faculty');
    expect(byId['u-staff']).toBe('staff');
    expect(byId['u-admin']).toBe('admin');
    expect(byId['u-stud']).toBe('student');
  });
});
