// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

let mockLmsState: any = {
  db: {
    messages: [],
    courses: [{ id: 'c1', code: 'CS101', title: 'Intro CS', color: '#3b82f6', instructorId: 'u1' }],
    users: [{ id: 'u1', name: 'Instructor', role: 'faculty' }],
    activities: [],
    quizzes: [],
    exams: [],
    submissions: [],
    courseSections: [],
    enrollmentRequests: [],
  },
  activeCourseId: 'c1',
  activeRole: 'faculty',
  activeUser: { id: 'u1', name: 'Instructor', enrolledCourseIds: ['c1'] },
  colleges: [],
  departments: [],
  getUnreadNotificationCount: () => 0,
};

vi.mock('../../context/LMSContext', () => ({
  useLMS: () => mockLmsState,
}));

import { LMSContextPanel } from './LMSContextPanel';

describe('LMSContextPanel Collapsible Assessments', () => {
  test('renders Assessments item and reveals sub-items on click', () => {
    const onSelectCourseTab = vi.fn();
    const { rerender } = render(
      <LMSContextPanel
        currentTab="courses"
        courseSubTab="modules"
        onNavigateTab={() => {}}
        onSelectCourseTab={onSelectCourseTab}
        onNavigateCourse={() => {}}
      />
    );

    const assessmentsBtn = screen.getByRole('button', { name: /Assessments/i });
    expect(assessmentsBtn).toBeDefined();

    // Click Assessments button
    fireEvent.click(assessmentsBtn);
    expect(onSelectCourseTab).toHaveBeenCalledWith('assessments');

    // Sub-items should be present
    expect(screen.getByText('Activities')).toBeDefined();
    expect(screen.getByText('Quizzes')).toBeDefined();
    expect(screen.getByText('Assignments')).toBeDefined();
    expect(screen.getByText('Projects')).toBeDefined();
    expect(screen.getByText('Presentations')).toBeDefined();
    expect(screen.getByText('Exams')).toBeDefined();

    // Click Assignments sub-item
    const assignmentsBtn = screen.getByRole('button', { name: /Assignments/i });
    fireEvent.click(assignmentsBtn);
    expect(onSelectCourseTab).toHaveBeenCalledWith('assignments');
  });

  test('does not violate rules of hooks when switching between dashboard and courses tabs', () => {
    const { rerender } = render(
      <LMSContextPanel
        currentTab="dashboard"
        courseSubTab="modules"
        onNavigateTab={() => {}}
        onSelectCourseTab={() => {}}
        onNavigateCourse={() => {}}
      />
    );

    rerender(
      <LMSContextPanel
        currentTab="courses"
        courseSubTab="modules"
        onNavigateTab={() => {}}
        onSelectCourseTab={() => {}}
        onNavigateCourse={() => {}}
      />
    );

    expect(screen.getByText('CS101')).toBeDefined();
  });

  test('does not violate rules of hooks when switching from non-LMS governance tab to courses tab', () => {
    const errorSpy = vi.spyOn(console, 'error');

    const { rerender, container } = render(
      <LMSContextPanel
        currentTab="governance"
        courseSubTab="modules"
        onNavigateTab={() => {}}
        onSelectCourseTab={() => {}}
        onNavigateCourse={() => {}}
      />
    );

    // Non-LMS tab returns null
    expect(container.firstChild).toBeNull();

    // Navigate to courses tab
    rerender(
      <LMSContextPanel
        currentTab="courses"
        courseSubTab="modules"
        onNavigateTab={() => {}}
        onSelectCourseTab={() => {}}
        onNavigateCourse={() => {}}
      />
    );

    expect(screen.getByText('CS101')).toBeDefined();

    // Navigate to accounts tab
    rerender(
      <LMSContextPanel
        currentTab="accounts"
        courseSubTab="modules"
        onNavigateTab={() => {}}
        onSelectCourseTab={() => {}}
        onNavigateCourse={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();

    const hookErrors = errorSpy.mock.calls.filter(call =>
      call.some(arg => typeof arg === 'string' && (arg.includes('Rules of Hooks') || arg.includes('order of Hooks')))
    );
    expect(hookErrors).toHaveLength(0);

    errorSpy.mockRestore();
  });

  test('does not display Course Navigation when faculty has not created any courses yet', () => {
    mockLmsState = {
      db: {
        messages: [],
        courses: [{ id: 'c1', code: 'CS101', title: 'Intro CS', color: '#3b82f6', instructorId: 'u_other' }],
        users: [
          { id: 'u1', name: 'Eleanor', role: 'faculty' },
          { id: 'u_other', name: 'Other Instructor', role: 'faculty' },
        ],
        activities: [],
        quizzes: [],
        exams: [],
        submissions: [],
        courseSections: [],
        enrollmentRequests: [],
      },
      activeCourseId: 'c1',
      activeRole: 'faculty',
      activeUser: { id: 'u1', name: 'Eleanor', role: 'faculty' },
      colleges: [],
      departments: [],
      getUnreadNotificationCount: () => 0,
    };

    render(
      <LMSContextPanel
        currentTab="courses"
        courseSubTab="modules"
        onNavigateTab={() => {}}
        onSelectCourseTab={() => {}}
        onNavigateCourse={() => {}}
      />
    );

    // Learning Management should be visible without the Courses button
    expect(screen.getByText('Learning Management')).toBeDefined();
    expect(screen.getByRole('button', { name: /Dashboard/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Courses$/i })).toBeNull();

    // Course Navigation header and course items should NOT be displayed
    expect(screen.queryByText('Course Navigation')).toBeNull();
    expect(screen.queryByText('CS101')).toBeNull();
    expect(screen.queryByRole('button', { name: /Modules/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Syllabus/i })).toBeNull();

    // Trail should reflect general courses page without sub-tab
    expect(screen.getByText('Trail: LMS > courses')).toBeDefined();
  });

  test('does not display Course Navigation when database has 0 courses', () => {
    mockLmsState = {
      db: {
        messages: [],
        courses: [],
        users: [{ id: 'u1', name: 'Eleanor', role: 'faculty' }],
        activities: [],
        quizzes: [],
        exams: [],
        submissions: [],
        courseSections: [],
        enrollmentRequests: [],
      },
      activeCourseId: null,
      activeRole: 'faculty',
      activeUser: { id: 'u1', name: 'Eleanor', role: 'faculty' },
      colleges: [],
      departments: [],
      getUnreadNotificationCount: () => 0,
    };

    render(
      <LMSContextPanel
        currentTab="courses"
        courseSubTab="modules"
        onNavigateTab={() => {}}
        onSelectCourseTab={() => {}}
        onNavigateCourse={() => {}}
      />
    );

    expect(screen.queryByText('Course Navigation')).toBeNull();
    expect(screen.getByText('Trail: LMS > courses')).toBeDefined();
  });
});

