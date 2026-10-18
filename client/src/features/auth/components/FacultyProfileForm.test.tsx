// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { FacultyProfileForm } from './FacultyProfileForm';
import type { User } from '../../../shared/types/lms';

describe('FacultyProfileForm Component', () => {
  const mockUpdateUser = vi.fn();
  const mockShowAlert = vi.fn();

  const baseFaculty: User = {
    id: 'faculty-123',
    name: 'Dr. Maria Santos',
    email: 'msantos@osdmmmsu.edu.ph',
    role: 'faculty',
    studentId: 'FAC-2024-001',
    department: 'Department of Computer Science',
    title: 'Associate Professor',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    birthday: '1985-04-12',
    contactNumber: '09123456789',
    address: '123 Academic Blvd, San Fernando, La Union',
    yearsOfTeaching: 8,
    educationalBackground: [
      {
        id: 'deg-1',
        degreeLevel: 'bachelors',
        school: 'Don Mariano Marcos Memorial State University',
        yearGraduated: 2006,
        specialization: 'BS in Computer Science',
      },
      {
        id: 'deg-2',
        degreeLevel: 'masters',
        school: 'University of the Philippines Diliman',
        yearGraduated: 2011,
        specialization: 'Master of Science in Computer Science',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue(true);
  });

  it('renders faculty profile fields with initial values', () => {
    render(
      <FacultyProfileForm
        user={baseFaculty}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    expect(screen.getByLabelText(/birthday/i)).toHaveValue('1985-04-12');
    expect(screen.getByLabelText(/contact number/i)).toHaveValue('09123456789');
    expect(screen.getByLabelText(/^address/i)).toHaveValue('123 Academic Blvd, San Fernando, La Union');
    expect(screen.getByLabelText(/years of teaching experience/i)).toHaveValue(8);
    expect(screen.getByText(/auto-increments/i)).toBeInTheDocument();

    // Verify existing degrees rendered
    expect(screen.getByDisplayValue('Don Mariano Marcos Memorial State University')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BS in Computer Science')).toBeInTheDocument();
    expect(screen.getByDisplayValue('University of the Philippines Diliman')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Master of Science in Computer Science')).toBeInTheDocument();
  });

  it('can add a new degree with degree level, school, year, and specialization', async () => {
    render(
      <FacultyProfileForm
        user={baseFaculty}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    const addBtn = screen.getByRole('button', { name: /add degree/i });
    fireEvent.click(addBtn);

    // Now there should be 3 degrees
    const degreeSelects = screen.getAllByLabelText(/degree level/i);
    expect(degreeSelects).toHaveLength(3);

    const newSelect = degreeSelects[2];
    fireEvent.change(newSelect, { target: { value: 'doctorate' } });

    const schoolInputs = screen.getAllByLabelText(/school \/ institution/i);
    fireEvent.change(schoolInputs[2], { target: { value: 'Ateneo de Manila University' } });

    const yearInputs = screen.getAllByLabelText(/year graduated/i);
    fireEvent.change(yearInputs[2], { target: { value: '2018' } });

    const specInputs = screen.getAllByLabelText(/field of specialization/i);
    fireEvent.change(specInputs[2], { target: { value: 'Ph.D. in Computer Science' } });

    expect(newSelect).toHaveValue('doctorate');
    expect(schoolInputs[2]).toHaveValue('Ateneo de Manila University');
    expect(yearInputs[2]).toHaveValue('2018');
    expect(specInputs[2]).toHaveValue('Ph.D. in Computer Science');
  });

  it('can remove an educational degree', () => {
    render(
      <FacultyProfileForm
        user={baseFaculty}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: /remove degree/i });
    expect(removeButtons).toHaveLength(2);

    // Remove first degree
    fireEvent.click(removeButtons[0]);

    // Should now only have 1 degree
    const remainingSchools = screen.getAllByLabelText(/school \/ institution/i);
    expect(remainingSchools).toHaveLength(1);
    expect(screen.queryByDisplayValue('Don Mariano Marcos Memorial State University')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('University of the Philippines Diliman')).toBeInTheDocument();
  });

  it('submits form and calls updateUser with updated fields', async () => {
    render(
      <FacultyProfileForm
        user={baseFaculty}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    // Modify contact number and years of teaching
    const contactInput = screen.getByLabelText(/contact number/i);
    fireEvent.change(contactInput, { target: { value: '09991112233' } });

    const expInput = screen.getByLabelText(/years of teaching experience/i);
    fireEvent.change(expInput, { target: { value: '10' } });

    const submitBtn = screen.getByRole('button', { name: /save faculty profile|save profile/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('faculty-123', expect.objectContaining({
        birthday: '1985-04-12',
        contactNumber: '09991112233',
        address: '123 Academic Blvd, San Fernando, La Union',
        yearsOfTeaching: 10,
        educationalBackground: expect.arrayContaining([
          expect.objectContaining({
            degreeLevel: 'bachelors',
            school: 'Don Mariano Marcos Memorial State University',
          }),
        ]),
      }));
    });

    expect(mockShowAlert).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: expect.stringMatching(/profile updated/i),
    }));
  });

  it('restricts birthday input to previous dates and blocks future birthday submission', async () => {
    render(
      <FacultyProfileForm
        user={baseFaculty}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    const birthdayInput = screen.getByLabelText(/birthday/i);
    expect(birthdayInput).toHaveAttribute('max');

    // Attempt to set future birthday
    fireEvent.change(birthdayInput, { target: { value: '2027-02-27' } });

    const submitBtn = screen.getByRole('button', { name: /save faculty profile|save profile/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Birthday must be from a previous date and cannot be in the future/i)).toBeInTheDocument();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

