interface GradeGateRevision {
  status?: string;
}

interface GradeGateSyllabus {
  gradingSystem?: {
    termFormula?: string;
    finalFormula?: string;
  } | null;
}

export function isSyllabusGradeReady(
  revision: GradeGateRevision | null | undefined,
  syllabus: GradeGateSyllabus | null | undefined,
): boolean {
  if (!syllabus) return false;
  if (revision && revision.status !== 'published') return false;
  const grading = syllabus.gradingSystem;
  if (!grading?.termFormula?.trim() || !grading?.finalFormula?.trim()) return false;
  return true;
}
