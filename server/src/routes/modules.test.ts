// server/src/routes/modules.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    module: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    moduleItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    moduleComment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    moduleCommentLike: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
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

  it('PATCH comment by the author 200 + sets isEdited', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-caller',
      role: 'student',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mod);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.moduleComment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      moduleId: 'm1',
      authorId: 'u-caller',
      content: 'before',
      likedBy: [],
    });
    (prisma.moduleComment.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      moduleId: 'm1',
      authorId: 'u-caller',
      content: 'after',
      isEdited: true,
      likedBy: [],
    });

    const res = await (await import('supertest'))
      .default(app())
      .patch('/api/modules/m1/comments/c1')
      .set('Authorization', 'Bearer x')
      .send({ content: 'after' });

    expect(res.status).toBe(200);
    expect(prisma.moduleComment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({ content: 'after', isEdited: true }),
      })
    );
    expect(res.body.comment.content).toBe('after');
    expect(res.body.comment.likedBy).toEqual([]);
  });

  it('PATCH comment by non-author non-faculty 403', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-other',
      role: 'student',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mod);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.moduleComment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      moduleId: 'm1',
      authorId: 'u-caller',
      content: 'before',
      likedBy: [],
    });

    const res = await (await import('supertest'))
      .default(app())
      .patch('/api/modules/m1/comments/c1')
      .set('Authorization', 'Bearer x')
      .send({ content: 'hijack' });

    expect(res.status).toBe(403);
    expect(prisma.moduleComment.update).not.toHaveBeenCalled();
  });

  it('comment like toggle twice flips liked', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-caller',
      role: 'student',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mod);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.moduleComment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      moduleId: 'm1',
      authorId: 'u-author',
    });
    // First toggle: like exists → delete (liked:false). Second: none → create (liked:true).
    (prisma.moduleCommentLike.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ commentId: 'c1', userId: 'u-caller' })
      .mockResolvedValueOnce(null);
    (prisma.moduleCommentLike.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const request = (await import('supertest')).default(app());
    const first = await request.post('/api/modules/m1/comments/c1/like').set('Authorization', 'Bearer x');
    const second = await request.post('/api/modules/m1/comments/c1/like').set('Authorization', 'Bearer x');

    expect(first.status).toBe(200);
    expect(first.body.liked).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.liked).toBe(true);
    expect(prisma.moduleCommentLike.delete).toHaveBeenCalledTimes(1);
    expect(prisma.moduleCommentLike.create).toHaveBeenCalledTimes(1);
  });

  it('item move preserves id and changes moduleId', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { where: { id: string } }) =>
        args.where.id === 'm2'
          ? { id: 'm2', courseId: 'c1', title: 'Unit 2' }
          : mod
    );
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.moduleItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'item-1',
      moduleId: 'm1',
      title: 'Page',
      fileName: null,
      fileUrl: null,
    });
    (prisma.moduleItem.update as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: args.where.id,
        moduleId: args.data.moduleId,
        title: 'Page',
      })
    );

    const res = await (await import('supertest'))
      .default(app())
      .patch('/api/modules/m1/items/item-1')
      .set('Authorization', 'Bearer x')
      .send({ targetModuleId: 'm2' });

    expect(res.status).toBe(200);
    expect(res.body.item.id).toBe('item-1');
    expect(res.body.item.moduleId).toBe('m2');
    expect(prisma.moduleItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'item-1' } })
    );
  });

  it('item move to an other-course module is rejected', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { where: { id: string } }) =>
        args.where.id === 'mX' ? { id: 'mX', courseId: 'c-other', title: 'Foreign' } : mod
    );
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.moduleItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'item-1',
      moduleId: 'm1',
      title: 'Page',
      fileName: null,
      fileUrl: null,
    });

    const res = await (await import('supertest'))
      .default(app())
      .patch('/api/modules/m1/items/item-1')
      .set('Authorization', 'Bearer x')
      .send({ targetModuleId: 'mX' });

    expect(res.status).toBe(400);
    expect(prisma.moduleItem.update).not.toHaveBeenCalled();
  });

  it('stores parentId and notifies parent + root authors', async () => {
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
      { id: 'c-top', moduleId: 'm1', authorId: 'u-a' },
      { id: 'c-mid', moduleId: 'm1', parentId: 'c-top', authorId: 'u-b' },
    ]);
    (prisma.moduleComment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c-mid',
      moduleId: 'm1',
      parentId: 'c-top',
      authorId: 'u-b',
    });
    (prisma.moduleComment.create as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: 'c-new',
        moduleId: 'm1',
        authorId: 'u-caller',
        content: 'second layer',
        parentId: args.data.parentId ?? null,
      })
    );
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'n1' });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/modules/m1/comments')
      .set('Authorization', 'Bearer x')
      .send({ content: 'second layer', parentId: 'c-mid' });

    expect(res.status).toBe(201);
    expect(res.body.comment.parentId).toBe('c-mid');
    expect(prisma.moduleComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: 'c-mid' }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    const recipients = (prisma.notification.create as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => (call[0] as { data: { recipientId: string } }).data.recipientId
    );
    expect(recipients).toContain('u-b');
    expect(recipients).toContain('u-a');
  });

  it('rejects parentId from another module', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-caller',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mod);
    (prisma.moduleComment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.moduleComment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'other-module-comment',
      moduleId: 'm-other',
      authorId: 'u-x',
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/modules/m1/comments')
      .set('Authorization', 'Bearer x')
      .send({ content: 'bad', parentId: 'other-module-comment' });

    expect(res.status).toBe(400);
    expect(prisma.moduleComment.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('DELETE top-level comment re-parents second-layer child to null', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-caller',
      role: 'student',
    });
    (prisma.module.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mod);
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'approved',
    });
    (prisma.moduleComment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c-top',
      moduleId: 'm1',
      parentId: null,
      authorId: 'u-caller',
      content: 'top',
    });
    (prisma.moduleComment.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.moduleComment.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'c-top' });

    const del = await (await import('supertest'))
      .default(app())
      .delete('/api/modules/m1/comments/c-top')
      .set('Authorization', 'Bearer x');

    expect(del.status).toBe(200);
    expect(prisma.moduleComment.updateMany).toHaveBeenCalledWith({
      where: { moduleId: 'm1', parentId: 'c-top' },
      data: { parentId: null },
    });
    expect(prisma.moduleComment.delete).toHaveBeenCalledWith({ where: { id: 'c-top' } });

    // Child survives as top-level with content intact; sibling threads unaffected.
    (prisma.module.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        ...mod,
        items: [],
        comments: [
          {
            id: 'c-child',
            moduleId: 'm1',
            parentId: null,
            content: 'second layer',
            authorId: 'u-b',
            likedBy: [],
          },
          {
            id: 'c-sib',
            moduleId: 'm1',
            parentId: null,
            content: 'sibling',
            authorId: 'u-c',
            likedBy: [],
          },
        ],
      },
    ]);

    const list = await (await import('supertest'))
      .default(app())
      .get('/api/courses/c1/modules')
      .set('Authorization', 'Bearer x');

    expect(list.status).toBe(200);
    const comments = list.body.modules[0].comments;
    const child = comments.find((c: { id: string }) => c.id === 'c-child');
    const sib = comments.find((c: { id: string }) => c.id === 'c-sib');
    expect(child.parentId).toBeNull();
    expect(child.content).toBe('second layer');
    expect(sib.parentId).toBeNull();
    expect(sib.content).toBe('sibling');
  });
});
