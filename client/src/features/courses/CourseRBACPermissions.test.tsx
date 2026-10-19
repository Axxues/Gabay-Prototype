// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { canManageCourseContent, isCourseAssignedInstructor } from '../../shared/utils/roles';
import type { Course, User } from '../../shared/types/lms';

describe('Course RBAC Permissions (canManageCourseContent)', () => {
  const course: Course = {
    id: 'crs-cmsc131',
    code: 'CMSC 131',
    title: 'Data Structures and Algorithms',
    instructorId: 'usr-fac-1',
    instructorName: 'Prof. Alice Rivera',
    schoolYear: '2025-2026',
    semester: 'First',
    term: '1st Sem AY 2025-2026',
    department: 'Computer Science',
    color: '#3b82f6',
    schedule: 'MWF 9:00-10:00 AM',
    room: 'Lab 3',
    units: 3,
  };

  const assignedFaculty: User = {
    id: 'usr-fac-1',
    name: 'Prof. Alice Rivera',
    email: 'alice@dmmmsu.edu.ph',
    role: 'faculty',
  };

  const unassignedFaculty: User = {
    id: 'usr-fac-2',
    name: 'Prof. Bob Smith',
    email: 'bob@dmmmsu.edu.ph',
    role: 'faculty',
  };

  const enrolledStudent: User = {
    id: 'usr-stu-1',
    name: 'Charlie Student',
    email: 'charlie@dmmmsu.edu.ph',
    role: 'student',
    enrolledCourseIds: ['crs-cmsc131'],
  };

  const deanUser: User = {
    id: 'usr-dean-1',
    name: 'Dr. Evelyn Dean',
    email: 'dean@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
  };

  const chairUser: User = {
    id: 'usr-chair-1',
    name: 'Dr. Marlon Chair',
    email: 'chair@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'chairperson',
  };

  const adminUser: User = {
    id: 'usr-admin-1',
    name: 'Super Admin',
    email: 'admin@dmmmsu.edu.ph',
    role: 'admin',
  };

  test('assigned faculty instructor has course management permission', () => {
    expect(isCourseAssignedInstructor(course, assignedFaculty)).toBe(true);
    expect(canManageCourseContent(course, assignedFaculty)).toBe(true);
  });

  test('unassigned faculty does NOT have course management permission', () => {
    expect(isCourseAssignedInstructor(course, unassignedFaculty)).toBe(false);
    expect(canManageCourseContent(course, unassignedFaculty)).toBe(false);
  });

  test('enrolled student does NOT have course management permission', () => {
    expect(isCourseAssignedInstructor(course, enrolledStudent)).toBe(false);
    expect(canManageCourseContent(course, enrolledStudent)).toBe(false);
  });

  test('Dean does NOT have course management permission (cannot create, edit, delete course content)', () => {
    expect(isCourseAssignedInstructor(course, deanUser)).toBe(false);
    expect(canManageCourseContent(course, deanUser)).toBe(false);
  });

  test('Chair does NOT have course management permission (cannot create, edit, delete course content)', () => {
    expect(isCourseAssignedInstructor(course, chairUser)).toBe(false);
    expect(canManageCourseContent(course, chairUser)).toBe(false);
  });

  test('Admin does NOT have course management permission (cannot create, edit, delete course content)', () => {
    expect(isCourseAssignedInstructor(course, adminUser)).toBe(false);
    expect(canManageCourseContent(course, adminUser)).toBe(false);
  });

  test('handles courses with instructor_id snake_case or nested instructor.id', () => {
    const courseSnake = { id: 'c2', instructor_id: 'usr-fac-1' } as any;
    expect(canManageCourseContent(courseSnake, assignedFaculty)).toBe(true);
    expect(canManageCourseContent(courseSnake, unassignedFaculty)).toBe(false);

    const courseNested = { id: 'c3', instructor: { id: 'usr-fac-1' } } as any;
    expect(canManageCourseContent(courseNested, assignedFaculty)).toBe(true);
    expect(canManageCourseContent(courseNested, adminUser)).toBe(false);
  });
});
