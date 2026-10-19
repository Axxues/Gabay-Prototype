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
      id: 'u-admin-gen',
      name: 'University Admin',
      email: 'admin@dmmmsu.edu.ph',
      role: 'admin',
      title: 'Administrator',
      avatar: '',
    },
    {
      id: 'u-dean-ccs',
      name: 'Dean CCS',
      email: 'dean.ccs@dmmmsu.edu.ph',
      role: 'dean',
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
      role: 'chairperson',
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
      department: 'Department of Computer Science',
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
      department: 'Department of Information Technology',
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
      department: 'Department of Elementary Education',
      published: true,
      enrolledCount: 15,
    },
    {
      id: 'crs-cs302',
      code: 'CS 302',
      title: 'Algorithms',
      section: '3A',
      term: '1st Sem',
      instructorId: 'u-fac-cs',
      instructorName: 'Faculty CS',
      department: 'Department of Computer Science',
      published: true,
      enrolledCount: 18,
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
    expect(scoped.map(c => c.id)).toEqual(['crs-cs101', 'crs-it201', 'crs-coe301', 'crs-cs302']);
  });

  it('admin sees all courses university-wide and can filter by college and program', () => {
    const admin = users.find(u => u.id === 'u-admin-gen')!;
    const allUniversity = getScopedCourses({
      courses,
      users,
      activeUser: admin,
      activeRole: 'admin',
      colleges,
      departments,
    });
    expect(allUniversity).toHaveLength(4);

    // Filter by CCS college
    const ccsOnly = getScopedCourses({
      courses,
      users,
      activeUser: admin,
      activeRole: 'admin',
      colleges,
      departments,
      selectedCollegeId: 'col-ccs',
    });
    expect(ccsOnly.map(c => c.id)).toEqual(['crs-cs101', 'crs-it201', 'crs-cs302']);

    // Filter by CS program under CCS
    const csOnly = getScopedCourses({
      courses,
      users,
      activeUser: admin,
      activeRole: 'admin',
      colleges,
      departments,
      selectedCollegeId: 'col-ccs',
      selectedProgramId: 'dept-cs',
    });
    expect(csOnly.map(c => c.id)).toEqual(['crs-cs101', 'crs-cs302']);
  });

  it('dean sees courses throughout their college (CS and IT) but not other colleges, and can filter by program', () => {
    const deanCCS = users.find(u => u.id === 'u-dean-ccs')!;
    const scoped = getScopedCourses({
      courses,
      users,
      activeUser: deanCCS,
      activeRole: 'dean',
      colleges,
      departments,
    });
    const ids = scoped.map(c => c.id);
    expect(ids).toContain('crs-cs101');
    expect(ids).toContain('crs-it201');
    expect(ids).toContain('crs-cs302');
    expect(ids).not.toContain('crs-coe301'); // COE course excluded

    // Program tab filter for IT
    const itOnly = getScopedCourses({
      courses,
      users,
      activeUser: deanCCS,
      activeRole: 'dean',
      colleges,
      departments,
      selectedProgramId: 'dept-it',
    });
    expect(itOnly.map(c => c.id)).toEqual(['crs-it201']);
  });

  it('chairperson sees courses only in their handled program, never other programs', () => {
    const chairCS = users.find(u => u.id === 'u-chair-cs')!;
    const scoped = getScopedCourses({
      courses,
      users,
      activeUser: chairCS,
      activeRole: 'chairperson',
      colleges,
      departments,
    });
    const ids = scoped.map(c => c.id);
    expect(ids).toEqual(['crs-cs101', 'crs-cs302']);
    expect(ids).not.toContain('crs-it201');
    expect(ids).not.toContain('crs-coe301');
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
    expect(scoped.map(c => c.id)).toEqual(['crs-cs101', 'crs-cs302']);
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
  });

  it('matches assigned courses by code prefix and normalized department names under their college filter', () => {
    const csDept = departments.find(d => d.id === 'dept-cs')!;
    const itDept = departments.find(d => d.id === 'dept-it')!;

    const assignedCourses: Course[] = [
      {
        id: 'c-1',
        code: 'CSCC 103',
        title: 'Object Oriented Programming',
        section: '4-E',
        term: '1st Sem AY 2026-2027',
        instructorId: 'u-fac-cs',
        instructorName: 'Charlie Marzan',
        published: true,
        enrolledCount: 0,
      },
      {
        id: 'c-2',
        code: 'CCSC 303',
        title: 'Computer Programming 1',
        section: '1-A',
        term: 'Midyear AY 2026-2027',
        instructorId: 'u-fac-cs',
        instructorName: 'Cherlie Marzan',
        published: true,
        enrolledCount: 0,
      },
      {
        id: 'c-3',
        code: 'CSPC 112',
        title: 'Software Engineering 2',
        section: '4-E',
        term: '2nd Sem AY 2026-2027',
        instructorId: 'u-fac-cs',
        instructorName: 'Raymund Dilan',
        published: true,
        enrolledCount: 0,
      },
      {
        id: 'c-4',
        code: 'ITEC 101',
        title: 'Living in the IT Era',
        section: 'BSIT 1-A',
        term: '1st Sem AY 2026-2027',
        instructorId: 'u-fac-it',
        instructorName: 'Faculty IT',
        published: true,
        enrolledCount: 0,
      },
    ];

    const deanCCS = users.find(u => u.id === 'u-dean-ccs')!;

    // Dean sees all 4 courses under their college
    const allColCourses = getScopedCourses({
      courses: assignedCourses,
      users,
      activeUser: deanCCS,
      activeRole: 'dean',
      colleges,
      departments,
      selectedProgramId: 'all',
    });
    expect(allColCourses).toHaveLength(4);

    // Dean filters by CS program tab -> sees all 3 CS courses
    const csFiltered = getScopedCourses({
      courses: assignedCourses,
      users,
      activeUser: deanCCS,
      activeRole: 'dean',
      colleges,
      departments,
      selectedProgramId: 'dept-cs',
    });
    expect(csFiltered.map(c => c.id)).toEqual(['c-1', 'c-2', 'c-3']);

    // Dean filters by IT program tab -> sees only ITEC course
    const itFiltered = getScopedCourses({
      courses: assignedCourses,
      users,
      activeUser: deanCCS,
      activeRole: 'dean',
      colleges,
      departments,
      selectedProgramId: 'dept-it',
    });
    expect(itFiltered.map(c => c.id)).toEqual(['c-4']);
  });
});
