// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  formatIdNumber,
  isValidIdNumber,
  STUDENT_ID_EXAMPLE,
  EMPLOYEE_ID_EXAMPLE,
} from './idNumber';

describe('idNumber formatting and validation', () => {
  describe('student role (default)', () => {
    it('formats student id number correctly', () => {
      expect(formatIdNumber('23110823')).toBe('231-1082-3');
      expect(formatIdNumber('23110823', 'student')).toBe('231-1082-3');
      expect(formatIdNumber('231', 'student')).toBe('231');
      expect(formatIdNumber('2311', 'student')).toBe('231-1');
      expect(formatIdNumber('23110823999', 'student')).toBe('231-1082-3'); // slices to 8 digits
    });

    it('validates student id format XXX-XXXX-X', () => {
      expect(isValidIdNumber('231-1082-3')).toBe(true);
      expect(isValidIdNumber(STUDENT_ID_EXAMPLE, 'student')).toBe(true);
      expect(isValidIdNumber('1082', 'student')).toBe(false); // 4-digit employee id rejected for student
      expect(isValidIdNumber('231-108-3', 'student')).toBe(false);
      expect(isValidIdNumber('23110823', 'student')).toBe(false); // unhyphenated rejected
      expect(isValidIdNumber('', 'student')).toBe(false);
    });
  });

  describe('faculty and staff roles', () => {
    it('formats faculty/staff id as up to 4 digits', () => {
      expect(formatIdNumber('1082', 'faculty')).toBe('1082');
      expect(formatIdNumber('1082', 'staff')).toBe('1082');
      expect(formatIdNumber('10-82-34', 'faculty')).toBe('1082'); // strips non-digits and slices to 4
      expect(formatIdNumber('999999', 'staff')).toBe('9999');
    });

    it('validates faculty/staff id format XXXX (4 digits)', () => {
      expect(isValidIdNumber('1082', 'faculty')).toBe(true);
      expect(isValidIdNumber('0001', 'staff')).toBe(true);
      expect(isValidIdNumber(EMPLOYEE_ID_EXAMPLE, 'faculty')).toBe(true);
      expect(isValidIdNumber('231-1082-3', 'faculty')).toBe(false); // student format rejected
      expect(isValidIdNumber('123', 'faculty')).toBe(false); // only 3 digits
      expect(isValidIdNumber('12345', 'faculty')).toBe(false); // 5 digits
      expect(isValidIdNumber('abcd', 'faculty')).toBe(false);
    });
  });
});
