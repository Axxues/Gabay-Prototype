// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  activeSpeedGraderSubmissionId: 'sub-qs-1' as string,
  users: [{ id: 'usr-stud-1', name: 'Student Scholar 1', role: 'student' }] as any[],
  submissions: [] as any[],
  gradeSubmission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: { id: 'fac-1', role: 'faculty', name: 'Faculty Professor' },
    activeRole: 'faculty',
    activeSpeedGraderSubmissionId: mocks.activeSpeedGraderSubmissionId,
    openSpeedGrader: vi.fn(),
    closeSpeedGrader: vi.fn(),
    gradeSubmission: mocks.gradeSubmission,
    db: {
      courses: [{ id: 'c1', code: 'CSPC 112', title: 'Software Engineering 2' }],
      activities: [
        {
          id: 'act-qs-5',
          courseId: 'c1',
          title: 'Activity 5 (new Question Set)',
          term: 'finals',
          pointsPossible: 5,
          published: true,
          format: 'questionset',
          assessmentType: 'activity',
          rubric: [],
          questions: [
            {
              id: 'q-1',
              text: 'Is testing essential?',
              type: 'multiple_choice',
              points: 1,
              correctAnswer: 'Yes',
              options: ['Yes', 'No', 'Maybe'],
            },
            {
              id: 'q-2',
              text: 'Capital of France?',
              type: 'identification',
              points: 1,
              correctAnswer: 'Paris',
            },
            {
              id: 'q-3',
              text: 'TypeScript is typed JavaScript',
              type: 'true_false',
              points: 1,
              correctAnswer: 'True',
              options: ['True', 'False'],
            },
            {
              id: 'q-4',
              text: 'Explain React hooks lifecycle.',
              type: 'essay',
              points: 2,
              correctAnswer: '',
            },
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

describe('SpeedGrader Question Set Grading & Correction', () => {
  beforeEach(() => {
    mocks.activeSpeedGraderSubmissionId = 'sub-qs-1';
    mocks.gradeSubmission.mockClear();
    mocks.submissions = [
      {
        id: 'sub-qs-1',
        courseId: 'c1',
        studentId: 'usr-stud-1',
        studentName: 'Student Scholar 1',
        activityKey: 'asg-activity-act-qs-5',
        activityId: 'act-qs-5',
        submissionType: 'online_text',
        status: 'submitted',
        submittedAt: '2026-10-31T08:46:37.000Z',
        content: JSON.stringify({
          'q-1': 'No', // Auto: Incorrect (Key: Yes)
          'q-2': 'paris', // Auto: Correct (Key: Paris)
          'q-3': 'True', // Auto: Correct (Key: True)
          'q-4': 'Hooks allow functional components to use state.', // Essay (needs manual review)
        }),
        comments: [],
      },
    ];
  });

  test('renders all questions, prompts, student answers, and initial auto-grades', () => {
    render(<SpeedGraderModal />);

    // Questions rendered
    expect(screen.getByText(/Is testing essential\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Capital of France\?/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript is typed JavaScript/i)).toBeInTheDocument();
    expect(screen.getByText(/Explain React hooks lifecycle/i)).toBeInTheDocument();

    // Student answers rendered
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('paris')).toBeInTheDocument();
    expect(screen.getByText('Hooks allow functional components to use state.')).toBeInTheDocument();

    // Auto-grade calculation: Q2 (1 pt) + Q3 (1 pt) = 2 pts initial total
    const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
    expect((gradeInput as HTMLInputElement).value).toBe('2');
  });

  test('allows faculty to correct an auto-graded question and updates total score', async () => {
    render(<SpeedGraderModal />);

    // Q1 was answered 'No' (key: 'Yes'). Faculty wants to mark Q1 as Correct.
    const q1CorrectBtn = screen.getByTestId('question-correct-btn-q-1');
    fireEvent.click(q1CorrectBtn);

    // Q1 is now awarded 1 pt instead of 0. Total score should increase from 2 to 3.
    const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
    expect((gradeInput as HTMLInputElement).value).toBe('3');

    // Overridden badge appears
    expect(screen.getByTestId('question-overridden-badge-q-1')).toBeInTheDocument();
  });

  test('allows faculty to grade essay questions and awards custom points', async () => {
    render(<SpeedGraderModal />);

    // Q4 is an essay worth 2 pts. Faculty awards 2 points.
    const q4Input = screen.getByTestId('question-score-input-q-4');
    fireEvent.change(q4Input, { target: { value: '2' } });

    // Total should be 2 (initial Q2+Q3) + 2 (essay) = 4
    const gradeInput = screen.getByRole('spinbutton', { name: /grade/i });
    expect((gradeInput as HTMLInputElement).value).toBe('4');
  });

  test('submits final grade and question scores when saved', async () => {
    render(<SpeedGraderModal />);

    // Award full points for essay Q4
    const q4CorrectBtn = screen.getByTestId('question-correct-btn-q-4');
    fireEvent.click(q4CorrectBtn);

    // Save final grade
    const submitBtn = screen.getByRole('button', { name: /submit final grade/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mocks.gradeSubmission).toHaveBeenCalledTimes(1);
      expect(mocks.gradeSubmission).toHaveBeenCalledWith(
        'sub-qs-1',
        4, // Q2 (1) + Q3 (1) + Q4 (2)
        expect.objectContaining({
          'q-1': 0,
          'q-2': 1,
          'q-3': 1,
          'q-4': 2,
        }),
        undefined
      );
    });
  });

  test('falls back to answers array when content string is empty/null', () => {
    mocks.submissions = [
      {
        id: 'sub-qs-1',
        courseId: 'c1',
        studentId: 'usr-stud-1',
        studentName: 'Student Scholar 1',
        activityKey: 'asg-activity-act-qs-5',
        activityId: 'act-qs-5',
        submissionType: 'online_text',
        status: 'submitted',
        submittedAt: '2026-10-31T08:46:37.000Z',
        content: null,
        answers: [
          { questionId: 'q-1', answer: 'Yes' },
          { questionId: 'q-2', answer: 'Paris' },
        ],
        comments: [],
      },
    ];

    render(<SpeedGraderModal />);

    expect(screen.queryByText('No submission content')).not.toBeInTheDocument();
    expect(screen.getByText(/Is testing essential\?/i)).toBeInTheDocument();
    expect(screen.getAllByText('Yes').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Paris').length).toBeGreaterThanOrEqual(1);
  });
});
