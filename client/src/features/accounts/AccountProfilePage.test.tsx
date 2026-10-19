// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { AccountProfilePage } from './AccountProfilePage';
import type { User, College, Department, Course } from '../../shared/types/lms';

const mockNavigate = vi.fn();
let mockLocation: { pathname: string; state: any } = { pathname: '/accounts/student-1/view', state: null };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

const sampleStudent: User = {
  id: 'student-1',
  name: 'Maria Santos',
  email: 'maria@dmmmsu.edu.ph',
  role: 'student',
  collegeId: 'col-ccs',
  collegeName: 'College of Computer Science',
  department: 'Department of Computer Science',
  studentId: '2026-1001',
  yearLevel: 2,
  schoolYear: '2025-2026',
  birthday: '2004-03-21',
  contactNumber: '+63 999 111 2233',
  address: 'Agoo, La Union',
  permanentAddressNormalized: {
    province: 'La Union',
    municipalityCity: 'Agoo',
    barangay: 'San Nicolas',
    houseStreet: '123 Rizal St',
  },
  presentAddressNormalized: {
    province: 'La Union',
    municipalityCity: 'Agoo',
    barangay: 'San Nicolas',
    houseStreet: '123 Rizal St',
  },
  sameAsPermanentAddress: true,
  motherName: {
    firstName: 'Elena',
    middleName: 'Cruz',
    lastName: 'Santos',
  },
  fatherName: {
    firstName: 'Roberto',
    middleName: 'Gomez',
    lastName: 'Santos',
  },
  parentContactNumber: '+63 917 888 9900',
  enrolledCourseIds: ['course-1'],
};

const sampleFaculty: User = {
  id: 'faculty-1',
  name: 'Prof. Alice Rivera',
  email: 'alice@dmmmsu.edu.ph',
  role: 'faculty',
  collegeId: 'col-ccs',
  collegeName: 'College of Computer Science',
  department: 'Department of Computer Science',
  title: 'Associate Professor',
  birthday: '1985-09-10',
  contactNumber: '+63 920 555 4321',
  address: 'Bauang, La Union',
  yearsOfTeaching: 8,
  educationalBackground: [
    {
      id: 'deg-1',
      degreeLevel: 'masters',
      school: 'University of the Philippines',
      yearGraduated: '2015',
      specialization: 'Computer Science',
    },
  ],
};

const sampleCourse: Course = {
  id: 'course-1',
  code: 'CS 101',
  title: 'Introduction to Computing',
  section: '1-A',
  term: '1st Semester AY 2025-2026',
  instructorId: 'faculty-1',
  instructorName: 'Prof. Alice Rivera',
  published: true,
  enrolledCount: 35,
};

const mockColleges: College[] = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'admin-1' },
];

const mockDepartments: Department[] = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS' },
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: 'admin',
    activeUser: { id: 'admin-1', name: 'Dean Admin' },
    colleges: mockColleges,
    departments: mockDepartments,
    db: {
      users: [sampleStudent, sampleFaculty],
      courses: [sampleCourse],
    },
  }),
}));

describe('AccountProfilePage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation = { pathname: '/accounts/student-1/view', state: null };
  });

  it('renders student identity hero, stats ribbon, and Overview tab content', () => {
    render(<AccountProfilePage user={sampleStudent} />);

    // Header & identity
    expect(screen.getByText("Maria Santos's Profile")).toBeInTheDocument();
    expect(screen.getAllByText('Back to Accounts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('maria@dmmmsu.edu.ph').length).toBeGreaterThan(0);
    expect(screen.getByText('School Year Registered')).toBeInTheDocument();
    expect(screen.getByText('Collegiate Affiliation')).toBeInTheDocument();
    expect(screen.getByText('Program / Department')).toBeInTheDocument();
    expect(screen.queryByText('Designation / Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Administrative Scope')).not.toBeInTheDocument();
    expect(screen.queryByText('Registration Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Account Status')).not.toBeInTheDocument();

    // Placement details in Overview tab
    expect(screen.getByText('Student Year Level')).toBeInTheDocument();
    expect(screen.getAllByText('Year 2').length).toBeGreaterThan(0);

    // Overview Tab content
    expect(screen.getByText('Academic & Institutional Placement')).toBeInTheDocument();
    expect(screen.getByText('Personal & Contact Information')).toBeInTheDocument();
    expect(screen.getByText('+63 999 111 2233')).toBeInTheDocument();
    expect(screen.getByText('Residential Addresses')).toBeInTheDocument();
    expect(screen.getByText('Same as Permanent')).toBeInTheDocument();
  });

  it('switches to Family & Guardian tab for student and displays family details', () => {
    render(<AccountProfilePage user={sampleStudent} />);

    const recordsTab = screen.getByRole('tab', { name: /family & guardian/i });
    fireEvent.click(recordsTab);

    expect(screen.getByText("Mother's Name")).toBeInTheDocument();
    expect(screen.getByText('Elena Cruz Santos')).toBeInTheDocument();
    expect(screen.getByText("Father's Name")).toBeInTheDocument();
    expect(screen.getByText('Roberto Gomez Santos')).toBeInTheDocument();
    expect(screen.getByText('+63 917 888 9900')).toBeInTheDocument();
  });

  it('switches to Courses tab and displays enrolled courses for student', () => {
    render(<AccountProfilePage user={sampleStudent} />);

    const coursesTab = screen.getByRole('tab', { name: /courses & shells/i });
    fireEvent.click(coursesTab);

    expect(screen.getByText('Associated Courses & Assigned Shells')).toBeInTheDocument();
    expect(screen.getByText('CS 101')).toBeInTheDocument();
    expect(screen.getByText('Introduction to Computing')).toBeInTheDocument();
    expect(screen.getByText(/35 students enrolled/i)).toBeInTheDocument();
  });

  it('renders faculty profile with Educational Background degrees and appropriate field visibility', () => {
    render(<AccountProfilePage user={sampleFaculty} />);

    expect(screen.getByText("Prof. Alice Rivera's Profile")).toBeInTheDocument();
    expect(screen.getAllByText('Teaching Experience').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8 Years').length).toBeGreaterThan(0);

    // Faculty keeps designation/title, college affiliation, program, school year registered, and courses
    expect(screen.getByText('School Year Registered')).toBeInTheDocument();
    expect(screen.getByText('Designation / Title')).toBeInTheDocument();
    expect(screen.getByText('Associate Professor')).toBeInTheDocument();
    expect(screen.getByText('Collegiate Affiliation')).toBeInTheDocument();
    expect(screen.getByText('Program / Department')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /courses & shells/i })).toBeInTheDocument();

    // Faculty removes registration date, account status, and administrative scope
    expect(screen.queryByText('Registration Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Account Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Administrative Scope')).not.toBeInTheDocument();

    const eduTab = screen.getByRole('tab', { name: /educational background/i });
    fireEvent.click(eduTab);

    expect(screen.getByText("Master's Degree")).toBeInTheDocument();
    expect(screen.getByText('University of the Philippines')).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Class of 2015')).toBeInTheDocument();
  });

  it('triggers navigation on back button click and ensures edit account buttons are completely removed', () => {
    const mockBack = vi.fn();
    render(<AccountProfilePage user={sampleStudent} onNavigateTab={mockBack} />);

    // Click back button
    const backBtn = screen.getAllByRole('button', { name: /back to accounts/i })[0];
    fireEvent.click(backBtn);
    expect(mockBack).toHaveBeenCalledWith('accounts');

    // Edit account buttons should be completely removed from the page
    expect(screen.queryByRole('button', { name: /edit account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit user account/i })).not.toBeInTheDocument();
  });

  it('navigates back to the originating page when opened from another view with state', () => {
    mockLocation = {
      pathname: '/accounts/student-1/view',
      state: { from: '/governance/programs/dept-cs', fromLabel: 'Program' },
    };

    render(<AccountProfilePage user={sampleStudent} />);

    // Header back button should reflect the originating view
    const backBtn = screen.getAllByRole('button', { name: /back to program/i })[0];
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/governance/programs/dept-cs');
  });

  it('navigates back (-1) when session history exists', () => {
    const originalHistoryState = window.history.state;
    Object.defineProperty(window.history, 'state', {
      value: { idx: 2 },
      configurable: true,
      writable: true,
    });

    render(<AccountProfilePage user={sampleStudent} />);

    const backBtn = screen.getAllByRole('button', { name: /back/i })[0];
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith(-1);

    Object.defineProperty(window.history, 'state', {
      value: originalHistoryState,
      configurable: true,
      writable: true,
    });
  });

  it('respects role visibility rules for Dean (shows college, removes admin scope, title, program, dates, status, courses)', () => {
    const sampleDean: User = {
      id: 'dean-1',
      name: 'Dean Carlos Gomez',
      email: 'dean.carlos@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Office of the Dean',
      title: 'Dean, College of Computer Science',
      birthday: '1975-01-15',
      contactNumber: '+63 918 222 3344',
      address: 'San Fernando, La Union',
      schoolYear: '2025-2026',
    };

    render(<AccountProfilePage user={sampleDean} />);

    expect(screen.getByText('School Year Registered')).toBeInTheDocument();
    expect(screen.getByText('Collegiate Affiliation')).toBeInTheDocument();
    expect(screen.queryByText('Program / Department')).not.toBeInTheDocument();
    expect(screen.queryByText('Designation / Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Administrative Scope')).not.toBeInTheDocument();
    expect(screen.queryByText('Registration Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Account Status')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /courses & shells/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /educational background/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Teaching Experience')).not.toBeInTheDocument();
  });

  it('respects role visibility rules for Chair (shows college and program, removes admin scope, title, dates, status, courses)', () => {
    const sampleChair: User = {
      id: 'chair-1',
      name: 'Chair Jane Doe',
      email: 'chair.jane@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'chair',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      title: 'Department Chairperson',
      birthday: '1980-05-12',
      schoolYear: '2025-2026',
    };

    render(<AccountProfilePage user={sampleChair} />);

    expect(screen.getByText('School Year Registered')).toBeInTheDocument();
    expect(screen.getByText('Collegiate Affiliation')).toBeInTheDocument();
    expect(screen.getByText('Program / Department')).toBeInTheDocument();
    expect(screen.queryByText('Designation / Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Administrative Scope')).not.toBeInTheDocument();
    expect(screen.queryByText('Registration Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Account Status')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /courses & shells/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /educational background/i })).not.toBeInTheDocument();
  });

  it('respects role visibility rules for Admin (removes college, program, admin scope, title, dates, status, courses)', () => {
    const sampleAdmin: User = {
      id: 'admin-global',
      name: 'System Admin',
      email: 'sysadmin@dmmmsu.edu.ph',
      role: 'admin',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
      department: 'Department of Computer Science',
      title: 'Administrator',
      schoolYear: '2024-2025',
    };

    render(<AccountProfilePage user={sampleAdmin} />);

    expect(screen.getByText('School Year Registered')).toBeInTheDocument();
    expect(screen.queryByText('Collegiate Affiliation')).not.toBeInTheDocument();
    expect(screen.queryByText('Program / Department')).not.toBeInTheDocument();
    expect(screen.queryByText('Designation / Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Administrative Scope')).not.toBeInTheDocument();
    expect(screen.queryByText('Registration Date')).not.toBeInTheDocument();
    expect(screen.queryByText('Account Status')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /courses & shells/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /educational background/i })).not.toBeInTheDocument();
  });

  it('does not render custom image banner even if user.banner is present in data', () => {
    const userWithBanner: User = {
      ...sampleStudent,
      banner: 'https://example.com/custom-banner.jpg',
    };

    const { container } = render(<AccountProfilePage user={userWithBanner} />);

    // Must not render custom banner image
    const bannerImg = container.querySelector('img[src="https://example.com/custom-banner.jpg"]');
    expect(bannerImg).toBeNull();
  });
});
