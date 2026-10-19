// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import type { User } from '../types/lms';
import { LMSProvider, useLMS } from './LMSContext';

const studentDirectusUser = {
  id: 'u-student-1',
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  email: 'juan@example.com',
  role: { name: 'Student' },
};

const facultyDirectusUser = {
  id: 'u-faculty-1',
  first_name: 'Maria',
  last_name: 'Santos',
  email: 'maria@example.com',
  role: { name: 'Faculty' },
};

let currentDirectusUser: any = studentDirectusUser;
let tokenInStore: string | null = 'test-token';

const getMeMock = vi.fn(async () => ({ ...currentDirectusUser }));
const updateUserMock = vi.fn(async (id: string, patch: any) => ({
  id,
  ...patch,
}));

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  getToken: () => tokenInStore,
  setToken: vi.fn(),
  clearToken: vi.fn(() => {
    tokenInStore = null;
  }),
  apiFetch: vi.fn(async () => {
    throw new Error('unmocked apiFetch');
  }),
  likhaLmsApi: {
    loginLikhaUser: vi.fn(async () => ({
      token: 't',
      user: { ...currentDirectusUser },
    })),
    auth: {
      getMe: (...args: any[]) => (getMeMock as any)(...args),
    },
    getCoursesWithRelations: vi.fn(async () => []),
    getNotifications: vi.fn(async () => []),
    users: {
      getUsers: vi.fn(async () => [currentDirectusUser]),
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

let activeUserSnapshot: User | null = null;
let updateUserFn: ((id: string, updates: Partial<User>) => Promise<boolean>) | null = null;
let authReadySnapshot = false;

const Probe: React.FC = () => {
  const { activeUser, updateUser, authReady } = useLMS();
  activeUserSnapshot = activeUser;
  updateUserFn = updateUser;
  authReadySnapshot = authReady;
  return null;
};

describe('Profile Persistence across Page Refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    activeUserSnapshot = null;
    updateUserFn = null;
    authReadySnapshot = false;
    tokenInStore = 'test-token';
    currentDirectusUser = studentDirectusUser;
  });

  test('student personal information is retained after page refresh', async () => {
    // 1. Initial render (mount)
    const { unmount } = render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(authReadySnapshot).toBe(true);
      expect(activeUserSnapshot?.id).toBe('u-student-1');
    });

    // 2. Student updates institutional profile
    const studentUpdates: Partial<User> = {
      birthday: '2004-05-15',
      contactNumber: '09123456789',
      permanentAddress: '123 Rizal St, Catbangen, San Fernando, La Union',
      presentAddress: '123 Rizal St, Catbangen, San Fernando, La Union',
      permanentAddressDetails: {
        houseStreet: '123 Rizal St',
        barangay: 'Catbangen',
        municipalityCity: 'San Fernando',
        province: 'La Union',
      },
      presentAddressDetails: {
        houseStreet: '123 Rizal St',
        barangay: 'Catbangen',
        municipalityCity: 'San Fernando',
        province: 'La Union',
      },
      sameAsPermanentAddress: true,
      hasGuardianOnly: false,
      motherName: { firstName: 'Maria', middleName: 'Santos', lastName: 'Dela Cruz' },
      fatherName: { firstName: 'Jose', middleName: 'Reyes', lastName: 'Dela Cruz' },
      guardianName: { firstName: '', middleName: '', lastName: '' },
      parentContactNumber: '09987654321',
      yearLevel: 2,
    };

    await act(async () => {
      const ok = await updateUserFn!('u-student-1', studentUpdates);
      expect(ok).toBe(true);
    });

    expect(activeUserSnapshot?.birthday).toBe('2004-05-15');
    expect(activeUserSnapshot?.contactNumber).toBe('09123456789');
    expect(activeUserSnapshot?.permanentAddressDetails?.barangay).toBe('Catbangen');

    // 3. Simulate page refresh: unmount and remount fresh LMSProvider
    unmount();
    activeUserSnapshot = null;
    authReadySnapshot = false;

    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(authReadySnapshot).toBe(true);
    });

    // 4. Verify all personal information persisted across reload
    expect(activeUserSnapshot?.birthday).toBe('2004-05-15');
    expect(activeUserSnapshot?.contactNumber).toBe('09123456789');
    expect(activeUserSnapshot?.permanentAddress).toBe('123 Rizal St, Catbangen, San Fernando, La Union');
    expect(activeUserSnapshot?.permanentAddressDetails?.barangay).toBe('Catbangen');
    expect(activeUserSnapshot?.sameAsPermanentAddress).toBe(true);
    expect(activeUserSnapshot?.motherName?.firstName).toBe('Maria');
    expect(activeUserSnapshot?.fatherName?.firstName).toBe('Jose');
    expect(activeUserSnapshot?.parentContactNumber).toBe('09987654321');
    expect(activeUserSnapshot?.yearLevel).toBe(2);
  });

  test('faculty credentials and experience are retained after page refresh', async () => {
    currentDirectusUser = facultyDirectusUser;

    const { unmount } = render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(authReadySnapshot).toBe(true);
      expect(activeUserSnapshot?.id).toBe('u-faculty-1');
    });

    // Faculty updates credentials
    const facultyUpdates: Partial<User> = {
      birthday: '1985-03-20',
      contactNumber: '09171234567',
      address: 'Central West, Bauang, La Union',
      permanentAddress: 'Central West, Bauang, La Union',
      presentAddress: 'Central West, Bauang, La Union',
      permanentAddressDetails: {
        houseStreet: '',
        barangay: 'Central West',
        municipalityCity: 'Bauang',
        province: 'La Union',
      },
      presentAddressDetails: {
        houseStreet: '',
        barangay: 'Central West',
        municipalityCity: 'Bauang',
        province: 'La Union',
      },
      sameAsPermanentAddress: true,
      yearsOfTeaching: 8,
      educationalBackground: [
        {
          id: 'deg-1',
          degreeLevel: 'masters',
          school: 'UP Diliman',
          yearGraduated: '2012',
          specialization: 'Computer Science',
        },
      ],
    };

    await act(async () => {
      const ok = await updateUserFn!('u-faculty-1', facultyUpdates);
      expect(ok).toBe(true);
    });

    expect(activeUserSnapshot?.birthday).toBe('1985-03-20');
    expect(activeUserSnapshot?.yearsOfTeaching).toBe(8);
    expect(activeUserSnapshot?.educationalBackground?.length).toBe(1);

    // Simulate page refresh: unmount and remount fresh LMSProvider
    unmount();
    activeUserSnapshot = null;
    authReadySnapshot = false;

    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await waitFor(() => {
      expect(authReadySnapshot).toBe(true);
    });

    // Verify all faculty credentials persisted across reload
    expect(activeUserSnapshot?.birthday).toBe('1985-03-20');
    expect(activeUserSnapshot?.contactNumber).toBe('09171234567');
    expect(activeUserSnapshot?.address).toBe('Central West, Bauang, La Union');
    expect(activeUserSnapshot?.yearsOfTeaching).toBe(8);
    expect(activeUserSnapshot?.educationalBackground?.length).toBe(1);
    expect(activeUserSnapshot?.educationalBackground?.[0].school).toBe('UP Diliman');
  });
});
