// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
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

const mockAddCollege = vi.fn().mockResolvedValue({ id: 'col-new', name: 'New Col', code: 'NC' });
const mockAddDepartment = vi.fn().mockResolvedValue({ id: 'dept-new', collegeId: 'col-cet', name: 'New Dept', code: 'ND' });
const mockTransferLeadership = vi.fn().mockResolvedValue({ success: true, message: 'Leadership appointed' });
const mockDeleteCollege = vi.fn().mockResolvedValue({ success: true, message: 'College deleted' });
const mockDeleteDepartment = vi.fn().mockResolvedValue({ success: true, message: 'Department deleted' });
const mockGetCollegeDeleteBlockers = vi.fn().mockReturnValue([]);
const mockGetDepartmentDeleteBlockers = vi.fn().mockReturnValue([]);
const mockShowAlert = vi.fn();

const mockAddSchoolYear = vi.fn();
const mockSetActiveSchoolYear = vi.fn();

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

let sampleSchoolYears: SchoolYear[] = [
  {
    id: 'sy-cet-2025-2026',
    collegeId: 'col-cet',
    year: '2025-2026',
    isActive: true,
  },
  {
    id: 'sy-cas-2025-2026',
    collegeId: 'col-cas',
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
  {
    id: 'u-chancellor',
    name: 'Dr. Chancellor',
    email: 'chancellor@dmmmsu.edu.ph',
    role: 'superadmin',
    adminSubrole: 'chancellor',
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
    getSchoolYearsByCollege: (_colId: string) => sampleSchoolYears,
    getActiveSchoolYearForCollege: (_colId: string) => sampleSchoolYears.find(sy => sy.isActive) || sampleSchoolYears[0],
  }),
}));

import { AcademicStructureTab } from './AcademicStructureTab';

describe('AcademicStructureTab - Dean School Year Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sampleSchoolYears = [
      {
        id: 'sy-cet-2025-2026',
        collegeId: 'col-cet',
        year: '2025-2026',
        isActive: true,
      },
      {
        id: 'sy-cas-2025-2026',
        collegeId: 'col-cas',
        year: '2025-2026',
        isActive: true,
      },
    ];
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
    mockAddSchoolYear.mockResolvedValue({ success: true, message: 'School year "2026-2027" added successfully.' });
    mockSetActiveSchoolYear.mockResolvedValue({ success: true, message: 'School year "2026-2027" is now active.' });
  });

  test('Dean sees school years section for their college with active badge and can roll over to another year', async () => {
    sampleSchoolYears = [
      {
        id: 'sy-cet-2025-2026',
        year: '2025-2026',
        isActive: true,
      },
      {
        id: 'sy-cet-2026-2027',
        year: '2026-2027',
        isActive: false,
      },
    ];

    render(<AcademicStructureTab />);

    // School Year section should be displayed for the Dean's college
    expect(screen.getByText('Collegiate School Year & Rollover')).toBeInTheDocument();
    expect(screen.getByText('2025-2026')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Dean sees rollover button for inactive year, but NOT Add School Year (creation is admin-only)
    expect(screen.queryByRole('button', { name: /add school year/i })).not.toBeInTheDocument();
    const rolloverBtn = screen.getByRole('button', { name: /roll over/i });
    expect(rolloverBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(rolloverBtn);
    });

    expect(mockSetActiveSchoolYear).toHaveBeenCalledWith('col-cet', 'sy-cet-2026-2027');
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
      })
    );
  });

  test('Admin/Chancellor can add a new school year accessible across all colleges', async () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };

    render(<AcademicStructureTab />);

    const openModalBtn = screen.getAllByRole('button', { name: /add school year/i })[0];
    fireEvent.click(openModalBtn);

    // Modal opens
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /add school year/i })).toBeInTheDocument();
    const input = within(dialog).getByLabelText(/school year/i);

    // Enter invalid format first
    fireEvent.change(input, { target: { value: 'invalid-year' } });
    const submitBtn = within(dialog).getByRole('button', { name: /^add school year$/i });
    fireEvent.click(submitBtn);

    // Should not call addSchoolYear with invalid format
    expect(mockAddSchoolYear).not.toHaveBeenCalled();

    // Enter valid format
    fireEvent.change(input, { target: { value: '2026-2027' } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockAddSchoolYear).toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
      })
    );
  });

  test('Chairperson cannot add school years or roll over school years', () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-chair-it',
      name: 'Prof. Charlie IT',
      email: 'charlie.it@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'chairperson',
      collegeId: 'col-cet',
      department: 'Information Technology',
    };

    render(<AcademicStructureTab />);

    // Chairperson can view active school year badge or list, but no Add or Roll Over action buttons
    expect(screen.queryByRole('button', { name: /add school year/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll over/i })).not.toBeInTheDocument();
  });

  test('Chancellor/Superadmin can create school years and roll over for colleges', async () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };

    render(<AcademicStructureTab />);

    // Chancellor should have access to Add School Year buttons
    const addBtns = screen.getAllByRole('button', { name: /add school year/i });
    expect(addBtns.length).toBeGreaterThanOrEqual(1);
  });
});
