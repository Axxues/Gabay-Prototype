// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileIncompleteBanner } from './ProfileIncompleteBanner';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockLMS = {
  activeUser: null as any,
};

vi.mock('../../context/LMSContext', () => ({
  useLMS: () => mockLMS,
}));

describe('ProfileIncompleteBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when there is no activeUser', () => {
    mockLMS.activeUser = null;
    const { container } = render(
      <MemoryRouter>
        <ProfileIncompleteBanner />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders null when the activeUser has a complete profile', () => {
    mockLMS.activeUser = {
      id: 'student-1',
      role: 'student',
      birthday: '2002-05-10',
      permanentAddress: '123 Main St, San Fernando, La Union',
      presentAddress: '123 Main St, San Fernando, La Union',
      contactNumber: '09123456789',
      parentContactNumber: '09987654321',
      yearLevel: 2,
      motherName: { firstName: 'Maria', lastName: 'Dalisay' },
      fatherName: { firstName: 'Cardo', lastName: 'Dalisay' },
    };

    const { container } = render(
      <MemoryRouter>
        <ProfileIncompleteBanner />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders warning message and link button to /profile when profile is incomplete', () => {
    mockLMS.activeUser = {
      id: 'student-2',
      role: 'student',
      name: 'Incomplete Student',
      // missing required fields
    };

    render(
      <MemoryRouter>
        <ProfileIncompleteBanner />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText(/Your institutional profile is incomplete/i)
    ).toBeInTheDocument();

    const completeButton = screen.getByRole('button', { name: /Complete Profile/i });
    expect(completeButton).toBeInTheDocument();

    fireEvent.click(completeButton);
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('navigates to /profile via onNavigateTab callback if provided', () => {
    mockLMS.activeUser = {
      id: 'faculty-1',
      role: 'faculty',
      // missing required fields
    };

    const handleNavigateTab = vi.fn();

    render(
      <MemoryRouter>
        <ProfileIncompleteBanner onNavigateTab={handleNavigateTab} />
      </MemoryRouter>
    );

    const completeButton = screen.getByRole('button', { name: /Complete Profile/i });
    fireEvent.click(completeButton);
    expect(handleNavigateTab).toHaveBeenCalledWith('profile');
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });
});
