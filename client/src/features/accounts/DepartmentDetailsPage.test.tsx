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
  {
    id: 'u-admin-cs',
    name: 'Jayvee Admin',
    email: 'jayvee.admin@dmmmsu.edu.ph',
    role: 'admin',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'Department of Computer Science',
    title: 'Department Administrator',
    avatar: '',
  },
  {
    id: 'u-staff-cs',
    name: 'Linus Registrar',
    email: 'linus.registrar@dmmmsu.edu.ph',
    role: 'staff',
    collegeId: 'col-ccs',
    collegeName: 'College of Computer Science',
    department: 'Department of Computer Science',
    title: 'Department Registrar',
    avatar: '',
  },
  {
    id: 'u-dean-coe',
    name: 'Dr. Marcus Reyes',
    email: 'dean.coe@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    collegeId: 'col-coe',
    collegeName: 'College of Education',
    department: 'College of Education',
    title: 'College Dean',
    avatar: '',
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
    expect(screen.getByText(/College of Computer Science/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /(department|program) (of|in) computer science/i })).toBeInTheDocument();
    expect(screen.getByText('CS')).toBeInTheDocument();

    const backButton = screen.getByRole('button', { name: /back to academic governance/i });
    expect(backButton).toBeInTheDocument();
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith('/governance');
  });

  it('renders incumbent chairperson card without handover button', () => {
    render(<DepartmentDetailsPage />);

    // Shows incumbent
    const chairCard = screen.getByTestId('incumbent-chairperson-card');
    expect(within(chairCard).getByText('Prof. Alan Turing')).toBeInTheDocument();
    expect(within(chairCard).getByText('alan.turing@dmmmsu.edu.ph')).toBeInTheDocument();
    expect(within(chairCard).getByText(/(department|program) chairperson/i)).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /reassign chairperson/i })).not.toBeInTheDocument();
  });

  it('renders unappointed chairperson state without appoint button', () => {
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

    expect(screen.getByTestId('unappointed-chairperson-card')).toBeInTheDocument();
    expect(screen.getByText('No Chairperson Appointed')).toBeInTheDocument();
    expect(screen.getByText('Seat Vacant')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /appoint chairperson/i })).not.toBeInTheDocument();
  });

  it('displays 4 key department metrics', () => {
    render(<DepartmentDetailsPage />);

    const facultyMetric = screen.getByTestId('metric-total-faculty');
    expect(facultyMetric).toHaveTextContent('1'); // Ada Lovelace only (Alan Turing is chairperson, not faculty)

    const studentsMetric = screen.getByTestId('metric-total-students');
    expect(studentsMetric).toHaveTextContent('1'); // Grace Hopper

    const coursesMetric = screen.getByTestId('metric-active-courses');
    expect(coursesMetric).toHaveTextContent('2'); // CS 101 + CS 102

    const sectionsMetric = screen.getByTestId('metric-class-sections');
    expect(sectionsMetric).toHaveTextContent('3'); // sec-1, sec-2, sec-3
  });

  it('shows every account affiliated with the department, not just faculty', () => {
    render(<DepartmentDetailsPage />);

    // Faculty member, chairperson, college dean, admin, staff, and student all appear in the roster
    expect(screen.getByText('Prof. Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Jayvee Admin')).toBeInTheDocument();
    expect(screen.getByText('Linus Registrar')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('2026-CS-001')).toBeInTheDocument();
    expect(screen.getAllByText('Prof. Alan Turing').length).toBe(2); // chairperson card + roster

    // The dean of the parent college is on the roster; another college's dean is not
    expect(screen.getByText('Dr. Eleanor Vance')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Marcus Reyes')).not.toBeInTheDocument();

    // Filter chips replace the old tabs, with per-role counts
    const filters = screen.getByRole('group', { name: /filter roster by role/i });
    expect(within(filters).getByRole('button', { name: /all/i })).toHaveTextContent('6');
    expect(within(filters).getByRole('button', { name: /^admin/i })).toHaveTextContent('3'); // dean + chair + dept admin
    expect(within(filters).getByRole('button', { name: /^faculty/i })).toHaveTextContent('1'); // Ada
    expect(within(filters).getByRole('button', { name: /^staff/i })).toHaveTextContent('1'); // Linus
    expect(within(filters).getByRole('button', { name: /^student/i })).toHaveTextContent('1'); // Grace
  });

  it('narrows the roster to the selected role filter', () => {
    render(<DepartmentDetailsPage />);

    const allFilter = screen.getByRole('button', { name: /all/i });
    expect(allFilter).toHaveAttribute('aria-pressed', 'true');

    // Students only
    fireEvent.click(screen.getByRole('button', { name: /^student/i }));
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByText('Prof. Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.queryByText('Linus Registrar')).not.toBeInTheDocument();

    // Administrative seats only (college dean + sitting chairperson + department admin)
    fireEvent.click(screen.getByRole('button', { name: /^admin/i }));
    expect(screen.getAllByText('Prof. Alan Turing').length).toBe(2); // card + roster row
    expect(screen.getByText('Dr. Eleanor Vance')).toBeInTheDocument();
    expect(screen.getByText('Jayvee Admin')).toBeInTheDocument();
    expect(screen.queryByText('Grace Hopper')).not.toBeInTheDocument();
    expect(screen.queryByText('Prof. Ada Lovelace')).not.toBeInTheDocument();
  });

  it('shows only the dean of the department’s own college', () => {
    // A non-dean admin can open any department, so the college boundary is what decides
    mockContext.activeRole = 'admin';
    mockContext.activeUser = mockUsers.find(u => u.id === 'u-admin-cs')!;
    mockParams = { deptId: 'dept-elem' };

    render(<DepartmentDetailsPage />);

    expect(screen.getByText('Dr. Marcus Reyes')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Eleanor Vance')).not.toBeInTheDocument();
  });

  it('removes the Course Catalog view entirely', () => {
    render(<DepartmentDetailsPage />);

    expect(screen.queryByRole('tab', { name: /course catalog/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Course Catalog')).not.toBeInTheDocument();
    expect(screen.queryByText('CS 101')).not.toBeInTheDocument();
    expect(screen.queryByText('Introduction to Computer Science')).not.toBeInTheDocument();

    // The department's course count still surfaces through the metric card
    expect(screen.getByTestId('metric-active-courses')).toHaveTextContent('2');
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

    expect(screen.getByText(/(department|program) not found/i)).toBeInTheDocument();
  });

  it('filters directory list when user types in the search input', () => {
    render(<DepartmentDetailsPage />);

    // Initially both Alan and Ada are in the document (Alan appears in chairperson card + roster)
    expect(screen.getAllByText('Prof. Alan Turing').length).toBe(2);
    expect(screen.getByText('Prof. Ada Lovelace')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/filter members/i);
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

