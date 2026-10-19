import { describe, it, expect } from 'vitest';
import { findMatchingSiblingCourses, normalizeSemester } from './crossSectionSync';
import type { Course } from '../types/lms';

describe('crossSectionSync', () => {
  const baseCourse: Course = {
    id: 'c1',
    code: 'CS 101',
    title: 'Data Structures and Algorithms',
    section: 'BSCS 3-1',
    term: '1st Semester',
    schoolYear: '2026-2027',
    instructorId: 'inst-1',
    instructorName: 'Dr. Santos',
    published: true,
    enrolledCount: 30,
  };

  it('normalizes semester strings accurately', () => {
    expect(normalizeSemester('1st Semester')).toBe('1st');
    expect(normalizeSemester('First Sem')).toBe('1st');
    expect(normalizeSemester('1st Sem AY 2026-2027')).toBe('1st');
    expect(normalizeSemester('2nd Semester')).toBe('2nd');
    expect(normalizeSemester('Second Sem')).toBe('2nd');
    expect(normalizeSemester('Summer')).toBe('summer');
    expect(normalizeSemester('Midyear')).toBe('summer');
    expect(normalizeSemester('')).toBe('');
    expect(normalizeSemester(undefined)).toBe('');
  });

  it('finds matching sibling courses with same code, title, schoolYear, semester, and instructor', () => {
    const sibling1: Course = {
      ...baseCourse,
      id: 'c2',
      section: 'BSCS 3-2',
    };
    const sibling2: Course = {
      ...baseCourse,
      id: 'c3',
      section: 'BSCS 3-3',
      // slight case variation in code/title to ensure normalization
      code: 'cs 101',
      title: 'data structures and algorithms',
    };
    const diffYear: Course = { ...baseCourse, id: 'c4', section: 'BSCS 3-4', schoolYear: '2025-2026' };
    const diffSem: Course = { ...baseCourse, id: 'c5', section: 'BSCS 3-5', term: '2nd Semester' };
    const diffInst: Course = { ...baseCourse, id: 'c6', section: 'BSCS 3-6', instructorId: 'inst-2' };
    const diffCode: Course = { ...baseCourse, id: 'c7', section: 'BSCS 3-7', code: 'CS 102' };
    const diffTitle: Course = { ...baseCourse, id: 'c8', section: 'BSCS 3-8', title: 'Algorithms' };

    const pool = [baseCourse, sibling1, sibling2, diffYear, diffSem, diffInst, diffCode, diffTitle];
    const matches = findMatchingSiblingCourses(baseCourse, pool, 'inst-1');

    expect(matches).toHaveLength(2);
    expect(matches.map(m => m.id)).toEqual(['c2', 'c3']);
  });

  it('returns empty array if current course has no siblings or pool is empty', () => {
    expect(findMatchingSiblingCourses(baseCourse, [baseCourse], 'inst-1')).toEqual([]);
    expect(findMatchingSiblingCourses(baseCourse, [], 'inst-1')).toEqual([]);
  });

  it('handles course.semester property if course.term is omitted', () => {
    const semCourse: Course = {
      ...baseCourse,
      id: 'c10',
      term: '',
      semester: '1st Semester',
    };
    const siblingSem: Course = {
      ...baseCourse,
      id: 'c11',
      section: 'BSCS 3-2',
      term: '',
      semester: '1st Semester',
    };
    const matches = findMatchingSiblingCourses(semCourse, [semCourse, siblingSem], 'inst-1');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('c11');
  });
});
