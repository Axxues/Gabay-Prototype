// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const ASSET_UUID = '12345678-1234-1234-1234-123456789abc';
const AVATAR_URL = `https://gabay.zyberlab.com/assets/${ASSET_UUID}`;
const BANNER_URL = 'https://gabay.zyberlab.com/assets/87654321-4321-4321-4321-cba987654321';

const likhaUser = {
  id: 'u-persist-1',
  first_name: 'Persist',
  last_name: 'Test',
  email: 'persist@example.com',
  role: { name: 'Student' },
  avatar: ASSET_UUID,
  banner: BANNER_URL,
};

const updateUserMock = vi.fn(async (id: string, patch: any) => ({
  id,
  first_name: patch.first_name ?? likhaUser.first_name,
  last_name: patch.last_name ?? likhaUser.last_name,
  email: patch.email ?? likhaUser.email,
  avatar: patch.avatar ?? likhaUser.avatar,
  banner: patch.banner ?? likhaUser.banner,
  role: { name: 'Student' },
}));

const loginLikhaMock = vi.fn(async () => ({
  token: 't-persist',
  user: { ...likhaUser },
}));

const getMeMock = vi.fn(async () => ({
  ...likhaUser,
}));

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  getToken: () => 't-persist',
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: vi.fn(),
  likhaLmsApi: {
    auth: {
      getMe: (...args: any[]) => (getMeMock as any)(...args),
    },
    loginLikhaUser: (...args: any[]) => (loginLikhaMock as any)(...args),
    getCoursesWithRelations: vi.fn(async () => []),
    getNotifications: vi.fn(async () => []),
    users: {
      getUsers: vi.fn(async () => [likhaUser]),
      updateUser: (...args: any[]) => (updateUserMock as any)(...args),
      createUser: vi.fn(),
      deleteUser: vi.fn(),
      resolveRoleId: vi.fn(async () => 'role-uuid-student'),
    },
    communications: {
      getMessages: vi.fn(async () => []),
      getCalendarEvents: vi.fn(async () => []),
      getChatGroups: vi.fn(async () => []),
      getAdvisingSlots: vi.fn(async () => []),
    },
    requests: {
      getRequests: vi.fn(async () => []),
    },
    sections: {
      getSections: vi.fn(async () => []),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let activeUserRef: any = null;
let updateUserFn: any = null;
let loginFn: any = null;
let logoutFn: any = null;

const TestProbe: React.FC = () => {
  const { activeUser, updateUser, login, logout } = useLMS();
  activeUserRef = activeUser;
  updateUserFn = updateUser;
  loginFn = login;
  logoutFn = logout;
  return <div>Probe</div>;
};

describe('LMSContext avatar and banner persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeUserRef = null;
    updateUserFn = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('updateUser with avatar URL extracts UUID and patches Directus', async () => {
    render(
      <LMSProvider>
        <TestProbe />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(activeUserRef).not.toBeNull();
    });

    await act(async () => {
      await updateUserFn(likhaUser.id, { avatar: AVATAR_URL });
    });

    expect(updateUserMock).toHaveBeenCalledWith(
      likhaUser.id,
      expect.objectContaining({ avatar: ASSET_UUID })
    );
    expect(localStorage.getItem(`gabay_avatar_${likhaUser.id}`)).toBe(AVATAR_URL);
  });

  test('updateUser with banner patches Directus banner field and stores in localStorage', async () => {
    render(
      <LMSProvider>
        <TestProbe />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(activeUserRef).not.toBeNull();
    });

    await act(async () => {
      await updateUserFn(likhaUser.id, { banner: BANNER_URL });
    });

    expect(updateUserMock).toHaveBeenCalledWith(
      likhaUser.id,
      expect.objectContaining({ banner: BANNER_URL })
    );
    expect(localStorage.getItem(`gabay_banner_${likhaUser.id}`)).toBe(BANNER_URL);
  });

  test('session restore restores banner from Directus or localStorage fallback', async () => {
    localStorage.setItem(`gabay_banner_${likhaUser.id}`, BANNER_URL);
    render(
      <LMSProvider>
        <TestProbe />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(activeUserRef).not.toBeNull();
      expect(activeUserRef.banner).toBe(BANNER_URL);
    });
  });

  test('user uploads profile image and banner, logs out, logs in again, and both avatar and banner persist', async () => {
    render(
      <LMSProvider>
        <TestProbe />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(activeUserRef).not.toBeNull();
    });

    // 1. Update avatar and banner
    await act(async () => {
      await updateUserFn(likhaUser.id, { avatar: AVATAR_URL, banner: BANNER_URL });
    });

    expect(activeUserRef.avatar).toBe(AVATAR_URL);
    expect(activeUserRef.banner).toBe(BANNER_URL);

    // 2. User logs out
    await act(async () => {
      logoutFn();
    });

    expect(activeUserRef).toBeFalsy();

    // 3. User logs back in
    await act(async () => {
      await loginFn('persist@example.com', 'gabay2026');
    });

    await waitFor(() => {
      expect(activeUserRef).not.toBeNull();
      expect(activeUserRef.avatar).toBe(AVATAR_URL);
      expect(activeUserRef.banner).toBe(BANNER_URL);
    });
  });
});
