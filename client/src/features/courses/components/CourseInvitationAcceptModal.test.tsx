import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  activeRole: 'student',
  activeUser: { id: 'u-stu-1', name: 'Student One', email: 'stu1@school.edu', role: 'student', enrolledCourseIds: [] as string[] },
  studentApproveInvitation: vi.fn(),
  studentDeclineInvitation: vi.fn(),
  onNavigateCourse: vi.fn(),
  onClose: vi.fn(),
  mockDb: {
    courses: [
      { id: 'c1', code: 'CS 311', title: 'Software Engineering', section: '3A', instructorName: 'Engr. Turing' },
    ],
    enrollmentRequests: [
      { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', type: 'faculty_enroll', status: 'pending' },
    ],
  },
}));

vi.mock('../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: mocks.mockDb,
    activeRole: mocks.activeRole,
    activeUser: mocks.activeUser,
    studentApproveInvitation: mocks.studentApproveInvitation,
    studentDeclineInvitation: mocks.studentDeclineInvitation,
  }),
}));

import { CourseInvitationAcceptModal } from './CourseInvitationAcceptModal';

describe('CourseInvitationAcceptModal', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeUser.id = 'u-stu-1';
    mocks.activeUser.enrolledCourseIds = [];
    mocks.mockDb.enrollmentRequests = [
      { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', type: 'faculty_enroll', status: 'pending' },
    ];
    mocks.studentApproveInvitation.mockResolvedValue(true);
    mocks.studentDeclineInvitation.mockResolvedValue(true);
  });

  test('displays course details and handles 1-click acceptance', async () => {
    render(
      <CourseInvitationAcceptModal
        isOpen={true}
        onClose={mocks.onClose}
        courseId="c1"
        requestId="req-1"
        targetStudentId="u-stu-1"
        onNavigateCourse={mocks.onNavigateCourse}
      />
    );

    expect(screen.getByText('Class Invitation')).toBeInTheDocument();
    expect(screen.getByText('CS 311')).toBeInTheDocument();
    expect(screen.getByText('Software Engineering')).toBeInTheDocument();
    expect(screen.getByText(/Engr. Turing/)).toBeInTheDocument();

    const acceptBtn = screen.getByRole('button', { name: /accept & enter course/i });
    fireEvent.click(acceptBtn);

    await vi.waitFor(() => {
      expect(mocks.studentApproveInvitation).toHaveBeenCalledWith('req-1');
      expect(mocks.onNavigateCourse).toHaveBeenCalledWith('c1', 'section-selection');
      expect(mocks.onClose).toHaveBeenCalled();
    });
  });

  test('displays decline button and handles declining', async () => {
    render(
      <CourseInvitationAcceptModal
        isOpen={true}
        onClose={mocks.onClose}
        courseId="c1"
        requestId="req-1"
        targetStudentId="u-stu-1"
        onNavigateCourse={mocks.onNavigateCourse}
      />
    );

    const declineBtn = screen.getByRole('button', { name: /decline/i });
    fireEvent.click(declineBtn);

    await vi.waitFor(() => {
      expect(mocks.studentDeclineInvitation).toHaveBeenCalledWith('req-1');
      expect(mocks.onClose).toHaveBeenCalled();
    });
  });

  test('shows account mismatch warning when current user does not match target student', () => {
    mocks.activeUser.id = 'u-other';

    render(
      <CourseInvitationAcceptModal
        isOpen={true}
        onClose={mocks.onClose}
        courseId="c1"
        requestId="req-1"
        targetStudentId="u-stu-1"
        onNavigateCourse={mocks.onNavigateCourse}
      />
    );

    expect(screen.getByText(/account mismatch/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept & enter course/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  test('shows already enrolled banner if student is already in the course', () => {
    mocks.activeUser.enrolledCourseIds = ['c1'];

    render(
      <CourseInvitationAcceptModal
        isOpen={true}
        onClose={mocks.onClose}
        courseId="c1"
        requestId="req-1"
        targetStudentId="u-stu-1"
        onNavigateCourse={mocks.onNavigateCourse}
      />
    );

    expect(screen.getByRole('heading', { name: /already enrolled/i })).toBeInTheDocument();
    const enterBtn = screen.getByRole('button', { name: /enter course/i });
    fireEvent.click(enterBtn);
    expect(mocks.onNavigateCourse).toHaveBeenCalledWith('c1');
    expect(mocks.onClose).toHaveBeenCalled();
  });

  test('shows stale notice when invitation has already been resolved or not pending', () => {
    mocks.mockDb.enrollmentRequests = [
      { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', type: 'faculty_enroll', status: 'approved' },
    ];

    render(
      <CourseInvitationAcceptModal
        isOpen={true}
        onClose={mocks.onClose}
        courseId="c1"
        requestId="req-1"
        targetStudentId="u-stu-1"
        onNavigateCourse={mocks.onNavigateCourse}
      />
    );

    expect(screen.getByRole('heading', { name: /invitation not available/i })).toBeInTheDocument();
    expect(screen.getAllByText(/no longer active/i).length).toBeGreaterThan(0);
  });

  test('shows invitation not available when request is missing or deleted', () => {
    mocks.mockDb.enrollmentRequests = [];

    render(
      <CourseInvitationAcceptModal
        isOpen={true}
        onClose={mocks.onClose}
        courseId="c1"
        requestId="req-deleted"
        targetStudentId="u-stu-1"
        onNavigateCourse={mocks.onNavigateCourse}
      />
    );

    expect(screen.getByRole('heading', { name: /invitation not available/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept & enter course/i })).not.toBeInTheDocument();
  });

  test('detects account mismatch from request.studentId when targetStudentId is omitted in props', () => {
    mocks.mockDb.enrollmentRequests = [
      { id: 'req-1', courseId: 'c1', studentId: 'u-other-student', type: 'faculty_enroll', status: 'pending' },
    ];

    render(
      <CourseInvitationAcceptModal
        isOpen={true}
        onClose={mocks.onClose}
        courseId="c1"
        requestId="req-1"
        onNavigateCourse={mocks.onNavigateCourse}
      />
    );

    expect(screen.getByText(/account mismatch/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept & enter course/i })).not.toBeInTheDocument();
  });
});
