// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EditAccountPage } from './EditAccountPage';
import type { User } from '../../shared/types/lms';

const mockUpdateUser = vi.fn();
const mockShowAlert = vi.fn();
const mockNavigateTab = vi.fn();

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    updateUser: mockUpdateUser,
    showAlert: mockShowAlert,
    programs: [
      { id: 'prog-cs', collegeId: 'col-ccs', name: 'Computer Science', code: 'BSCS' },
      { id: 'prog-it', collegeId: 'col-ccs', name: 'Information Technology', code: 'BSIT' }
    ],
    departments: [
      { id: 'dept-cs', collegeId: 'col-ccs', name: 'Computer Science', code: 'BSCS' }
    ]
  })
}));

describe('EditAccountPage - Student Year Level Management', () => {
  const baseStudentUser: User = {
    id: 'student-123',
    name: 'Juan Dela Cruz',
    email: 'jdelacruz@dmmmsu.edu.ph',
    role: 'student',
    studentId: '123-4567-1',
    department: 'Computer Science',
    program: 'Computer Science',
    title: 'Student',
    avatar: '',
    yearLevel: 2
  };

  const baseFacultyUser: User = {
    id: 'faculty-456',
    name: 'Prof. Maria Santos',
    email: 'msantos@dmmmsu.edu.ph',
    role: 'faculty',
    studentId: '234-5678-9',
    department: 'Computer Science',
    program: 'Computer Science',
    title: 'Assistant Professor',
    avatar: ''
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue(true);
  });

  it('renders the Year Level field when editing a student account', () => {
    render(<EditAccountPage user={baseStudentUser} onNavigateTab={mockNavigateTab} />);

    expect(screen.getByLabelText(/year level/i)).toBeInTheDocument();
  });

  it('initializes Year Level from user.yearLevel (or default 1 if undefined)', () => {
    const { unmount } = render(
      <EditAccountPage user={baseStudentUser} onNavigateTab={mockNavigateTab} />
    );

    const select = screen.getByLabelText(/year level/i) as HTMLSelectElement;
    expect(select.value).toBe('2');

    unmount();

    const studentWithoutYear: User = {
      ...baseStudentUser,
      id: 'student-no-year',
      yearLevel: undefined
    };

    render(<EditAccountPage user={studentWithoutYear} onNavigateTab={mockNavigateTab} />);
    const selectDefault = screen.getByLabelText(/year level/i) as HTMLSelectElement;
    expect(selectDefault.value).toBe('1');
  });

  it('does not display Year Level selector when role is faculty, staff, or admin', () => {
    render(<EditAccountPage user={baseFacultyUser} onNavigateTab={mockNavigateTab} />);

    expect(screen.queryByLabelText(/year level/i)).not.toBeInTheDocument();
  });

  it('allows changing the Year Level and passes updated yearLevel to updateUser on save', async () => {
    render(<EditAccountPage user={baseStudentUser} onNavigateTab={mockNavigateTab} />);

    const select = screen.getByLabelText(/year level/i);
    fireEvent.change(select, { target: { value: '3' } });

    const submitBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdateUser).toHaveBeenCalledWith(
      'student-123',
      expect.objectContaining({
        yearLevel: 3
      })
    );
  });

  it('renders First Name, Middle Name, and Last Name and submits updated name to updateUser', async () => {
    const deanAccount: User = {
      id: 'dean-1',
      name: 'Old Dean Name',
      email: 'dean@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      studentId: '100-2000-1',
      department: 'College of Computer Science',
      program: 'College of Computer Science',
      title: 'Dean',
      avatar: '',
    };

    render(<EditAccountPage user={deanAccount} onNavigateTab={mockNavigateTab} />);

    const firstNameInput = screen.getByLabelText(/first name/i);
    const middleNameInput = screen.getByLabelText(/middle name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);

    fireEvent.change(firstNameInput, { target: { value: 'Alexander' } });
    fireEvent.change(middleNameInput, { target: { value: 'Bautista' } });
    fireEvent.change(lastNameInput, { target: { value: 'Cruz' } });

    const submitBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    });

    expect(mockUpdateUser).toHaveBeenCalledWith(
      'dean-1',
      expect.objectContaining({
        firstName: 'Alexander',
        middleName: 'Bautista',
        lastName: 'Cruz',
        name: 'Alexander Bautista Cruz',
      })
    );
  });
});
