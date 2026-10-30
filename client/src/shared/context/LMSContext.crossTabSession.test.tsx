import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { LMSProvider, useLMS } from './LMSContext';

let mockToken: string | null = null;
const mockClearToken = vi.fn(() => {
  mockToken = null;
});
const mockGetMe = vi.fn();
const mockInvalidateCache = vi.fn();

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  getToken: () => mockToken,
  setToken: (t: string) => {
    mockToken = t;
  },
  clearToken: () => mockClearToken(),
  apiFetch: vi.fn(),
  SESSION_EXPIRED_EVENT: 'gabay:session-expired',
  notifySessionExpired: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gabay:session-expired'));
    }
  },
  likhaLmsApi: {
    invalidateCache: () => mockInvalidateCache(),
    auth: {
      getMe: () => mockGetMe(),
    },
    academicStructure: {
      getColleges: vi.fn().mockResolvedValue([]),
      getDepartments: vi.fn().mockResolvedValue([]),
    },
    getCoursesWithRelations: vi.fn().mockResolvedValue([]),
    getNotifications: vi.fn().mockResolvedValue([]),
    communications: {
      getMessages: vi.fn().mockResolvedValue([]),
      getCalendarEvents: vi.fn().mockResolvedValue([]),
      getChatGroups: vi.fn().mockResolvedValue([]),
      getAdvisingSlots: vi.fn().mockResolvedValue([]),
    },
    requests: {
      getRequests: vi.fn().mockResolvedValue([]),
    },
    sections: {
      getSections: vi.fn().mockResolvedValue([]),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

const Consumer: React.FC = () => {
  const { isAuthenticated, currentUser, authReady } = useLMS();
  return (
    <div>
      <div data-testid="auth-ready">{authReady ? 'ready' : 'loading'}</div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-email">{currentUser?.email || 'none'}</div>
    </div>
  );
};

describe('Cross-Tab Session Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToken = null;
  });

  it('restores user session in a newly opened tab when token is present', async () => {
    mockToken = 'valid-token-from-existing-tab';
    mockGetMe.mockResolvedValueOnce({
      id: 'usr-tab-1',
      email: 'student@dmmmsu.edu.ph',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      role: { id: 'student-role-id', name: 'Student' },
    });

    render(
      <LMSProvider>
        <Consumer />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-ready').textContent).toBe('ready');
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
      expect(screen.getByTestId('user-email').textContent).toBe('student@dmmmsu.edu.ph');
    });
  });

  it('logs out the active tab when a logout storage event is received from another tab', async () => {
    mockToken = 'active-session-token';
    mockGetMe.mockResolvedValueOnce({
      id: 'usr-tab-2',
      email: 'faculty@dmmmsu.edu.ph',
      first_name: 'Maria',
      last_name: 'Santos',
      role: { id: 'faculty-role-id', name: 'Faculty' },
    });

    render(
      <LMSProvider>
        <Consumer />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
      expect(screen.getByTestId('user-email').textContent).toBe('faculty@dmmmsu.edu.ph');
    });

    // Simulate another tab clearing the token (logging out)
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gabay_token',
          oldValue: 'active-session-token',
          newValue: null,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
      expect(screen.getByTestId('user-email').textContent).toBe('none');
    });
    expect(mockClearToken).toHaveBeenCalled();
  });

  it('automatically logs in an open tab when a login storage event is received from another tab', async () => {
    mockToken = null;

    render(
      <LMSProvider>
        <Consumer />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-ready').textContent).toBe('ready');
      expect(screen.getByTestId('auth-status').textContent).toBe('unauthenticated');
    });

    // User logs in in another tab
    mockToken = 'newly-authenticated-token';
    mockGetMe.mockResolvedValueOnce({
      id: 'usr-tab-3',
      email: 'admin@dmmmsu.edu.ph',
      first_name: 'Admin',
      last_name: 'User',
      role: { id: 'admin-role-id', name: 'Administrator' },
    });

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gabay_token',
          oldValue: null,
          newValue: 'newly-authenticated-token',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('authenticated');
      expect(screen.getByTestId('user-email').textContent).toBe('admin@dmmmsu.edu.ph');
    });
  });
});
