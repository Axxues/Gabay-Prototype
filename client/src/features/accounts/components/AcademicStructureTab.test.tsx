// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import React from 'react';
import type { College, Department, User } from '../../../shared/types/lms';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAddCollege = vi.fn().mockResolvedValue({ id: 'col-new', name: 'New Col', code: 'NC' });
const mockAddDepartment = vi.fn().mockResolvedValue({ id: 'dept-new', collegeId: 'col-cet', name: 'New Dept', code: 'ND' });
const mockTransferLeadership = vi.fn().mockResolvedValue({ success: true, message: 'Leadership appointed' });
const mockDeleteCollege = vi.fn().mockResolvedValue({ success: true, message: 'College deleted' });
const mockDeleteDepartment = vi.fn().mockResolvedValue({ success: true, message: 'Department deleted' });
const mockGetCollegeDeleteBlockers = vi.fn().mockReturnValue([]);
const mockGetDepartmentDeleteBlockers = vi.fn().mockReturnValue([]);
const mockShowAlert = vi.fn();

let mockActiveRole: string = 'superadmin';
let mockActiveUser: Partial<User> = {
  id: 'u-chancellor',
  name: 'Dr. Chancellor',
  email: 'chancellor@dmmmsu.edu.ph',
  role: 'superadmin',
  adminSubrole: 'chancellor',
};

const sampleColleges: College[] = [
  {
    id: 'col-cet',
    name: 'College of Engineering and Technology',
    code: 'CET',
    deanId: 'u-dean-cet',
  },
  {
    id: 'col-cas',
    name: 'College of Arts and Sciences',
    code: 'CAS',
    deanId: 'u-dean-cas',
  },
];

const sampleDepartments: Department[] = [
  {
    id: 'dept-it',
    collegeId: 'col-cet',
    name: 'Information Technology',
    code: 'IT',
    chairpersonId: 'u-chair-it',
  },
  {
    id: 'dept-ce',
    collegeId: 'col-cet',
    name: 'Civil Engineering',
    code: 'CE',
  },
  {
    id: 'dept-bio',
    collegeId: 'col-cas',
    name: 'Biological Sciences',
    code: 'BIO',
    chairpersonId: 'u-chair-bio',
  },
];

const sampleUsers: User[] = [
  {
    id: 'u-chancellor',
    name: 'Dr. Chancellor',
    email: 'chancellor@dmmmsu.edu.ph',
    role: 'superadmin',
    adminSubrole: 'chancellor',
    department: 'Office of the Chancellor',
    avatar: '',
    title: 'University Chancellor',
  },
  {
    id: 'u-dean-cet',
    name: 'Dean Alice CET',
    email: 'alice.cet@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    collegeId: 'col-cet',
    collegeName: 'College of Engineering and Technology',
    department: 'CET Admin',
    avatar: '',
    title: 'Dean',
  },
  {
    id: 'u-dean-cas',
    name: 'Dean Bob CAS',
    email: 'bob.cas@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    collegeId: 'col-cas',
    collegeName: 'College of Arts and Sciences',
    department: 'CAS Admin',
    avatar: '',
    title: 'Dean',
  },
  {
    id: 'u-chair-it',
    name: 'Prof. Charlie IT',
    email: 'charlie.it@dmmmsu.edu.ph',
    role: 'faculty',
    collegeId: 'col-cet',
    collegeName: 'College of Engineering and Technology',
    department: 'Information Technology',
    avatar: '',
    title: 'Department Chair',
  },
  {
    id: 'u-fac-cet',
    name: 'Prof. Diana CET',
    email: 'diana.cet@dmmmsu.edu.ph',
    role: 'faculty',
    collegeId: 'col-cet',
    collegeName: 'College of Engineering and Technology',
    department: 'Information Technology',
    avatar: '',
    title: 'Faculty',
  },
  {
    id: 'u-chair-bio',
    name: 'Prof. Evan CAS',
    email: 'evan.cas@dmmmsu.edu.ph',
    role: 'faculty',
    collegeId: 'col-cas',
    collegeName: 'College of Arts and Sciences',
    department: 'Biological Sciences',
    avatar: '',
    title: 'Department Chair',
  },
  {
    id: 'u-fac-cas',
    name: 'Prof. Fiona CAS',
    email: 'fiona.cas@dmmmsu.edu.ph',
    role: 'faculty',
    collegeId: 'col-cas',
    collegeName: 'College of Arts and Sciences',
    department: 'Biological Sciences',
    avatar: '',
    title: 'Faculty',
  },
  {
    id: 'u-stu-1',
    name: 'Sam Student',
    email: 'sam@dmmmsu.edu.ph',
    role: 'student',
    collegeId: 'col-cet',
    department: 'Information Technology',
    avatar: '',
    title: 'Student',
  },
];

vi.mock('../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    colleges: sampleColleges,
    departments: sampleDepartments,
    addCollege: mockAddCollege,
    addDepartment: mockAddDepartment,
    transferLeadership: mockTransferLeadership,
    deleteCollege: mockDeleteCollege,
    deleteDepartment: mockDeleteDepartment,
    getCollegeDeleteBlockers: mockGetCollegeDeleteBlockers,
    getDepartmentDeleteBlockers: mockGetDepartmentDeleteBlockers,
    db: {
      users: sampleUsers,
    },
    showAlert: mockShowAlert,
    activeRole: mockActiveRole,
    activeUser: mockActiveUser,
  }),
}));

import { AcademicStructureTab } from './AcademicStructureTab';

describe('AcademicStructureTab Scoping and Leader Appointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteCollege.mockResolvedValue({ success: true, message: 'College deleted' });
    mockDeleteDepartment.mockResolvedValue({ success: true, message: 'Department deleted' });
    mockGetCollegeDeleteBlockers.mockReturnValue([]);
    mockGetDepartmentDeleteBlockers.mockReturnValue([]);
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };
  });

  test('1. Chancellor view displays + Add College, all colleges, and verifies "Reassign" button is removed', () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };

    render(<AcademicStructureTab />);

    // Chancellor sees + Add College and + Add Program
    expect(screen.getByRole('button', { name: /add college/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add (department|program)/i })).toBeInTheDocument();

    // Chancellor sees all colleges
    expect(screen.getByText('College of Engineering and Technology')).toBeInTheDocument();
    expect(screen.getByText('College of Arts and Sciences')).toBeInTheDocument();

    // Reassign feature has been completely removed per institutional policy
    expect(screen.queryByRole('button', { name: /reassign/i })).not.toBeInTheDocument();
  });

  test('2. Dean view hides + Add College, shows only the Dean\'s college, hides "Reassign" on the Dean card, and locks + Add Department to their college', () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-dean-cet',
      name: 'Dean Alice CET',
      email: 'alice.cet@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-cet',
      collegeName: 'College of Engineering and Technology',
    };

    render(<AcademicStructureTab />);

    // Dean cannot see + Add College
    expect(screen.queryByRole('button', { name: /add college/i })).not.toBeInTheDocument();

    // Dean sees + Add Program
    const addDeptBtn = screen.getByRole('button', { name: /add (department|program)/i });
    expect(addDeptBtn).toBeInTheDocument();

    // Shows only Dean's college
    expect(screen.getByText('College of Engineering and Technology')).toBeInTheDocument();
    expect(screen.queryByText('College of Arts and Sciences')).not.toBeInTheDocument();

    // Dean card shows the sitting dean (the "(Current Dean)" badge has been removed)
    expect(screen.getByText('Dean Alice CET')).toBeInTheDocument();
    expect(screen.queryByText(/\(Current Dean\)/i)).not.toBeInTheDocument();

    // Dean card hides Reassign for the Dean, and department rows no longer expose a chair Reassign
    // (chair reassignment lives on the department details page instead)
    expect(screen.queryByRole('button', { name: /reassign/i })).not.toBeInTheDocument();

    // Click + Add Department to open modal
    fireEvent.click(addDeptBtn);

    // Parent college select is locked to Dean's college
    const collegeSelect = screen.getByLabelText(/select parent college/i) as HTMLSelectElement;
    expect(collegeSelect).toBeDisabled();
    expect(collegeSelect.value).toBe('col-cet');
  });

  test('3. Appointing a chair navigates to dedicated Create Leadership Account page', () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-dean-cet',
      name: 'Dean Alice CET',
      email: 'alice.cet@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-cet',
      collegeName: 'College of Engineering and Technology',
    };

    render(<AcademicStructureTab />);

    // Expand college first since colleges are minimized by default
    fireEvent.click(screen.getByRole('button', { name: /toggle (departments|programs) for college of engineering and technology/i }));

    // Civil Engineering has no sitting chairperson, so it exposes the Appoint action
    const appointChairBtn = screen.getByRole('button', { name: /^appoint$/i });
    fireEvent.click(appointChairBtn);

    // Appoint navigates to the dedicated create-leadership page prefilling role and IDs
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/accounts/create-leadership?role=chairperson&departmentId=dept-ce&collegeId=col-cet')
    );
  });

  test('4. Create College modal submits with initialDeanId', async () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };

    render(<AcademicStructureTab />);

    // Open Add College modal
    fireEvent.click(screen.getByRole('button', { name: /add college/i }));
    expect(screen.getByText('Add New Academic College')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/college name/i), {
      target: { value: 'College of Medicine' },
    });
    fireEvent.change(screen.getByLabelText(/college code/i), {
      target: { value: 'COM' },
    });

    // Select Initial Dean
    const deanSelect = screen.getByLabelText(/initial dean/i) as HTMLSelectElement;
    expect(deanSelect).toBeInTheDocument();
    fireEvent.change(deanSelect, { target: { value: 'u-fac-cet' } });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /create college/i }));
    });

    expect(mockAddCollege).toHaveBeenCalledTimes(1);
    expect(mockAddCollege).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'College of Medicine',
        code: 'COM',
      }),
      'u-fac-cet'
    );
  });

  test('5. Add Department modal submits with initialChairId', async () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-dean-cet',
      name: 'Dean Alice CET',
      email: 'alice.cet@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-cet',
      collegeName: 'College of Engineering and Technology',
    };

    render(<AcademicStructureTab />);

    // Open Add Program modal
    fireEvent.click(screen.getByRole('button', { name: /add (department|program)/i }));
    expect(screen.getByText(/Add Academic (Department|Program)/i)).toBeInTheDocument();

    // Parent college should be locked to CET
    const parentSelect = screen.getByLabelText(/select parent college/i) as HTMLSelectElement;
    expect(parentSelect).toBeDisabled();
    expect(parentSelect.value).toBe('col-cet');

    // Fill program name and code
    fireEvent.change(screen.getByLabelText(/(department|program) name/i), {
      target: { value: 'Software Engineering' },
    });
    fireEvent.change(screen.getByLabelText(/(department|program) code/i), {
      target: { value: 'SE' },
    });

    // Initial Chairperson select (scoped to CET faculty for Dean)
    const chairSelect = screen.getByLabelText(/initial chairperson/i) as HTMLSelectElement;
    expect(chairSelect).toBeInTheDocument();

    // Check options scoped
    const optionValues = Array.from(chairSelect.options).map(o => o.value);
    expect(optionValues).toContain('u-fac-cet');
    expect(optionValues).not.toContain('u-fac-cas'); // CAS faculty should NOT be listed

    // Select Diana as initial chair
    fireEvent.change(chairSelect, { target: { value: 'u-fac-cet' } });

    // Submit
    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /add (department|program)/i }));
    });

    expect(mockAddDepartment).toHaveBeenCalledTimes(1);
    expect(mockAddDepartment).toHaveBeenCalledWith(
      expect.objectContaining({
        collegeId: 'col-cet',
        name: 'Software Engineering',
        code: 'SE',
      }),
      'u-fac-cet'
    );
  });

  test('5b. Add Program modal defaults the parent college to the placeholder, not the first college', () => {
    render(<AcademicStructureTab />);

    fireEvent.click(screen.getByRole('button', { name: /add (department|program)/i }));
    expect(screen.getByText(/Add Academic (Department|Program)/i)).toBeInTheDocument();

    const parentSelect = screen.getByLabelText(/select parent college/i) as HTMLSelectElement;

    // "Select College..." is the default selection rather than the first college
    expect(parentSelect.value).toBe('');
    expect(parentSelect.selectedIndex).toBe(0);
    expect(parentSelect.options[0].textContent).toMatch(/select college/i);

    // Colleges are still offered once the user opens the list
    expect(parentSelect.options.length).toBeGreaterThan(1);
  });

  test('6. clicking the college card header toggles departments without needing the arrow', () => {
    render(<AcademicStructureTab />);

    const cetHeader = screen.getByRole('button', {
      name: /toggle (departments|programs) for college of engineering and technology/i,
    });
    // Minimized by default
    expect(cetHeader).toHaveAttribute('aria-expanded', 'false');

    // Click the card's title (not the chevron) to expand
    fireEvent.click(screen.getByText('College of Engineering and Technology'));

    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(cetHeader).toHaveAttribute('aria-expanded', 'true');

    // Click the card again to collapse
    fireEvent.click(screen.getByText('College of Engineering and Technology'));

    expect(cetHeader).toHaveAttribute('aria-expanded', 'false');
  });

  test('7. clicking an action inside an unappointed program navigates to create-leadership and does not collapse the college', () => {
    render(<AcademicStructureTab />);

    const cetHeader = screen.getByRole('button', {
      name: /toggle (departments|programs) for college of engineering and technology/i,
    });
    // Expand first since minimized by default
    fireEvent.click(cetHeader);

    // Appoint button on Civil Engineering (unassigned chair)
    const appointBtn = screen.getByRole('button', { name: /^appoint$/i });
    fireEvent.click(appointBtn);

    // Navigates to create leadership page, and the card stays expanded
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/accounts/create-leadership')
    );
    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(cetHeader).toHaveAttribute('aria-expanded', 'true');
  });

  test('8. Chairperson view hides "+ Add College", hides "+ Add Department", and hides Dean Reassign/Appoint actions', () => {
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-chair-it',
      name: 'Prof. Charlie IT',
      email: 'charlie.it@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'chairperson',
      collegeId: 'col-cet',
      collegeName: 'College of Engineering and Technology',
      department: 'Information Technology',
      title: 'Department Chairperson',
    };

    render(<AcademicStructureTab />);

    // Chair MUST NOT see + Add College
    expect(screen.queryByRole('button', { name: /add college/i })).not.toBeInTheDocument();

    // Chair MUST NOT see + Add Program
    expect(screen.queryByRole('button', { name: /add (department|program)/i })).not.toBeInTheDocument();

    // Chair MUST NOT see Reassign/Appoint for Deans
    expect(screen.queryByRole('button', { name: /reassign/i })).not.toBeInTheDocument();

    // Chairperson console description is shown
    expect(screen.getByText(/Chairperson console: view academic structure/i)).toBeInTheDocument();

    // Scoped to their college
    expect(screen.getByText('College of Engineering and Technology')).toBeInTheDocument();

    // Chair MUST NOT see delete buttons for colleges or programs
    expect(screen.queryByRole('button', { name: /^delete /i })).not.toBeInTheDocument();
  });

  test('9. Chancellor sees delete controls on colleges and departments; Dean sees delete only on departments in their college', () => {
    // 1. As Chancellor
    mockActiveRole = 'superadmin';
    mockActiveUser = { id: 'u-chancellor', role: 'superadmin', adminSubrole: 'chancellor' };
    const { unmount } = render(<AcademicStructureTab />);

    expect(screen.getByRole('button', { name: /delete college of engineering and technology/i })).toBeInTheDocument();
    // Expand CET to access department delete button
    fireEvent.click(screen.getByRole('button', { name: /toggle (departments|programs) for college of engineering and technology/i }));
    expect(screen.getByRole('button', { name: /delete information technology/i })).toBeInTheDocument();
    unmount();

    // 2. As Dean of CET
    mockActiveRole = 'admin';
    mockActiveUser = {
      id: 'u-dean-cet',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-cet',
      collegeName: 'College of Engineering and Technology',
    };
    render(<AcademicStructureTab />);

    // Dean MUST NOT see college delete button
    expect(screen.queryByRole('button', { name: /delete college of engineering and technology/i })).not.toBeInTheDocument();
    // Expand CET to access department delete button
    fireEvent.click(screen.getByRole('button', { name: /toggle (departments|programs) for college of engineering and technology/i }));
    // Dean MUST see department delete button for CET department
    expect(screen.getByRole('button', { name: /delete information technology/i })).toBeInTheDocument();
  });

  test('10. Clicking delete on a blocked unit opens the Blocker Modal displaying the reasons', () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = { id: 'u-chancellor', role: 'superadmin', adminSubrole: 'chancellor' };
    mockGetCollegeDeleteBlockers.mockReturnValueOnce([
      'College has an assigned Dean (Dean Alice CET).',
      'Program "Information Technology" has an assigned Program Chairperson (Prof. Charlie IT).',
    ]);

    render(<AcademicStructureTab />);

    const deleteCetBtn = screen.getByRole('button', { name: /delete college of engineering and technology/i });
    fireEvent.click(deleteCetBtn);

    expect(screen.getByText('Cannot Delete College')).toBeInTheDocument();
    expect(screen.getByText(/College has an assigned Dean/i)).toBeInTheDocument();
    expect(screen.getByText(/Information Technology.*assigned Program Chairperson/i)).toBeInTheDocument();

    // Dismiss blocker modal
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByText('Cannot Delete College')).not.toBeInTheDocument();
  });

  test('11. Clicking delete on an eligible college opens the Confirmation Modal and confirms deletion', async () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = { id: 'u-chancellor', role: 'superadmin', adminSubrole: 'chancellor' };
    mockGetCollegeDeleteBlockers.mockReturnValue([]);

    render(<AcademicStructureTab />);

    const deleteCetBtn = screen.getByRole('button', { name: /delete college of engineering and technology/i });
    fireEvent.click(deleteCetBtn);

    // Confirmation modal is open
    expect(screen.getByText('Delete Academic College')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();

    // Confirms deletion
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete college & (departments|programs)/i }));
    });

    expect(mockDeleteCollege).toHaveBeenCalledWith('col-cet');
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/College Deleted/i),
        type: 'success',
      })
    );
  });
});
