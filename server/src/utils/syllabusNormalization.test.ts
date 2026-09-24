import { describe, expect, it } from 'vitest';
import {
  normalizeSyllabus,
  normalizeSyllabusField,
  SyllabusNormalizationError,
} from './syllabusNormalization.js';

describe('syllabus normalization', () => {
  it('fills missing required sections and removes malformed list values', () => {
    const result = normalizeSyllabus({
      courseInfo: { code: 'CS 101', title: 'Introduction' },
      courseOutline: [
        { timeFrame: 'Prelim', title: 'Foundations', topics: ['Arrays', 7] },
      ],
    });

    expect(result.courseInfo).toEqual({
      code: 'CS 101',
      title: 'Introduction',
      semester: '',
      academicYear: '',
      type: '',
      credit: '',
      lectureHours: '',
      labHours: '',
      prerequisite: '',
      description: '',
    });
    expect(result.courseOutline).toEqual([
      { timeFrame: 'Prelim', title: 'Foundations', topics: ['Arrays'] },
    ]);
    expect(result.facultyMembers).toEqual([]);
    expect((result.institutionalStatements as { coreValues: unknown[] }).coreValues).toEqual([]);
  });

  it('serializes a valid JSON string and preserves optional data', () => {
    const serialized = normalizeSyllabusField(
      JSON.stringify({
        courseId: 'course-1',
        courseInfo: { code: 'CS 101' },
        sourceDocument: {
          fileName: 'syllabus.pdf',
          fileSize: '12 KB',
          fileType: 'pdf',
          uploadedAt: '2026-09-24',
        },
      }),
    );

    expect(serialized).not.toBeNull();
    expect(JSON.parse(serialized as string)).toMatchObject({
      courseId: 'course-1',
      courseInfo: { code: 'CS 101' },
      sourceDocument: {
        fileName: 'syllabus.pdf',
        fileSize: '12 KB',
        fileType: 'pdf',
        uploadedAt: '2026-09-24',
      },
    });
    expect(normalizeSyllabusField(null)).toBeNull();
  });

  it('rejects malformed JSON and non-object payloads', () => {
    expect(() => normalizeSyllabus('{bad')).toThrow(SyllabusNormalizationError);
    expect(() => normalizeSyllabus('[]')).toThrow(SyllabusNormalizationError);
    expect(() => normalizeSyllabus(42)).toThrow(SyllabusNormalizationError);
  });
});
