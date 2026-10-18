// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { LoginRoute } from '../../App';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
      mockNavigate(to, { replace });
      return null;
    },
  };
});

const mockLogin = vi.fn();
const mockToggleTheme = vi.fn();
const mockShowAlert = vi.fn();

const mockLMS = {
  login: mockLogin,
  theme: 'light',
  toggleTheme: mockToggleTheme,
  showAlert: mockShowAlert,
  currentUser: null as any,
  activeUser: null as any,
  isAuthenticated: false,
  authReady: true,
  isSessionExpired: false,
  activeRole: 'student',
  activeCourseId: null,
  setActiveCourseId: vi.fn(),
  logHistory: vi.fn(),
  db: { users: [] },
};

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => mockLMS,
  LMSProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('LoginPage Profile Redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to /profile when login succeeds and user profile is incomplete', async () => {
    const incompleteUser = {
      id: 'student-inc',
      name: 'Incomplete Student',
      email: 'student.inc@dmmmsu.edu.ph',
      role: 'student',
      // missing birthday, address, yearLevel, parents, etc.
    };

    mockLogin.mockResolvedValueOnce({
      success: true,
      user: incompleteUser,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('name@dmmmsu.edu.ph');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'student.inc@dmmmsu.edu.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true });
    });
  });

  it('navigates to /dashboard when login succeeds and user profile is complete', async () => {
    const completeUser = {
      id: 'student-comp',
      name: 'Complete Student',
      email: 'student.comp@dmmmsu.edu.ph',
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

    mockLogin.mockResolvedValueOnce({
      success: true,
      user: completeUser,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('name@dmmmsu.edu.ph');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'student.comp@dmmmsu.edu.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('navigates to /profile on quick demo login when user profile is incomplete', async () => {
    const incompleteUser = {
      id: 'student-inc',
      name: 'Incomplete Student',
      email: 'student1@dmmmsu.edu.ph',
      role: 'student',
    };

    mockLogin.mockResolvedValueOnce({
      success: true,
      user: incompleteUser,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const studentDemoBtn = screen.getByRole('button', { name: /student 1/i });
    fireEvent.click(studentDemoBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true });
    }, { timeout: 1000 });
  });

  it('navigates to /profile when admin or dean logs in with incomplete profile', async () => {
    const incompleteDean = {
      id: 'dean-inc',
      name: 'Dean Incomplete',
      email: 'dean@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
    };

    mockLogin.mockResolvedValueOnce({
      success: true,
      user: incompleteDean,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('name@dmmmsu.edu.ph');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'dean@dmmmsu.edu.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true });
    });
  });

  it('navigates to /dashboard when admin or dean logs in with complete credentials', async () => {
    const completeDean = {
      id: 'dean-comp',
      name: 'Dean Complete',
      email: 'dean.comp@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      address: 'Faculty Village, Campus',
      contactNumber: '09123456780',
      birthday: '1975-03-20',
      yearsOfTeaching: 14,
      educationalBackground: [
        {
          id: 'deg-d1',
          degreeLevel: 'doctorate',
          school: 'DMMMSU',
          yearGraduated: 2012,
          specialization: 'Computer Engineering',
        },
      ],
    };

    mockLogin.mockResolvedValueOnce({
      success: true,
      user: completeDean,
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('name@dmmmsu.edu.ph');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'dean.comp@dmmmsu.edu.ph' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  describe('LoginRoute redirect', () => {
    it('redirects authenticated user to /profile if profile is incomplete', () => {
      mockLMS.isAuthenticated = true;
      mockLMS.currentUser = {
        id: 'student-inc',
        name: 'Incomplete Student',
        role: 'student',
      };
      mockLMS.activeUser = mockLMS.currentUser;

      render(
        <MemoryRouter>
          <LoginRoute />
        </MemoryRouter>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/profile', { replace: true });
    });

    it('redirects authenticated user to /dashboard if profile is complete', () => {
      mockLMS.isAuthenticated = true;
      mockLMS.currentUser = {
        id: 'student-comp',
        name: 'Complete Student',
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
      mockLMS.activeUser = mockLMS.currentUser;

      render(
        <MemoryRouter>
          <LoginRoute />
        </MemoryRouter>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });
});
