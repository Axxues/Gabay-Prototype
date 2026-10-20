// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  activeRole: 'faculty',
  activeUser: { id: 'u-fac-1', name: 'Faculty', role: 'faculty' } as any,
  pendingRequests: [] as any[],
  baselineSchoolYear: { year: '2025-2026', isActive: true } as any,
  activeCollegeSchoolYear: undefined as any,
  collegeSchoolYears: undefined as any,
  colleges: [
    { id: 'col-ccs', name: 'College of Computer Science', code: 'CCS' },
    { id: 'col-ce', name: 'College of Engineering', code: 'CE' },
  ] as any[],
  departments: [
    { id: 'dept-cs', name: 'Computer Science', code: 'CS', collegeId: 'col-ccs' },
    { id: 'dept-it', name: 'Information Technology', code: 'IT', collegeId: 'col-ccs' },
    { id: 'dept-ce', name: 'Civil Engineering', code: 'CE', collegeId: 'col-ce' },
  ] as any[],
  db: {
    courses: [],
    enrollmentRequests: [],
    users: [],
    submissions: [],
    activities: [],
    quizzes: [],
    modules: [],
  } as any,
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: mocks.activeRole,
    activeUser: mocks.activeUser,
    db: mocks.db,
    colleges: mocks.colleges,
    departments: mocks.departments,
    isLoading: mocks.isLoading,
    openSpeedGrader: vi.fn(),
    getPendingRequestsForStudent: () => mocks.pendingRequests,
    studentApproveInvitation: vi.fn(),
    studentDeclineInvitation: vi.fn(),
    deleteCourse: vi.fn(),
    updateCourse: vi.fn(),
    showConfirm: vi.fn(),
    showAlert: vi.fn(),
    getApprovedRequestsForCourse: vi.fn().mockResolvedValue([]),
    getBaselineSchoolYear: () => mocks.baselineSchoolYear,
    getActiveSchoolYearForCollege: () => mocks.activeCollegeSchoolYear,
    getSchoolYearsByCollege: () => mocks.collegeSchoolYears || [],
  }),
  getOrGenerateCourseJoinCode: (c: any) => c?.joinCode || c?.join_code || `${(c?.code || 'GBY').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}-TEST`,
}));

import { DashboardPage } from './DashboardPage';

function renderPage() {
  return render(
    <DashboardPage onNavigateCourse={() => {}} onNavigateTab={() => {}} />
  );
}

describe('DashboardPage refresh loading', () => {
  beforeEach(() => {
    mocks.isLoading = false;
  });

  test('shows loading skeleton (not "no courses") while bootstrapping', () => {
    mocks.isLoading = true;
    renderPage();
    expect(screen.getByTestId('dashboard-courses-loading')).toBeInTheDocument();
    expect(screen.queryByText(/no enrolled courses/i)).not.toBeInTheDocument();
  });

  test('shows empty state only once loading settles', () => {
    renderPage();
    expect(screen.getByText(/no enrolled courses/i)).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-courses-loading')).not.toBeInTheDocument();
  });
});

describe('DashboardPage pending requests', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.activeRole = 'student';
    mocks.activeUser = { id: 'u-stud-1', name: 'Student 1', role: 'student' } as any;
    // Target course is NOT in the cached (enrolled-only) course list.
    mocks.db = {
      courses: [],
      enrollmentRequests: [],
      users: [],
      submissions: [],
      activities: [],
      quizzes: [],
      modules: [],
    } as any;
    mocks.pendingRequests = [
      {
        id: 'req-pending-1',
        courseId: 'c-unknown',
        studentId: 'u-stud-1',
        type: 'self_join',
        status: 'pending',
        courseCode: 'CMSC 180',
        courseTitle: 'Artificial Intelligence & Expert Systems',
      },
    ];
  });

  test('shows the course snapshot when the course is not cached', () => {
    renderPage();
    expect(screen.getByText('CMSC 180 — Artificial Intelligence & Expert Systems')).toBeInTheDocument();
  });

  test('never renders a bare dash for an unresolvable course', () => {
    mocks.pendingRequests = [
      {
        id: 'req-pending-2',
        courseId: 'c-gone',
        studentId: 'u-stud-1',
        type: 'self_join',
        status: 'pending',
        courseCode: null,
        courseTitle: null,
      },
    ];
    renderPage();
    expect(screen.getByText('Pending course request')).toBeInTheDocument();
  });
});

describe('DashboardPage admin access', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.activeRole = 'admin';
    mocks.activeUser = { id: 'u-admin-1', name: 'Dean Admin', role: 'admin' } as any;
    mocks.db = {
      courses: [
        { id: 'c1', code: 'CMSC 131', title: 'Data Structures', instructorId: 'u-admin-1' },
        { id: 'c2', code: 'CMSC 142', title: 'Algorithms & Complexity', instructorId: 'u-fac-other' },
      ],
      enrollmentRequests: [],
      users: [
        { id: 'u-admin-1', name: 'Dean Admin', role: 'admin' },
        { id: 'u-fac-1', name: 'Prof', role: 'faculty' },
        { id: 'u-stu-1', name: 'Student', role: 'student' },
      ],
      submissions: [
        { id: 'sub-1', courseId: 'c1', studentName: 'Alice', activityKey: 'act-1', status: 'submitted', submittedAt: new Date().toISOString() },
        { id: 'sub-2', courseId: 'c2', studentName: 'Bob', activityKey: 'act-2', status: 'submitted', submittedAt: new Date().toISOString() },
      ],
      activities: [
        { id: 'act-1', courseId: 'c1', title: 'Lab 1' },
        { id: 'act-2', courseId: 'c2', title: 'Lab 2' },
      ],
      quizzes: [],
      modules: [],
    } as any;
  });

  test('admin monitors university-wide courses with college selector and program tabs', () => {
    renderPage();

    // Admin sees university-wide monitoring title
    expect(screen.getByText('University Course Monitoring')).toBeInTheDocument();

    // Admin sees all courses across the university
    expect(screen.getByText('Data Structures')).toBeInTheDocument();
    expect(screen.getByText('Algorithms & Complexity')).toBeInTheDocument();

    // Option 1 controls are present
    expect(screen.getByTestId('college-scope-selector')).toBeInTheDocument();
    expect(screen.getByTestId('program-tabs-container')).toBeInTheDocument();

    // Removed cards should not be rendered
    expect(screen.queryByText('To grade')).not.toBeInTheDocument();
    expect(screen.queryByText('College system overview')).not.toBeInTheDocument();
  });

  test('admin Academic Scope is based on the university baseline academic year', () => {
    mocks.activeRole = 'admin';
    mocks.activeUser = { id: 'u-admin-1', name: 'University Admin', role: 'admin' } as any;
    mocks.baselineSchoolYear = { year: '2026-2027', isActive: true };

    renderPage();

    // The Academic Scope reflects the baseline year
    expect(screen.getAllByText('AY 2026-2027').length).toBeGreaterThanOrEqual(1);
    const ayButtons = screen.getAllByRole('button').filter(b => b.textContent?.includes('AY 2026-2027'));
    expect(ayButtons.length).toBeGreaterThan(0);
  });

  test('admin sees courses when baseline is 2025-2026 but courses belong to AY 2026-2027', () => {
    mocks.activeRole = 'admin';
    mocks.activeUser = { id: 'u-admin-1', name: 'University Admin', role: 'admin' } as any;
    mocks.baselineSchoolYear = { year: '2025-2026', isActive: true };
    mocks.activeCollegeSchoolYear = { year: '2026-2027', isActive: true };
    mocks.db = {
      courses: [
        {
          id: 'c-ccsc-303',
          code: 'CCSC 303',
          title: 'Computer Programming 1',
          schoolYear: '2026-2027',
          term: '1st Sem AY 2026-2027',
          collegeId: 'col-ccs',
        },
        {
          id: 'c-cscc-103',
          code: 'CSCC 103',
          title: 'Object Oriented Programming',
          schoolYear: '2026-2027',
          term: '1st Sem AY 2026-2027',
          collegeId: 'col-ccs',
        },
      ],
      enrollmentRequests: [],
      users: [{ id: 'u-admin-1', name: 'University Admin', role: 'admin' }],
      submissions: [],
      activities: [],
      quizzes: [],
      modules: [],
    } as any;

    renderPage();

    // Admin immediately sees courses in 2026-2027
    expect(screen.getByText('Computer Programming 1')).toBeInTheDocument();
    expect(screen.getByText('Object Oriented Programming')).toBeInTheDocument();

    // AY 2026-2027 is not disabled
    const ay2026Btn = screen.getByRole('button', { name: /AY 2026-2027/i });
    expect(ay2026Btn).not.toBeDisabled();
    expect(ay2026Btn).not.toHaveAttribute('aria-disabled', 'true');

    // Baseline AY 2025-2026 is present with Baseline badge
    const baselineBadge = screen.getByTestId('academic-scope-baseline-badge');
    expect(baselineBadge).toBeInTheDocument();
    expect(baselineBadge.textContent).toBe('Baseline');

    // Admin can switch to Baseline 2025-2026
    const baselineBtn = baselineBadge.closest('button');
    fireEvent.click(baselineBtn!);

    // Empty state for 2025-2026 is shown
    expect(screen.getByText(/No courses in this academic year/i)).toBeInTheDocument();

    // Admin can switch back to 2026-2027
    fireEvent.click(ay2026Btn);
    expect(screen.getByText('Computer Programming 1')).toBeInTheDocument();
  });

  test('renders baseline indicator badge when college active academic year differs from baseline', () => {
    mocks.activeRole = 'dean';
    mocks.activeUser = {
      id: 'u-dean-1',
      name: 'Dean CCS',
      role: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
    } as any;
    // College has rolled over to 2026-2027, while university baseline is 2025-2026
    mocks.activeCollegeSchoolYear = { id: 'sy-col-2026', year: '2026-2027', isActive: true };
    mocks.baselineSchoolYear = { id: 'sy-base-2025', year: '2025-2026', isActive: true };

    renderPage();

    // Wheel contains both Current and Baseline badges
    expect(screen.getByText('Current')).toBeInTheDocument();
    const baselineBadge = screen.getByTestId('academic-scope-baseline-badge');
    expect(baselineBadge).toBeInTheDocument();
    expect(baselineBadge.textContent).toBe('Baseline');

    // The baseline badge is on the AY 2025-2026 button
    const baselineBtn = baselineBadge.closest('button');
    expect(baselineBtn?.textContent).toContain('AY 2025-2026');

    // Clicking the baseline button switches selected year to baseline
    fireEvent.click(baselineBtn!);
    expect(screen.getAllByText('AY 2025-2026').length).toBeGreaterThanOrEqual(2);
  });

  test('does not render baseline indicator badge when college active academic year matches baseline', () => {
    mocks.activeRole = 'dean';
    mocks.activeUser = {
      id: 'u-dean-1',
      name: 'Dean CCS',
      role: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
    } as any;
    // Both active and baseline are 2025-2026
    mocks.activeCollegeSchoolYear = { id: 'sy-col-2025', year: '2025-2026', isActive: true };
    mocks.baselineSchoolYear = { id: 'sy-base-2025', year: '2025-2026', isActive: true };

    renderPage();

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.queryByTestId('academic-scope-baseline-badge')).not.toBeInTheDocument();
  });

  test('dean is locked to their home college with no cross-college navigation', () => {
    mocks.activeRole = 'dean';
    mocks.activeUser = {
      id: 'u-dean-1',
      name: 'Dean CCS',
      role: 'dean',
      collegeId: 'col-ccs',
      collegeName: 'College of Computer Science',
    } as any;
    mocks.db.courses = [
      { id: 'c1', code: 'CMSC 131', title: 'Data Structures', instructorId: 'u-fac-1', collegeId: 'col-ccs' },
      { id: 'c2', code: 'ENGR 101', title: 'Engineering Mechanics', instructorId: 'u-fac-2', collegeId: 'col-ce' },
    ];

    renderPage();

    expect(screen.getByText('Collegiate Course Monitoring')).toBeInTheDocument();
    expect(screen.getByTestId('program-tabs-container')).toBeInTheDocument();
    expect(screen.getByTestId('program-tab-all')).toBeInTheDocument();

    // The college switcher is an admin-only control; a dean has a fixed jurisdiction.
    expect(screen.queryByTestId('college-scope-selector')).not.toBeInTheDocument();

    // The fixed jurisdiction is surfaced as a static badge instead.
    expect(screen.getByTestId('dean-college-badge')).toHaveTextContent('College of Computer Science');

    // Only the dean's own college is visible — no university-wide or foreign-college scope.
    expect(screen.getByText('Data Structures')).toBeInTheDocument();
    expect(screen.queryByText('Engineering Mechanics')).not.toBeInTheDocument();
    expect(screen.queryByText('University Course Monitoring')).not.toBeInTheDocument();

    // Program tabs are limited to the dean's college departments.
    expect(screen.getByTestId('program-tab-dept-cs')).toBeInTheDocument();
    expect(screen.getByTestId('program-tab-dept-it')).toBeInTheDocument();
    expect(screen.queryByTestId('program-tab-dept-ce')).not.toBeInTheDocument();
  });

  test('chairperson monitors program courses with jurisdiction badge and upload chair-sheet action', () => {
    mocks.activeRole = 'chairperson';
    mocks.activeUser = {
      id: 'u-chair-1',
      name: 'Chair CS',
      role: 'chairperson',
      department: 'Department of Computer Science',
      program: 'Computer Science',
    } as any;

    renderPage();

    expect(screen.getByText('Program Course Monitoring')).toBeInTheDocument();
    expect(screen.getByTestId('chair-jurisdiction-banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload assigned courses/i })).toBeInTheDocument();
    // Chairperson has no college selector or multi-program tabs
    expect(screen.queryByTestId('college-scope-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('program-tabs-container')).not.toBeInTheDocument();
  });

  test('faculty views My Teaching Courses without manual course creation button', () => {
    mocks.activeRole = 'faculty';
    mocks.activeUser = { id: 'u-fac-1', name: 'Prof Alice', role: 'faculty' } as any;

    renderPage();

    expect(screen.getByText('My Teaching Courses')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create course|new course/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload assigned courses/i })).not.toBeInTheDocument();
  });

  test('hides into small card on left side and shows Academic Scope wheel when clicked', async () => {
    mocks.activeRole = 'admin';
    mocks.activeUser = { id: 'u-admin-1', name: 'Dean Admin', role: 'admin' } as any;
    renderPage();

    // Initially expanded
    expect(screen.getByTestId('academic-scope-wheel')).toBeInTheDocument();
    const hideBtn = screen.getByRole('button', { name: /Hide Academic Scope/i });
    expect(hideBtn).toBeInTheDocument();

    // Click to hide into small card at the left edge
    fireEvent.click(hideBtn);
    await waitFor(() => {
      expect(screen.queryByTestId('academic-scope-wheel')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Academic Scope')).toBeInTheDocument();
    expect(localStorage.getItem('gabay_academic_scope_collapsed')).toBe('true');

    // Click small card to show Academic Scope
    const showBtn = screen.getByRole('button', { name: /Show Academic Scope/i });
    expect(showBtn).toBeInTheDocument();
    fireEvent.click(showBtn);
    await waitFor(() => {
      expect(screen.getByTestId('academic-scope-wheel')).toBeInTheDocument();
    });
    expect(localStorage.getItem('gabay_academic_scope_collapsed')).toBe('false');
  });

  test('faculty has authority to edit courses but NOT delete courses', () => {
    mocks.activeRole = 'faculty';
    mocks.activeUser = { id: 'u-fac-1', name: 'Prof Alice', role: 'faculty' } as any;
    mocks.db = {
      courses: [
        { id: 'c1', code: 'CMSC 131', title: 'Data Structures', instructorId: 'u-fac-1', schoolYear: '2025-2026' }
      ],
      enrollmentRequests: [],
      users: [{ id: 'u-fac-1', name: 'Prof Alice', role: 'faculty' }],
      submissions: [],
      activities: [],
      quizzes: [],
      modules: []
    } as any;

    const onNavigateCourse = vi.fn();
    render(
      <DashboardPage onNavigateCourse={onNavigateCourse} onNavigateTab={() => {}} />
    );

    // Faculty has Edit Course button
    expect(screen.getByTitle('Edit Course')).toBeInTheDocument();
    // Faculty does NOT have Delete Course button
    expect(screen.queryByTitle('Delete Course')).not.toBeInTheDocument();

    // Clicking Edit Course navigates to edit page
    fireEvent.click(screen.getByTitle('Edit Course'));
    expect(onNavigateCourse).toHaveBeenCalledWith('c1', 'edit');
  });

  test('admin has authority to edit courses but not delete courses', () => {
    mocks.activeRole = 'admin';
    mocks.activeUser = { id: 'u-admin-1', name: 'Dean Admin', role: 'admin' } as any;
    mocks.baselineSchoolYear = { year: '2025-2026', isActive: true };
    mocks.db = {
      courses: [
        { id: 'c1', code: 'CMSC 131', title: 'Data Structures', instructorId: 'u-admin-1', schoolYear: '2025-2026' }
      ],
      enrollmentRequests: [],
      users: [{ id: 'u-admin-1', name: 'Dean Admin', role: 'admin' }],
      submissions: [],
      activities: [],
      quizzes: [],
      modules: []
    } as any;

    renderPage();

    expect(screen.getByTitle('Edit Course')).toBeInTheDocument();
    expect(screen.queryByTitle('Delete Course')).not.toBeInTheDocument();
  });
});

describe('DashboardPage semester filter', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.activeRole = 'faculty';
    mocks.activeUser = { id: 'u-fac-1', name: 'Dr. Faculty', role: 'faculty' } as any;
    mocks.baselineSchoolYear = { year: '2025-2026', isActive: true };
    mocks.db = {
      courses: [
        {
          id: 'c-sem-1',
          code: 'CMSC 131',
          title: 'Object-Oriented Programming',
          instructorId: 'u-fac-1',
          schoolYear: '2025-2026',
          semester: 'First',
          term: '1st Sem AY 2025-2026',
        },
        {
          id: 'c-sem-2',
          code: 'CMSC 142',
          title: 'Design and Analysis of Algorithms',
          instructorId: 'u-fac-1',
          schoolYear: '2025-2026',
          semester: 'Second',
          term: '2nd Sem AY 2025-2026',
        },
        {
          id: 'c-sem-3',
          code: 'CMSC 198',
          title: 'Practicum',
          instructorId: 'u-fac-1',
          schoolYear: '2025-2026',
          semester: 'Mid-Year',
          term: 'Midyear AY 2025-2026',
        },
      ],
      enrollmentRequests: [],
      users: [{ id: 'u-fac-1', name: 'Dr. Faculty', role: 'faculty' }],
      submissions: [],
      activities: [],
      quizzes: [],
      modules: [],
    } as any;
  });

  test('renders semester filter tabs with correct labels and live course counts', () => {
    renderPage();

    expect(screen.getByTestId('semester-filter-container')).toBeInTheDocument();
    expect(screen.getByTestId('semester-tab-all')).toHaveTextContent('All Semesters');
    expect(screen.getByTestId('semester-tab-First')).toHaveTextContent('First Semester');
    expect(screen.getByTestId('semester-tab-Second')).toHaveTextContent('Second Semester');
    expect(screen.getByTestId('semester-tab-Mid-Year')).toHaveTextContent('Mid-Year');

    // Counts
    expect(screen.getByTestId('semester-tab-all')).toHaveTextContent('3');
    expect(screen.getByTestId('semester-tab-First')).toHaveTextContent('1');
    expect(screen.getByTestId('semester-tab-Second')).toHaveTextContent('1');
    expect(screen.getByTestId('semester-tab-Mid-Year')).toHaveTextContent('1');

    // Initially displays all 3 courses
    expect(screen.getByText('Object-Oriented Programming')).toBeInTheDocument();
    expect(screen.getByText('Design and Analysis of Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Practicum')).toBeInTheDocument();
  });

  test('filters courses by clicking specific semester tab', () => {
    renderPage();

    // Click First Semester
    fireEvent.click(screen.getByTestId('semester-tab-First'));
    expect(screen.getByText('Object-Oriented Programming')).toBeInTheDocument();
    expect(screen.queryByText('Design and Analysis of Algorithms')).not.toBeInTheDocument();
    expect(screen.queryByText('Practicum')).not.toBeInTheDocument();

    // Click Second Semester
    fireEvent.click(screen.getByTestId('semester-tab-Second'));
    expect(screen.queryByText('Object-Oriented Programming')).not.toBeInTheDocument();
    expect(screen.getByText('Design and Analysis of Algorithms')).toBeInTheDocument();
    expect(screen.queryByText('Practicum')).not.toBeInTheDocument();

    // Click Mid-Year
    fireEvent.click(screen.getByTestId('semester-tab-Mid-Year'));
    expect(screen.queryByText('Object-Oriented Programming')).not.toBeInTheDocument();
    expect(screen.queryByText('Design and Analysis of Algorithms')).not.toBeInTheDocument();
    expect(screen.getByText('Practicum')).toBeInTheDocument();

    // Click All Semesters
    fireEvent.click(screen.getByTestId('semester-tab-all'));
    expect(screen.getByText('Object-Oriented Programming')).toBeInTheDocument();
    expect(screen.getByText('Design and Analysis of Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Practicum')).toBeInTheDocument();
  });

  test('displays join code directly from Likha ERP on course cards', () => {
    mocks.activeRole = 'faculty';
    mocks.activeUser = { id: 'u1', name: 'Prof Alice', role: 'faculty' };
    mocks.db.courses = [
      {
        id: 'c-join-1',
        code: 'CSPC 112',
        title: 'Software Engineering 2',
        section: '4-E',
        instructorId: 'u1',
        published: true,
        joinCode: 'CSPC-JOIN'
      },
      {
        id: 'c-join-2',
        code: 'CCSC 303',
        title: 'Computer Programming 1',
        section: '1-A',
        instructorId: 'u1',
        published: true,
        join_code: 'CCSC-G983'
      },
      {
        id: 'c-join-3',
        code: 'CSCC 103',
        title: 'Object Oriented Programming',
        section: '4-E',
        instructorId: 'u1',
        published: true,
        // No joinCode or join_code from Likha ERP
      }
    ];

    renderPage();

    expect(screen.getByText('CSPC-JOIN')).toBeInTheDocument();
    expect(screen.getByText('CCSC-G983')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  test('chairperson sees Delete Course button on course card', () => {
    mocks.activeRole = 'chairperson';
    mocks.activeUser = {
      id: 'u-chair-cs',
      name: 'Chair CS',
      role: 'chairperson',
      department: 'Computer Science',
      adminSubrole: 'chairperson'
    };
    mocks.db.courses = [
      {
        id: 'c-cs-1',
        code: 'CSCC 103',
        title: 'Data Structures',
        section: 'BSCS 2-1',
        department: 'Computer Science',
        instructorId: 'u-fac-other',
        published: true,
      }
    ];

    renderPage();

    expect(screen.getByTitle('Delete Course')).toBeInTheDocument();
  });

  test('pure faculty does not see Delete Course button on course card', () => {
    mocks.activeRole = 'faculty';
    mocks.activeUser = {
      id: 'u-fac-1',
      name: 'Faculty Member',
      role: 'faculty',
    };
    mocks.db.courses = [
      {
        id: 'c-cs-1',
        code: 'CSCC 103',
        title: 'Data Structures',
        section: 'BSCS 2-1',
        instructorId: 'u-fac-1',
        published: true,
      }
    ];

    renderPage();

    expect(screen.queryByTitle('Delete Course')).not.toBeInTheDocument();
  });

  test('admin does not see Delete Course button on course card', () => {
    mocks.activeRole = 'admin';
    mocks.activeUser = {
      id: 'u-admin-1',
      name: 'Admin User',
      role: 'admin',
    };
    mocks.db.courses = [
      {
        id: 'c-cs-1',
        code: 'CSCC 103',
        title: 'Data Structures',
        section: 'BSCS 2-1',
        instructorId: 'u-fac-1',
        published: true,
      }
    ];

    renderPage();

    expect(screen.queryByTitle('Delete Course')).not.toBeInTheDocument();
  });
});

