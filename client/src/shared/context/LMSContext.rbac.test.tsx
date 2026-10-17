// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';
import type { LMSContextType } from './LMSContext';

const apiFetchMock = vi.fn(async (path: string) => {
  throw new Error(`unmocked: ${path}`);
});

const loginLikhaMock = vi.fn(async () => ({
  token: 't-test',
  user: {
    id: 'u-root',
    first_name: 'Root',
    last_name: 'User',
    email: 'root@dmmmsu.edu.ph',
    role: { name: 'Administrator' },
  },
}));

const getCoursesMock = vi.fn(async () => []);
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => []);
const getMessagesMock = vi.fn(async () => []);
const getCalendarMock = vi.fn(async () => []);
const getGroupsMock = vi.fn(async () => []);
const getSlotsMock = vi.fn(async () => []);
const getSectionsMock = vi.fn(async () => []);
const getRequestsMock = vi.fn(async () => []);
const createUserMock = vi.fn(async (payload: any) => ({
  id: `u-${Date.now()}`,
  role: { name: payload.role || 'Student' },
  ...payload,
}));
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
    loginLikhaUser: (...args: any[]) => (loginLikhaMock as any)(...args),
    auth: {
      getMe: vi.fn(async () => null),
    },
    getCoursesWithRelations: (...args: any[]) => (getCoursesMock as any)(...args),
    getNotifications: (...args: any[]) => (getNotifsMock as any)(...args),
    users: {
      getUsers: (...args: any[]) => (getUsersMock as any)(...args),
      createUser: (...args: any[]) => (createUserMock as any)(...args),
      updateUser: (...args: any[]) => (updateUserMock as any)(...args),
      resolveRoleId: vi.fn(async () => 'role-uuid'),
    },
    communications: {
      getMessages: (...args: any[]) => (getMessagesMock as any)(...args),
      getCalendarEvents: (...args: any[]) => (getCalendarMock as any)(...args),
      getChatGroups: (...args: any[]) => (getGroupsMock as any)(...args),
      getAdvisingSlots: (...args: any[]) => (getSlotsMock as any)(...args),
    },
    requests: {
      getRequests: (...args: any[]) => (getRequestsMock as any)(...args),
    },
    sections: {
      getSections: (...args: any[]) => (getSectionsMock as any)(...args),
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

describe('LMSContext RBAC: Registration Staging, Verification Queue & Leadership Transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('provides default colleges and departments with dynamic lookup capability', () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    expect(ctx).not.toBeNull();
    expect(ctx!.colleges).toBeDefined();
    expect(ctx!.colleges.length).toBeGreaterThanOrEqual(1);
    expect(ctx!.colleges.some(c => c.code === 'CCS')).toBe(true);

    expect(ctx!.departments).toBeDefined();
    expect(ctx!.departments.length).toBeGreaterThanOrEqual(1);
    expect(ctx!.departments.some(d => d.code === 'CS')).toBe(true);
  });

  test('registerAccount() creates a pending registration expiring in 30 days', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let reg: any;
    await act(async () => {
      reg = await ctx!.registerAccount({
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'msantos@dmmmsu.edu.ph',
        role: 'faculty',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
        studentId: '202-6001-1',
        password: 'Password123!',
      });
    });

    expect(reg).toBeDefined();
    expect(reg.id).toBeDefined();
    expect(reg.fullName).toBe('Maria Santos');
    expect(reg.status).toBe('pending');
    expect(reg.emailVerified).toBe(false);
    expect(reg.activationToken).toBeDefined();

    const registeredAtMs = new Date(reg.registeredAt).getTime();
    const expiresAtMs = new Date(reg.expiresAt).getTime();
    const diffDays = Math.round((expiresAtMs - registeredAtMs) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);

    expect(ctx!.pendingRegistrations).toContainEqual(expect.objectContaining({ id: reg.id }));
  });

  test('activateEmail() verifies the token and marks email verified', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let reg: any;
    await act(async () => {
      reg = await ctx!.registerAccount({
        firstName: 'Juan',
        lastName: 'Luna',
        email: 'jluna@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        department: 'Department of Information Technology',
        studentId: '202-6002-2',
        password: 'Password123!',
      });
    });

    let activateRes: any;
    await act(async () => {
      activateRes = await ctx!.activateEmail(reg.activationToken);
    });

    expect(activateRes.success).toBe(true);
    expect(ctx!.pendingRegistrations.find(r => r.id === reg.id)?.emailVerified).toBe(true);

    let invalidRes: any;
    await act(async () => {
      invalidRes = await ctx!.activateEmail('invalid-token-12345');
    });
    expect(invalidRes.success).toBe(false);
  });

  test('unverified account is rejected at login() with countdown message', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let reg: any;
    await act(async () => {
      reg = await ctx!.registerAccount({
        firstName: 'Pedro',
        lastName: 'Penduko',
        email: 'ppenduko@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        department: 'Department of Information Technology',
        studentId: '202-6003-3',
        password: 'Password123!',
      });
    });

    // Attempt 1: Email not verified yet
    let loginRes1: any;
    await act(async () => {
      loginRes1 = await ctx!.login('ppenduko@dmmmsu.edu.ph', 'Password123!');
    });
    expect(loginRes1.success).toBe(false);
    expect(loginRes1.message).toContain('Please verify your email address first');

    // Activate email
    await act(async () => {
      await ctx!.activateEmail(reg.activationToken);
    });

    // Attempt 2: Email verified, but administrator has not verified yet
    let loginRes2: any;
    await act(async () => {
      loginRes2 = await ctx!.login('ppenduko@dmmmsu.edu.ph', 'Password123!');
    });
    expect(loginRes2.success).toBe(false);
    expect(loginRes2.message).toContain('Account pending administrator verification. (Expires in 30 days)');
  });

  test('verifyRegistration() creates active user and unlocks login', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let reg: any;
    await act(async () => {
      reg = await ctx!.registerAccount({
        firstName: 'Elena',
        lastName: 'Reyes',
        email: 'ereyes@dmmmsu.edu.ph',
        role: 'faculty',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
        studentId: '202-6004-4',
        password: 'Password123!',
      });
      await ctx!.activateEmail(reg.activationToken);
    });

    // Verify the registration
    let verifyRes: any;
    await act(async () => {
      verifyRes = await ctx!.verifyRegistration(reg.id);
    });

    expect(verifyRes.success).toBe(true);
    expect(verifyRes.user).toBeDefined();
    expect(verifyRes.user.email).toBe('ereyes@dmmmsu.edu.ph');
    expect(ctx!.pendingRegistrations.find(r => r.id === reg.id)?.status).toBe('verified');

    // Login is now unlocked
    let loginRes: any;
    await act(async () => {
      loginRes = await ctx!.login('ereyes@dmmmsu.edu.ph', 'Password123!');
    });
    expect(loginRes.success).toBe(true);
  });

  test('registrations older than 30 days are automatically marked expired / cancelled', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let expiredReg: any;
    await act(async () => {
      expiredReg = await ctx!.registerAccount({
        firstName: 'Old',
        lastName: 'Applicant',
        email: 'old@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-coe',
        department: 'Department of Elementary Education',
        studentId: '202-6005-5',
        password: 'Password123!',
        registeredAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      });
    });

    // Purge expired registrations
    let purgedCount = 0;
    await act(async () => {
      purgedCount = await ctx!.purgeExpiredRegistrations();
    });
    expect(purgedCount).toBeGreaterThanOrEqual(1);
    expect(ctx!.pendingRegistrations.find(r => r.id === expiredReg.id)?.status).toBe('expired');

    // Attempting to verify expired registration returns failure
    let verifyExpiredRes: any;
    await act(async () => {
      verifyExpiredRes = await ctx!.verifyRegistration(expiredReg.id);
    });
    expect(verifyExpiredRes.success).toBe(false);
    expect(verifyExpiredRes.message).toContain('expired');

    // Attempting login with expired registration is rejected
    let loginExpiredRes: any;
    await act(async () => {
      loginExpiredRes = await ctx!.login('old@dmmmsu.edu.ph', 'Password123!');
    });
    expect(loginExpiredRes.success).toBe(false);
    expect(loginExpiredRes.message).toContain('expired');
  });

  test('verified registration older than 30 days can still successfully log in without being marked expired', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let reg: any;
    await act(async () => {
      // 1. Account registered 40 days ago (expiresAt was 10 days ago)
      reg = await ctx!.registerAccount({
        firstName: 'Veteran',
        lastName: 'Faculty',
        email: 'veteran@dmmmsu.edu.ph',
        role: 'faculty',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
        studentId: '202-6007-7',
        password: 'Password123!',
        registeredAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      });
      await ctx!.activateEmail(reg.activationToken);

      // 2. Verified active account was created
      await ctx!.createUser({
        name: 'Veteran Faculty',
        email: 'veteran@dmmmsu.edu.ph',
        role: 'faculty',
        department: 'Department of Computer Science',
        password: 'Password123!',
        verificationStatus: 'verified',
        emailVerified: true,
      });
    });

    // Mark registration record as verified
    await act(async () => {
      const target = ctx!.pendingRegistrations.find(r => r.id === reg.id);
      if (target) target.status = 'verified';
    });

    // 3. Purging expired registrations must NOT touch verified accounts
    await act(async () => {
      await ctx!.purgeExpiredRegistrations();
    });
    expect(ctx!.pendingRegistrations.find(r => r.id === reg.id)?.status).toBe('verified');

    // 4. Login must succeed and not be locked out by expiration
    let loginRes: any;
    await act(async () => {
      loginRes = await ctx!.login('veteran@dmmmsu.edu.ph', 'Password123!');
    });
    expect(loginRes.success).toBe(true);
  });

  test('transferLeadership() promotes successor to admin/dean/chair and steps predecessor down to faculty', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    // 1. Dean Handover with multi-unit cleanup check
    await act(async () => {
      // Set current leader as dean on col-ccs AND col-coe (stale assignment)
      await ctx!.addCollege({ id: 'col-ccs', name: 'CCS', code: 'CCS', deanId: 'u-dean-1' });
      await ctx!.addCollege({ id: 'col-coe', name: 'COED', code: 'COED', deanId: 'u-dean-1' });

      await ctx!.createUser({
        id: 'u-dean-1',
        name: 'Dr. Current Dean',
        email: 'dean@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'dean',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
      });
      await ctx!.createUser({
        id: 'u-fac-succ',
        name: 'Prof. Successor',
        email: 'succ@dmmmsu.edu.ph',
        role: 'faculty',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
      });
    });

    let deanTransferRes: any;
    await act(async () => {
      deanTransferRes = await ctx!.transferLeadership('dean', 'u-dean-1', 'u-fac-succ', 'col-ccs');
    });

    expect(deanTransferRes.success).toBe(true);

    const updatedPredecessorDean = ctx!.db.users.find(u => u.id === 'u-dean-1');
    expect(updatedPredecessorDean?.role).toBe('faculty');
    expect(updatedPredecessorDean?.adminSubrole).toBeUndefined();

    const updatedSuccessorDean = ctx!.db.users.find(u => u.id === 'u-fac-succ');
    expect(updatedSuccessorDean?.role).toBe('admin');
    expect(updatedSuccessorDean?.adminSubrole).toBe('dean');

    const updatedTargetCollege = ctx!.colleges.find(c => c.id === 'col-ccs');
    expect(updatedTargetCollege?.deanId).toBe('u-fac-succ');

    // Prior unit held by predecessor has deanId cleared to undefined
    const priorCollege = ctx!.colleges.find(c => c.id === 'col-coe');
    expect(priorCollege?.deanId).toBeUndefined();

    // 2. Chairperson Handover
    await act(async () => {
      await ctx!.createUser({
        id: 'u-chair-1',
        name: 'Dr. Current Chair',
        email: 'chair@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'chairperson',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
      });
      await ctx!.createUser({
        id: 'u-chair-succ',
        name: 'Prof. Chair Successor',
        email: 'chairsucc@dmmmsu.edu.ph',
        role: 'faculty',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
      });
    });

    let chairTransferRes: any;
    await act(async () => {
      chairTransferRes = await ctx!.transferLeadership('chairperson', 'u-chair-1', 'u-chair-succ', 'dept-cs');
    });

    expect(chairTransferRes.success).toBe(true);

    const updatedPredecessorChair = ctx!.db.users.find(u => u.id === 'u-chair-1');
    expect(updatedPredecessorChair?.role).toBe('faculty');
    expect(updatedPredecessorChair?.adminSubrole).toBeUndefined();

    const updatedSuccessorChair = ctx!.db.users.find(u => u.id === 'u-chair-succ');
    expect(updatedSuccessorChair?.role).toBe('admin');
    expect(updatedSuccessorChair?.adminSubrole).toBe('chairperson');

    const updatedDepartment = ctx!.departments.find(d => d.id === 'dept-cs');
    expect(updatedDepartment?.chairpersonId).toBe('u-chair-succ');
  });

  test('rejectRegistration() marks registration status rejected and blocks login', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let reg: any;
    await act(async () => {
      reg = await ctx!.registerAccount({
        firstName: 'Reject',
        lastName: 'Candidate',
        email: 'reject@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        department: 'Department of Information Systems',
        studentId: '202-6006-6',
        password: 'Password123!',
      });
      await ctx!.rejectRegistration(reg.id, 'Invalid credentials');
    });

    expect(ctx!.pendingRegistrations.find(r => r.id === reg.id)?.status).toBe('rejected');

    let rejectLoginRes: any;
    await act(async () => {
      rejectLoginRes = await ctx!.login('reject@dmmmsu.edu.ph', 'Password123!');
    });
    expect(rejectLoginRes.success).toBe(false);
    expect(rejectLoginRes.message).toContain('rejected');
  });

  test('addCollege() and addDepartment() add new academic units', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      await ctx!.addCollege({
        id: 'col-art',
        name: 'College of Arts and Sciences',
        code: 'CAS',
      });
      await ctx!.addDepartment({
        id: 'dept-math',
        collegeId: 'col-art',
        name: 'Department of Mathematics',
        code: 'MATH',
      });
    });

    expect(ctx!.colleges.some(c => c.id === 'col-art')).toBe(true);
    expect(ctx!.departments.some(d => d.id === 'dept-math')).toBe(true);
  });

  test('logging in jayveegenetareyes@gmail.com bootstraps as Chancellor (superadmin)', async () => {
    loginLikhaMock.mockResolvedValueOnce({
      token: 't-chancellor',
      user: {
        id: 'u-jayvee',
        first_name: 'Jayvee',
        last_name: 'Reyes',
        email: 'jayveegenetareyes@gmail.com',
        role: { name: 'Administrator' },
      },
    } as any);

    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let res: any;
    await act(async () => {
      res = await ctx!.login('jayveegenetareyes@gmail.com', 'qwerty12345');
    });

    expect(res.success).toBe(true);
    expect(ctx!.activeRole).toBe('superadmin');
    expect(ctx!.currentUser?.role).toBe('superadmin');
    expect(ctx!.currentUser?.adminSubrole).toBe('chancellor');
    expect(ctx!.currentUser?.title).toBe('University Chancellor');
  });

  test('switchRole("superadmin") switches session to Chancellor superadmin', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    await act(async () => {
      ctx!.switchRole('superadmin');
    });

    expect(ctx!.activeRole).toBe('superadmin');
    expect(ctx!.currentUser?.role).toBe('superadmin');
    expect(ctx!.currentUser?.adminSubrole).toBe('chancellor');
    expect(ctx!.currentUser?.title).toBe('University Chancellor');
  });

  test('logging in user with Directus role "Dean" maps to admin with dean subrole', async () => {
    loginLikhaMock.mockResolvedValueOnce({
      token: 't-dean',
      user: {
        id: 'u-dean-directus',
        first_name: 'Maria',
        last_name: 'Santos',
        email: 'dean.santos@dmmmsu.edu.ph',
        role: { name: 'Dean' },
        college_id: 'col-ccs',
        college_name: 'College of Computer Science',
      },
    } as any);

    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let res: any;
    await act(async () => {
      res = await ctx!.login('dean.santos@dmmmsu.edu.ph', 'password123');
    });

    expect(res.success).toBe(true);
    expect(ctx!.activeRole).toBe('admin');
    expect(ctx!.currentUser?.role).toBe('admin');
    expect(ctx!.currentUser?.adminSubrole).toBe('dean');
    expect(ctx!.currentUser?.title).toBe('College Dean');
    expect(ctx!.currentUser?.collegeId).toBe('col-ccs');
  });

  test('logging in user with Directus role "Chairperson" maps to admin with chairperson subrole', async () => {
    loginLikhaMock.mockResolvedValueOnce({
      token: 't-chair',
      user: {
        id: 'u-chair-directus',
        first_name: 'Roberto',
        last_name: 'Cruz',
        email: 'chair.cruz@dmmmsu.edu.ph',
        role: { name: 'Chairperson' },
        department: 'Computer Science',
      },
    } as any);

    render(
      <LMSProvider>
        <ContextProbe />
      </LMSProvider>
    );

    let res: any;
    await act(async () => {
      res = await ctx!.login('chair.cruz@dmmmsu.edu.ph', 'password123');
    });

    expect(res.success).toBe(true);
    expect(ctx!.activeRole).toBe('admin');
    expect(ctx!.currentUser?.role).toBe('admin');
    expect(ctx!.currentUser?.adminSubrole).toBe('chairperson');
    expect(ctx!.currentUser?.title).toBe('Department Chairperson');
    expect(ctx!.currentUser?.department).toBe('Computer Science');
  });
});

