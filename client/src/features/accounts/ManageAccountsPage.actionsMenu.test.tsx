// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { ManageAccountsPage } from './ManageAccountsPage';
import type { User, College, Department } from '../../shared/types/lms';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockDeleteUser = vi.fn();
const mockShowAlert = vi.fn();

const activeAdmin: User = {
  id: 'admin-1',
  name: 'Dr. Dean',
  email: 'dean@dmmmsu.edu.ph',
  role: 'admin',
  adminSubrole: 'dean',
  collegeId: 'col-ccs',
  collegeName: 'College of Computer Science',
  department: 'College of Computer Science',
  title: 'College Dean',
  avatar: '',
  birthday: '1980-05-15',
  contactNumber: '+63 912 345 6789',
  address: 'San Fernando, La Union',
};

const sampleStudent: User = {
  id: 'student-1',
  name: 'Maria Santos',
  email: 'maria@dmmmsu.edu.ph',
  role: 'student',
  collegeId: 'col-ccs',
  collegeName: 'College of Computer Science',
  department: 'Department of Computer Science',
  studentId: '2026-1001',
  yearLevel: 2,
  schoolYear: '2025-2026',
  birthday: '2004-03-21',
  contactNumber: '+63 999 111 2233',
  address: 'Agoo, La Union',
  permanentAddressNormalized: {
    province: 'La Union',
    municipalityCity: 'Agoo',
    barangay: 'San Nicolas',
    houseStreet: '123 Rizal St',
  },
  presentAddressNormalized: {
    province: 'La Union',
    municipalityCity: 'Agoo',
    barangay: 'San Nicolas',
    houseStreet: '123 Rizal St',
  },
  sameAsPermanentAddress: true,
  motherName: {
    firstName: 'Elena',
    middleName: 'Cruz',
    lastName: 'Santos',
  },
  fatherName: {
    firstName: 'Roberto',
    middleName: 'Gomez',
    lastName: 'Santos',
  },
  parentContactNumber: '+63 917 888 9900',
};

const sampleFaculty: User = {
  id: 'faculty-1',
  name: 'Prof. Alice Rivera',
  email: 'alice@dmmmsu.edu.ph',
  role: 'faculty',
  collegeId: 'col-ccs',
  collegeName: 'College of Computer Science',
  department: 'Department of Computer Science',
  title: 'Associate Professor',
  birthday: '1985-09-10',
  contactNumber: '+63 920 555 4321',
  address: 'Bauang, La Union',
  yearsOfTeaching: 8,
  educationalBackground: [
    {
      id: 'deg-1',
      degreeLevel: 'masters',
      school: 'University of the Philippines',
      yearGraduated: '2015',
      specialization: 'Computer Science',
    },
  ],
};

const mockColleges: College[] = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'admin-1' },
];

const mockDepartments: Department[] = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS' },
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: 'admin',
    activeUser: activeAdmin,
    pendingRegistrations: [],
    colleges: mockColleges,
    departments: mockDepartments,
    db: {
      users: [activeAdmin, sampleStudent, sampleFaculty],
      courses: [],
    },
    deleteUser: mockDeleteUser,
    showAlert: mockShowAlert,
    verifyRegistration: vi.fn(),
    rejectRegistration: vi.fn(),
    transferLeadership: vi.fn(),
    addCollege: vi.fn(),
    addDepartment: vi.fn(),
    setIsRoleModalOpen: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('ManageAccountsPage Actions Column (3-Dot Menu & View Profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a 3-dot action button for each user row with proper accessible label', () => {
    render(<ManageAccountsPage />);

    expect(screen.getByRole('button', { name: `Actions for ${activeAdmin.name}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Actions for ${sampleStudent.name}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Actions for ${sampleFaculty.name}` })).toBeInTheDocument();
  });

  it('opens dropdown menu showing View, Edit, and Delete options when 3-dot is clicked', () => {
    render(<ManageAccountsPage />);

    const actionButton = screen.getByRole('button', { name: `Actions for ${sampleStudent.name}` });
    fireEvent.click(actionButton);

    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();

    expect(within(menu).getByRole('menuitem', { name: /^view$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /^edit$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('closes dropdown menu when Escape key is pressed or click outside occurs', () => {
    render(<ManageAccountsPage />);

    const actionButton = screen.getByRole('button', { name: `Actions for ${sampleStudent.name}` });
    fireEvent.click(actionButton);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Escape closes menu
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Open again and click outside
    fireEvent.click(actionButton);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens User Profile Details dialog when View is clicked for a student and shows student profile fields', () => {
    render(<ManageAccountsPage />);

    const actionButton = screen.getByRole('button', { name: `Actions for ${sampleStudent.name}` });
    fireEvent.click(actionButton);

    const viewOption = screen.getByRole('menuitem', { name: /^view$/i });
    fireEvent.click(viewOption);

    // Profile Modal should appear
    expect(screen.getByText('User Profile Details')).toBeInTheDocument();
    expect(screen.getByText('Institutional identity, academic credentials, and contact details.')).toBeInTheDocument();

    // Check student details in modal
    expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('maria@dmmmsu.edu.ph').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-1001').length).toBeGreaterThan(0);
    expect(screen.getByText('Year 2')).toBeInTheDocument();
    expect(screen.getByText('+63 999 111 2233')).toBeInTheDocument();
    expect(screen.getByText('Elena Cruz Santos')).toBeInTheDocument();
    expect(screen.getByText('Roberto Gomez Santos')).toBeInTheDocument();
    expect(screen.getByText('+63 917 888 9900')).toBeInTheDocument();

    // Close button dismisses modal
    const closeBtn = screen.getByRole('button', { name: /^close$/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('User Profile Details')).not.toBeInTheDocument();
  });

  it('opens User Profile Details dialog when View is clicked for a faculty and shows educational background', () => {
    render(<ManageAccountsPage />);

    const actionButton = screen.getByRole('button', { name: `Actions for ${sampleFaculty.name}` });
    fireEvent.click(actionButton);

    const viewOption = screen.getByRole('menuitem', { name: /^view$/i });
    fireEvent.click(viewOption);

    expect(screen.getByText('User Profile Details')).toBeInTheDocument();
    expect(screen.getAllByText('Prof. Alice Rivera').length).toBeGreaterThan(0);
    expect(screen.getByText('8 Years')).toBeInTheDocument();
    expect(screen.getByText("Master's Degree")).toBeInTheDocument();
    expect(screen.getByText('University of the Philippines')).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
  });

  it('calls onEditAccount or navigates when Edit is selected', () => {
    const mockOnEdit = vi.fn();
    render(<ManageAccountsPage onEditAccount={mockOnEdit} />);

    const actionButton = screen.getByRole('button', { name: `Actions for ${sampleStudent.name}` });
    fireEvent.click(actionButton);

    const editOption = screen.getByRole('menuitem', { name: /^edit$/i });
    fireEvent.click(editOption);

    expect(mockOnEdit).toHaveBeenCalledWith(sampleStudent);
  });

  it('disables Delete option for the currently active session user', () => {
    render(<ManageAccountsPage />);

    const actionButton = screen.getByRole('button', { name: `Actions for ${activeAdmin.name}` });
    fireEvent.click(actionButton);

    const deleteOption = screen.getByRole('menuitem', { name: /^delete$/i });
    expect(deleteOption).toBeDisabled();
  });

  it('allows opening delete confirmation modal for another user and executing delete', async () => {
    mockDeleteUser.mockResolvedValueOnce({ success: true, message: 'Account deleted' });
    render(<ManageAccountsPage />);

    const actionButton = screen.getByRole('button', { name: `Actions for ${sampleStudent.name}` });
    fireEvent.click(actionButton);

    const deleteOption = screen.getByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteOption);

    // Delete confirmation modal should open
    expect(screen.getByText('Delete User Account?')).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete Account' });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockDeleteUser).toHaveBeenCalledWith(sampleStudent.id);
    });
  });
});
