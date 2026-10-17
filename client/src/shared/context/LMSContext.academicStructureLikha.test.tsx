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
    React.useEffect(() => {
      if (ctx) onReady(ctx);
    }, [ctx, onReady]);
    return <div>Academic Units: {ctx.colleges.length} colleges, {ctx.departments.length} departments</div>;
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
});
