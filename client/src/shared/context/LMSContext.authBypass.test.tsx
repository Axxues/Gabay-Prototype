// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const { victimWithoutPassword, sessionUser, likhaLmsApiMock } = vi.hoisted(() => {
  const victim = {
    id: 'u-target-victim',
    first_name: 'Target',
    last_name: 'Faculty',
    email: 'target.faculty@dmmmsu.edu.ph',
    role: { name: 'faculty' },
    // password intentionally omitted
  };
  const session = {
    id: 'u-session',
    first_name: 'Session',
    last_name: 'User',
    email: 'session.user@dmmmsu.edu.ph',
    role: { name: 'student' },
  };
  const mock = {
    loginLikhaUser: vi.fn(async () => {
      // Directus network error/failure (not 401)
      throw new Error('Connection refused (503)');
    }),
    auth: {
      getMe: vi.fn(async () => session),
      login: vi.fn(),
    },
    users: {
      getMe: vi.fn(async () => session),
      getUsers: vi.fn(async () => [session, victim]),
    },
    getCoursesWithRelations: vi.fn(async () => []),
    getNotifications: vi.fn(async () => []),
    courses: { getCoursesWithRelations: vi.fn(async () => []), getCourseEnrollments: vi.fn(async () => []) },
    communications: {
      getNotifications: vi.fn(async () => []),
      getMessages: vi.fn(async () => []),
      getCalendarEvents: vi.fn(async () => []),
      getChatGroups: vi.fn(async () => []),
      getAdvisingSlots: vi.fn(async () => []),
    },
    academicStructure: { getColleges: vi.fn(async () => []), getDepartments: vi.fn(async () => []) },
    requests: { getRequests: vi.fn(async () => []) },
    sections: { getSections: vi.fn(async () => []) },
    invalidateCache: vi.fn(),
  };
  return { victimWithoutPassword: victim, sessionUser: session, likhaLmsApiMock: mock };
});

let capturedLogin: ((emailOrId: string, pw: string) => Promise<{ success: boolean; message?: string }>) | null = null;

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {},
  getToken: () => 'valid-mock-token',
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: vi.fn(),
  likhaLmsApi: likhaLmsApiMock,
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

const TestConsumer: React.FC = () => {
  const { authReady, login } = useLMS();
  capturedLogin = login;
  return <div>{authReady ? 'ready' : 'loading'}</div>;
};

describe('LMSContext security: passwordless auth prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('strictly rejects login when target user has no stored password', async () => {
    const { getByText } = render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(getByText('ready')).toBeDefined();
    });

    let res: { success: boolean; message?: string } | undefined;
    await act(async () => {
      // Attacker attempts to login to victim whose password is not stored
      res = await capturedLogin!('target.faculty@dmmmsu.edu.ph', 'attackerArbitraryPassword');
    });

    // Insecure behavior would return { success: true }
    expect(res?.success).toBe(false);
    expect(res?.message).toBe('Invalid email or password.');
  });
});
