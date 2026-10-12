import { describe, expect, it } from 'vitest';
import {
  getAllCourses,
  getCourseById,
  getCourseByJoinCode,
  createCourse,
  updateCourse,
  getCourseSections,
  createEnrollmentRequest,
  getEnrollmentRequests,
} from '../likha/repositories/coursesRepo.js';

describe('Likha Courses Repository', () => {
  it('retrieves all seeded courses from Likha ERP', async () => {
    const courses = await getAllCourses();
    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBeGreaterThanOrEqual(2);
    const codes = courses.map((c: any) => c.code);
    expect(codes).toContain('CS 101');
    expect(codes).toContain('CS 102');
  });

  it('retrieves specific course by ID', async () => {
    const course = await getCourseById('c-cs101');
    expect(course).not.toBeNull();
    expect(course.code).toBe('CS 101');
    expect(course.title).toContain('Artificial Intelligence');
  });

  it('finds course by join code', async () => {
    const course = await getCourseByJoinCode('AI4A-2026');
    expect(course).not.toBeNull();
    expect(course.id).toBe('c-cs101');
  });

  it('retrieves course sections for a course', async () => {
    const sections = await getCourseSections('c-cs101');
    expect(Array.isArray(sections)).toBe(true);
  });

  it('creates and retrieves an enrollment request', async () => {
    const req = await createEnrollmentRequest({
      courseId: 'c-cs101',
      studentId: 'usr-stud-test',
      studentName: 'Test Student',
      type: 'self_join',
    });
    expect(req).toBeDefined();
    expect(req.courseId).toBe('c-cs101');

    const list = await getEnrollmentRequests('c-cs101');
    expect(Array.isArray(list)).toBe(true);
  });
});
