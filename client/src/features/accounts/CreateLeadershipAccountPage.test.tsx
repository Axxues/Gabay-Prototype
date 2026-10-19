// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CreateLeadershipAccountPage } from './CreateLeadershipAccountPage';
import type { User, College, Department } from '../../shared/types/lms';

const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

const mockSendLeadershipCodeEmail = vi.fn().mockResolvedValue({
  success: true,
  simulated: true,
  delivered: false,
});

vi.mock('../../shared/api/emailApi', () => ({
  sendLeadershipCodeEmail: (...args: any[]) => mockSendLeadershipCodeEmail(...args),
}));

const mockCreateUser = vi.fn();
const mockAppointLeadership = vi.fn();
const mockShowAlert = vi.fn();

const sampleColleges: College[] = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'dean-1' },
  { id: 'col-coe', name: 'College of Engineering', code: 'COE' }, // Unassigned
  { id: 'col-cas', name: 'College of Arts and Sciences', code: 'CAS', deanId: 'none' }, // Unassigned
];

const sampleDepartments: Department[] = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Computer Science', code: 'CS', chairpersonId: 'chair-1' },
  { id: 'dept-it', collegeId: 'col-ccs', name: 'Information Technology', code: 'IT' }, // Unassigned
  { id: 'dept-me', collegeId: 'col-coe', name: 'Mechanical Engineering', code: 'ME' }, // Unassigned
];

const sampleUsers: User[] = [
  {
    id: 'dean-1',
    name: 'Dr. Alan Turing',
    email: 'aturing@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    collegeId: 'col-ccs',
  } as User,
  {
    id: 'chair-1',
    name: 'Prof. Ada Lovelace',
    email: 'alovelace@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'chairperson',
    department: 'Computer Science',
    collegeId: 'col-ccs',
  } as User,
  {
    id: 'admin-super',
    name: 'Administrator',
    email: 'admin@dmmmsu.edu.ph',
    role: 'admin',
  } as User,
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    colleges: sampleColleges,
    departments: sampleDepartments,
    db: { users: sampleUsers },
    createUser: mockCreateUser,
    appointLeadership: mockAppointLeadership,
    showAlert: mockShowAlert,
    activeRole: 'admin',
    activeUser: sampleUsers[2],
  }),
}));

describe('CreateLeadershipAccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockCreateUser.mockImplementation(async (userData: any) => ({
      id: 'new-user-123',
      name: userData.name,
      email: userData.email,
      role: 'admin',
      adminSubrole: userData.adminSubrole,
    }));
    mockAppointLeadership.mockResolvedValue({ success: true, message: 'Leadership appointed' });
  });

  it('renders role pills and defaults to Dean with unassigned colleges', () => {
    render(<CreateLeadershipAccountPage />);

    expect(screen.getByRole('heading', { name: /create leadership account/i })).toBeDefined();
    expect(screen.getByText('College Dean')).toBeDefined();
    expect(screen.getByText('Department Chairperson')).toBeDefined();

    // In Dean mode, target college dropdown should only list unassigned colleges
    // 'col-coe' and 'col-cas' are unassigned; 'col-ccs' has a dean and should not be offered
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();

    const options = screen.getAllByRole('option').map(o => o.textContent);
    expect(options.some(opt => opt?.includes('College of Engineering'))).toBe(true);
    expect(options.some(opt => opt?.includes('College of Arts and Sciences'))).toBe(true);
    expect(options.some(opt => opt?.includes('College of Computer Science'))).toBe(false);
  });

  it('switches between Dean and Chairperson and updates unit selector', async () => {
    render(<CreateLeadershipAccountPage />);

    const chairRadio = screen.getByRole('radio', { name: /Department Chairperson/i });
    fireEvent.click(chairRadio);

    // In Chair mode, Parent College and Academic Program selectors are visible
    expect(screen.getByText(/parent college \*/i)).toBeDefined();
    expect(screen.getByText(/academic program \(no chair\) \*/i)).toBeDefined();
  });

  it('validates required fields before submitting', async () => {
    render(<CreateLeadershipAccountPage />);

    const submitBtn = screen.getByRole('button', { name: /send verification code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Please resolve the errors highlighted below.')).toBeDefined();
      expect(screen.getByText('First name is required.')).toBeDefined();
      expect(screen.getByText('Last name is required.')).toBeDefined();
      expect(screen.getByText('Institutional email is required.')).toBeDefined();
      expect(screen.getByText('ID Number is required.')).toBeDefined();
      expect(screen.getByText('Password is required.')).toBeDefined();
    });
  });

  it('validates email domain and password match', async () => {
    render(<CreateLeadershipAccountPage />);

    // Select college
    const collegeSelect = screen.getByRole('combobox');
    fireEvent.change(collegeSelect, { target: { value: 'col-coe' } });

    fireEvent.change(screen.getByLabelText(/first name \*/i), { target: { value: 'Marie' } });
    fireEvent.change(screen.getByLabelText(/last name \*/i), { target: { value: 'Curie' } });
    fireEvent.change(screen.getByLabelText(/institutional email \*/i), {
      target: { value: 'marie.curie@gmail.com' }, // Invalid domain
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '1099' } });
    fireEvent.change(screen.getByLabelText(/^account password \*/i), {
      target: { value: 'SecurePass123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password \*/i), {
      target: { value: 'DifferentPass' },
    });

    const submitBtn = screen.getByRole('button', { name: /send verification code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Institutional email must end with @dmmmsu.edu.ph.')
      ).toBeDefined();
      expect(screen.getByText('Passwords do not match.')).toBeDefined();
    });
  });

  it('dispatches 6-digit code and transitions to verification step', async () => {
    render(<CreateLeadershipAccountPage />);

    // Select unassigned college
    const collegeSelect = screen.getByRole('combobox');
    fireEvent.change(collegeSelect, { target: { value: 'col-coe' } });

    fireEvent.change(screen.getByLabelText(/first name \*/i), { target: { value: 'Marie' } });
    fireEvent.change(screen.getByLabelText(/last name \*/i), { target: { value: 'Curie' } });
    fireEvent.change(screen.getByLabelText(/institutional email \*/i), {
      target: { value: 'mcurie@dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '1099' } });
    fireEvent.change(screen.getByLabelText(/^account password \*/i), {
      target: { value: 'SecurePass123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password \*/i), {
      target: { value: 'SecurePass123' },
    });

    const submitBtn = screen.getByRole('button', { name: /send verification code/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSendLeadershipCodeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'mcurie@dmmmsu.edu.ph',
          recipientName: 'Marie Curie',
          roleType: 'dean',
          unitName: 'College of Engineering',
          code: expect.stringMatching(/^\d{6}$/),
        })
      );
      expect(screen.getByText('Verify Leadership Appointment')).toBeDefined();
      expect(screen.getByText('Marie Curie')).toBeDefined();
      expect(screen.getByText('mcurie@dmmmsu.edu.ph')).toBeDefined();
    });

    // Check dev hint badge
    const devHint = screen.getByTestId('dev-verification-code');
    expect(devHint).toBeDefined();
  });

  it('rejects invalid verification code and accepts correct 6-digit code to finalize appointment', async () => {
    render(<CreateLeadershipAccountPage />);

    // Fill valid form
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'col-coe' } });
    fireEvent.change(screen.getByLabelText(/first name \*/i), { target: { value: 'Marie' } });
    fireEvent.change(screen.getByLabelText(/last name \*/i), { target: { value: 'Curie' } });
    fireEvent.change(screen.getByLabelText(/institutional email \*/i), {
      target: { value: 'mcurie@dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '1099' } });
    fireEvent.change(screen.getByLabelText(/^account password \*/i), {
      target: { value: 'SecurePass123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password \*/i), {
      target: { value: 'SecurePass123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

    await waitFor(() => {
      expect(screen.getByText('Verify Leadership Appointment')).toBeDefined();
    });

    // Extract the generated 6-digit code from the dev hint or mock call
    const sentCode = mockSendLeadershipCodeEmail.mock.calls[0][0].code;
    expect(sentCode).toHaveLength(6);

    const digitInputs = screen.getAllByRole('textbox').slice(0, 6);
    expect(digitInputs).toHaveLength(6);

    // Enter wrong code first
    const wrongDigits = '999999'.split('');
    wrongDigits.forEach((d, idx) => {
      fireEvent.change(digitInputs[idx], { target: { value: d } });
    });

    const verifyBtn = screen.getByRole('button', { name: /verify & appoint leader/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Invalid verification code. Please check the code received by the incoming leader.'
        )
      ).toBeDefined();
    });

    // Enter correct code
    const correctDigits = sentCode.split('');
    correctDigits.forEach((d, idx) => {
      fireEvent.change(digitInputs[idx], { target: { value: d } });
    });

    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Marie',
          lastName: 'Curie',
          name: 'Marie Curie',
          email: 'mcurie@dmmmsu.edu.ph',
          studentId: '1099',
          role: 'admin',
          adminSubrole: 'dean',
          collegeId: 'col-coe',
          collegeName: 'College of Engineering',
          title: 'College Dean',
          emailVerified: true,
          verificationStatus: 'verified',
        })
      );
      expect(mockAppointLeadership).toHaveBeenCalledWith('dean', 'new-user-123', 'col-coe');
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Leadership Account Created',
          type: 'success',
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/accounts');
    });
  });

  it('pre-fills role and unit from query parameters', () => {
    mockSearchParams = new URLSearchParams('role=chairperson&departmentId=dept-it');

    render(<CreateLeadershipAccountPage />);

    // Chairperson radio should be checked
    const chairRadio = screen.getByRole('radio', { name: /Department Chairperson/i }) as HTMLInputElement;
    expect(chairRadio.checked).toBe(true);

    // Program selector should have 'dept-it' preselected
    const programSelect = screen.getByLabelText(/academic program/i) as HTMLSelectElement;
    expect(programSelect.value).toBe('dept-it');
  });
});
