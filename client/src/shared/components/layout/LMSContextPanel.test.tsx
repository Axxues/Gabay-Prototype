// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../../context/LMSContext', () => ({
  useLMS: () => ({
    db: {
      messages: [],
      courses: [{ id: 'c1', code: 'CS101', title: 'Intro CS', color: '#3b82f6' }],
      activities: [],
      quizzes: [],
      exams: [],
      submissions: [],
      courseSections: [],
    },
    activeCourseId: 'c1',
    activeRole: 'faculty',
    activeUser: { id: 'u1', name: 'Instructor', enrolledCourseIds: ['c1'] },
    getUnreadNotificationCount: () => 0,
  }),
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
});
