// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeCourseId: 'c1',
    setActiveCourseId: vi.fn(),
    db: {
      courses: [
        {
          id: 'c1',
          code: 'CS 101',
          title: 'Introduction to Computer Science',
          published: true,
          syllabus: null,
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
    },
    activeRole: 'student',
    activeUser: { id: 'u1', enrolledCourseIds: ['c1'] },
    getUnreadNotificationCount: () => 0,
    markTabVisited: vi.fn(),
    isCourseGradeReady: () => false,
  }),
}));

import { CoursesPage } from './CoursesPage';

describe('CoursesPage sub-tab lazy loading and suspense', () => {
  test('renders sub-tab navigation and resolves lazy-loaded sub-view', async () => {
    render(<CoursesPage initialSubTab="modules" />);

    // Header buttons should be present
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.getByText('Syllabus')).toBeInTheDocument();

    // Resolves modules view after lazy import
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Modules' })).toBeInTheDocument();
      expect(screen.getByText('No modules available for this course section yet.')).toBeInTheDocument();
    });
  });
});
