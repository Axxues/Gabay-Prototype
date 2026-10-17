import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { LMSProvider, useLMS } from './LMSContext';
import { SESSION_EXPIRED_EVENT } from '../api/client';

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

const TestConsumer: React.FC = () => {
  const { isSessionExpired, currentUser, dismissSessionExpired } = useLMS();
  return (
    <div>
      <div data-testid="session-expired-state">{String(isSessionExpired)}</div>
      <div data-testid="current-user">{currentUser?.email || 'none'}</div>
      <button data-testid="manual-dismiss" onClick={dismissSessionExpired}>
        Dismiss
      </button>
    </div>
  );
};

describe('LMSContext Session Expiration Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToken = null;
    mockGetMe.mockResolvedValue(null);
    delete (window as any).location;
    (window as any).location = { href: '', assign: vi.fn() };
  });

  it('sets isSessionExpired to true and displays SessionExpiredModal when SESSION_EXPIRED_EVENT fires', async () => {
    render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    expect(screen.getByTestId('session-expired-state').textContent).toBe('false');
    expect(screen.queryByRole('alertdialog')).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    });

    expect(screen.getByTestId('session-expired-state').textContent).toBe('true');
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Session Expired')).toBeInTheDocument();
    expect(
      screen.getByText('Your session has ended. Please sign in again to continue using Gabay LMS.')
    ).toBeInTheDocument();
  });

  it('clears token, invalidates cache, and redirects to /login when clicking Back to Login', async () => {
    mockToken = 'my-old-token';
    render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    });

    const backButton = await screen.findByRole('button', { name: /back to login/i });
    expect(backButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(backButton);
    });

    expect(mockClearToken).toHaveBeenCalled();
    expect(mockInvalidateCache).toHaveBeenCalled();
    expect(screen.getByTestId('session-expired-state').textContent).toBe('false');
    expect(window.location.href).toBe('/login');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('triggers isSessionExpired on mount when token restore encounters 401', async () => {
    mockToken = 'expired-restore-token';
    mockGetMe.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));

    render(
      <LMSProvider>
        <TestConsumer />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-expired-state').textContent).toBe('true');
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText('Session Expired')).toBeInTheDocument();
    });
  });
});
