// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
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
];

const mockDepartments = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS', chairpersonId: 'u-chair-cs' },
];

let mockActiveCollegeSY = { year: '2026-2027', isActive: true };
let mockBaselineSY = { year: '2026-2027', isActive: true };
let mockBaselineSemester = 'Second';
let mockCollegeSemester = 'First';

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
  {
    id: 'u-fac-2',
    name: 'Raymund Ezekiel Dilan',
    firstName: 'Raymund',
    middleName: 'Ezekiel',
    lastName: 'Dilan',
    role: 'faculty',
    department: 'Department of Computer Science',
  },
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: {
      id: 'u-chair-cs',
      name: 'Chair Alice',
      role: 'admin',
      adminSubrole: 'chairperson',
      department: 'Department of Computer Science',
      collegeId: 'col-ccs',
    },
    activeRole: 'admin',
    db: {
      users: mockEligibleFaculty,
      courses: [],
    },
    colleges: mockColleges,
    departments: mockDepartments,
    getActiveSchoolYearForCollege: () => mockActiveCollegeSY,
    getBaselineSchoolYear: () => mockBaselineSY,
    baselineSemester: mockBaselineSemester,
    getActiveSemesterForCollege: () => mockCollegeSemester,
    createCourse: mockCreateCourse,
    showAlert: mockShowAlert,
  }),
}));

function createChairSheetFile(rows: any[][]) {
  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  const u8 = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([u8], 'chairsheet-semester-test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('ChairSheetSemesterBaselineMismatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveCollegeSY = { year: '2026-2027', isActive: true };
    mockBaselineSY = { year: '2026-2027', isActive: true };
    mockBaselineSemester = 'Second';
    mockCollegeSemester = 'First';
  });

  afterEach(() => {
    cleanup();
  });

  test('blocks the upload and explains the semester mismatch for a college that has never rolled over', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const banner = screen.getByTestId('assigned-courses-baseline-mismatch-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('Second Semester');
    expect(banner.textContent).toContain('First Semester');
    expect(banner.textContent).not.toContain('academic year baseline');

    const fileInput = screen.getByTestId('assigned-courses-file-input');
    expect(fileInput).toBeDisabled();

    const selectBtn = screen.getByRole('button', { name: /Select Assigned Courses File/i });
    expect(selectBtn).toBeDisabled();

    // Trigger restriction alert by dropping a file
    const file = createChairSheetFile([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'OOP', 'BSCS 2-1'],
    ]);

    const dropzone = screen.getByTestId('assigned-courses-dropzone');
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/University A\.Y\. & Semester Mismatch/i),
        message: expect.stringMatching(/semester/i),
        type: 'error',
      })
    );
    expect(mockShowAlert.mock.calls[0][0].message).not.toContain('academic year baseline');
  });

  test('names both axes when the academic year and the semester both differ', () => {
    mockActiveCollegeSY = { year: '2025-2026', isActive: true };
    mockBaselineSY = { year: '2026-2027', isActive: true };
    mockCollegeSemester = 'First';
    mockBaselineSemester = 'Second';

    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const banner = screen.getByTestId('assigned-courses-baseline-mismatch-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('AY 2026-2027');
    expect(banner.textContent).toContain('Second Semester');
  });

  test('stamps every created course with the college active semester', async () => {
    mockActiveCollegeSY = { year: '2026-2027', isActive: true };
    mockBaselineSY = { year: '2026-2027', isActive: true };
    mockCollegeSemester = 'Second';
    mockBaselineSemester = 'Second';

    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    expect(screen.getByTestId('assigned-courses-semester-display')).toHaveTextContent('Second Semester');

    const file = createChairSheetFile([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E'],
      ['Raymund', 'Ezekiel', 'Dilan', 'CSPC 112', 'Software Engineering 2', '4-E'],
    ]);

    const input = screen.getByTestId('assigned-courses-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /Approve & Create 2 Courses/i });
    fireEvent.click(approveBtn);

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Create/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockCreateCourse).toHaveBeenCalledTimes(2);
    });

    expect(mockCreateCourse).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        code: 'CSCC 103',
        term: '2nd Sem AY 2026-2027',
        semester: 'Second',
      })
    );

    expect(mockCreateCourse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        code: 'CSPC 112',
        term: '2nd Sem AY 2026-2027',
        semester: 'Second',
      })
    );
  });

  test('ignores a Semester column holding an unrecognized value', async () => {
    mockActiveCollegeSY = { year: '2026-2027', isActive: true };
    mockBaselineSY = { year: '2026-2027', isActive: true };
    mockCollegeSemester = 'Second';
    mockBaselineSemester = 'Second';

    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const file = createChairSheetFile([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section', 'Semester'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E', 'Summer'],
    ]);

    const input = screen.getByTestId('assigned-courses-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /Approve & Create 1 Course/i });
    fireEvent.click(approveBtn);

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Create/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockCreateCourse).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CSCC 103',
        term: '2nd Sem AY 2026-2027',
        semester: 'Second',
      })
    );
  });
});
