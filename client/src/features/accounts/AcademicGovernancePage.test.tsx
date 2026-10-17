// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AcademicGovernancePage } from './AcademicGovernancePage';
import type { User, College, Department } from '../../shared/types/lms';

const mockUsers: User[] = [
  {
    id: 'u-dean',
    name: 'Dr. Alan Dean',
    email: 'dean.ccs@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'College of Computer Science',
    title: 'College Dean',
    avatar: '',
  },
  {
    id: 'u-fac-cs',
    name: 'Prof. Ada Lovelace',
    email: 'ada.lovelace@dmmmsu.edu.ph',
    role: 'faculty',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'Department of Computer Science',
    title: 'Professor',
    avatar: '',
  },
];

const mockColleges: College[] = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'u-dean' },
  { id: 'col-coe', name: 'College of Education', code: 'COED', deanId: 'u-dean-coe' },
];

const mockDepartments: Department[] = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS', chairpersonId: 'u-chair-cs' },
  { id: 'dept-elem', collegeId: 'col-coe', name: 'Department of Elementary Education', code: 'ELED', chairpersonId: 'u-chair-elem' },
];

const mockContextState = {
  activeRole: 'admin',
  activeUser: mockUsers[0],
  colleges: [...mockColleges],
  departments: [...mockDepartments],
  db: {
    users: [...mockUsers],
    courses: [],
  },
  setIsRoleModalOpen: vi.fn(),
  addCollege: vi.fn(),
  addDepartment: vi.fn(),
  transferLeadership: vi.fn().mockResolvedValue({ success: true, message: 'Transferred' }),
  showAlert: vi.fn(),
};

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mockContextState.activeRole,
    activeUser: mockContextState.activeUser,
    colleges: mockContextState.colleges,
    departments: mockContextState.departments,
    db: mockContextState.db,
    setIsRoleModalOpen: mockContextState.setIsRoleModalOpen,
    addCollege: mockContextState.addCollege,
    addDepartment: mockDepartmentAdd,
    transferLeadership: mockContextState.transferLeadership,
    showAlert: mockContextState.showAlert,
  }),
}));

const mockDepartmentAdd = vi.fn();

describe('AcademicGovernancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextState.activeRole = 'admin';
    mockContextState.activeUser = mockUsers[0];
    mockContextState.colleges = [...mockColleges];
    mockContextState.departments = [...mockDepartments];
    mockContextState.db = {
      users: [...mockUsers],
      courses: [],
    };
  });

  it('renders page header and Academic Structure tab', () => {
    render(<AcademicGovernancePage />);

    expect(screen.getByRole('heading', { name: 'Academic Governance' })).toBeInTheDocument();
    expect(screen.getByText(/Govern collegiate academic structures, departments, and institutional leadership appointments/i)).toBeInTheDocument();
    expect(screen.getByText(/Academic Structure & Multi-College Governance/i)).toBeInTheDocument();
  });

  it('renders Transfer Leadership action button and opens modal when clicked', () => {
    render(<AcademicGovernancePage />);

    const transferBtn = screen.getByRole('button', { name: /transfer leadership/i });
    expect(transferBtn).toBeInTheDocument();

    fireEvent.click(transferBtn);
    expect(screen.getByText('Leadership Authority Transfer')).toBeInTheDocument();
  });

  it('scopes colleges when viewed by a Dean', () => {
    render(<AcademicGovernancePage />);

    // Dean sees CCS
    expect(screen.getByText('College of Computer Science')).toBeInTheDocument();
    // Dean does not see COED
    expect(screen.queryByText('College of Education')).not.toBeInTheDocument();
  });

  it('shows all colleges when viewed by Chancellor (superadmin)', () => {
    mockContextState.activeRole = 'superadmin';
    mockContextState.activeUser = {
      id: 'u-chancellor',
      name: 'Chancellor University',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
      department: 'Office of the Chancellor',
      title: 'University Chancellor',
      avatar: '',
    };

    render(<AcademicGovernancePage />);

    expect(screen.getByText('College of Computer Science')).toBeInTheDocument();
    expect(screen.getByText('College of Education')).toBeInTheDocument();
  });

  it('shows administrative preview warning when viewing as non-admin', () => {
    mockContextState.activeRole = 'faculty';

    render(<AcademicGovernancePage />);

    expect(screen.getByText(/Administrative console preview:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to admin/i })).toBeInTheDocument();
  });
});
