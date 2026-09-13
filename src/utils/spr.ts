// src/utils/spr.ts
import type {
  Activity,
  Assignment,
  Quiz,
  SPRColumn,
  SPRWeights,
  Submission,
} from '../types/lms';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveSPRWeights(
  _syllabusGrading: { termFormula?: string; finalFormula?: string } | null | undefined,
): SPRWeights {
  return {
    csWeight: 60,
    examWeight: 40,
    mtWeight: 40,
    ftWeight: 60,
    formulaLabel: 'Term 60% CS + 40% Exam · Final 40% MT + 60% FT',
  };
}

export function classStandingPercent(scores: Array<number | null>, perfects: number[]): number {
  const totalPerfect = perfects.reduce((sum, p) => sum + p, 0);
  if (totalPerfect <= 0) return 0;
  const earned = perfects.reduce((sum, perfect, i) => {
    const s = scores[i] ?? 0;
    return sum + Math.min(Math.max(s, 0), perfect);
  }, 0);
  return (earned / totalPerfect) * 100;
}

export function termGrade(
  csPercent: number,
  examScore: number | null,
  examPerfect: number,
  w: SPRWeights,
): number | null {
  if (examScore === null || examPerfect <= 0) return null;
  return round2((csPercent * w.csWeight + ((examScore / examPerfect) * 100 * w.examWeight)) / 100);
}

export function finalPercent(mt: number | null, ft: number | null, w: SPRWeights): number | null {
  if (mt === null || ft === null) return null;
  return round2((mt * w.mtWeight + ft * w.ftWeight) / 100);
}

function quizPointsPossible(quiz: Quiz): number {
  return quiz.questions.reduce((sum, q) => sum + (q.points ?? 0), 0);
}

export function autoScoreFraction(args: {
  column: SPRColumn;
  studentId: string;
  submissions: Submission[];
  assignments: Assignment[];
  activities: Activity[];
  quizzes: Quiz[];
}): number | null {
  const { column, studentId, submissions, assignments, activities, quizzes } = args;
  const link = column.linkedSource;
  if (!link) return null;

  let assignmentKey: string;
  let divisor: number;
  if (link.kind === 'assignment') {
    const source = assignments.find((a) => a.id === link.sourceId);
    if (!source) return null;
    if (typeof source.pointsPossible !== 'number' || source.pointsPossible <= 0) return null;
    assignmentKey = link.sourceId;
    divisor = source.pointsPossible;
  } else if (link.kind === 'activity') {
    const source = activities.find((a) => a.id === link.sourceId);
    if (!source) return null;
    if (typeof source.pointsPossible !== 'number' || source.pointsPossible <= 0) return null;
    assignmentKey = `asg-activity-${link.sourceId}`;
    divisor = 100;
  } else {
    const source = quizzes.find((q) => q.id === link.sourceId);
    if (!source) return null;
    if (quizPointsPossible(source) <= 0) return null;
    assignmentKey = `asg-quiz-${link.sourceId}`;
    divisor = 100;
  }

  const candidates = submissions.filter(
    (s) =>
      s.studentId === studentId &&
      s.assignmentId === assignmentKey &&
      s.status === 'graded' &&
      typeof s.grade === 'number' &&
      !Number.isNaN(s.grade),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const ka = a.gradedAt ?? a.submittedAt ?? '';
    const kb = b.gradedAt ?? b.submittedAt ?? '';
    if (kb > ka) return 1;
    if (kb < ka) return -1;
    return 0;
  });
  const grade = candidates[0].grade as number;
  const fraction = grade / divisor;
  return Math.min(Math.max(fraction, 0), 1);
}
