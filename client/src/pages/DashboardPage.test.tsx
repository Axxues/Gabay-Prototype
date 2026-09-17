// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
}));

vi.mock('../context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: 'faculty',
    activeUser: { id: 'u-fac-1', name: 'Faculty', role: 'faculty' },
    db: {
      courses: [],
      enrollmentRequests: [],
      users: [],
      submissions: [],
      activities: [],
      quizzes: [],
      modules: [],
    },
    isLoading: mocks.isLoading,
    openSpeedGrader: vi.fn(),
    getPendingRequestsForStudent: () => [],
    studentApproveInvitation: vi.fn(),
    studentDeclineInvitation: vi.fn(),
    deleteCourse: vi.fn(),
    showConfirm: vi.fn(),
    showAlert: vi.fn(),
    getApprovedRequestsForCourse: vi.fn().mockResolvedValue([]),
  }),
}));

import { DashboardPage } from './DashboardPage';

function renderPage() {
  return render(
    <DashboardPage onNavigateCourse={() => {}} onNavigateTab={() => {}} />
  );
}

describe('DashboardPage refresh loading', () => {
  beforeEach(() => {
    mocks.isLoading = false;
  });

  test('shows loading skeleton (not "no courses") while bootstrapping', () => {
    mocks.isLoading = true;
    renderPage();
    expect(screen.getByTestId('dashboard-courses-loading')).toBeInTheDocument();
    expect(screen.queryByText(/no enrolled courses/i)).not.toBeInTheDocument();
  });

  test('shows empty state only once loading settles', () => {
    renderPage();
    expect(screen.getByText(/no enrolled courses/i)).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-courses-loading')).not.toBeInTheDocument();
  });
});
