/**
 * Institutional ID Number formatting.
 *
 * Official format:
 * - Student: XXX-XXXX-X (8 digits, e.g. 231-1082-3)
 * - Faculty/Staff: XXXX (4 digits, e.g. 1082)
 */

export const STUDENT_ID_PATTERN = /^\d{3}-\d{4}-\d$/;
export const STUDENT_ID_EXAMPLE = '231-1082-3';

export const EMPLOYEE_ID_PATTERN = /^\d{4}$/;
export const EMPLOYEE_ID_EXAMPLE = '1082';

export const ID_NUMBER_PATTERN = STUDENT_ID_PATTERN;
export const ID_NUMBER_EXAMPLE = STUDENT_ID_EXAMPLE;

export function formatIdNumber(input: string, role?: string): string {
  if (role === 'faculty' || role === 'staff') {
    return input.replace(/\D/g, '').slice(0, 4);
  }
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function isValidIdNumber(value: string, role?: string): boolean {
  const trimmed = value.trim();
  if (role === 'faculty' || role === 'staff') {
    return EMPLOYEE_ID_PATTERN.test(trimmed);
  }
  return STUDENT_ID_PATTERN.test(trimmed);
}
