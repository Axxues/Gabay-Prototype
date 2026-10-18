// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import type { User, Course } from '../../shared/types/lms';
import { parseChairSheet, validateChairSheetRows } from './utils/chairSheetParser';
import { ChairSheetUploadView } from './components/ChairSheetUploadView';

const realSamplePath = path.resolve(__dirname, '../../../../file-samples/chair-sheet/chair-sheet.xlsx');

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
    title: 'Assistant Professor',
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
    title: 'Associate Professor',
    avatar: '',
  },
  {
    id: 'u-jayvee',
    name: 'Jayvee Geneta Reyes',
    firstName: 'Jayvee',
    middleName: 'Geneta',
    lastName: 'Reyes',
    email: 'jreyes@dmmmsu.edu.ph',
    role: 'faculty',
    department: 'Department of Computer Science',
    title: 'Instructor',
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
const mockOnNavigateCourse = vi.fn();
const mockOnNavigateTab = vi.fn();

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: {
      id: 'u-chair-1',
      name: 'Alice Reyes',
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
    getActiveSchoolYearForCollege: () => ({ year: '2025-2026' }),
  }),
}));

describe('Chair-Sheet End-to-End Real Sample Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('reads the real chair-sheet.xlsx sample and accurately extracts all 3 courses and professors', () => {
    expect(fs.existsSync(realSamplePath)).toBe(true);
    const fileBuffer = fs.readFileSync(realSamplePath);
    const rows = parseChairSheet(fileBuffer);

    expect(rows).toHaveLength(4);

    // Row 0: Charlie Seli Marzan (trims 'Charlie ')
    expect(rows[0]).toEqual({
      firstName: 'Charlie',
      middleName: 'Seli',
      lastName: 'Marzan',
      courseCode: 'CSCC 103',
      descriptiveTitle: 'Object Oriented Programming',
      yearAndSection: '4-E',
    });

    // Row 1: Cherlie Seli Marzan (fuzzy matches Charlie Seli Marzan)
    expect(rows[1]).toEqual({
      firstName: 'Cherlie',
      middleName: 'Seli',
      lastName: 'Marzan',
      courseCode: 'CCSC 303',
      descriptiveTitle: 'Computer Programming 1',
      yearAndSection: '1-A',
    });

    // Row 2: Raymund Ezekiel Dilan
    expect(rows[2]).toEqual({
      firstName: 'Raymund',
      middleName: 'Ezekiel',
      lastName: 'Dilan',
      courseCode: 'CSPC 112',
      descriptiveTitle: 'Software Engineering 2',
      yearAndSection: '4-E',
    });

    // Row 3: Jayvee Geneta Reyes
    expect(rows[3]).toEqual({
      firstName: 'Jayvee',
      middleName: 'Geneta',
      lastName: 'Reyes',
      courseCode: 'CSCB 101',
      descriptiveTitle: 'test Course',
      yearAndSection: '3-A',
    });

    // Validate faculty matches: row 1 has 'Cherlie' typo, so it requires correction or suggests Charlie
    const validated = validateChairSheetRows(rows, mockUsers);
    expect(validated[0].facultyStatus).toBe('valid');
    expect(validated[0].matchedUser?.id).toBe('u-charlie');

    expect(validated[1].facultyStatus).toBe('invalid');
    expect(validated[1].suggestedUser?.id).toBe('u-charlie');

    expect(validated[2].facultyStatus).toBe('valid');
    expect(validated[2].matchedUser?.id).toBe('u-raymund');

    expect(validated[3].facultyStatus).toBe('valid');
    expect(validated[3].matchedUser?.id).toBe('u-jayvee');
  });

  it('uploads the real chair-sheet.xlsx through ChairSheetUploadView, gates on typo, and generates all 4 courses upon correction', async () => {
    render(
      <ChairSheetUploadView
        onNavigateCourse={mockOnNavigateCourse}
        onNavigateTab={mockOnNavigateTab}
      />
    );

    const fileBuffer = fs.readFileSync(realSamplePath);
    const file = new File([fileBuffer], 'chair-sheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const input = screen.getByTestId('chair-sheet-file-input');
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('CSCC 103')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CCSC 303')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CSPC 112')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CSCB 101')).toBeInTheDocument();
    });

    // 3 faculty matched, 1 typo ('Cherlie') flagged as Not Found / Spelled Wrongly
    expect(screen.getAllByText(/^Matched:/i)).toHaveLength(3);
    expect(screen.getByText(/Not Found \/ Spelled Wrongly/i)).toBeInTheDocument();

    // Save button gated
    const resolveBtn = screen.getByRole('button', { name: /Resolve Unmatched Faculty/i });
    expect(resolveBtn).toBeDisabled();

    // Fix typo in row 1: 'Cherlie' -> 'Charlie'
    const cherlieInput = screen.getByDisplayValue('Cherlie');
    fireEvent.change(cherlieInput, { target: { value: 'Charlie' } });

    // Now all 4 match
    await waitFor(() => {
      expect(screen.getAllByText(/^Matched:/i)).toHaveLength(4);
    });

    // Save button enabled
    const approveBtn = screen.getByRole('button', { name: /Approve & Create 4 Courses/i });
    expect(approveBtn).not.toBeDisabled();

    // Trigger approve
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockCreateCourse).toHaveBeenCalledTimes(4);
    });

    expect(mockCreateCourse).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        code: 'CSCC 103',
        title: 'Object Oriented Programming',
        section: '4-E',
        instructorId: 'u-charlie',
        instructorName: 'Charlie Seli Marzan',
      })
    );

    expect(mockCreateCourse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        code: 'CCSC 303',
        title: 'Computer Programming 1',
        section: '1-A',
        instructorId: 'u-charlie',
        instructorName: 'Charlie Seli Marzan',
      })
    );

    expect(mockCreateCourse).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        code: 'CSPC 112',
        title: 'Software Engineering 2',
        section: '4-E',
        instructorId: 'u-raymund',
        instructorName: 'Raymund Ezekiel Dilan',
      })
    );

    expect(mockCreateCourse).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        code: 'CSCB 101',
        title: 'test Course',
        section: '3-A',
        instructorId: 'u-jayvee',
        instructorName: 'Jayvee Geneta Reyes',
      })
    );

    expect(mockShowAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Courses Generated Successfully',
      })
    );
  });
});
