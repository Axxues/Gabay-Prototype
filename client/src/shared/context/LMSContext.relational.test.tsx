// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { normalizeCourse, normalizeSubmission, resolveDirectusAssetUrl, resolveDirectusUserName } from './LMSContext';
import { LIKHA_URL } from '../api/client';

describe('LMSContext Directus relational & media normalizers', () => {
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
