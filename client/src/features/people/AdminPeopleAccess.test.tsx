import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  removeStudentFromCourse: vi.fn(),
  showConfirm: vi.fn(),
  showAlert: vi.fn(),
  regenerateCourseJoinCode: vi.fn(),
  enrollStudentsInCourse: vi.fn(),
}));

vi.mock('../../shared/context/LMSContext', () => ({
  getCleanStoredAvatar: () => '',
  useLMS: () => ({
    db: {
      courses: [{ id: 'c1', code: 'CMSC 131', instructorId: 'u-fac-1', joinCode: 'JOIN123' }],
      users: [
        { id: 'u-admin-1', name: 'Dean Admin', email: 'dean@school.edu', role: 'admin', avatar: '', department: 'CS', title: 'Dean' },
        { id: 'u-stu-1', name: 'Stu One', email: 'stu@school.edu', role: 'student', avatar: '', department: 'CS', title: '', studentId: '2021-00001', enrolledCourseIds: ['c1'] },
      ],
      enrollmentRequests: [
        { id: 'req-1', courseId: 'c1', studentId: 'u-stu-1', studentName: 'Stu One', type: 'self_join', status: 'approved', requestedAt: new Date().toISOString() },
      ],
    },
    activeRole: 'admin',
    activeUser: { id: 'u-admin-1', name: 'Dean Admin', role: 'admin' },
    isLoading: false,
    enrollStudentsInCourse: mocks.enrollStudentsInCourse,
    regenerateCourseJoinCode: mocks.regenerateCourseJoinCode,
    getPendingRequestsForCourse: vi.fn().mockResolvedValue([]),
    approveEnrollmentRequests: vi.fn(),
    rejectEnrollmentRequests: vi.fn(),
    removeStudentFromCourse: mocks.removeStudentFromCourse,
    showAlert: mocks.showAlert,
    showConfirm: mocks.showConfirm,
  }),
}));

import { PeopleView } from './PeopleView';

describe('Admin PeopleView Access', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('admin sees enroll person, regenerate join code, and remove student controls like faculty', () => {
    render(<PeopleView courseId="c1" />);

    // Admin must see Enroll person button
    expect(screen.getByRole('button', { name: /enroll person/i })).toBeInTheDocument();

    // Admin must see Regenerate Join Code button
    expect(screen.getByTitle(/regenerate join code/i)).toBeInTheDocument();

    // Admin must see Remove student button on student roster row
    expect(screen.getByRole('button', { name: /remove stu one from course/i })).toBeInTheDocument();
  });
});
