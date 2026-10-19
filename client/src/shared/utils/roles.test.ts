import { describe, expect, it } from 'vitest';
import {
  getDisplayRoleLabel,
  isDeanRole,
  isChairRole,
  compareUsersByAuthority,
  canCreateCourse,
  isAdministrativeMonitor,
} from './roles';

describe('roles utility', () => {
  it('returns Admin for superadmin role or chancellor subrole', () => {
    expect(getDisplayRoleLabel({ role: 'superadmin' })).toBe('Admin');
    expect(getDisplayRoleLabel({ role: 'admin', adminSubrole: 'chancellor' })).toBe('Admin');
    expect(getDisplayRoleLabel({ role: 'admin', title: 'University Chancellor' })).toBe('Admin');
  });

  it('returns Dean for admin with dean subrole or dean in title', () => {
    expect(getDisplayRoleLabel({ role: 'admin', adminSubrole: 'dean' })).toBe('Dean');
    expect(getDisplayRoleLabel({ role: 'admin', title: 'College Dean' })).toBe('Dean');
    expect(getDisplayRoleLabel({ role: 'admin', title: 'Dean of College of Science' })).toBe('Dean');
    expect(isDeanRole({ role: 'admin', adminSubrole: 'dean' })).toBe(true);
  });

  it('returns Chair for admin with chairperson subrole or chair in title', () => {
    expect(getDisplayRoleLabel({ role: 'admin', adminSubrole: 'chairperson' })).toBe('Chair');
    expect(getDisplayRoleLabel({ role: 'admin', title: 'Department Chairperson' })).toBe('Chair');
    expect(getDisplayRoleLabel({ role: 'admin', title: 'Department Chair' })).toBe('Chair');
    expect(isChairRole({ role: 'admin', adminSubrole: 'chairperson' })).toBe(true);
  });

  it('returns Admin for generic admin without dean/chair subrole or title', () => {
    expect(getDisplayRoleLabel({ role: 'admin' })).toBe('Admin');
    expect(getDisplayRoleLabel({ role: 'admin', title: 'System Administrator' })).toBe('Admin');
  });

  it('returns standard roles for faculty, staff, student', () => {
    expect(getDisplayRoleLabel({ role: 'faculty' })).toBe('Faculty');
    expect(getDisplayRoleLabel({ role: 'staff' })).toBe('Staff');
    expect(getDisplayRoleLabel({ role: 'student' })).toBe('Student');
  });

  it('falls back gracefully when user is null or undefined', () => {
    expect(getDisplayRoleLabel(null, 'admin')).toBe('Admin');
    expect(getDisplayRoleLabel(undefined, 'faculty')).toBe('Faculty');
    expect(getDisplayRoleLabel(null)).toBe('User');
  });

  it('correctly ranks and sorts users by authority: admin -> dean -> chair -> faculty -> staff -> student', () => {
    const users = [
      { name: 'Student Zach', role: 'student' },
      { name: 'Faculty Bob', role: 'faculty' },
      { name: 'Chancellor Alice', role: 'superadmin', adminSubrole: 'chancellor' },
      { name: 'Staff Dan', role: 'staff' },
      { name: 'Chair Carol', role: 'admin', adminSubrole: 'chairperson' },
      { name: 'Dean Eleanor', role: 'admin', adminSubrole: 'dean' },
      { name: 'Admin Zoe', role: 'admin' },
    ];

    const sorted = [...users].sort(compareUsersByAuthority);
    expect(sorted.map(u => u.name)).toEqual([
      'Admin Zoe',
      'Chancellor Alice',
      'Dean Eleanor',
      'Chair Carol',
      'Faculty Bob',
      'Staff Dan',
      'Student Zach',
    ]);
  });

  it('handles dedicated dean and chairperson roles directly', () => {
    expect(getDisplayRoleLabel({ role: 'dean' })).toBe('Dean');
    expect(isDeanRole({ role: 'dean' })).toBe(true);

    expect(getDisplayRoleLabel({ role: 'chairperson' })).toBe('Chair');
    expect(isChairRole({ role: 'chairperson' })).toBe(true);
    expect(isChairRole({ role: 'chair' })).toBe(true);
  });

  it('evaluates canCreateCourse strictly: true only for Chairperson (via Chair-Sheet)', () => {
    expect(canCreateCourse({ role: 'chairperson' })).toBe(true);
    expect(canCreateCourse({ role: 'admin', adminSubrole: 'chairperson' })).toBe(true);

    // Faculty cannot manually create courses
    expect(canCreateCourse({ role: 'faculty' })).toBe(false);
    // Dean cannot create courses
    expect(canCreateCourse({ role: 'dean' })).toBe(false);
    expect(canCreateCourse({ role: 'admin', adminSubrole: 'dean' })).toBe(false);
    // Admin cannot create courses
    expect(canCreateCourse({ role: 'admin' })).toBe(false);
    expect(canCreateCourse({ role: 'superadmin' })).toBe(false);
    // Students/staff cannot create courses
    expect(canCreateCourse({ role: 'student' })).toBe(false);
    expect(canCreateCourse({ role: 'staff' })).toBe(false);
  });

  it('evaluates isAdministrativeMonitor: true for Admin, Dean, Chairperson', () => {
    expect(isAdministrativeMonitor({ role: 'admin' })).toBe(true);
    expect(isAdministrativeMonitor({ role: 'superadmin' })).toBe(true);
    expect(isAdministrativeMonitor({ role: 'dean' })).toBe(true);
    expect(isAdministrativeMonitor({ role: 'chairperson' })).toBe(true);
    expect(isAdministrativeMonitor({ role: 'admin', adminSubrole: 'chairperson' })).toBe(true);

    expect(isAdministrativeMonitor({ role: 'faculty' })).toBe(false);
    expect(isAdministrativeMonitor({ role: 'student' })).toBe(false);
    expect(isAdministrativeMonitor({ role: 'staff' })).toBe(false);
  });
});
