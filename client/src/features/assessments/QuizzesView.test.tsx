// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  isSyncing: false,
  activeRole: 'faculty' as string,
  db: { quizzes: [], submissions: [] } as any,
  openSpeedGrader: vi.fn(),
  showAlert: vi.fn(),
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.activeRole,
    activeUser: { id: 'u-fac-1', name: 'Faculty', role: mocks.activeRole },
    db: mocks.db,
    isLoading: mocks.isLoading,
    isSyncing: mocks.isSyncing,
    recordQuizSubmission: vi.fn(),
    openSpeedGrader: mocks.openSpeedGrader,
    showAlert: mocks.showAlert,
  }),
}));

import { QuizzesView } from './QuizzesView';

const quizFixture = {
  id: 'qz-1',
  courseId: 'c1',
  title: 'Midterm Quiz',
  instructions: 'Answer all questions.',
  term: 'midterm',
  timeLimitMinutes: 30,
  questions: [
    {
      id: 'q1',
      text: 'What is 2 + 2?',
      type: 'multiple_choice',
      options: ['3', '4'],
      correctAnswer: '4',
      points: 5,
    },
  ],
};

function renderPage() {
  return render(
    <QuizzesView
      courseId="c1"
      selectedQuizId={null}
      onSelectQuiz={() => {}}
      onBackToModules={() => {}}
    />
  );
}

function renderRunner() {
  return render(
    <QuizzesView
      courseId="c1"
      selectedQuizId="qz-1"
      onSelectQuiz={() => {}}
      onBackToModules={() => {}}
    />
  );
}

describe('QuizzesView answer gating', () => {
  beforeEach(() => {
    mocks.activeRole = 'faculty';
    mocks.db = { quizzes: [quizFixture], submissions: [] } as any;
    vi.clearAllMocks();
  });
  test('instructor opens SpeedGrader when the quiz has submissions', () => {
    mocks.db = {
      quizzes: [quizFixture],
      submissions: [
        {
          id: 'sub-9',
          studentId: 'u-stu-1',
          quizId: 'qz-1',
          activityKey: 'asg-quiz-qz-1',
          courseId: 'c1',
          status: 'submitted',
          content: JSON.stringify({ q1: 'B' }),
        },
      ],
    } as any;
    renderRunner();
    expect(mocks.openSpeedGrader).toHaveBeenCalledWith('sub-9');
    expect(screen.queryByText(/assessment runner/i)).not.toBeInTheDocument();
  });

  test('instructor without submissions still gets the read-only preview', () => {
    renderRunner();
    expect(mocks.openSpeedGrader).not.toHaveBeenCalled();
    expect(screen.getByText(/only students can answer this assessment/i)).toBeInTheDocument();
  });

  test('faculty preview renders questions read-only with no submit path', () => {
    renderRunner();
    expect(screen.getByText('Midterm Quiz')).toBeInTheDocument();
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    screen.getAllByRole('radio').forEach(radio => expect(radio).toBeDisabled());
    expect(screen.queryByRole('button', { name: /submit assessment answers/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only students can answer this assessment/i)).toBeInTheDocument();
  });

  test('student can answer with enabled radios and a submit button', () => {
    mocks.activeRole = 'student';
    renderRunner();
    screen.getAllByRole('radio').forEach(radio => expect(radio).toBeEnabled());
    expect(screen.getByRole('button', { name: /submit assessment answers/i })).toBeInTheDocument();
  });
});

describe('QuizzesView refresh loading', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.activeRole = 'faculty';
    mocks.db = { quizzes: [], submissions: [] } as any;
  });

  test('shows loading skeleton (not empty text) while bootstrapping', () => {
    mocks.isLoading = true;
    renderPage();
    expect(screen.getByTestId('quizzes-loading')).toBeInTheDocument();
    expect(screen.queryByText(/no quizzes published/i)).not.toBeInTheDocument();
  });

  test('shows loading skeleton while background sync fills quizzes', () => {
    mocks.isSyncing = true;
    renderPage();
    expect(screen.getByTestId('quizzes-loading')).toBeInTheDocument();
  });

  test('shows empty state only once loading settles', () => {
    renderPage();
    expect(screen.getByText(/no quizzes published/i)).toBeInTheDocument();
    expect(screen.queryByTestId('quizzes-loading')).not.toBeInTheDocument();
  });
});

describe('QuizzesView one-shot submission lock', () => {
  const submittedFixture = {
    id: 'sub-1',
    studentId: 'u-fac-1',
    quizId: 'qz-1',
    activityKey: 'asg-quiz-qz-1',
    courseId: 'c1',
    status: 'submitted',
    content: JSON.stringify({ q1: 'B' }),
  };

  beforeEach(() => {
    mocks.activeRole = 'student';
    mocks.db = { quizzes: [quizFixture], submissions: [submittedFixture] } as any;
  });

  test('list shows View Answers instead of Retake/Take for a submitted quiz', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /view answers/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retake quiz/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /take quiz/i })).not.toBeInTheDocument();
  });

  test('deep-linking a submitted quiz opens the locked review, not the form', () => {
    renderRunner();
    expect(screen.getByText(/previously submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/answers are locked/i)).toBeInTheDocument();
    expect(screen.getByText(/your answer:/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit assessment answers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
