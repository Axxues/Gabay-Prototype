// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const directoryRows = [
  {
    id: 'u-chair',
    first_name: 'Marcus',
    last_name: 'Brody',
    email: 'chair1@dmmmsu.edu.ph',
    role: { name: 'Chairperson' },
    department: 'Department of Computer Science',
    title: 'Department Chairperson',
  },
  {
    id: 'u-dean',
    first_name: 'Eleanor',
    last_name: 'Vance',
    email: 'dean1@dmmmsu.edu.ph',
    role: { name: 'Dean' },
    department: 'College of Computer Science',
    title: 'College Dean',
  },
  {
    id: 'u-fac1',
    first_name: 'Faculty',
    last_name: 'Instructor 1',
    email: 'faculty1@dmmmsu.edu.ph',
    role: { name: 'Faculty' },
  },
  {
    id: 'u-stud1',
    first_name: 'Student',
    last_name: 'Scholar 1',
    email: 'student1@dmmmsu.edu.ph',
    role: { name: 'Student' },
  },
  {
    id: 'u-staff1',
    first_name: 'Staff',
    last_name: 'Registrar 1',
    email: 'staff1@dmmmsu.edu.ph',
    role: { name: 'Staff' },
  },
];

const loginLikhaMock = vi.fn(async () => ({
  token: 't-admin',
  user: {
    id: 'u-chancellor',
    first_name: 'Jayvee',
    last_name: 'Admin',
    email: 'chancellor@dmmmsu.edu.ph',
    role: { name: 'Administrator' },
  },
}));

const getCoursesMock = vi.fn(async () => []);
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => directoryRows);
const getCollegesMock = vi.fn(async () => [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', dean_id: 'u-dean' },
]);
const getDepartmentsMock = vi.fn(async () => [
  { id: 'dept-cs', college_id: 'col-ccs', name: 'Department of Computer Science', code: 'CS', chairperson_id: 'u-chair' },
]);

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  getToken: () => null,
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: vi.fn(async () => ({})),
  likhaLmsApi: {
    loginLikhaUser: (...args: any[]) => (loginLikhaMock as any)(...args),
    getCoursesWithRelations: (...args: any[]) => (getCoursesMock as any)(...args),
    getNotifications: (...args: any[]) => (getNotifsMock as any)(...args),
    users: {
      getUsers: (...args: any[]) => (getUsersMock as any)(...args),
    },
    academicStructure: {
      getColleges: (...args: any[]) => (getCollegesMock as any)(...args),
      getDepartments: (...args: any[]) => (getDepartmentsMock as any)(...args),
    },
    communications: {
      getMessages: vi.fn(async () => []),
      getCalendarEvents: vi.fn(async () => []),
      getChatGroups: vi.fn(async () => []),
      getAdvisingSlots: vi.fn(async () => []),
    },
    requests: {
      getRequests: vi.fn(async () => []),
    },
    sections: {
      getSections: vi.fn(async () => []),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let doLogin: (() => Promise<any>) | null = null;
let seenUsers: any[] | null = null;

const Probe: React.FC = () => {
  const { db, login } = useLMS();
  seenUsers = db.users as any[];
  doLogin = () => login('chancellor@dmmmsu.edu.ph', 'pw');
  return null;
};

describe('Institutional Academic Hierarchy Affiliations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    doLogin = null;
    seenUsers = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('affiliates accounts with College of Computer Science & Department of Computer Science', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await act(async () => {
      await doLogin!();
    });

    await waitFor(() => {
      expect((seenUsers || []).length).toBe(6); // chancellor + 5 directory rows
    });

    const userByEmail = Object.fromEntries(
      (seenUsers || []).map((u: any) => [u.email, u])
    );

    // 1. Chancellor: Office of the Chancellor
    const chancellor = userByEmail['chancellor@dmmmsu.edu.ph'];
    expect(chancellor).toBeDefined();
    expect(chancellor.department).toBe('Office of the Chancellor');

    // 2. Demo Dean: College of Computer Science
    const dean = userByEmail['dean1@dmmmsu.edu.ph'];
    expect(dean).toBeDefined();
    expect(dean.collegeName).toBe('College of Computer Science');

    // 3. Demo Chair: Department of Computer Science
    const chair = userByEmail['chair1@dmmmsu.edu.ph'];
    expect(chair).toBeDefined();
    expect(chair.collegeName).toBe('College of Computer Science');
    expect(chair.department).toBe('Department of Computer Science');

    // 4. Faculty: bound to College of Computer Science & Department of Computer Science
    const faculty = userByEmail['faculty1@dmmmsu.edu.ph'];
    expect(faculty).toBeDefined();
    expect(faculty.collegeName).toBe('College of Computer Science');
    expect(faculty.department).toBe('Department of Computer Science');

    // 5. Student: bound to College of Computer Science & Department of Computer Science
    const student = userByEmail['student1@dmmmsu.edu.ph'];
    expect(student).toBeDefined();
    expect(student.collegeName).toBe('College of Computer Science');
    expect(student.department).toBe('Department of Computer Science');

    // 6. Staff: bound to College of Computer Science & Department of Computer Science
    const staff = userByEmail['staff1@dmmmsu.edu.ph'];
    expect(staff).toBeDefined();
    expect(staff.collegeName).toBe('College of Computer Science');
    expect(staff.department).toBe('Department of Computer Science');
  });
});
