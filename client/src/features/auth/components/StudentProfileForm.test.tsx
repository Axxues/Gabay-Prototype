// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StudentProfileForm } from './StudentProfileForm';
import type { User } from '../../../shared/types/lms';

describe('StudentProfileForm Component', () => {
  const mockUpdateUser = vi.fn();
  const mockShowAlert = vi.fn();

  const baseStudent: User = {
    id: 'student-123',
    name: 'Juan Dela Cruz',
    email: 'jdelacruz@osdmmmsu.edu.ph',
    role: 'student',
    studentId: '2024-00001-CS-0',
    department: 'Department of Computer Science',
    title: 'Student',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    yearLevel: 2,
    birthday: '2004-05-15',
    contactNumber: '09123456789',
    permanentAddress: '123 Rizal Street, Catbangen, San Fernando, La Union',
    presentAddress: '456 Mabini Street, Ilocanos Sur, San Fernando, La Union',
    permanentAddressDetails: {
      houseStreet: '123 Rizal Street',
      barangay: 'Catbangen',
      municipalityCity: 'San Fernando',
      province: 'La Union',
    },
    presentAddressDetails: {
      houseStreet: '456 Mabini Street',
      barangay: 'Ilocanos Sur',
      municipalityCity: 'San Fernando',
      province: 'La Union',
    },
    sameAsPermanentAddress: false,
    hasGuardianOnly: false,
    motherName: {
      firstName: 'Maria',
      middleName: 'Santos',
      lastName: 'Dela Cruz',
    },
    fatherName: {
      firstName: 'Jose',
      middleName: 'Reyes',
      lastName: 'Dela Cruz',
    },
    guardianName: {
      firstName: '',
      middleName: '',
      lastName: '',
    },
    parentContactNumber: '09987654321',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue(true);
  });

  it('renders student profile fields with initial values', () => {
    render(
      <StudentProfileForm
        user={baseStudent}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    expect(screen.getByLabelText(/birthday/i)).toHaveValue('2004-05-15');
    expect(screen.getByLabelText(/permanent house\/street/i)).toHaveValue('123 Rizal Street');
    expect(screen.getByLabelText(/permanent barangay/i)).toHaveValue('Catbangen');
    expect(screen.getByLabelText(/permanent municipality\/city/i)).toHaveValue('San Fernando');
    expect(screen.getByLabelText(/permanent province/i)).toHaveValue('La Union');
    expect(screen.getByLabelText(/present house\/street/i)).toHaveValue('456 Mabini Street');
    expect(screen.getByLabelText(/present barangay/i)).toHaveValue('Ilocanos Sur');
    expect(screen.getByLabelText(/^contact number/i)).toHaveValue('09123456789');
    expect(screen.getByLabelText(/year level/i)).toBeDisabled();
    expect(screen.getByLabelText(/year level/i)).toHaveValue('Year 2');
    expect(screen.getByText(/managed by your Program Chair or Dean/i)).toBeInTheDocument();
  });

  it('mirrors permanent address and disables present address when sameAsPermanentAddress is checked', () => {
    render(
      <StudentProfileForm
        user={baseStudent}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    const sameAsCheckbox = screen.getByLabelText(/same as permanent address/i);
    const presentStreetInput = screen.getByLabelText(/present house\/street/i);

    expect(sameAsCheckbox).not.toBeChecked();
    expect(presentStreetInput).not.toBeDisabled();

    // Check the box
    fireEvent.click(sameAsCheckbox);
    expect(sameAsCheckbox).toBeChecked();
    expect(presentStreetInput).toBeDisabled();
    expect(presentStreetInput).toHaveValue('123 Rizal Street');

    // Modifying permanent address also updates present address while checkbox is active
    const permanentStreetInput = screen.getByLabelText(/permanent house\/street/i);
    fireEvent.change(permanentStreetInput, { target: { value: '999 New Highway' } });
    expect(presentStreetInput).toHaveValue('999 New Highway');

    // Unchecking re-enables present address for manual editing
    fireEvent.click(sameAsCheckbox);
    expect(sameAsCheckbox).not.toBeChecked();
    expect(presentStreetInput).not.toBeDisabled();
  });

  it('toggles between Parents mode and Guardian mode', () => {
    render(
      <StudentProfileForm
        user={baseStudent}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    // Initial is Parents mode
    expect(screen.getByLabelText(/mother's first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mother's last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/father's first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/father's last name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/guardian's first name/i)).not.toBeInTheDocument();

    // Switch to Guardian mode
    const guardianRadio = screen.getByLabelText(/guardian/i, { selector: 'input[type="radio"]' });
    fireEvent.click(guardianRadio);

    expect(screen.getByLabelText(/guardian's first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/guardian's last name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/mother's first name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/father's first name/i)).not.toBeInTheDocument();
  });

  it('submits updated profile data using updateUser and displays success alert', async () => {
    render(
      <StudentProfileForm
        user={baseStudent}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    const contactInput = screen.getByLabelText(/^contact number/i);
    fireEvent.change(contactInput, { target: { value: '09998887777' } });

    const saveButton = screen.getByRole('button', { name: /save profile|save student information/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('student-123', expect.objectContaining({
        contactNumber: '09998887777',
        birthday: '2004-05-15',
        permanentAddress: '123 Rizal Street, Catbangen, San Fernando, La Union',
        presentAddress: '456 Mabini Street, Ilocanos Sur, San Fernando, La Union',
        hasGuardianOnly: false,
        parentContactNumber: '09987654321',
      }));
    });

    expect(mockShowAlert).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: expect.stringMatching(/saved|updated/i),
    }));
  });

  it('defaults yearLevel to 1 if not defined and disables editing with badge', async () => {
    const studentNoYear: User = {
      ...baseStudent,
      yearLevel: undefined,
    };

    render(
      <StudentProfileForm
        user={studentNoYear}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    const yearInput = screen.getByLabelText(/year level/i);
    expect(yearInput).toBeDisabled();
    expect(yearInput).toHaveValue('Year 1');

    const saveButton = screen.getByRole('button', { name: /save profile|save student information/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('student-123', expect.objectContaining({
        yearLevel: 1,
      }));
    });
  });

  it('restricts birthday input to previous dates and blocks future birthday submission', async () => {
    render(
      <StudentProfileForm
        user={baseStudent}
        updateUser={mockUpdateUser}
        showAlert={mockShowAlert}
      />
    );

    const birthdayInput = screen.getByLabelText(/birthday/i);
    expect(birthdayInput).toHaveAttribute('max');

    // Attempt to set future birthday
    fireEvent.change(birthdayInput, { target: { value: '2027-02-27' } });

    const saveButton = screen.getByRole('button', { name: /save profile|save student information/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/Birthday must be from a previous date and cannot be in the future/i)).toBeInTheDocument();
    });

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });
});

