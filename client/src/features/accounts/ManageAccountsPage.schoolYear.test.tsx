// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ManageAccountsPage } from './ManageAccountsPage';
import type { User, College, Department, SchoolYear } from '../../shared/types/lms';

const mocks = vi.hoisted(() => {
  const mockSchoolYears: SchoolYear[] = [
    { id: 'sy-1', collegeId: 'col-ccs', year: '2024-2025', isActive: false },
    { id: 'sy-2', collegeId: 'col-ccs', year: '2025-2026', isActive: true },
    { id: 'sy-3', collegeId: 'col-ccs', year: '2026-2027', isActive: false },
  ];

  const mockUsers: User[] = [
    {
      id: 'u-admin',
      name: 'Dr. Alan Admin',
      email: 'admin@dmmmsu.edu.ph',
      role: 'admin',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      title: 'Administrator',
      avatar: '',
      schoolYear: '2025-2026',
    },
    {
      id: 'u-user-2425',
      name: 'Ada 2024',
      email: 'ada.2425@dmmmsu.edu.ph',
      role: 'faculty',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      title: 'Instructor',
      avatar: '',
      schoolYear: '2024-2025',
    },
    {
      id: 'u-user-2526',
      name: 'Grace 2025',
      email: 'grace.2526@dmmmsu.edu.ph',
      role: 'student',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      studentId: '2025-0001',
      title: 'Student',
      avatar: '',
      schoolYear: '2025-2026',
    },
    {
      id: 'u-user-nosy',
      name: 'Linus Legacy',
      email: 'linus.legacy@dmmmsu.edu.ph',
      role: 'staff',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      title: 'Staff',
      avatar: '',
      // no explicit schoolYear; should fallback gracefully to '2025-2026'
    },
  ];

  const mockColleges: College[] = [
    { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' },
  ];

  const mockDepartments: Department[] = [
    { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS' },
  ];

  return {
    mockSchoolYears,
    mockUsers,
    mockColleges,
    mockDepartments,
    deleteUser: vi.fn(),
    showAlert: vi.fn(),
    setIsRoleModalOpen: vi.fn(),
    logout: vi.fn(),
    mockState: {
      activeRole: 'admin',
      activeUser: mockUsers[0],
      pendingRegistrations: [],
      colleges: [...mockColleges],
      departments: [...mockDepartments],
      schoolYears: [...mockSchoolYears],
      db: {
        users: [...mockUsers],
        courses: [],
      },
    },
  };
});

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.mockState.activeRole,
    activeUser: mocks.mockState.activeUser,
    pendingRegistrations: mocks.mockState.pendingRegistrations,
    colleges: mocks.mockState.colleges,
    departments: mocks.mockState.departments,
    schoolYears: mocks.mockState.schoolYears,
    db: mocks.mockState.db,
    deleteUser: mocks.deleteUser,
    showAlert: mocks.showAlert,
    setIsRoleModalOpen: mocks.setIsRoleModalOpen,
    logout: mocks.logout,
    verifyRegistration: vi.fn(),
    rejectRegistration: vi.fn(),
  }),
}));

describe('ManageAccountsPage - School Year Tagging & Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockState.activeRole = 'admin';
    mocks.mockState.activeUser = mocks.mockUsers[0];
    mocks.mockState.colleges = [...mocks.mockColleges];
    mocks.mockState.departments = [...mocks.mockDepartments];
    mocks.mockState.schoolYears = [...mocks.mockSchoolYears];
    mocks.mockState.db = {
      users: [...mocks.mockUsers],
      courses: [],
    };
  });

  it('renders a school year dropdown filter alongside program filter with "All School Years"', () => {
    render(<MemoryRouter><ManageAccountsPage /></MemoryRouter>);

    // School Year dropdown button with placeholder / initial label
    const syDropdownBtn = screen.getByRole('button', { name: /all school years/i });
    expect(syDropdownBtn).toBeInTheDocument();
  });

  it('filters directory accounts when a specific school year is selected', () => {
    render(<MemoryRouter><ManageAccountsPage /></MemoryRouter>);

    // Initially all users appear (Ada 2024, Grace 2025, Linus Legacy, Dr. Alan Admin)
    expect(screen.getByText('Ada 2024')).toBeInTheDocument();
    expect(screen.getByText('Grace 2025')).toBeInTheDocument();
    expect(screen.getByText('Linus Legacy')).toBeInTheDocument();

    // Open School Year dropdown
    const syDropdownBtn = screen.getByRole('button', { name: /all school years/i });
    fireEvent.click(syDropdownBtn);

    // Click 2024-2025 option
    const option2425 = within(screen.getByRole('listbox')).getByRole('option', { name: /2024-2025/i });
    fireEvent.click(option2425);

    // Only Ada 2024 should be visible
    expect(screen.getByText('Ada 2024')).toBeInTheDocument();
    expect(screen.queryByText('Grace 2025')).not.toBeInTheDocument();
    expect(screen.queryByText('Linus Legacy')).not.toBeInTheDocument();
  });

  it('gracefully matches users without explicit schoolYear to "2025-2026"', () => {
    render(<MemoryRouter><ManageAccountsPage /></MemoryRouter>);

    // Open School Year dropdown
    const syDropdownBtn = screen.getByRole('button', { name: /all school years/i });
    fireEvent.click(syDropdownBtn);

    // Click 2025-2026 option
    const option2526 = within(screen.getByRole('listbox')).getByRole('option', { name: /2025-2026/i });
    fireEvent.click(option2526);

    // Both Grace 2025 and Linus Legacy (fallback 2025-2026) and Dr. Alan Admin should match
    expect(screen.getByText('Grace 2025')).toBeInTheDocument();
    expect(screen.getByText('Linus Legacy')).toBeInTheDocument();
    expect(screen.queryByText('Ada 2024')).not.toBeInTheDocument();
  });

  it('displays a school year badge in each user directory row', () => {
    render(<MemoryRouter><ManageAccountsPage /></MemoryRouter>);

    // Check school year badge text in directory
    expect(screen.getByText('AY 2024-2025')).toBeInTheDocument();
    const badges2526 = screen.getAllByText('AY 2025-2026');
    expect(badges2526.length).toBeGreaterThanOrEqual(1);
  });
});
