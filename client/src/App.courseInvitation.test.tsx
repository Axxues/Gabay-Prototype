// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  activeRole: 'student',
  isAuthenticated: true,
  authReady: true,
  isLoading: false,
  isSessionExpired: false,
  studentApproveInvitation: vi.fn(),
  studentDeclineInvitation: vi.fn(),
  logout: vi.fn(),
  mockDb: {
    courses: [
      { id: 'c1', code: 'CS 311', title: 'Software Engineering', section: '3A', instructorName: 'Engr. Turing' },
    ],
    users: [
      { id: 'u-stu-1', name: 'Test Student', email: 'stu@school.edu', role: 'student', enrolledCourseIds: [] },
    ],
    enrollmentRequests: [
      { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', type: 'faculty_enroll', status: 'pending' },
    ],
    notifications: [],
    messages: [],
    announcements: [],
  },
}));

const mockUser = {
  id: 'u-stu-1',
  name: 'Test Student',
  email: 'stu@school.edu',
  role: 'student',
  enrolledCourseIds: [],
};

vi.mock('./shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.activeRole,
    activeUser: mocks.isAuthenticated ? { ...mockUser, role: mocks.activeRole } : null,
    currentUser: mocks.isAuthenticated ? { ...mockUser, role: mocks.activeRole } : null,
    isAuthenticated: mocks.isAuthenticated,
    authReady: mocks.authReady,
    isLoading: mocks.isLoading,
    isSessionExpired: mocks.isSessionExpired,
    db: mocks.mockDb,
    activeCourseId: null,
    setActiveCourseId: vi.fn(),
    logHistory: vi.fn(),
    logout: mocks.logout,
    studentApproveInvitation: mocks.studentApproveInvitation,
    studentDeclineInvitation: mocks.studentDeclineInvitation,
    getUnreadNotificationCount: () => 0,
    getNotifications: () => [],
    getPendingRequestsForStudent: () => [],
    getUnreadMessageCount: () => 0,
  }),
  LMSProvider: ({ children }: any) => children,
}));

import { AppContent } from './App';

describe('App Course Invitation Routing & Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.isAuthenticated = true;
    mocks.studentApproveInvitation.mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('detects join search params when authenticated and opens CourseInvitationAcceptModal', async () => {
    render(
      <MemoryRouter initialEntries={['/?action=join&courseId=c1&requestId=req-1&studentId=u-stu-1']}>
        <AppContent />
      </MemoryRouter>
    );

    expect(await screen.findByText('Class Invitation')).toBeInTheDocument();
    expect(screen.getByText('CS 311')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept & enter course/i })).toBeInTheDocument();
  });

  it('persists pending join in sessionStorage when user is unauthenticated on /login', () => {
    mocks.isAuthenticated = false;

    render(
      <MemoryRouter initialEntries={['/login?action=join&courseId=c1&requestId=req-1&studentId=u-stu-1']}>
        <AppContent />
      </MemoryRouter>
    );

    const stored = sessionStorage.getItem('gabay_pending_join');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.courseId).toBe('c1');
    expect(parsed.requestId).toBe('req-1');
  });

  it('restores pending join from sessionStorage once user becomes authenticated', async () => {
    sessionStorage.setItem(
      'gabay_pending_join',
      JSON.stringify({ courseId: 'c1', requestId: 'req-1', studentId: 'u-stu-1' })
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppContent />
      </MemoryRouter>
    );

    expect(await screen.findByText('Class Invitation')).toBeInTheDocument();
    expect(screen.getByText('CS 311')).toBeInTheDocument();
    // Verify it clears sessionStorage so refreshing doesn't reopen
    expect(sessionStorage.getItem('gabay_pending_join')).toBeNull();
  });
});
