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
const mockSetBaselineSchoolYear = vi.fn().mockResolvedValue({ success: true, message: 'Baseline updated' });
const mockGetBaselineSchoolYear = vi.fn().mockReturnValue({ id: 'sy-2025-2026', year: '2025-2026', isActive: true });

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
    setBaselineSchoolYear: mockSetBaselineSchoolYear,
    getBaselineSchoolYear: mockGetBaselineSchoolYear,
    getSchoolYearsByCollege: (_colId: string) => sampleSchoolYears,
    getActiveSchoolYearForCollege: (_colId: string) => sampleSchoolYears.find(sy => sy.isActive) || sampleSchoolYears[0],
    baselineSemester: 'Second',
    setBaselineSemester: vi.fn().mockResolvedValue({ success: true }),
    getActiveSemesterForCollege: vi.fn().mockReturnValue('First'),
    setActiveSemesterForCollege: vi.fn().mockResolvedValue({ success: true }),
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

  test('Dean sees school years section for their college with active badge and can roll over to the university baseline year', async () => {
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
    // Set university baseline to 2026-2027
    mockGetBaselineSchoolYear.mockReturnValue({ id: 'sy-cet-2026-2027', year: '2026-2027', isActive: true });

    render(<AcademicStructureTab />);

    // Expand college card since colleges are minimized by default
    const toggleBtn = screen.getByRole('button', { name: /toggle programs for college of engineering and technology/i });
    fireEvent.click(toggleBtn);

    // School Year section should be displayed for the Dean's college with a combo box / select list
    expect(screen.getByText('Collegiate School Year & Rollover')).toBeInTheDocument();
    expect(screen.getByText('2025-2026')).toBeInTheDocument();
    expect(screen.getByText('Active School Year:')).toBeInTheDocument();

    // Baseline is 2026-2027 while college active year is 2025-2026 -> baseline mismatch badge appears
    const mismatchBadge = screen.getByTestId('baseline-mismatch-badge-col-cet');
    expect(mismatchBadge).toBeInTheDocument();
    expect(within(mismatchBadge).getByText('Current Baseline:')).toBeInTheDocument();
    expect(within(mismatchBadge).getByText('2026-2027')).toBeInTheDocument();

    // Select list / combo box is rendered
    const sySelect = screen.getByLabelText(/select school year to roll over for college of engineering and technology/i);
    expect(sySelect).toBeInTheDocument();

    // Add School Year button is NOT rendered
    expect(screen.queryByRole('button', { name: /add school year/i })).not.toBeInTheDocument();
    const rolloverBtn = screen.getByRole('button', { name: /roll over/i });
    expect(rolloverBtn).toBeInTheDocument();

    // Select baseline year (2026-2027) and initiate roll over
    fireEvent.change(sySelect, { target: { value: 'sy-cet-2026-2027' } });
    expect(rolloverBtn).toBeEnabled();

    await act(async () => {
      fireEvent.click(rolloverBtn);
    });

    // Verification modal should now be visible before rollover executes
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /confirm academic year rollover/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/transitioning to sy 2026-2027/i)).toBeInTheDocument();
    expect(mockSetActiveSchoolYear).not.toHaveBeenCalled();

    // Confirm rollover
    const confirmBtn = within(dialog).getByRole('button', { name: /confirm rollover/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockSetActiveSchoolYear).toHaveBeenCalledWith('col-cet', 'sy-cet-2026-2027');
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
      })
    );
  });

  test('Dean cannot roll over to a school year that is not the current university baseline', async () => {
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
      {
        id: 'sy-cet-2027-2028',
        year: '2027-2028',
        isActive: false,
      },
    ];
    // Baseline is 2025-2026
    mockGetBaselineSchoolYear.mockReturnValue({ id: 'sy-cet-2025-2026', year: '2025-2026', isActive: true });

    render(<AcademicStructureTab />);

    // Expand college card since colleges are minimized by default
    const toggleBtn = screen.getByRole('button', { name: /toggle programs for college of engineering and technology/i });
    fireEvent.click(toggleBtn);

    const sySelect = screen.getByLabelText(/select school year to roll over for college of engineering and technology/i);
    const rolloverBtn = screen.getByRole('button', { name: /roll over/i });

    // Select a future non-baseline year (2026-2027)
    fireEvent.change(sySelect, { target: { value: 'sy-cet-2026-2027' } });

    // Rollover button must be disabled
    expect(rolloverBtn).toBeDisabled();

    // Guidance message must inform that only the current university baseline can be rolled over to
    expect(
      screen.getByText(/colleges can only roll over to the current university baseline academic year \(sy 2025-2026\)/i)
    ).toBeInTheDocument();

    // Even if clicked, no dialog opens
    await act(async () => {
      fireEvent.click(rolloverBtn);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockSetActiveSchoolYear).not.toHaveBeenCalled();
  });

  test('school year select is disabled when the university baseline matches the college active year', () => {
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
    // University baseline matches this college's active academic year.
    mockGetBaselineSchoolYear.mockReturnValue({ id: 'sy-cet-2025-2026', year: '2025-2026', isActive: true });

    render(<AcademicStructureTab />);

    fireEvent.click(screen.getByRole('button', { name: /toggle programs for college of engineering and technology/i }));

    // Nothing left to roll over to, so the year picker must not accept changes.
    const sySelect = screen.getByLabelText(/select school year to roll over for college of engineering and technology/i);
    expect(sySelect).toBeDisabled();
    expect(screen.getByRole('button', { name: /roll over/i })).toBeDisabled();

    // No mismatch badge when the college already sits on the baseline.
    expect(screen.queryByTestId('baseline-mismatch-badge-col-cet')).not.toBeInTheDocument();
  });

  test('school year select stays enabled when the university baseline differs from the college active year', () => {
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
    // Baseline is ahead of the college, so rolling over is a real decision.
    mockGetBaselineSchoolYear.mockReturnValue({ id: 'sy-cet-2026-2027', year: '2026-2027', isActive: true });

    render(<AcademicStructureTab />);

    fireEvent.click(screen.getByRole('button', { name: /toggle programs for college of engineering and technology/i }));

    const sySelect = screen.getByLabelText(/select school year to roll over for college of engineering and technology/i);
    expect(sySelect).toBeEnabled();
  });

  test('Add School Year button is removed from Academic Governance header for all roles', () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };

    render(<AcademicStructureTab />);

    // Since school years are now generated automatically, no Add School Year button should appear anywhere
    expect(screen.queryByRole('button', { name: /add school year/i })).not.toBeInTheDocument();
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

    // Chairperson can view active school year badge or select list, but no Add or Roll Over action buttons
    expect(screen.queryByRole('button', { name: /add school year/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll over/i })).not.toBeInTheDocument();
  });

  test('Chancellor, Superadmin, and General Admin do not have authority to roll over (only Deans)', () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };

    const { rerender } = render(<AcademicStructureTab />);

    // Superadmin / Chancellor has no rollover button
    expect(screen.queryByRole('button', { name: /roll over/i })).not.toBeInTheDocument();

    // General Admin (without dean subrole) also has no rollover button
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-admin-general',
      name: 'General Admin',
      email: 'admin@dmmmsu.edu.ph',
      role: 'admin',
    };

    rerender(<AcademicStructureTab />);
    expect(screen.queryByRole('button', { name: /roll over/i })).not.toBeInTheDocument();
  });

  test('individual college cards do not render an Add School Year button', () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };

    render(<AcademicStructureTab />);

    // Expand college cards to inspect their contents
    for (const college of sampleColleges) {
      const toggleBtn = screen.getByRole('button', { name: new RegExp(`toggle programs for ${college.name}`, 'i') });
      fireEvent.click(toggleBtn);
    }

    // Individual college card section should only show school years and rollover, without an individual Add button
    const sySections = screen.getAllByText('Collegiate School Year & Rollover');
    for (const sectionHeader of sySections) {
      const sectionContainer = sectionHeader.closest('.border-t');
      expect(within(sectionContainer as HTMLElement).queryByRole('button', { name: /add school year/i })).not.toBeInTheDocument();
    }
  });

  test('Admin/Chancellor has authority to change the University-Wide Default Baseline Year with verification modal', async () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };
    sampleSchoolYears = [
      {
        id: 'sy-univ-2025-2026',
        year: '2025-2026',
        isActive: true,
      },
      {
        id: 'sy-univ-2026-2027',
        year: '2026-2027',
        isActive: false,
      },
    ];
    mockGetBaselineSchoolYear.mockReturnValue({ id: 'sy-univ-2025-2026', year: '2025-2026', isActive: true });

    render(<AcademicStructureTab />);

    // Baseline card should be visible for Admin/Chancellor
    expect(screen.getByText('University-Wide Default Baseline Academic Year')).toBeInTheDocument();
    const select = screen.getByLabelText('Select University-Wide Default Baseline School Year');
    expect(select).toBeInTheDocument();

    const updateBtn = screen.getByRole('button', { name: /update baseline/i });
    expect(updateBtn).toBeDisabled();

    // Select another baseline year
    await act(async () => {
      fireEvent.change(select, { target: { value: 'sy-univ-2026-2027' } });
    });
    expect(updateBtn).toBeEnabled();

    // Click update -> verification modal opens
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /confirm baseline academic year update/i })).toBeInTheDocument();

    // Confirm update in modal
    const confirmBtn = within(dialog).getByRole('button', { name: /confirm update/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(mockSetBaselineSchoolYear).toHaveBeenCalledWith('sy-univ-2026-2027');
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
      })
    );
  });

  test('Dean does not see the University-Wide Baseline Year card (only collegiate rollover)', () => {
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

    render(<AcademicStructureTab />);

    // Dean sees collegiate rollover, but NOT the university-wide baseline management card
    expect(screen.queryByText('University-Wide Default Baseline Academic Year')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Select University-Wide Default Baseline School Year')).not.toBeInTheDocument();
  });

  test('Available Years only renders on the college card the viewer leads as Dean', () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-dean-cet',
      name: 'Dr. Chancellor Dean',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
      collegeId: 'col-cet',
    };

    render(<AcademicStructureTab />);

    // Expand college cards to inspect their contents
    for (const college of sampleColleges) {
      const toggleBtn = screen.getByRole('button', { name: new RegExp(`toggle programs for ${college.name}`, 'i') });
      fireEvent.click(toggleBtn);
    }

    // Chancellor authority is university-wide, so no collegiate rollover control renders...
    expect(screen.queryByRole('button', { name: /roll over/i })).not.toBeInTheDocument();

    // ...and the read-only summary survives only on their own (CET) card.
    expect(screen.getAllByText('Available Years:')).toHaveLength(1);
    expect(
      screen.getByLabelText(/available school years for college of engineering and technology/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/available school years for college of arts and sciences/i)
    ).not.toBeInTheDocument();
  });

  test('Available Years is hidden on every college card when the viewer leads no college', () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-admin-general',
      name: 'General Admin',
      email: 'admin@dmmmsu.edu.ph',
      role: 'admin',
    };

    render(<AcademicStructureTab />);

    // Expand college cards
    for (const college of sampleColleges) {
      const toggleBtn = screen.getByRole('button', { name: new RegExp(`toggle programs for ${college.name}`, 'i') });
      fireEvent.click(toggleBtn);
    }

    expect(screen.queryByText('Available Years:')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/available school years for/i)).not.toBeInTheDocument();
  });
});
