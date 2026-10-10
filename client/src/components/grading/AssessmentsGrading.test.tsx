// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SpeedGraderModal } from './SpeedGraderModal';
import { buildAutoColumns, bucketColumnsByTerm, autoScoreFraction } from '../../utils/spr';
import type { Activity, Submission } from '../../types/lms';

const mockGradeSubmission = vi.fn().mockResolvedValue(undefined);
const mockOpenSpeedGrader = vi.fn();
const mockCloseSpeedGrader = vi.fn();

const mockCourse = {
  id: 'c1',
  code: 'CS101',
  title: 'Intro to Computer Science',
};

const mockProjectActivity: Activity = {
  id: 'proj-1',
  courseId: 'c1',
  title: 'Full Stack Capstone',
  term: 'midterm',
  pointsPossible: 100,
  published: true,
  format: 'classic',
  assessmentType: 'project',
  metadata: {
    groupMode: 'group',
    repositoryUrlRequired: true,
  },
  rubric: [
    {
      id: 'rubric-arch',
      title: 'Architecture & Code Quality',
      description: 'System modularity',
      points: 50,
      ratings: [
        { points: 50, description: 'Excellent' },
        { points: 25, description: 'Adequate' },
      ],
    },
    {
      id: 'rubric-ui',
      title: 'UI & UX Design',
      description: 'Responsiveness and polish',
      points: 50,
      ratings: [
        { points: 50, description: 'Polished' },
        { points: 20, description: 'Basic' },
      ],
    },
  ],
};

const mockSubmission: Submission = {
  id: 'sub-1',
  courseId: 'c1',
  studentId: 'stud-1',
  studentName: 'Alice Developer',
  activityKey: 'proj-1',
  activityId: 'proj-1',
  submissionType: 'online_text',
  content: 'Repository: https://github.com/alice/capstone\nDemo: https://capstone-demo.com\nImplemented auth and dashboard.',
  status: 'submitted',
  grade: null,
  submittedAt: new Date().toISOString(),
};

vi.mock('../../context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: { id: 'prof-1', role: 'faculty', name: 'Dr. Professor' },
    activeRole: 'faculty',
    activeSpeedGraderSubmissionId: 'sub-1',
    openSpeedGrader: mockOpenSpeedGrader,
    closeSpeedGrader: mockCloseSpeedGrader,
    gradeSubmission: mockGradeSubmission,
    db: {
      courses: [mockCourse],
      activities: [mockProjectActivity],
      quizzes: [],
      exams: [],
      submissions: [mockSubmission],
      users: [],
    },
    showAlert: vi.fn(),
  }),
}));

describe('AssessmentsGrading integration tests', () => {
  test('SpeedGraderModal displays project badge and clickable external links', () => {
    render(<SpeedGraderModal />);

    // Title and Course Code
    expect(screen.getByText('Full Stack Capstone')).toBeDefined();
    expect(screen.getByText('(CS101)')).toBeDefined();

    // Assessment type badge
    expect(screen.getByText('project')).toBeDefined();

    // Links parsed from content
    expect(screen.getByText('Repository:')).toBeDefined();
    expect(screen.getByText('https://github.com/alice/capstone')).toBeDefined();
    expect(screen.getByText('Demo:')).toBeDefined();
    expect(screen.getByText('https://capstone-demo.com')).toBeDefined();
  });

  test('SpeedGraderModal calculates score from rubric rating selection', () => {
    render(<SpeedGraderModal />);

    // Click rubric rating
    const excellentBtn = screen.getByText('Excellent');
    fireEvent.click(excellentBtn);

    const polishedBtn = screen.getByText('Polished');
    fireEvent.click(polishedBtn);

    // Score input should reflect 100
    const scoreInput = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(scoreInput.value).toBe('100');
  });

  test('Gradebook buildAutoColumns & bucketColumnsByTerm support new assessment types', () => {
    const assignmentActivity: Activity = {
      id: 'asg-1',
      courseId: 'c1',
      title: 'Written Report',
      term: 'prelim',
      pointsPossible: 50,
      published: true,
      format: 'classic',
      assessmentType: 'assignment',
    };

    const presentationActivity: Activity = {
      id: 'pres-1',
      courseId: 'c1',
      title: 'Oral Presentation',
      term: 'finals',
      pointsPossible: 100,
      published: true,
      format: 'classic',
      assessmentType: 'presentation',
    };

    const allActivities = [mockProjectActivity, assignmentActivity, presentationActivity];

    // Build auto columns
    const columns = buildAutoColumns('c1', {
      activities: allActivities,
      quizzes: [],
    });

    expect(columns).toHaveLength(3);
    expect(columns.map(c => c.title)).toEqual([
      'Full Stack Capstone',
      'Written Report',
      'Oral Presentation',
    ]);

    // Bucket into terms
    const bucketing = bucketColumnsByTerm(
      columns,
      { activities: allActivities, quizzes: [] },
      ['prelim', 'midterm', 'finals']
    );

    expect(bucketing.columnsByTerm.prelim.map(c => c.title)).toContain('Written Report');
    expect(bucketing.columnsByTerm.midterm.map(c => c.title)).toContain('Full Stack Capstone');
    expect(bucketing.columnsByTerm.finals.map(c => c.title)).toContain('Oral Presentation');

    // Test score fraction calculation
    const gradedSubmission: Submission = {
      id: 'sub-2',
      studentId: 'stud-1',
      courseId: 'c1',
      activityKey: 'asg-1',
      activityId: 'asg-1',
      status: 'graded',
      grade: 45,
      submittedAt: new Date().toISOString(),
    };

    const asgCol = columns.find(c => c.linkedSource?.sourceId === 'asg-1')!;
    const fraction = autoScoreFraction({
      column: asgCol,
      studentId: 'stud-1',
      submissions: [gradedSubmission],
      activities: allActivities,
      quizzes: [],
    });

    expect(fraction).toBe(45 / 50); // 0.9
  });
});
