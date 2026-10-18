// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { CoursesPage } from './CoursesPage';
import { DashboardPage } from '../dashboard/DashboardPage';

afterEach(() => {
  cleanup();
});

let mockActiveCourseId: string | null = 'c-curr';
const mockSetActiveCourseId = vi.fn((id: string | null) => {
  mockActiveCourseId = id;
});
const mockMarkTabVisited = vi.fn();
const mockHydrateCourse = vi.fn();

let mockCoursesState = [
  {
    id: 'c-curr',
    code: 'CS 101',
    title: 'Intro to Computer Science',
    section: '1-A',
    schoolYear: '2025-2026',
    published: true,
  },
  {
    id: 'c-past',
    code: 'CS 99',
    title: 'Foundation Computing',
    section: '1-B',
    schoolYear: '2024-2025',
    published: true,
  },
];

const mockSchoolYears = [
  { id: 'sy-2526', collegeId: 'col-ccs', year: '2025-2026', isActive: true },
  { id: 'sy-2425', collegeId: 'col-ccs', year: '2024-2025', isActive: false },
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeCourseId: mockActiveCourseId,
    setActiveCourseId: mockSetActiveCourseId,
    hydrateCourse: mockHydrateCourse,
    db: {
      courses: mockCoursesState,
      users: [],
      enrollmentRequests: [],
      modules: [],
      activities: [],
      quizzes: [],
      exams: [],
      submissions: [],
      courseFiles: [],
      courseGrades: [],
      calendarEvents: [],
      announcements: [],
      messages: [],
    },
    activeRole: 'student',
    activeUser: {
      id: 'u-stud1',
      collegeId: 'col-ccs',
      department: 'CS',
      enrolledCourseIds: ['c-curr', 'c-past'],
    },
    colleges: [{ id: 'col-ccs', name: 'College of Computer Science' }],
    departments: [{ id: 'dept-cs', collegeId: 'col-ccs', name: 'Computer Science' }],
    schoolYears: mockSchoolYears,
    getSchoolYearsByCollege: (colId: string) => mockSchoolYears.filter(sy => sy.collegeId === colId),
    getActiveSchoolYearForCollege: (colId: string) => mockSchoolYears.find(sy => sy.collegeId === colId && sy.isActive),
    getPendingRequestsForStudent: () => [],
    getApprovedRequestsForCourse: vi.fn().mockResolvedValue([]),
    studentApproveInvitation: vi.fn(),
    studentDeclineInvitation: vi.fn(),
    deleteCourse: vi.fn(),
    showConfirm: vi.fn(),
    showAlert: vi.fn(),
    openSpeedGrader: vi.fn(),
    isLoading: false,
    getUnreadNotificationCount: () => 0,
    markTabVisited: mockMarkTabVisited,
    isCourseGradeReady: () => false,
  }),
}));

describe('DashboardPage Academic Scope Horizontal Scrollable Wheel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders Academic Scope horizontal wheel and defaults to active year on Dashboard', () => {
    render(<DashboardPage onNavigateCourse={() => {}} onNavigateTab={() => {}} />);

    // Academic Scope section exists on dashboard
    expect(screen.getByText('Academic Scope')).toBeInTheDocument();
    expect(screen.getByTestId('academic-scope-wheel')).toBeInTheDocument();

    // Defaults to current active year (2025-2026)
    expect(screen.getByText('Intro to Computer Science')).toBeInTheDocument();
    expect(screen.queryByText('Foundation Computing')).not.toBeInTheDocument();
  });

  test('clicking year in horizontal wheel filters courses on Dashboard', async () => {
    render(<DashboardPage onNavigateCourse={() => {}} onNavigateTab={() => {}} />);

    const pastYearBtn = screen.getByRole('button', { name: /AY 2024-2025/i });
    fireEvent.click(pastYearBtn);

    await waitFor(() => {
      expect(screen.getByText('Foundation Computing')).toBeInTheDocument();
      expect(screen.queryByText('Intro to Computer Science')).not.toBeInTheDocument();
    });
  });

  test('clicking All Years shows all courses across historical years on Dashboard', async () => {
    render(<DashboardPage onNavigateCourse={() => {}} onNavigateTab={() => {}} />);

    const allYearsBtn = screen.getByRole('button', { name: /All Years/i });
    fireEvent.click(allYearsBtn);

    await waitFor(() => {
      expect(screen.getByText('Intro to Computer Science')).toBeInTheDocument();
      expect(screen.getByText('Foundation Computing')).toBeInTheDocument();
    });
  });
});

describe('CoursesPage Scoped Views (without Academic Scope Banner)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveCourseId = 'c-curr';
  });

  test('CoursesPage does not render Academic Scope banner or course pills', () => {
    render(<CoursesPage initialSubTab="modules" />);

    // Academic Scope banner should be gone from CoursesPage
    expect(screen.queryByText('Academic Scope')).not.toBeInTheDocument();
    expect(screen.queryByTestId('courses-school-year-filter')).not.toBeInTheDocument();
  });

  test('CoursesPage renders active course modules view cleanly', async () => {
    render(<CoursesPage initialSubTab="modules" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Modules' })).toBeInTheDocument();
    });
  });
});
