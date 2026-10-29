import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  activeRole: 'faculty',
  activeUser: { id: 'u-fac-1', name: 'Prof', role: 'faculty', department: 'CS' },
  removeStudentFromCourse: vi.fn(),
  enrollStudentsInCourse: vi.fn(),
  refreshUsers: vi.fn(),
  sendCourseInvitations: vi.fn(),
  showConfirm: vi.fn(),
  showAlert: vi.fn(),
  mockDb: {
    courses: [
      { id: 'c1', code: 'CMSC 131', instructorId: 'u-fac-1' },
      { id: 'c-dean', code: 'CMSC 199', instructorId: 'u-dean-1' },
    ],
    users: [
      { id: 'u-fac-1', name: 'Prof', email: 'prof@school.edu', role: 'faculty', avatar: '', department: 'CS', title: 'Prof' },
      { id: 'u-fac-other', name: 'Other Prof', email: 'otherfac@school.edu', role: 'faculty', avatar: '', department: 'CS', title: 'Prof' },
      { id: 'u-dean-1', name: 'Dean Eleanor', email: 'dean@school.edu', role: 'admin', adminSubrole: 'dean', avatar: '', department: 'CS', title: 'College Dean' },
      { id: 'u-stu-1', name: 'Stu One', email: 'stu@school.edu', role: 'student', avatar: '', department: 'CS', title: '', studentId: '2021-00001', enrolledCourseIds: ['c1'] },
      { id: 'u-stu-other', name: 'Stu Other Course', email: 'otherstu@school.edu', role: 'student', avatar: 'https://gabay.zyberlab.com/assets/custom-avatar-123', department: 'CS', title: '', studentId: '2021-00002', enrolledCourseIds: ['c2'] },
      { id: 'u-stu-pending', name: 'Stu Pending', email: 'stupending@school.edu', role: 'student', avatar: '', department: 'CS', title: '', studentId: '2021-00003', enrolledCourseIds: [] },
    ],
    enrollmentRequests: [
      { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', studentName: 'Stu One', type: 'self_join', status: 'approved', requestedAt: new Date().toISOString() },
    ],
  },
}));

vi.mock('../../shared/context/LMSContext', () => ({
  getCleanStoredAvatar: () => '',
  useLMS: () => ({
    db: mocks.mockDb,
    activeRole: mocks.activeRole,
    activeUser: mocks.activeUser,
    isLoading: false,
    enrollStudentsInCourse: mocks.enrollStudentsInCourse,
    refreshUsers: mocks.refreshUsers,
    regenerateCourseJoinCode: vi.fn(),
    getPendingRequestsForCourse: vi.fn().mockResolvedValue([]),
    approveEnrollmentRequests: vi.fn(),
    rejectEnrollmentRequests: vi.fn(),
    removeStudentFromCourse: mocks.removeStudentFromCourse,
    showAlert: mocks.showAlert,
    showConfirm: mocks.showConfirm,
  }),
}));

vi.mock('../../shared/api/emailApi', () => ({
  sendCourseInvitations: (...args: any[]) => mocks.sendCourseInvitations(...args),
}));

import { PeopleView } from './PeopleView';

function renderPage() {
  return render(<PeopleView courseId="c1" />);
}

describe('PeopleView remove student', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showConfirm.mockImplementation((_msg: string, cb: () => void) => cb());
    mocks.removeStudentFromCourse.mockResolvedValue(true);
    mocks.enrollStudentsInCourse.mockResolvedValue(true);
    mocks.sendCourseInvitations.mockResolvedValue({ success: true, sent: 1, total: 1 });
  });

  test('faculty sees a remove control on student roster rows only', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /remove stu one from course/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove prof from course/i })).not.toBeInTheDocument();
  });

  test('confirming removal calls removeStudentFromCourse with the course and student', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /remove stu one from course/i }));
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    expect(mocks.removeStudentFromCourse).toHaveBeenCalledWith('c1', 'u-stu-1');
  });

  test('only shows the assigned instructor and enrolled students, excluding uninvolved users', () => {
    renderPage();
    expect(screen.getByText('Prof')).toBeInTheDocument();
    expect(screen.getByText('Stu One')).toBeInTheDocument();
    expect(screen.queryByText('Dean Eleanor')).not.toBeInTheDocument();
    expect(screen.queryByText('Other Prof')).not.toBeInTheDocument();
    expect(screen.queryByText('Stu Other Course')).not.toBeInTheDocument();
    expect(screen.queryByText('Stu Pending')).not.toBeInTheDocument();
  });

  test('filters roster by Faculty and Students tabs correctly', () => {
    renderPage();
    // Default "All": both instructor and student are shown
    expect(screen.getByText('Prof')).toBeInTheDocument();
    expect(screen.getByText('Stu One')).toBeInTheDocument();

    // Switch to Faculty filter
    fireEvent.click(screen.getByRole('button', { name: /^Faculty$/i }));
    expect(screen.getByText('Prof')).toBeInTheDocument();
    expect(screen.queryByText('Stu One')).not.toBeInTheDocument();

    // Switch to Students filter
    fireEvent.click(screen.getByRole('button', { name: /^Students$/i }));
    expect(screen.getByText('Stu One')).toBeInTheDocument();
    expect(screen.queryByText('Prof')).not.toBeInTheDocument();
  });

  test('renders Dean role badge when admin(dean) is the assigned instructor of a course', () => {
    render(<PeopleView courseId="c-dean" />);
    expect(screen.getByText('Dean Eleanor')).toBeInTheDocument();
    expect(screen.getByText('Dean')).toBeInTheDocument();
  });

  test('updates pending tab and badge reactively when db.enrollmentRequests changes without reload', async () => {
    mocks.mockDb.enrollmentRequests = [
      { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', studentName: 'Stu One', type: 'self_join', status: 'approved', requestedAt: new Date().toISOString() },
      { id: 'req-2', courseId: 'c1', studentId: 'u-stu-pending', studentName: 'Stu Pending', type: 'self_join', status: 'pending', requestedAt: new Date().toISOString() },
    ];

    const { rerender } = renderPage();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    // Switch to Pending tab to see the pending request
    fireEvent.click(screen.getByRole('button', { name: /pending/i }));
    expect(await screen.findByText('Stu Pending')).toBeInTheDocument();

    // Now simulate notification acceptance: req-2 becomes approved
    mocks.mockDb.enrollmentRequests = [
      { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', studentName: 'Stu One', type: 'self_join', status: 'approved', requestedAt: new Date().toISOString() },
      { id: 'req-2', courseId: 'c1', studentId: 'u-stu-pending', studentName: 'Stu Pending', type: 'self_join', status: 'approved', requestedAt: new Date().toISOString() },
    ];
    rerender(<PeopleView courseId="c1" />);

    // Pending count badge is gone and student is no longer in pending tab
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    expect(screen.queryByText('Stu Pending')).not.toBeInTheDocument();
    expect(screen.getByText('No Pending Requests')).toBeInTheDocument();
  });

  test('students cannot see pending tab toggle, pending badge, or pending requests', () => {
    mocks.activeRole = 'student';
    mocks.activeUser = { id: 'u-stu-1', name: 'Stu One', role: 'student' };
    mocks.mockDb.enrollmentRequests = [
      { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', studentName: 'Stu One', type: 'self_join', status: 'approved', requestedAt: new Date().toISOString() },
      { id: 'req-2', courseId: 'c1', studentId: 'u-stu-pending', studentName: 'Stu Pending', type: 'self_join', status: 'pending', requestedAt: new Date().toISOString() },
    ];

    renderPage();

    // Roster is visible
    expect(screen.getByText('Stu One')).toBeInTheDocument();

    // Pending tab toggle & badge must not be visible to students
    expect(screen.queryByRole('button', { name: /pending/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Stu Pending')).not.toBeInTheDocument();

    // Reset back to faculty
    mocks.activeRole = 'faculty';
    mocks.activeUser = { id: 'u-fac-1', name: 'Prof', role: 'faculty' };
  });

  test('renders directly to Pending tab when initialTab is set to pending', async () => {
    mocks.mockDb.enrollmentRequests = [
      { id: 'req-2', courseId: 'c1', studentId: 'u-stu-pending', studentName: 'Stu Pending', type: 'self_join', status: 'pending', requestedAt: new Date().toISOString() },
    ];
    render(<PeopleView courseId="c1" initialTab="pending" />);

    // Pending list content is displayed directly without needing to click the tab
    expect(await screen.findByText('Stu Pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  test('enrolling students dispatches both course enrollment request and email invitations', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /enroll person/i }));
    expect(screen.getByText('Enroll Students in Course')).toBeInTheDocument();

    const studentCheckbox = screen.getByText('Stu Other Course');
    fireEvent.click(studentCheckbox);

    const sendButton = screen.getByRole('button', { name: /send invitations/i });
    fireEvent.click(sendButton);

    await vi.waitFor(() => {
      expect(mocks.enrollStudentsInCourse).toHaveBeenCalledWith(['u-stu-other'], 'c1');
    });
    await vi.waitFor(() => {
      expect(mocks.sendCourseInvitations).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            recipientEmail: 'otherstu@school.edu',
            recipientName: 'Stu Other Course',
            courseCode: 'CMSC 131',
          }),
        ])
      );
    });
  });
  test('opening enroll modal triggers refreshUsers and renders custom avatar image for student', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /enroll person/i }));
    expect(screen.getByText('Enroll Students in Course')).toBeInTheDocument();
    expect(mocks.refreshUsers).toHaveBeenCalled();

    const avatarImg = screen.getByRole('img', { name: 'Stu Other Course' });
    expect(avatarImg.tagName.toLowerCase()).toBe('img');
    expect(avatarImg).toHaveAttribute('src', expect.stringContaining('custom-avatar-123'));
  });
});

