import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCourseActivities, createActivity, getQuizzes, createQuiz } from './assessmentsRepo.js';

describe('Assessments Relational Repository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('assembles activities with relational questions and rubric criteria', async () => {
    const mockActivity = {
      id: 'act-1',
      course_id: 'c-cs101',
      title: 'Lab 1',
      total_points: 100,
    };
    const mockQuestions = [
      { id: 'q-1', activity_id: 'act-1', question_text: 'Describe A*', question_type: 'essay', points: 50 },
    ];
    const mockRubrics = [
      { id: 'r-1', activity_id: 'act-1', title: 'Accuracy', description: 'Good implementation', max_points: 50 },
    ];

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/auth/login')) {
        return {
          ok: true,
          json: async () => ({ data: { access_token: 'fake-token', expires: 900000 } }),
        } as any;
      }
      if (u.includes('/items/activities?')) {
        return { ok: true, json: async () => ({ data: [mockActivity] }) } as any;
      }
      if (u.includes('/items/assessment_questions?')) {
        return { ok: true, json: async () => ({ data: mockQuestions }) } as any;
      }
      if (u.includes('/items/rubric_criteria?')) {
        return { ok: true, json: async () => ({ data: mockRubrics }) } as any;
      }
      return { ok: true, json: async () => ({ data: [] }) } as any;
    });

    const activities = await getCourseActivities('c-cs101');
    expect(activities.length).toBe(1);
    expect(activities[0].questions.length).toBe(1);
    expect(activities[0].questions[0].text).toBe('Describe A*');
    expect(activities[0].rubric.length).toBe(1);
    expect(activities[0].rubric[0].title).toBe('Accuracy');
  });

  it('persists questions and rubrics into relational assessment_questions and rubric_criteria', async () => {
    const postedCollections: Record<string, any[]> = {};

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, opts: any) => {
      const u = String(url);
      if (u.includes('/auth/login')) {
        return {
          ok: true,
          json: async () => ({ data: { access_token: 'fake-token', expires: 900000 } }),
        } as any;
      }
      if (opts?.method === 'POST') {
        const path = u.split('/items/')[1]?.split('?')[0];
        if (path) {
          if (!postedCollections[path]) postedCollections[path] = [];
          postedCollections[path].push(JSON.parse(opts.body));
        }
        return { ok: true, json: async () => ({ data: { id: 'act-new-1' } }) } as any;
      }
      return { ok: true, json: async () => ({ data: [] }) } as any;
    });

    await createActivity({
      id: 'act-new-1',
      courseId: 'c-cs101',
      title: 'Lab 1',
      questions: [{ text: 'Question 1', points: 10, type: 'essay' }],
      rubric: [{ title: 'Completeness', points: 10 }],
    });

    expect(postedCollections['activities']).toBeDefined();
    expect(postedCollections['assessment_questions']).toBeDefined();
    expect(postedCollections['assessment_questions'].length).toBe(1);
    expect(postedCollections['assessment_questions'][0].activity_id).toBe('act-new-1');
    expect(postedCollections['rubric_criteria']).toBeDefined();
    expect(postedCollections['rubric_criteria'].length).toBe(1);
    expect(postedCollections['rubric_criteria'][0].activity_id).toBe('act-new-1');
  });
});
