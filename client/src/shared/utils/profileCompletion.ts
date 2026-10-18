import type { User, NormalizedPersonName, EducationalDegree } from '../types/lms';

/**
 * Validates whether a person's name object has the required first and last names.
 */
export function isPersonNameComplete(name?: NormalizedPersonName | null): boolean {
  if (!name) return false;
  return Boolean(
    typeof name.firstName === 'string' &&
    name.firstName.trim() !== '' &&
    typeof name.lastName === 'string' &&
    name.lastName.trim() !== ''
  );
}

/**
 * Validates whether an educational degree entry has all required attributes.
 */
export function isDegreeComplete(degree?: EducationalDegree | null): boolean {
  if (!degree) return false;
  const hasSchool = typeof degree.school === 'string' && degree.school.trim() !== '';
  const hasDegreeLevel = typeof degree.degreeLevel === 'string' && degree.degreeLevel.trim() !== '';
  const hasSpecialization = typeof degree.specialization === 'string' && degree.specialization.trim() !== '';
  const hasYearGraduated =
    degree.yearGraduated !== undefined &&
    degree.yearGraduated !== null &&
    String(degree.yearGraduated).trim() !== '';

  return Boolean(hasSchool && hasDegreeLevel && hasSpecialization && hasYearGraduated);
}

/**
 * Returns the maximum allowed date string (YYYY-MM-DD) for a birthday.
 * A birthday must be from a previous date (strictly before today).
 */
export function getMaxBirthdayDate(referenceDate: Date = new Date()): string {
  const d = new Date(referenceDate);
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates that a birthday string is not empty, is well-formed,
 * and is from a previous date (strictly before today, not tomorrow or future dates).
 */
export function isValidBirthday(birthday?: string | null, referenceDate: Date = new Date()): boolean {
  if (!birthday || typeof birthday !== 'string') return false;
  const trimmed = birthday.trim();
  if (!trimmed) return false;
  const maxDate = getMaxBirthdayDate(referenceDate);
  return trimmed <= maxDate;
}

/**
 * Validates whether a user has fulfilled the institutional profile requirements for their role.
 * - Students require birthday, permanent & present address, contact number, parent/guardian info, and yearLevel.
 * - Faculty & staff require address, contact number, birthday, years of teaching, and educational background.
 * - Administrators and other administrative roles without mandatory academic profiles return true.
 */
export function isProfileComplete(user: Partial<User> | null | undefined): boolean {
  if (!user || !user.role) {
    return false;
  }

  if (user.role === 'student') {
    const hasBirthday = isValidBirthday(user.birthday);
    const hasPermanentAddress = typeof user.permanentAddress === 'string' && user.permanentAddress.trim() !== '';
    const hasContactNumber = typeof user.contactNumber === 'string' && user.contactNumber.trim() !== '';
    const hasParentContactNumber =
      typeof user.parentContactNumber === 'string' && user.parentContactNumber.trim() !== '';

    const hasPresentAddress = user.sameAsPermanentAddress
      ? hasPermanentAddress
      : typeof user.presentAddress === 'string' && user.presentAddress.trim() !== '';

    const hasYearLevel =
      typeof user.yearLevel === 'number' &&
      !isNaN(user.yearLevel) &&
      user.yearLevel >= 1 &&
      user.yearLevel <= 4;

    const hasParentOrGuardianInfo = user.hasGuardianOnly
      ? isPersonNameComplete(user.guardianName)
      : isPersonNameComplete(user.motherName) && isPersonNameComplete(user.fatherName);

    return Boolean(
      hasBirthday &&
      hasPermanentAddress &&
      hasPresentAddress &&
      hasContactNumber &&
      hasParentContactNumber &&
      hasYearLevel &&
      hasParentOrGuardianInfo
    );
  }

  // All academic and administrative personnel (faculty, staff, administrators, deans, chairpersons, superadmin)
  // require professional credentials: address, contact number, birthday, years of teaching, and educational background.
  const hasAddress = typeof user.address === 'string' && user.address.trim() !== '';
  const hasContactNumber = typeof user.contactNumber === 'string' && user.contactNumber.trim() !== '';
  const hasBirthday = isValidBirthday(user.birthday);
  const hasTeachingExperience =
    typeof user.yearsOfTeaching === 'number' &&
    !isNaN(user.yearsOfTeaching) &&
    user.yearsOfTeaching >= 0;

  const hasDegrees =
    Array.isArray(user.educationalBackground) &&
    user.educationalBackground.length > 0 &&
    user.educationalBackground.every((deg) => isDegreeComplete(deg));

  return Boolean(
    hasAddress &&
    hasContactNumber &&
    hasBirthday &&
    hasTeachingExperience &&
    hasDegrees
  );
}
