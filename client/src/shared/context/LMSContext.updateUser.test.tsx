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

// Users CRUD is Likha-only (Task 3): update-user writes go to Directus via
// likhaLmsApi.users.updateUser. Any Express /api/users call throws loudly.
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  if (String(path).startsWith('/api/users'))
    throw new Error(`regressed to Express: ${path}`);
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
// Echoes the PATCH back as a Directus row, like the live endpoint does.
const updateUserMock = vi.fn(async (id: string, patch: any) => ({
  id,
  first_name: patch.first_name ?? likhaUser.first_name,
  last_name: patch.last_name ?? likhaUser.last_name,
  email: patch.email ?? likhaUser.email,
  role: { name: 'Faculty' },
  avatar: 'OLD_AVATAR',
}));
const createUserMock = vi.fn(async (payload: any) => ({ id: 'u-new', role: { name: 'Student' }, ...payload }));
const deleteUserMock = vi.fn(async () => {});
const resolveRoleMock = vi.fn(async (_name: string) => 'role-uuid-faculty');

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
      createUser: (...args: any[]) => (createUserMock as any)(...args),
      updateUser: (...args: any[]) => (updateUserMock as any)(...args),
      deleteUser: (...args: any[]) => (deleteUserMock as any)(...args),
      resolveRoleId: (...args: any[]) => (resolveRoleMock as any)(...args),
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
let latestName: string | null | undefined;
let latestRole: string | null | undefined;
let doLogin: (() => Promise<any>) | null = null;
let doUpdateAvatar: (() => Promise<boolean>) | null = null;
let doUpdateName: (() => Promise<boolean>) | null = null;
let doUpdateRole: (() => Promise<boolean>) | null = null;
let doUpdateNameAndRole: (() => Promise<boolean>) | null = null;

const Probe: React.FC = () => {
  const { activeUser, login, updateUser } = useLMS();
  latestAvatar = (activeUser as any)?.avatar;
  latestName = (activeUser as any)?.name;
  latestRole = (activeUser as any)?.role;
  doLogin = () => login('test@example.com', 'pw');
  doUpdateAvatar = () => updateUser(likhaUser.id, { avatar: NEW_AVATAR });
  doUpdateName = () => updateUser(likhaUser.id, { name: 'Renamed User' });
  doUpdateRole = () => updateUser(likhaUser.id, { role: 'faculty' as any });
  doUpdateNameAndRole = () => updateUser(likhaUser.id, { name: 'Renamed User', role: 'faculty' as any });
  return <div data-testid="avatar">{String(latestAvatar)}</div>;
};

describe('updateUser syncs the active session user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestAvatar = undefined;
    latestName = undefined;
    latestRole = undefined;
    doLogin = null;
    doUpdateAvatar = null;
    doUpdateName = null;
    doUpdateRole = null;
    doUpdateNameAndRole = null;
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
      await doUpdateAvatar!();
    });

    await waitFor(() => {
      expect(latestAvatar).toBe(NEW_AVATAR);
    });
    expect(screen.getByTestId('avatar').textContent).toBe(NEW_AVATAR);
    // Avatar-only edits apply locally; no Express /api call at all.
    expect(updateUserMock).not.toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  test('name edits PATCH Directus identity fields and echo back', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await act(async () => {
      await doLogin!();
    });

    await act(async () => {
      await doUpdateName!();
    });

    expect(updateUserMock).toHaveBeenCalledWith(
      likhaUser.id,
      expect.objectContaining({ first_name: 'Renamed', last_name: 'User' })
    );
    await waitFor(() => {
      expect(latestName).toBe('Renamed User');
    });
    const expressCalls = (apiFetchMock.mock.calls as any[][]).filter(([p]) =>
      String(p).startsWith('/api/') && !String(p).startsWith('/api/rag'),
    );
    expect(expressCalls).toEqual([]);
  });

  test('role edits resolve the name to UUID in the PATCH body', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await act(async () => {
      await doLogin!();
    });

    await act(async () => {
      await doUpdateRole!();
    });

    expect(resolveRoleMock).toHaveBeenCalledWith('faculty');
    expect(updateUserMock).toHaveBeenCalledWith(
      likhaUser.id,
      expect.objectContaining({ role: 'role-uuid-faculty' })
    );
  });

  test('update still succeeds with a local-only role when the /roles lookup rejects', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await act(async () => {
      await doLogin!();
    });
    resolveRoleMock.mockRejectedValueOnce(new Error('roles unreachable'));

    let ok = false;
    await act(async () => {
      ok = await doUpdateNameAndRole!();
    });

    // Identity write proceeds without the role UUID; role stays local-only.
    expect(ok).toBe(true);
    expect(resolveRoleMock).toHaveBeenCalledWith('faculty');
    expect(updateUserMock).toHaveBeenCalledWith(
      likhaUser.id,
      expect.objectContaining({ first_name: 'Renamed', last_name: 'User' })
    );
    expect(updateUserMock).toHaveBeenCalledWith(
      likhaUser.id,
      expect.not.objectContaining({ role: expect.anything() })
    );
    await waitFor(() => {
      expect(latestName).toBe('Renamed User');
      expect(latestRole).toBe('faculty');
    });
  });
});
