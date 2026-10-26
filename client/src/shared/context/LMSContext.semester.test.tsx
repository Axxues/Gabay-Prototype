// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

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
    getCoursesWithRelations: vi.fn(async () => []),
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
      createCourse: vi.fn(async (payload: any) => ({ id: 'crs-new', ...payload })),
      updateCourse: vi.fn(async () => ({})),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

async function mountLms() {
  let ctx: any = null;
  const Probe = () => {
    ctx = useLMS();
    return null;
  };
  let unmount: () => void = () => {};
  await act(async () => {
    unmount = render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    ).unmount;
  });
  return { get: () => ctx as any, unmount };
}

describe('Semester baseline and college semester rollover in LMSContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {}
  });

  test('defaults the baseline semester to First and reports First for a college that never rolled over', async () => {
    const { get } = await mountLms();

    expect(get().baselineSemester).toBe('First');
    expect(get().getActiveSemesterForCollege('col-ccs')).toBe('First');
    expect(get().getActiveSemesterForCollege('col-cas')).toBe('First');
  });

  test('refuses to roll a college over to a semester other than the university baseline', async () => {
    const { get } = await mountLms();

    let res: any;
    await act(async () => {
      res = await get().setActiveSemesterForCollege('col-ccs', 'Second');
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain('University Semester');
    expect(get().getActiveSemesterForCollege('col-ccs')).toBe('First');
  });

  test('rolls a college over to the baseline semester without touching other colleges', async () => {
    const { get } = await mountLms();

    await act(async () => {
      await get().setBaselineSemester('Second');
    });

    let res: any;
    await act(async () => {
      res = await get().setActiveSemesterForCollege('col-ccs', 'Second');
    });

    expect(res.success).toBe(true);
    expect(get().getActiveSemesterForCollege('col-ccs')).toBe('Second');
    expect(get().getActiveSemesterForCollege('col-cas')).toBe('First');
  });

  test('resets the baseline semester to First when the baseline academic year changes, and writes no college', async () => {
    const { get } = await mountLms();

    await act(async () => {
      await get().setBaselineSemester('Second');
    });
    await act(async () => {
      await get().setActiveSemesterForCollege('col-ccs', 'Second');
    });
    expect(get().getActiveSemesterForCollege('col-ccs')).toBe('Second');

    await act(async () => {
      await get().addSchoolYear('2026-2027');
    });
    let res: any;
    await act(async () => {
      res = await get().setBaselineSchoolYear('2026-2027');
    });

    expect(res.success).toBe(true);
    expect(get().baselineSemester).toBe('First');
    // The Dean still has to roll the college over themselves.
    expect(get().getActiveSemesterForCollege('col-ccs')).toBe('Second');
  });

  test('leaves a college semester untouched when that college rolls its academic year over', async () => {
    const { get } = await mountLms();

    await act(async () => {
      await get().addSchoolYear('2026-2027');
      await get().setBaselineSchoolYear('2026-2027');
    });
    await act(async () => {
      await get().setBaselineSemester('Second');
    });
    await act(async () => {
      await get().setActiveSemesterForCollege('col-ccs', 'Second');
    });

    let res: any;
    await act(async () => {
      res = await get().setActiveSchoolYear('col-ccs', '2026-2027');
    });

    expect(res.success).toBe(true);
    expect(get().getActiveSchoolYearForCollege('col-ccs')?.year).toBe('2026-2027');
    expect(get().getActiveSemesterForCollege('col-ccs')).toBe('Second');
  });

  test('does not advance students or faculty when a college rolls its semester over', async () => {
    const { get } = await mountLms();

    await act(async () => {
      await get().login('chancellor@dmmmsu.edu.ph', 'pw');
    });
    await waitFor(() => {
      expect(get().db.users.length).toBeGreaterThan(0);
    });

    // Establish known advancement values with an academic year rollover.
    await act(async () => {
      await get().addSchoolYear('2026-2027');
      await get().setBaselineSchoolYear('2026-2027');
    });
    await act(async () => {
      await get().setActiveSchoolYear('col-ccs', '2026-2027');
    });

    const studentBefore = get().db.users.find((u: any) => u.id === 'u-stud1')?.yearLevel;
    const deanBefore = get().db.users.find((u: any) => u.id === 'u-dean1')?.yearsOfTeaching;
    expect(studentBefore).toBe(2);
    expect(deanBefore).toBe(1);

    await act(async () => {
      await get().setBaselineSemester('Second');
    });
    await act(async () => {
      await get().setActiveSemesterForCollege('col-ccs', 'Second');
    });

    expect(get().getActiveSemesterForCollege('col-ccs')).toBe('Second');
    expect(get().db.users.find((u: any) => u.id === 'u-stud1')?.yearLevel).toBe(2);
    expect(get().db.users.find((u: any) => u.id === 'u-dean1')?.yearsOfTeaching).toBe(1);
  });

  test('refuses a baseline semester change to the semester it is already on', async () => {
    const { get } = await mountLms();

    let res: any;
    await act(async () => {
      res = await get().setBaselineSemester('First');
    });

    expect(res.success).toBe(false);
    expect(get().baselineSemester).toBe('First');
  });

  test('notifies deans and chairpersons about a baseline semester change, and not students', async () => {
    const { get } = await mountLms();

    await act(async () => {
      await get().login('chancellor@dmmmsu.edu.ph', 'pw');
    });
    await waitFor(() => {
      expect(get().db.users.length).toBeGreaterThan(0);
    });

    let res: any;
    await act(async () => {
      res = await get().setBaselineSemester('Second');
    });
    expect(res.success).toBe(true);

    const deanNotifs = get().getNotifications('u-dean1');
    const chairNotifs = get().getNotifications('u-chair1');
    const studentNotifs = get().getNotifications('u-stud1');

    expect(deanNotifs.some((n: any) => n.type === 'baseline_changed' && n.content.includes('Second'))).toBe(true);
    expect(chairNotifs.some((n: any) => n.type === 'baseline_changed' && n.content.includes('Second'))).toBe(true);
    expect(studentNotifs.some((n: any) => n.type === 'baseline_changed')).toBe(false);
  });

  test('keeps the baseline semester across a remount', async () => {
    const first = await mountLms();

    await act(async () => {
      await first.get().setBaselineSemester('Second');
    });
    expect(first.get().baselineSemester).toBe('Second');

    await act(async () => {
      first.unmount();
    });

    const second = await mountLms();
    expect(second.get().baselineSemester).toBe('Second');
  });

  test('recovers from a corrupt college semester cache instead of throwing', async () => {
    localStorage.setItem('gabay_college_active_semesters', '{not json');

    const { get } = await mountLms();

    expect(get().baselineSemester).toBe('First');
    expect(get().getActiveSemesterForCollege('col-ccs')).toBe('First');
  });
});
