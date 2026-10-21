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
];

const mockDepartments = [
  { id: 'dept-cs', collegeId: 'col-ccs', name: 'Department of Computer Science', code: 'CS', chairpersonId: 'u-chair-cs' },
];

let mockActiveCollegeSY = { year: '2025-2026', isActive: true };
let mockBaselineSY = { year: '2026-2027', isActive: true };

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
    createCourse: mockCreateCourse,
    showAlert: mockShowAlert,
  }),
}));

function createChairSheetFile(rows: any[][]) {
  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
  const u8 = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([u8], 'chairsheet-mismatch.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('Chair-Sheet Upload Baseline School Year Mismatch Restriction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveCollegeSY = { year: '2025-2026', isActive: true };
    mockBaselineSY = { year: '2026-2027', isActive: true };
  });

  afterEach(() => {
    cleanup();
  });

  it('prevents chair from uploading assigned courses when baseline does not match college school year', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    // 1. Verify warning banner is displayed
    const banner = screen.getByTestId('assigned-courses-baseline-mismatch-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('AY 2025-2026');
    expect(banner.textContent).toContain('AY 2026-2027');
    expect(banner.textContent).toContain('Upload Blocked');

    // 2. Verify header mismatch badge
    const badge = screen.getByTestId('assigned-courses-baseline-mismatch-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('AY 2026-2027');

    // 3. Verify file input is disabled
    const fileInput = screen.getByTestId('assigned-courses-file-input');
    expect(fileInput).toBeDisabled();

    // 4. Verify Select File button is disabled and titled with restriction explanation
    const selectBtn = screen.getByRole('button', { name: /Select Assigned Courses File/i });
    expect(selectBtn).toBeDisabled();
    expect(selectBtn).toHaveAttribute('title', expect.stringContaining('differs from the University A.Y.'));

    // 5. Dropping a file on the dropzone triggers restriction alert and does not process
    const file = createChairSheetFile([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', 'BSCS 2-1'],
    ]);

    const dropzone = screen.getByTestId('assigned-courses-dropzone');
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Upload Restricted/i),
        type: 'error',
      })
    );

    // 6. Direct file input change also triggers restriction alert
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/Upload Restricted/i),
        type: 'error',
      })
    );

    // Verify course creation was NEVER called
    expect(mockCreateCourse).not.toHaveBeenCalled();
    expect(screen.queryByText(/Approve & Create/i)).not.toBeInTheDocument();
  });

  it('allows chair to upload and generate courses when college school year matches the baseline', async () => {
    // Set college active year to match baseline
    mockActiveCollegeSY = { year: '2026-2027', isActive: true };
    mockBaselineSY = { year: '2026-2027', isActive: true };

    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    // 1. Verify warning banner and badge are NOT present
    expect(screen.queryByTestId('assigned-courses-baseline-mismatch-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('assigned-courses-baseline-mismatch-badge')).not.toBeInTheDocument();

    // 2. Verify file input and select button are enabled
    const fileInput = screen.getByTestId('assigned-courses-file-input');
    expect(fileInput).not.toBeDisabled();

    const selectBtn = screen.getByRole('button', { name: /Select Assigned Courses File/i });
    expect(selectBtn).not.toBeDisabled();

    // 3. Upload file
    const file = createChairSheetFile([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', 'BSCS 2-1'],
    ]);

    fireEvent.change(fileInput, { target: { files: [file] } });

    // 4. Verify preview table loads
    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /Approve & Create/i });
    expect(approveBtn).not.toBeDisabled();
    fireEvent.click(approveBtn);

    const commitBtn = screen.getByRole('button', { name: /Confirm & Create/i });
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(mockCreateCourse).toHaveBeenCalledTimes(1);
    });
    expect(mockCreateCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CSCC 103',
        schoolYear: '2026-2027',
      })
    );
  });
});
