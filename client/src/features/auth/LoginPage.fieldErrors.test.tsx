// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';

const mockLogin = vi.fn();

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    login: mockLogin,
    theme: 'light',
    toggleTheme: vi.fn(),
    showAlert: vi.fn(),
    currentUser: null,
    activeUser: null,
    isAuthenticated: false,
    authReady: true,
    isSessionExpired: false,
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

describe('LoginPage field errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an inline error and red border under email/ID after leaving it empty', () => {
    renderPage();
    const identifier = screen.getByPlaceholderText('name@dmmmsu.edu.ph');

    expect(screen.queryByText('Please enter your email or ID.')).not.toBeInTheDocument();

    fireEvent.blur(identifier);

    expect(screen.getByText('Please enter your email or ID.')).toBeInTheDocument();
    expect(identifier).toHaveAttribute('aria-invalid', 'true');
    expect(identifier.className).toContain('border-destructive');
  });

  it('shows an inline error and red border under password after leaving it empty', () => {
    renderPage();
    const password = screen.getByPlaceholderText('••••••••');

    fireEvent.blur(password);

    expect(screen.getByText('Please enter your password.')).toBeInTheDocument();
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password.className).toContain('border-destructive');
  });

  it('shows an error under every empty field when the form is submitted', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByText('Please enter your email or ID.')).toBeInTheDocument();
    expect(screen.getByText('Please enter your password.')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as that field becomes valid', () => {
    renderPage();
    const identifier = screen.getByPlaceholderText('name@dmmmsu.edu.ph');
    const password = screen.getByPlaceholderText('••••••••');

    fireEvent.blur(identifier);
    fireEvent.blur(password);

    fireEvent.change(identifier, { target: { value: 'student1@dmmmsu.edu.ph' } });

    expect(screen.queryByText('Please enter your email or ID.')).not.toBeInTheDocument();
    expect(screen.getByText('Please enter your password.')).toBeInTheDocument();
  });

  it('keeps credential failures in the top banner without marking inputs invalid', async () => {
    mockLogin.mockResolvedValueOnce({
      success: false,
      message: 'Invalid credentials. Please try again.',
    });

    renderPage();
    const identifier = screen.getByPlaceholderText('name@dmmmsu.edu.ph');
    const password = screen.getByPlaceholderText('••••••••');

    fireEvent.change(identifier, { target: { value: 'student1@dmmmsu.edu.ph' } });
    fireEvent.change(password, { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText('Invalid credentials. Please try again.')
    ).toBeInTheDocument();
    expect(identifier).not.toHaveAttribute('aria-invalid');
    expect(password).not.toHaveAttribute('aria-invalid');
  });
});
