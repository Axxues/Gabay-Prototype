import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgramDetailsPage } from './ProgramDetailsPage';
import type { Department, College, User, Course } from '../../shared/types/lms';

// Mock react-router-dom
const mockNavigate = vi.fn();
let mockParams: Record<string, string | undefined> = { programId: 'dept-cs' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Mock LMSContext
const mockTransferLeadership = vi.fn().mockResolvedValue({
  success: true,
  message: 'Leadership transferred successfully',
});
const mockShowAlert = vi.fn();

const mockCollegeCCS: College = {
  id: 'col-ccs',
  name: 'College of Computer Science',
  code: 'CCS',
  deanId: 'u-dean-ccs',
};

const mockDepartmentCS: Department = {
  id: 'dept-cs',
  collegeId: 'col-ccs',
  name: 'Program in Computer Science',
  code: 'CS',
  chairpersonId: 'u-chair-cs',
};

const mockUsers: User[] = [
  {
    id: 'u-dean-ccs',
    name: 'Dean Ada Lovelace',
    email: 'ada.lovelace@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    title: 'College Dean',
    avatar: '',
    department: 'College of Computer Science',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
  },
  {
    id: 'u-chair-cs',
    name: 'Prof. Alan Turing',
    email: 'alan.turing@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'chairperson',
    title: 'Program Chairperson',
    avatar: '',
    department: 'Program in Computer Science',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
  },
  {
    id: 'u-fac-cs',
    name: 'Prof. Grace Hopper',
    email: 'grace.hopper@dmmmsu.edu.ph',
    role: 'faculty',
    title: 'Associate Professor',
    avatar: '',
    department: 'Program in Computer Science',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
  },
  {
    id: 'u-stud-cs',
    name: 'Student Tim Berners-Lee',
    email: 'tim.bl@dmmmsu.edu.ph',
    role: 'student',
    title: 'Student',
    studentId: '2026-CS-001',
    avatar: '',
    department: 'Program in Computer Science',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
  },
];

const mockCourses: Course[] = [
  {
    id: 'c-cs101',
    title: 'Introduction to Computer Science',
    code: 'CS101',
    instructorId: 'u-chair-cs',
    instructor: 'Prof. Alan Turing',
    published: true,
  },
  {
    id: 'c-cs102',
    title: 'Data Structures and Algorithms',
    code: 'CS102',
    instructorId: 'u-fac-cs',
    instructor: 'Prof. Grace Hopper',
    published: true,
  },
];

let mockContext: any;

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => mockContext,
}));

describe('ProgramDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { programId: 'dept-cs' };
    mockContext = {
      colleges: [mockCollegeCCS],
      departments: [mockDepartmentCS],
      programs: [mockDepartmentCS],
      activeRole: 'superadmin',
      activeUser: { id: 'u-admin', role: 'superadmin', adminSubrole: 'chancellor' },
      transferLeadership: mockTransferLeadership,
      showAlert: mockShowAlert,
      db: {
        users: [...mockUsers],
        courses: [...mockCourses],
        courseSections: [],
      },
    };
  });

  it('renders program details, hero header, and breadcrumb navigation', () => {
    render(<ProgramDetailsPage />);

    expect(screen.getByText('Academic Governance')).toBeInTheDocument();
    expect(screen.getByText(/College of Computer Science/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Program in Computer Science/i })).toBeInTheDocument();
    expect(screen.getByText('CS')).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: /back to academic governance/i });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/governance');
  });

  it('renders incumbent chairperson card and triggers handover modal with Program copy', async () => {
    render(<ProgramDetailsPage />);

    const chairCard = screen.getByTestId('incumbent-chairperson-card');
    expect(within(chairCard).getByText('Prof. Alan Turing')).toBeInTheDocument();
    expect(within(chairCard).getByText('Program Chairperson')).toBeInTheDocument();

    const reassignButton = screen.getByRole('button', { name: /reassign chairperson/i });
    expect(reassignButton).toBeInTheDocument();
    fireEvent.click(reassignButton);

    expect(screen.getByText('Appoint Chairperson')).toBeInTheDocument();
    expect(screen.getByText(/Program: Program in Computer Science/i)).toBeInTheDocument();
  });

  it('renders 4 key program metrics', () => {
    render(<ProgramDetailsPage />);

    expect(screen.getByTestId('metric-total-faculty')).toHaveTextContent('2');
    expect(screen.getByTestId('metric-total-students')).toHaveTextContent('1');
    expect(screen.getByTestId('metric-active-courses')).toHaveTextContent('2');
    expect(screen.getByTestId('metric-class-sections')).toHaveTextContent('2');
  });
});
