// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import type { User, SchoolYear } from '../types/lms';

const mockCourses: any[] = [];

const mockUsers: any[] = [
  {
    id: 'u-stud-1',
    first_name: 'Freshman',
    last_name: 'Student',
    email: 'freshman@dmmmsu.edu.ph',
    role: { name: 'Student' },
    college_id: 'col-ccs',
    year_level: 1,
  },
  {
    id: 'u-stud-4',
    first_name: 'Senior',
    last_name: 'Student',
    email: 'senior@dmmmsu.edu.ph',
    role: { name: 'Student' },
    college_id: 'col-ccs',
    year_level: 4,
  },
  {
    id: 'u-stud-undef',
    first_name: 'Unspecified',
    last_name: 'Student',
    email: 'unspec_student@dmmmsu.edu.ph',
    role: { name: 'Student' },
    college_id: 'col-ccs',
  },
  {
    id: 'u-stud-other',
    first_name: 'Engineering',
    last_name: 'Student',
    email: 'eng_student@dmmmsu.edu.ph',
    role: { name: 'Student' },
    college_id: 'col-coe',
    year_level: 2,
  },
  {
    id: 'u-fac-1',
    first_name: 'Faculty',
    last_name: 'Experienced',
    email: 'prof@dmmmsu.edu.ph',
    role: { name: 'Faculty' },
    college_id: 'col-ccs',
    years_of_teaching: 3,
  },
  {
    id: 'u-fac-new',
    first_name: 'Faculty',
    last_name: 'New',
    email: 'newfac@dmmmsu.edu.ph',
    role: { name: 'Faculty' },
    college_id: 'col-ccs',
  },
  {
    id: 'u-fac-other',
    first_name: 'Engineering',
    last_name: 'Faculty',
    email: 'engfac@dmmmsu.edu.ph',
    role: { name: 'Faculty' },
    college_id: 'col-coe',
    years_of_teaching: 5,
  },
  {
    id: 'u-staff-1',
    first_name: 'Staff',
    last_name: 'Member',
    email: 'staff@dmmmsu.edu.ph',
    role: { name: 'Staff' },
    college_id: 'col-ccs',
    years_of_teaching: 2,
  },
  {
    id: 'u-dean-ccs',
    first_name: 'Dean',
    last_name: 'Alan',
    email: 'dean.ccs@dmmmsu.edu.ph',
    role: { name: 'Admin' },
    admin_subrole: 'dean',
    college_id: 'col-ccs',
    years_of_teaching: 12,
  },
  {
    id: 'u-chair-cs',
    first_name: 'Chair',
    last_name: 'Grace',
    email: 'chair.cs@dmmmsu.edu.ph',
    role: { name: 'Admin' },
    admin_subrole: 'chairperson',
    college_id: 'col-ccs',
    years_of_teaching: 8,
  },
];

const loginLikhaMock = vi.fn(async (email: string) => {
  const found = mockUsers.find(u => u.email === email) || mockUsers[0];
  return {
    token: `token-${found.id}`,
    user: found,
  };
});

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
    getCoursesWithRelations: vi.fn(async () => mockCourses),
    getNotifications: vi.fn(async () => []),
    users: {
      getUsers: vi.fn(async () => mockUsers),
      resolveRoleId: vi.fn(async () => 'role-uuid'),
      updateUser: vi.fn(async () => ({})),
    },
    academicStructure: {
      getColleges: vi.fn(async () => [
        { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' },
        { id: 'col-coe', name: 'College of Engineering', code: 'COE' },
      ]),
      getDepartments: vi.fn(async () => [
        { id: 'dept-cs', college_id: 'col-ccs', name: 'Department of Computer Science', code: 'CS' },
        { id: 'dept-eng', college_id: 'col-coe', name: 'Department of Engineering', code: 'ENG' },
      ]),
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
    courses: {
      createCourse: vi.fn(async (payload: any) => ({ id: 'crs-new', ...payload })),
      updateCourse: vi.fn(async () => ({})),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS, STORAGE_KEY_DB } from './LMSContext';

describe('School Year Rollover Auto-Increment in LMSContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {}
  });

  test('auto-increments student yearLevel capped at 4 and faculty/staff yearsOfTeaching, preserves other colleges, and updates currentUser and storage', async () => {
    let contextValues: any = null;
    const Probe = () => {
      contextValues = useLMS();
      return null;
    };

    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    // Login as freshman student (u-stud-1)
    await act(async () => {
      await contextValues.login('freshman@dmmmsu.edu.ph', 'pw');
    });

    await waitFor(() => {
      expect(contextValues.db.users.length).toBeGreaterThanOrEqual(8);
      expect(contextValues.currentUser?.id).toBe('u-stud-1');
    });

    // Verify initial values before rollover
    const stud1Before = contextValues.db.users.find((u: User) => u.id === 'u-stud-1');
    const stud4Before = contextValues.db.users.find((u: User) => u.id === 'u-stud-4');
    const studUndefBefore = contextValues.db.users.find((u: User) => u.id === 'u-stud-undef');
    const studOtherBefore = contextValues.db.users.find((u: User) => u.id === 'u-stud-other');
    const fac1Before = contextValues.db.users.find((u: User) => u.id === 'u-fac-1');
    const facNewBefore = contextValues.db.users.find((u: User) => u.id === 'u-fac-new');
    const facOtherBefore = contextValues.db.users.find((u: User) => u.id === 'u-fac-other');
    const staff1Before = contextValues.db.users.find((u: User) => u.id === 'u-staff-1');
    const deanBefore = contextValues.db.users.find((u: User) => u.id === 'u-dean-ccs');
    const chairBefore = contextValues.db.users.find((u: User) => u.id === 'u-chair-cs');

    expect(stud1Before?.yearLevel).toBe(1);
    expect(stud4Before?.yearLevel).toBe(4);
    expect(studUndefBefore?.yearLevel).toBeUndefined();
    expect(studOtherBefore?.yearLevel).toBe(2);
    expect(fac1Before?.yearsOfTeaching).toBe(3);
    expect(facNewBefore?.yearsOfTeaching).toBeUndefined();
    expect(facOtherBefore?.yearsOfTeaching).toBe(5);
    expect(staff1Before?.yearsOfTeaching).toBe(2);
    expect(deanBefore?.yearsOfTeaching).toBe(12);
    expect(chairBefore?.yearsOfTeaching).toBe(8);
    expect(contextValues.currentUser?.yearLevel).toBe(1);

    // Add target rollover year and set as baseline
    await act(async () => {
      await contextValues.addSchoolYear('2026-2027');
      await contextValues.setBaselineSchoolYear('2026-2027');
    });

    // Perform school year rollover for col-ccs
    await act(async () => {
      const res = await contextValues.setActiveSchoolYear('col-ccs', '2026-2027');
      expect(res.success).toBe(true);
    });

    // Check db.users after rollover
    const stud1After = contextValues.db.users.find((u: User) => u.id === 'u-stud-1');
    const stud4After = contextValues.db.users.find((u: User) => u.id === 'u-stud-4');
    const studUndefAfter = contextValues.db.users.find((u: User) => u.id === 'u-stud-undef');
    const studOtherAfter = contextValues.db.users.find((u: User) => u.id === 'u-stud-other');
    const fac1After = contextValues.db.users.find((u: User) => u.id === 'u-fac-1');
    const facNewAfter = contextValues.db.users.find((u: User) => u.id === 'u-fac-new');
    const facOtherAfter = contextValues.db.users.find((u: User) => u.id === 'u-fac-other');
    const staff1After = contextValues.db.users.find((u: User) => u.id === 'u-staff-1');
    const deanAfter = contextValues.db.users.find((u: User) => u.id === 'u-dean-ccs');
    const chairAfter = contextValues.db.users.find((u: User) => u.id === 'u-chair-cs');

    // Student year 1 -> 2
    expect(stud1After?.yearLevel).toBe(2);
    // Student year 4 -> capped at 4
    expect(stud4After?.yearLevel).toBe(4);
    // Student undefined -> (undefined ?? 1) + 1 = 2
    expect(studUndefAfter?.yearLevel).toBe(2);
    // Student in col-coe -> remains 2
    expect(studOtherAfter?.yearLevel).toBe(2);
    // Faculty with 3 years -> 4
    expect(fac1After?.yearsOfTeaching).toBe(4);
    // Faculty with undefined/0 years -> 1
    expect(facNewAfter?.yearsOfTeaching).toBe(1);
    // Faculty in col-coe -> remains 5
    expect(facOtherAfter?.yearsOfTeaching).toBe(5);
    // Staff with 2 years -> 3
    expect(staff1After?.yearsOfTeaching).toBe(3);
    // Dean with 12 years -> 13
    expect(deanAfter?.yearsOfTeaching).toBe(13);
    // Chair with 8 years -> 9
    expect(chairAfter?.yearsOfTeaching).toBe(9);

    // currentUser (u-stud-1) is affected by rollover, should also be updated
    expect(contextValues.currentUser?.yearLevel).toBe(2);

    // localStorage STORAGE_KEY_DB persistence check
    const rawSavedDb = localStorage.getItem(STORAGE_KEY_DB);
    expect(rawSavedDb).toBeTruthy();
    const savedDb = JSON.parse(rawSavedDb!);
    const savedStud1 = savedDb.users.find((u: User) => u.id === 'u-stud-1');
    const savedStud4 = savedDb.users.find((u: User) => u.id === 'u-stud-4');
    const savedFac1 = savedDb.users.find((u: User) => u.id === 'u-fac-1');
    const savedOther = savedDb.users.find((u: User) => u.id === 'u-stud-other');
    expect(savedStud1?.yearLevel).toBe(2);
    expect(savedStud4?.yearLevel).toBe(4);
    expect(savedFac1?.yearsOfTeaching).toBe(4);
    expect(savedOther?.yearLevel).toBe(2);
  });

  test('does not increment users of other colleges when a different college rolls over', async () => {
    let contextValues: any = null;
    const Probe = () => {
      contextValues = useLMS();
      return null;
    };

    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    // Login as engineering faculty in col-coe
    await act(async () => {
      await contextValues.login('engfac@dmmmsu.edu.ph', 'pw');
    });

    await waitFor(() => {
      expect(contextValues.currentUser?.id).toBe('u-fac-other');
    });

    await act(async () => {
      await contextValues.addSchoolYear('2026-2027');
      await contextValues.setBaselineSchoolYear('2026-2027');
    });

    // Rollover col-coe only
    await act(async () => {
      const res = await contextValues.setActiveSchoolYear('col-coe', '2026-2027');
      expect(res.success).toBe(true);
    });

    // Check col-coe users incremented
    const engStud = contextValues.db.users.find((u: User) => u.id === 'u-stud-other');
    const engFac = contextValues.db.users.find((u: User) => u.id === 'u-fac-other');
    expect(engStud?.yearLevel).toBe(3); // was 2 -> 3
    expect(engFac?.yearsOfTeaching).toBe(6); // was 5 -> 6
    expect(contextValues.currentUser?.yearsOfTeaching).toBe(6); // currentUser updated

    // Check col-ccs users were NOT incremented
    const ccsStud1 = contextValues.db.users.find((u: User) => u.id === 'u-stud-1');
    const ccsFac1 = contextValues.db.users.find((u: User) => u.id === 'u-fac-1');
    expect(ccsStud1?.yearLevel).toBe(1);
    expect(ccsFac1?.yearsOfTeaching).toBe(3);
  });
});
