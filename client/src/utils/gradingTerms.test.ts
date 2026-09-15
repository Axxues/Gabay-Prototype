// client/src/utils/gradingTerms.test.ts
import { describe, expect, it } from 'vitest';
import { effectiveTerms, normalizeTermId, resolveCourseTerms } from './gradingTerms';

const outline = (title: string, topics: string[] = []) => ({ title, topics });

describe('resolveCourseTerms', () => {
  it('detects midterm + finals from exam-period entries', () => {
    expect(resolveCourseTerms({ courseOutline: [
      outline('Foundation'),
      outline('Midterm Examination Period', ['Midterm Examination']),
      outline('Final Examination Period', ['Final Examination']),
    ] })).toEqual(['midterm', 'finals']);
  });
  it('detects prelim when present, preserving outline order', () => {
    expect(resolveCourseTerms({ courseOutline: [
      outline('Preliminary Examination', ['Prelim Exam']),
      outline('Midterm Examination Period'),
      outline('Final Examination Period'),
    ] })).toEqual(['prelim', 'midterm', 'finals']);
  });
  it('defaults to midterm + finals when nothing detected', () => {
    expect(resolveCourseTerms({ courseOutline: [outline('Intro')] })).toEqual(['midterm', 'finals']);
    expect(resolveCourseTerms(null)).toEqual(['midterm', 'finals']);
  });
  it('maps legacy final to finals', () => {
    expect(normalizeTermId('final')).toBe('finals');
    expect(normalizeTermId('midterm')).toBe('midterm');
  });
});

describe('effectiveTerms', () => {
  it('prefers the per-course override', () => {
    expect(effectiveTerms({ gradingTerms: ['midterm'] }, { courseOutline: [outline('Final Examination Period')] }))
      .toEqual(['midterm']);
  });
  it('falls back to detection with no override', () => {
    expect(effectiveTerms({}, { courseOutline: [outline('Midterm Examination Period')] }))
      .toEqual(['midterm']);
  });
});
