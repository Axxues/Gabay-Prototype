// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import type { SchoolYear, User, Course } from '../types/lms';

const loginLikhaMock = vi.fn(async () => ({
  token: 't-admin',
  user: {
    id: 'u-chancellor',
    first_name: 'Jayvee',
    last_name: 'Admin',
    email: 'jayveegenetareyes@gmail.com',
    role: { name: 'Administrator' },
  },
}));

const mockCourses: any[] = [
  {
    id: 'crs-1',
    code: 'CS 101',
    title: 'Intro to CS',
    section: 'BSCS 1-1',
    term: '1st Sem AY 2025-2026',
    instructor_name: 'Faculty Instructor',
    instructor_id: 'u-fac1',
    published: true,
  },
];

const mockUsers: any[] = [
  {
    id: 'u-stud1',
    first_name: 'Student',
    last_name: 'One',
    email: 'student1@dmmmsu.edu.ph',
    role: { name: 'Student' },
    college_id: 'col-ccs',
  },
  {
    id: 'u-dean1',
    first_name: 'Dean',
    last_name: 'CCS',
    email: 'dean.ccs@dmmmsu.edu.ph',
    role: { name: 'Administrator' },
    adminSubrole: 'dean',
    admin_subrole: 'dean',
    title: 'Dean of College of Computer Science',
    college_id: 'col-ccs',
  },
  {
    id: 'u-chair1',
    first_name: 'Chair',
    last_name: 'CS',
    email: 'chair.cs@dmmmsu.edu.ph',
    role: { name: 'Administrator' },
    adminSubrole: 'chairperson',
    admin_subrole: 'chairperson',
    title: 'Department Chair',
    college_id: 'col-ccs',
  },
];

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
    },
    academicStructure: {
      getColleges: vi.fn(async () => [
        { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' },
      ]),
      getDepartments: vi.fn(async () => [
        { id: 'dept-cs', college_id: 'col-ccs', name: 'Department of Computer Science', code: 'CS' },
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
      createCourse: vi.fn(async (payload: any) => ({
        id: 'crs-new',
        ...payload,
      })),
      updateCourse: vi.fn(async () => ({})),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

describe('School Year Management & Scoping State in LMSContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {}
  });

  test('provides default active school year for col-ccs (2025-2026)', async () => {
    let contextValues: any = null;
    const Probe = () => {
      contextValues = useLMS();
      return null;
    };

    await act(async () => {
      render(
        <LMSProvider>
          <Probe />
        </LMSProvider>
      );
    });

    expect(contextValues.schoolYears).toBeDefined();
    expect(Array.isArray(contextValues.schoolYears)).toBe(true);

    const ccsYears = contextValues.getSchoolYearsByCollege('col-ccs');
    expect(ccsYears.length).toBeGreaterThanOrEqual(1);

    const activeYear = contextValues.getActiveSchoolYearForCollege('col-ccs');
    expect(activeYear).toBeDefined();
    expect(activeYear?.year).toBe('2025-2026');
    expect(activeYear?.isActive).toBe(true);
  });

  test('allows adding a new school year accessible across colleges', async () => {
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

    let res: any;
    await act(async () => {
      res = await contextValues.addSchoolYear('2035-2036');
    });

    expect(res.success).toBe(true);

    const ccsYears = contextValues.getSchoolYearsByCollege('col-ccs');
    const added = ccsYears.find((sy: SchoolYear) => sy.year === '2035-2036');
    expect(added).toBeDefined();
    expect(added?.year).toBe('2035-2036');
  });

  test('prevents duplicate school year', async () => {
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

    let res: any;
    await act(async () => {
      res = await contextValues.addSchoolYear('2025-2026');
    });

    expect(res.success).toBe(false);
  });

  test('allows rolling over the active school year for a college', async () => {
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

    await act(async () => {
      await contextValues.login('jayveegenetareyes@gmail.com', 'pw');
    });

    await waitFor(() => {
      expect(contextValues.db.users.length).toBeGreaterThan(0);
    });

    await act(async () => {
      await contextValues.addSchoolYear('2026-2027');
    });

    const ccsYears = contextValues.getSchoolYearsByCollege('col-ccs');
    const targetYear = ccsYears.find((sy: SchoolYear) => sy.year === '2026-2027');
    expect(targetYear).toBeDefined();

    // Attempting to roll over when target year is not the baseline fails
    await act(async () => {
      const failRes = await contextValues.setActiveSchoolYear('col-ccs', targetYear!.id);
      expect(failRes.success).toBe(false);
      expect(failRes.message).toContain('Colleges can only roll over to the current university baseline academic year');
    });

    // Admin sets university baseline to 2026-2027
    await act(async () => {
      const baseRes = await contextValues.setBaselineSchoolYear(targetYear!.id);
      expect(baseRes.success).toBe(true);
    });

    // Verify notifications sent to Dean and Chair
    const deanNotifs = contextValues.getNotifications('u-dean1');
    const chairNotifs = contextValues.getNotifications('u-chair1');
    const studentNotifs = contextValues.getNotifications('u-stud1');

    expect(deanNotifs.some((n: any) => n.type === 'baseline_changed' && n.content.includes('2026-2027'))).toBe(true);
    expect(chairNotifs.some((n: any) => n.type === 'baseline_changed' && n.content.includes('2026-2027'))).toBe(true);
    expect(studentNotifs.some((n: any) => n.type === 'baseline_changed')).toBe(false);

    // Dean can now roll over college to the new baseline year
    await act(async () => {
      const switchRes = await contextValues.setActiveSchoolYear('col-ccs', targetYear!.id);
      expect(switchRes.success).toBe(true);
    });

    const activeYear = contextValues.getActiveSchoolYearForCollege('col-ccs');
    expect(activeYear?.year).toBe('2026-2027');
    expect(activeYear?.isActive).toBe(true);

    // Verify independent scoping: rolling over CCS does NOT change other colleges' active school year
    const casActive = contextValues.getActiveSchoolYearForCollege('col-cas');
    expect(casActive?.year).toBe('2025-2026');
  });

  test('defaults existing users and courses without schoolYear to active school year (or 2025-2026)', async () => {
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

    await act(async () => {
      await contextValues.login('jayveegenetareyes@gmail.com', 'pw');
    });

    await waitFor(() => {
      expect(contextValues.db.courses.length).toBeGreaterThan(0);
      expect(contextValues.db.users.length).toBeGreaterThan(0);
    });

    // Check course default schoolYear
    const course = contextValues.db.courses.find((c: Course) => c.id === 'crs-1');
    expect(course?.schoolYear).toBe('2025-2026');

    // Check user default schoolYear
    const student = contextValues.db.users.find((u: User) => u.id === 'u-stud1');
    expect(student?.schoolYear).toBe('2025-2026');
  });
});
