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
const mockSendActivationEmail = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../shared/api/emailApi', () => ({
  sendActivationEmail: (...args: any[]) => mockSendActivationEmail(...args),
}));

const mockColleges = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' },
  { id: 'col-coe', name: 'College of Education', code: 'COED' },
];

const mockDepartments = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS' },
  { id: 'dept-it', collegeId: 'col-ccs', name: 'Department of Information Technology', code: 'IT' },
  { id: 'dept-eled', collegeId: 'col-coe', name: 'Department of Elementary Education', code: 'ELED' },
];

const mockLogout = vi.fn();

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
    logout: mockLogout,
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
    expect(screen.getByLabelText(/program|department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    // Submit button
    expect(screen.getByRole('button', { name: /register|create account/i })).toBeInTheDocument();
  });

  it('marks College and Department as required fields', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/^college/i)).toBeRequired();
    expect(screen.getByLabelText(/^program|^department/i)).toBeRequired();

    // With nothing selected, College is invalid (required semantics)
    expect(screen.getByLabelText(/^college/i)).toBeInvalid();

    // Department stays disabled until a college is chosen, then it too is required
    const departmentSelect = screen.getByLabelText(/^program|^department/i);
    expect(departmentSelect).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^college/i), { target: { value: 'col-ccs' } });
    expect(departmentSelect).toBeEnabled();
    expect(departmentSelect).toBeInvalid();

    // Required markers are shown on both labels
    expect(screen.getByText('College *')).toBeInTheDocument();
    expect(screen.getByText(/Program \*|Department \*/)).toBeInTheDocument();
  });

  it('blocks submission when College and Department are not selected', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    // Fill every other field so only the academic placement is missing
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText(/institutional email/i), {
      target: { value: 'msantos@student.dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '23110823' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    expect(mockRegisterAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/please select your college/i)).toBeInTheDocument();
  });

  it('filters departments dynamically based on selected college', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    const collegeSelect = screen.getByLabelText(/college/i) as HTMLSelectElement;
    const departmentSelect = screen.getByLabelText(/program|department/i) as HTMLSelectElement;

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
    fireEvent.change(screen.getByLabelText(/institutional email/i), { target: { value: 'msantos@student.dmmmsu.edu.ph' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/program|department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    expect(mockRegisterAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/id number must follow the format xxx-xxxx-x/i)).toBeInTheDocument();
  });

  it('enforces institutional email format (@dmmmsu.edu.ph or @student.dmmmsu.edu.ph)', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Maria' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '23110823' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/program|department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });

    // Enter personal non-institutional email
    fireEvent.change(screen.getByLabelText(/institutional email/i), { target: { value: 'maria@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    expect(mockRegisterAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/student institutional email must end with @student\.dmmmsu\.edu\.ph/i)).toBeInTheDocument();
  });

  it('accepts student accounts registered with a student.dmmmsu.edu.ph address', async () => {
    mockRegisterAccount.mockResolvedValueOnce({
      id: 'reg-201',
      activationToken: 'token-student-1',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'jdelacruz@student.dmmmsu.edu.ph',
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
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText(/institutional email/i), {
      target: { value: 'jdelacruz@student.dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '23110823' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/program|department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secretPass12' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secretPass12' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    await waitFor(() => {
      expect(mockRegisterAccount).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jdelacruz@student.dmmmsu.edu.ph' })
      );
    });

    // The domain is accepted, so no validation error is shown
    expect(screen.queryByText(/institutional email must end with/i)).not.toBeInTheDocument();
  });

  it('updates email/id placeholders and maxLength dynamically when changing role', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/institutional email/i) as HTMLInputElement;
    const idInput = screen.getByLabelText(/id number/i) as HTMLInputElement;

    // Student role by default
    expect(emailInput.placeholder).toBe('name@student.dmmmsu.edu.ph');
    expect(idInput.placeholder).toBe('231-1082-3');
    expect(idInput.maxLength).toBe(10);

    // Switch to Faculty
    fireEvent.click(screen.getByRole('radio', { name: /faculty/i }));
    expect(emailInput.placeholder).toBe('name@dmmmsu.edu.ph');
    expect(idInput.placeholder).toBe('1082');
    expect(idInput.maxLength).toBe(4);

    // Switch to Staff
    fireEvent.click(screen.getByRole('radio', { name: /staff/i }));
    expect(emailInput.placeholder).toBe('name@dmmmsu.edu.ph');
    expect(idInput.placeholder).toBe('1082');
    expect(idInput.maxLength).toBe(4);

    // Switch back to Student
    fireEvent.click(screen.getByRole('radio', { name: /student/i }));
    expect(emailInput.placeholder).toBe('name@student.dmmmsu.edu.ph');
    expect(idInput.placeholder).toBe('231-1082-3');
    expect(idInput.maxLength).toBe(10);
  });

  it('automatically reformats existing ID input when role is changed', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    const idInput = screen.getByLabelText(/id number/i) as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: '23110823' } });
    expect(idInput.value).toBe('231-1082-3');

    // Switching to faculty slices to 4 digits
    fireEvent.click(screen.getByRole('radio', { name: /faculty/i }));
    expect(idInput.value).toBe('2311');

    // Typing in faculty mode enforces 4 digits only
    fireEvent.change(idInput, { target: { value: '98765' } });
    expect(idInput.value).toBe('9876');

    // Switching back to student formats the 4 digits
    fireEvent.click(screen.getByRole('radio', { name: /student/i }));
    expect(idInput.value).toBe('987-6');
  });

  it('rejects student registration with @dmmmsu.edu.ph email address', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('radio', { name: /student/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Juan' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Dela Cruz' } });
    fireEvent.change(screen.getByLabelText(/institutional email/i), {
      target: { value: 'jdelacruz@dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '23110823' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    expect(mockRegisterAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/student institutional email must end with @student\.dmmmsu\.edu\.ph/i)).toBeInTheDocument();
  });

  it('accepts faculty registration with @dmmmsu.edu.ph and 4-digit ID, but rejects student email and non-4-digit ID', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('radio', { name: /faculty/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Prof' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Santos' } });
    // Attempt with @student.dmmmsu.edu.ph
    fireEvent.change(screen.getByLabelText(/institutional email/i), {
      target: { value: 'psantos@student.dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '1082' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));
    expect(mockRegisterAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/institutional email must end with @dmmmsu\.edu\.ph/i)).toBeInTheDocument();

    // Fix email to faculty format, but test invalid ID (3 digits)
    fireEvent.change(screen.getByLabelText(/institutional email/i), {
      target: { value: 'psantos@dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));
    expect(mockRegisterAccount).not.toHaveBeenCalled();
    expect(await screen.findByText(/id number must follow the format xxxx/i)).toBeInTheDocument();

    // Provide valid 4-digit ID and academic info
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '1082' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/program|department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'facultyPass12' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'facultyPass12' } });

    mockRegisterAccount.mockResolvedValueOnce({
      id: 'reg-fac-1',
      role: 'faculty',
      studentId: '1082',
      activationToken: 'token-fac-1',
    });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));
    await waitFor(() => {
      expect(mockRegisterAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'faculty',
          email: 'psantos@dmmmsu.edu.ph',
          studentId: '1082',
        })
      );
    });
  });

  it('accepts staff registration with @dmmmsu.edu.ph and 4-digit ID', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('radio', { name: /staff/i }));
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Staff' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Member' } });
    fireEvent.change(screen.getByLabelText(/institutional email/i), {
      target: { value: 'staff@dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '5566' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/program|department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'staffPass12' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'staffPass12' } });

    mockRegisterAccount.mockResolvedValueOnce({
      id: 'reg-staff-1',
      role: 'staff',
      studentId: '5566',
      activationToken: 'token-staff-1',
    });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));
    await waitFor(() => {
      expect(mockRegisterAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'staff',
          email: 'staff@dmmmsu.edu.ph',
          studentId: '5566',
        })
      );
    });
  });

  it('submits registration successfully, dispatches activation email, and shows modal with Okay button without exposing the link', async () => {
    mockRegisterAccount.mockResolvedValueOnce({
      id: 'reg-101',
      activationToken: 'token-xyz-123',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'jdelacruz@student.dmmmsu.edu.ph',
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
    fireEvent.change(screen.getByLabelText(/institutional email/i), { target: { value: 'jdelacruz@student.dmmmsu.edu.ph' } });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '23110823' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/program|department/i), { target: { value: 'Department of Computer Science' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secretPass12' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secretPass12' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    await waitFor(() => {
      expect(mockRegisterAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Juan',
          middleName: 'Protacio',
          lastName: 'Dela Cruz',
          email: 'jdelacruz@student.dmmmsu.edu.ph',
          studentId: '231-1082-3',
          role: 'student',
          collegeId: 'col-ccs',
          department: 'Department of Computer Science',
          password: 'secretPass12',
        })
      );
    });

    // Email dispatch helper called
    await waitFor(() => {
      expect(mockSendActivationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jdelacruz@student.dmmmsu.edu.ph',
          activationUrl: expect.stringContaining('/activate?token=token-xyz-123'),
        })
      );
    });

    // Activation link modal shows email-sent notification
    expect(await screen.findByText(/registration submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/an activation link is sent to your email/i)).toBeInTheDocument();

    // Raw link and direct activation buttons must NOT be present
    expect(screen.queryByText(/\/activate\?token=token-xyz-123/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy activation link/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate now/i })).not.toBeInTheDocument();

    // Single Okay button
    const okayButton = screen.getByRole('button', { name: /okay/i });
    expect(okayButton).toBeInTheDocument();
  });

  it('does not display confirmation modal and shows error alert when email dispatch fails', async () => {
    mockRegisterAccount.mockResolvedValueOnce({
      id: 'reg-fail-email',
      firstName: 'Ana',
      lastName: 'Cruz',
      email: 'acruz@student.dmmmsu.edu.ph',
      studentId: '231-1082-4',
      role: 'student',
      collegeId: 'col-ccs',
      department: 'Department of Computer Science',
      activationToken: 'token-fail-123',
      registeredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      emailVerified: false,
    });

    mockSendActivationEmail.mockResolvedValueOnce({
      success: false,
      message: 'SMTP connection failed. Unable to deliver activation email.',
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } });
    fireEvent.change(screen.getByLabelText(/institutional email/i), {
      target: { value: 'acruz@student.dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '231-1082-4' } });
    fireEvent.change(screen.getByLabelText(/college/i), { target: { value: 'col-ccs' } });
    fireEvent.change(screen.getByLabelText(/program|department/i), {
      target: { value: 'Department of Computer Science' },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secretPass12' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secretPass12' } });

    fireEvent.click(screen.getByRole('button', { name: /register|create account/i }));

    // Error message must be displayed
    expect(await screen.findByText(/SMTP connection failed/i)).toBeInTheDocument();

    // Confirmation modal must NOT appear
    expect(screen.queryByText(/registration submitted/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/an activation link is sent to your email/i)).not.toBeInTheDocument();
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
    const backLink = screen.getByRole('link', { name: /back to sign in|proceed to sign in/i });
    expect(backLink).toHaveAttribute('href', '/login');

    fireEvent.click(backLink);
    expect(mockLogout).toHaveBeenCalled();
  });

  it('navigates to /login when clicking Back to Sign In after email verification', async () => {
    mockActivateEmail.mockResolvedValueOnce({
      success: true,
      message: 'Email address successfully verified.',
    });

    render(
      <MemoryRouter initialEntries={['/activate?token=valid-token-route']}>
        <Routes>
          <Route path="/activate" element={<RegisterPage />} />
          <Route path="/login" element={<div>Sign In Screen Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockActivateEmail).toHaveBeenCalledWith('valid-token-route');
    });

    const backLink = await screen.findByRole('link', { name: /back to sign in/i });
    fireEvent.click(backLink);

    expect(mockLogout).toHaveBeenCalled();
    expect(await screen.findByText('Sign In Screen Target')).toBeInTheDocument();
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
