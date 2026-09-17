// server/src/routes/assessments.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    quiz: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    activity: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    exam: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    quizQuestion: { create: vi.fn() },
    submission: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});

process.env.JWT_SECRET ??= 'test-secret';

import { prisma } from '../db.js';
import jwt from 'jsonwebtoken';
import express from 'express';
import { quizzesRouter, activitiesRouter, examsRouter, submissionsRouter } from './assessments.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/quizzes', quizzesRouter);
  a.use('/api/activities', activitiesRouter);
  a.use('/api/exams', examsRouter);
  a.use('/api', submissionsRouter);
  a.use(errorMiddleware);
  return a;
}

const course = { id: 'c1', instructorId: 'u-fac' };
const quizRow = {
  id: 'qz1',
  courseId: 'c1',
  title: 'Quiz 1',
  questions: [
    {
      id: 'qq1',
      quizId: 'qz1',
      text: 'What?',
      type: 'multiple_choice',
      options: JSON.stringify(['A', 'B']),
      correctAnswer: 'A',
      points: 5,
    },
  ],
};

describe('assessments router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u-stu',
      name: 'Stu',
      avatar: 'av',
    });
  });

  it('student GET /api/quizzes/:id strips correctAnswer from questions', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.quiz.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(quizRow);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/quizzes/qz1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    const questions = res.body.quiz.questions as Array<Record<string, unknown>>;
    expect(questions).toHaveLength(1);
    expect(questions[0]).not.toHaveProperty('correctAnswer');
    expect(questions[0].options).toEqual(['A', 'B']);
  });

  it('faculty GET /api/quizzes/:id keeps correctAnswer', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.quiz.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(quizRow);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/quizzes/qz1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    const questions = res.body.quiz.questions as Array<Record<string, unknown>>;
    expect(questions).toHaveLength(1);
    expect(questions[0]).toHaveProperty('correctAnswer', 'A');
  });

  it('POST /api/quizzes/:id/submit upserts one submission row with the asg-quiz-<id> convention', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.quiz.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'qz1',
      courseId: 'c1',
      title: 'Quiz 1',
      questions: [],
    });
    (prisma.submission.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.submission.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sub1',
      activityKey: 'asg-quiz-qz1',
      status: 'submitted',
      rubricScores: '{}',
    });
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'n1' });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/quizzes/qz1/submit')
      .set('Authorization', 'Bearer x')
      .send({ answers: { qq1: 'A' } });

    expect(res.status).toBe(201);
    expect(prisma.submission.create).toHaveBeenCalledTimes(1);
    expect(prisma.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activityKey: 'asg-quiz-qz1',
          studentId: 'u-stu',
          status: 'submitted',
        }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'activity_submitted', recipientId: 'u-fac' }),
      })
    );
  });

  it('POST /api/exams creates a midterm exam with 2 questions and returns { exam }', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.exam.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ex1',
      courseId: 'c1',
      title: 'Midterm Exam',
      term: 'midterm',
    });
    (prisma.quizQuestion.create as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        id: 'qq1',
        examId: 'ex1',
        text: 'Q1?',
        type: 'multiple_choice',
        options: JSON.stringify(['A', 'B']),
        correctAnswer: 'A',
        points: 5,
      })
      .mockResolvedValueOnce({
        id: 'qq2',
        examId: 'ex1',
        text: 'Q2?',
        type: 'multiple_choice',
        options: JSON.stringify(['C', 'D']),
        correctAnswer: 'C',
        points: 5,
      });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/exams')
      .set('Authorization', 'Bearer x')
      .send({
        courseId: 'c1',
        title: 'Midterm Exam',
        instructions: 'Answer all.',
        term: 'midterm',
        questions: [
          { text: 'Q1?', options: ['A', 'B'], correctAnswer: 'A' },
          { text: 'Q2?', options: ['C', 'D'], correctAnswer: 'C' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.exam).toMatchObject({ term: 'midterm' });
    expect(prisma.exam.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ term: 'midterm', courseId: 'c1' }),
      })
    );
    expect(prisma.quizQuestion.create).toHaveBeenCalledTimes(2);
    expect(prisma.quizQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ examId: 'ex1' }) })
    );
  });

  it('POST /api/exams/:id/submit upserts one submission row with the asg-exam-<id> convention', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.exam.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ex1',
      courseId: 'c1',
      title: 'Midterm Exam',
      questions: [],
    });
    (prisma.submission.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.submission.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sub1',
      activityKey: 'asg-exam-ex1',
      status: 'submitted',
      rubricScores: '{}',
    });
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'n1' });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/exams/ex1/submit')
      .set('Authorization', 'Bearer x')
      .send({ answers: { qq1: 'A' } });

    expect(res.status).toBe(201);
    expect(res.body.submission.activityKey).toMatch(/^asg-exam-/);
    expect(prisma.submission.create).toHaveBeenCalledTimes(1);
    expect(prisma.submission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activityKey: 'asg-exam-ex1',
          examId: 'ex1',
          studentId: 'u-stu',
          status: 'submitted',
        }),
      })
    );
  });

  it('POST /api/exams with a bad term returns 400', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/exams')
      .set('Authorization', 'Bearer x')
      .send({
        courseId: 'c1',
        title: 'Bad Exam',
        instructions: 'Answer all.',
        term: 'quarter',
        questions: [],
      });

    expect(res.status).toBe(400);
    expect(prisma.exam.create).not.toHaveBeenCalled();
  });

  it('POST /api/exams with prelim term returns 201', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.exam.create as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'ex1', ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/exams')
      .set('Authorization', 'Bearer x')
      .send({
        courseId: 'c1',
        title: 'Prelim Exam',
        instructions: 'Answer all.',
        term: 'prelim',
        questions: [],
      });

    expect(res.status).toBe(201);
    expect(res.body.exam.term).toBe('prelim');
  });

  it('POST /api/quizzes accepts prelim term and returns it', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.quiz.create as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'qz1', ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/quizzes')
      .set('Authorization', 'Bearer x')
      .send({
        courseId: 'c1',
        title: 'Q',
        instructions: 'I',
        term: 'prelim',
        questions: [],
      });

    expect(res.status).toBe(201);
    expect(res.body.quiz.term).toBe('prelim');
  });

  it('POST /api/activities with unknown term returns 400', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);

    const bad = await (await import('supertest'))
      .default(app())
      .post('/api/activities')
      .set('Authorization', 'Bearer x')
      .send({
        courseId: 'c1',
        title: 'A',
        instructions: 'I',
        pointsPossible: 100,
        term: 'quarter',
        questions: [],
      });

    expect(bad.status).toBe(400);
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  it('PATCH /api/quizzes/:id updates term, PATCH /api/activities/:id rejects unknown term', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.quiz.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'qz1',
      courseId: 'c1',
      title: 'Q',
      questions: [],
    });
    (prisma.quiz.update as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { where: unknown; data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'qz1', ...args.data })
    );
    (prisma.activity.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      courseId: 'c1',
      title: 'A',
      questions: [],
    });

    const request = (await import('supertest')).default;
    const ok = await request(app())
      .patch('/api/quizzes/qz1')
      .set('Authorization', 'Bearer x')
      .send({ term: 'finals' });
    expect(ok.status).toBe(200);
    expect(prisma.quiz.update).toHaveBeenCalledWith({
      where: { id: 'qz1' },
      data: expect.objectContaining({ term: 'finals' }),
    });

    const bad = await request(app())
      .patch('/api/activities/a1')
      .set('Authorization', 'Bearer x')
      .send({ term: 'quarter' });
    expect(bad.status).toBe(400);
    expect(prisma.activity.update).not.toHaveBeenCalled();
  });

  it('POST /api/activities accepts classic fields and stores format classic', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.activity.create as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'act1', ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/activities')
      .set('Authorization', 'Bearer x')
      .send({
        courseId: 'c1', title: 'Lab 1', instructions: 'Do it', pointsPossible: 50,
        dueDate: '2026-10-01', submissionTypes: ['online_text'], category: 'lab', format: 'classic',
      });
    expect(res.status).toBe(201);
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ format: 'classic', title: 'Lab 1' }) })
    );
  });

  it('POST /api/activities accepts prelim term and echoes it', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.activity.create as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { data: Record<string, unknown> }) => Promise.resolve({ id: 'act1', ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/activities')
      .set('Authorization', 'Bearer x')
      .send({ courseId: 'c1', title: 'Lab', instructions: 'Do it', pointsPossible: 50, dueDate: '2026-10-01T00:00:00.000Z', term: 'prelim', format: 'classic' });

    expect(res.status).toBe(201);
    expect(res.body.activity.term).toBe('prelim');
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ term: 'prelim' }) })
    );
  });

  it('POST /api/activities rejects unknown term with 400', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/activities')
      .set('Authorization', 'Bearer x')
      .send({ courseId: 'c1', title: 'Lab', instructions: 'Do it', pointsPossible: 50, dueDate: '2026-10-01T00:00:00.000Z', term: 'quarter', format: 'classic' });

    expect(res.status).toBe(400);
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  it('GET /api/activities/:id/submissions on a classic activity lists rows linked by raw activityKey', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.activity.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'asg-1',
      courseId: 'c1',
      title: 'Lab 1',
      format: 'classic',
      submissionTypes: '[]',
      rubric: '[]',
      questions: [],
    });
    (prisma.submission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'sub1', activityKey: 'asg-1', studentId: 'u-a', rubricScores: '{}' },
    ]);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/activities/asg-1/submissions')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { activityKey: 'asg-1' } })
    );
  });

  it('GET /api/activities/:id/submissions on a question-set activity lists rows linked by activityId FK', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.activity.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'act1',
      courseId: 'c1',
      title: 'Activity 1',
      format: 'questionset',
      submissionTypes: null,
      rubric: null,
      questions: [],
    });
    (prisma.submission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'sub2', activityKey: 'asg-activity-act1', activityId: 'act1', studentId: 'u-a', rubricScores: '{}' },
    ]);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/activities/act1/submissions')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { activityId: 'act1' } })
    );
  });

  it('POST /api/submissions/:id/grade resolves a classic submission via activityKey', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sub9',
      activityKey: 'asg1',
      quizId: null,
      activityId: null,
      examId: null,
      studentId: 'u-a',
    });
    (prisma.activity.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'asg1',
      courseId: 'c1',
      title: 'Essay 1',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.submission.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sub9',
      grade: 80,
      status: 'graded',
      rubricScores: '{}',
    });
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'n1' });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/submissions/sub9/grade')
      .set('Authorization', 'Bearer x')
      .send({ grade: 80 });

    expect(res.status).toBe(200);
    expect(res.body.submission.grade).toBe(80);
    expect(prisma.activity.findUnique).toHaveBeenCalledWith({ where: { id: 'asg1' } });
  });
});
