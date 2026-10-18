// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  activeRole: 'student',
  isAuthenticated: false,
  authReady: true,
  isLoading: false,
  isSessionExpired: false,
}));

const mockUser = {
  id: 'u-1',
  name: 'Test Student',
  email: 'student@example.com',
  role: 'student',
  address: '123 Campus St, San Fernando',
  contactNumber: '09123456789',
  birthday: '1995-05-15',
  yearsOfTeaching: 5,
  educationalBackground: [
    {
      id: 'deg-mock-1',
      degreeLevel: 'bachelors',
      school: 'DMMMSU',
      yearGraduated: 2017,
      specialization: 'Information Technology',
    },
  ],
};

vi.mock('./shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.activeRole,
    activeUser: mocks.isAuthenticated ? { ...mockUser, role: mocks.activeRole, profileCompleted: true } : null,
    currentUser: mocks.isAuthenticated ? { ...mockUser, role: mocks.activeRole, profileCompleted: true } : null,
    isAuthenticated: mocks.isAuthenticated,
    authReady: mocks.authReady,
    isLoading: mocks.isLoading,
    isSessionExpired: mocks.isSessionExpired,
    db: { users: [], courses: [], enrollmentRequests: [], notifications: [], messages: [], announcements: [] },
    activeCourseId: null,
    setActiveCourseId: vi.fn(),
    logHistory: vi.fn(),
    theme: 'light',
    toggleTheme: vi.fn(),
    registerAccount: vi.fn(),
    activateEmail: vi.fn().mockResolvedValue({ success: true, message: 'Activated' }),
    colleges: [{ id: 'col-1', code: 'CIS', name: 'College of Information Systems', departments: [{ id: 'dept-1', name: 'IT', collegeId: 'col-1' }] }],
    departments: [{ id: 'dept-1', name: 'IT', collegeId: 'col-1' }],
    getUnreadNotificationCount: () => 0,
    getNotifications: () => [],
    getPendingRequestsForStudent: () => [],
    getUnreadMessageCount: () => 0,
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
    logout: vi.fn(),
  }),
  LMSProvider: ({ children }: any) => children,
}));

import { AppContent } from './App';
import { AuthCardSkeleton } from './shared/components/common/AppSkeleton';

describe('Auth Routing and Skeleton Loading', () => {
  it('renders RegisterPage without rendering dashboard skeleton on /register', async () => {
    mocks.isAuthenticated = false;
    mocks.isLoading = false;
    mocks.authReady = true;

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AppContent />
      </MemoryRouter>
    );

    // Dashboard skeleton must NOT appear
    expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();

    // Register page content should be present
    expect(screen.getByRole('heading', { name: /Create Account/i })).toBeInTheDocument();
  });

  it('renders AuthCardSkeleton rather than DashboardSkeleton for auth routes', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthCardSkeleton />
      </MemoryRouter>
    );

    expect(screen.getByTestId('auth-card-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
  });

  it('does not render AuthCardSkeleton when authenticated on /login even if background loading is true', () => {
    mocks.isAuthenticated = true;
    mocks.isLoading = true;
    mocks.authReady = true;

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AppContent />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('auth-card-skeleton')).not.toBeInTheDocument();
  });

  it('redirects authenticated user on /login directly to /dashboard even if location.state.from was set', () => {
    mocks.activeRole = 'admin';
    mocks.isAuthenticated = true;
    mocks.isLoading = false;
    mocks.authReady = true;

    function LocationSpy() {
      const location = useLocation();
      return <div data-testid="location-spy">{location.pathname}</div>;
    }

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/governance' } }]}>
        <LocationSpy />
        <AppContent />
      </MemoryRouter>
    );

    expect(screen.getByTestId('location-spy')).toHaveTextContent('/dashboard');
  });

  it('holds AuthLoadingScreen rather than redirecting to /login when isSessionExpired is true on protected route', () => {
    mocks.isAuthenticated = false;
    mocks.authReady = true;
    mocks.isLoading = false;
    mocks.isSessionExpired = true;

    function LocationSpy() {
      const location = useLocation();
      return <div data-testid="location-spy">{location.pathname}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <LocationSpy />
        <AppContent />
      </MemoryRouter>
    );

    // Location must stay on /dashboard (not redirected to /login yet)
    expect(screen.getByTestId('location-spy')).toHaveTextContent('/dashboard');
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
  });
});
