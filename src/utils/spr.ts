// src/utils/spr.ts
import type {
  Activity,
  Assignment,
  Exam,
  Quiz,
  SPRColumn,
  SPRWeights,
  Submission,
} from '../types/lms';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveSPRWeights(
  syllabusGrading: { termFormula?: string; finalFormula?: string } | null | undefined,
): SPRWeights {
  const fallback = (): SPRWeights => ({ csWeight: 60, examWeight: 40, mtWeight: 40, ftWeight: 60, formulaLabel: 'Term 60% CS + 40% Exam · Final 40% MT + 60% FT', parseError: true });
  if (!syllabusGrading) return { csWeight: 60, examWeight: 40, mtWeight: 40, ftWeight: 60, formulaLabel: 'Term 60% CS + 40% Exam · Final 40% MT + 60% FT' };
  const term = syllabusGrading.termFormula ?? '';
  const fin = syllabusGrading.finalFormula ?? '';
  const nums = (s: string) => [...s.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map(m => Number(m[1]));
  const tn = nums(term), fn = nums(fin);
  const sumOk = (a: number[]) => a.length >= 2 && Math.abs(a[0] + a[1] - 100) < 0.01;
  // term: first % = class standing, second % = exam; final: first % = midterm, second % = final term
  if (!sumOk(tn) || !sumOk(fn)) return fallback();
  return { csWeight: tn[0], examWeight: tn[1], mtWeight: fn[0], ftWeight: fn[1], formulaLabel: `Term ${tn[0]}% CS + ${tn[1]}% Exam · Final ${fn[0]}% MT + ${fn[1]}% FT` };
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

export function buildAutoColumns(courseId: string, db: { activities?: Activity[]; quizzes: Quiz[] }): SPRColumn[] {
  const cols: SPRColumn[] = [];
  for (const a of db.activities ?? []) {
    if (a.courseId !== courseId || !a.published) continue;
    cols.push({ id: `auto-activity-${a.id}`, title: a.title, perfectScore: Math.max(1, a.pointsPossible || 0), linkedSource: { kind: 'activity', sourceId: a.id } });
  }
  for (const q of db.quizzes ?? []) {
    if (q.courseId !== courseId || !q.published) continue;
    const pts = q.questions.reduce((s, qq) => s + (qq.points ?? 0), 0);
    cols.push({ id: `auto-quiz-${q.id}`, title: q.title, perfectScore: Math.max(1, pts), linkedSource: { kind: 'quiz', sourceId: q.id } });
  }
  return cols;
}

export function autoScoreFraction(args: {
  column: SPRColumn;
  studentId: string;
  submissions: Submission[];
  assignments: Assignment[];
  activities: Activity[];
  quizzes: Quiz[];
  exams?: Exam[];
}): number | null {
  const { column, studentId, submissions, assignments, activities, quizzes, exams } = args;
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
  } else if (link.kind === 'quiz') {
    const source = quizzes.find((q) => q.id === link.sourceId);
    if (!source) return null;
    if (quizPointsPossible(source) <= 0) return null;
    assignmentKey = `asg-quiz-${link.sourceId}`;
    divisor = 100;
  } else if (link.kind === 'exam') {
    const source = (exams ?? []).find((e) => e.id === link.sourceId);
    if (!source) return null;
    const pts = source.questions.reduce((s, qq) => s + (qq.points ?? 0), 0);
    if (pts <= 0) return null;
    assignmentKey = `asg-exam-${link.sourceId}`;
    divisor = pts;
  } else {
    return null;
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

export function resolveExamScore(courseId: string, term: 'midterm' | 'final', studentId: string, db: { exams?: Exam[]; submissions: Submission[] }): { score: number | null; perfect: number } {
  const exam = (db.exams ?? []).find(e => e.courseId === courseId && e.published && e.term === term);
  if (!exam) return { score: null, perfect: 100 };
  const pts = exam.questions.reduce((s, q) => s + (q.points ?? 0), 0);
  const perfect = Math.max(1, pts);
  const cands = db.submissions.filter(s => s.studentId === studentId && s.assignmentId === `asg-exam-${exam.id}` && s.status === 'graded' && typeof s.grade === 'number');
  if (!cands.length) return { score: null, perfect };
  cands.sort((a, b) => String(b.gradedAt ?? b.submittedAt ?? '') > String(a.gradedAt ?? a.submittedAt ?? '') ? 1 : -1);
  return { score: Math.min(Math.max(cands[0].grade as number, 0), 100), perfect };
}
