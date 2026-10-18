import type { User, NormalizedPersonName, EducationalDegree, NormalizedAddress } from '../types/lms';

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
 * Formats a normalized address or string into a single line address string:
 * "House/Street, Barangay, Municipality/City, Province"
 */
export function formatAddress(addr?: Partial<NormalizedAddress> | string | null): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr.trim();
  return [addr.houseStreet, addr.barangay, addr.municipalityCity, addr.province]
    .map(s => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join(', ');
}

/**
 * Parses an address string or partial normalized address into a NormalizedAddress object.
 */
export function parseAddress(addr?: string | Partial<NormalizedAddress> | null): NormalizedAddress {
  if (!addr) {
    return { houseStreet: '', barangay: '', municipalityCity: '', province: '' };
  }
  if (typeof addr === 'object') {
    return {
      houseStreet: addr.houseStreet?.trim() || '',
      barangay: addr.barangay?.trim() || '',
      municipalityCity: addr.municipalityCity?.trim() || '',
      province: addr.province?.trim() || '',
    };
  }
  const parts = addr.split(',').map(s => s.trim());
  if (parts.length >= 4) {
    return {
      houseStreet: parts.slice(0, parts.length - 3).join(', '),
      barangay: parts[parts.length - 3] || '',
      municipalityCity: parts[parts.length - 2] || '',
      province: parts[parts.length - 1] || '',
    };
  } else if (parts.length === 3) {
    return {
      houseStreet: parts[0] || '',
      barangay: '',
      municipalityCity: parts[1] || '',
      province: parts[2] || '',
    };
  }
  return { houseStreet: addr.trim(), barangay: '', municipalityCity: '', province: '' };
}

/**
 * Validates whether an address is complete (either non-empty string or all 4 normalized parts filled).
 */
export function isAddressComplete(address?: Partial<NormalizedAddress> | string | null): boolean {
  if (!address) return false;
  if (typeof address === 'string') {
    return address.trim() !== '';
  }
  return Boolean(
    address.houseStreet && address.houseStreet.trim() !== '' &&
    address.barangay && address.barangay.trim() !== '' &&
    address.municipalityCity && address.municipalityCity.trim() !== '' &&
    address.province && address.province.trim() !== ''
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
    const hasPermanentAddress =
      isAddressComplete(user.permanentAddressDetails) ||
      (typeof user.permanentAddress === 'string' && user.permanentAddress.trim() !== '');
    const hasContactNumber = typeof user.contactNumber === 'string' && user.contactNumber.trim() !== '';
    const hasParentContactNumber =
      typeof user.parentContactNumber === 'string' && user.parentContactNumber.trim() !== '';

    const hasPresentAddress = user.sameAsPermanentAddress
      ? hasPermanentAddress
      : isAddressComplete(user.presentAddressDetails) ||
        (typeof user.presentAddress === 'string' && user.presentAddress.trim() !== '');

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
  const hasAddress =
    isAddressComplete(user.addressDetails) ||
    isAddressComplete(user.permanentAddressDetails) ||
    (typeof user.address === 'string' && user.address.trim() !== '') ||
    (typeof user.permanentAddress === 'string' && user.permanentAddress.trim() !== '');
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
