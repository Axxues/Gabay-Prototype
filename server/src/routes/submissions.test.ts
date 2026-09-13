// server/src/routes/submissions.test.ts
// Fix round 1 (Phase 4 Task 4, concerns 1-2): quiz/activity submission lists
// plus synthetic-aware grading on the submissions endpoints.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    quiz: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    activity: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    assignment: { findUnique: vi.fn() },
    quizQuestion: { create: vi.fn() },
    submission: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    submissionComment: { create: vi.fn() },
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
import { assignmentsRouter } from './assignments.js';
import { quizzesRouter, activitiesRouter } from './assessments.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', assignmentsRouter);
  a.use('/api/quizzes', quizzesRouter);
  a.use('/api/activities', activitiesRouter);
  a.use(errorMiddleware);
  return a;
}

const course = { id: 'c1', instructorId: 'u-fac' };
const quizRow = { id: 'qz1', courseId: 'c1', title: 'Quiz 1', questions: [] };

const submissionRows = [
  { id: 'sub1', quizId: 'qz1', studentId: 'u-a', rubricScores: '{}' },
  { id: 'sub2', quizId: 'qz1', studentId: 'u-b', rubricScores: '{}' },
];

describe('quiz/activity submission lists + synthetic-aware grading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u-fac',
      name: 'Fac',
      avatar: 'av',
    });
  });

  it('faculty GET /api/quizzes/:id/submissions sees all rows', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.quiz.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(quizRow);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.submission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(submissionRows);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/quizzes/qz1/submissions')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(2);
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { quizId: 'qz1' } })
    );
  });

  it('student GET /api/quizzes/:id/submissions sees only own rows', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-a',
      role: 'student',
    });
    (prisma.quiz.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(quizRow);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.submission.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([submissionRows[0]]);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/quizzes/qz1/submissions')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { quizId: 'qz1', studentId: 'u-a' } })
    );
  });

  it('grade on a quiz submission (synthetic assignmentId + real quizId) succeeds instead of 404', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sub1',
      assignmentId: 'asg-quiz-qz1',
      quizId: 'qz1',
      activityId: null,
      studentId: 'u-a',
    });
    (prisma.quiz.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(quizRow);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.submission.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sub1',
      grade: 9,
      status: 'graded',
      rubricScores: '{}',
    });
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'n1' });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/submissions/sub1/grade')
      .set('Authorization', 'Bearer x')
      .send({ grade: 9 });

    expect(res.status).toBe(200);
    expect(res.body.submission.grade).toBe(9);
    expect(prisma.assignment.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ relatedId: 'qz1', relatedTitle: 'Quiz 1' }),
      })
    );
  });

  it('grade on an assignment submission still works (regression)', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.submission.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sub9',
      assignmentId: 'asg1',
      quizId: null,
      activityId: null,
      studentId: 'u-a',
    });
    (prisma.assignment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
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
    expect(prisma.assignment.findUnique).toHaveBeenCalledWith({ where: { id: 'asg1' } });
  });
});
