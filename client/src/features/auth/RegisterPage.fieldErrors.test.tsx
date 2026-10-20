// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from './RegisterPage';

const mockRegisterAccount = vi.fn();
const mockSendActivationEmail = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../shared/api/emailApi', () => ({
  sendActivationEmail: (...args: unknown[]) => mockSendActivationEmail(...args),
}));

const mockColleges = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' },
];

const mockDepartments = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS' },
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    registerAccount: mockRegisterAccount,
    activateEmail: vi.fn(),
    colleges: mockColleges,
    departments: mockDepartments,
    schoolYears: [],
    getActiveSchoolYearForCollege: () => undefined,
    getSchoolYearsByCollege: () => [],
    theme: 'light',
    toggleTheme: vi.fn(),
    logout: vi.fn(),
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <RegisterPage />
    </MemoryRouter>
  );

describe('RegisterPage field errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an inline error and red border under first name after leaving it empty', () => {
    renderPage();
    const firstName = screen.getByLabelText(/first name/i);

    expect(screen.queryByText('Please enter your first name.')).not.toBeInTheDocument();

    fireEvent.blur(firstName);

    expect(screen.getByText('Please enter your first name.')).toBeInTheDocument();
    expect(firstName).toHaveAttribute('aria-invalid', 'true');
    expect(firstName.className).toContain('border-destructive');
  });

  it('shows the domain error under institutional email after leaving it with a non-institutional address', () => {
    renderPage();
    const email = screen.getByLabelText(/institutional email/i);

    fireEvent.change(email, { target: { value: 'maria@gmail.com' } });
    fireEvent.blur(email);

    expect(
      screen.getByText(
        'Institutional email must end with @dmmmsu.edu.ph or @student.dmmmsu.edu.ph.'
      )
    ).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.className).toContain('border-destructive');
  });

  it('shows the format error under ID number after leaving it with the wrong format', () => {
    renderPage();
    const email = screen.getByLabelText(/institutional email/i);
    const idNumber = screen.getByLabelText(/id number/i);

    fireEvent.change(email, { target: { value: 'msantos@student.dmmmsu.edu.ph' } });
    fireEvent.change(idNumber, { target: { value: '12345' } });
    fireEvent.blur(idNumber);

    expect(
      screen.getByText('ID Number must follow the format XXX-XXXX-X (e.g. 231-1082-3).')
    ).toBeInTheDocument();
    expect(idNumber).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the length error under password after leaving a short password', () => {
    renderPage();
    const password = screen.getByLabelText(/^password/i);

    fireEvent.change(password, { target: { value: 'short' } });
    fireEvent.blur(password);

    expect(screen.getByText('Password must be at least 8 characters long.')).toBeInTheDocument();
    expect(password).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the mismatch error under confirm password after leaving it different from password', () => {
    renderPage();
    const password = screen.getByLabelText(/^password/i);
    const confirmPassword = screen.getByLabelText(/confirm password/i);

    fireEvent.change(password, { target: { value: 'password123' } });
    fireEvent.change(confirmPassword, { target: { value: 'password124' } });
    fireEvent.blur(confirmPassword);

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(confirmPassword).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows an error under every empty field when the form is submitted', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    expect(screen.getByText('Please enter your first name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your last name.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your institutional email.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your ID Number.')).toBeInTheDocument();
    expect(screen.getByText('Please select your college.')).toBeInTheDocument();
    expect(screen.getByText('Please enter a password.')).toBeInTheDocument();
    expect(mockRegisterAccount).not.toHaveBeenCalled();
  });

  it('clears only the edited field error as soon as that field becomes valid', () => {
    renderPage();
    const firstName = screen.getByLabelText(/first name/i);
    const lastName = screen.getByLabelText(/last name/i);

    fireEvent.blur(firstName);
    fireEvent.blur(lastName);

    fireEvent.change(firstName, { target: { value: 'Maria' } });

    expect(screen.queryByText('Please enter your first name.')).not.toBeInTheDocument();
    expect(screen.getByText('Please enter your last name.')).toBeInTheDocument();
  });

  it('clears the confirm password mismatch error when editing password makes them match', () => {
    renderPage();
    const password = screen.getByLabelText(/^password/i);
    const confirmPassword = screen.getByLabelText(/confirm password/i);

    fireEvent.change(password, { target: { value: 'password123' } });
    fireEvent.change(confirmPassword, { target: { value: 'password124' } });
    fireEvent.blur(confirmPassword);
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();

    fireEvent.change(password, { target: { value: 'password124' } });

    expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument();
  });

  it('revalidates email and ID number when the email domain changes', () => {
    renderPage();
    const email = screen.getByLabelText(/institutional email/i);
    const idNumber = screen.getByLabelText(/id number/i);

    fireEvent.change(email, { target: { value: 'psantos@gmail.com' } });
    fireEvent.blur(email);

    expect(
      screen.getByText(
        'Institutional email must end with @dmmmsu.edu.ph or @student.dmmmsu.edu.ph.'
      )
    ).toBeInTheDocument();

    // Employee domain + 4-digit ID is a valid combination
    fireEvent.change(email, { target: { value: 'psantos@dmmmsu.edu.ph' } });
    fireEvent.change(idNumber, { target: { value: '1082' } });
    fireEvent.blur(idNumber);

    expect(
      screen.queryByText(
        'Institutional email must end with @dmmmsu.edu.ph or @student.dmmmsu.edu.ph.'
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/ID Number must follow the format/i)).not.toBeInTheDocument();

    // The same digits are invalid once the address is a student one
    fireEvent.change(email, { target: { value: 'psantos@student.dmmmsu.edu.ph' } });
    fireEvent.blur(idNumber);

    expect(screen.getByText(/ID Number must follow the format XXX-XXXX-X/i)).toBeInTheDocument();
  });

  it('keeps activation-email failures in the top banner without marking inputs invalid', async () => {
    mockRegisterAccount.mockResolvedValueOnce({ id: 'reg-1', activationToken: 'token-1' });
    mockSendActivationEmail.mockResolvedValueOnce({
      success: false,
      message: 'SMTP connection failed. Unable to deliver activation email.',
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText(/institutional email/i), {
      target: { value: 'msantos@student.dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '23110823' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/program|department/i), {
      target: { value: 'Department of Computer Science' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secretPass12' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secretPass12' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    expect(await screen.findByText(/SMTP connection failed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/institutional email/i)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/id number/i)).not.toHaveAttribute('aria-invalid');
  });
});
