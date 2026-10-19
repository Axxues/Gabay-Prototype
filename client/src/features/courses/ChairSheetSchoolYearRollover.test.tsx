// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import * as xlsx from 'xlsx';
import { ChairSheetUploadView } from './components/ChairSheetUploadView';

const mockCreateCourse = vi.fn(async (data: any) => ({
  id: `crs-${Date.now()}`,
  ...data,
}));

const mockShowAlert = vi.fn();
const mockOnNavigateCourse = vi.fn();
const mockOnNavigateTab = vi.fn();

const mockColleges = [
  { id: 'col-ccs', name: 'College of Computer Studies', code: 'CCS' },
  { id: 'col-coe', name: 'College of Engineering', code: 'COE' },
];

const mockDepartments = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS', chairpersonId: 'u-chair-cs' },
  { id: 'dept-ce', collegeId: 'col-coe', name: 'Department of Civil Engineering', code: 'CE', chairpersonId: 'u-chair-ce' },
];

const mockSchoolYears = [
  { id: 'sy-2526', collegeId: 'col-ccs', year: '2025-2026', isActive: false },
  { id: 'sy-2627', collegeId: 'col-ccs', year: '2026-2027', isActive: true },
  { id: 'sy-2728', collegeId: 'col-ccs', year: '2027-2028', isActive: false },
];

let mockActiveUser: any = {
  id: 'u-chair-cs',
  name: 'Chair Alice',
  role: 'admin',
  adminSubrole: 'chairperson',
  department: 'Department of Computer Science',
  // Note: collegeId is deliberately left undefined to test resolution via department
};

const mockEligibleFaculty = [
  {
    id: 'u-fac-1',
    name: 'Charlie Seli Marzan',
    firstName: 'Charlie',
    middleName: 'Seli',
    lastName: 'Marzan',
    role: 'faculty',
    department: 'Department of Computer Science',
  },
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: mockActiveUser,
    activeRole: 'admin',
    db: {
      users: mockEligibleFaculty,
      courses: [],
    },
    colleges: mockColleges,
    departments: mockDepartments,
    schoolYears: mockSchoolYears,
    getSchoolYearsByCollege: (colId: string) => mockSchoolYears.filter(sy => sy.collegeId === colId),
    getActiveSchoolYearForCollege: (colId: string) =>
      colId === 'col-ccs' ? { year: '2026-2027', isActive: true } : { year: '2025-2026', isActive: true },
    getBaselineSchoolYear: () => ({ year: '2026-2027', isActive: true }),
    createCourse: mockCreateCourse,
    showAlert: mockShowAlert,
  }),
}));

function createChairSheetFile(rows: any[][]) {
  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  const u8 = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([u8], 'chairsheet-rolledover.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('Chair-Sheet Upload with Rolled-Over School Year', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('resolves active school year for rolled-over college and assigns courses to the new school year', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    // 1. Verify target school year select is present and defaults to rolled-over year 2026-2027
    const yearSelect = screen.getByLabelText(/select target academic year/i) as HTMLSelectElement;
    expect(yearSelect).toBeInTheDocument();
    expect(yearSelect.value).toBe('2026-2027');

    // 2. Upload chair-sheet
    const file = createChairSheetFile([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', 'BSCS 2-1'],
    ]);

    const fileInput = screen.getByTestId('chair-sheet-file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // 3. Verify preview table loads with valid faculty match
    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Object Oriented Programming')).toBeInTheDocument();
    });

    // 4. Click Approve & Create
    const approveBtn = screen.getByRole('button', { name: /Approve & Create/i });
    expect(approveBtn).not.toBeDisabled();
    fireEvent.click(approveBtn);

    // 5. Confirm in modal
    await waitFor(() => {
      expect(screen.getByText(/Approve Course Offerings/i)).toBeInTheDocument();
      expect(screen.getAllByText(/2026-2027/i).length).toBeGreaterThan(0);
    });

    const commitBtn = screen.getByRole('button', { name: /Confirm & Create/i });
    fireEvent.click(commitBtn);

    // 6. Verify createCourse was invoked with new rolled-over schoolYear 2026-2027
    await waitFor(() => {
      expect(mockCreateCourse).toHaveBeenCalledTimes(1);
    });

    const coursePayload = mockCreateCourse.mock.calls[0][0];
    expect(coursePayload.schoolYear).toBe('2026-2027');
    expect(coursePayload.term).toContain('2026-2027');
    expect(coursePayload.code).toBe('CSCC 103');
  });

  it('allows the chairperson to manually select a different academic year from the dropdown', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const yearSelect = screen.getByLabelText(/select target academic year/i) as HTMLSelectElement;
    expect(yearSelect.value).toBe('2026-2027');

    // Manually switch to 2025-2026
    fireEvent.change(yearSelect, { target: { value: '2025-2026' } });
    expect(yearSelect.value).toBe('2025-2026');

    const file = createChairSheetFile([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', 'BSCS 2-1'],
    ]);

    const fileInput = screen.getByTestId('chair-sheet-file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /Approve & Create/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Approve Course Offerings/i)).toBeInTheDocument();
    });

    const commitBtn = screen.getByRole('button', { name: /Confirm & Create/i });
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(mockCreateCourse).toHaveBeenCalledTimes(1);
    });

    const coursePayload = mockCreateCourse.mock.calls[0][0];
    expect(coursePayload.schoolYear).toBe('2025-2026');
    expect(coursePayload.term).toContain('2025-2026');
  });
});
