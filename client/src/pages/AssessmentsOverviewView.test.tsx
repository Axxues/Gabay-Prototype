// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('../context/LMSContext', () => ({
  useLMS: () => ({
    db: {
      activities: [
        { id: '1', courseId: 'c1', title: 'Activity 1', format: 'classic', published: true, assessmentType: 'activity', pointsPossible: 20, term: 'midterm' },
        { id: '2', courseId: 'c1', title: 'Homework Assignment 1', format: 'classic', published: true, assessmentType: 'assignment', pointsPossible: 50, term: 'midterm' },
        { id: '3', courseId: 'c1', title: 'Capstone Project', format: 'classic', published: true, assessmentType: 'project', pointsPossible: 100, term: 'finals' },
        { id: '4', courseId: 'c1', title: 'Oral Presentation', format: 'classic', published: true, assessmentType: 'presentation', pointsPossible: 30, term: 'finals' },
      ],
      quizzes: [
        { id: 'q1', courseId: 'c1', title: 'Pop Quiz 1', published: true, questions: [{ points: 10 }], term: 'midterm' },
      ],
      exams: [
        { id: 'e1', courseId: 'c1', title: 'Midterm Exam', published: true, questions: [{ points: 50 }], term: 'midterm' },
      ],
      submissions: [],
    },
    activeRole: 'student',
    activeUser: { id: 'u-stu-1', name: 'Student One', role: 'student' },
    effectiveTermsForCourse: () => ['midterm', 'finals'],
  }),
}));

import { AssessmentsOverviewView } from './AssessmentsOverviewView';

describe('AssessmentsOverviewView', () => {
  test('renders metric cards and filters assessments by category', () => {
    const onNavigateCategory = vi.fn();
    render(
      <AssessmentsOverviewView
        courseId="c1"
        onNavigateCategory={onNavigateCategory}
      />
    );

    // Header & Metric cards
    expect(screen.getByText('Assessments Overview')).toBeDefined();
    expect(screen.getByText('Total Assessments')).toBeDefined();

    // Verify all assessments rendered initially
    expect(screen.getByText('Activity 1')).toBeDefined();
    expect(screen.getByText('Homework Assignment 1')).toBeDefined();
    expect(screen.getByText('Capstone Project')).toBeDefined();
    expect(screen.getByText('Oral Presentation')).toBeDefined();
    expect(screen.getByText('Pop Quiz 1')).toBeDefined();
    expect(screen.getByText('Midterm Exam')).toBeDefined();

    // Filter by Assignments pill
    const assignmentsFilter = screen.getByRole('button', { name: /^Assignments/i });
    fireEvent.click(assignmentsFilter);

    // Only assignment should be shown
    expect(screen.getByText('Homework Assignment 1')).toBeDefined();
    expect(screen.queryByText('Pop Quiz 1')).toBeNull();
    expect(screen.queryByText('Midterm Exam')).toBeNull();
  });
});
