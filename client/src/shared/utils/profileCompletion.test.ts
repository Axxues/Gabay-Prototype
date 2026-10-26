import { describe, it, expect, vi } from 'vitest';
import { isProfileComplete, isAddressComplete, parseAddress, hasUserFirstAndLastName } from './profileCompletion';
import type { User } from '../types/lms';

describe('isProfileComplete', () => {
  it('returns false for newly registered student with missing fields', () => {
    const student = { role: 'student', yearLevel: 1 } as User;
    expect(isProfileComplete(student)).toBe(false);
  });

  it('validates user first name and last name', () => {
    expect(hasUserFirstAndLastName(null)).toBe(false);
    expect(hasUserFirstAndLastName({})).toBe(false);
    expect(hasUserFirstAndLastName({ firstName: 'Maria', lastName: '' })).toBe(false);
    expect(hasUserFirstAndLastName({ firstName: '', lastName: 'Santos' })).toBe(false);
    expect(hasUserFirstAndLastName({ firstName: 'Maria', lastName: 'Santos' })).toBe(true);
    expect(hasUserFirstAndLastName({ name: 'Maria' })).toBe(false);
    expect(hasUserFirstAndLastName({ name: 'Maria Santos' })).toBe(true);
  });

  it('returns false when user first name or last name is missing', () => {
    const student = {
      role: 'student',
      firstName: '',
      lastName: 'Cruz',
      name: 'Cruz',
      birthday: '2004-05-15',
      permanentAddress: '123 Main St, Catbangen, San Fernando, La Union',
      presentAddress: '123 Main St, Catbangen, San Fernando, La Union',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Maria', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09987654321',
    } as User;
    expect(isProfileComplete(student)).toBe(false);
  });

  it('returns true for student with all required profile information (even without yearLevel)', () => {
    const student = {
      role: 'student',
      firstName: 'Cardo',
      lastName: 'Cruz',
      name: 'Cardo Cruz',
      birthday: '2004-05-15',
      permanentAddress: '123 Main St, City',
      presentAddress: '123 Main St, City',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Maria', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09987654321',
    } as User;
    expect(isProfileComplete(student)).toBe(true);
  });

  it('returns true for student with guardian info when hasGuardianOnly is true', () => {
    const student = {
      role: 'student',
      firstName: 'Cardo',
      lastName: 'Santos',
      name: 'Cardo Santos',
      birthday: '2004-05-15',
      permanentAddress: '123 Main St, City',
      presentAddress: '456 College Dorm, City',
      sameAsPermanentAddress: false,
      contactNumber: '09123456789',
      hasGuardianOnly: true,
      guardianName: { firstName: 'Pedro', lastName: 'Santos' },
      parentContactNumber: '09987654321',
      yearLevel: 2,
    } as User;
    expect(isProfileComplete(student)).toBe(true);
  });

  it('returns true for faculty with 0 educational degrees (degrees are optional)', () => {
    const faculty = {
      role: 'faculty',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Dr. Maria Santos',
      address: '789 Faculty Village',
      contactNumber: '09112223333',
      birthday: '1985-10-20',
      yearsOfTeaching: 5,
      educationalBackground: []
    } as User;
    expect(isProfileComplete(faculty)).toBe(true);
  });

  it('returns false for faculty with missing years of teaching experience', () => {
    const faculty = {
      role: 'faculty',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Dr. Maria Santos',
      address: '789 Faculty Village',
      contactNumber: '09112223333',
      birthday: '1985-10-20',
      educationalBackground: []
    } as User;
    expect(isProfileComplete(faculty)).toBe(false);
  });

  it('returns true for faculty with complete background and years of teaching', () => {
    const faculty = {
      role: 'faculty',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Dr. Maria Santos',
      address: '789 Faculty Village',
      contactNumber: '09112223333',
      birthday: '1985-10-20',
      yearsOfTeaching: 5,
      educationalBackground: [
        {
          id: 'deg-1',
          degreeLevel: 'bachelors',
          school: 'DMMMSU',
          yearGraduated: 2007,
          specialization: 'Computer Science'
        }
      ]
    } as User;
    expect(isProfileComplete(faculty)).toBe(true);
  });

  it('returns false for null or undefined user', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });

  it('returns false for admin, dean, chair, and superadmin when credentials are missing', () => {
    const admin = { role: 'admin' } as User;
    const dean = { role: 'admin', adminSubrole: 'dean' } as User;
    const chair = { role: 'admin', adminSubrole: 'chairperson' } as User;
    const superadmin = { role: 'superadmin' } as User;

    expect(isProfileComplete(admin)).toBe(false);
    expect(isProfileComplete(dean)).toBe(false);
    expect(isProfileComplete(chair)).toBe(false);
    expect(isProfileComplete(superadmin)).toBe(false);
  });

  it('returns true for admin, dean, chair, and superadmin when credentials are complete', () => {
    const adminCredentials: Partial<User> = {
      firstName: 'Admin',
      lastName: 'Officer',
      name: 'Admin Officer',
      address: 'Admin Complex, Central Campus',
      contactNumber: '09198887777',
      birthday: '1978-08-12',
      yearsOfTeaching: 15,
      educationalBackground: [
        {
          id: 'deg-adm-1',
          degreeLevel: 'doctorate',
          school: 'University of the Philippines',
          yearGraduated: 2010,
          specialization: 'Educational Leadership',
        },
      ],
    };

    const admin = { role: 'admin', ...adminCredentials } as User;
    const dean = { role: 'admin', adminSubrole: 'dean', ...adminCredentials } as User;
    const chair = { role: 'faculty', adminSubrole: 'chairperson', ...adminCredentials } as User;
    const superadmin = { role: 'superadmin', ...adminCredentials } as User;

    expect(isProfileComplete(admin)).toBe(true);
    expect(isProfileComplete(dean)).toBe(true);
    expect(isProfileComplete(chair)).toBe(true);
    expect(isProfileComplete(superadmin)).toBe(true);
  });

  it('returns true for admin, dean, chair, and superadmin when address, contactNumber, and birthday are complete without degrees or teaching experience', () => {
    const adminStandardFields: Partial<User> = {
      firstName: 'Leader',
      lastName: 'Official',
      name: 'Leader Official',
      address: 'Admin Complex, Central Campus',
      contactNumber: '09198887777',
      birthday: '1978-08-12',
    };

    const admin = { role: 'admin', ...adminStandardFields } as User;
    const dean = { role: 'admin', adminSubrole: 'dean', ...adminStandardFields } as User;
    const chair = { role: 'faculty', adminSubrole: 'chairperson', ...adminStandardFields } as User;
    const superadmin = { role: 'superadmin', ...adminStandardFields } as User;

    expect(isProfileComplete(admin)).toBe(true);
    expect(isProfileComplete(dean)).toBe(true);
    expect(isProfileComplete(chair)).toBe(true);
    expect(isProfileComplete(superadmin)).toBe(true);
  });

  it('returns false for admin, dean, chair, and superadmin when address, contactNumber, or birthday is missing', () => {
    const missingBirthday: Partial<User> = {
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      name: 'Admin User',
      address: 'Admin Complex, Central Campus',
      contactNumber: '09198887777',
    };
    const missingContact: Partial<User> = {
      role: 'admin',
      adminSubrole: 'dean',
      firstName: 'Dean',
      lastName: 'CCS',
      name: 'Dean CCS',
      address: 'Admin Complex, Central Campus',
      birthday: '1978-08-12',
    };
    const missingAddress: Partial<User> = {
      role: 'superadmin',
      firstName: 'Chancellor',
      lastName: 'Executive',
      name: 'Chancellor Executive',
      contactNumber: '09198887777',
      birthday: '1978-08-12',
    };

    expect(isProfileComplete(missingBirthday as User)).toBe(false);
    expect(isProfileComplete(missingContact as User)).toBe(false);
    expect(isProfileComplete(missingAddress as User)).toBe(false);
  });

  it('returns false for student with hasGuardianOnly=false missing fatherName', () => {
    const student = {
      role: 'student',
      firstName: 'Cardo',
      lastName: 'Cruz',
      name: 'Cardo Cruz',
      birthday: '2004-05-15',
      permanentAddress: '123 Main St, City',
      presentAddress: '123 Main St, City',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Maria', lastName: 'Cruz' },
      parentContactNumber: '09987654321',
      yearLevel: 1,
    } as User;
    expect(isProfileComplete(student)).toBe(false);
  });

  it('returns true for staff with complete experience', () => {
    const staff = {
      role: 'staff',
      firstName: 'Staff',
      lastName: 'Member',
      name: 'Staff Member',
      address: '456 Admin St',
      contactNumber: '09223334444',
      birthday: '1990-01-15',
      yearsOfTeaching: 0,
    } as User;
    expect(isProfileComplete(staff)).toBe(true);
  });

  it('rejects future birthdays and requires previous dates', () => {
    const fixedToday = new Date('2026-10-18T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixedToday);

    const completeStudent: Partial<User> = {
      role: 'student',
      firstName: 'Cardo',
      lastName: 'Cruz',
      name: 'Cardo Cruz',
      permanentAddress: '123 Main St, City',
      presentAddress: '123 Main St, City',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Maria', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09987654321',
      yearLevel: 1,
    };

    try {
      // Valid past birthday
      expect(isProfileComplete({ ...completeStudent, birthday: '2004-05-15' } as User)).toBe(true);

      // Future birthday (e.g. tomorrow or 2027-02-27 as reported by user)
      expect(isProfileComplete({ ...completeStudent, birthday: '2027-02-27' } as User)).toBe(false);
      expect(isProfileComplete({ ...completeStudent, birthday: '2026-10-19' } as User)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats houseStreet as optional in isAddressComplete and profile completion', () => {
    const addressWithoutStreet = {
      barangay: 'Catbangen',
      municipalityCity: 'San Fernando',
      province: 'La Union',
    };
    expect(isAddressComplete(addressWithoutStreet)).toBe(true);

    expect(isAddressComplete({ ...addressWithoutStreet, houseStreet: '   ' })).toBe(true);

    expect(isAddressComplete({ ...addressWithoutStreet, barangay: '' })).toBe(false);
    expect(isAddressComplete({ ...addressWithoutStreet, municipalityCity: '' })).toBe(false);
    expect(isAddressComplete({ ...addressWithoutStreet, province: '' })).toBe(false);

    const student = {
      role: 'student',
      firstName: 'Cardo',
      lastName: 'Cruz',
      name: 'Cardo Cruz',
      birthday: '2004-05-15',
      permanentAddressDetails: addressWithoutStreet,
      presentAddressDetails: addressWithoutStreet,
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Maria', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09987654321',
      yearLevel: 1,
    } as User;
    expect(isProfileComplete(student)).toBe(true);

    const parsed3 = parseAddress('Catbangen, San Fernando, La Union');
    expect(parsed3.houseStreet).toBe('');
    expect(parsed3.barangay).toBe('Catbangen');
    expect(parsed3.municipalityCity).toBe('San Fernando');
    expect(parsed3.province).toBe('La Union');
    expect(isAddressComplete(parsed3)).toBe(true);
  });
});
