// src/utils/spr.test.ts
import { describe, expect, it } from 'vitest';
import {
  autoScoreFraction,
  buildAutoColumns,
  classStandingPercent,
  finalPercent,
  resolveSPRWeights,
  resolveExamScore,
  round2,
  termGrade,
} from './spr';
import type {
  Activity,
  Assignment,
  Exam,
  Quiz,
  SPRColumn,
  Submission,
} from '../types/lms';

function baseWeights() {
  return resolveSPRWeights(null);
}

function makeSubmission(over: Partial<Submission> & { assignmentId: string; studentId: string }): Submission {
  return {
    id: 'sub-1',
    courseId: 'c1',
    studentName: 'S',
    studentAvatar: '',
    submittedAt: '2026-01-01T00:00:00.000Z',
    submissionType: 'online_text',
    status: 'graded',
    rubricScores: {},
    comments: [],
    ...over,
  } as Submission;
}

function makeAssignment(over: Partial<Assignment> & { id: string }): Assignment {
  return {
    courseId: 'c1',
    title: 'A',
    instructions: '',
    pointsPossible: 100,
    dueDate: '2026-01-01',
    submissionTypes: ['online_text'],
    published: true,
    category: 'x',
    weight: 0,
    rubric: [],
    ...over,
  } as Assignment;
}

describe('resolveSPRWeights', () => {
  it('returns term 60/40 + final 40/60 defaults', () => {
    expect(baseWeights()).toEqual({
      csWeight: 60,
      examWeight: 40,
      mtWeight: 40,
      ftWeight: 60,
      formulaLabel: 'Term 60% CS + 40% Exam · Final 40% MT + 60% FT',
    });
  });
  it('parses 70/30 term + 50/50 final from syllabus strings', () => {
    const w = resolveSPRWeights({ termFormula: 'Term = 70% Class Standing + 30% Exam', finalFormula: 'Final = 50% Midterm + 50% Final Term' });
    expect(w.csWeight).toBe(70);
    expect(w.examWeight).toBe(30);
    expect(w.mtWeight).toBe(50);
    expect(w.ftWeight).toBe(50);
    expect(w.parseError).toBeFalsy();
  });
  it('flags unparseable formula instead of silent fallback', () => {
    const w = resolveSPRWeights({ termFormula: 'grades are vibes', finalFormula: '' });
    expect(w.parseError).toBe(true);
  });
});

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(81.333333)).toBe(81.33);
    expect(round2(81.2)).toBe(81.2);
    expect(round2(2.345)).toBe(2.35);
  });
});

describe('classStandingPercent', () => {
  it('treats blanks as zero', () => {
    expect(classStandingPercent([30, null, 7], [30, 100, 10])).toBeCloseTo((37 / 140) * 100, 5);
  });
  it('caps scores at perfect and floors negatives at zero', () => {
    expect(classStandingPercent([200, -5], [100, 50])).toBeCloseTo((100 / 150) * 100, 5);
  });
  it('returns 0 when total perfect is zero or inputs are empty', () => {
    expect(classStandingPercent([], [])).toBe(0);
    expect(classStandingPercent([10], [0])).toBe(0);
    expect(classStandingPercent([10, 20], [0, -5])).toBe(0);
  });
});

describe('termGrade', () => {
  it('applies 60% CS + 40% exam weighting', () => {
    const w = baseWeights();
    // 80 * 0.6 + 50 * 0.4 = 68
    expect(termGrade(80, 50, 100, w)).toBe(68);
  });
  it('converts raw exam points via examPerfect', () => {
    const w = baseWeights();
    // (80*60 + 50/60*100*40)/100 = 81.33
    expect(termGrade(80, 50, 60, w)).toBeCloseTo(81.33, 2);
  });
  it('returns null without an exam score or valid exam perfect', () => {
    const w = baseWeights();
    expect(termGrade(80, null, 100, w)).toBeNull();
    expect(termGrade(80, 50, 0, w)).toBeNull();
    expect(termGrade(80, 50, -10, w)).toBeNull();
  });
});

describe('finalPercent', () => {
  it('applies 40% MT + 60% FT weighting', () => {
    const w = baseWeights();
    expect(finalPercent(68, 90, w)).toBe(81.2);
  });
  it('returns null when either term is null', () => {
    const w = baseWeights();
    expect(finalPercent(68, null, w)).toBeNull();
    expect(finalPercent(null, 90, w)).toBeNull();
  });
});

describe('autoScoreFraction', () => {
  const col = (linkedSource?: SPRColumn['linkedSource']): SPRColumn => ({
    id: 'col-1',
    title: 'Q1',
    perfectScore: 100,
    linkedSource,
  });

  it('returns null when unlinked', () => {
    expect(
      autoScoreFraction({ column: col(), studentId: 's1', submissions: [], assignments: [], activities: [], quizzes: [] }),
    ).toBeNull();
  });

  it('scores assignment submissions as raw points fraction', () => {
    const assignments = [makeAssignment({ id: 'a1', pointsPossible: 50 })];
    const submissions = [makeSubmission({ assignmentId: 'a1', studentId: 's1', grade: 25 })];
    expect(
      autoScoreFraction({
        column: col({ kind: 'assignment', sourceId: 'a1' }),
        studentId: 's1',
        submissions,
        assignments,
        activities: [],
        quizzes: [],
      }),
    ).toBeCloseTo(0.5, 5);
  });

  it('scores quiz submissions as percent fraction', () => {
    const quizzes: Quiz[] = [{ id: 'q1', courseId: 'c1', title: 'Q', instructions: '', timeLimitMinutes: 10, published: true, questions: [{ id: 'qq1', text: 'Q', type: 'multiple_choice', points: 10 }] } as Quiz];
    const submissions = [makeSubmission({ assignmentId: 'asg-quiz-q1', studentId: 's1', grade: 80 })];
    expect(
      autoScoreFraction({
        column: col({ kind: 'quiz', sourceId: 'q1' }),
        studentId: 's1',
        submissions,
        assignments: [],
        activities: [],
        quizzes,
      }),
    ).toBeCloseTo(0.8, 5);
  });

  it('scores activity submissions as percent fraction', () => {
    const activities: Activity[] = [
      { id: 'act1', courseId: 'c1', title: 'Act', instructions: '', questions: [], pointsPossible: 20, published: true } as Activity,
    ];
    const submissions = [makeSubmission({ assignmentId: 'asg-activity-act1', studentId: 's1', grade: 90 })];
    expect(
      autoScoreFraction({
        column: col({ kind: 'activity', sourceId: 'act1' }),
        studentId: 's1',
        submissions,
        assignments: [],
        activities,
        quizzes: [],
      }),
    ).toBeCloseTo(0.9, 5);
  });

  it('picks the latest graded submission and ignores ungraded ones', () => {
    const assignments = [makeAssignment({ id: 'a1', pointsPossible: 100 })];
    const submissions = [
      makeSubmission({ id: 'old', assignmentId: 'a1', studentId: 's1', grade: 10, submittedAt: '2026-01-01T00:00:00.000Z', gradedAt: '2026-01-02T00:00:00.000Z' }),
      makeSubmission({ id: 'new', assignmentId: 'a1', studentId: 's1', grade: 70, submittedAt: '2026-02-01T00:00:00.000Z', gradedAt: '2026-02-02T00:00:00.000Z' }),
      makeSubmission({ id: 'ungraded', assignmentId: 'a1', studentId: 's1', submittedAt: '2026-03-01T00:00:00.000Z', status: 'submitted' }),
    ];
    expect(
      autoScoreFraction({
        column: col({ kind: 'assignment', sourceId: 'a1' }),
        studentId: 's1',
        submissions,
        assignments,
        activities: [],
        quizzes: [],
      }),
    ).toBeCloseTo(0.7, 5);
  });

  it('returns null when source is missing, has no points, or has no graded submission', () => {
    const args = { studentId: 's1', submissions: [] as Submission[], activities: [] as Activity[], quizzes: [] as Quiz[] };
    // missing source
    expect(autoScoreFraction({ ...args, column: col({ kind: 'assignment', sourceId: 'nope' }), assignments: [] })).toBeNull();
    // zero pointsPossible
    expect(
      autoScoreFraction({ ...args, column: col({ kind: 'assignment', sourceId: 'a1' }), assignments: [makeAssignment({ id: 'a1', pointsPossible: 0 })] }),
    ).toBeNull();
    // no graded submission
    expect(
      autoScoreFraction({
        ...args,
        column: col({ kind: 'assignment', sourceId: 'a1' }),
        assignments: [makeAssignment({ id: 'a1' })],
        submissions: [makeSubmission({ assignmentId: 'a1', studentId: 's1', status: 'submitted' })],
      }),
    ).toBeNull();
  });

  it('clamps fractions to 0..1', () => {
    const assignments = [makeAssignment({ id: 'a1', pointsPossible: 100 })];
    const over = [makeSubmission({ assignmentId: 'a1', studentId: 's1', grade: 500 })];
    const under = [makeSubmission({ assignmentId: 'a1', studentId: 's1', grade: -20 })];
    const colA = col({ kind: 'assignment', sourceId: 'a1' });
    expect(autoScoreFraction({ column: colA, studentId: 's1', submissions: over, assignments, activities: [], quizzes: [] })).toBe(1);
    expect(autoScoreFraction({ column: colA, studentId: 's1', submissions: under, assignments, activities: [], quizzes: [] })).toBe(0);
  });

  it('builds auto columns from published activities+quizzes, skipping drafts', () => {
    const cols = buildAutoColumns('c1', {
      activities: [{ id: 'a1', courseId: 'c1', title: 'Act', published: true, pointsPossible: 20 } as Activity],
      quizzes: [{ id: 'q1', courseId: 'c1', title: 'Q', published: true, questions: [{ points: 10 }] } as unknown as Quiz, { id: 'q2', courseId: 'c1', title: 'Draft', published: false, questions: [] } as unknown as Quiz],
    });
    expect(cols.map(c => c.linkedSource?.sourceId).sort()).toEqual(['a1', 'q1']);
  });
  it('builds an auto column for each published classic assignment', () => {
    const cols = buildAutoColumns('c1', {
      activities: [],
      quizzes: [],
      assignments: [
        makeAssignment({ id: 'asg1', courseId: 'c1', title: 'Lab 1', published: true, pointsPossible: 50 }),
        makeAssignment({ id: 'asg2', courseId: 'c1', title: 'Draft', published: false, pointsPossible: 50 }),
        makeAssignment({ id: 'asg3', courseId: 'other', title: 'Other course', published: true, pointsPossible: 50 }),
      ],
    });
    expect(cols.map(c => c.linkedSource)).toEqual([{ kind: 'assignment', sourceId: 'asg1' }]);
    expect(cols[0].title).toBe('Lab 1');
    expect(cols[0].perfectScore).toBe(50);
  });
  it('scores exam submissions as percent fraction', () => {
    const exams = [{ id: 'e1', courseId: 'c1', title: 'MT', published: true, term: 'midterm', questions: [{ points: 60 }] } as unknown as Exam];
    const subs = [makeSubmission({ assignmentId: 'asg-exam-e1', studentId: 's1', grade: 45 })];
    expect(autoScoreFraction({ column: col({ kind: 'exam', sourceId: 'e1' }), studentId: 's1', submissions: subs, assignments: [], activities: [], quizzes: [], exams })).toBeCloseTo(0.75, 5);
  });
  it('clamps exam raw scores to [0, perfect]', () => {
    const exams = [{ id: 'e1', courseId: 'c1', title: 'MT', published: true, term: 'midterm', questions: [{ points: 60 }] } as unknown as Exam];
    const over = [makeSubmission({ assignmentId: 'asg-exam-e1', studentId: 's1', grade: 500 })];
    expect(resolveExamScore('c1', 'midterm', 's1', { exams, submissions: over }).score).toBe(60);
  });
});

import { extractTermWeights, finalPercentTerms } from './spr';

describe('extractTermWeights', () => {
  it('parses 3-term weights from formula text', () => {
    const w = extractTermWeights(
      { termFormula: 'Prelim Grade 30%, Midterm Grade 30%', finalFormula: 'Final Grade = 60% class standing + 40% finals' },
      ['prelim', 'midterm', 'finals'],
    );
    expect(w.weights).toEqual({ prelim: 30, midterm: 30, finals: 40 });
    expect(w.defaulted).toBe(false);
  });
  it('keeps 2-term 40/60 behavior', () => {
    const w = extractTermWeights(
      { termFormula: 'Midterm Grade / Final Term Grade = 60% Class Standing + 40% ME / FE', finalFormula: 'Final Grade = 40% Midterm Grade + 60% Final Term Grade' },
      ['midterm', 'finals'],
    );
    expect(w.weights).toEqual({ midterm: 40, finals: 60 });
    expect(w.defaulted).toBe(false);
  });
  it('falls back to equal split with defaulted flag on garbage', () => {
    const w = extractTermWeights({ termFormula: 'see handbook', finalFormula: '' }, ['prelim', 'midterm', 'finals']);
    expect(w.weights).toEqual({ prelim: 33.33, midterm: 33.33, finals: 33.34 });
    expect(w.defaulted).toBe(true);
  });
});

describe('finalPercentTerms', () => {
  it('weights term grades; null term nulls the final', () => {
    expect(finalPercentTerms({ prelim: 80, midterm: 90, finals: 70 }, { prelim: 30, midterm: 30, finals: 40 })).toBeCloseTo(79, 2);
    expect(finalPercentTerms({ prelim: null, midterm: 90, finals: 70 }, { prelim: 30, midterm: 30, finals: 40 })).toBeNull();
  });
});
