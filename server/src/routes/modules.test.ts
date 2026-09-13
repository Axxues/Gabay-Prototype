// server/src/routes/modules.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    module: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    moduleItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    moduleComment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    courseFolder: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    courseFile: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
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
import { modulesRouter } from './modules.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', modulesRouter);
  a.use(errorMiddleware);
  return a;
}

const course = { id: 'c1', instructorId: 'u-fac' };
const mod = { id: 'm1', courseId: 'c1', title: 'Unit 1', authorId: 'u-author' };

describe('modules router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u-caller',
      name: 'Caller',
      avatar: 'av',
    });
  });

  it('POST comment notifies the most-recent prior commenter (exactly once)', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-caller',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mod);
    (prisma.moduleComment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c-old', authorId: 'u-author' },
      { id: 'c-recent', authorId: 'u-prior' },
    ]);
    (prisma.moduleComment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c-new',
      moduleId: 'm1',
      authorId: 'u-caller',
      content: 'hello',
    });
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'n1' });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/modules/m1/comments')
      .set('Authorization', 'Bearer x')
      .send({ content: 'hello' });

    expect(res.status).toBe(201);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientId: 'u-prior', type: 'module_comment_reply' }),
      })
    );
  });

  it('POST first comment as the module author creates NO notification (self rule)', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-author',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-author',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mod);
    (prisma.moduleComment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.moduleComment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c-first',
      moduleId: 'm1',
      authorId: 'u-author',
      content: 'welcome',
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/modules/m1/comments')
      .set('Authorization', 'Bearer x')
      .send({ content: 'welcome' });

    expect(res.status).toBe(201);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('PATCH module title renames the module folder via module:<id> autoKey', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mod);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.module.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mod,
      title: 'Unit 1 Renamed',
    });
    (prisma.courseFolder.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    const res = await (await import('supertest'))
      .default(app())
      .patch('/api/modules/m1')
      .set('Authorization', 'Bearer x')
      .send({ title: 'Unit 1 Renamed' });

    expect(res.status).toBe(200);
    expect(prisma.courseFolder.updateMany).toHaveBeenCalledWith({
      where: { autoKey: 'module:m1' },
      data: { name: 'Unit 1 Renamed' },
    });
  });
});
