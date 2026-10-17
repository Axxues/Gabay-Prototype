// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';
import { LoginPage } from './LoginPage';

const mockRegisterAccount = vi.fn();
const mockActivateEmail = vi.fn();
const mockShowAlert = vi.fn();

const mockColleges = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' },
  { id: 'col-coe', name: 'College of Education', code: 'COED' },
];

const mockDepartments = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS' },
  { id: 'dept-it', collegeId: 'col-ccs', name: 'Department of Information Technology', code: 'IT' },
  { id: 'dept-eled', collegeId: 'col-coe', name: 'Department of Elementary Education', code: 'ELED' },
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    registerAccount: mockRegisterAccount,
    activateEmail: mockActivateEmail,
    colleges: mockColleges,
    departments: mockDepartments,
    showAlert: mockShowAlert,
    theme: 'light',
    toggleTheme: vi.fn(),
    login: vi.fn(),
  }),
}));

describe('RegisterPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required registration inputs and role selections', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    // Roles
    expect(screen.getByRole('radio', { name: /student/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /faculty/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /staff/i })).toBeInTheDocument();

    // Inputs
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/middle name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/institutional email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/id number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/college/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    // Submit button
    expect(screen.getByRole('button', { name: /register|create account/i })).toBeInTheDocument();
  });

  it('filters departments dynamically based on selected college', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    const collegeSelect = screen.getByLabelText(/college/i) as HTMLSelectElement;
    const departmentSelect = screen.getByLabelText(/department/i) as HTMLSelectElement;

    // Initially no college selected or default option
    fireEvent.change(collegeSelect, { target: { value: 'col-ccs' } });

    // Should include CCS departments, but not Education
    expect(screen.getByRole('option', { name: /Department of Computer Science/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Department of Information Technology/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Department of Elementary Education/i })).not.toBeInTheDocument();

    // Switch college to COE
    fireEvent.change(collegeSelect, { target: { value: 'col-coe' } });
    expect(screen.queryByRole('option', { name: /Department of Computer Science/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Department of Elementary Education/i })).toBeInTheDocument();
  });

  it('auto-formats ID Number input to XXX-XXXX-X and enforces format', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    const idInput = screen.getByLabelText(/id number/i) as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: '23110823' } });
    expect(idInput.value).toBe('231-1082-3');

    // Fill the rest with valid values but leave ID invalid
    fireEvent.change(idInput, { target: { value: '12345' } }); // formats to 123-45
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText(/institutional email/i), { target: { value: 'msantos@dmmmsu.edu.ph' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    expect(mockRegisterAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/id number must follow the format xxx-xxxx-x/i)).toBeInTheDocument();
  });

  it('enforces institutional email format (@dmmmsu.edu.ph)', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '23110823' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });

    // Enter personal non-institutional email
    fireEvent.change(screen.getByLabelText(/institutional email/i), { target: { value: 'maria@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    expect(mockRegisterAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/institutional email.*@dmmmsu\.edu\.ph/i)).toBeInTheDocument();
  });

  it('submits registration successfully and displays email activation modal with simulated link', async () => {
    mockRegisterAccount.mockResolvedValueOnce({
      id: 'reg-101',
      activationToken: 'token-xyz-123',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'jdelacruz@dmmmsu.edu.ph',
      studentId: '231-1082-3',
      role: 'student',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      emailVerified: false,
      status: 'pending',
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('radio', { name: /student/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/middle name/i), { target: { value: 'Protacio' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText(/institutional email/i), { target: { value: 'jdelacruz@dmmmsu.edu.ph' } });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '23110823' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secretPass12' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secretPass12' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    await waitFor(() => {
      expect(mockRegisterAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Juan',
          middleName: 'Protacio',
          lastName: 'Dela Cruz',
          email: 'jdelacruz@dmmmsu.edu.ph',
          studentId: '231-1082-3',
          role: 'student',
          collegeId: 'col-ccs',
          department: 'Department of Computer Science',
          password: 'secretPass12',
        })
      );
    });

    // Activation link modal
    expect(await screen.findByText(/registration submitted|account registration submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/\/activate\?token=token-xyz-123/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy activation link/i })).toBeInTheDocument();
  });

  it('automatically verifies token when accessed at /activate?token=...', async () => {
    mockActivateEmail.mockResolvedValueOnce({
      success: true,
      message: 'Email address successfully verified.',
    });

    render(
      <MemoryRouter initialEntries={['/activate?token=valid-activation-token-999']}>
        <RegisterPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockActivateEmail).toHaveBeenCalledWith('valid-activation-token-999');
    });

    expect(await screen.findByText(/email address successfully verified/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to sign in|proceed to sign in/i })).toHaveAttribute('href', '/login');
  });

  it('shows error state when activation token is invalid or expired', async () => {
    mockActivateEmail.mockResolvedValueOnce({
      success: false,
      message: 'Invalid or expired activation link.',
    });

    render(
      <MemoryRouter initialEntries={['/activate?token=expired-token-123']}>
        <RegisterPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockActivateEmail).toHaveBeenCalledWith('expired-token-123');
    });

    expect(await screen.findByText(/invalid or expired activation link/i)).toBeInTheDocument();
  });

  it('enables vertical scrolling so the registration card is fully accessible on all viewport heights', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    const outerContainer = container.firstElementChild as HTMLElement;
    expect(outerContainer.className).toContain('overflow-y-auto');
    expect(outerContainer.className).not.toContain('overflow-hidden');

    const card = screen.getByTestId('register-card');
    expect(card.className).toContain('max-h-');

    const scrollableBody = screen.getByTestId('register-card-scrollable');
    expect(scrollableBody.className).toContain('overflow-y-auto');
  });
});

describe('LoginPage Registration Link', () => {
  it('renders a styled link directing users to the register page', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<div>Register Destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    const registerLink = screen.getByRole('link', { name: /register here/i });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });
});
