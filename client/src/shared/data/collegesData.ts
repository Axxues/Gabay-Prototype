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
 * Automatically generates university school years 5 years in advance.
 * Base year defaults to 2025.
 */
export const parseStartYear = (sy: string): number => {
  const match = (sy || '').match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : 0;
};

export function generateAutomaticSchoolYears(
  baseStartYear = 2025,
  yearsAhead = 5
): SchoolYear[] {
  const currentCalendarYear = new Date().getFullYear();
  const start = Math.min(baseStartYear, currentCalendarYear);
  const end = Math.max(baseStartYear, currentCalendarYear) + yearsAhead;

  const years: SchoolYear[] = [];
  for (let y = start; y <= end; y++) {
    const yearString = `${y}-${y + 1}`;
    years.push({
      id: `sy-univ-${yearString}`,
      year: yearString,
      isActive: yearString === '2025-2026',
      createdAt: `${y}-06-01T00:00:00.000Z`,
    });
  }
  return years;
}

/**
 * Initial Default University School Years
 * Automatically generated yearly with 5 years in advance.
 */
export const DEFAULT_SCHOOL_YEARS: SchoolYear[] = generateAutomaticSchoolYears();

/**
 * Helper to normalize program names, stripping any redundant "Program in " prefix.
 */
export function normalizeProgramName(name?: string | null): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (/^Program in Computer Science$/i.test(trimmed)) {
    return 'Computer Science';
  }
  return trimmed;
}

/**
 * Initial Default University Academic Programs
 * Mapped to their respective parent colleges.
 */
export const DEFAULT_PROGRAMS: Program[] = [
  {
    id: 'dept-cs',
    collegeId: 'col-ccs',
    name: 'Computer Science',
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
      (target === 'col-ccs' && (c.code?.toLowerCase() === 'ccs' || c.id === 'col-ccs')) ||
      (target === 'col-coed' && (c.code?.toLowerCase() === 'coe' || c.code?.toLowerCase() === 'ce' || c.id === 'col-coe')) ||
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

/**
 * Resolves the academic college for a user based on their collegeId, collegeName,
 * dean assignment, or department affiliation.
 */
export function getUserCollege(
  user?: {
    id?: string;
    collegeId?: string;
    collegeName?: string;
    collegeCode?: string;
    department?: string;
  } | null,
  colleges: College[] = DEFAULT_COLLEGES,
  departments: Department[] = DEFAULT_DEPARTMENTS
): College | undefined {
  if (!user) return undefined;
  const colList = Array.isArray(colleges) && colleges.length > 0 ? colleges : DEFAULT_COLLEGES;
  const deptList = Array.isArray(departments) && departments.length > 0 ? departments : DEFAULT_DEPARTMENTS;

  // 1. Explicit collegeCode match
  if (user.collegeCode) {
    const matched = getCollegeByCode(user.collegeCode, colList);
    if (matched) return matched;
  }

  // 2. Direct collegeId match
  if (user.collegeId) {
    const matched = getCollegeById(user.collegeId, colList);
    if (matched) return matched;
  }

  // 3. Dean assigned to college
  if (user.id) {
    const deanMatched = colList.find(c => c.deanId === user.id);
    if (deanMatched) return deanMatched;
  }

  // 4. Direct collegeName match
  if (user.collegeName) {
    const matched = getCollegeById(user.collegeName, colList);
    if (matched) return matched;
  }

  // 5. Department affiliation match
  if (user.department) {
    const matchedDept = getDepartmentByName(user.department, deptList) || getDepartmentById(user.department, deptList);
    if (matchedDept && matchedDept.collegeId) {
      const matched = getCollegeById(matchedDept.collegeId, colList);
      if (matched) return matched;
    }
  }

  return undefined;
}

/**
 * Returns the uppercase college code (e.g. 'CCS', 'COED', 'COE') for a given user.
 */
export function getUserCollegeCode(
  user?: {
    id?: string;
    collegeId?: string;
    collegeName?: string;
    collegeCode?: string;
    department?: string;
  } | null,
  colleges: College[] = DEFAULT_COLLEGES,
  departments: Department[] = DEFAULT_DEPARTMENTS
): string | undefined {
  if (!user) return undefined;
  if (user.collegeCode) return user.collegeCode.toUpperCase();
  const college = getUserCollege(user, colleges, departments);
  if (college?.code) return college.code.toUpperCase();
  if (user.collegeName) {
    const lower = user.collegeName.toLowerCase();
    if (lower.includes('computer science')) return 'CCS';
    if (lower.includes('education')) return 'COED';
    if (lower.includes('engineering')) return 'COE';
  }
  return undefined;
}
