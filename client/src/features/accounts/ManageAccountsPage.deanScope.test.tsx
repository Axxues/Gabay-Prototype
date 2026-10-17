// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ManageAccountsPage } from './ManageAccountsPage';
import type { User, College, Department, PendingRegistration } from '../../shared/types/lms';

const mocks = vi.hoisted(() => {
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
    {
      id: 'u-stud-cs',
      name: 'Grace Hopper',
      email: 'grace.hopper@dmmmsu.edu.ph',
      role: 'student',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      studentId: '2026-0001',
      title: 'Student',
      avatar: '',
    },
    {
      id: 'u-staff-cs',
      name: 'Linus Registrar',
      email: 'linus.registrar@dmmmsu.edu.ph',
      role: 'staff',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Office of the College Registrar',
      title: 'Registrar Staff',
      avatar: '',
    },
    {
      id: 'u-fac-coe',
      name: 'Prof. John Dewey',
      email: 'john.dewey@dmmmsu.edu.ph',
      role: 'faculty',
      collegeId: 'col-coe',
      collegeName: 'College of Education',
      department: 'Department of Elementary Education',
      title: 'Professor',
      avatar: '',
    },
    {
      id: 'u-stud-coe',
      name: 'Maria Montessori',
      email: 'maria.montessori@dmmmsu.edu.ph',
      role: 'student',
      collegeId: 'col-coe',
      collegeName: 'College of Education',
      department: 'Department of Elementary Education',
      studentId: '2026-9999',
      title: 'Student',
      avatar: '',
    },
  ];

  const mockColleges: College[] = [
    { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'u-dean' },
    { id: 'col-coe', name: 'College of Education', code: 'COED', deanId: 'u-dean-coe' },
  ];

  const mockDepartments: Department[] = [
    { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS', chairpersonId: 'u-chair-cs' },
    { id: 'dept-it', collegeId: 'col-ccs', name: 'Department of Information Technology', code: 'IT', chairpersonId: 'u-chair-it' },
    { id: 'dept-elem', collegeId: 'col-coe', name: 'Department of Elementary Education', code: 'ELED', chairpersonId: 'u-chair-elem' },
  ];

  return {
    mockUsers,
    mockColleges,
    mockDepartments,
    verifyRegistration: vi.fn(),
    rejectRegistration: vi.fn(),
    transferLeadership: vi.fn(),
    addCollege: vi.fn(),
    addDepartment: vi.fn(),
    deleteUser: vi.fn(),
    showAlert: vi.fn(),
    setIsRoleModalOpen: vi.fn(),
    logout: vi.fn(),
    mockState: {
      activeRole: 'admin',
      activeUser: mockUsers[0],
      pendingRegistrations: [] as PendingRegistration[],
      colleges: [...mockColleges],
      departments: [...mockDepartments],
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
    db: mocks.mockState.db,
    verifyRegistration: mocks.verifyRegistration,
    rejectRegistration: mocks.rejectRegistration,
    transferLeadership: mocks.transferLeadership,
    addCollege: mocks.addCollege,
    addDepartment: mocks.addDepartment,
    deleteUser: mocks.deleteUser,
    showAlert: mocks.showAlert,
    setIsRoleModalOpen: mocks.setIsRoleModalOpen,
    logout: mocks.logout,
  }),
}));

describe('ManageAccountsPage - Dean Access & Full Collegiate Scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockState.activeRole = 'admin';
    mocks.mockState.activeUser = mocks.mockUsers[0];
    mocks.mockState.colleges = [...mocks.mockColleges];
    mocks.mockState.departments = [...mocks.mockDepartments];
    mocks.mockState.db = {
      users: [...mocks.mockUsers],
      courses: [],
    };
    mocks.mockState.pendingRegistrations = [];
  });

  describe('When viewing as Dean (CCS)', () => {
    it('allows access to "Academic Structure" tab and renders the scoped console', () => {
      render(<ManageAccountsPage />);

      // The Academic Structure tab button must be visible for Dean
      const academicStructureTab = screen.getByRole('tab', { name: /academic structure/i });
      expect(academicStructureTab).toBeInTheDocument();
      expect(academicStructureTab).toHaveTextContent('CCS');

      // Clicking it switches to the Academic Structure console
      fireEvent.click(academicStructureTab);
      expect(screen.getByText(/Academic Structure & Multi-College Governance/i)).toBeInTheDocument();
      expect(screen.getByText(/Dean collegiate console/i)).toBeInTheDocument();
    });

    it('scopes Active Directory users strictly to the Dean college', () => {
      render(<ManageAccountsPage />);

      // Users belonging to col-ccs must be visible
      expect(screen.getByText('Dr. Alan Dean')).toBeInTheDocument();
      expect(screen.getByText('Prof. Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
      expect(screen.getByText('Linus Registrar')).toBeInTheDocument();

      // Users belonging to col-coe must NOT be in the document
      expect(screen.queryByText('Prof. John Dewey')).not.toBeInTheDocument();
      expect(screen.queryByText('Maria Montessori')).not.toBeInTheDocument();
    });

    it('scopes summary metric cards to the Dean college counts', () => {
      render(<ManageAccountsPage />);

      // In CCS: 4 total accounts (1 admin, 1 faculty, 1 student, 1 staff)
      const totalCard = screen.getByText('Total Accounts').closest('div')?.parentElement;
      expect(totalCard).toHaveTextContent('4');

      const facultyCard = screen.getByText('Faculty Instructors').closest('div')?.parentElement;
      expect(facultyCard).toHaveTextContent('1');

      const studentCard = screen.getByText('Enrolled Students').closest('div')?.parentElement;
      expect(studentCard).toHaveTextContent('1');

      const adminCard = screen.getByText('College Administrators').closest('div')?.parentElement;
      expect(adminCard).toHaveTextContent('1');

      const staffCard = screen.getByText('Non-Teaching Staff').closest('div')?.parentElement;
      expect(staffCard).toHaveTextContent('1');
    });

    it('scopes department filter dropdown options to departments in the Dean college', () => {
      render(<ManageAccountsPage />);

      // Open department dropdown
      const dropdownButton = screen.getByRole('button', { name: /all departments/i });
      fireEvent.click(dropdownButton);

      // CCS departments must be present
      expect(screen.getByRole('button', { name: /Department of Computer Science/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Department of Information Technology/i })).toBeInTheDocument();

      // COED departments must NOT be in the dropdown
      expect(screen.queryByRole('button', { name: /Department of Elementary Education/i })).not.toBeInTheDocument();
    });

    it('scopes departments and resolves badge even when activeUser.collegeId is empty but collegeName matches', () => {
      // Clear activeUser.collegeId, rely on deanCollegeName matching
      mocks.mockState.activeUser = {
        ...mocks.mockUsers[0],
        collegeId: undefined,
        collegeName: 'College of Computer Science',
      };

      render(<ManageAccountsPage />);

      // Tab badge shows 'CCS' resolved via effectiveDeanCollegeId fallback
      const academicStructureTab = screen.getByRole('tab', { name: /academic structure/i });
      expect(academicStructureTab).toBeInTheDocument();
      expect(academicStructureTab).toHaveTextContent('CCS');

      // Open department dropdown
      const dropdownButton = screen.getByRole('button', { name: /all departments/i });
      fireEvent.click(dropdownButton);

      // CCS departments are scoped
      expect(screen.getByRole('button', { name: /Department of Computer Science/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Department of Information Technology/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Department of Elementary Education/i })).not.toBeInTheDocument();
    });

    it('scopes departments even when activeUser.collegeId and collegeName are undefined but college.deanId matches', () => {
      // Clear activeUser.collegeId and collegeName, rely solely on college.deanId === activeUser.id ('u-dean')
      mocks.mockState.activeUser = {
        ...mocks.mockUsers[0],
        collegeId: undefined,
        collegeName: undefined,
      };

      render(<ManageAccountsPage />);

      // Tab badge shows 'CCS' resolved via c.deanId === activeUser.id
      const academicStructureTab = screen.getByRole('tab', { name: /academic structure/i });
      expect(academicStructureTab).toBeInTheDocument();
      expect(academicStructureTab).toHaveTextContent('CCS');

      // Open department dropdown
      const dropdownButton = screen.getByRole('button', { name: /all departments/i });
      fireEvent.click(dropdownButton);

      // CCS departments are scoped
      expect(screen.getByRole('button', { name: /Department of Computer Science/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Department of Information Technology/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Department of Elementary Education/i })).not.toBeInTheDocument();
    });
  });

  describe('When viewing as Chancellor (superadmin)', () => {
    beforeEach(() => {
      mocks.mockState.activeRole = 'superadmin';
      mocks.mockState.activeUser = {
        id: 'u-chancellor',
        name: 'Chancellor University',
        email: 'chancellor@dmmmsu.edu.ph',
        role: 'superadmin',
        adminSubrole: 'chancellor',
        department: 'Office of the Chancellor',
        title: 'University Chancellor',
        avatar: '',
      };
    });

    it('displays users from all colleges in Active Directory', () => {
      render(<ManageAccountsPage />);

      expect(screen.getByText('Prof. Ada Lovelace')).toBeInTheDocument();
      expect(screen.getByText('Prof. John Dewey')).toBeInTheDocument();
      expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
      expect(screen.getByText('Maria Montessori')).toBeInTheDocument();
    });

    it('reflects university-wide counts in summary metric cards', () => {
      render(<ManageAccountsPage />);

      // University-wide: 6 total accounts, 2 faculty, 2 students, 1 admin (Dean), 1 staff
      const totalCard = screen.getByText('Total Accounts').closest('div')?.parentElement;
      expect(totalCard).toHaveTextContent('6');

      const facultyCard = screen.getByText('Faculty Instructors').closest('div')?.parentElement;
      expect(facultyCard).toHaveTextContent('2');

      const studentCard = screen.getByText('Enrolled Students').closest('div')?.parentElement;
      expect(studentCard).toHaveTextContent('2');
    });

    it('includes departments from all colleges in department filter', () => {
      render(<ManageAccountsPage />);

      const dropdownButton = screen.getByRole('button', { name: /all departments/i });
      fireEvent.click(dropdownButton);

      expect(screen.getByRole('button', { name: /Department of Computer Science/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Department of Information Technology/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Department of Elementary Education/i })).toBeInTheDocument();
    });
  });
});
