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
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };
  });

  test('1. Chancellor view displays + Add College, all colleges, and "Reassign" button on Deans', () => {
    mockActiveRole = 'superadmin';
    mockActiveUser = {
      id: 'u-chancellor',
      name: 'Dr. Chancellor',
      email: 'chancellor@dmmmsu.edu.ph',
      role: 'superadmin',
      adminSubrole: 'chancellor',
    };

    render(<AcademicStructureTab />);

    // Chancellor sees + Add College and + Add Department
    expect(screen.getByRole('button', { name: /add college/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add department/i })).toBeInTheDocument();

    // Chancellor sees all colleges
    expect(screen.getByText('College of Engineering and Technology')).toBeInTheDocument();
    expect(screen.getByText('College of Arts and Sciences')).toBeInTheDocument();

    // Chancellor sees Reassign button on Dean cards
    const reassignButtons = screen.getAllByRole('button', { name: /reassign/i });
    expect(reassignButtons.length).toBeGreaterThanOrEqual(2);
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

    // Dean sees + Add Department
    const addDeptBtn = screen.getByRole('button', { name: /add department/i });
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

  test('3. Dean appointing a chair only sees candidates belonging to the Dean\'s college', () => {
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

    // Civil Engineering has no sitting chairperson, so it exposes the Appoint action
    const appointChairBtn = screen.getByRole('button', { name: /^appoint$/i });
    fireEvent.click(appointChairBtn);

    // Appoint modal is open
    expect(screen.getByText(/appoint chairperson/i)).toBeInTheDocument();

    // Inspect candidate dropdown
    const candidateSelect = screen.getByLabelText(/select candidate/i) as HTMLSelectElement;
    const optionValues = Array.from(candidateSelect.options).map(o => o.value);

    // Should include Prof. Diana CET (eligible faculty in same college)
    expect(optionValues).toContain('u-fac-cet');

    // Should NOT include faculty from CAS (u-fac-cas or u-chair-bio)
    expect(optionValues).not.toContain('u-fac-cas');
    expect(optionValues).not.toContain('u-chair-bio');

    // Should NOT include students
    expect(optionValues).not.toContain('u-stu-1');
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

    // Open Add Department modal
    fireEvent.click(screen.getByRole('button', { name: /add department/i }));
    expect(screen.getByText('Add Academic Department')).toBeInTheDocument();

    // Parent college should be locked to CET
    const parentSelect = screen.getByLabelText(/select parent college/i) as HTMLSelectElement;
    expect(parentSelect).toBeDisabled();
    expect(parentSelect.value).toBe('col-cet');

    // Fill department name and code
    fireEvent.change(screen.getByLabelText(/department name/i), {
      target: { value: 'Software Engineering' },
    });
    fireEvent.change(screen.getByLabelText(/department code/i), {
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
      fireEvent.click(within(dialog).getByRole('button', { name: /add department/i }));
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

  test('6. clicking the college card header toggles departments without needing the arrow', () => {
    render(<AcademicStructureTab />);

    const cetHeader = screen.getByRole('button', {
      name: /toggle departments for college of engineering and technology/i,
    });
    expect(cetHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Information Technology')).toBeInTheDocument();

    // Click the card's title (not the chevron) to collapse
    fireEvent.click(screen.getByText('College of Engineering and Technology'));

    expect(screen.queryByText('Information Technology')).not.toBeInTheDocument();
    expect(cetHeader).toHaveAttribute('aria-expanded', 'false');

    // Click the card again to expand
    fireEvent.click(screen.getByText('College of Engineering and Technology'));

    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(cetHeader).toHaveAttribute('aria-expanded', 'true');
  });

  test('7. clicking a header action (Reassign) inside the card does not collapse the college', () => {
    render(<AcademicStructureTab />);

    const cetHeader = screen.getByRole('button', {
      name: /toggle departments for college of engineering and technology/i,
    });

    // The first Reassign button belongs to the CET dean card in the header
    const [deanReassign] = screen.getAllByRole('button', { name: /reassign/i });
    fireEvent.click(deanReassign);

    // Appoint dean modal opens, and the card stays expanded
    expect(screen.getByText(/appoint dean/i)).toBeInTheDocument();
    expect(screen.getByText('Information Technology')).toBeInTheDocument();
    expect(cetHeader).toHaveAttribute('aria-expanded', 'true');

    // The sitting dean is excluded from the candidate list
    const candidateSelect = screen.getByLabelText(/select candidate/i) as HTMLSelectElement;
    const optionValues = Array.from(candidateSelect.options).map(o => o.value);
    expect(optionValues).not.toContain('u-dean-cet');
    expect(optionValues).toContain('u-fac-cet');
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

    // Chair MUST NOT see + Add Department
    expect(screen.queryByRole('button', { name: /add department/i })).not.toBeInTheDocument();

    // Chair MUST NOT see Reassign/Appoint for Deans
    expect(screen.queryByRole('button', { name: /reassign/i })).not.toBeInTheDocument();

    // Chairperson console description is shown
    expect(screen.getByText(/Chairperson console: view academic structure/i)).toBeInTheDocument();

    // Scoped to their college
    expect(screen.getByText('College of Engineering and Technology')).toBeInTheDocument();
  });
});
