// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as xlsx from 'xlsx';
import type { User } from '../../../shared/types/lms';
import {
  parseChairSheet,
  matchFaculty,
  validateChairSheetRows,
  type RawChairSheetRow,
} from './chairSheetParser';

describe('chairSheetParser', () => {
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
      id: 'u-chair',
      name: 'Alice Chair Reyes',
      firstName: 'Alice',
      middleName: 'Chair',
      lastName: 'Reyes',
      email: 'chair@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'chairperson',
      department: 'Department of Computer Science',
      title: 'Department Chairperson',
      avatar: '',
    },
    {
      id: 'u-dean',
      name: 'Bob Dean Santos',
      firstName: 'Bob',
      middleName: 'Dean',
      lastName: 'Santos',
      email: 'dean@dmmmsu.edu.ph',
      role: 'admin',
      adminSubrole: 'dean',
      department: 'College of Computer Science',
      title: 'Dean',
      avatar: '',
    },
    {
      id: 'u-student',
      name: 'John Student Doe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'student@dmmmsu.edu.ph',
      role: 'student',
      department: 'Department of Computer Science',
      title: 'Student',
      avatar: '',
    },
  ];

  it('parses raw Excel data buffer and trims whitespace', () => {
    // Generate a test workbook in memory
    const data = [
      ['First Name', 'Middle Name', 'Last Name', 'Course Code', 'Descriptive Title', 'Year and Section'],
      ['Charlie ', 'Seli', 'Marzan', 'CSCC 103', 'Object Oriented Programming', '4-E'],
      ['Raymund', ' Ezekiel ', 'Dilan', 'CSPC 112', 'Software Engineering 2', '4-E '],
    ];
    const ws = xlsx.utils.aoa_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });

    const rows = parseChairSheet(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      firstName: 'Charlie',
      middleName: 'Seli',
      lastName: 'Marzan',
      courseCode: 'CSCC 103',
      descriptiveTitle: 'Object Oriented Programming',
      yearAndSection: '4-E',
    });
    expect(rows[1]).toEqual({
      firstName: 'Raymund',
      middleName: 'Ezekiel',
      lastName: 'Dilan',
      courseCode: 'CSPC 112',
      descriptiveTitle: 'Software Engineering 2',
      yearAndSection: '4-E',
    });
  });

  it('matches faculty accurately against eligible faculty, chair, and dean roles', () => {
    const row1: RawChairSheetRow = {
      firstName: 'Charlie',
      middleName: 'Seli',
      lastName: 'Marzan',
      courseCode: 'CSCC 103',
      descriptiveTitle: 'OOP',
      yearAndSection: '4-E',
    };
    const res1 = matchFaculty(row1, mockUsers);
    expect(res1.status).toBe('valid');
    expect(res1.user?.id).toBe('u-charlie');

    // Chair can also be assigned courses
    const rowChair: RawChairSheetRow = {
      firstName: 'Alice',
      middleName: 'Chair',
      lastName: 'Reyes',
      courseCode: 'CSCC 101',
      descriptiveTitle: 'Intro to CS',
      yearAndSection: '1-A',
    };
    const resChair = matchFaculty(rowChair, mockUsers);
    expect(resChair.status).toBe('valid');
    expect(resChair.user?.id).toBe('u-chair');

    // Dean can also be assigned courses
    const rowDean: RawChairSheetRow = {
      firstName: 'Bob',
      middleName: '',
      lastName: 'Santos',
      courseCode: 'CSCC 201',
      descriptiveTitle: 'Data Structures',
      yearAndSection: '2-B',
    };
    const resDean = matchFaculty(rowDean, mockUsers);
    expect(resDean.status).toBe('valid');
    expect(resDean.user?.id).toBe('u-dean');
  });

  it('does NOT match students as faculty instructors', () => {
    const rowStudent: RawChairSheetRow = {
      firstName: 'John',
      middleName: '',
      lastName: 'Doe',
      courseCode: 'CSCC 101',
      descriptiveTitle: 'Intro to CS',
      yearAndSection: '1-A',
    };
    const res = matchFaculty(rowStudent, mockUsers);
    expect(res.status).toBe('invalid');
    expect(res.error).toMatch(/not found/i);
  });

  it('detects typos/misspellings and provides a suggestion when close match exists', () => {
    const rowTypo: RawChairSheetRow = {
      firstName: 'Charly', // misspelled Charlie
      middleName: 'Seli',
      lastName: 'Marzan',
      courseCode: 'CSCC 103',
      descriptiveTitle: 'OOP',
      yearAndSection: '4-E',
    };
    const res = matchFaculty(rowTypo, mockUsers);
    expect(res.status).toBe('invalid');
    expect(res.suggestion?.id).toBe('u-charlie');
    expect(res.error).toMatch(/misspelled|spelled wrongly/i);
  });

  it('validates a batch of chair sheet rows with checklistStatus placeholder ready', () => {
    const rows: RawChairSheetRow[] = [
      {
        firstName: 'Charlie',
        middleName: 'Seli',
        lastName: 'Marzan',
        courseCode: 'CSCC 103',
        descriptiveTitle: 'OOP',
        yearAndSection: '4-E',
      },
      {
        firstName: 'Unknown',
        middleName: '',
        lastName: 'Professor',
        courseCode: 'CSCC 999',
        descriptiveTitle: 'Ghost Class',
        yearAndSection: '4-Z',
      },
    ];

    const validated = validateChairSheetRows(rows, mockUsers);
    expect(validated).toHaveLength(2);
    expect(validated[0].facultyStatus).toBe('valid');
    expect(validated[0].matchedUser?.id).toBe('u-charlie');
    expect(validated[0].checklistStatus).toBe('unverified');

    expect(validated[1].facultyStatus).toBe('invalid');
    expect(validated[1].matchedUser).toBeUndefined();
    expect(validated[1].facultyErrorMessage).toBeTruthy();
  });
});
