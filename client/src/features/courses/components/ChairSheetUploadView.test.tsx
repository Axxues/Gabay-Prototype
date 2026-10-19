// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import * as xlsx from 'xlsx';

if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}
import { ChairSheetUploadView } from './ChairSheetUploadView';
import type { User, Course } from '../../../shared/types/lms';

const mockUsers: User[] = [
  {
    id: 'u-charlie',
    name: 'Charlie Seli Marzan',
    firstName: 'Charlie',
    middleName: 'Seli',
    lastName: 'Marzan',
    email: 'cmarzan@dmmmsu.edu.ph',
    role: 'faculty',
    department: 'Department of Computer Science',
    title: 'Instructor',
    avatar: '',
  },
  {
    id: 'u-raymund',
    name: 'Raymund Ezekiel Dilan',
    firstName: 'Raymund',
    middleName: 'Ezekiel',
    lastName: 'Dilan',
    email: 'rdilan@dmmmsu.edu.ph',
    role: 'faculty',
    department: 'Department of Computer Science',
    title: 'Assistant Professor',
    avatar: '',
  },
  {
    id: 'u-chair-brody',
    name: 'Marcus Brody',
    firstName: 'Marcus',
    lastName: 'Brody',
    email: 'mbrody@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'chairperson',
    title: 'Program Chairperson',
    avatar: '',
  },
  {
    id: 'u-dean-eleanor',
    name: 'Dean Eleanor',
    firstName: 'Eleanor',
    lastName: 'Vance',
    email: 'evance@dmmmsu.edu.ph',
    role: 'admin',
    adminSubrole: 'dean',
    title: 'College Dean',
    avatar: '',
  },
  {
    id: 'u-admin-jayvee',
    name: 'Jayvee Admin',
    firstName: 'Jayvee',
    lastName: 'Admin',
    email: 'admin@dmmmsu.edu.ph',
    role: 'admin',
    title: 'System Administrator',
    avatar: '',
  },
];

const mockCreateCourse = vi.fn(async (data: Partial<Course>) => ({
  id: `crs-${data.code}`,
  code: data.code || '',
  title: data.title || '',
  section: data.section || '',
  instructorId: data.instructorId || '',
  instructorName: data.instructorName || '',
  published: true,
  term: data.term || '1st Sem AY 2025-2026',
  enrolledCount: 0,
}));

const mockShowAlert = vi.fn();
const mockShowConfirm = vi.fn();
const mockOnNavigateCourse = vi.fn();
const mockOnNavigateTab = vi.fn();

vi.mock('../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: {
      id: 'u-chair',
      name: 'Department Chair',
      role: 'admin',
      adminSubrole: 'chairperson',
      collegeId: 'col-ccs',
    },
    activeRole: 'admin',
    db: {
      users: mockUsers,
      courses: [],
    },
    createCourse: mockCreateCourse,
    showAlert: mockShowAlert,
    showConfirm: mockShowConfirm,
    getActiveSchoolYearForCollege: () => ({ year: '2025-2026' }),
  }),
}));

describe('ChairSheetUploadView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  function createTestWorkbookBuffer(rows: any[][]) {
    const ws = xlsx.utils.aoa_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const u8 = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
    return new File([u8], 'chair-sheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }

  it('renders upload dropzone initially', () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: /Upload Program Assigned Courses/i })).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop your/i)).toBeInTheDocument();
  });

  it('parses uploaded chair sheet and displays editable preview table with matched faculty', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const file = createTestWorkbookBuffer([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E'],
      ['Raymund', 'Ezekiel', 'Dilan', 'CSPC 112', 'Software Engineering 2', '4-E'],
    ]);

    const input = screen.getByTestId('assigned-courses-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CSPC 112')).toBeInTheDocument();
    });

    // Both rows matched
    expect(screen.getAllByText(/^Matched:/i)).toHaveLength(2);
    const approveBtn = screen.getByRole('button', { name: /Approve & Create 2 Courses/i });
    expect(approveBtn).not.toBeDisabled();

    // Click approve opens confirmation modal
    fireEvent.click(approveBtn);
    expect(screen.getByText('Approve Course Offerings')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to approve and initialize/i)).toBeInTheDocument();

    // Confirm creation
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Create/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockCreateCourse).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CSCC 103',
        title: 'Object Oriented Programming',
        section: '4-E',
        instructorId: 'u-charlie',
        instructorName: 'Charlie Seli Marzan',
      })
    );
  });

  it('gates saving when an unmatched faculty is present until edited', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const file = createTestWorkbookBuffer([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['CharlyTypo', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E'],
    ]);

    const input = screen.getByTestId('assigned-courses-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CharlyTypo')).toBeInTheDocument();
    });

    // Save button should be disabled
    expect(screen.getByText(/Cannot approve: 1 unmatched faculty/i)).toBeInTheDocument();
    const saveBtn = screen.getByRole('button', { name: /Resolve Unmatched Faculty/i });
    expect(saveBtn).toBeDisabled();

    // Edit the first name in the table
    const firstNameInput = screen.getByDisplayValue('CharlyTypo');
    fireEvent.change(firstNameInput, { target: { value: 'Charlie' } });

    // Live re-verification should mark it valid
    await waitFor(() => {
      expect(screen.getByText(/^Matched:/i)).toBeInTheDocument();
    });

    const approveBtn = screen.getByRole('button', { name: /Approve & Create 1 Course/i });
    expect(approveBtn).not.toBeDisabled();

    // Reupload button should be present in preview mode
    const reuploadBtn = screen.getByRole('button', { name: /Reupload/i });
    expect(reuploadBtn).toBeInTheDocument();
  });

  it('keeps the Approve button on the same non-wrapping row as Reupload, after it', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const file = createTestWorkbookBuffer([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E'],
    ]);

    fireEvent.change(screen.getByTestId('assigned-courses-file-input'), { target: { files: [file] } });

    const reuploadBtn = await screen.findByRole('button', { name: /Reupload/i });
    const approveBtn = screen.getByRole('button', { name: /Approve & Create 1 Course/i });

    // Approve sits after Reupload in the same action row
    expect(reuploadBtn.parentElement).toBe(approveBtn.parentElement);
    expect(
      reuploadBtn.compareDocumentPosition(approveBtn) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // ...and that row is never squeezed into wrapping at desktop widths
    const actionRow = approveBtn.parentElement as HTMLElement;
    expect(actionRow.className).toContain('shrink-0');
    expect(actionRow.className).toContain('flex-nowrap');
  });

  it('renders download template button in dropzone', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const downloadBtn = screen.getByRole('button', { name: /Download Template/i });
    expect(downloadBtn).toBeInTheDocument();
    expect(downloadBtn).not.toBeDisabled();
  });

  it('triggers confirmation modal when deleting a row with contents', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const file = createTestWorkbookBuffer([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E'],
    ]);

    const input = screen.getByTestId('assigned-courses-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /Delete course row 1/i });
    fireEvent.click(deleteBtn);

    // Modal appears and displays row info
    expect(screen.getByText('Delete Course Row')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();

    // Clicking cancel keeps the row and closes modal after exit animation
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Delete Course Row')).not.toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();

    // Clicking delete row again and confirming removes the row
    fireEvent.click(deleteBtn);
    expect(screen.getByText('Delete Course Row')).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: /^Delete$/i });
    fireEvent.click(confirmDeleteBtn);

    expect(screen.queryByDisplayValue('CSCC 103')).not.toBeInTheDocument();
  });

  it('excludes Chairperson, Dean, and Admin from the Faculty Verification picker dropdown', async () => {
    render(
      <ChairSheetUploadView
        onNavigateTab={mockOnNavigateTab}
        onNavigateCourse={mockOnNavigateCourse}
      />
    );

    const input = screen.getByTestId('assigned-courses-file-input');
    const file = createTestWorkbookBuffer([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E'],
    ]);

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
    });

    const facultySelect = screen.getByLabelText(/Assign registered faculty/i);
    const options = Array.from(facultySelect.querySelectorAll('option')).map(o => o.textContent);

    // Pure faculty must be in the options
    expect(options.some(t => t?.includes('Charlie Seli Marzan'))).toBe(true);
    expect(options.some(t => t?.includes('Raymund Ezekiel Dilan'))).toBe(true);

    // Administrative monitors must NOT be in the options
    expect(options.some(t => t?.includes('Marcus Brody'))).toBe(false);
    expect(options.some(t => t?.includes('Dean Eleanor'))).toBe(false);
    expect(options.some(t => t?.includes('Jayvee Admin'))).toBe(false);
  });

  it('displays Semester column, allows editing it, and generates course with corresponding term', async () => {
    render(
      <ChairSheetUploadView
        onNavigateTab={mockOnNavigateTab}
        onNavigateCourse={mockOnNavigateCourse}
      />
    );

    const input = screen.getByTestId('assigned-courses-file-input');
    const file = createTestWorkbookBuffer([
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section', 'Semester'],
      ['Charlie', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E', 'Second'],
    ]);

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
    });

    // Check table header
    expect(screen.getByRole('columnheader', { name: /^Semester$/i })).toBeInTheDocument();

    // Edit semester from 'Second' to 'Mid-Year'
    const semInput = screen.getByDisplayValue('Second');
    fireEvent.change(semInput, { target: { value: 'Mid-Year' } });
    expect(screen.getByDisplayValue('Mid-Year')).toBeInTheDocument();

    // Approve & Create
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
        title: 'Object Oriented Programming',
        section: '4-E',
        instructorId: 'u-charlie',
        instructorName: 'Charlie Seli Marzan',
        term: 'Midyear AY 2025-2026',
        semester: 'Mid-Year',
      })
    );
  });
});


