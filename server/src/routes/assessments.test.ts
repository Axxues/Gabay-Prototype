// server/src/routes/assessments.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    quiz: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    activity: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    quizQuestion: { create: vi.fn() },
    submission: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
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
import { quizzesRouter, activitiesRouter } from './assessments.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/quizzes', quizzesRouter);
  a.use('/api/activities', activitiesRouter);
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
      assignmentId: 'asg-quiz-qz1',
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
          assignmentId: 'asg-quiz-qz1',
          studentId: 'u-stu',
          status: 'submitted',
        }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'assignment_submitted', recipientId: 'u-fac' }),
      })
    );
  });
});
