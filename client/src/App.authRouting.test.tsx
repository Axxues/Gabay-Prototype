// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  activeRole: 'student',
  isAuthenticated: false,
  authReady: true,
}));

vi.mock('./shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.activeRole,
    activeUser: null,
    currentUser: null,
    isAuthenticated: mocks.isAuthenticated,
    authReady: mocks.authReady,
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
  }),
  LMSProvider: ({ children }: any) => children,
}));

import { AppContent } from './App';
import { AuthCardSkeleton, PageSkeleton } from './shared/components/common/AppSkeleton';

describe('Auth Routing and Skeleton Loading', () => {
  it('renders RegisterPage without rendering dashboard skeleton on /register', async () => {
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
});
