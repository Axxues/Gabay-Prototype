// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';
import type { LMSContextType } from './LMSContext';

const apiFetchMock = vi.fn(async (path: string) => {
  throw new Error(`unmocked: ${path}`);
});

const updateUserMock = vi.fn(async (id: string, patch: any) => ({
  id,
  ...patch,
}));

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  getToken: () => null,
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: (...args: any[]) => (apiFetchMock as any)(...args),
  likhaLmsApi: {
    loginLikhaUser: vi.fn(),
    auth: {
      getMe: vi.fn(async () => null),
    },
    getCoursesWithRelations: vi.fn(async () => []),
    getNotifications: vi.fn(async () => []),
    users: {
      getUsers: vi.fn(async () => []),
      createUser: vi.fn(async (payload: any) => ({ id: `u-${Date.now()}`, ...payload })),
      updateUser: (...args: any[]) => (updateUserMock as any)(...args),
      resolveRoleId: vi.fn(async () => 'role-uuid'),
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

let ctx: LMSContextType | null = null;

const ContextProbe: React.FC = () => {
  ctx = useLMS();
  return null;
};

describe('LMSContext Academic Structure & In-Place Leadership Appointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('addCollege creates college and promotes initialDeanId to admin/dean', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-cand-dean-1',
        name: 'Prof. Alice Dean',
        email: 'alice.dean@dmmmsu.edu.ph',
        role: 'faculty',
      });
    });

    let createdCollege: any;
    await act(async () => {
      createdCollege = await ctx!.addCollege(
        {
          id: 'col-cet',
          name: 'College of Engineering and Technology',
          code: 'CET',
        },
        'u-cand-dean-1'
      );
    });

    expect(createdCollege.deanId).toBe('u-cand-dean-1');
    const storedCollege = ctx!.colleges.find(c => c.id === 'col-cet');
    expect(storedCollege).toBeDefined();
    expect(storedCollege?.deanId).toBe('u-cand-dean-1');

    const updatedUser = ctx!.db.users.find(u => u.id === 'u-cand-dean-1');
    expect(updatedUser?.role).toBe('admin');
    expect(updatedUser?.adminSubrole).toBe('dean');
    expect(updatedUser?.collegeId).toBe('col-cet');
    expect(updatedUser?.collegeName).toBe('College of Engineering and Technology');

    // Verify localStorage persistence
    const saved = JSON.parse(localStorage.getItem('gabay_colleges') || '[]');
    const persistedCollege = saved.find((c: any) => c.id === 'col-cet');
    expect(persistedCollege?.deanId).toBe('u-cand-dean-1');
  });

  test('addDepartment creates department and promotes initialChairId to admin/chairperson', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-cand-chair-1',
        name: 'Prof. Bob Chair',
        email: 'bob.chair@dmmmsu.edu.ph',
        role: 'faculty',
      });
    });

    let createdDept: any;
    await act(async () => {
      createdDept = await ctx!.addDepartment(
        {
          id: 'dept-ece',
          collegeId: 'col-cet',
          name: 'Department of Electronics Engineering',
          code: 'ECE',
        },
        'u-cand-chair-1'
      );
    });

    expect(createdDept.chairpersonId).toBe('u-cand-chair-1');
    const storedDept = ctx!.departments.find(d => d.id === 'dept-ece');
    expect(storedDept).toBeDefined();
    expect(storedDept?.chairpersonId).toBe('u-cand-chair-1');

    const updatedUser = ctx!.db.users.find(u => u.id === 'u-cand-chair-1');
    expect(updatedUser?.role).toBe('admin');
    expect(updatedUser?.adminSubrole).toBe('chairperson');
    expect(updatedUser?.collegeId).toBe('col-cet');
    expect(updatedUser?.department).toBe('Department of Electronics Engineering');

    // Verify localStorage persistence
    const saved = JSON.parse(localStorage.getItem('gabay_departments') || '[]');
    const persistedDept = saved.find((d: any) => d.id === 'dept-ece');
    expect(persistedDept?.chairpersonId).toBe('u-cand-chair-1');
  });

  test('appointing a user who currently heads unit A to head unit B automatically vacates unit A leadership (Dean -> Dean)', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-multitasker',
        name: 'Dr. Multi Tasker',
        email: 'multi@dmmmsu.edu.ph',
        role: 'faculty',
      });
      // Appoint as Dean of College 1
      await ctx!.addCollege(
        {
          id: 'col-unit-a',
          name: 'College Alpha',
          code: 'ALPHA',
        },
        'u-multitasker'
      );
    });

    expect(ctx!.colleges.find(c => c.id === 'col-unit-a')?.deanId).toBe('u-multitasker');

    // Now appoint same user as Dean of College 2 via addCollege
    await act(async () => {
      await ctx!.addCollege(
        {
          id: 'col-unit-b',
          name: 'College Beta',
          code: 'BETA',
        },
        'u-multitasker'
      );
    });

    // Unit B has new dean
    expect(ctx!.colleges.find(c => c.id === 'col-unit-b')?.deanId).toBe('u-multitasker');
    // Unit A must be vacated (deanId: undefined)
    expect(ctx!.colleges.find(c => c.id === 'col-unit-a')?.deanId).toBeUndefined();
  });

  test('appointing a Chairperson of department X as Dean of college Y vacates department X chair seat', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-rising-star',
        name: 'Dr. Rising Star',
        email: 'rising@dmmmsu.edu.ph',
        role: 'faculty',
      });
      // Set as Chair of Dept X
      await ctx!.addDepartment(
        {
          id: 'dept-x',
          collegeId: 'col-ccs',
          name: 'Department X',
          code: 'DEPX',
        },
        'u-rising-star'
      );
    });

    expect(ctx!.departments.find(d => d.id === 'dept-x')?.chairpersonId).toBe('u-rising-star');

    // Appoint as Dean of College Y
    await act(async () => {
      await ctx!.addCollege(
        {
          id: 'col-y',
          name: 'College Y',
          code: 'COLY',
        },
        'u-rising-star'
      );
    });

    // College Y has Dr. Rising Star as Dean
    expect(ctx!.colleges.find(c => c.id === 'col-y')?.deanId).toBe('u-rising-star');
    // Dept X Chairperson seat is vacated
    expect(ctx!.departments.find(d => d.id === 'dept-x')?.chairpersonId).toBeUndefined();
  });

  test('appointing a Dean of college Y as Chairperson of department Z vacates college Y dean seat', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-dean-turning-chair',
        name: 'Dr. Lateral Move',
        email: 'lateral@dmmmsu.edu.ph',
        role: 'faculty',
      });
      await ctx!.addCollege(
        {
          id: 'col-origin',
          name: 'College Origin',
          code: 'ORIG',
        },
        'u-dean-turning-chair'
      );
    });

    expect(ctx!.colleges.find(c => c.id === 'col-origin')?.deanId).toBe('u-dean-turning-chair');

    // Appoint as Chairperson of Dept Z
    await act(async () => {
      await ctx!.addDepartment(
        {
          id: 'dept-dest',
          collegeId: 'col-origin',
          name: 'Department Dest',
          code: 'DEST',
        },
        'u-dean-turning-chair'
      );
    });

    // Dept Dest chairperson is set
    expect(ctx!.departments.find(d => d.id === 'dept-dest')?.chairpersonId).toBe('u-dean-turning-chair');
    // College Origin dean seat is vacated
    expect(ctx!.colleges.find(c => c.id === 'col-origin')?.deanId).toBeUndefined();
  });

  test('transferLeadership vacates cross-unit leadership across colleges and departments', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-incumbent-dean',
        name: 'Dr. Incumbent',
        email: 'incumbent@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'dean',
      });
      await ctx!.createUser({
        id: 'u-chair-to-dean',
        name: 'Dr. Promoted Chair',
        email: 'promoted@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'chairperson',
      });
      // Setup college and department
      await ctx!.addCollege({ id: 'col-target', name: 'Target College', code: 'TC', deanId: 'u-incumbent-dean' });
      await ctx!.addDepartment({ id: 'dept-source', collegeId: 'col-target', name: 'Source Dept', code: 'SD', chairpersonId: 'u-chair-to-dean' });
    });

    expect(ctx!.departments.find(d => d.id === 'dept-source')?.chairpersonId).toBe('u-chair-to-dean');

    // Transfer leadership of col-target to u-chair-to-dean
    let transferRes: any;
    await act(async () => {
      transferRes = await ctx!.transferLeadership('dean', 'u-incumbent-dean', 'u-chair-to-dean', 'col-target');
    });

    expect(transferRes.success).toBe(true);
    expect(ctx!.colleges.find(c => c.id === 'col-target')?.deanId).toBe('u-chair-to-dean');
    // dept-source chairpersonId must now be vacated (undefined)
    expect(ctx!.departments.find(d => d.id === 'dept-source')?.chairpersonId).toBeUndefined();
    // Incumbent dean stepped down to faculty
    expect(ctx!.db.users.find(u => u.id === 'u-incumbent-dean')?.role).toBe('faculty');
  });

  test('replacing existing dean via addCollege steps predecessor down to faculty', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-dean-old',
        name: 'Dr. Old Dean',
        email: 'old.dean@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'dean',
      });
      await ctx!.createUser({
        id: 'u-dean-new',
        name: 'Dr. New Dean',
        email: 'new.dean@dmmmsu.edu.ph',
        role: 'faculty',
      });
      await ctx!.addCollege({ id: 'col-replaced', name: 'Replaced College', code: 'RC', deanId: 'u-dean-old' });
    });

    // Update college with initialDeanId = u-dean-new
    await act(async () => {
      await ctx!.addCollege(
        { id: 'col-replaced', name: 'Replaced College', code: 'RC' },
        'u-dean-new'
      );
    });

    expect(ctx!.colleges.find(c => c.id === 'col-replaced')?.deanId).toBe('u-dean-new');
    expect(ctx!.db.users.find(u => u.id === 'u-dean-old')?.role).toBe('faculty');
    expect(ctx!.db.users.find(u => u.id === 'u-dean-old')?.adminSubrole).toBeUndefined();
    expect(ctx!.db.users.find(u => u.id === 'u-dean-new')?.role).toBe('admin');
    expect(ctx!.db.users.find(u => u.id === 'u-dean-new')?.adminSubrole).toBe('dean');
  });

  test('replacing existing chair via addDepartment steps predecessor down to faculty', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-chair-old',
        name: 'Dr. Old Chair',
        email: 'old.chair@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'chairperson',
      });
      await ctx!.createUser({
        id: 'u-chair-new',
        name: 'Dr. New Chair',
        email: 'new.chair@dmmmsu.edu.ph',
        role: 'faculty',
      });
      await ctx!.addDepartment({ id: 'dept-replaced', collegeId: 'col-ccs', name: 'Replaced Dept', code: 'RD', chairpersonId: 'u-chair-old' });
    });

    // Update department with initialChairId = u-chair-new
    await act(async () => {
      await ctx!.addDepartment(
        { id: 'dept-replaced', collegeId: 'col-ccs', name: 'Replaced Dept', code: 'RD' },
        'u-chair-new'
      );
    });

    expect(ctx!.departments.find(d => d.id === 'dept-replaced')?.chairpersonId).toBe('u-chair-new');
    expect(ctx!.db.users.find(u => u.id === 'u-chair-old')?.role).toBe('faculty');
    expect(ctx!.db.users.find(u => u.id === 'u-chair-old')?.adminSubrole).toBeUndefined();
    expect(ctx!.db.users.find(u => u.id === 'u-chair-new')?.role).toBe('admin');
    expect(ctx!.db.users.find(u => u.id === 'u-chair-new')?.adminSubrole).toBe('chairperson');
  });

  test('omitting initial leader or passing "none" does not promote anyone and does not set deanId/chairpersonId', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.addCollege(
        { id: 'col-headless', name: 'Headless College', code: 'HLC' },
        'none'
      );
      await ctx!.addDepartment(
        { id: 'dept-headless', collegeId: 'col-headless', name: 'Headless Dept', code: 'HLD' },
        'none'
      );
    });

    expect(ctx!.colleges.find(c => c.id === 'col-headless')?.deanId).toBeUndefined();
    expect(ctx!.departments.find(d => d.id === 'dept-headless')?.chairpersonId).toBeUndefined();
  });

  test('addCollege with college.deanId (without 2nd param) promotes candidate to Dean and vacates prior seats', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-prop-dean-1',
        name: 'Dr. Prop Dean',
        email: 'prop.dean@dmmmsu.edu.ph',
        role: 'faculty',
      });
      // Set as chairperson of an existing department first
      await ctx!.addDepartment(
        {
          id: 'dept-prior-chair',
          collegeId: 'col-other',
          name: 'Department Prior',
          code: 'DP',
        },
        'u-prop-dean-1'
      );
    });

    expect(ctx!.departments.find(d => d.id === 'dept-prior-chair')?.chairpersonId).toBe('u-prop-dean-1');

    // Call addCollege passing deanId on the college object WITHOUT 2nd parameter
    let createdCollege: any;
    await act(async () => {
      createdCollege = await ctx!.addCollege({
        id: 'col-prop-test',
        name: 'College of Autonomous Systems',
        code: 'CAS',
        deanId: 'u-prop-dean-1',
      });
    });

    expect(createdCollege.deanId).toBe('u-prop-dean-1');
    const storedCollege = ctx!.colleges.find(c => c.id === 'col-prop-test');
    expect(storedCollege?.deanId).toBe('u-prop-dean-1');

    // u-prop-dean-1 is promoted to admin/dean with collegeId and collegeName
    const updatedUser = ctx!.db.users.find(u => u.id === 'u-prop-dean-1');
    expect(updatedUser?.role).toBe('admin');
    expect(updatedUser?.adminSubrole).toBe('dean');
    expect(updatedUser?.collegeId).toBe('col-prop-test');
    expect(updatedUser?.collegeName).toBe('College of Autonomous Systems');

    // Prior chairperson seat must be vacated
    expect(ctx!.departments.find(d => d.id === 'dept-prior-chair')?.chairpersonId).toBeUndefined();
  });

  test('transferLeadership updates successor collegeId, collegeName, and department', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.createUser({
        id: 'u-pred-dean',
        name: 'Dr. Predecessor Dean',
        email: 'pred.dean@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'dean',
        collegeId: 'col-transfer-test',
        collegeName: 'Transfer College',
      });
      await ctx!.createUser({
        id: 'u-succ-dean',
        name: 'Dr. Successor Dean',
        email: 'succ.dean@dmmmsu.edu.ph',
        role: 'faculty',
      });
      await ctx!.createUser({
        id: 'u-pred-chair',
        name: 'Dr. Predecessor Chair',
        email: 'pred.chair@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'chairperson',
      });
      await ctx!.createUser({
        id: 'u-succ-chair',
        name: 'Dr. Successor Chair',
        email: 'succ.chair@dmmmsu.edu.ph',
        role: 'faculty',
      });

      await ctx!.addCollege({
        id: 'col-transfer-test',
        name: 'Transfer College',
        code: 'TC',
        deanId: 'u-pred-dean',
      });

      await ctx!.addDepartment({
        id: 'dept-transfer-test',
        collegeId: 'col-transfer-test',
        name: 'Transfer Department',
        code: 'TD',
        chairpersonId: 'u-pred-chair',
      });
    });

    // 1. Transfer Dean leadership
    await act(async () => {
      const res = await ctx!.transferLeadership('dean', 'u-pred-dean', 'u-succ-dean', 'col-transfer-test');
      expect(res.success).toBe(true);
    });

    const succDeanUser = ctx!.db.users.find(u => u.id === 'u-succ-dean');
    expect(succDeanUser?.role).toBe('admin');
    expect(succDeanUser?.adminSubrole).toBe('dean');
    expect(succDeanUser?.collegeId).toBe('col-transfer-test');
    expect(succDeanUser?.collegeName).toBe('Transfer College');

    // 2. Transfer Chairperson leadership
    await act(async () => {
      const res = await ctx!.transferLeadership('chairperson', 'u-pred-chair', 'u-succ-chair', 'dept-transfer-test');
      expect(res.success).toBe(true);
    });

    const succChairUser = ctx!.db.users.find(u => u.id === 'u-succ-chair');
    expect(succChairUser?.role).toBe('admin');
    expect(succChairUser?.adminSubrole).toBe('chairperson');
    expect(succChairUser?.department).toBe('Transfer Department');
    expect(succChairUser?.collegeId).toBe('col-transfer-test');
  });
});
