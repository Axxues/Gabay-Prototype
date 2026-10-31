// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  activeSpeedGraderSubmissionId: 'sub-1' as string,
  users: [] as any[],
  submissions: [] as any[],
  openSpeedGrader: vi.fn(),
}));

vi.mock('../../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: { id: 'fac-1', role: 'faculty', name: 'Faculty' },
    activeRole: 'faculty',
    activeSpeedGraderSubmissionId: mocks.activeSpeedGraderSubmissionId,
    openSpeedGrader: mocks.openSpeedGrader,
    closeSpeedGrader: vi.fn(),
    gradeSubmission: vi.fn(),
    db: {
      courses: [{ id: 'c1', code: 'CS101', title: 'Intro to CS' }],
      activities: [
        {
          id: 'act-1',
          courseId: 'c1',
          title: 'Activity 1 (File Upload)',
          term: 'midterm',
          pointsPossible: 20,
          published: true,
          format: 'classic',
          assessmentType: 'activity',
          rubric: [],
        },
        {
          id: 'act-qs',
          courseId: 'c1',
          title: 'Activity 5 (new Question Set)',
          term: 'midterm',
          pointsPossible: 5,
          published: true,
          format: 'questionset',
          assessmentType: 'activity',
          rubric: [],
          questions: [
            { id: 'q-1', text: 'Q1 prompt', type: 'multiple_choice', points: 1 },
          ],
        },
      ],
      quizzes: [],
      exams: [],
      users: mocks.users,
      submissions: mocks.submissions,
    },
    showAlert: vi.fn(),
  }),
}));

import { SpeedGraderModal } from './SpeedGraderModal';

const baseSubmission = {
  id: 'sub-1',
  courseId: 'c1',
  studentId: 'usr-directory-1',
  // Submission rows are written without an expanded `student` relation, so the
  // name is blank in production.
  studentName: '',
  activityKey: 'act-1',
  activityId: 'act-1',
  submissionType: 'file',
  fileName: 'report.pdf',
  fileUrl: '/likha/assets/report',
  status: 'submitted',
  submittedAt: new Date().toISOString(),
  rubricScores: {},
  comments: [],
};

describe('SpeedGrader student name', () => {
  beforeEach(() => {
    mocks.activeSpeedGraderSubmissionId = 'sub-1';
    mocks.users = [{ id: 'usr-directory-1', name: 'Maria Santos', role: 'student' }];
    mocks.submissions = [{ ...baseSubmission }];
  });

  test('resolves the name from the user directory when the submission has none', () => {
    render(<SpeedGraderModal />);

    const trigger = screen.getByTestId('speedgrader-student-picker-trigger');
    expect(trigger.textContent).toContain('1. Maria Santos');
    expect(screen.getByText('Maria Santos (usr-directory-1)')).toBeInTheDocument();
  });

  test('renders question-set answers carried in the submission content map', () => {
    mocks.submissions = [
      {
        ...baseSubmission,
        activityKey: 'asg-activity-act-qs',
        activityId: 'act-qs',
        submissionType: 'online_text',
        fileName: undefined,
        fileUrl: undefined,
        content: JSON.stringify({ 'q-1': 'My answer' }),
      },
    ];

    render(<SpeedGraderModal />);

    expect(screen.getByText('My answer')).toBeInTheDocument();
    expect(screen.queryByText('No submission content')).not.toBeInTheDocument();
  });

  test('falls back to Unknown student when neither the directory nor the row has a name', () => {
    // A raw user id stored in place of a name is not a usable label.
    mocks.users = [];
    mocks.submissions = [{ ...baseSubmission, studentName: 'usr-directory-1' }];

    render(<SpeedGraderModal />);

    const trigger = screen.getByTestId('speedgrader-student-picker-trigger');
    expect(trigger.textContent).toContain('1. Unknown student');
  });

  test('navigates smoothly to next student via arrow button and keyboard', () => {
    mocks.users = [
      { id: 'usr-1', name: 'Student One', role: 'student' },
      { id: 'usr-2', name: 'Student Two', role: 'student' },
    ];
    mocks.submissions = [
      { ...baseSubmission, id: 'sub-1', studentId: 'usr-1' },
      { ...baseSubmission, id: 'sub-2', studentId: 'usr-2' },
    ];

    const { rerender } = render(<SpeedGraderModal />);

    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Student One (usr-1)')).toBeInTheDocument();

    // Trigger keyboard ArrowRight
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(mocks.openSpeedGrader).toHaveBeenCalledWith('sub-2');

    // Simulate state update from openSpeedGrader
    mocks.activeSpeedGraderSubmissionId = 'sub-2';
    rerender(<SpeedGraderModal />);

    // Shell remains stable, content reflects student two
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Student Two (usr-2)')).toBeInTheDocument();
  });
});
