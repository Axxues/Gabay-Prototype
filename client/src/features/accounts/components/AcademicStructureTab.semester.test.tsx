// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import type { College, Department, SchoolYear, User } from '../../../shared/types/lms';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAddCollege = vi.fn();
const mockAddDepartment = vi.fn();
const mockTransferLeadership = vi.fn();
const mockDeleteCollege = vi.fn();
const mockDeleteDepartment = vi.fn();
const mockGetCollegeDeleteBlockers = vi.fn().mockReturnValue([]);
const mockGetDepartmentDeleteBlockers = vi.fn().mockReturnValue([]);
const mockShowAlert = vi.fn();

const mockAddSchoolYear = vi.fn();
const mockSetActiveSchoolYear = vi.fn();
const mockSetBaselineSchoolYear = vi.fn().mockResolvedValue({ success: true, message: 'Baseline updated' });
const mockGetBaselineSchoolYear = vi.fn().mockReturnValue({ id: 'sy-2025-2026', year: '2025-2026', isActive: true });

const mockSetBaselineSemester = vi.fn().mockResolvedValue({ success: true, message: 'Baseline semester updated' });
const mockGetActiveSemesterForCollege = vi.fn().mockReturnValue('First');
const mockSetActiveSemesterForCollege = vi.fn().mockResolvedValue({ success: true, message: 'College rolled over' });

let mockActiveRole: string = 'admin';
let mockActiveUser: Partial<User> = {
  id: 'u-admin',
  name: 'University Admin',
  email: 'admin@dmmmsu.edu.ph',
  role: 'admin',
  adminSubrole: undefined,
};

const sampleColleges: College[] = [
  {
    id: 'col-cet',
    name: 'College of Engineering and Technology',
    code: 'CET',
    deanId: 'u-dean-cet',
  },
  {
    id: 'col-cas',
    name: 'College of Arts and Sciences',
    code: 'CAS',
    deanId: 'u-dean-cas',
  },
];

const sampleDepartments: Department[] = [
  {
    id: 'dept-it',
    collegeId: 'col-cet',
    name: 'Information Technology',
    code: 'IT',
    chairpersonId: 'u-chair-it',
  },
];

const sampleSchoolYears: SchoolYear[] = [
  {
    id: 'sy-2025-2026',
    year: '2025-2026',
    isActive: true,
  },
];

const sampleUsers: User[] = [
  {
    id: 'u-admin',
    name: 'University Admin',
    email: 'admin@dmmmsu.edu.ph',
    role: 'admin',
    avatar: '',
  },
  {
    id: 'u-dean-cet',
    name: 'Dean Alice CET',
    email: 'alice.cet@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    collegeId: 'col-cet',
    collegeName: 'College of Engineering and Technology',
    avatar: '',
  },
];

vi.mock('../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    colleges: sampleColleges,
    departments: sampleDepartments,
    addCollege: mockAddCollege,
    addDepartment: mockAddDepartment,
    transferLeadership: mockTransferLeadership,
    deleteCollege: mockDeleteCollege,
    deleteDepartment: mockDeleteDepartment,
    getCollegeDeleteBlockers: mockGetCollegeDeleteBlockers,
    getDepartmentDeleteBlockers: mockGetDepartmentDeleteBlockers,
    db: {
      users: sampleUsers,
    },
    showAlert: mockShowAlert,
    activeRole: mockActiveRole,
    activeUser: mockActiveUser,
    schoolYears: sampleSchoolYears,
    addSchoolYear: mockAddSchoolYear,
    setActiveSchoolYear: mockSetActiveSchoolYear,
    setBaselineSchoolYear: mockSetBaselineSchoolYear,
    getBaselineSchoolYear: mockGetBaselineSchoolYear,
    getSchoolYearsByCollege: (_colId: string) => sampleSchoolYears,
    getActiveSchoolYearForCollege: (_colId: string) => sampleSchoolYears[0],
    baselineSemester: 'Second',
    setBaselineSemester: mockSetBaselineSemester,
    getActiveSemesterForCollege: mockGetActiveSemesterForCollege,
    setActiveSemesterForCollege: mockSetActiveSemesterForCollege,
  }),
}));

import { AcademicStructureTab } from './AcademicStructureTab';

  describe('AcademicStructureTab - University Semester Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-admin',
      name: 'University Admin',
      email: 'admin@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: undefined,
    };
  });

  test('renders the baseline semester control for a university administrator', () => {
    render(<AcademicStructureTab />);

    expect(screen.getByLabelText(/Select University Semester/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Second Semester/)[0]).toBeInTheDocument();
  });

  test('hides the baseline semester control from a Dean', () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-dean-cet',
      name: 'Dean Alice CET',
      email: 'alice.cet@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-cet',
    };

    render(<AcademicStructureTab />);

    expect(screen.queryByLabelText(/Select University Semester/i)).toBeNull();
  });

  test('confirms before updating the baseline semester', async () => {
    render(<AcademicStructureTab />);

    const select = screen.getByLabelText(/Select University Semester/i);
    fireEvent.change(select, { target: { value: 'Mid-Year' } });

    const updateBtn = screen.getByRole('button', { name: /Update Semester/i });
    expect(updateBtn).not.toBeDisabled();

    fireEvent.click(updateBtn);

    expect(screen.getByText('Confirm University Semester Update')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm University Semester' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSetBaselineSemester).toHaveBeenCalledWith('Mid-Year');
    });
  });

  test('disables the update button when the selection matches the current baseline', () => {
    render(<AcademicStructureTab />);

    const updateBtn = screen.getByRole('button', { name: /Update Semester/i });
    expect(updateBtn).toBeDisabled();

    const select = screen.getByLabelText(/Select University Semester/i);
    fireEvent.change(select, { target: { value: 'Second' } });

    expect(updateBtn).toBeDisabled();
  });
});
