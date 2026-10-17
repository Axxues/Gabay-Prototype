// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  INSTITUTIONAL_EMAIL_PATTERN,
  INSTITUTIONAL_EMAIL_REQUIREMENT,
  isValidInstitutionalEmail,
} from './institutionalEmail';

describe('institutional email validation', () => {
  it('accepts official staff/faculty accounts on dmmmsu.edu.ph', () => {
    expect(isValidInstitutionalEmail('jdelacruz@dmmmsu.edu.ph')).toBe(true);
    expect(isValidInstitutionalEmail('it.support@dmmmsu.edu.ph')).toBe(true);
    expect(isValidInstitutionalEmail('a.b_c+d@dmmmsu.edu.ph')).toBe(true);
  });

  it('accepts student accounts on student.dmmmsu.edu.ph', () => {
    expect(isValidInstitutionalEmail('jdelacruz@student.dmmmsu.edu.ph')).toBe(true);
    expect(isValidInstitutionalEmail('2026-0001@student.dmmmsu.edu.ph')).toBe(true);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(isValidInstitutionalEmail('  JDeLaCruz@DMMMSU.EDU.PH  ')).toBe(true);
    expect(isValidInstitutionalEmail('jdelacruz@Student.DMMMSU.edu.ph')).toBe(true);
  });

  it('rejects personal and third-party email providers', () => {
    expect(isValidInstitutionalEmail('maria@gmail.com')).toBe(false);
    expect(isValidInstitutionalEmail('jdelacruz@yahoo.com')).toBe(false);
    expect(isValidInstitutionalEmail('jdelacruz@dmmmsu.edu')).toBe(false);
  });

  it('rejects look-alike or nested domains', () => {
    expect(isValidInstitutionalEmail('jdelacruz@mail.dmmmsu.edu.ph')).toBe(false);
    expect(isValidInstitutionalEmail('jdelacruz@fakedmmmsu.edu.ph')).toBe(false);
    expect(isValidInstitutionalEmail('jdelacruz@student.dmmmsu.edu.ph.evil.com')).toBe(false);
    expect(isValidInstitutionalEmail('jdelacruz@dmmmsu.edu.ph.evil.com')).toBe(false);
  });

  it('rejects malformed addresses', () => {
    expect(isValidInstitutionalEmail('')).toBe(false);
    expect(isValidInstitutionalEmail('@dmmmsu.edu.ph')).toBe(false);
    expect(isValidInstitutionalEmail('jdelacruz')).toBe(false);
    expect(isValidInstitutionalEmail('jdelacruz@')).toBe(false);
  });

  it('exposes a requirement message listing both accepted domains', () => {
    expect(INSTITUTIONAL_EMAIL_REQUIREMENT).toBe(
      'Institutional email must end with @dmmmsu.edu.ph or @student.dmmmsu.edu.ph.'
    );
    expect(INSTITUTIONAL_EMAIL_PATTERN.test('jdelacruz@student.dmmmsu.edu.ph')).toBe(true);
  });
});
