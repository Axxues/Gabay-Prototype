import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCourseGrades, upsertCourseGrade } from './gradesRepo.js';

describe('Grades Relational Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('aggregates relational spr_cells into grade records', async () => {
    const mockGrades = [{ id: 'cg-1', course_id: 'c1', student_id: 's1', midterm_grade: 92 }];
    const mockCells = [{ course_grade_id: 'cg-1', term: 'midterm', component_key: 'q1', score: 10 }];

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/auth/login')) {
        return {
          ok: true,
          json: async () => ({ data: { access_token: 'fake-token', expires: 900000 } }),
        } as any;
      }
      if (u.includes('/items/course_grades?')) {
        return { ok: true, json: async () => ({ data: mockGrades }) } as any;
      }
      if (u.includes('/items/spr_cells?')) {
        return { ok: true, json: async () => ({ data: mockCells }) } as any;
      }
      return { ok: true, json: async () => ({ data: [] }) } as any;
    });

    const grades = await getCourseGrades('c1');
    expect(grades.length).toBe(1);
    const parsedCells = typeof grades[0].sprCells === 'string' ? JSON.parse(grades[0].sprCells) : grades[0].sprCells;
    expect(parsedCells?.midtermScores?.q1).toBe(10);
  });
});
