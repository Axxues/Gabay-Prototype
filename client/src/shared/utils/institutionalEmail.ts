/**
 * Institutional email validation.
 *
 * Accepted domains:
 * - dmmmsu.edu.ph         (faculty, staff, and administration)
 * - student.dmmmsu.edu.ph (students)
 */

export const INSTITUTIONAL_EMAIL_DOMAINS = ['dmmmsu.edu.ph', 'student.dmmmsu.edu.ph'] as const;

export const INSTITUTIONAL_EMAIL_EXAMPLE = 'jdelacruz@dmmmsu.edu.ph';
export const STUDENT_EMAIL_EXAMPLE = 'jdelacruz@student.dmmmsu.edu.ph';

export const INSTITUTIONAL_EMAIL_PATTERN = /^[a-z0-9._%+-]+@(?:student\.)?dmmmsu\.edu\.ph$/i;
export const STUDENT_EMAIL_PATTERN = /^[a-z0-9._%+-]+@student\.dmmmsu\.edu\.ph$/i;
export const EMPLOYEE_EMAIL_PATTERN = /^[a-z0-9._%+-]+@dmmmsu\.edu\.ph$/i;

export const INSTITUTIONAL_EMAIL_REQUIREMENT = `Institutional email must end with ${INSTITUTIONAL_EMAIL_DOMAINS.map(
  domain => `@${domain}`
).join(' or ')}.`;

/**
 * What an institutional address says about the registrant.
 *
 * - `student`  → `@student.dmmmsu.edu.ph`; the account role is settled by the domain.
 * - `employee` → `@dmmmsu.edu.ph`; a chair or dean decides Faculty vs Staff on approval.
 */
export type InstitutionalAccountKind = 'student' | 'employee';

export function getInstitutionalAccountKind(value: string): InstitutionalAccountKind | undefined {
  const trimmed = value.trim();
  if (STUDENT_EMAIL_PATTERN.test(trimmed)) return 'student';
  if (EMPLOYEE_EMAIL_PATTERN.test(trimmed)) return 'employee';
  return undefined;
}

export function isValidInstitutionalEmail(value: string, role?: string): boolean {
  const trimmed = value.trim();
  if (role === 'student') {
    return STUDENT_EMAIL_PATTERN.test(trimmed);
  }
  if (role === 'faculty' || role === 'staff') {
    return EMPLOYEE_EMAIL_PATTERN.test(trimmed);
  }
  return INSTITUTIONAL_EMAIL_PATTERN.test(trimmed);
}
