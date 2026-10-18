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
});
