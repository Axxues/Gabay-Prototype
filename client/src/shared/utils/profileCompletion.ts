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
    const hasBirthday = typeof user.birthday === 'string' && user.birthday.trim() !== '';
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
  const hasBirthday = typeof user.birthday === 'string' && user.birthday.trim() !== '';
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
