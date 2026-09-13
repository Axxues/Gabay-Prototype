// server/src/routes/users.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    courseSection: { findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  },
}));
vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});
vi.mock('bcryptjs', () => {
  const hash = vi.fn(async (pw: string) => `hashed:${pw}`);
  const compare = vi.fn();
  return { hash, compare, default: { hash, compare } };
});

process.env.JWT_SECRET ??= 'test-secret';

import { prisma } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import express from 'express';
import { usersRouter } from './users.js';
import { requestsRouter } from './requests.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/users', usersRouter);
  a.use('/api', requestsRouter);
  a.use(errorMiddleware);
  return a;
}

async function request() {
  return (await import('supertest')).default;
}

describe('users router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-admin',
      role: 'admin',
    });
  });

  it('POST /api/users as admin → 201 with public user (never passwordHash)', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const created = {
      id: 'usr-new',
      name: 'New Fac',
      email: 'newfac@dmmmsu.edu.ph',
      role: 'faculty',
      avatar: '',
      department: '',
      title: '',
    };
    (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);
    const res = await (await request())(app())
      .post('/api/users')
      .set('Authorization', 'Bearer x')
      .send({ name: 'New Fac', email: 'newfac@dmmmsu.edu.ph', role: 'faculty', password: 'gabay2026' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('newfac@dmmmsu.edu.ph');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const hash = bcrypt.hash as unknown as ReturnType<typeof vi.fn>;
    expect(hash).toHaveBeenCalledWith('gabay2026', 10);
    const create = prisma.user.create as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.passwordHash).toMatch(/^hashed:/);
    expect(create.mock.calls[0][0].data.email).toBe('newfac@dmmmsu.edu.ph');
  });

  it('POST /api/users with duplicate email → 409 conflict', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-other' });
    const res = await (await request())(app())
      .post('/api/users')
      .set('Authorization', 'Bearer x')
      .send({ name: 'Dup', email: 'dup@dmmmsu.edu.ph', role: 'student', password: 'gabay2026' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('POST /api/users rejects bad role and short password → 400 bad_request', async () => {
    const r = await request();
    const badRole = await r(app())
      .post('/api/users')
      .set('Authorization', 'Bearer x')
      .send({ name: 'X', email: 'x@dmmmsu.edu.ph', role: 'dean', password: 'gabay2026' });
    expect(badRole.status).toBe(400);
    expect(badRole.body.error.code).toBe('bad_request');
    const shortPw = await r(app())
      .post('/api/users')
      .set('Authorization', 'Bearer x')
      .send({ name: 'X', email: 'x@dmmmsu.edu.ph', role: 'student', password: 'short' });
    expect(shortPw.status).toBe(400);
    expect(shortPw.body.error.code).toBe('bad_request');
  });

  it('DELETE /api/users/:id for self → 403 forbidden', async () => {
    const res = await (await request())(app())
      .delete('/api/users/u-admin')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('DELETE /api/users/:id missing → 404; existing → 200 ok', async () => {
    const r = await request();
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const missing = await r(app()).delete('/api/users/u-gone').set('Authorization', 'Bearer x');
    expect(missing.status).toBe(404);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-gone' });
    (prisma.user.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-gone' });
    const ok = await r(app()).delete('/api/users/u-gone').set('Authorization', 'Bearer x');
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
  });

  it('PATCH /api/users/:id role change persists', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u-1',
      email: 's@dmmmsu.edu.ph',
    });
    (prisma.user.update as ReturnType<typeof vi.fn>).mockImplementation(async (args: { data: Record<string, string> }) => ({
      id: 'u-1',
      name: 'S',
      email: 's@dmmmsu.edu.ph',
      role: args.data.role,
      avatar: '',
      department: '',
      title: '',
    }));
    const res = await (await request())(app())
      .patch('/api/users/u-1')
      .set('Authorization', 'Bearer x')
      .send({ role: 'faculty' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('faculty');
    const update = prisma.user.update as ReturnType<typeof vi.fn>;
    expect(update.mock.calls[0][0].data.role).toBe('faculty');
  });

  it('PATCH /api/users/:id unknown keys still 400; email clash → 409', async () => {
    const r = await request();
    const unknown = await r(app())
      .patch('/api/users/u-1')
      .set('Authorization', 'Bearer x')
      .send({ nickname: 'x' });
    expect(unknown.status).toBe(400);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: 'u-1', email: 'a@dmmmsu.edu.ph' })
      .mockResolvedValueOnce({ id: 'u-2', email: 'b@dmmmsu.edu.ph' });
    const clash = await r(app())
      .patch('/api/users/u-1')
      .set('Authorization', 'Bearer x')
      .send({ email: 'b@dmmmsu.edu.ph' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('conflict');
  });
});

describe('requests router (mine + faculty section bypass)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/requests/mine returns only own rows', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    const mine = [
      { id: 'r1', courseId: 'c1', studentId: 'u-stu', status: 'pending' },
      { id: 'r2', courseId: 'c2', studentId: 'u-stu', status: 'approved' },
    ];
    (prisma.enrollmentRequest.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mine);
    const res = await (await request())(app())
      .get('/api/requests/mine')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(2);
    expect(res.body.requests.every((r: { studentId: string }) => r.studentId === 'u-stu')).toBe(true);
    const findMany = prisma.enrollmentRequest.findMany as ReturnType<typeof vi.fn>;
    expect(findMany.mock.calls[0][0].where).toEqual({ studentId: 'u-stu' });
  });

  it('faculty choose-section without membership succeeds', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' });
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.courseSection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sec-1',
      courseId: 'c1',
      capacity: 60,
      enrolledCount: 10,
    });
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u-fac', name: 'Fac' });
    const created = { id: 'req-1', courseId: 'c1', studentId: 'u-fac', targetSectionId: 'sec-1', status: 'approved' };
    (prisma.enrollmentRequest.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);
    (prisma.courseSection.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const res = await (await request())(app())
      .post('/api/courses/c1/choose-section')
      .set('Authorization', 'Bearer x')
      .send({ sectionId: 'sec-1' });
    expect(res.status).toBe(200);
    expect(res.body.request.targetSectionId).toBe('sec-1');
  });

  it('student choose-section without membership still 403', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c1' });
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await (await request())(app())
      .post('/api/courses/c1/choose-section')
      .set('Authorization', 'Bearer x')
      .send({ sectionId: 'sec-1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});
