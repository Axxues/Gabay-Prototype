// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  activeRole: 'faculty',
  activeUser: { id: 'u-fac-1', name: 'Faculty', role: 'faculty' } as any,
  pendingRequests: [] as any[],
  db: {
    courses: [],
    enrollmentRequests: [],
    users: [],
    submissions: [],
    activities: [],
    quizzes: [],
    modules: [],
  } as any,
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.activeRole,
    activeUser: mocks.activeUser,
    db: mocks.db,
    isLoading: mocks.isLoading,
    openSpeedGrader: vi.fn(),
    getPendingRequestsForStudent: () => mocks.pendingRequests,
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

describe('DashboardPage pending requests', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.activeRole = 'student';
    mocks.activeUser = { id: 'u-stud-1', name: 'Student 1', role: 'student' } as any;
    // Target course is NOT in the cached (enrolled-only) course list.
    mocks.db = {
      courses: [],
      enrollmentRequests: [],
      users: [],
      submissions: [],
      activities: [],
      quizzes: [],
      modules: [],
    } as any;
    mocks.pendingRequests = [
      {
        id: 'req-pending-1',
        courseId: 'c-unknown',
        studentId: 'u-stud-1',
        type: 'self_join',
        status: 'pending',
        courseCode: 'CMSC 180',
        courseTitle: 'Artificial Intelligence & Expert Systems',
      },
    ];
  });

  test('shows the course snapshot when the course is not cached', () => {
    renderPage();
    expect(screen.getByText('CMSC 180 — Artificial Intelligence & Expert Systems')).toBeInTheDocument();
  });

  test('never renders a bare dash for an unresolvable course', () => {
    mocks.pendingRequests = [
      {
        id: 'req-pending-2',
        courseId: 'c-gone',
        studentId: 'u-stud-1',
        type: 'self_join',
        status: 'pending',
        courseCode: null,
        courseTitle: null,
      },
    ];
    renderPage();
    expect(screen.getByText('Pending course request')).toBeInTheDocument();
  });
});

describe('DashboardPage admin access', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.activeRole = 'admin';
    mocks.activeUser = { id: 'u-admin-1', name: 'Dean Admin', role: 'admin' } as any;
    mocks.db = {
      courses: [
        { id: 'c1', code: 'CMSC 131', title: 'Data Structures', instructorId: 'u-admin-1' },
        { id: 'c2', code: 'CMSC 142', title: 'Algorithms & Complexity', instructorId: 'u-fac-other' },
      ],
      enrollmentRequests: [],
      users: [
        { id: 'u-admin-1', name: 'Dean Admin', role: 'admin' },
        { id: 'u-fac-1', name: 'Prof', role: 'faculty' },
        { id: 'u-stu-1', name: 'Student', role: 'student' },
      ],
      submissions: [
        { id: 'sub-1', courseId: 'c1', studentName: 'Alice', activityKey: 'act-1', status: 'submitted', submittedAt: new Date().toISOString() },
        { id: 'sub-2', courseId: 'c2', studentName: 'Bob', activityKey: 'act-2', status: 'submitted', submittedAt: new Date().toISOString() },
      ],
      activities: [
        { id: 'act-1', courseId: 'c1', title: 'Lab 1' },
        { id: 'act-2', courseId: 'c2', title: 'Lab 2' },
      ],
      quizzes: [],
      modules: [],
    } as any;
  });

  test('admin sees to-grade queue and system overview widget', () => {
    renderPage();

    // Admin only sees courses they created
    expect(screen.getByText('Data Structures')).toBeInTheDocument();
    expect(screen.queryByText('Algorithms & Complexity')).not.toBeInTheDocument();

    // Admin sees faculty "To grade" widget for their course submissions only
    expect(screen.getByText('To grade')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();

    // Admin also sees College system overview widget
    expect(screen.getByText('College system overview')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  test('counts administrative accounts alongside faculty in the Total faculty metric', () => {
    renderPage();

    // Dean Admin (admin) + Prof (faculty) — the student is excluded
    expect(screen.getByText('Total faculty').closest('div')).toHaveTextContent('2');

    // Staff stays its own separate count
    expect(screen.getByText('Staff accounts').closest('div')).toHaveTextContent('0');
  });
});
