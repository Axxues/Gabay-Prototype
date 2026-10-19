// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  activeRole: 'superadmin',
  isAuthenticated: true,
  authReady: true,
}));

vi.mock('./shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.activeRole,
    activeUser: { id: 'u-chancellor', name: 'Chancellor', role: mocks.activeRole },
    currentUser: { id: 'u-chancellor', name: 'Chancellor', role: mocks.activeRole },
    isAuthenticated: mocks.isAuthenticated,
    authReady: mocks.authReady,
    db: { users: [], courses: [], enrollmentRequests: [], notifications: [], messages: [], announcements: [] },
    activeCourseId: null,
    setActiveCourseId: vi.fn(),
    logHistory: vi.fn(),
    isRoleModalOpen: false,
    setIsRoleModalOpen: vi.fn(),
    isUserProfileModalOpen: false,
    setIsUserProfileModalOpen: vi.fn(),
    isHistoryDrawerOpen: false,
    setIsHistoryDrawerOpen: vi.fn(),
    isHelpDrawerOpen: false,
    setIsHelpDrawerOpen: vi.fn(),
    accent: 'blue',
    customAccentHex: '',
    theme: 'light',
    getUnreadNotificationCount: () => 0,
    getNotifications: () => [],
    getPendingRequestsForStudent: () => [],
    logout: vi.fn(),
    colleges: [],
    departments: [],
  }),
  LMSProvider: ({ children }: any) => children,
}));

vi.mock('./features/accounts/ManageAccountsPage', () => ({
  ManageAccountsPage: () => <div data-testid="manage-accounts-page">Manage Accounts Content</div>,
}));

vi.mock('./features/dashboard/DashboardPage', () => ({
  DashboardPage: () => <div data-testid="dashboard-page">Dashboard Content</div>,
}));

import { AppContent } from './App';

describe('App accounts route guard and decommissioned backdoor', () => {
  it('allows superadmin to visit /accounts without redirecting to dashboard', async () => {
    mocks.activeRole = 'superadmin';
    render(
      <MemoryRouter initialEntries={['/accounts']}>
        <AppContent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('manage-accounts-page')).toBeInTheDocument();
    });
  });

  it('redirects /accounts/new to /accounts (sealing manual creation backdoor)', async () => {
    mocks.activeRole = 'superadmin';
    render(
      <MemoryRouter initialEntries={['/accounts/new']}>
        <AppContent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('manage-accounts-page')).toBeInTheDocument();
    });
  });

  it('redirects non-admin/non-superadmin users away from /accounts to /dashboard', async () => {
    mocks.activeRole = 'student';
    render(
      <MemoryRouter initialEntries={['/accounts']}>
        <AppContent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('renders Create Leadership Account full width without the Learning Management panel', async () => {
    mocks.activeRole = 'superadmin';
    render(
      <MemoryRouter initialEntries={['/accounts/create-leadership']}>
        <AppContent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /create leadership account/i })).toBeInTheDocument();
    });

    expect(screen.queryByTestId('lms-context-panel')).toBeNull();
    expect(screen.queryByLabelText('Learning Management navigation')).toBeNull();

    // The far-left icon rail is global navigation and must stay.
    expect(document.querySelector('aside')).not.toBeNull();

    // The page must fill the screen rather than sit inside the 1600px content cap.
    const contentWrapper = document.querySelector('main > div');
    expect(contentWrapper?.className).not.toContain('max-w-[1600px]');
  });
});
