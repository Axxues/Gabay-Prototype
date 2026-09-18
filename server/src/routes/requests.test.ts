// server/src/routes/requests.test.ts — faculty invites are student-accepted,
// never faculty-approved.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    course: { findUnique: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    courseSection: { findUnique: vi.fn(), update: vi.fn() },
    enrollmentRequest: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
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
import { requestsRouter } from './requests.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', requestsRouter);
  a.use(errorMiddleware);
  return a;
}

const facultyAuth = { sub: 'faculty-1', role: 'faculty' };
const course = { id: 'c1', title: 'CMSC 131', instructorId: 'faculty-1' };

describe('requests approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue(facultyAuth);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'faculty-1', name: 'Prof' });
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('approves a student self_join request', async () => {
    (prisma.enrollmentRequest.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'req-1', courseId: 'c1', studentId: 'student-1', type: 'self_join', status: 'pending',
    });
    (prisma.enrollmentRequest.update as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'req-1', status: 'approved', ...args.data }),
    );

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/requests/req-1/approve')
      .set('Authorization', 'Bearer x')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('approved');
  });

  it('rejects faculty approval of a faculty_enroll invite (student must accept)', async () => {
    (prisma.enrollmentRequest.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'req-2', courseId: 'c1', studentId: 'student-1', type: 'faculty_enroll', status: 'pending',
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/requests/req-2/approve')
      .set('Authorization', 'Bearer x')
      .send();

    expect(res.status).toBe(403);
    expect(prisma.enrollmentRequest.update).not.toHaveBeenCalled();
  });
});

describe('requests mine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ sub: 'student-1', role: 'student' });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
  });

  it('GET /api/requests/mine attaches the course snapshot', async () => {
    (prisma.enrollmentRequest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'req-9', courseId: 'c1', studentId: 'student-1', type: 'self_join', status: 'pending' },
    ]);
    (prisma.course.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', code: 'CMSC 180', title: 'Artificial Intelligence' },
    ]);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/requests/mine')
      .set('Authorization', 'Bearer x')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.requests[0]).toMatchObject({
      id: 'req-9',
      courseCode: 'CMSC 180',
      courseTitle: 'Artificial Intelligence',
    });
  });

  it('GET /api/requests/mine nulls the snapshot when the course is gone', async () => {
    (prisma.enrollmentRequest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'req-9', courseId: 'c-gone', studentId: 'student-1', type: 'self_join', status: 'pending' },
    ]);
    (prisma.course.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/requests/mine')
      .set('Authorization', 'Bearer x')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.requests[0]).toMatchObject({ id: 'req-9', courseCode: null, courseTitle: null });
  });
});

describe('requests remove-student', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue(facultyAuth);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'faculty-1', name: 'Prof' });
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('removes an enrolled student (approved rows deleted, coursework untouched)', async () => {
    (prisma.enrollmentRequest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'req-1', courseId: 'c1', studentId: 'student-1', type: 'self_join', status: 'approved', targetSectionId: null },
    ]);
    (prisma.enrollmentRequest.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/remove-student')
      .set('Authorization', 'Bearer x')
      .send({ studentId: 'student-1' });

    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(1);
    expect(prisma.enrollmentRequest.deleteMany).toHaveBeenCalledWith({
      where: { courseId: 'c1', studentId: 'student-1', status: 'approved' },
    });
  });

  it('frees the section slot when the approved row held one', async () => {
    (prisma.enrollmentRequest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'req-1', courseId: 'c1', studentId: 'student-1', type: 'self_join', status: 'approved', targetSectionId: 'sec-1' },
    ]);
    (prisma.enrollmentRequest.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.courseSection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sec-1', courseId: 'c1', enrolledCount: 3,
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/remove-student')
      .set('Authorization', 'Bearer x')
      .send({ studentId: 'student-1' });

    expect(res.status).toBe(200);
    expect(prisma.courseSection.update).toHaveBeenCalledWith({
      where: { id: 'sec-1' },
      data: { enrolledCount: { decrement: 1 } },
    });
  });

  it('returns 404 when the student has no approved membership', async () => {
    (prisma.enrollmentRequest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/remove-student')
      .set('Authorization', 'Bearer x')
      .send({ studentId: 'student-9' });

    expect(res.status).toBe(404);
    expect(prisma.enrollmentRequest.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects removal by a non-owning faculty member', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1', title: 'CMSC 131', instructorId: 'faculty-other',
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/remove-student')
      .set('Authorization', 'Bearer x')
      .send({ studentId: 'student-1' });

    expect(res.status).toBe(403);
    expect(prisma.enrollmentRequest.deleteMany).not.toHaveBeenCalled();
  });
});
