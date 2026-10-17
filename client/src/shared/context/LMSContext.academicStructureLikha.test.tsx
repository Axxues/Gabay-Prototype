// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React, { useContext } from 'react';
import { LMSProvider, LMSContext } from './LMSContext';

const getCollegesMock = vi.fn();
const createCollegeMock = vi.fn();
const updateCollegeMock = vi.fn();
const getDepartmentsMock = vi.fn();
const createDepartmentMock = vi.fn();
const updateDepartmentMock = vi.fn();
const updateUserMock = vi.fn();

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
      getColleges: (...args: any[]) => (getCollegesMock as any)(...args),
      createCollege: (...args: any[]) => (createCollegeMock as any)(...args),
      updateCollege: (...args: any[]) => (updateCollegeMock as any)(...args),
      getDepartments: (...args: any[]) => (getDepartmentsMock as any)(...args),
      createDepartment: (...args: any[]) => (createDepartmentMock as any)(...args),
      updateDepartment: (...args: any[]) => (updateDepartmentMock as any)(...args),
    },
    users: {
      getUsers: vi.fn(async () => []),
      updateUser: (...args: any[]) => (updateUserMock as any)(...args),
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

describe('LMSContext Likha ERP Academic Structure Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getCollegesMock.mockResolvedValue([
      { id: 'col-directus-1', name: 'College of Information Technology', code: 'CIT', dean_id: { id: 'u-dean-9' } },
    ]);
    getDepartmentsMock.mockResolvedValue([
      { id: 'dept-directus-1', college_id: { id: 'col-directus-1' }, name: 'Software Engineering', code: 'SE', chairperson_id: null },
    ]);
    createCollegeMock.mockResolvedValue({ id: 'col-new' });
    updateCollegeMock.mockResolvedValue({ id: 'col-updated' });
    createDepartmentMock.mockResolvedValue({ id: 'dept-new' });
    updateDepartmentMock.mockResolvedValue({ id: 'dept-updated' });
    updateUserMock.mockResolvedValue({});
  });

  function TestHarness({ onReady }: { onReady: (ctx: ReturnType<typeof useContext<typeof LMSContext>>) => void }) {
    const ctx = useContext(LMSContext);
    if (ctx) onReady(ctx);
    return <div>Academic Units: {ctx?.colleges.length ?? 0} colleges, {ctx?.departments.length ?? 0} departments</div>;
  }

  test('synchronizes colleges and departments from Likha ERP on mount', async () => {
    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(getCollegesMock).toHaveBeenCalled();
      expect(getDepartmentsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(capturedCtx.colleges.some((c: any) => c.id === 'col-directus-1' && c.code === 'CIT')).toBe(true);
      expect(capturedCtx.departments.some((d: any) => d.id === 'dept-directus-1' && d.code === 'SE')).toBe(true);
    });
  });

  test('syncs new college creation and leadership assignment to Likha ERP', async () => {
    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    await act(async () => {
      await capturedCtx.addCollege(
        { id: 'col-art', name: 'College of Arts', code: 'COA' },
        'u-faculty-1'
      );
    });

    expect(createCollegeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'col-art',
        name: 'College of Arts',
        code: 'COA',
        dean_id: 'u-faculty-1',
      })
    );
    expect(updateUserMock).toHaveBeenCalledWith('u-faculty-1', { role: 'admin' });
  });

  test('syncs department creation to Likha ERP', async () => {
    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    await act(async () => {
      await capturedCtx.addDepartment(
        { id: 'dept-art-1', collegeId: 'col-art', name: 'Fine Arts', code: 'FA' },
        'u-faculty-2'
      );
    });

    expect(createDepartmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dept-art-1',
        college_id: 'col-art',
        name: 'Fine Arts',
        code: 'FA',
        chairperson_id: 'u-faculty-2',
      })
    );
    expect(updateUserMock).toHaveBeenCalledWith('u-faculty-2', { role: 'admin' });
  });

  test('syncs leadership transfer in a college to Likha ERP', async () => {
    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    await act(async () => {
      await capturedCtx.transferLeadership('dean', 'u-dean-9', 'u-faculty-3', 'col-directus-1');
    });

    expect(updateCollegeMock).toHaveBeenCalledWith('col-directus-1', {
      dean_id: 'u-faculty-3',
    });
    expect(updateUserMock).toHaveBeenCalledWith('u-dean-9', { role: 'faculty' });
    expect(updateUserMock).toHaveBeenCalledWith('u-faculty-3', { role: 'admin' });
  });

  test('preserves locally created colleges and departments across mount revalidation', async () => {
    localStorage.setItem(
      'gabay_colleges',
      JSON.stringify([
        { id: '11111111-1111-4111-8111-111111111111', name: 'Custom Local College', code: 'CLC' },
      ])
    );
    localStorage.setItem(
      'gabay_departments',
      JSON.stringify([
        {
          id: '22222222-2222-4222-8222-222222222222',
          collegeId: '11111111-1111-4111-8111-111111111111',
          name: 'Custom Local Department',
          code: 'CLD',
        },
      ])
    );

    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(getCollegesMock).toHaveBeenCalled();
      expect(getDepartmentsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      // Remote college synchronized
      expect(capturedCtx.colleges.some((c: any) => c.id === 'col-directus-1')).toBe(true);
      // Locally created college preserved on reload/refresh
      expect(capturedCtx.colleges.some((c: any) => c.code === 'CLC')).toBe(true);

      // Remote department synchronized
      expect(capturedCtx.departments.some((d: any) => d.id === 'dept-directus-1')).toBe(true);
      // Locally created department preserved on reload/refresh
      expect(capturedCtx.departments.some((d: any) => d.code === 'CLD')).toBe(true);
    });
  });

  test('adopts remote UUID returned by Likha ERP on creation and updates localStorage', async () => {
    createCollegeMock.mockResolvedValueOnce({
      id: '99999999-9999-4999-8999-999999999999',
      name: 'College of Allied Health',
      code: 'CAH',
    });
    createDepartmentMock.mockResolvedValueOnce({
      id: '88888888-8888-4888-8888-888888888888',
      college_id: '99999999-9999-4999-8999-999999999999',
      name: 'Department of Nursing',
      code: 'NUR',
    });

    let capturedCtx: any = null;
    render(
      <LMSProvider>
        <TestHarness onReady={ctx => { capturedCtx = ctx; }} />
      </LMSProvider>
    );

    await waitFor(() => expect(capturedCtx).not.toBeNull());

    await act(async () => {
      await capturedCtx.addCollege({
        id: 'temp-c-id',
        name: 'College of Allied Health',
        code: 'CAH',
      });
    });

    await waitFor(() => {
      expect(capturedCtx.colleges.some((c: any) => c.id === '99999999-9999-4999-8999-999999999999')).toBe(true);
      const stored = JSON.parse(localStorage.getItem('gabay_colleges') || '[]');
      expect(stored.some((c: any) => c.id === '99999999-9999-4999-8999-999999999999')).toBe(true);
    });

    await act(async () => {
      await capturedCtx.addDepartment({
        id: 'temp-d-id',
        collegeId: '99999999-9999-4999-8999-999999999999',
        name: 'Department of Nursing',
        code: 'NUR',
      });
    });

    await waitFor(() => {
      expect(capturedCtx.departments.some((d: any) => d.id === '88888888-8888-4888-8888-888888888888')).toBe(true);
      const storedDepts = JSON.parse(localStorage.getItem('gabay_departments') || '[]');
      expect(storedDepts.some((d: any) => d.id === '88888888-8888-4888-8888-888888888888')).toBe(true);
    });
  });
});

