import * as xlsx from 'xlsx';
import type { User } from '../../../shared/types/lms';
import { isChairRole, isDeanRole } from '../../../shared/utils/roles';

export interface RawChairSheetRow {
  firstName: string;
  middleName: string;
  lastName: string;
  courseCode: string;
  descriptiveTitle: string;
  yearAndSection: string;
}

export interface ValidatedChairSheetRow extends RawChairSheetRow {
  id: string;
  facultyStatus: 'valid' | 'invalid';
  matchedUser?: User | null;
  facultyErrorMessage?: string;
  suggestedUser?: User | null;
  checklistStatus?: 'valid' | 'invalid' | 'unverified';
  checklistErrorMessage?: string;
}

export interface FacultyMatchResult {
  status: 'valid' | 'invalid';
  user?: User;
  suggestion?: User;
  error?: string;
}

/**
 * Normalizes text by trimming whitespace and lowercasing for fuzzy comparison.
 */
function normalize(str?: string | null): string {
  return (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Simple Levenshtein distance calculation for detecting typographical errors.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[m][n];
}

/**
 * Calculates string similarity between 0 and 1.
 */
function stringSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return (maxLen - dist) / maxLen;
}

/**
 * Checks if a user is eligible to be assigned as faculty/instructor for a course.
 * Eligible roles: faculty, or admin with chairperson or dean designation.
 */
export function isEligibleFaculty(user: User): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'faculty' || role === 'instructor') return true;
  if (role === 'admin' || role === 'superadmin') {
    return isChairRole(user, user.role) || isDeanRole(user, user.role);
  }
  return false;
}

/**
 * Parses an Excel binary or ArrayBuffer containing the Chair-Sheet.
 * Expected columns:
 * - First Name
 * - Middle Name
 * - Last Name
 * - Course Code
 * - Descriptive Title
 * - Year and Section
 */
export function parseChairSheet(data: ArrayBuffer | Uint8Array): RawChairSheetRow[] {
  const wb = xlsx.read(data, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];

  const ws = wb.Sheets[firstSheetName];
  if (!ws) return [];

  const rawRows = xlsx.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  return rawRows.map(row => {
    // Find key case-insensitively
    const getVal = (candidates: string[]) => {
      const foundKey = Object.keys(row).find(k =>
        candidates.some(c => normalize(k) === normalize(c))
      );
      return foundKey ? String(row[foundKey] ?? '').trim() : '';
    };

    const firstName = getVal(['First Name', 'FirstName', 'First_Name']);
    const middleName = getVal(['Middle Name', 'MiddleName', 'Middle_Name', 'M.I.', 'MI']);
    const lastName = getVal(['Last Name', 'LastName', 'Last_Name']);
    const courseCode = getVal(['Course Code', 'CourseCode', 'Subject Code', 'SubjectCode']);
    const descriptiveTitle = getVal(['Descriptive Title', 'DescriptiveTitle', 'Course Title', 'Title']);
    const yearAndSection = getVal(['Year and Section', 'Year & Section', 'YearSection', 'Section', 'Year and Sec']);

    return {
      firstName,
      middleName,
      lastName,
      courseCode,
      descriptiveTitle,
      yearAndSection,
    };
  }).filter(r => r.courseCode || r.descriptiveTitle || r.lastName || r.firstName);
}

/**
 * Attempts to match a row's faculty names against the eligible system users.
 */
export function matchFaculty(row: RawChairSheetRow, users: User[]): FacultyMatchResult {
  const eligibleUsers = (users || []).filter(isEligibleFaculty);

  const targetFirst = normalize(row.firstName);
  const targetMiddle = normalize(row.middleName);
  const targetLast = normalize(row.lastName);
  const targetFullName = [targetFirst, targetMiddle, targetLast].filter(Boolean).join(' ');

  if (!targetFirst && !targetLast) {
    return {
      status: 'invalid',
      error: 'Faculty name is missing or empty',
    };
  }

  // 1. Exact match on first + last name and matching middle name if present
  for (const u of eligibleUsers) {
    const uFirst = normalize(u.firstName);
    const uMiddle = normalize(u.middleName);
    const uLast = normalize(u.lastName);
    const uName = normalize(u.name);

    // Exact first and last name match
    if (uFirst && uLast && uFirst === targetFirst && uLast === targetLast) {
      if (!targetMiddle || !uMiddle || uMiddle.startsWith(targetMiddle) || targetMiddle.startsWith(uMiddle)) {
        return { status: 'valid', user: u };
      }
    }

    // Exact full name match
    if (uName && (uName === targetFullName || uName === `${targetFirst} ${targetLast}`)) {
      return { status: 'valid', user: u };
    }
  }

  // 2. Fuzzy / Typo suggestion check
  let bestMatch: User | undefined;
  let bestScore = 0;

  for (const u of eligibleUsers) {
    const uName = normalize(u.name);
    const uFirstLast = `${normalize(u.firstName)} ${normalize(u.lastName)}`;
    const score1 = stringSimilarity(targetFullName, uName);
    const score2 = stringSimilarity(`${targetFirst} ${targetLast}`, uFirstLast);
    const score = Math.max(score1, score2);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = u;
    }
  }

  if (bestMatch && bestScore >= 0.70) {
    return {
      status: 'invalid',
      suggestion: bestMatch,
      error: `User either doesn't exist or name is spelled wrongly. Did you mean ${bestMatch.name}?`,
    };
  }

  return {
    status: 'invalid',
    error: `Faculty "${row.firstName} ${row.lastName}".trim() not found in the system.`,
  };
}

/**
 * Validates an array of raw chair sheet rows against the user directory.
 */
export function validateChairSheetRows(
  rows: RawChairSheetRow[],
  users: User[]
): ValidatedChairSheetRow[] {
  return rows.map((row, idx) => {
    const match = matchFaculty(row, users);
    return {
      ...row,
      id: `csr-${idx + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      facultyStatus: match.status,
      matchedUser: match.user,
      suggestedUser: match.suggestion,
      facultyErrorMessage: match.error,
      checklistStatus: 'unverified',
    };
  });
}

/**
 * Generates an Excel workbook for the chair-sheet template with standard columns and example data.
 */
export function generateChairSheetTemplateWorkbook(): xlsx.WorkBook {
  const headers = [
    'First Name',
    'Middle Name',
    'Last Name',
    'Course Code',
    'Descriptive Title',
    'Year and Section',
  ];

  const sampleData = [
    {
      'First Name': 'Charlie',
      'Middle Name': 'Seli',
      'Last Name': 'Marzan',
      'Course Code': 'CSCC 103',
      'Descriptive Title': 'Data Structures and Algorithms',
      'Year and Section': 'BSCS 2-1',
    },
    {
      'First Name': 'Raymund',
      'Middle Name': 'Ezekiel',
      'Last Name': 'Dilan',
      'Course Code': 'CCSC 303',
      'Descriptive Title': 'Software Engineering',
      'Year and Section': 'BSCS 3-1',
    },
  ];

  const worksheet = xlsx.utils.json_to_sheet(sampleData, { header: headers });
  worksheet['!cols'] = [
    { wch: 18 }, // First Name
    { wch: 18 }, // Middle Name
    { wch: 18 }, // Last Name
    { wch: 16 }, // Course Code
    { wch: 36 }, // Descriptive Title
    { wch: 18 }, // Year and Section
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Chair Sheet');
  return workbook;
}

/**
 * Downloads the chair-sheet template as an Excel file (.xlsx) in the browser.
 */
export function downloadChairSheetTemplate(filename = 'chair-sheet-template.xlsx'): void {
  const wb = generateChairSheetTemplateWorkbook();
  xlsx.writeFile(wb, filename);
}
