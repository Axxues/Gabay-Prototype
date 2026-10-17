// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { ManageAccountsPage } from './ManageAccountsPage';
import { AcademicGovernancePage } from './AcademicGovernancePage';
import type { User, College, Department, PendingRegistration } from '../../shared/types/lms';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mocks = vi.hoisted(() => ({
  verifyRegistration: vi.fn(),
  rejectRegistration: vi.fn(),
  transferLeadership: vi.fn(),
  addCollege: vi.fn(),
  addDepartment: vi.fn(),
  deleteUser: vi.fn(),
  showAlert: vi.fn(),
  setIsRoleModalOpen: vi.fn(),
  logout: vi.fn(),
  mockState: {
    activeRole: 'admin',
    activeUser: {
      id: 'admin-1',
      name: 'Dr. Dean',
      email: 'dean@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'College of Computer Science',
      title: 'College Dean',
      avatar: '',
    } as User,
    pendingRegistrations: [] as PendingRegistration[],
    colleges: [
      { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'admin-1' },
      { id: 'col-coe', name: 'College of Education', code: 'COED', deanId: 'dean-coe' },
    ] as College[],
    departments: [
      { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS', chairpersonId: 'chair-cs' },
      { id: 'dept-it', collegeId: 'col-ccs', name: 'Department of Information Technology', code: 'IT', chairpersonId: 'chair-it' },
      { id: 'dept-elem', collegeId: 'col-coe', name: 'Department of Elementary Education', code: 'ELED', chairpersonId: 'chair-elem' },
    ] as Department[],
    db: {
      users: [
        {
          id: 'admin-1',
          name: 'Dr. Dean',
          email: 'dean@dmmmsu.edu.ph',
          role: 'admin',
          adminSubrole: 'dean',
          collegeId: 'col-ccs',
          collegeName: 'College of Computer Science',
          department: 'College of Computer Science',
          title: 'College Dean',
          avatar: '',
        },
        {
          id: 'fac-1',
          name: 'Prof. Alice Rivera',
          email: 'alice@dmmmsu.edu.ph',
          role: 'faculty',
          collegeId: 'col-ccs',
          collegeName: 'College of Computer Science',
          department: 'Department of Computer Science',
          title: 'Associate Professor',
          avatar: '',
        },
        {
          id: 'fac-2',
          name: 'Prof. Bob Jones',
          email: 'bob@dmmmsu.edu.ph',
          role: 'faculty',
          collegeId: 'col-coe',
          collegeName: 'College of Education',
          department: 'Department of Elementary Education',
          title: 'Assistant Professor',
          avatar: '',
        },
      ] as User[],
      courses: [],
    },
  },
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.mockState.activeRole,
    activeUser: mocks.mockState.activeUser,
    pendingRegistrations: mocks.mockState.pendingRegistrations,
    colleges: mocks.mockState.colleges,
    departments: mocks.mockState.departments,
    db: mocks.mockState.db,
    verifyRegistration: mocks.verifyRegistration,
    rejectRegistration: mocks.rejectRegistration,
    transferLeadership: mocks.transferLeadership,
    addCollege: mocks.addCollege,
    addDepartment: mocks.addDepartment,
    deleteUser: mocks.deleteUser,
    showAlert: mocks.showAlert,
    setIsRoleModalOpen: mocks.setIsRoleModalOpen,
    logout: mocks.logout,
  }),
}));

describe('ManageAccountsPage RBAC & Verification Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockState.activeRole = 'admin';
    mocks.mockState.activeUser = {
      id: 'admin-1',
      name: 'Dr. Dean',
      email: 'dean@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'College of Computer Science',
      title: 'College Dean',
      avatar: '',
    };
    mocks.mockState.pendingRegistrations = [];
  });

  it('1. verifies "Create new account" button is absent for all users', () => {
    // Check as admin
    const { unmount } = render(<ManageAccountsPage />);
    expect(screen.queryByRole('button', { name: /create new account/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/create new account/i)).not.toBeInTheDocument();
    unmount();

    // Check as superadmin
    mocks.mockState.activeRole = 'superadmin';
    mocks.mockState.activeUser = {
      ...mocks.mockState.activeUser,
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };
    render(<ManageAccountsPage />);
    expect(screen.queryByRole('button', { name: /create new account/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/create new account/i)).not.toBeInTheDocument();
  });

  it('2. verifies "Verification Queue" tab displays pending applicants with "Expires in X days" badge', () => {
    const futureDate = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
    mocks.mockState.pendingRegistrations = [
      {
        id: 'reg-1',
        firstName: 'Maria',
        lastName: 'Santos',
        fullName: 'Maria Santos',
        email: 'maria.santos@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        collegeName: 'College of Computer Science',
        department: 'Department of Computer Science',
        studentId: '2026-10001',
        password: 'hashedpassword',
        emailVerified: true,
        activationToken: 'token-1',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
    ];

    render(<ManageAccountsPage />);

    // Click "Pending Verifications" or "Verification Queue" tab
    const queueTab = screen.getByRole('tab', { name: /pending verifications|verification queue/i });
    fireEvent.click(queueTab);

    // Verify applicant information is displayed
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('maria.santos@dmmmsu.edu.ph')).toBeInTheDocument();
    expect(screen.getByText(/expires in 25 days/i)).toBeInTheDocument();
  });

  it('2b. displays all pending applicants but disables verify button for accounts with unverified email', () => {
    const futureDate = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
    mocks.mockState.pendingRegistrations = [
      {
        id: 'reg-unverified',
        firstName: 'Unverified',
        lastName: 'Applicant',
        fullName: 'Unverified Applicant',
        email: 'unverified@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        collegeName: 'College of Computer Science',
        department: 'Department of Computer Science',
        studentId: '2026-99999',
        password: 'pw',
        emailVerified: false,
        activationToken: 'token-unverified',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
      {
        id: 'reg-verified',
        firstName: 'Verified',
        lastName: 'Applicant',
        fullName: 'Verified Applicant',
        email: 'verified@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        collegeName: 'College of Computer Science',
        department: 'Department of Computer Science',
        studentId: '2026-88888',
        password: 'pw',
        emailVerified: true,
        activationToken: 'token-verified',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
    ];

    render(<ManageAccountsPage />);

    const queueTab = screen.getByRole('tab', { name: /pending verifications|verification queue/i });
    fireEvent.click(queueTab);

    // Both applicants MUST be in the document
    expect(screen.getByText('Verified Applicant')).toBeInTheDocument();
    expect(screen.getByText('verified@dmmmsu.edu.ph')).toBeInTheDocument();
    expect(screen.getByText('Unverified Applicant')).toBeInTheDocument();
    expect(screen.getByText('unverified@dmmmsu.edu.ph')).toBeInTheDocument();

    // Verification button for verified applicant is enabled
    const verifiedRow = screen.getByText('Verified Applicant').closest('tr')!;
    expect(within(verifiedRow).getByText(/email verified/i)).toBeInTheDocument();
    const verifiedVerifyBtn = within(verifiedRow).getByRole('button', { name: /verify/i });
    expect(verifiedVerifyBtn).not.toBeDisabled();

    // Verification button for unverified applicant is disabled
    const unverifiedRow = screen.getByText('Unverified Applicant').closest('tr')!;
    expect(within(unverifiedRow).getByText(/email unverified/i)).toBeInTheDocument();
    const unverifiedVerifyBtn = within(unverifiedRow).getByRole('button', { name: /verify/i });
    expect(unverifiedVerifyBtn).toBeDisabled();

    // Reject button is still accessible for administrative cleanup
    const unverifiedRejectBtn = within(unverifiedRow).getByRole('button', { name: /reject/i });
    expect(unverifiedRejectBtn).not.toBeDisabled();
  });

  it('3. verifies Chairperson only sees pending applicants from their department', () => {
    mocks.mockState.activeRole = 'admin';
    mocks.mockState.activeUser = {
      id: 'chair-cs',
      name: 'Dr. CS Chair',
      email: 'chair.cs@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'chairperson',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      title: 'Department Chairperson',
      avatar: '',
    };

    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    mocks.mockState.pendingRegistrations = [
      {
        id: 'reg-cs',
        firstName: 'Alice',
        lastName: 'CS',
        fullName: 'Alice CS Student',
        email: 'alice.cs@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        collegeName: 'College of Computer Science',
        department: 'Department of Computer Science',
        studentId: '2026-0001',
        password: 'pw',
        emailVerified: true,
        activationToken: 'tok-1',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
      {
        id: 'reg-it',
        firstName: 'Bob',
        lastName: 'IT',
        fullName: 'Bob IT Student',
        email: 'bob.it@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        collegeName: 'College of Computer Science',
        department: 'Department of Information Technology',
        studentId: '2026-0002',
        password: 'pw',
        emailVerified: true,
        activationToken: 'tok-2',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
      {
        id: 'reg-elem',
        firstName: 'Charlie',
        lastName: 'Elem',
        fullName: 'Charlie Elem Student',
        email: 'charlie.elem@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-coe',
        collegeName: 'College of Education',
        department: 'Department of Elementary Education',
        studentId: '2026-0003',
        password: 'pw',
        emailVerified: true,
        activationToken: 'tok-3',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
    ];

    render(<ManageAccountsPage />);
    const queueTab = screen.getByRole('tab', { name: /pending verifications|verification queue/i });
    fireEvent.click(queueTab);

    expect(screen.getByText('Alice CS Student')).toBeInTheDocument();
    expect(screen.queryByText('Bob IT Student')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Elem Student')).not.toBeInTheDocument();
  });

  it('4. verifies Dean sees pending applicants across the college', () => {
    mocks.mockState.activeRole = 'admin';
    mocks.mockState.activeUser = {
      id: 'admin-1',
      name: 'Dr. Dean',
      email: 'dean@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'College of Computer Science',
      title: 'College Dean',
      avatar: '',
    };

    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    mocks.mockState.pendingRegistrations = [
      {
        id: 'reg-cs',
        firstName: 'Alice',
        lastName: 'CS',
        fullName: 'Alice CS Student',
        email: 'alice.cs@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        collegeName: 'College of Computer Science',
        department: 'Department of Computer Science',
        studentId: '2026-0001',
        password: 'pw',
        emailVerified: true,
        activationToken: 'tok-1',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
      {
        id: 'reg-it',
        firstName: 'Bob',
        lastName: 'IT',
        fullName: 'Bob IT Student',
        email: 'bob.it@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        collegeName: 'College of Computer Science',
        department: 'Department of Information Technology',
        studentId: '2026-0002',
        password: 'pw',
        emailVerified: true,
        activationToken: 'tok-2',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
      {
        id: 'reg-elem',
        firstName: 'Charlie',
        lastName: 'Elem',
        fullName: 'Charlie Elem Student',
        email: 'charlie.elem@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-coe',
        collegeName: 'College of Education',
        department: 'Department of Elementary Education',
        studentId: '2026-0003',
        password: 'pw',
        emailVerified: true,
        activationToken: 'tok-3',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
    ];

    render(<ManageAccountsPage />);
    const queueTab = screen.getByRole('tab', { name: /pending verifications|verification queue/i });
    fireEvent.click(queueTab);

    // Both CCS students should be visible to Dean of CCS
    expect(screen.getByText('Alice CS Student')).toBeInTheDocument();
    expect(screen.getByText('Bob IT Student')).toBeInTheDocument();
    // Education college student should NOT be visible
    expect(screen.queryByText('Charlie Elem Student')).not.toBeInTheDocument();
  });

  it('5. verifies clicking "Verify" triggers verifyRegistration()', async () => {
    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    mocks.mockState.pendingRegistrations = [
      {
        id: 'reg-to-verify',
        firstName: 'Juan',
        lastName: 'Dela Cruz',
        fullName: 'Juan Dela Cruz',
        email: 'juan.delacruz@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        collegeName: 'College of Computer Science',
        department: 'Department of Computer Science',
        studentId: '2026-77777',
        password: 'pw',
        emailVerified: true,
        activationToken: 'tok-v',
        registeredAt: new Date().toISOString(),
        expiresAt: futureDate,
        status: 'pending',
      },
    ];

    mocks.verifyRegistration.mockResolvedValueOnce({
      success: true,
      message: 'User registration approved and active account created.',
    });

    render(<ManageAccountsPage />);
    const queueTab = screen.getByRole('tab', { name: /pending verifications|verification queue/i });
    fireEvent.click(queueTab);

    const verifyButton = screen.getByRole('button', { name: /verify/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mocks.verifyRegistration).toHaveBeenCalledWith('reg-to-verify');
    });
  });

  it('6. verifies Academic Structure is on dedicated AcademicGovernancePage and removed from ManageAccountsPage', () => {
    // ManageAccountsPage no longer renders embedded Academic Structure tab
    render(<ManageAccountsPage />);
    expect(screen.queryByRole('tab', { name: /academic structure/i })).not.toBeInTheDocument();

    // AcademicGovernancePage renders the Academic Structure console
    const { unmount: unmountGov } = render(<AcademicGovernancePage />);
    expect(screen.getByText(/Academic Structure & Multi-College Governance/i)).toBeInTheDocument();
    unmountGov();
  });

  it('7. verifies Leadership Handover modal allows selecting an eligible faculty member and calling transferLeadership() on AcademicGovernancePage', async () => {
    mocks.mockState.activeRole = 'admin';
    mocks.mockState.activeUser = {
      id: 'admin-1',
      name: 'Dr. Dean',
      email: 'dean@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'College of Computer Science',
      title: 'College Dean',
      avatar: '',
    };

    mocks.transferLeadership.mockResolvedValueOnce({
      success: true,
      message: 'Leadership transferred successfully to Dean successor.',
    });

    render(<AcademicGovernancePage />);

    // Click "Transfer Leadership" button
    const transferBtn = screen.getByRole('button', { name: /transfer leadership/i });
    fireEvent.click(transferBtn);

    // Modal should be open, showing current role
    expect(screen.getByText(/dean of college of computer science/i)).toBeInTheDocument();

    // Eligible faculty dropdown should contain Prof. Alice Rivera, but not Prof. Bob Jones (who is from COE)
    const selectSuccessor = screen.getByLabelText(/select successor|eligible faculty/i);
    expect(selectSuccessor).toBeInTheDocument();

    fireEvent.change(selectSuccessor, { target: { value: 'fac-1' } });

    // Review transfer / confirm step
    const proceedBtn = screen.getByRole('button', { name: /proceed|review|transfer authority/i });
    fireEvent.click(proceedBtn);

    // Invariant confirmation text should be present
    expect(
      screen.getByText(
        /You will step down to regular Faculty and transfer administrative authority to Prof\. Alice Rivera\. Exactly 1 leader is permitted\./i
      )
    ).toBeInTheDocument();

    // Confirm button
    const confirmBtn = screen.getByRole('button', { name: /confirm leadership transfer|confirm handover/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mocks.transferLeadership).toHaveBeenCalledWith('dean', 'admin-1', 'fac-1', 'col-ccs');
    });
  });

  it('8. displays Dean and Chair badges for admin(dean) and admin(chair) accounts in directory table', () => {
    mocks.mockState.activeRole = 'superadmin';
    mocks.mockState.activeUser = {
      id: 'chancellor-1',
      name: 'Chancellor Jayvee',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };
    mocks.mockState.db.users = [
      {
        id: 'user-dean',
        name: 'Eleanor Vance',
        email: 'dean1@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'dean',
        collegeId: 'col-ccs',
        department: 'College of Computer Science',
        title: 'College Dean',
      },
      {
        id: 'user-chair',
        name: 'Marcus Brody',
        email: 'chair1@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'chairperson',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
        title: 'Department Chairperson',
      },
      {
        id: 'user-fac',
        name: 'Faculty User',
        email: 'fac@dmmmsu.edu.ph',
        role: 'faculty',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
        title: 'Instructor',
      },
    ];

    render(<ManageAccountsPage />);

    // Row for Eleanor Vance should display "Dean"
    const deanRow = screen.getByText('Eleanor Vance').closest('tr');
    expect(within(deanRow!).getByText('Dean')).toBeInTheDocument();
    expect(within(deanRow!).queryByText('Admin')).not.toBeInTheDocument();

    // Row for Marcus Brody should display "Chair"
    const chairRow = screen.getByText('Marcus Brody').closest('tr');
    expect(within(chairRow!).getByText('Chair')).toBeInTheDocument();
    expect(within(chairRow!).queryByText('Admin')).not.toBeInTheDocument();

    // Row for Faculty should display "Faculty"
    const facRow = screen.getByText('Faculty User').closest('tr');
    expect(within(facRow!).getByText('Faculty')).toBeInTheDocument();
  });

  it('9. sorts directory table accounts strictly by authority hierarchy: admin, dean, chair, faculty, staff, student', () => {
    mocks.mockState.activeRole = 'superadmin';
    mocks.mockState.activeUser = {
      id: 'admin-1',
      name: 'Jayvee Admin',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };
    mocks.mockState.db.users = [
      {
        id: 'u-stu',
        name: 'Dup Student',
        email: 'dup@dmmmsu.edu.ph',
        role: 'student',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
      },
      {
        id: 'u-chair',
        name: 'Brody Chair',
        email: 'chair@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'chairperson',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
      },
      {
        id: 'u-staff',
        name: 'Staff Aide',
        email: 'staff@dmmmsu.edu.ph',
        role: 'staff',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
      },
      {
        id: 'u-dean',
        name: 'Eleanor Dean',
        email: 'dean@dmmmsu.edu.ph',
        role: 'admin',
        adminSubrole: 'dean',
        collegeId: 'col-ccs',
        department: 'College of Computer Science',
      },
      {
        id: 'u-fac',
        name: 'Prof Evelyn',
        email: 'evelyn@dmmmsu.edu.ph',
        role: 'faculty',
        collegeId: 'col-ccs',
        department: 'Department of Computer Science',
      },
      {
        id: 'u-admin',
        name: 'Jayvee Admin',
        email: 'jayvee@dmmmsu.edu.ph',
        role: 'superadmin',
        adminSubrole: 'chancellor',
        collegeId: 'col-ccs',
        department: 'College of Information Technology',
      },
    ];

    render(<ManageAccountsPage />);

    const rows = screen.getAllByRole('row').slice(1);
    const renderedNames = rows.map(r => {
      const match = within(r).queryByText(/Jayvee Admin|Eleanor Dean|Brody Chair|Prof Evelyn|Staff Aide|Dup Student/);
      return match ? match.textContent : '';
    }).filter(Boolean);

    expect(renderedNames).toEqual([
      expect.stringContaining('Jayvee Admin'),
      expect.stringContaining('Eleanor Dean'),
      expect.stringContaining('Brody Chair'),
      expect.stringContaining('Prof Evelyn'),
      expect.stringContaining('Staff Aide'),
      expect.stringContaining('Dup Student'),
    ]);
  });
});
