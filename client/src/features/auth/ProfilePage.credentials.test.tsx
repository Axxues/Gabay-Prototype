// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { User } from '../../shared/types/lms';
import { ProfilePage } from './ProfilePage';

let mockActiveUser: User = {
  id: 'u-dean-1',
  name: 'Dean Alan',
  email: 'dean.alan@dmmmsu.edu.ph',
  role: 'admin',
  adminSubrole: 'dean',
  avatar: '',
  yearsOfTeaching: 10,
  educationalBackground: [],
};
let mockActiveRole: string = 'admin';
const mockUpdateUser = vi.fn().mockResolvedValue(true);
const mockShowAlert = vi.fn();

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: mockActiveUser,
    activeRole: mockActiveRole,
    db: { users: [mockActiveUser], courses: [] },
    logout: vi.fn(),
    showConfirm: vi.fn(),
    showAlert: mockShowAlert,
    updateUser: mockUpdateUser,
    accent: 'blue',
    customAccentHex: '',
    setAccent: vi.fn(),
    setCustomAccentHex: vi.fn(),
    resetAccent: vi.fn(),
    theme: 'light',
    toggleTheme: vi.fn(),
  }),
  ACCENT_PRESETS: [],
}));

describe('ProfilePage - Role Credentials Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders FacultyProfileForm with leadership heading for admin and deans', () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-dean-1',
      name: 'Dean Alan',
      email: 'dean.alan@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      avatar: '',
      yearsOfTeaching: 10,
      educationalBackground: [],
    };

    render(<ProfilePage />);

    expect(screen.getByText('Administrative & Leadership Profile')).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/years of teaching experience/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add degree/i })).not.toBeInTheDocument();
  });

  it('renders FacultyProfileForm for chairperson', () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-chair-1',
      name: 'Chair Grace',
      email: 'chair.grace@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'chairperson',
      avatar: '',
      yearsOfTeaching: 8,
      educationalBackground: [],
    };

    render(<ProfilePage />);

    expect(screen.getByText('Administrative & Leadership Profile')).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/years of teaching experience/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add degree/i })).not.toBeInTheDocument();
  });

  it('renders FacultyProfileForm for superadmin', () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-super-1',
      name: 'Chancellor Reyes',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
      avatar: '',
      yearsOfTeaching: 20,
      educationalBackground: [],
    };

    render(<ProfilePage />);

    expect(screen.getByText('Administrative & Leadership Profile')).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/years of teaching experience/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add degree/i })).not.toBeInTheDocument();
  });

  it('renders StudentProfileForm and does NOT render FacultyProfileForm for students', () => {
    mockActiveRole = 'student';
    mockActiveUser = {
      id: 'u-stud-1',
      name: 'Freshman Maria',
      email: 'maria@dmmmsu.edu.ph',
      role: 'student',
      avatar: '',
      yearLevel: 1,
    };

    render(<ProfilePage />);

    expect(screen.getByText('Institutional Records & Student Information')).toBeInTheDocument();
    expect(screen.queryByText('Administrative & Leadership Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Faculty & Staff Credentials')).not.toBeInTheDocument();
  });

  it('renders FacultyProfileForm for regular faculty and staff', () => {
    mockActiveRole = 'faculty';
    mockActiveUser = {
      id: 'u-fac-1',
      name: 'Prof. John',
      email: 'prof.john@dmmmsu.edu.ph',
      role: 'faculty',
      avatar: '',
      yearsOfTeaching: 5,
      educationalBackground: [],
    };

    render(<ProfilePage />);

    expect(screen.getByText('Faculty & Staff Credentials')).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/years of teaching experience/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add degree/i })).toBeInTheDocument();
  });
});
