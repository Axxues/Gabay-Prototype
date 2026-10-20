// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetSchoolYears = vi.fn(async () => [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', year: '2026-2027', is_active: true, semester: 'Second' },
]);
const mockUpdateSchoolYear = vi.fn(async () => ({}));
const mockUpdateSchoolYearSemester = vi.fn(async () => ({}));

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
    loginLikhaUser: vi.fn(async () => ({
      token: 't-admin',
      user: {
        id: 'u-chancellor',
        first_name: 'Jayvee',
        last_name: 'Admin',
        email: 'jayveegenetareyes@gmail.com',
        role: { name: 'Administrator' },
      },
    })),
    getCoursesWithRelations: vi.fn(async () => []),
    getNotifications: vi.fn(async () => []),
    users: {
      getUsers: vi.fn(async () => []),
    },
    academicStructure: {
      getColleges: vi.fn(async () => [{ id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' }]),
      getDepartments: vi.fn(async () => []),
      getSchoolYears: (...args: any[]) => (mockGetSchoolYears as any)(...args),
      updateSchoolYear: (...args: any[]) => (mockUpdateSchoolYear as any)(...args),
      updateSchoolYearSemester: (...args: any[]) => (mockUpdateSchoolYearSemester as any)(...args),
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

describe('Baseline Semester ERP persistence and hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {}
    mockGetSchoolYears.mockResolvedValue([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', year: '2026-2027', is_active: true, semester: 'Second' },
    ]);
    mockUpdateSchoolYear.mockResolvedValue({});
    mockUpdateSchoolYearSemester.mockResolvedValue({});
  });

  const mountLms = async () => {
    let currentValues: any = null;
    const Probe = () => {
      currentValues = useLMS();
      return null;
    };
    await act(async () => {
      render(
        <LMSProvider>
          <Probe />
        </LMSProvider>
      );
    });
    return {
      get: () => currentValues,
    };
  };

  test('hydrates the baseline semester from the active ERP school year row', async () => {
    const { get } = await mountLms();

    await waitFor(() => {
      expect(get().baselineSemester).toBe('Second');
    });
  });

  test('normalizes a legacy Summer value to Mid-Year and unrecognized text to First', async () => {
    mockGetSchoolYears.mockResolvedValueOnce([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', year: '2026-2027', is_active: true, semester: 'Summer' },
    ]);
    const firstMount = await mountLms();
    await waitFor(() => {
      expect(firstMount.get().baselineSemester).toBe('Mid-Year');
    });

    try {
      localStorage.clear();
    } catch {}

    mockGetSchoolYears.mockResolvedValueOnce([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', year: '2026-2027', is_active: true, semester: 'nonsense' },
    ]);
    const secondMount = await mountLms();
    await waitFor(() => {
      expect(secondMount.get().baselineSemester).toBe('First');
    });

    try {
      localStorage.clear();
    } catch {}

    mockGetSchoolYears.mockResolvedValueOnce([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', year: '2026-2027', is_active: true, semester: null },
    ]);
    const thirdMount = await mountLms();
    await waitFor(() => {
      expect(thirdMount.get().baselineSemester).toBe('First');
    });
  });

  test('PATCHes semester on the active school year row when the baseline semester changes', async () => {
    const { get } = await mountLms();

    await waitFor(() => {
      expect(get().baselineSemester).toBe('Second');
    });

    await act(async () => {
      await get().setBaselineSemester('Mid-Year');
    });

    expect(mockUpdateSchoolYearSemester).toHaveBeenCalledWith('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mid-Year');
  });

  test('sends is_active and semester First together when the baseline school year changes', async () => {
    mockGetSchoolYears.mockResolvedValue([
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', year: '2026-2027', is_active: true, semester: 'Second' },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', year: '2027-2028', is_active: false, semester: 'First' },
    ]);

    const { get } = await mountLms();

    await waitFor(() => {
      expect(get().baselineSemester).toBe('Second');
    });

    await act(async () => {
      await get().setBaselineSchoolYear('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    });

    expect(mockUpdateSchoolYear).toHaveBeenCalledWith('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', {
      is_active: true,
      semester: 'First',
    });
  });

  test('keeps the local baseline semester change when the ERP call rejects', async () => {
    mockUpdateSchoolYearSemester.mockRejectedValueOnce(new Error('502 Bad Gateway'));

    const { get } = await mountLms();

    await waitFor(() => {
      expect(get().baselineSemester).toBe('Second');
    });

    let res: any;
    await act(async () => {
      res = await get().setBaselineSemester('First');
    });

    expect(res.success).toBe(true);
    expect(get().baselineSemester).toBe('First');
  });
});
