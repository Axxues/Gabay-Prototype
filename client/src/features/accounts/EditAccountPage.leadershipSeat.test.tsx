// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EditAccountPage } from './EditAccountPage';
import type { User } from '../../shared/types/lms';

const mockUpdateUser = vi.fn().mockResolvedValue(true);
const mockShowAlert = vi.fn();
const mockNavigateTab = vi.fn();

const mockColleges = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'dean-user-1' }
];

const mockDepartments = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Computer Science', code: 'BSCS', chairpersonId: 'chair-user-1' }
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    updateUser: mockUpdateUser,
    showAlert: mockShowAlert,
    colleges: mockColleges,
    departments: mockDepartments,
    programs: [
      { id: 'prog-cs', collegeId: 'col-ccs', name: 'Computer Science', code: 'BSCS' }
    ]
  })
}));

describe('EditAccountPage - Institutional Leadership Seat Safeguards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const activeDeanUser: User = {
    id: 'dean-user-1',
    name: 'Dr. Jane Smith',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'dean.ccs@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    studentId: '100-2000-1',
    department: 'College of Computer Science',
    title: 'College Dean'
  };

  const activeChairUser: User = {
    id: 'chair-user-1',
    name: 'Prof. Alan Turing',
    firstName: 'Alan',
    lastName: 'Turing',
    email: 'chair.cs@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'chairperson',
    studentId: '100-2000-2',
    department: 'Computer Science',
    title: 'Program Chairperson'
  };

  it('renders institutional office seat warning banner and disables role downgrading for Dean', () => {
    render(<EditAccountPage user={activeDeanUser} onNavigateTab={mockNavigateTab} />);

    expect(screen.getByText(/Institutional Leadership Office Seat/i)).toBeInTheDocument();
    expect(screen.getByText(/under university policy, leadership accounts never step down to faculty or student/i)).toBeInTheDocument();

    const roleDropdown = screen.getByRole('button', { name: /Administrator/i });
    expect(roleDropdown).toBeDisabled();
  });

  it('renders warning banner and disables role downgrading for Chairperson', () => {
    render(<EditAccountPage user={activeChairUser} onNavigateTab={mockNavigateTab} />);

    expect(screen.getByText(/Institutional Leadership Office Seat/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Program Chairperson/i).length).toBeGreaterThanOrEqual(1);

    const roleDropdown = screen.getByRole('button', { name: /Administrator/i });
    expect(roleDropdown).toBeDisabled();
  });

  it('submitting updates preserves role admin and adminSubrole', async () => {
    render(<EditAccountPage user={activeDeanUser} onNavigateTab={mockNavigateTab} />);

    const submitBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(
        'dean-user-1',
        expect.objectContaining({
          role: 'admin',
          adminSubrole: 'dean',
        })
      );
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Account Updated'
        })
      );
      expect(mockNavigateTab).toHaveBeenCalledWith('accounts');
    });
  });
});
