// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

  it('omits the card brand block and the role descriptions', () => {
    render(<CreateLeadershipAccountPage />);

    expect(screen.queryByAltText('GABAY logo')).toBeNull();
    expect(screen.queryByText('Leadership Appointment Portal')).toBeNull();
    expect(screen.queryByText(/Enter incoming academic leader details/i)).toBeNull();

    // Role names stay; their explanatory subtitles are removed.
    expect(screen.getByText('College Dean')).toBeDefined();
    expect(screen.getByText('Department Chairperson')).toBeDefined();
    expect(screen.queryByText('Oversees college programs & depts')).toBeNull();
    expect(screen.queryByText('Manages program chair sheet & curriculum')).toBeNull();
  });

  it('fills the available content width instead of a centered narrow column', () => {
    const { container } = render(<CreateLeadershipAccountPage />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).not.toContain('max-w-3xl');
    expect(root.className).not.toContain('mx-auto');
  });

  it('limits the employee ID to four digits', async () => {
    render(<CreateLeadershipAccountPage />);

    const idInput = screen.getByLabelText(/id number/i);
    expect(idInput.getAttribute('placeholder')).toBe('e.g. 1082');
    expect(idInput.getAttribute('maxlength')).toBe('4');

    fireEvent.change(idInput, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /create leadership account/i }));

    await waitFor(() => {
      expect(screen.getByText('ID Number must be exactly 4 digits (e.g. 1082).')).toBeDefined();
    });

    // The student ID format must not be advertised or accepted on this page.
    expect(screen.queryByText(/231-1082-3/)).toBeNull();
  });

  it('does not show the verification code helper text under the email input', () => {
    render(<CreateLeadershipAccountPage />);

    expect(
      screen.queryByText('The 6-digit verification code will be sent to this email.')
    ).toBeNull();
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

    const submitBtn = screen.getByRole('button', { name: /create leadership account/i });
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

    const submitBtn = screen.getByRole('button', { name: /create leadership account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Institutional email must end with @dmmmsu.edu.ph.')
      ).toBeDefined();
      expect(screen.getByText('Passwords do not match.')).toBeDefined();
    });

    // Student subdomain addresses are not valid for leadership accounts.
    fireEvent.change(screen.getByLabelText(/institutional email \*/i), {
      target: { value: 'marie.curie@student.dmmmsu.edu.ph' },
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Institutional email must end with @dmmmsu.edu.ph.')
      ).toBeDefined();
    });
  });

  it('opens confirmation modal with leadership appointment summary without email verification', async () => {
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

    const submitBtn = screen.getByRole('button', { name: /create leadership account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByRole('heading', { name: /confirm leadership appointment/i })).toBeDefined();
      expect(within(modal).getByText('Marie Curie')).toBeDefined();
      expect(within(modal).getByText('mcurie@dmmmsu.edu.ph')).toBeDefined();
      expect(within(modal).getByText('College Dean • College of Engineering')).toBeDefined();
      expect(within(modal).getByText('1099')).toBeDefined();
    });

    // Email dispatch must NOT be triggered
    expect(mockSendLeadershipCodeEmail).not.toHaveBeenCalled();
    // Verification OTP screen must NOT be displayed
    expect(screen.queryByText(/Verify Leadership Appointment/i)).toBeNull();
  });

  it('cancels appointment in confirmation modal without creating user', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /create leadership account/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /confirm leadership appointment/i })).toBeDefined();
    });

    // Click Cancel inside the modal
    const modal = screen.getByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /confirm leadership appointment/i })).toBeNull();
    });

    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockAppointLeadership).not.toHaveBeenCalled();
  });

  it('confirms appointment in confirmation modal and provisions leadership account without email verification', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: /create leadership account/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /confirm leadership appointment/i })).toBeDefined();
    });

    // Confirm in modal
    const modal = screen.getByRole('dialog');
    const confirmBtn = within(modal).getByRole('button', { name: /confirm & create account/i });
    fireEvent.click(confirmBtn);

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

    // Ensure no email code was sent
    expect(mockSendLeadershipCodeEmail).not.toHaveBeenCalled();
  });

  it('confirms chairperson appointment in confirmation modal and provisions chairperson', async () => {
    mockSearchParams = new URLSearchParams('role=chairperson&collegeId=col-ccs&departmentId=dept-it');

    render(<CreateLeadershipAccountPage />);

    fireEvent.change(screen.getByLabelText(/first name \*/i), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByLabelText(/last name \*/i), { target: { value: 'Hopper' } });
    fireEvent.change(screen.getByLabelText(/institutional email \*/i), {
      target: { value: 'ghopper@dmmmsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/id number/i), { target: { value: '1042' } });
    fireEvent.change(screen.getByLabelText(/^account password \*/i), {
      target: { value: 'SecurePass123' },
    });
    fireEvent.change(screen.getByLabelText(/confirm password \*/i), {
      target: { value: 'SecurePass123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create leadership account/i }));

    await waitFor(() => {
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByRole('heading', { name: /confirm leadership appointment/i })).toBeDefined();
      expect(within(modal).getByText('Grace Hopper')).toBeDefined();
      expect(within(modal).getByText(/Department Chairperson • Information Technology/i)).toBeDefined();
    });

    const modal = screen.getByRole('dialog');
    const confirmBtn = within(modal).getByRole('button', { name: /confirm & create account/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Grace',
          lastName: 'Hopper',
          name: 'Grace Hopper',
          email: 'ghopper@dmmmsu.edu.ph',
          studentId: '1042',
          role: 'admin',
          adminSubrole: 'chairperson',
          collegeId: 'col-ccs',
          collegeName: 'College of Computer Science',
          department: 'Information Technology',
          program: 'Information Technology',
          title: 'Program Chairperson',
          emailVerified: true,
          verificationStatus: 'verified',
        })
      );
      expect(mockAppointLeadership).toHaveBeenCalledWith('chairperson', 'new-user-123', 'dept-it');
      expect(mockShowAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Leadership Account Created',
          type: 'success',
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/accounts');
    });

    expect(mockSendLeadershipCodeEmail).not.toHaveBeenCalled();
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
