import { describe, expect, it } from 'vitest';
import { getDisplayRoleLabel, isDeanRole, isChairRole, compareUsersByAuthority } from './roles';

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
});
