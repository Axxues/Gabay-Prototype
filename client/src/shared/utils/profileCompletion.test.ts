import { describe, it, expect } from 'vitest';
import { isProfileComplete } from './profileCompletion';
import type { User } from '../types/lms';

describe('isProfileComplete', () => {
  it('returns false for newly registered student with missing fields', () => {
    const student = { role: 'student', yearLevel: 1 } as User;
    expect(isProfileComplete(student)).toBe(false);
  });

  it('returns true for student with all required profile information', () => {
    const student = {
      role: 'student',
      birthday: '2004-05-15',
      permanentAddress: '123 Main St, City',
      presentAddress: '123 Main St, City',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Maria', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09987654321',
      yearLevel: 1,
    } as User;
    expect(isProfileComplete(student)).toBe(true);
  });

  it('returns true for student with guardian info when hasGuardianOnly is true', () => {
    const student = {
      role: 'student',
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

  it('returns false for faculty with missing educational background', () => {
    const faculty = {
      role: 'faculty',
      address: '789 Faculty Village',
      contactNumber: '09112223333',
      birthday: '1985-10-20',
      yearsOfTeaching: 5,
      educationalBackground: []
    } as User;
    expect(isProfileComplete(faculty)).toBe(false);
  });

  it('returns true for faculty with complete background', () => {
    const faculty = {
      role: 'faculty',
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

  it('returns true for admin and superadmin without profile fields', () => {
    const admin = { role: 'admin' } as User;
    const superadmin = { role: 'superadmin' } as User;
    expect(isProfileComplete(admin)).toBe(true);
    expect(isProfileComplete(superadmin)).toBe(true);
  });

  it('returns false for student with hasGuardianOnly=false missing fatherName', () => {
    const student = {
      role: 'student',
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

  it('returns true for staff with complete background and experience', () => {
    const staff = {
      role: 'staff',
      address: '456 Admin St',
      contactNumber: '09223334444',
      birthday: '1990-01-15',
      yearsOfTeaching: 0,
      educationalBackground: [
        {
          id: 'deg-staff-1',
          degreeLevel: 'bachelors',
          school: 'DMMMSU',
          yearGraduated: 2012,
          specialization: 'Public Administration'
        }
      ]
    } as User;
    expect(isProfileComplete(staff)).toBe(true);
  });
});
