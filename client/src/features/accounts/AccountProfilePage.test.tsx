// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { AccountProfilePage } from './AccountProfilePage';
import type { User, College, Department, Course } from '../../shared/types/lms';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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
  });

  it('renders student identity hero, stats ribbon, and Overview tab content', () => {
    render(<AccountProfilePage user={sampleStudent} />);

    // Header & identity
    expect(screen.getByText("Maria Santos's Profile")).toBeInTheDocument();
    expect(screen.getByText('Back to Accounts')).toBeInTheDocument();
    expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('maria@dmmmsu.edu.ph').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-1001').length).toBeGreaterThan(0);
    expect(screen.getByText('Active Account')).toBeInTheDocument();

    // Stats ribbon
    expect(screen.getByText('Current Year Level')).toBeInTheDocument();
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

  it('renders faculty profile with Educational Background degrees', () => {
    render(<AccountProfilePage user={sampleFaculty} />);

    expect(screen.getByText("Prof. Alice Rivera's Profile")).toBeInTheDocument();
    expect(screen.getAllByText('Teaching Experience').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8 Years').length).toBeGreaterThan(0);

    const eduTab = screen.getByRole('tab', { name: /educational background/i });
    fireEvent.click(eduTab);

    expect(screen.getByText("Master's Degree")).toBeInTheDocument();
    expect(screen.getByText('University of the Philippines')).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Class of 2015')).toBeInTheDocument();
  });

  it('triggers navigation on Back to Accounts and Edit Account clicks', () => {
    const mockBack = vi.fn();
    const mockEdit = vi.fn();
    render(<AccountProfilePage user={sampleStudent} onNavigateTab={mockBack} onEditAccount={mockEdit} />);

    // Click back button
    const backBtn = screen.getByRole('button', { name: /back to accounts/i });
    fireEvent.click(backBtn);
    expect(mockBack).toHaveBeenCalledWith('accounts');

    // Click Edit Account button in header
    const editBtns = screen.getAllByRole('button', { name: /edit account/i });
    fireEvent.click(editBtns[0]);
    expect(mockEdit).toHaveBeenCalledWith(sampleStudent);
  });
});
