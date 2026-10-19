// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: 'superadmin',
    activeUser: { id: 'u-chancellor', name: 'Chancellor', role: 'superadmin' },
    currentUser: { id: 'u-chancellor', name: 'Chancellor', role: 'superadmin' },
    isAuthenticated: true,
    authReady: true,
    db: {
      users: [{ id: 'u-target', name: 'Trinmar Boado', role: 'admin', email: 'trinmar.boado@gmail.com' }],
      courses: [],
      enrollmentRequests: [],
      notifications: [],
      messages: [],
      announcements: [],
    },
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

vi.mock('./features/accounts/AccountProfilePage', () => ({
  AccountProfilePage: () => <div data-testid="account-profile-page">Profile Content</div>,
}));

vi.mock('./features/accounts/ManageAccountsPage', () => ({
  ManageAccountsPage: () => <div data-testid="manage-accounts-page">Manage Accounts Content</div>,
}));

import { AppContent } from './App';
import { pathToTab } from './shared/config/routes';
import { isLmsSectionTab } from './shared/config/navigation';

describe('View Profile page is outside the Learning Management section', () => {
  it('maps /accounts/:userId/view to the account-profile tab', () => {
    expect(pathToTab('/accounts/u-target/view').tab).toBe('account-profile');
    expect(isLmsSectionTab('account-profile')).toBe(false);
  });

  it('does not render the Learning Management navigation panel on the View Profile page', async () => {
    render(
      <MemoryRouter initialEntries={['/accounts/u-target/view']}>
        <AppContent />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('account-profile-page')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('lms-context-panel')).toBeNull();
    expect(screen.queryByLabelText('Learning Management navigation')).toBeNull();
    expect(screen.queryByText('Learning Management')).toBeNull();
  });
});
