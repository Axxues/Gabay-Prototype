// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockLMS = {
  db: { courses: [], courseSections: [], enrollmentRequests: [] },
  activeUser: null as any,
  activeRole: 'faculty',
  getUnreadNotificationCount: vi.fn(() => 0),
  getNotifications: vi.fn(() => []),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  getPendingRequestsForStudent: vi.fn(() => []),
  approveEnrollmentRequests: vi.fn(),
  rejectEnrollmentRequests: vi.fn(),
  studentApproveInvitation: vi.fn(),
  studentDeclineInvitation: vi.fn(),
  showAlert: vi.fn(),
};

vi.mock('../../context/LMSContext', () => ({
  useLMS: () => mockLMS,
}));

describe('NotificationBell Profile Incomplete Card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows badge and renders Profile Information Required card under Needs your action when profile is incomplete', () => {
    mockLMS.activeUser = {
      id: 'fac-1',
      role: 'faculty',
      // Incomplete: missing address, educationalBackground, etc.
    };
    mockLMS.activeRole = 'faculty';

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    // Badge indicates 1 action item
    expect(screen.getByText('1')).toBeInTheDocument();

    // Click the bell to open the card dropdown
    fireEvent.click(screen.getByTitle('Notifications'));

    expect(screen.getByText('Needs your action')).toBeInTheDocument();
    expect(screen.getByText('Profile Information Required')).toBeInTheDocument();
    expect(screen.getByText('Please fill up your profile information to keep your institutional records up to date.')).toBeInTheDocument();

    const fillButton = screen.getByRole('button', { name: /Fill up Profile/i });
    expect(fillButton).toBeInTheDocument();

    fireEvent.click(fillButton);
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('does not render profile incomplete card when profile is complete', () => {
    mockLMS.activeUser = {
      id: 'student-complete',
      role: 'student',
      firstName: 'Juana',
      lastName: 'Cruz',
      name: 'Juana Cruz',
      birthday: '2004-01-01',
      permanentAddress: 'Brgy 1, City',
      presentAddress: 'Brgy 1, City',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Juana', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09991112222',
      yearLevel: 2,
    };
    mockLMS.activeRole = 'student';

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    // Bell dropdown opened
    fireEvent.click(screen.getByTitle('Notifications'));

    expect(screen.queryByText('Profile Information Required')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing needs your action right now.')).toBeInTheDocument();
  });

  it('shows badge and renders Profile Information Required card when an admin/dean has an incomplete profile', () => {
    mockLMS.activeUser = {
      id: 'dean-1',
      role: 'admin',
      adminSubrole: 'dean',
    };
    mockLMS.activeRole = 'admin';

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.getByText('Profile Information Required')).toBeInTheDocument();
  });

  it('does not render profile incomplete card for admin, dean, chair, or superadmin when profile is complete', () => {
    mockLMS.activeUser = {
      id: 'admin-complete',
      role: 'admin',
      adminSubrole: 'dean',
      firstName: 'Dean',
      lastName: 'Official',
      name: 'Dean Official',
      address: 'Dean Office, CIT Campus',
      contactNumber: '09171234567',
      birthday: '1982-03-20',
    };
    mockLMS.activeRole = 'admin';

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.queryByText('Profile Information Required')).not.toBeInTheDocument();
  });

  it('does not render profile incomplete card for faculty when all faculty required fields are complete', () => {
    mockLMS.activeUser = {
      id: 'faculty-complete',
      role: 'faculty',
      firstName: 'Maria',
      lastName: 'Santos',
      name: 'Dr. Maria Santos',
      address: 'Faculty Housing, North Campus',
      contactNumber: '09181234567',
      birthday: '1985-05-10',
      yearsOfTeaching: 8,
      educationalBackground: [
        {
          id: 'deg-1',
          degreeLevel: 'masters',
          school: 'DMMMSU',
          yearGraduated: 2012,
          specialization: 'Information Technology',
        },
      ],
    };
    mockLMS.activeRole = 'faculty';

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.queryByText('Profile Information Required')).not.toBeInTheDocument();
  });

  it('does not render profile incomplete card for staff when all staff required fields are complete', () => {
    mockLMS.activeUser = {
      id: 'staff-complete',
      role: 'staff',
      firstName: 'Staff',
      lastName: 'Member',
      name: 'Staff Member',
      address: 'Staff Village, South Campus',
      contactNumber: '09191234567',
      birthday: '1988-11-25',
      yearsOfTeaching: 0,
      educationalBackground: [
        {
          id: 'deg-2',
          degreeLevel: 'bachelors',
          school: 'DMMMSU',
          yearGraduated: 2010,
          specialization: 'Public Administration',
        },
      ],
    };
    mockLMS.activeRole = 'staff';

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.queryByText('Profile Information Required')).not.toBeInTheDocument();
  });

  it('shows badge and renders Profile Information Required card for student when required fields are missing', () => {
    mockLMS.activeUser = {
      id: 'stud-incomplete',
      role: 'student',
      // Missing birthday, contactNumber, etc.
    };
    mockLMS.activeRole = 'student';

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.getByText('Profile Information Required')).toBeInTheDocument();
  });

  it('shows badge and renders Profile Information Required card for superadmin when required fields are missing', () => {
    mockLMS.activeUser = {
      id: 'super-incomplete',
      role: 'superadmin',
      // Missing address, contactNumber, birthday
    };
    mockLMS.activeRole = 'superadmin';

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.getByText('Profile Information Required')).toBeInTheDocument();
  });

  it('shows badge when student has pending invitations under Needs your action', () => {
    mockLMS.activeUser = {
      id: 'student-1',
      role: 'student',
      firstName: 'Juana',
      lastName: 'Cruz',
      name: 'Juana Cruz',
      birthday: '2004-01-01',
      permanentAddress: 'Brgy 1, City',
      presentAddress: 'Brgy 1, City',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Juana', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09991112222',
      yearLevel: 2,
    };
    mockLMS.activeRole = 'student';
    mockLMS.getPendingRequestsForStudent = vi.fn(() => [
      {
        id: 'req-1',
        courseId: 'c1',
        studentId: 'student-1',
        status: 'pending',
        type: 'faculty_enroll',
        requestedAt: '2026-10-27',
      },
    ]);
    mockLMS.getUnreadNotificationCount = vi.fn(() => 0);

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('combines unread notifications and pending action items in badge count', () => {
    mockLMS.activeUser = {
      id: 'student-1',
      role: 'student',
      firstName: 'Juana',
      lastName: 'Cruz',
      name: 'Juana Cruz',
      birthday: '2004-01-01',
      permanentAddress: 'Brgy 1, City',
      presentAddress: 'Brgy 1, City',
      sameAsPermanentAddress: true,
      contactNumber: '09123456789',
      hasGuardianOnly: false,
      motherName: { firstName: 'Juana', lastName: 'Cruz' },
      fatherName: { firstName: 'Juan', lastName: 'Cruz' },
      parentContactNumber: '09991112222',
      yearLevel: 2,
    };
    mockLMS.activeRole = 'student';
    mockLMS.getPendingRequestsForStudent = vi.fn(() => [
      {
        id: 'req-1',
        courseId: 'c1',
        studentId: 'student-1',
        status: 'pending',
        type: 'faculty_enroll',
        requestedAt: '2026-10-27',
      },
    ]);
    mockLMS.getUnreadNotificationCount = vi.fn(() => 2);

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays resolved student name from db.users when staff views an enrollment request whose studentName is a UUID', () => {
    mockLMS.activeUser = {
      id: 'fac-1',
      role: 'faculty',
      firstName: 'Prof',
      lastName: 'Smith',
      name: 'Prof. Smith',
      birthday: '1980-01-01',
      address: 'Campus',
      contactNumber: '09123456789',
      yearsOfTeaching: 5,
      educationalBackground: [{ id: 'deg-1', degreeLevel: 'masters', school: 'DMMMSU', yearGraduated: 2015, specialization: 'CS' }],
    };
    mockLMS.activeRole = 'faculty';
    mockLMS.db = {
      courses: [{ id: 'c1', code: 'CSPC 112', title: 'Software Engineering 2' }],
      courseSections: [],
      users: [
        {
          id: 'cf220235-9d33-40fa-8692-f018e614138e',
          firstName: 'Juan',
          lastName: 'Dela Cruz',
          name: 'Juan Dela Cruz',
        },
      ],
      enrollmentRequests: [
        {
          id: 'req-uuid',
          courseId: 'c1',
          studentId: 'cf220235-9d33-40fa-8692-f018e614138e',
          studentName: 'cf220235-9d33-40fa-8692-f018e614138e',
          type: 'faculty_enroll',
          status: 'pending',
          requestedAt: '2026-10-27',
        },
      ],
    };
    mockLMS.getUnreadNotificationCount = vi.fn(() => 0);

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    // Open bell dropdown
    fireEvent.click(screen.getByTitle('Notifications'));

    // Should display the real student name instead of UUID
    expect(screen.getByText(/Juan Dela Cruz/)).toBeInTheDocument();
    expect(screen.queryByText(/cf220235-9d33-40fa-8692-f018e614138e/)).not.toBeInTheDocument();
  });
});

