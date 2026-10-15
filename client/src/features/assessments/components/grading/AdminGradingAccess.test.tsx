// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SpeedGraderModal } from './SpeedGraderModal';
import type { Activity, Submission } from '../../../../shared/types/lms';

const mockGradeSubmission = vi.fn().mockResolvedValue(undefined);
const mockOpenSpeedGrader = vi.fn();
const mockCloseSpeedGrader = vi.fn();

const mockCourse = {
  id: 'c1',
  code: 'CS101',
  title: 'Intro to Computer Science',
};

const mockActivity: Activity = {
  id: 'act-1',
  courseId: 'c1',
  title: 'Advisee Midterm Lab',
  term: 'midterm',
  pointsPossible: 100,
  published: true,
  format: 'classic',
  assessmentType: 'activity',
  rubric: [
    {
      id: 'rubric-1',
      title: 'Implementation',
      description: 'Lab requirements',
      points: 100,
      ratings: [
        { points: 100, description: 'Complete' },
        { points: 50, description: 'Partial' },
      ],
    },
  ],
};

const mockSubmission: Submission = {
  id: 'sub-advisee-1',
  courseId: 'c1',
  studentId: 'stud-advisee-1',
  studentName: 'Advisee Student',
  activityKey: 'act-1',
  activityId: 'act-1',
  submissionType: 'online_text',
  content: 'Lab solution report by advisee student',
  status: 'submitted',
  grade: null,
  submittedAt: new Date().toISOString(),
};

vi.mock('../../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: { id: 'admin-1', role: 'admin', name: 'Dean Admin' },
    activeRole: 'admin',
    activeSpeedGraderSubmissionId: 'sub-advisee-1',
    openSpeedGrader: mockOpenSpeedGrader,
    closeSpeedGrader: mockCloseSpeedGrader,
    gradeSubmission: mockGradeSubmission,
    db: {
      courses: [mockCourse],
      activities: [mockActivity],
      quizzes: [],
      exams: [],
      submissions: [mockSubmission],
      users: [],
    },
    showAlert: vi.fn(),
  }),
}));

describe('Admin SpeedGrader Access', () => {
  test('Admin has full faculty grading access in SpeedGrader and is not locked in read-only audit mode', async () => {
    render(<SpeedGraderModal />);

    // Must NOT show the read-only audit lock banner
    expect(screen.queryByText(/SpeedGrader is in read-only audit mode for administrators/i)).toBeNull();

    // Must render the submit grade button
    const submitBtn = screen.getByRole('button', { name: /Submit Final Grade & Feedback/i });
    expect(submitBtn).toBeDefined();

    // Rubric button must be clickable and update the grade input
    const completeRating = screen.getByRole('button', { name: /Complete/i });
    expect(completeRating).not.toHaveProperty('disabled', true);
    fireEvent.click(completeRating);

    const scoreInput = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(scoreInput.disabled).toBe(false);
    expect(scoreInput.value).toBe('100');

    // Admin can submit the final grade
    fireEvent.click(submitBtn);
    expect(mockGradeSubmission).toHaveBeenCalledWith(
      'sub-advisee-1',
      100,
      { 'rubric-1': 100 },
      undefined
    );
  });
});
