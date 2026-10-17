// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';
import { LMSProvider, useLMS, type LMSContextType } from '../../shared/context/LMSContext';

vi.mock('../../shared/api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  getToken: () => null,
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: vi.fn(async () => {
    throw new Error('unmocked apiFetch');
  }),
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
      updateUser: vi.fn(async (id: string, patch: any) => ({ id, ...patch })),
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

let lmsContext: LMSContextType | null = null;

const ContextProbe: React.FC = () => {
  lmsContext = useLMS();
  return null;
};

describe('RegisterPage Dynamic Self-Registration Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lmsContext = null;
    try {
      localStorage.clear();
    } catch {}
  });

  it('renders default colleges and reflects newly added college and department dynamically', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
        <MemoryRouter initialEntries={['/register']}>
          <RegisterPage />
        </MemoryRouter>
      </LMSProvider>
    );

    // 1. Verify that initially rendered colleges include default colleges
    const collegeSelect = screen.getByLabelText(/college/i) as HTMLSelectElement;
    const departmentSelect = screen.getByLabelText(/program|department/i) as HTMLSelectElement;

    expect(collegeSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /College of Computer Science/i })).toBeInTheDocument();

    // Department select starts disabled with prompt to select a college first
    expect(departmentSelect).toBeDisabled();
    expect(screen.getByRole('option', { name: /Select a College first/i })).toBeInTheDocument();

    // Verify newly added college is not yet present
    expect(screen.queryByRole('option', { name: /College of Allied Health Sciences/i })).not.toBeInTheDocument();

    // 2. Call addCollege with a newly created college
    await act(async () => {
      await lmsContext!.addCollege({
        id: 'col-cahs',
        name: 'College of Allied Health Sciences',
        code: 'CAHS',
      });
    });

    // Verify new college is now an option in the dropdown
    expect(screen.getByRole('option', { name: /College of Allied Health Sciences \(CAHS\)/i })).toBeInTheDocument();

    // 3. Call addDepartment with a newly created department under that college
    await act(async () => {
      await lmsContext!.addDepartment({
        id: 'dept-nurs',
        collegeId: 'col-cahs',
        name: 'Department of Nursing',
        code: 'NURS',
      });
    });

    // 4. Select newly created college
    fireEvent.change(collegeSelect, { target: { value: 'col-cahs' } });
    expect(collegeSelect.value).toBe('col-cahs');

    // 5. Verify Department dropdown is enabled and immediately reveals "Department of Nursing"
    expect(departmentSelect).not.toBeDisabled();
    expect(screen.getByRole('option', { name: /Department of Nursing/i })).toBeInTheDocument();

    // Verify departments from other colleges are NOT shown in CAHS
    expect(screen.queryByRole('option', { name: /(Program|Department) (in|of) Computer Science/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Department of Elementary Education/i })).not.toBeInTheDocument();

    // Select the newly available department
    fireEvent.change(departmentSelect, { target: { value: 'Department of Nursing' } });
    expect(departmentSelect.value).toBe('Department of Nursing');

    // 6. Changing college filters departments dynamically and resets department value
    fireEvent.change(collegeSelect, { target: { value: 'col-ccs' } });
    expect(departmentSelect.value).toBe('');
    expect(screen.getByRole('option', { name: /(Program|Department) (in|of) Computer Science/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Department of Nursing/i })).not.toBeInTheDocument();

    // Switch back to CAHS: Nursing should be present again
    fireEvent.change(collegeSelect, { target: { value: 'col-cahs' } });
    expect(screen.getByRole('option', { name: /Department of Nursing/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Department of Computer Science/i })).not.toBeInTheDocument();
  });

  it('supports multiple dynamic departments added under a new college', async () => {
    render(
      <LMSProvider>
        <ContextProbe />
        <MemoryRouter initialEntries={['/register']}>
          <RegisterPage />
        </MemoryRouter>
      </LMSProvider>
    );

    const collegeSelect = screen.getByLabelText(/college/i) as HTMLSelectElement;
    const departmentSelect = screen.getByLabelText(/program|department/i) as HTMLSelectElement;

    await act(async () => {
      await lmsContext!.addCollege({
        id: 'col-claw',
        name: 'College of Law',
        code: 'CLAW',
      });
      await lmsContext!.addDepartment({
        id: 'dept-crim',
        collegeId: 'col-claw',
        name: 'Department of Criminal Jurisprudence',
        code: 'CRIM',
      });
      await lmsContext!.addDepartment({
        id: 'dept-civ',
        collegeId: 'col-claw',
        name: 'Department of Civil Law',
        code: 'CIV',
      });
    });

    fireEvent.change(collegeSelect, { target: { value: 'col-claw' } });

    expect(screen.getByRole('option', { name: /Department of Criminal Jurisprudence/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Department of Civil Law/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Department of Computer Science/i })).not.toBeInTheDocument();

    // Select one of the law departments
    fireEvent.change(departmentSelect, { target: { value: 'Department of Civil Law' } });
    expect(departmentSelect.value).toBe('Department of Civil Law');
  });
});
