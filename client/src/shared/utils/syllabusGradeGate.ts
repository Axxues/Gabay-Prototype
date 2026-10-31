interface GradeGateRevision {
  status?: string;
}

interface GradeGateSyllabus {
  gradingSystem?: {
    termFormula?: string | { classStandingPercent?: string; examPercent?: string };
    finalFormula?: string | { midtermPercent?: string; finalPercent?: string };
  } | null;
}

export function isSyllabusGradeReady(
  revision: GradeGateRevision | null | undefined,
  syllabus: GradeGateSyllabus | null | undefined,
): boolean {
  if (!syllabus) return false;
  if (revision && revision.status !== 'published') return false;
  const grading = syllabus.gradingSystem;
  if (!grading) return false;

  const hasTerm =
    typeof grading.termFormula === 'object' && grading.termFormula !== null
      ? Boolean(grading.termFormula.classStandingPercent && grading.termFormula.examPercent)
      : Boolean(typeof grading.termFormula === 'string' && grading.termFormula.trim());

  const hasFinal =
    typeof grading.finalFormula === 'object' && grading.finalFormula !== null
      ? Boolean(grading.finalFormula.midtermPercent && grading.finalFormula.finalPercent)
      : Boolean(typeof grading.finalFormula === 'string' && grading.finalFormula.trim());

  return hasTerm && hasFinal;
}
