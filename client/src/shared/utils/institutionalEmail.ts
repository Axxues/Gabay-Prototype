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
