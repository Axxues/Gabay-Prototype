// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { DashboardPage } from './DashboardPage';
import { isChairRole } from '../../shared/utils/roles';

const mockOnNavigateCourse = vi.fn();
const mockOnNavigateTab = vi.fn();

let mockUser: any = {
  id: 'u-1',
  name: 'Faculty User',
  role: 'faculty',
  department: 'Department of Computer Science',
  title: 'Instructor',
  avatar: '',
};
let mockRole: any = 'faculty';

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: mockUser,
    activeRole: mockRole,
    db: {
      users: [mockUser],
      courses: [],
      announcements: [],
      activities: [],
      quizzes: [],
      exams: [],
      submissions: [],
      enrollmentRequests: [],
      messages: [],
    },
    colleges: [],
    departments: [],
    schoolYears: [],
    getScopedCourses: () => [],
    getActiveSchoolYearForCollege: () => ({ year: '2025-2026' }),
    getSchoolYearsByCollege: () => [],
    isCourseGradeReady: () => false,
    markTabVisited: vi.fn(),
    getPendingRequestsForStudent: () => [],
  }),
}));

describe('Chair-Sheet RBAC and Dashboard Course Creation Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('hides individual "Create course" button for faculty users', () => {
    mockUser = { id: 'u-fac', name: 'Faculty Member', role: 'faculty' };
    mockRole = 'faculty';

    render(
      <DashboardPage
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    expect(screen.queryByText(/Create course/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Upload Assigned Courses/i)).not.toBeInTheDocument();
  });

  it('hides individual "Create course" button for dean users', () => {
    mockUser = { id: 'u-dean', name: 'Dean Member', role: 'admin', adminSubrole: 'dean' };
    mockRole = 'admin';

    render(
      <DashboardPage
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    expect(screen.queryByText(/Create course/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Upload Assigned Courses/i)).not.toBeInTheDocument();
  });

  it('shows "Upload Assigned Courses" button ONLY for Chairperson', () => {
    mockUser = {
      id: 'u-chair',
      name: 'Chair Member',
      role: 'admin',
      adminSubrole: 'chairperson',
    };
    mockRole = 'admin';

    render(
      <DashboardPage
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    expect(screen.queryByText(/Create course/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Upload Assigned Courses/i)).toBeInTheDocument();
  });
});
