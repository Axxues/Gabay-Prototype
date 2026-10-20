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
const mockGetActiveSemesterForCollege = vi.fn();
const mockSetActiveSemesterForCollege = vi.fn().mockResolvedValue({ success: true, message: 'College rolled over' });

let mockActiveRole: string = 'admin';
let mockActiveUser: Partial<User> = {
  id: 'u-dean-cet',
  name: 'Dean Alice CET',
  email: 'alice.cet@dmmmsu.edu.ph',
  role: 'admin',
  adminSubrole: 'dean',
  collegeId: 'col-cet',
  collegeName: 'College of Engineering and Technology',
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
    id: 'u-dean-cet',
    name: 'Dean Alice CET',
    email: 'alice.cet@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    collegeId: 'col-cet',
    collegeName: 'College of Engineering and Technology',
    avatar: '',
  },
  {
    id: 'u-chair-it',
    name: 'Prof. Charlie IT',
    email: 'charlie.it@dmmmsu.edu.ph',
    role: 'faculty',
    adminSubrole: 'chairperson',
    collegeId: 'col-cet',
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

describe('AcademicStructureTab - Collegiate Semester Rollover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-dean-cet',
      name: 'Dean Alice CET',
      email: 'alice.cet@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-cet',
      collegeName: 'College of Engineering and Technology',
    };
    mockGetActiveSemesterForCollege.mockImplementation((collegeId?: string) => {
      if (collegeId === 'col-cet') return 'First';
      return 'First';
    });
  });

  test('shows the college active semester and the amber mismatch badge', () => {
    render(<AcademicStructureTab />);

    // Expand College of Engineering and Technology
    fireEvent.click(screen.getByLabelText('Toggle programs for College of Engineering and Technology'));

    expect(screen.getByTestId('college-active-semester-col-cet')).toHaveTextContent('First Semester');
    expect(screen.getByTestId('baseline-semester-mismatch-badge-col-cet')).toBeInTheDocument();
  });

  test('rolls the college over to the baseline semester after confirmation', async () => {
    render(<AcademicStructureTab />);

    fireEvent.click(screen.getByLabelText('Toggle programs for College of Engineering and Technology'));

    const select = screen.getByLabelText('Select semester to roll over for College of Engineering and Technology');
    fireEvent.change(select, { target: { value: 'Second' } });

    const rollBtn = screen.getByRole('button', { name: /Roll Over to Semester/i });
    expect(rollBtn).not.toBeDisabled();

    fireEvent.click(rollBtn);

    expect(screen.getByText('Confirm Semester Rollover')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Rollover' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockSetActiveSemesterForCollege).toHaveBeenCalledWith('col-cet', 'Second');
    });
  });

  test('disables the semester rollover when the selection matches the college active semester', () => {
    mockGetActiveSemesterForCollege.mockReturnValue('Second');

    render(<AcademicStructureTab />);

    fireEvent.click(screen.getByLabelText('Toggle programs for College of Engineering and Technology'));

    const rollBtn = screen.getByRole('button', { name: /Roll Over to Semester/i });
    expect(rollBtn).toBeDisabled();
  });

  test('does not offer the semester rollover to a chairperson', () => {
    mockActiveRole = 'faculty';
    mockActiveUser = {
      id: 'u-chair-it',
      name: 'Prof. Charlie IT',
      email: 'charlie.it@dmmmsu.edu.ph',
      role: 'faculty',
      adminSubrole: 'chairperson',
      collegeId: 'col-cet',
    };

    render(<AcademicStructureTab />);

    fireEvent.click(screen.getByLabelText('Toggle programs for College of Engineering and Technology'));

    expect(screen.queryByRole('button', { name: /Roll Over to Semester/i })).toBeNull();
    expect(screen.getByTestId('college-active-semester-col-cet')).toBeInTheDocument();
  });
});
