// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CoursesPage } from './CoursesPage';

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
    getUnreadNotificationCount: () => 0,
    markTabVisited: mockMarkTabVisited,
    isCourseGradeReady: () => false,
  }),
}));

describe('CoursesPage School Year Filtering and Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveCourseId = 'c-curr';
  });

  test('defaults view to active school year and filters courses', async () => {
    render(<CoursesPage initialSubTab="modules" />);

    // School Year selector should be present and default to active year (2025-2026)
    const sySelector = screen.getByTestId('courses-school-year-filter');
    expect(sySelector).toBeInTheDocument();
    expect(sySelector).toHaveTextContent('2025-2026');

    // Only current course should be displayed/active in active year
    expect(screen.getByText('Intro to Computer Science')).toBeInTheDocument();
    expect(screen.queryByText('Foundation Computing')).not.toBeInTheDocument();
  });

  test('switching to past school year displays past courses and switches activeCourseId', async () => {
    render(<CoursesPage initialSubTab="modules" />);

    const sySelector = screen.getByTestId('courses-school-year-filter');
    fireEvent.click(sySelector);

    // Click past year option '2024-2025'
    const pastOption = screen.getByRole('button', { name: /2024-2025/i });
    fireEvent.click(pastOption);

    // Active course should update to past course
    expect(mockSetActiveCourseId).toHaveBeenCalledWith('c-past');

    await waitFor(() => {
      expect(screen.getByText('Foundation Computing')).toBeInTheDocument();
      expect(screen.queryByText('Intro to Computer Science')).not.toBeInTheDocument();
    });
  });

  test('selecting "All School Years" displays all courses across historical years', async () => {
    render(<CoursesPage initialSubTab="modules" />);

    const sySelector = screen.getByTestId('courses-school-year-filter');
    fireEvent.click(sySelector);

    const allOption = screen.getByRole('button', { name: /All School Years/i });
    fireEvent.click(allOption);

    await waitFor(() => {
      // Both courses should be available in list/pills
      expect(screen.getByText('(2025-2026)')).toBeInTheDocument();
      expect(screen.getByText('(2024-2025)')).toBeInTheDocument();
      expect(screen.getByText('Intro to Computer Science')).toBeInTheDocument();
      expect(screen.getByText('Foundation Computing')).toBeInTheDocument();
    });
  });

  test('past courses remain fully interactive and modules view is rendered', async () => {
    mockActiveCourseId = 'c-past';
    render(<CoursesPage initialSubTab="modules" />);

    const sySelector = screen.getByTestId('courses-school-year-filter');
    fireEvent.click(sySelector);
    fireEvent.click(screen.getByRole('button', { name: /2024-2025/i }));

    // Historical course should have its modules view loaded
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Modules' })).toBeInTheDocument();
    });
  });
});
