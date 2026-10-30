// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  activeSpeedGraderSubmissionId: 'sub-1' as string,
  users: [] as any[],
  submissions: [] as any[],
}));

vi.mock('../../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: { id: 'fac-1', role: 'faculty', name: 'Faculty' },
    activeRole: 'faculty',
    activeSpeedGraderSubmissionId: mocks.activeSpeedGraderSubmissionId,
    openSpeedGrader: vi.fn(),
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

  test('falls back to Unknown student when neither the directory nor the row has a name', () => {
    // A raw user id stored in place of a name is not a usable label.
    mocks.users = [];
    mocks.submissions = [{ ...baseSubmission, studentName: 'usr-directory-1' }];

    render(<SpeedGraderModal />);

    const trigger = screen.getByTestId('speedgrader-student-picker-trigger');
    expect(trigger.textContent).toContain('1. Unknown student');
  });
});
