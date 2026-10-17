// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { DepartmentDetailsPage } from './DepartmentDetailsPage';
import type { User, College, Department, Course, CourseSection } from '../../shared/types/lms';

const mockNavigate = vi.fn();
let mockParams = { deptId: 'dept-cs' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

const mockColleges: College[] = [
  { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS', deanId: 'u-dean-ccs' },
  { id: 'col-coe', name: 'College of Education', code: 'COED', deanId: 'u-dean-coe' },
];

const mockDepartments: Department[] = [
  {
    id: 'dept-cs',
    collegeId: 'col-ccs',
    name: 'Department of Computer Science',
    code: 'CS',
    chairpersonId: 'u-chair-cs',
  },
  {
    id: 'dept-elem',
    collegeId: 'col-coe',
    name: 'Department of Elementary Education',
    code: 'ELED',
    chairpersonId: 'u-chair-elem',
  },
];

const mockUsers: User[] = [
  {
    id: 'u-dean-ccs',
    name: 'Dr. Eleanor Vance',
    email: 'dean.ccs@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'College of Computer Science',
    title: 'College Dean',
    avatar: '',
  },
  {
    id: 'u-chair-cs',
    name: 'Prof. Alan Turing',
    email: 'alan.turing@dmmmsu.edu.ph',
    role: 'faculty',
    adminSubrole: 'chairperson',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'Department of Computer Science',
    title: 'Department Chairperson',
    avatar: '',
  },
  {
    id: 'u-fac-cs',
    name: 'Prof. Ada Lovelace',
    email: 'ada.lovelace@dmmmsu.edu.ph',
    role: 'faculty',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'Department of Computer Science',
    title: 'Associate Professor',
    avatar: '',
  },
  {
    id: 'u-stud-cs',
    name: 'Grace Hopper',
    email: 'grace.hopper@dmmmsu.edu.ph',
    role: 'student',
    studentId: '2026-CS-001',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'Department of Computer Science',
    title: 'Student',
    avatar: '',
    verificationStatus: 'verified',
  },
];

const mockCourses: Course[] = [
  {
    id: 'c-cs101',
    code: 'CS 101',
    title: 'Introduction to Computer Science',
    section: 'CS-1A',
    term: 'prelim',
    instructorId: 'u-chair-cs',
    instructorName: 'Prof. Alan Turing',
    published: true,
    enrolledCount: 35,
    credits: 3,
  },
  {
    id: 'c-cs102',
    code: 'CS 102',
    title: 'Data Structures and Algorithms',
    section: 'CS-2A',
    term: 'prelim',
    instructorId: 'u-fac-cs',
    instructorName: 'Prof. Ada Lovelace',
    published: false,
    enrolledCount: 28,
    credits: 3,
  },
];

const mockCourseSections: CourseSection[] = [
  { id: 'sec-1', courseId: 'c-cs101', name: 'CS-1A', enrolledCount: 35 },
  { id: 'sec-2', courseId: 'c-cs101', name: 'CS-1B', enrolledCount: 32 },
  { id: 'sec-3', courseId: 'c-cs102', name: 'CS-2A', enrolledCount: 28 },
];

const mockTransferLeadership = vi.fn().mockResolvedValue({
  success: true,
  message: 'Chairperson authority transferred successfully.',
});
const mockShowAlert = vi.fn();

const mockContext = {
  activeRole: 'admin',
  activeUser: mockUsers[0], // Dean CCS
  colleges: [...mockColleges],
  departments: [...mockDepartments],
  db: {
    users: [...mockUsers],
    courses: [...mockCourses],
    courseSections: [...mockCourseSections],
  },
  transferLeadership: mockTransferLeadership,
  showAlert: mockShowAlert,
};

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mockContext.activeRole,
    activeUser: mockContext.activeUser,
    colleges: mockContext.colleges,
    departments: mockContext.departments,
    db: mockContext.db,
    transferLeadership: mockContext.transferLeadership,
    showAlert: mockContext.showAlert,
  }),
}));

describe('DepartmentDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { deptId: 'dept-cs' };
    mockContext.activeRole = 'admin';
    mockContext.activeUser = mockUsers[0];
    mockContext.colleges = [...mockColleges];
    mockContext.departments = [...mockDepartments];
    mockContext.db = {
      users: [...mockUsers],
      courses: [...mockCourses],
      courseSections: [...mockCourseSections],
    };
  });

  it('renders header, breadcrumbs, department code, and back button', () => {
    render(<DepartmentDetailsPage />);

    expect(screen.getByText('Academic Governance')).toBeInTheDocument();
    expect(screen.getByText('College of Computer Science')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /department of computer science/i })).toBeInTheDocument();
    expect(screen.getByText('CS')).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: /back to academic governance/i });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/governance');
  });

  it('renders incumbent chairperson card and triggers handover modal', async () => {
    render(<DepartmentDetailsPage />);

    // Shows incumbent
    const chairCard = screen.getByTestId('incumbent-chairperson-card');
    expect(within(chairCard).getByText('Prof. Alan Turing')).toBeInTheDocument();
    expect(within(chairCard).getByText('alan.turing@dmmmsu.edu.ph')).toBeInTheDocument();
    expect(within(chairCard).getByText(/department chairperson/i)).toBeInTheDocument();

    const reassignButton = screen.getByRole('button', { name: /reassign chairperson/i });
    expect(reassignButton).toBeInTheDocument();

    fireEvent.click(reassignButton);

    // Modal opens
    expect(screen.getByText('Appoint Chairperson')).toBeInTheDocument();
    expect(screen.getByText(/strictly adhering to the single-seat leadership invariant/i)).toBeInTheDocument();

    // Select candidate
    const select = screen.getByLabelText(/select candidate/i);
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'u-fac-cs' } });

    const confirmButton = screen.getByRole('button', { name: /confirm appointment/i });
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(mockTransferLeadership).toHaveBeenCalledWith(
      'chairperson',
      'u-chair-cs',
      'u-fac-cs',
      'dept-cs'
    );
  });

  it('renders unappointed chairperson state with Appoint button', () => {
    mockContext.departments = [
      {
        id: 'dept-cs',
        collegeId: 'col-ccs',
        name: 'Department of Computer Science',
        code: 'CS',
        chairpersonId: undefined,
      },
    ];

    render(<DepartmentDetailsPage />);

    expect(screen.getByText(/no chairperson appointed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /appoint chairperson/i })).toBeInTheDocument();
  });

  it('displays 4 key department metrics', () => {
    render(<DepartmentDetailsPage />);

    const facultyMetric = screen.getByTestId('metric-total-faculty');
    expect(facultyMetric).toHaveTextContent('2'); // Alan Turing + Ada Lovelace

    const studentsMetric = screen.getByTestId('metric-total-students');
    expect(studentsMetric).toHaveTextContent('1'); // Grace Hopper

    const coursesMetric = screen.getByTestId('metric-active-courses');
    expect(coursesMetric).toHaveTextContent('2'); // CS 101 + CS 102

    const sectionsMetric = screen.getByTestId('metric-class-sections');
    expect(sectionsMetric).toHaveTextContent('3'); // sec-1, sec-2, sec-3
  });

  it('switches between Faculty Roster, Course Catalog, and Student Directory tabs', () => {
    render(<DepartmentDetailsPage />);

    // Faculty Roster is default tab
    expect(screen.getByText('Faculty Roster')).toBeInTheDocument();
    expect(screen.getByText('Prof. Ada Lovelace')).toBeInTheDocument();

    // Switch to Course Catalog tab
    const coursesTabBtn = screen.getByRole('tab', { name: /course catalog/i });
    fireEvent.click(coursesTabBtn);

    expect(screen.getByText('CS 101')).toBeInTheDocument();
    expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();

    // Switch to Student Directory tab
    const studentsTabBtn = screen.getByRole('tab', { name: /student directory/i });
    fireEvent.click(studentsTabBtn);

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('2026-CS-001')).toBeInTheDocument();
  });

  it('blocks Dean from accessing departments outside their assigned college', () => {
    // Attempting to access Elementary Education from COED while activeUser is Dean of CCS
    mockParams = { deptId: 'dept-elem' };

    render(<DepartmentDetailsPage />);

    expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to academic governance/i })).toBeInTheDocument();
  });

  it('renders not found screen when department ID does not exist', () => {
    mockParams = { deptId: 'dept-non-existent' };

    render(<DepartmentDetailsPage />);

    expect(screen.getByText(/department not found/i)).toBeInTheDocument();
  });

  it('filters directory list when user types in the search input', () => {
    render(<DepartmentDetailsPage />);

    // Initially both Alan and Ada are in the document (Alan appears in chairperson card + roster)
    expect(screen.getAllByText('Prof. Alan Turing').length).toBe(2);
    expect(screen.getByText('Prof. Ada Lovelace')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/filter faculty members/i);
    fireEvent.change(searchInput, { target: { value: 'lovelace' } });

    // Ada remains, Alan is filtered out of the roster (leaving only 1 in chairperson card)
    expect(screen.getByText('Prof. Ada Lovelace')).toBeInTheDocument();
    expect(screen.getAllByText('Prof. Alan Turing').length).toBe(1);

    // Clear search
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);

    expect(screen.getAllByText('Prof. Alan Turing').length).toBe(2);
    expect(screen.getByText('Prof. Ada Lovelace')).toBeInTheDocument();
  });
});
