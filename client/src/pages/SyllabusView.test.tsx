// @vitest-environment jsdom
// Task 6 (TDD RED): SyllabusView drives draft/published section editing
// through revision-aware context actions.
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { OfficialSyllabusData } from '../data/syllabusData';
import type { SyllabusRevisionHeader } from '../types/syllabusApi';

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
  revision: null as SyllabusRevisionHeader | null,
}));

vi.mock('../context/LMSContext', () => ({
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
    references: [],
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

import { SyllabusView, buildSourceDocumentValue } from './SyllabusView';

beforeEach(() => {
  mocks.revision = draftRev();
  for (const fn of [
    mocks.updateCourseSyllabus, mocks.updateSyllabusSection, mocks.publishSyllabusDraft,
    mocks.refreshPublishedSyllabus, mocks.removeCourseSyllabus, mocks.uploadCourseFile,
    mocks.updateCourseGradingTerms, mocks.showAlert, mocks.showConfirm,
  ]) {
    fn.mockReset();
  }
  mocks.updateSyllabusSection.mockResolvedValue(undefined);
  mocks.updateCourseSyllabus.mockResolvedValue(undefined);
  mocks.publishSyllabusDraft.mockResolvedValue(undefined);
  mocks.uploadCourseFile.mockResolvedValue({ id: 'file-1', courseId: 'c1' });
});

describe('SyllabusView revision editing', () => {
  test('draft revision renders the revision bar with status and number', () => {
    render(<SyllabusView courseId="c1" />);
    expect(screen.getByTestId('syllabus-revision-bar')).toBeInTheDocument();
    expect(screen.getByTestId('revision-status')).toHaveTextContent(/draft/i);
    expect(screen.getByTestId('revision-number')).toHaveTextContent(/revision 3/i);
  });

  test('published revisions are read-only until a draft is created', () => {
    mocks.revision = pubRev();
    render(<SyllabusView courseId="c1" />);
    expect(screen.getByTestId('revision-status')).toHaveTextContent(/published/i);
    expect(screen.getByTestId('revision-readonly')).toHaveTextContent(/read-only/i);
    for (const btn of screen.getAllByTitle('Edit section')) {
      expect(btn).toBeDisabled();
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

  test('uploaded source files attach the stored file id to the source-document section', () => {
    const linked = buildSourceDocumentValue(
      { fileName: 'syllabus.pdf', fileSize: '1 KB', fileType: 'pdf' as const },
      { id: 'file-1', fileDataUrl: '/syllabus.pdf' },
    );
    expect(linked).toMatchObject({ fileName: 'syllabus.pdf', courseFileId: 'file-1' });
    expect(linked.uploadedAt).toBeTruthy();
    render(<SyllabusView courseId="c1" />);
    expect(screen.getByTitle(/download/i)).toBeInTheDocument();
  });
});
