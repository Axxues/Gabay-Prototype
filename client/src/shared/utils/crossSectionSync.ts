import type { Course } from '../types/lms';

/**
 * Normalizes semester strings (e.g. '1st Semester', '1st Sem AY 2026-2027', 'First Sem') into standard keys.
 */
export function normalizeSemester(termOrSem?: string | null): string {
  if (!termOrSem || typeof termOrSem !== 'string') return '';
  const s = termOrSem.trim().toLowerCase();
  if (s.includes('1st') || s.includes('first')) return '1st';
  if (s.includes('2nd') || s.includes('second')) return '2nd';
  if (s.includes('3rd') || s.includes('third')) return '3rd';
  if (s.includes('summer') || s.includes('midyear') || s.includes('mid-year')) return 'summer';
  return s;
}

/**
 * Finds sibling courses taught by the same instructor matching the exact course code,
 * title, school year, and semester, but with a different section / course ID.
 */
export function findMatchingSiblingCourses(
  currentCourse: Course,
  allCourses: Course[],
  activeUserId?: string
): Course[] {
  if (!currentCourse || !Array.isArray(allCourses) || allCourses.length === 0) return [];

  const curCode = (currentCourse.code || '').trim().toLowerCase();
  const curTitle = (currentCourse.title || '').trim().toLowerCase();
  const curYear = (currentCourse.schoolYear || '').trim();
  const curSem = normalizeSemester(currentCourse.semester || currentCourse.term);
  const instructorId = activeUserId || currentCourse.instructorId;

  return allCourses.filter(c => {
    if (!c || c.id === currentCourse.id) return false;

    const sameCode = (c.code || '').trim().toLowerCase() === curCode;
    const sameTitle = (c.title || '').trim().toLowerCase() === curTitle;
    const sameYear = (c.schoolYear || '').trim() === curYear;

    const targetSem = normalizeSemester(c.semester || c.term);
    // If either has a semester specified, ensure normalized semester matches
    const sameSem = !curSem || !targetSem || curSem === targetSem;

    // Strict instructor match if instructor ID is known
    const targetInstId = c.instructorId || (c as any).instructor_id || (typeof (c as any).instructor === 'object' ? (c as any).instructor?.id : (c as any).instructor);
    const sameInstructor = !instructorId || targetInstId === instructorId;

    return sameCode && sameTitle && sameYear && sameSem && sameInstructor;
  });
}
