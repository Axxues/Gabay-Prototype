// server/src/routes/discussions.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    discussion: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    discussionReply: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    discussionReplyLike: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
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
import { discussionsRouter } from './discussions.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', discussionsRouter);
  a.use(errorMiddleware);
  return a;
}

const course = { id: 'c1', instructorId: 'u-fac' };
const discussion = { id: 'd1', courseId: 'c1', title: 'Topic', authorId: 'u-fac', replies: [] };

describe('discussions router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u-fac',
      name: 'Fac',
      avatar: 'av',
    });
  });

  it('discussion DELETE by faculty 200 / by student 403', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.discussion.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(discussion);
    (prisma.discussion.delete as ReturnType<typeof vi.fn>).mockResolvedValue(discussion);

    // Faculty owner → 200.
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    const removed = await (await import('supertest'))
      .default(app())
      .delete('/api/discussions/d1')
      .set('Authorization', 'Bearer x');

    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ ok: true });
    expect(prisma.discussion.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });

    // Student → 403 (requireRole guard).
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    const denied = await (await import('supertest'))
      .default(app())
      .delete('/api/discussions/d1')
      .set('Authorization', 'Bearer x');

    expect(denied.status).toBe(403);
    expect(prisma.discussion.delete).not.toHaveBeenCalled();
  });

  it('discussion DELETE for unknown id 404', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.discussion.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await (await import('supertest'))
      .default(app())
      .delete('/api/discussions/nope')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(404);
    expect(prisma.discussion.delete).not.toHaveBeenCalled();
  });
});
