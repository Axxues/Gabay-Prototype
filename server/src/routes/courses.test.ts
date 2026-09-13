// server/src/routes/courses.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    courseSection: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
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
import { coursesRouter } from './courses.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/courses', coursesRouter);
  a.use(errorMiddleware);
  return a;
}

describe('courses router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
  });

  it('POST /api/courses/join with unknown code → 404 course_not_found', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/join')
      .set('Authorization', 'Bearer x')
      .send({ code: 'NOPE' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('course_not_found');
  });

  it('POST /api/courses/join twice → both 200, create called once (idempotent)', async () => {
    const course = { id: 'c1', joinCode: 'ABC', published: true };
    const created = { id: 'r1', courseId: 'c1', studentId: 'u-fac', type: 'self_join', status: 'pending' };
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-fac', name: 'Fac' });
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);
    (prisma.enrollmentRequest.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);
    const request = (await import('supertest')).default;
    const first = await request(app())
      .post('/api/courses/join')
      .set('Authorization', 'Bearer x')
      .send({ code: 'ABC' });
    const second = await request(app())
      .post('/api/courses/join')
      .set('Authorization', 'Bearer x')
      .send({ code: 'ABC' });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(prisma.enrollmentRequest.create).toHaveBeenCalledTimes(1);
  });

  it('PATCH syllabus null clears the column (NULL)', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-fac',
      published: true,
    });
    (prisma.course.update as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { where: unknown; data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'c1', syllabus: null, ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .patch('/api/courses/c1')
      .set('Authorization', 'Bearer x')
      .send({ syllabus: null });

    expect(res.status).toBe(200);
    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { syllabus: null },
    });
  });

  it('PATCH syllabus with non-string non-null still 400', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-fac',
      published: true,
    });

    const res = await (await import('supertest'))
      .default(app())
      .patch('/api/courses/c1')
      .set('Authorization', 'Bearer x')
      .send({ syllabus: 42 });

    expect(res.status).toBe(400);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it('GET /api/courses/:id as non-member student → 403 forbidden', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-other',
      published: true,
    });
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await (await import('supertest'))
      .default(app())
      .get('/api/courses/c1')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});
