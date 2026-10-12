import { describe, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  detectCourseCode,
  detectCourseTitle,
  detectFacultyNames,
  validateSyllabusContent,
} from './syllabusParser';

// A generic course syllabus from outside DMMMSU: no "DMMMSU", no "INS-F003",
// uses common synonyms ("learning outcomes" instead of "course outcomes",
// "course plan" instead of "learning plan", "final examination" singular,
// "rubrics" plural). A real syllabus like this must not be rejected.
const GENERIC_SYLLABUS = `
  CS 101 - Introduction to Programming
  Course Description: Fundamentals of programming using Python.
  Course Objectives: Understand variables, control flow, and functions.
  Learning Outcomes: By the end of the course students will be able to
  write small programs, debug errors, and explain core concepts.
  Course Plan: Week 1-4 basics, Week 5-8 control structures, Week 9 midterm
  examination, Week 10-13 functions and modules, Week 14-17 mini project,
  Week 18 final examination.
  Assessment: Quizzes 30%, Laboratory exercises 30%, Midterm and Final
  examinations 40%. Grading scale follows the university handbook.
  References: Python Crash Course (2019). Course credit: 3 units, lecture
  3 hours per week. Prerequisite: None. Consultation hours: MWF 9-10am.
  Classroom policies: attendance is required. The following rubrics apply
  to the programming project.
`;

const NON_SYLLABUS = `
  Staff Meeting Minutes - March 3
  Attendees discussed the office pantry rota, parking assignments, and the
  upcoming team building lunch. Action items: order supplies, fix the
  pantry door, confirm catering numbers by Friday.
`;

describe('validateSyllabusContent', () => {
  test('accepts a generic non-DMMMSU course syllabus', () => {
    const v = validateSyllabusContent(GENERIC_SYLLABUS, 'CS101-Intro-Programming.pdf');
    expect(v.isSyllabus).toBe(true);
  });

  test('detects a form code split across document runs ("DMMMSU-INS-F00 3")', () => {
    const v = validateSyllabusContent(
      'Course Syllabus footer DMMMSU-INS-F00 3 REV. 02 Page 1 of 2',
      'syllabus-footer-check.txt'
    );
    expect(v.matchedKeywords).toContain('ins-f003 form code');
  });

  test('matches plural and synonym section names', () => {
    const v = validateSyllabusContent(
      'Course Syllabus. Learning Outcomes: students can explain concepts. ' +
        'Activities are graded with the following rubrics. Final examination is in week 18.',
      'syllabus-plural-check.txt'
    );
    expect(v.matchedKeywords).toContain('rubric');
    expect(v.matchedKeywords).toContain('finals term');
  });

  test('rejects a non-syllabus document', () => {
    const v = validateSyllabusContent(NON_SYLLABUS, 'meeting-minutes-march.txt');
    expect(v.isSyllabus).toBe(false);
  });

  test('accepts the CSPC103 reference syllabus body text', () => {
    const body = `
      Course Syllabus. CSPC 103 Introduction to Knowledge Management.
      DMMMSU Vision and Mission. Program Outcomes for BSCS graduates.
      Course Description: foundational understanding of Knowledge Management.
      Course Outcomes: define key concepts, identify knowledge types.
      Course Outline and Time Frame Week 1-4. Learning Plan with methodology
      and assessment. Grading System: 60% class standing and 40% major
      examinations. Classroom Policies and consultation hours. References:
      Dalkir (2017). Midterm examination week 9. Final examination week 18.
    `;
    const v = validateSyllabusContent(body, 'CSPC103-IKM-SYL-1stSemAY2026-2027.docx');
    expect(v.isSyllabus).toBe(true);
  });
});

describe('scan detectors', () => {
  const OTHER_DEPARTMENT_DOC = `
    Republic of the Philippines
    Course Syllabus
    Course Code: MATH 101 - Calculus I
    Course Description: Limits, derivatives, and integrals of functions.
    Prerequisite: None.
    Prepared by:
    JUAN D. CRUZ
    Associate Professor I
    Grading System: Term grade = 60% class standing + 40% term examination.
  `;

  test('detects a course code outside the hardcoded prefix list', () => {
    expect(detectCourseCode(OTHER_DEPARTMENT_DOC)).toBe('MATH - 101');
  });

  test('extracts the course title from the code line instead of the template default', () => {
    expect(detectCourseTitle(OTHER_DEPARTMENT_DOC)).toBe('Calculus I');
  });

  test('extracts an instructor name that is not in the hardcoded list', () => {
    const faculty = detectFacultyNames(OTHER_DEPARTMENT_DOC);
    expect(faculty.map(f => f.name)).toContain('JUAN D. CRUZ');
  });

  test('keeps existing behavior for known CCS documents', () => {
    const doc = 'CSPC 112 Software Engineering 2. Prepared by EZEKIEL O. BACUNGAN.';
    expect(detectCourseCode(doc)).toBe('CSPC - 112');
    expect(detectCourseTitle(doc)).toBe('Software Engineering 2');
    expect(detectFacultyNames(doc).map(f => f.name)).toContain('EZEKIEL O. BACUNGAN');
  });

  test('finds the instructor name separated from its label by blank lines', () => {
    const doc = [
      'Course Outcomes',
      'Define key concepts and principles.',
      'Prepared by:',
      '',
      '',
      '',
      '',
      'FLORIBETH P. CUISON',
      '',
      'Faculty Member',
      '',
      'Date: _____________',
      '',
      'Recommending Approval:',
    ].join('\n');
    expect(detectFacultyNames(doc).map(f => f.name)).toContain('FLORIBETH P. CUISON');
  });

  test('skips a title line after the label and takes the name below it', () => {
    const doc = ['Prepared by:', 'Faculty Member', 'JUAN D. CRUZ'].join('\n');
    expect(detectFacultyNames(doc).map(f => f.name)).toContain('JUAN D. CRUZ');
  });

  test('returns null when nothing detectable is present', () => {
    expect(detectCourseCode('plain text without codes')).toBeNull();
    expect(detectCourseTitle('plain text without codes')).toBeNull();
    expect(detectFacultyNames('plain text without names')).toEqual([]);
  });
});

describe('extractTextFromDocx', () => {
  test('extracts readable body text from the compressed reference DOCX', async () => {
    const { extractTextFromDocx, validateSyllabusContent: validate } = await import('./syllabusParser');
    const filePath = path.resolve(__dirname, '../../../../file-samples/syllabus/CSPC103-IKM-SYL-1stSemAY2026-2027.docx');
    const buffer = fs.readFileSync(filePath);
    const text = await extractTextFromDocx(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    // The reference DOCX stores its XML DEFLATE-compressed: extraction must
    // decode it (not return binary garbage) and include real syllabus content.
    expect(text.length).toBeGreaterThan(10000);
    expect(text).toMatch(/knowledge management/i);
    expect(text).toMatch(/course outcomes/i);
    expect(text).not.toContain('�');
    // The reported bug: uploading this reference syllabus was rejected as
    // "not a syllabus". Extracted text must validate.
    expect(validate(text, 'CSPC103-IKM-SYL-1stSemAY2026-2027.docx').isSyllabus).toBe(true);
  });

  test('accepts the scanned-image reference PDF via metadata signals', async () => {
    const { validateSyllabusContent: validate } = await import('./syllabusParser');
    const filePath = path.resolve(__dirname, '../../../../file-samples/syllabus/CMSC131_Course_Orientation.pdf');
    const buffer = fs.readFileSync(filePath);
    // Image-only PDF: no extractable text operators; validation must fall
    // back to PDF metadata + filename signals instead of rejecting it.
    const rawPdfSource = buffer.toString('latin1').slice(0, 60000);
    const v = validate('', 'CMSC131_Course_Orientation.pdf', rawPdfSource);
    expect(v.isScannedImage).toBe(true);
    expect(v.isSyllabus).toBe(true);
  });
});
