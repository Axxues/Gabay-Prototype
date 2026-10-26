// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  db: {} as any,
  gradesReleased: {} as any,
}));

vi.mock('../../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: mocks.db,
    activeUser: { id: 'u-stu-1', name: 'Stu Dent' },
    markTabVisited: vi.fn(),
    effectiveTermsForCourse: () => ['midterm', 'finals'],
  }),
}));

import { StudentGradebook } from './StudentGradebook';

function baseDb() {
  return {
    courses: [{
      id: 'c1', code: 'CMSC 131', title: 'T', section: 'S',
      syllabus: { gradingSystem: null },
      gradesReleased: mocks.gradesReleased,
    }],
    users: [],
    activities: [],
    quizzes: [],
    submissions: [],
    exams: [],
  } as any;
}

describe('StudentGradebook release gating', () => {
  beforeEach(() => {
    mocks.gradesReleased = {};
    mocks.db = baseDb();
  });

  test('nothing released → locked empty state, no scores, no simulator', () => {
    mocks.db = baseDb();
    render(<StudentGradebook courseId="c1" />);
    expect(screen.getByText(/still not released/i)).toBeInTheDocument();
    expect(screen.queryByText(/what-if/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/simulator/i)).not.toBeInTheDocument();
  });

  test('partial release → released term visible, unreleased locked, no total', () => {
    mocks.gradesReleased = { midterm: true };
    mocks.db = baseDb();
    render(<StudentGradebook courseId="c1" />);
    expect(screen.getByText(/midterm period grade/i)).toBeInTheDocument();
    expect(screen.getByText(/not released/i)).toBeInTheDocument();
    expect(screen.queryByText(/calculated final course rating/i)).not.toBeInTheDocument();
  });

  test('full release → total and transmuted grade shown', () => {
    mocks.gradesReleased = { midterm: true, finals: true };
    mocks.db = baseDb();
    render(<StudentGradebook courseId="c1" />);
    expect(screen.getByText(/calculated final course rating/i)).toBeInTheDocument();
  });

  test('calculates official term grade using physical exam score when no digital exam exists in db.exams', () => {
    mocks.gradesReleased = { midterm: true, finals: false };
    const db = baseDb();
    db.exams = []; // Physical exam only - no digital exams!
    db.activities = [
      { id: 'a1', courseId: 'c1', format: 'classic', pointsPossible: 100, published: true, term: 'midterm' },
    ];
    db.submissions = [
      { id: 's1', activityKey: 'a1', courseId: 'c1', studentId: 'u-stu-1', grade: 100, status: 'graded' },
      { id: 's-exam', examId: 'exam-c1-midterm', activityKey: 'asg-exam-exam-c1-midterm', courseId: 'c1', studentId: 'u-stu-1', grade: 80, status: 'graded' },
    ];
    mocks.db = db;
    render(<StudentGradebook courseId="c1" />);
    // 60% of 100 (CS) + 40% of 80 (Exam) = 92%
    expect(screen.getByText('92%')).toBeInTheDocument();
  });
});
