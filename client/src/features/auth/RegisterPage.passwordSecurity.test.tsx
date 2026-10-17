// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

vi.mock('../../shared/api/client', () => ({
  ApiError: class ApiError extends Error {},
  getToken: () => null,
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: vi.fn(),
  likhaLmsApi: {
    getCoursesWithRelations: vi.fn(async () => []),
    getNotifications: vi.fn(async () => []),
    communications: {
      getMessages: vi.fn(async () => []),
      getCalendarEvents: vi.fn(async () => []),
      getChatGroups: vi.fn(async () => []),
      getAdvisingSlots: vi.fn(async () => []),
    },
    academicStructure: { getColleges: vi.fn(async () => []), getDepartments: vi.fn(async () => []) },
    users: { getUsers: vi.fn(async () => []) },
    sections: { getSections: vi.fn(async () => []) },
    requests: { getRequests: vi.fn(async () => []) },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from '../../shared/context/LMSContext';

describe('Pending registration password storage security', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not serialize plaintext password into localStorage', async () => {
    const { result } = renderHook(() => useLMS(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <LMSProvider>{children}</LMSProvider>,
    });

    await act(async () => {
      await result.current.registerAccount({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-1',
        collegeName: 'College of Computer Science',
        department: 'CS',
        studentId: '231-1082-3',
        password: 'SuperSecretPassword123!',
      });
    });

    const stored = localStorage.getItem('gabay_pending_registrations');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('SuperSecretPassword123!');
  });
});
