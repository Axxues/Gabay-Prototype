import type { College, Department } from '../types/lms';

/**
 * Initial Default University Colleges
 * Represents primary academic units configured in the LMS.
 */
export const DEFAULT_COLLEGES: College[] = [
  {
    id: 'col-ccs',
    name: 'College of Computer Science',
    code: 'CCS',
  },
  {
    id: 'col-coe',
    name: 'College of Education',
    code: 'COED',
  },
  {
    id: 'col-eng',
    name: 'College of Engineering',
    code: 'COE',
  },
];

/**
 * Initial Default University Departments
 * Mapped to their respective parent colleges.
 */
export const DEFAULT_DEPARTMENTS: Department[] = [
  {
    id: 'dept-cs',
    collegeId: 'col-ccs',
    name: 'Department of Computer Science',
    code: 'CS',
  },
  {
    id: 'dept-it',
    collegeId: 'col-ccs',
    name: 'Department of Information Technology',
    code: 'IT',
  },
  {
    id: 'dept-is',
    collegeId: 'col-ccs',
    name: 'Department of Information Systems',
    code: 'IS',
  },
  {
    id: 'dept-eled',
    collegeId: 'col-coe',
    name: 'Department of Elementary Education',
    code: 'ELED',
  },
  {
    id: 'dept-sec-ed',
    collegeId: 'col-coe',
    name: 'Department of Secondary Education',
    code: 'SED',
  },
  {
    id: 'dept-civil-eng',
    collegeId: 'col-eng',
    name: 'Department of Civil Engineering',
    code: 'CE',
  },
  {
    id: 'dept-elec-eng',
    collegeId: 'col-eng',
    name: 'Department of Electrical Engineering',
    code: 'EE',
  },
];

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
 * Retrieve a department by exact or fuzzy name, code, or ID
 */
export function getDepartmentByName(
  name: string,
  departments: Department[] = DEFAULT_DEPARTMENTS
): Department | undefined {
  if (!name || typeof name !== 'string' || !Array.isArray(departments)) return undefined;
  const target = name.trim().toLowerCase();
  return departments.find(d => {
    const dName = d.name.toLowerCase();
    const dCode = d.code.toLowerCase();
    const dId = d.id.toLowerCase();
    return (
      dName === target ||
      dCode === target ||
      dId === target ||
      dName.replace(/^department of\s+/i, '') === target ||
      target.replace(/^department of\s+/i, '') === dName.replace(/^department of\s+/i, '')
    );
  });
}

/**
 * Retrieve a department by unique ID or code
 */
export function getDepartmentById(
  id: string,
  departments: Department[] = DEFAULT_DEPARTMENTS
): Department | undefined {
  if (!id || typeof id !== 'string' || !Array.isArray(departments)) return undefined;
  const target = id.trim().toLowerCase();
  return departments.find(d => d.id.toLowerCase() === target || d.code.toLowerCase() === target);
}
