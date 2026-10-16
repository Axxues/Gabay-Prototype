import { describe, expect, it } from 'vitest';
import { getScopedCourses } from './courseScoping';
import type { Course, User, College, Department } from '../types/lms';

describe('getScopedCourses utility', () => {
  const colleges: College[] = [
    { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'u-dean-ccs' },
    { id: 'col-coe', name: 'College of Education', code: 'COED', deanId: 'u-dean-coe' },
  ];

  const departments: Department[] = [
    { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS', chairpersonId: 'u-chair-cs' },
    { id: 'dept-it', collegeId: 'col-ccs', name: 'Department of Information Technology', code: 'IT' },
    { id: 'dept-eled', collegeId: 'col-coe', name: 'Department of Elementary Education', code: 'ELED' },
  ];

  const users: User[] = [
    {
      id: 'u-chancellor',
      name: 'Jayvee Reyes',
      email: 'jayveegenetareyes@gmail.com',
      role: 'superadmin',
      adminSubrole: 'chancellor',
      title: 'University Chancellor',
      department: 'Office of the Chancellor',
      avatar: '',
    },
    {
      id: 'u-dean-ccs',
      name: 'Dean CCS',
      email: 'dean.ccs@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'College of Computer Science',
      title: 'Dean',
      avatar: '',
    },
    {
      id: 'u-chair-cs',
      name: 'Chair CS',
      email: 'chair.cs@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'chairperson',
      collegeId: 'col-ccs',
      department: 'Department of Computer Science',
      title: 'Department Chair',
      avatar: '',
    },
    {
      id: 'u-fac-cs',
      name: 'Faculty CS',
      email: 'fac.cs@dmmmsu.edu.ph',
      role: 'faculty',
      collegeId: 'col-ccs',
      department: 'Department of Computer Science',
      title: 'Instructor',
      avatar: '',
    },
    {
      id: 'u-fac-it',
      name: 'Faculty IT',
      email: 'fac.it@dmmmsu.edu.ph',
      role: 'faculty',
      collegeId: 'col-ccs',
      department: 'Department of Information Technology',
      title: 'Instructor',
      avatar: '',
    },
    {
      id: 'u-fac-coe',
      name: 'Faculty COE',
      email: 'fac.coe@dmmmsu.edu.ph',
      role: 'faculty',
      collegeId: 'col-coe',
      department: 'Department of Elementary Education',
      title: 'Instructor',
      avatar: '',
    },
    {
      id: 'u-stud-1',
      name: 'Student One',
      email: 'stud1@dmmmsu.edu.ph',
      role: 'student',
      department: 'Department of Computer Science',
      title: 'Student',
      avatar: '',
      enrolledCourseIds: ['crs-cs101'],
    },
  ];

  const courses: Course[] = [
    {
      id: 'crs-cs101',
      code: 'CS 101',
      title: 'Intro to CS',
      section: '1A',
      term: '1st Sem',
      instructorId: 'u-fac-cs',
      instructorName: 'Faculty CS',
      published: true,
      enrolledCount: 25,
    },
    {
      id: 'crs-it201',
      code: 'IT 201',
      title: 'Web Systems',
      section: '2B',
      term: '1st Sem',
      instructorId: 'u-fac-it',
      instructorName: 'Faculty IT',
      published: true,
      enrolledCount: 20,
    },
    {
      id: 'crs-coe301',
      code: 'EDUC 301',
      title: 'Teaching Principles',
      section: '3A',
      term: '1st Sem',
      instructorId: 'u-fac-coe',
      instructorName: 'Faculty COE',
      published: true,
      enrolledCount: 15,
    },
    {
      id: 'crs-dean-special',
      code: 'CCS 400',
      title: 'Dean Seminar',
      section: '4A',
      term: '1st Sem',
      instructorId: 'u-dean-ccs',
      instructorName: 'Dean CCS',
      published: true,
      enrolledCount: 10,
    },
  ];

  it('superadmin sees all courses across all colleges', () => {
    const chancellor = users.find(u => u.id === 'u-chancellor')!;
    const scoped = getScopedCourses({
      courses,
      users,
      activeUser: chancellor,
      activeRole: 'superadmin',
      colleges,
      departments,
    });
    expect(scoped).toHaveLength(4);
    expect(scoped.map(c => c.id)).toEqual(['crs-cs101', 'crs-it201', 'crs-coe301', 'crs-dean-special']);
  });

  it('dean sees courses where instructor belongs to their college (CS and IT) plus own courses, but not COE courses', () => {
    const deanCCS = users.find(u => u.id === 'u-dean-ccs')!;
    const scoped = getScopedCourses({
      courses,
      users,
      activeUser: deanCCS,
      activeRole: 'admin',
      colleges,
      departments,
    });
    const ids = scoped.map(c => c.id);
    expect(ids).toContain('crs-cs101'); // instructor in CCS CS dept
    expect(ids).toContain('crs-it201'); // instructor in CCS IT dept
    expect(ids).toContain('crs-dean-special'); // own course
    expect(ids).not.toContain('crs-coe301'); // instructor in COE
  });

  it('chairperson sees courses where instructor belongs to their department plus own courses, but not other departments', () => {
    const chairCS = users.find(u => u.id === 'u-chair-cs')!;
    const scoped = getScopedCourses({
      courses,
      users,
      activeUser: chairCS,
      activeRole: 'admin',
      colleges,
      departments,
    });
    const ids = scoped.map(c => c.id);
    expect(ids).toContain('crs-cs101'); // instructor in CS dept
    expect(ids).not.toContain('crs-it201'); // instructor in IT dept
    expect(ids).not.toContain('crs-coe301'); // instructor in COE
  });

  it('always includes courses where course.instructorId === activeUser.id', () => {
    const chairCS = users.find(u => u.id === 'u-chair-cs')!;
    const courseAuthoredByChair: Course = {
      id: 'crs-chair-course',
      code: 'CS 999',
      title: 'Chair Authored Course',
      section: '1A',
      term: '1st Sem',
      instructorId: 'u-chair-cs',
      instructorName: 'Chair CS',
      published: true,
      enrolledCount: 5,
    };
    const scoped = getScopedCourses({
      courses: [...courses, courseAuthoredByChair],
      users,
      activeUser: chairCS,
      activeRole: 'admin',
      colleges,
      departments,
    });
    expect(scoped.map(c => c.id)).toContain('crs-chair-course');
  });

  it('faculty sees only courses where course.instructorId === activeUser.id', () => {
    const facCS = users.find(u => u.id === 'u-fac-cs')!;
    const scoped = getScopedCourses({
      courses,
      users,
      activeUser: facCS,
      activeRole: 'faculty',
      colleges,
      departments,
    });
    expect(scoped.map(c => c.id)).toEqual(['crs-cs101']);
  });

  it('student sees only enrolled courses or approved requests', () => {
    const student = users.find(u => u.id === 'u-stud-1')!;
    const scoped = getScopedCourses({
      courses,
      users,
      activeUser: student,
      activeRole: 'student',
      approvedCourseIds: new Set(['crs-it201']),
      colleges,
      departments,
    });
    const ids = scoped.map(c => c.id);
    expect(ids).toContain('crs-cs101'); // from enrolledCourseIds
    expect(ids).toContain('crs-it201'); // from approvedCourseIds
    expect(ids).not.toContain('crs-coe301');
    expect(ids).not.toContain('crs-dean-special');
  });
});
