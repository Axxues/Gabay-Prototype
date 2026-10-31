// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { mapLikhaActivityRow, mapLikhaSubmissionRow, normalizeCourse, normalizeSubmission, resolveDirectusAssetUrl, resolveDirectusUserName } from './LMSContext';
import { LIKHA_URL } from '../api/client';

describe('LMSContext Directus relational & media normalizers', () => {
  test('maps snake_case assessment_type to camelCase assessmentType for every assessment view filter', () => {
    const scenarios: Array<{ assessment_type?: string; expected: string }> = [
      { assessment_type: 'assignment', expected: 'assignment' },
      { assessment_type: 'project', expected: 'project' },
      { assessment_type: 'presentation', expected: 'presentation' },
      { assessment_type: 'quiz', expected: 'quiz' },
      { assessment_type: 'activity', expected: 'activity' },
      { expected: 'activity' },
    ];
    for (const { assessment_type, expected } of scenarios) {
      const row = mapLikhaActivityRow({ id: 'act-1', course_id: 'c-101', title: 'T', assessment_type });
      expect(row.assessmentType).toBe(expected);
    }
  });

  test('falls back to metadata.assessmentType for legacy rows without the column', () => {
    const row = mapLikhaActivityRow({ id: 'act-2', course_id: 'c-101', metadata: { assessmentType: 'project' } });
    expect(row.assessmentType).toBe('project');
  });

  test('normalizes course with expanded instructor object and cover_image', () => {
    const rawCourse = {
      id: 'c-101',
      code: 'CS101',
      title: 'Intro to Computer Science',
      instructor: {
        id: 'user-faculty-1',
        first_name: 'Dr. Maria',
        last_name: 'Santos',
        email: 'faculty1@dmmmsu.edu.ph',
      },
      cover_image: {
        id: 'img-cs101-uuid',
        filename_download: 'cs101-cover.png',
      },
    };

    const course = normalizeCourse(rawCourse);
    expect(course.instructorId).toBe('user-faculty-1');
    expect(course.instructorName).toBe('Dr. Maria Santos');
    expect(course.image).toBe(`${LIKHA_URL}/assets/img-cs101-uuid`);
  });

  test('normalizes course when cover_image is a UUID string and instructor_id is string', () => {
    const rawCourse = {
      id: 'c-102',
      code: 'IT201',
      title: 'Web Systems',
      instructor_id: 'u-99',
      instructor_name: 'Prof. Gomez',
      cover_image: 'uuid-raw-image',
    };

    const course = normalizeCourse(rawCourse);
    expect(course.instructorId).toBe('u-99');
    expect(course.instructorName).toBe('Prof. Gomez');
    expect(course.image).toBe(`${LIKHA_URL}/assets/uuid-raw-image`);
  });

  test('normalizes submission with expanded student object and file attachment', () => {
    const rawSubmission = {
      id: 'sub-77',
      courseId: 'c-101',
      activityId: 'act-5',
      student: {
        id: 'student-uuid-42',
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        avatar: 'avatar-file-uuid',
      },
      file: {
        id: 'file-doc-123',
        filename_download: 'exercise1_delacruz.pdf',
      },
      grade: 95,
      status: 'graded',
    };

    const submission = normalizeSubmission(rawSubmission);
    expect(submission.studentId).toBe('student-uuid-42');
    expect(submission.studentName).toBe('Juan Dela Cruz');
    expect(submission.studentAvatar).toBe(`${LIKHA_URL}/assets/avatar-file-uuid`);
    expect(submission.submissionType).toBe('file');
    expect(submission.fileName).toBe('exercise1_delacruz.pdf');
    expect(submission.fileUrl).toBe(`${LIKHA_URL}/assets/file-doc-123`);
  });

  test('folds question-set answers from the submission_answers relation into content', () => {
    const mapped = mapLikhaSubmissionRow({
      id: 'sub-qa-1',
      activity_id: 'act-5',
      student_id: 'student-1',
      content: null,
      answers: [
        { id: 'sa-1', question_id: 'q-1', student_answer: 'Mitochondria' },
        { id: 'sa-2', question_id: 'q-2', student_answer: '42' },
      ],
    });

    expect(JSON.parse(mapped.content)).toEqual({ 'q-1': 'Mitochondria', 'q-2': '42' });
  });

  test('folds answers returned by the submit endpoint into content', () => {
    const mapped = mapLikhaSubmissionRow({
      id: 'sub-qa-2',
      activity_id: 'act-5',
      answers: [{ questionId: 'q-1', answer: 'Answer 1' }],
    });

    expect(JSON.parse(mapped.content)).toEqual({ 'q-1': 'Answer 1' });
  });

  test('keeps legacy JSON answer maps in content untouched', () => {
    const mapped = mapLikhaSubmissionRow({
      id: 'sub-legacy-1',
      activity_id: 'act-5',
      content: JSON.stringify({ 'q-9': 'Legacy answer' }),
    });

    expect(JSON.parse(mapped.content)).toEqual({ 'q-9': 'Legacy answer' });
  });

  test('resolveDirectusUserName formats first and last name or falls back gracefully', () => {
    expect(resolveDirectusUserName({ first_name: 'Ada', last_name: 'Lovelace' })).toBe('Ada Lovelace');
    expect(resolveDirectusUserName({ first_name: 'Alan' })).toBe('Alan');
    expect(resolveDirectusUserName(null, 'Fallback User')).toBe('Fallback User');
    expect(resolveDirectusUserName('string-id', 'Fallback User')).toBe('Fallback User');
  });

  test('resolveDirectusAssetUrl resolves null, relative, or object representations', () => {
    expect(resolveDirectusAssetUrl(null)).toBeUndefined();
    expect(resolveDirectusAssetUrl('https://example.com/banner.png')).toBe('https://example.com/banner.png');
    expect(resolveDirectusAssetUrl('/banner.png')).toBe('/banner.png');
    expect(resolveDirectusAssetUrl('uuid-asset-123')).toBe(`${LIKHA_URL}/assets/uuid-asset-123`);
    expect(resolveDirectusAssetUrl({ id: 'uuid-asset-456' })).toBe(`${LIKHA_URL}/assets/uuid-asset-456`);
  });
});
