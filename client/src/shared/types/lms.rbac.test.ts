import { describe, it, expect } from 'vitest';
import type { College, Department, User, UserRole, AdminSubrole, PendingRegistration } from './lms';

describe('LMS RBAC & Hierarchy Types', () => {
  it('supports superadmin and extended user roles', () => {
    const roles: UserRole[] = ['superadmin', 'admin', 'faculty', 'staff', 'student'];
    expect(roles).toContain('superadmin');
  });

  it('correctly models a College and Department structure', () => {
    const college: College = {
      id: 'col-ccs',
      name: 'College of Computer Science',
      code: 'CCS',
      deanId: 'user-dean-1'
    };
    const dept: Department = {
      id: 'dept-it',
      collegeId: 'col-ccs',
      name: 'Department of Information Technology',
      code: 'IT',
      chairpersonId: 'user-chair-1'
    };
    expect(college.code).toBe('CCS');
    expect(dept.collegeId).toBe(college.id);
  });

  it('supports PendingRegistration with 30-day expiration fields', () => {
    const pending: PendingRegistration = {
      id: 'reg-1',
      firstName: 'Maria',
      lastName: 'Santos',
      fullName: 'Maria Santos',
      email: 'msantos@dmmmsu.edu.ph',
      role: 'faculty',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      studentId: '202-6001-1',
      password: 'password123',
      emailVerified: true,
      activationToken: 'token-abc',
      registeredAt: '2026-10-17T00:00:00.000Z',
      expiresAt: '2026-11-16T00:00:00.000Z',
      status: 'pending'
    };
    expect(pending.status).toBe('pending');
    expect(pending.emailVerified).toBe(true);
  });
});
