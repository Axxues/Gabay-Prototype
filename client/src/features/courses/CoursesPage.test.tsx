// @vitest-environment jsdom
import { describe, expect, test, vi, afterEach, beforeEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';

afterEach(() => {
  cleanup();
});

let mockCourseSyllabus: any = { courseInfo: { title: 'Introduction to Computer Science' } };
let mockRole = 'faculty';
let mockSections: any[] = [];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeCourseId: 'c1',
    setActiveCourseId: vi.fn(),
    hydrateCourse: vi.fn(),
    db: {
      courses: [
        {
          id: 'c1',
          code: 'CS 101',
          title: 'Introduction to Computer Science',
          published: true,
          instructorId: 'u1',
          get syllabus() {
            return mockCourseSyllabus;
          },
        },
      ],
      enrollmentRequests: [],
      modules: [],
      activities: [],
      quizzes: [],
      exams: [],
      submissions: [],
      files: [],
      users: [],
      get courseSections() {
        return mockSections;
      },
    },
    get activeRole() {
      return mockRole;
    },
    activeUser: { id: 'u1', enrolledCourseIds: ['c1'] },
    getUnreadNotificationCount: () => 0,
    markTabVisited: vi.fn(),
    isCourseGradeReady: () => false,
    hasCourseSyllabus: () => Boolean(mockCourseSyllabus),
  }),
}));

import { CoursesPage } from './CoursesPage';

describe('CoursesPage syllabus gating and lazy loading', () => {
  beforeEach(() => {
    mockCourseSyllabus = { courseInfo: { title: 'Introduction to Computer Science' } };
    mockRole = 'faculty';
  });

  test('renders sub-tab navigation and resolves lazy-loaded sub-view when syllabus exists', async () => {
    render(<CoursesPage initialSubTab="modules" />);

    // Header buttons should be present
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.getByText('Syllabus')).toBeInTheDocument();

    // Resolves modules view after lazy import
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { level: 1, name: 'Modules' })).toBeInTheDocument();
        expect(screen.getByText('No modules available for this course section yet.')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );
  });

  test('gates modules when no syllabus exists and displays syllabus required card', () => {
    mockCourseSyllabus = null;
    render(<CoursesPage initialSubTab="modules" />);

    const gate = screen.getByTestId('modules-syllabus-gate');
    expect(gate).toBeInTheDocument();
    expect(screen.getByText('Syllabus required for modules')).toBeInTheDocument();
    expect(screen.getByText(/upload a syllabus to enable creating modules and items/i)).toBeInTheDocument();

    const goToSyllabusBtn = screen.getByRole('button', { name: 'Go to Syllabus' });
    expect(goToSyllabusBtn).toBeInTheDocument();
    fireEvent.click(goToSyllabusBtn);
  });

  test('gates assessments when no syllabus exists and displays syllabus required card', () => {
    mockCourseSyllabus = null;
    render(<CoursesPage initialSubTab="assessments" />);

    const gate = screen.getByTestId('assessments-syllabus-gate');
    expect(gate).toBeInTheDocument();
    expect(screen.getByText('Syllabus required for assessments')).toBeInTheDocument();
  });

  test('gates grades when no syllabus exists and displays syllabus required card', () => {
    mockCourseSyllabus = null;
    render(<CoursesPage initialSubTab="grades" />);

    const gate = screen.getByTestId('grades-syllabus-gate');
    expect(gate).toBeInTheDocument();
    expect(screen.getByText('Syllabus required for grades')).toBeInTheDocument();
    expect(screen.getByText(/upload a syllabus to enable the gradebook/i)).toBeInTheDocument();
  });

  test('renders SectionSelectionPage when initialSubTab is section-selection and course has sections', () => {
    mockSections = [
      { id: 'sec-1', courseId: 'c1', name: 'Section A', enrolledCount: 10, capacity: 40 },
      { id: 'sec-2', courseId: 'c1', name: 'Section B', enrolledCount: 15, capacity: 40 },
    ];
    render(<CoursesPage initialSubTab="section-selection" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Select your section' })).toBeInTheDocument();
    expect(screen.getByText('Section A')).toBeInTheDocument();
    expect(screen.getByText('Section B')).toBeInTheDocument();
  });

  test('falls back to modules when initialSubTab is section-selection but course has no sections', async () => {
    mockSections = [];
    render(<CoursesPage initialSubTab="section-selection" />);

    // Should redirect/fallback away from blank section-selection
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Modules' })).toBeInTheDocument();
    });
  });

  test('falls back to modules when initialSubTab is an unrecognized sub-tab', async () => {
    mockSections = [];
    render(<CoursesPage initialSubTab="unknown-subtab" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Modules' })).toBeInTheDocument();
    });
  });
});
