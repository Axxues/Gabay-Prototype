import { describe, expect, test, vi, beforeEach } from 'vitest';
import { likhaLmsApi } from '../../shared/api/likhaLmsApi';

describe('Assessment Persistence & Child Relations', () => {
  let capturedRequests: Array<{ url: string; options?: any }> = [];

  beforeEach(() => {
    capturedRequests = [];
    vi.restoreAllMocks();
    vi.spyOn(global, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const url = String(input);
      capturedRequests.push({ url, options: init });

      if (url.includes('/items/assessment_questions')) {
        if (!init?.method || init.method === 'GET') {
          return new Response(JSON.stringify({ data: [{ id: 'q-old-1' }] }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }

      if (url.includes('/items/rubric_criteria')) {
        if (!init?.method || init.method === 'GET') {
          return new Response(JSON.stringify({ data: [{ id: 'rub-old-1' }] }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }

      if (url.includes('/items/quizzes')) {
        const body = init?.body ? JSON.parse(init.body) : {};
        return new Response(JSON.stringify({ data: { id: body.id || 'quiz-1', ...body } }), { status: 200 });
      }

      if (url.includes('/items/activities')) {
        const body = init?.body ? JSON.parse(init.body) : {};
        return new Response(JSON.stringify({ data: { id: body.id || 'act-1', ...body } }), { status: 200 });
      }

      if (url.includes('/items/submissions')) {
        const body = init?.body ? JSON.parse(init.body) : {};
        return new Response(JSON.stringify({ data: { id: body.id || 'sub-1', ...body } }), { status: 200 });
      }

      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });
  });

  test('saveQuiz auto-calculates total_points from question points on create', async () => {
    const saved = await likhaLmsApi.assessments.saveQuiz({
      course_id: 'crs-1',
      title: 'Midterm Quiz',
      questions: [
        { id: 'q1', text: 'Question 1', points: 15 },
        { id: 'q2', text: 'Question 2', points: 25 },
      ],
    });

    const quizReq = capturedRequests.find(r => r.url.endsWith('/items/quizzes'));
    expect(quizReq).toBeDefined();
    const payload = JSON.parse(quizReq!.options.body);
    expect(payload.total_points).toBe(40);
    expect(saved.questions).toHaveLength(2);
  });

  test('saveQuiz atomically removes previous child questions when updating an existing quiz', async () => {
    await likhaLmsApi.assessments.saveQuiz({
      id: 'quiz-exist-1',
      course_id: 'crs-1',
      title: 'Updated Quiz',
      questions: [
        { id: 'q-new-1', text: 'New Question 1', points: 20 },
      ],
    });

    const deleteReq = capturedRequests.find(r =>
      r.url.endsWith('/items/assessment_questions') && r.options?.method === 'DELETE'
    );
    expect(deleteReq).toBeDefined();
    expect(JSON.parse(deleteReq!.options.body)).toEqual(['q-old-1']);

    const postReq = capturedRequests.find(r =>
      r.url.endsWith('/items/assessment_questions') && r.options?.method === 'POST'
    );
    expect(postReq).toBeDefined();
    const questionsBody = JSON.parse(postReq!.options.body);
    expect(questionsBody[0].question_text).toBe('New Question 1');
    expect(questionsBody[0].points).toBe(20);
  });

  test('saveActivity synchronizes total_points, attachments metadata, and atomic child questions', async () => {
    const saved = await likhaLmsApi.assessments.saveActivity({
      id: 'act-exist-1',
      course_id: 'crs-1',
      title: 'Lab Exercise 1',
      points_possible: 50,
      attachments: [
        {
          id: 'att-1',
          name: 'Starter.zip',
          size: '1.2 MB',
          url: 'https://gabay.zyberlab.com/assets/11111111-1111-1111-1111-111111111111',
          directus_files_id: '11111111-1111-1111-1111-111111111111',
        },
      ],
      rubric: [
        { id: 'r1', title: 'Code Quality', points: 30, max_points: 30 },
        { id: 'r2', title: 'Unit Tests', points: 20, max_points: 20 },
      ],
    });

    const actReq = capturedRequests.find(r => r.url.includes('/items/activities/act-exist-1'));
    expect(actReq).toBeDefined();
    const body = JSON.parse(actReq!.options.body);
    expect(body.total_points).toBe(50);
    expect(body.points_possible).toBeUndefined();
    expect(body.rubric).toHaveLength(2);
    expect(body.rubric[0].title).toBe('Code Quality');
    expect(body.file_name).toBe('Starter.zip');
    expect(body.attachments).toEqual([{ directus_files_id: '11111111-1111-1111-1111-111111111111' }]);
    expect(body.metadata?.attachments).toHaveLength(1);

    const rubricDelete = capturedRequests.find(r =>
      r.url.endsWith('/items/rubric_criteria') && r.options?.method === 'DELETE'
    );
    expect(rubricDelete).toBeDefined();
  });

  test('getActivitiesWithRelations falls back to rubric_criteria table when rubric column is missing', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (url.includes('/items/activities')) {
        return new Response(JSON.stringify({
          data: [{ id: 'act-legacy-1', title: 'Legacy Act', rubric: null }]
        }), { status: 200 });
      }
      if (url.includes('/items/rubric_criteria')) {
        return new Response(JSON.stringify({
          data: [{ id: 'rub-1', activity_id: 'act-legacy-1', title: 'Criterion 1', max_points: 20, order: 1 }]
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    });

    const activities = await likhaLmsApi.getActivitiesWithRelations('crs-1');
    expect(activities).toHaveLength(1);
    expect(activities[0].rubric_criteria).toHaveLength(1);
    expect(activities[0].rubric_criteria[0].title).toBe('Criterion 1');
  });

  test('getSubmissions expands file.* relation for student attachment metadata', async () => {
    await likhaLmsApi.submissions.getSubmissions('act-1', 'activity');
    const subReq = capturedRequests.find(r => r.url.includes('/items/submissions'));
    expect(subReq).toBeDefined();
    expect(subReq!.url).toContain('file.*');
  });

  test('submitActivity records directus file UUID and answers', async () => {
    const res = await likhaLmsApi.submitActivity({
      activity_id: 'act-1',
      student_id: 'usr-student-1',
      submission_type: 'file',
      file: '22222222-2222-2222-2222-222222222222',
      content: JSON.stringify({ fileName: 'MySolution.pdf', fileUrl: '/likha/assets/22222222-2222-2222-2222-222222222222' }),
      answers: { 'q1': 'Answer 1' },
    });

    expect(res).toBeDefined();
    const subReq = capturedRequests.find(r => r.url.endsWith('/items/submissions') && r.options?.method === 'POST');
    expect(subReq).toBeDefined();
    const subBody = JSON.parse(subReq!.options.body);
    expect(subBody.file).toBe('22222222-2222-2222-2222-222222222222');
    expect(subBody.submission_type).toBe('file');

    const ansReq = capturedRequests.find(r => r.url.endsWith('/items/submission_answers') && r.options?.method === 'POST');
    expect(ansReq).toBeDefined();
    const ansBody = JSON.parse(ansReq!.options.body);
    expect(ansBody[0].student_answer).toBe('Answer 1');
  });
});
