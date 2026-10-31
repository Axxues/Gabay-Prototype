// @vitest-environment jsdom
// Task 6 (TDD RED): SyllabusView drives draft/published section editing
// through revision-aware context actions.
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import type { OfficialSyllabusData, ReferenceItem } from '../../shared/data/syllabusData';
import type { SyllabusRevisionHeader } from '../../shared/types/syllabusApi';

// Mutable per-test references for syllabusDoc(); read at call time inside the
// vi.mock factory closure so each test can inject its own fixture.
let testReferences: ReferenceItem[] = [];

const mocks = vi.hoisted(() => ({
  updateCourseSyllabus: vi.fn(),
  updateSyllabusSection: vi.fn(),
  publishSyllabusDraft: vi.fn(),
  refreshPublishedSyllabus: vi.fn(),
  removeCourseSyllabus: vi.fn(),
  uploadCourseFile: vi.fn(),
  updateCourseGradingTerms: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
  scanSyllabusDocument: vi.fn(),
  revision: null as SyllabusRevisionHeader | null,
}));

vi.mock('../../shared/utils/syllabusParser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/utils/syllabusParser')>();
  return {
    ...actual,
    scanSyllabusDocument: (...args: unknown[]) => mocks.scanSyllabusDocument(...args),
  };
});

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: 'faculty',
    activeUser: { id: 'usr-fac-1', name: 'Faculty One', role: 'faculty', title: 'Instructor' },
    db: {
      users: [{ id: 'usr-fac-1', name: 'Faculty One', role: 'faculty', title: 'Instructor' }],
      courses: [
        {
          id: 'c1',
          code: 'CMSC 131',
          title: 'Course Title',
          section: 'BSCS 4-1',
          term: '1st Sem AY 2026-2027',
          instructorId: 'usr-fac-1',
          instructorName: 'Faculty One',
          published: true,
          syllabus: syllabusDoc(),
        },
      ],
    },
    syllabusRevisions: mocks.revision ? { c1: mocks.revision } : {},
    updateCourseSyllabus: mocks.updateCourseSyllabus,
    updateSyllabusSection: mocks.updateSyllabusSection,
    publishSyllabusDraft: mocks.publishSyllabusDraft,
    refreshPublishedSyllabus: mocks.refreshPublishedSyllabus,
    removeCourseSyllabus: mocks.removeCourseSyllabus,
    uploadCourseFile: mocks.uploadCourseFile,
    updateCourseGradingTerms: mocks.updateCourseGradingTerms,
    showAlert: mocks.showAlert,
    showConfirm: mocks.showConfirm,
  }),
}));

function syllabusDoc(): OfficialSyllabusData {
  return {
    courseId: 'c1',
    institution: { university: 'U', college: 'C', formCode: 'F', revision: 'R' },
    courseInfo: {
      code: 'CMSC 131', title: 'Course Title', semester: '1st Sem', academicYear: '2026-2027',
      type: 'Lecture', credit: '3', lectureHours: '3', labHours: '0', prerequisite: 'None', description: 'Desc',
    },
    facultyMembers: [{ name: 'Faculty One', sections: [{ section: 'BSCS 4-1', schedule: 'MF', room: 'R1' }], consultation: 'MWF' }],
    institutionalStatements: { philosophy: 'P', vision: 'V', mission: 'M', goal: 'G', coreValues: [], graduateAttributes: [] },
    programOutcomes: [{ number: 1, description: 'PO1' }],
    courseOutcomes: [{ number: 1, statement: 'CO1' }],
    courseRequirements: { major: ['M1'], other: [] },
    gradingSystem: { termFormula: 'T', finalFormula: 'F', classStandingComponents: [], passingGrade: '3.0' },
    projectRubrics: [],
    classroomPolicies: ['Be kind.'],
    courseOutline: [],
    learningPlan: [],
    courseMap: [],
    references: testReferences,
    signatories: {
      preparedBy: [{ name: 'Faculty One', title: 'Instructor' }],
      recommendingApproval: { name: '', title: '' },
      approved: { name: '', title: '' },
    },
    sourceDocument: {
      fileName: 'syllabus.pdf',
      fileSize: '1 KB',
      fileType: 'pdf',
      fileDataUrl: '/syllabus.pdf',
      uploadedAt: '2026-09-24T00:00:00.000Z',
    },
  };
}

const draftRev = (): SyllabusRevisionHeader => ({
  id: 'rev-draft-1', courseId: 'c1', revisionNo: 3, status: 'draft', schemaVersion: '1',
  rowVersion: 4, createdAt: '2026-09-24T00:00:00.000Z', updatedAt: '2026-09-24T00:00:00.000Z', publishedAt: null,
});

const pubRev = (): SyllabusRevisionHeader => ({
  ...draftRev(), id: 'rev-pub-1', revisionNo: 2, status: 'published', publishedAt: '2026-09-24T01:00:00.000Z',
});

import {
  SyllabusView,
  buildSourceDocumentValue,
  buildInstructorOptions,
  isCourseNumberMismatch,
  isCourseTitleMismatch,
  matchesPersonName,
} from './SyllabusView';

beforeEach(() => {
  mocks.revision = draftRev();
  for (const fn of [
    mocks.updateCourseSyllabus, mocks.updateSyllabusSection, mocks.publishSyllabusDraft,
    mocks.refreshPublishedSyllabus, mocks.removeCourseSyllabus, mocks.uploadCourseFile,
    mocks.updateCourseGradingTerms, mocks.showAlert, mocks.showConfirm, mocks.scanSyllabusDocument,
  ]) {
    fn.mockReset();
  }
  mocks.updateSyllabusSection.mockResolvedValue(undefined);
  mocks.updateCourseSyllabus.mockResolvedValue(undefined);
  mocks.publishSyllabusDraft.mockResolvedValue(undefined);
  mocks.uploadCourseFile.mockResolvedValue({ id: 'file-1', courseId: 'c1' });
});

describe('SyllabusView revision editing', () => {
  afterEach(() => {
    cleanup();
    testReferences = [];
  });
  test('draft revision renders the revision bar with status and number', () => {
    render(<SyllabusView courseId="c1" />);
    expect(screen.getByTestId('syllabus-revision-bar')).toBeInTheDocument();
    expect(screen.getByTestId('revision-status')).toHaveTextContent(/draft/i);
    expect(screen.getByTestId('revision-number')).toHaveTextContent(/revision 3/i);
  });

  test('references section commit stores references alphabetically', async () => {
    const bookRef = { citation: 'Laplante, P. (2023). Zed Engineering. CRC Press.', authors: 'Laplante, P.', year: '2023', title: 'Zed Engineering', publisher: 'CRC Press' };
    const alonzoRef = { citation: 'Alonzo, A. (2022). Alpha Design. MIT Press.', authors: 'Alonzo, A.', year: '2022', title: 'Alpha Design', publisher: 'MIT Press' };
    testReferences = [bookRef, alonzoRef];
    render(<SyllabusView courseId="c1" />);
    const editButtons = screen.getAllByTitle('Edit section');
    fireEvent.click(editButtons[editButtons.length - 1]!); // referencesSignatures is the last section
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mocks.updateSyllabusSection).toHaveBeenCalled());
    const refCall = mocks.updateSyllabusSection.mock.calls.find(c => c[1] === 'references')!;
    expect((refCall[2] as { authors: string }[]).map(r => r.authors)).toEqual(['Alonzo, A.', 'Laplante, P.']);
  });

  test('saved references render with APA italics', () => {
    testReferences = [{ citation: 'Laplante, P. (2023). Zed Engineering. CRC Press.', authors: 'Laplante, P.', year: '2023', title: 'Zed Engineering', publisher: 'CRC Press' }];
    render(<SyllabusView courseId="c1" />);
    // Expand the References & Signatures section (collapsed by default)
    fireEvent.click(screen.getByText(/Official Textbook References & Institutional Approvals/i));
    expect(screen.getByText('Zed Engineering').closest('em')).not.toBeNull();
  });

  test('published revisions are read-only until a draft is created', () => {
    mocks.revision = pubRev();
    render(<SyllabusView courseId="c1" />);
    expect(screen.getByTestId('revision-status')).toHaveTextContent(/published/i);
    expect(screen.getByTestId('revision-readonly')).toHaveTextContent(/read-only/i);
    // Pencils are visibly inactive while published.
    for (const btn of screen.getAllByTitle('Edit section')) {
      expect(btn).toBeDisabled();
      expect((btn as HTMLElement).className).toMatch(/disabled:opacity-40/);
    }
    fireEvent.click(screen.getByTestId('revision-create-draft'));
    expect(mocks.updateCourseSyllabus).toHaveBeenCalledTimes(1);
    expect(mocks.updateCourseSyllabus.mock.calls[0]?.[0]).toBe('c1');
  });

  test('saving one editor section sends only that section', async () => {
    render(<SyllabusView courseId="c1" />);
    fireEvent.click(screen.getAllByTitle('Edit section')[0]!);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mocks.updateSyllabusSection).toHaveBeenCalledTimes(1));
    expect(mocks.updateSyllabusSection).toHaveBeenCalledWith(
      'c1', 'faculty', expect.any(Array),
    );
    expect(mocks.updateCourseSyllabus).not.toHaveBeenCalled();
  });

  test('a failed section save keeps the previous document visible and alerts', async () => {
    mocks.updateSyllabusSection.mockRejectedValueOnce(new Error('The syllabus revision changed.'));
    render(<SyllabusView courseId="c1" />);
    fireEvent.click(screen.getAllByTitle('Edit section')[0]!);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(mocks.showAlert).toHaveBeenCalled());
    expect(mocks.showAlert.mock.calls[0]?.[0]).toMatch(/changed|conflict/i);
    expect(screen.getByText('Course Title')).toBeInTheDocument();
  });

  test('publishing a draft asks for confirmation first', async () => {
    mocks.showConfirm.mockImplementation(((_message: string, onConfirm: () => void) => {
      onConfirm();
    }) as never);
    render(<SyllabusView courseId="c1" />);
    fireEvent.click(screen.getByTestId('revision-publish'));
    expect(mocks.showConfirm).toHaveBeenCalledTimes(1);
    expect(String(mocks.showConfirm.mock.calls[0]?.[0])).toMatch(/publish/i);
    await waitFor(() => expect(mocks.publishSyllabusDraft).toHaveBeenCalledWith('c1'));
  });

  test('instructor options list detected names and never template faculty as scanned', () => {
    const scanResult = {
      detectedFacultyNames: ['Floribeth P. Cuison', 'Institute Director'],
      syllabus: {
        facultyMembers: [{ name: 'Ezekiel O. Bacungan' }, { name: 'Raymund E. Dilan' }],
      },
    } as never;
    const options = buildInstructorOptions(scanResult, []);
    expect(options.map(o => o.name)).toEqual(['Floribeth P. Cuison']);
    expect(options[0]).toMatchObject({ id: 'scanned:Floribeth P. Cuison' });
  });

  test('instructor options match detected names to system faculty users', () => {
    const scanResult = { detectedFacultyNames: ['Faculty One'] } as never;
    const options = buildInstructorOptions(scanResult, [
      { id: 'usr-fac-1', name: 'Faculty One', title: 'Instructor' },
    ]);
    expect(options).toEqual([
      { id: 'usr-fac-1', name: 'Faculty One', label: 'Faculty One — Instructor' },
    ]);
  });

  test('uploaded source files attach the stored file id to the source-document section', () => {
    const linked = buildSourceDocumentValue(
      { fileName: 'syllabus.pdf', fileSize: '1 KB', fileType: 'pdf' as const },
      { id: 'file-1', fileDataUrl: '/syllabus.pdf' },
    );
    expect(linked).toMatchObject({ fileName: 'syllabus.pdf', courseFileId: 'file-1' });
    expect(linked.uploadedAt).toBeTruthy();
    render(<SyllabusView courseId="c1" />);
    expect(screen.getAllByTitle(/download/i)[0]).toBeInTheDocument();
  });

  describe('course mismatch and faculty auto-match detection', () => {
    test('isCourseNumberMismatch flags distinct course codes and ignores dash/space variations', () => {
      expect(isCourseNumberMismatch('CSPC 112', 'CSPC - 103')).toBe(true);
      expect(isCourseNumberMismatch('CSPC 112', 'CSPC - 112')).toBe(false);
      expect(isCourseNumberMismatch('CS 101', 'CS101')).toBe(false);
      expect(isCourseNumberMismatch(undefined, 'CSPC 112')).toBe(false);
    });

    test('isCourseTitleMismatch flags distinct titles and normalizes roman numerals', () => {
      expect(isCourseTitleMismatch('Software Engineering 2', 'Information and Knowledge Management')).toBe(true);
      expect(isCourseTitleMismatch('Software Engineering 2', 'Software Engineering II')).toBe(false);
      expect(isCourseTitleMismatch('Software Engineering 2', 'Software Engineering 2 (Laboratory)')).toBe(false);
      expect(isCourseTitleMismatch(undefined, 'Software Engineering 2')).toBe(false);
    });

    test('matchesPersonName compares faculty names ignoring middle initials and academic honorifics', () => {
      expect(matchesPersonName('Floribeth P. Cuison', 'Floribeth Cuison')).toBe(true);
      expect(matchesPersonName('Dr. Charlie S. Marzan', 'Charlie Marzan')).toBe(true);
      expect(matchesPersonName('Jayvee G. Reyes', 'Jayvee Reyes')).toBe(true);
      expect(matchesPersonName('Floribeth P. Cuison', 'Charlie S. Marzan')).toBe(false);
    });

    test('buildInstructorOptions does NOT include assigned course instructor if not scanned in syllabus', () => {
      const scanResult = {
        detectedFacultyNames: ['Floribeth P. Cuison'],
      } as never;
      const options = buildInstructorOptions(scanResult, [], {
        instructorId: 'usr-fac-assigned',
        instructorName: 'Reymund Ezekiel Dilan',
      });
      expect(options.some(o => o.name === 'Reymund Ezekiel Dilan')).toBe(false);
      expect(options.some(o => o.name === 'Floribeth P. Cuison')).toBe(true);
    });

    test('buildInstructorOptions labels assigned course instructor when scanned in syllabus', () => {
      const scanResult = {
        detectedFacultyNames: ['Reymund Ezekiel Dilan'],
      } as never;
      const options = buildInstructorOptions(scanResult, [], {
        instructorId: 'usr-fac-assigned',
        instructorName: 'Reymund Ezekiel Dilan',
      });
      expect(options).toEqual([
        {
          id: 'usr-fac-assigned',
          name: 'Reymund Ezekiel Dilan',
          label: 'Reymund Ezekiel Dilan — Assigned Course Instructor',
        },
      ]);
    });

    test('scanned syllabus with course code/title mismatch displays warning tab and auto-matches assigned instructor', async () => {
      mocks.scanSyllabusDocument.mockResolvedValue({
        success: true,
        fileName: 'CSPC103_Syllabus.docx',
        fileSize: '250 KB',
        fileType: 'docx',
        detectedCourseCode: 'CSPC 103',
        detectedCourseTitle: 'Information and Knowledge Management',
        detectedFacultyNames: ['Faculty One'],
        validation: { isSyllabus: true, confidence: 95, reasons: [], isScannedImage: false },
        stats: { outcomesCount: 3, learningWeeksCount: 18, rubricsCount: 1, referencesCount: 5 },
        rawTextPreview: 'Preview',
        syllabus: syllabusDoc(),
      });

      render(<SyllabusView courseId="c1" />);
      fireEvent.click(screen.getByRole('button', { name: /upload & scan syllabus/i }));

      const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const fakeFile = new File(['dummy content'], 'CSPC103_Syllabus.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      await waitFor(() => {
        expect(screen.getByTestId('syllabus-course-mismatch-warning')).toBeInTheDocument();
      });

      expect(screen.getByText(/Course Number & Descriptive Title Mismatch/i)).toBeInTheDocument();
      expect(screen.getByText('CSPC 103')).toBeInTheDocument();
      expect(screen.getByText('Information and Knowledge Management')).toBeInTheDocument();
      expect(screen.getByText('Auto-Matched')).toBeInTheDocument();
      expect(screen.getByText('Course Faculty Auto-Detected in Syllabus')).toBeInTheDocument();
    });

    test('syllabus with non-matching faculty auto-detects scanned faculty and does not scan the course instructor', async () => {
      mocks.scanSyllabusDocument.mockResolvedValue({
        success: true,
        fileName: 'Syllabus.docx',
        fileSize: '200 KB',
        fileType: 'docx',
        detectedCourseCode: 'CMSC 131',
        detectedCourseTitle: 'Course Title',
        detectedFacultyNames: ['Floribeth P. Cuison', 'Charlie S. Marzan'],
        validation: { isSyllabus: true, confidence: 95, reasons: [], isScannedImage: false },
        stats: { outcomesCount: 3, learningWeeksCount: 18, rubricsCount: 1, referencesCount: 5 },
        rawTextPreview: 'Preview',
        syllabus: syllabusDoc(),
      });

      render(<SyllabusView courseId="c1" />);
      fireEvent.click(screen.getByRole('button', { name: /upload & scan syllabus/i }));

      const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
      const fakeFile = new File(['dummy'], 'Syllabus.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      await waitFor(() => {
        expect(screen.getAllByText('Floribeth P. Cuison').length).toBeGreaterThanOrEqual(1);
      });

      // Course faculty auto-detected with the scanned name
      expect(screen.getByText('Course Faculty Auto-Detected in Syllabus')).toBeInTheDocument();
      // The course instructor 'Faculty One' is not on the syllabus so they must not be an option
      expect(screen.queryByText(/Faculty One — Assigned Course Instructor/i)).not.toBeInTheDocument();
      expect(screen.getByText('Charlie S. Marzan')).toBeInTheDocument();
    });

    test('clicking apply syllabus calls updateCourseSyllabus and shows success', async () => {
      mocks.scanSyllabusDocument.mockResolvedValue({
        success: true,
        fileName: 'Syllabus.docx',
        fileSize: '200 KB',
        fileType: 'docx',
        detectedCourseCode: 'CMSC 131',
        detectedCourseTitle: 'Course Title',
        detectedFacultyNames: ['Floribeth P. Cuison'],
        validation: { isSyllabus: true, confidence: 95, reasons: [], isScannedImage: false },
        stats: { outcomesCount: 3, learningWeeksCount: 18, rubricsCount: 1, referencesCount: 5 },
        rawTextPreview: 'Preview',
        syllabus: syllabusDoc(),
      });

      render(<SyllabusView courseId="c1" />);
      fireEvent.click(screen.getByRole('button', { name: /upload & scan syllabus/i }));

      const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
      const fakeFile = new File(['dummy'], 'Syllabus.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /apply syllabus/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /apply syllabus/i }));

      await waitFor(() => {
        expect(mocks.updateCourseSyllabus).toHaveBeenCalledWith('c1', expect.anything());
        expect(mocks.showAlert).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Syllabus Updated Successfully' })
        );
      });
    });
  });
});
