// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const NEW_AVATAR = '/uploads/999_new-photo.png';
// login() maps the Likha avatar id to its asset URL (real mapping behavior).
const MAPPED_AVATAR = 'https://gabay.zyberlab.com/assets/OLD_AVATAR';

const likhaUser = {
  id: 'u1',
  first_name: 'Test',
  last_name: 'User',
  email: 'test@example.com',
  role: { name: 'Faculty' },
  avatar: 'OLD_AVATAR',
};

// Login is Likha-only (Task 2): only the update-user feature path still
// reads Express here. Any other Express call throws loudly.
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  if (path === `/api/users/${likhaUser.id}`)
    return { user: { id: likhaUser.id, avatar: NEW_AVATAR } };
  throw new Error(`unmocked: ${path}`);
});

const loginLikhaMock = vi.fn(async () => ({
  token: 't-likha',
  user: { ...likhaUser },
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

let latestAvatar: string | null | undefined;
let doLogin: (() => Promise<any>) | null = null;
let doUpdate: (() => Promise<boolean>) | null = null;

const Probe: React.FC = () => {
  const { activeUser, login, updateUser } = useLMS();
  latestAvatar = (activeUser as any)?.avatar;
  doLogin = () => login('test@example.com', 'pw');
  doUpdate = () => updateUser(likhaUser.id, { avatar: NEW_AVATAR });
  return <div data-testid="avatar">{String(latestAvatar)}</div>;
};

describe('updateUser syncs the active session user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestAvatar = undefined;
    doLogin = null;
    doUpdate = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('activeUser.avatar reflects the new photo without a page reload', async () => {
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
    expect(latestAvatar).toBe(MAPPED_AVATAR);

    await act(async () => {
      await doUpdate!();
    });

    await waitFor(() => {
      expect(latestAvatar).toBe(NEW_AVATAR);
    });
    expect(screen.getByTestId('avatar').textContent).toBe(NEW_AVATAR);
  });
});
