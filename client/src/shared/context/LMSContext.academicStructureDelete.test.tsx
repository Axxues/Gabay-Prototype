// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React, { useContext } from 'react';
import { LMSProvider, LMSContext } from './LMSContext';
import type { UserRole } from '../types/lms';

const deleteCollegeMock = vi.fn();
const deleteDepartmentMock = vi.fn();
const getUsersMock = vi.fn();

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  SESSION_EXPIRED_EVENT: 'gabay:session-expired',
  getToken: () => null,
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: vi.fn(),
  likhaLmsApi: {
    academicStructure: {
      getColleges: vi.fn(async () => []),
      getDepartments: vi.fn(async () => []),
      createCollege: vi.fn(async () => ({})),
      updateCollege: vi.fn(async () => ({})),
      deleteCollege: (...args: any[]) => (deleteCollegeMock as any)(...args),
      createDepartment: vi.fn(async () => ({})),
      updateDepartment: vi.fn(async () => ({})),
      deleteDepartment: (...args: any[]) => (deleteDepartmentMock as any)(...args),
    },
    users: {
      getUsers: (...args: any[]) => (getUsersMock as any)(...args),
      updateUser: vi.fn(async () => ({})),
    },
    communications: {
      getCalendarEvents: vi.fn(async () => []),
      getMessages: vi.fn(async () => []),
      getChatGroups: vi.fn(async () => []),
      getAdvisingSlots: vi.fn(async () => []),
    },
    requests: {
      getRequests: vi.fn(async () => []),
    },
    getCoursesWithRelations: vi.fn(async () => []),
    getNotifications: vi.fn(async () => []),
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

describe('LMSContext Academic Structure Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getUsersMock.mockResolvedValue([]);
    deleteCollegeMock.mockResolvedValue({});
    deleteDepartmentMock.mockResolvedValue({});
  });

  function TestHarness({ onReady }: { onReady: (ctx: ReturnType<typeof useContext<typeof LMSContext>>) => void }) {
    const ctx = useContext(LMSContext);
    if (ctx) onReady(ctx);
    return <div>Academic Units: {ctx?.colleges.length ?? 0} colleges, {ctx?.departments.length ?? 0} departments</div>;
  }

  test('blocks department deletion if a chairperson is assigned', async () => {
    localStorage.setItem(
      'gabay_colleges',
      JSON.stringify([{ id: 'c-1', name: 'College of Science', code: 'COS' }])
    );
    localStorage.setItem(
      'gabay_departments',
      JSON.stringify([
        { id: 'd-1', collegeId: 'c-1', name: 'Chemistry', code: 'CHEM', chairpersonId: 'u-chair-chem' },
      ])
    );

    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const blockers = capturedCtx.getDepartmentDeleteBlockers('d-1');
    expect(blockers.some((b: string) => /chairperson/i.test(b))).toBe(true);

    const res = await capturedCtx.deleteDepartment('d-1');
    expect(res.success).toBe(false);
    expect(res.blockers?.length).toBeGreaterThan(0);
    expect(deleteDepartmentMock).not.toHaveBeenCalled();
  });

  test('blocks department deletion if users are affiliated with the department', async () => {
    localStorage.setItem(
      'gabay_colleges',
      JSON.stringify([{ id: 'c-1', name: 'College of Science', code: 'COS' }])
    );
    localStorage.setItem(
      'gabay_departments',
      JSON.stringify([
        { id: 'd-1', collegeId: 'c-1', name: 'Chemistry', code: 'CHEM' },
      ])
    );

    localStorage.setItem(
      'gabay_pending_registrations',
      JSON.stringify([
        {
          id: 'reg-chem-1',
          name: 'Chem Student',
          email: 'chem.stu@dmmmsu.edu.ph',
          role: 'student',
          department: 'Chemistry',
          status: 'pending',
        },
      ])
    );

    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const blockers = capturedCtx.getDepartmentDeleteBlockers('d-1');
    expect(blockers.some((b: string) => /affiliated|enrolled|pending/i.test(b))).toBe(true);

    const res = await capturedCtx.deleteDepartment('d-1');
    expect(res.success).toBe(false);
    expect(deleteDepartmentMock).not.toHaveBeenCalled();
  });

  test('successfully deletes department when empty and leaderless', async () => {
    localStorage.setItem(
      'gabay_colleges',
      JSON.stringify([{ id: 'c-1', name: 'College of Science', code: 'COS' }])
    );
    localStorage.setItem(
      'gabay_departments',
      JSON.stringify([
        { id: 'd-empty', collegeId: 'c-1', name: 'Astronomy', code: 'ASTRO' },
      ])
    );

    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const blockers = capturedCtx.getDepartmentDeleteBlockers('d-empty');
    expect(blockers).toEqual([]);

    let res: any;
    await act(async () => {
      res = await capturedCtx.deleteDepartment('d-empty');
    });

    expect(res.success).toBe(true);
    expect(capturedCtx.departments.some((d: any) => d.id === 'd-empty')).toBe(false);
    expect(deleteDepartmentMock).toHaveBeenCalledWith('d-empty');

    const saved = JSON.parse(localStorage.getItem('gabay_departments') || '[]');
    expect(saved.some((d: any) => d.id === 'd-empty')).toBe(false);
  });

  test('blocks college deletion if dean is assigned', async () => {
    localStorage.setItem(
      'gabay_colleges',
      JSON.stringify([{ id: 'c-dean', name: 'College of Arts', code: 'COA', deanId: 'u-dean-art' }])
    );

    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const blockers = capturedCtx.getCollegeDeleteBlockers('c-dean');
    expect(blockers.some((b: string) => /dean/i.test(b))).toBe(true);

    const res = await capturedCtx.deleteCollege('c-dean');
    expect(res.success).toBe(false);
    expect(deleteCollegeMock).not.toHaveBeenCalled();
  });

  test('blocks college deletion if any child department has a chairperson or affiliated users', async () => {
    localStorage.setItem(
      'gabay_colleges',
      JSON.stringify([{ id: 'c-has-dept', name: 'College of Business', code: 'COB' }])
    );
    localStorage.setItem(
      'gabay_departments',
      JSON.stringify([
        { id: 'd-chair', collegeId: 'c-has-dept', name: 'Marketing', code: 'MKTG', chairpersonId: 'u-chair-mktg' },
      ])
    );

    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const blockers = capturedCtx.getCollegeDeleteBlockers('c-has-dept');
    expect(blockers.some((b: string) => /chairperson/i.test(b))).toBe(true);

    const res = await capturedCtx.deleteCollege('c-has-dept');
    expect(res.success).toBe(false);
    expect(deleteCollegeMock).not.toHaveBeenCalled();
  });

  test('successfully deletes college and cascades deletion to all child departments when empty', async () => {
    localStorage.setItem(
      'gabay_colleges',
      JSON.stringify([{ id: 'c-cascade', name: 'College of Architecture', code: 'COARCH' }])
    );
    localStorage.setItem(
      'gabay_departments',
      JSON.stringify([
        { id: 'd-arch-1', collegeId: 'c-cascade', name: 'Urban Design', code: 'UD' },
        { id: 'd-arch-2', collegeId: 'c-cascade', name: 'Landscape', code: 'LS' },
      ])
    );

    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    const blockers = capturedCtx.getCollegeDeleteBlockers('c-cascade');
    expect(blockers).toEqual([]);

    let res: any;
    await act(async () => {
      res = await capturedCtx.deleteCollege('c-cascade');
    });

    expect(res.success).toBe(true);
    // College deleted
    expect(capturedCtx.colleges.some((c: any) => c.id === 'c-cascade')).toBe(false);
    // Child departments cascaded
    expect(capturedCtx.departments.some((d: any) => d.id === 'd-arch-1')).toBe(false);
    expect(capturedCtx.departments.some((d: any) => d.id === 'd-arch-2')).toBe(false);

    // Backend sync called for both departments and the college
    expect(deleteDepartmentMock).toHaveBeenCalledWith('d-arch-1');
    expect(deleteDepartmentMock).toHaveBeenCalledWith('d-arch-2');
    expect(deleteCollegeMock).toHaveBeenCalledWith('c-cascade');

    // LocalStorage updated
    const savedCols = JSON.parse(localStorage.getItem('gabay_colleges') || '[]');
    expect(savedCols.some((c: any) => c.id === 'c-cascade')).toBe(false);
    const savedDepts = JSON.parse(localStorage.getItem('gabay_departments') || '[]');
    expect(savedDepts.some((d: any) => d.collegeId === 'c-cascade')).toBe(false);
  });
});
