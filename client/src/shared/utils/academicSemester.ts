import type { AcademicSemester } from '../types/lms';

/**
 * The canonical semester set, in the order the app has always presented it.
 */
export const ACADEMIC_SEMESTERS: readonly AcademicSemester[] = ['First', 'Mid-Year', 'Second'];

/**
 * Normalizes free text from a spreadsheet cell, an ERP dropdown or a cached
 * value into the canonical union. Anything unrecognized reads as `First`.
 */
export function normalizeAcademicSemester(raw?: string | null): AcademicSemester {
  const s = (raw || '').trim().toLowerCase().replace(/[-_\s]+/g, ' ');
  if (s.includes('mid') || s.includes('summer')) {
    return 'Mid-Year';
  }
  if (s.includes('second') || /\b(2nd|2)\b/.test(s) || s.startsWith('2nd') || s.includes('2nd sem')) {
    return 'Second';
  }
  return 'First';
}

export const normalizeAssignedSemester = normalizeAcademicSemester;

/** Display label for a semester: `First Semester`, `Second Semester`, `Mid-Year`. */
export function formatSemesterLabel(semester: AcademicSemester): string {
  return semester === 'Mid-Year' ? 'Mid-Year' : `${semester} Semester`;
}
