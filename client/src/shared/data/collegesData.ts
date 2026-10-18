import type { College, Department, Program, SchoolYear } from '../types/lms';

/**
 * Initial Default University Colleges
 * Represents primary academic units configured in the LMS.
 */
export const DEFAULT_COLLEGES: College[] = [
  {
    id: 'col-ccs',
    name: 'College of Computer Science',
    code: 'CCS',
    deanId: '6a52a8c6-5a15-4620-8a16-d06a5b269fc3',
  },
];

/**
 * Initial Default University School Years
 * Created by Admin/Chancellor, accessible throughout all colleges.
 */
export const DEFAULT_SCHOOL_YEARS: SchoolYear[] = [
  {
    id: 'sy-univ-2025-2026',
    year: '2025-2026',
    isActive: true,
    createdAt: '2025-06-01T00:00:00.000Z',
  },
];

/**
 * Initial Default University Academic Programs
 * Mapped to their respective parent colleges.
 */
export const DEFAULT_PROGRAMS: Program[] = [
  {
    id: 'dept-cs',
    collegeId: 'col-ccs',
    name: 'Program in Computer Science',
    code: 'CS',
    chairpersonId: '3281e224-fc7d-4c7e-b4c9-bcb7bca2ab89',
  },
];

export const DEFAULT_DEPARTMENTS: Department[] = DEFAULT_PROGRAMS;

/**
 * Retrieve all registered colleges or return defaults
 */
export function getColleges(colleges: College[] = DEFAULT_COLLEGES): College[] {
  return Array.isArray(colleges) ? colleges : DEFAULT_COLLEGES;
}

/**
 * Retrieve a college by unique ID, code, or name alias with safety fallback
 */
export function getCollegeById(
  id: string,
  colleges: College[] = DEFAULT_COLLEGES
): College | undefined {
  if (!id || typeof id !== 'string' || !Array.isArray(colleges)) return undefined;
  const target = id.trim().toLowerCase();
  return colleges.find(
    c =>
      c.id.toLowerCase() === target ||
      c.code.toLowerCase() === target ||
      c.name.toLowerCase() === target ||
      (target === 'col-coed' && c.id === 'col-coe') ||
      (target === 'col-coeng' && c.id === 'col-eng') ||
      (target === 'col-engineering' && c.id === 'col-eng') ||
      (target === 'col-education' && c.id === 'col-coe')
  );
}

/**
 * Retrieve a college by official code (e.g., 'CCS', 'COED', 'COE')
 */
export function getCollegeByCode(
  code: string,
  colleges: College[] = DEFAULT_COLLEGES
): College | undefined {
  if (!code || typeof code !== 'string' || !Array.isArray(colleges)) return undefined;
  const target = code.trim().toLowerCase();
  return colleges.find(c => c.code.toLowerCase() === target);
}

/**
 * Retrieve all departments belonging to a given college
 * Supports lookup by college ID as well as college code or name fallback
 */
export function getDepartmentsByCollege(
  collegeId: string,
  departments: Department[] = DEFAULT_DEPARTMENTS,
  colleges: College[] = DEFAULT_COLLEGES
): Department[] {
  if (!collegeId || typeof collegeId !== 'string' || !Array.isArray(departments)) return [];
  const target = collegeId.trim().toLowerCase();

  // Direct match on department.collegeId
  const directMatches = departments.filter(d => d.collegeId.toLowerCase() === target);
  if (directMatches.length > 0) return directMatches;

  // Fallback: match if college code or college name was passed instead of college id
  const matchedCollege = getCollegeById(collegeId, colleges);
  if (matchedCollege) {
    return departments.filter(d => d.collegeId.toLowerCase() === matchedCollege.id.toLowerCase());
  }

  return [];
}

/**
 * Retrieve a department or program by exact or fuzzy name, code, or ID
 */
export function getDepartmentByName(
  name: string,
  departments: Department[] = DEFAULT_DEPARTMENTS
): Department | undefined {
  if (!name || typeof name !== 'string' || !Array.isArray(departments)) return undefined;
  const target = name.trim().toLowerCase();
  const normalizedTarget = target
    .replace(/^(department of|program in|program of)\s+/i, '')
    .replace(/\s+(department|program)$/i, '');

  return departments.find(d => {
    const dName = d.name.toLowerCase();
    const dCode = d.code.toLowerCase();
    const dId = d.id.toLowerCase();
    const normalizedDName = dName
      .replace(/^(department of|program in|program of)\s+/i, '')
      .replace(/\s+(department|program)$/i, '');

    return (
      dName === target ||
      dCode === target ||
      dId === target ||
      normalizedDName === normalizedTarget ||
      normalizedDName === target ||
      dName === normalizedTarget
    );
  });
}

/**
 * Retrieve a department or program by unique ID or code
 */
export function getDepartmentById(
  id: string,
  departments: Department[] = DEFAULT_DEPARTMENTS
): Department | undefined {
  if (!id || typeof id !== 'string' || !Array.isArray(departments)) return undefined;
  const target = id.trim().toLowerCase();
  return departments.find(d => d.id.toLowerCase() === target || d.code.toLowerCase() === target);
}

// Program aliases for seamless terminology transition
export const getProgramsByCollege = getDepartmentsByCollege;
export const getProgramByName = getDepartmentByName;
export const getProgramById = getDepartmentById;
