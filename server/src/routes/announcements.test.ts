// server/src/routes/announcements.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    announcement: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    announcementAttachment: { create: vi.fn() },
    announcementReply: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    announcementLike: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
    announcementRead: { findFirst: vi.fn(), create: vi.fn() },
    courseFolder: { findFirst: vi.fn(), create: vi.fn() },
    courseFile: { findMany: vi.fn(), create: vi.fn() },
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
import { announcementsRouter } from './announcements.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', announcementsRouter);
  a.use(errorMiddleware);
  return a;
}

const course = { id: 'c1', instructorId: 'u-fac' };
const annA = {
  id: 'ann-a',
  courseId: 'c1',
  title: 'Section A memo',
  sectionId: 'sec-a',
  authorId: 'u-fac',
  likedBy: [],
  readBy: [],
  replies: [],
};
const annAll = {
  id: 'ann-all',
  courseId: 'c1',
  title: 'Everyone memo',
  sectionId: 'all',
  authorId: 'u-fac',
  likedBy: [],
  readBy: [],
  replies: [],
};

describe('announcements router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u-stu',
      name: 'Stu',
      avatar: 'av',
    });
  });

  it('student in section B does NOT receive the section-A announcement', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: 'c1',
      studentId: 'u-stu',
      status: 'approved',
      targetSectionId: 'sec-b',
    });
    (prisma.announcement.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([annA, annAll]);

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/courses/c1/announcements')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    const ids = (res.body.announcements as Array<{ id: string }>).map((a) => a.id);
    expect(ids).not.toContain('ann-a');
    expect(ids).toContain('ann-all');
  });

  it('reply by non-author notifies the author; reply by the author creates none', async () => {
    const ann = { ...annA, replies: [] };
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.announcement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(ann);
    (prisma.announcementReply.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'r1',
      announcementId: 'ann-a',
      authorId: 'u-stu',
      content: 'thanks',
    });
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'n1' });

    // Non-author reply → one notification to the announcement author.
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: 'c1',
      studentId: 'u-stu',
      status: 'approved',
      targetSectionId: 'sec-a',
    });

    const resOther = await (await import('supertest'))
      .default(app())
      .post('/api/announcements/ann-a/replies')
      .set('Authorization', 'Bearer x')
      .send({ content: 'thanks' });

    expect(resOther.status).toBe(201);
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientId: 'u-fac', type: 'announcement_reply' }),
      })
    );

    // Author reply → no notification (never self).
    vi.clearAllMocks();
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });

    const resSelf = await (await import('supertest'))
      .default(app())
      .post('/api/announcements/ann-a/replies')
      .set('Authorization', 'Bearer x')
      .send({ content: 'you are welcome' });

    expect(resSelf.status).toBe(201);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('like toggle twice calls delete then create (in that order)', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: 'c1',
      studentId: 'u-stu',
      status: 'approved',
      targetSectionId: 'sec-a',
    });
    (prisma.announcement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(annA);
    // First toggle: like exists → delete. Second toggle: no like → create.
    (prisma.announcementLike.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ announcementId: 'ann-a', userId: 'u-stu' })
      .mockResolvedValueOnce(null);
    (prisma.announcementLike.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    (prisma.announcement.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'ann-a' });

    const request = (await import('supertest')).default(app());
    const first = await request.post('/api/announcements/ann-a/like').set('Authorization', 'Bearer x');
    const second = await request.post('/api/announcements/ann-a/like').set('Authorization', 'Bearer x');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(prisma.announcementLike.delete).toHaveBeenCalledTimes(1);
    expect(prisma.announcementLike.create).toHaveBeenCalledTimes(1);
    const deleteOrder = (prisma.announcementLike.delete as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const createOrder = (prisma.announcementLike.create as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it('announcement pin by faculty 200 / by student 403', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.announcement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(annAll);
    (prisma.announcement.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...annAll,
      pinned: true,
    });

    // Faculty owner → 200.
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    const pinned = await (await import('supertest'))
      .default(app())
      .patch('/api/announcements/ann-all')
      .set('Authorization', 'Bearer x')
      .send({ pinned: true });

    expect(pinned.status).toBe(200);
    expect(prisma.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ann-all' }, data: { pinned: true } })
    );

    // Student → 403 (requireRole guard).
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-stu',
      role: 'student',
    });
    const denied = await (await import('supertest'))
      .default(app())
      .patch('/api/announcements/ann-all')
      .set('Authorization', 'Bearer x')
      .send({ pinned: true });

    expect(denied.status).toBe(403);
    expect(prisma.announcement.update).not.toHaveBeenCalled();
  });

  it('announcement pin rejects unknown keys and non-boolean pinned', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.announcement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(annAll);

    const request = (await import('supertest')).default(app());
    const unknown = await request
      .patch('/api/announcements/ann-all')
      .set('Authorization', 'Bearer x')
      .send({ pinned: true, title: 'hijack' });
    const nonBoolean = await request
      .patch('/api/announcements/ann-all')
      .set('Authorization', 'Bearer x')
      .send({ pinned: 'yes' });
    const missing = await request
      .patch('/api/announcements/ann-all')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(unknown.status).toBe(400);
    expect(nonBoolean.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(prisma.announcement.update).not.toHaveBeenCalled();
  });

  it('stores parentId and notifies parent + root authors', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-caller',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: 'c1',
      studentId: 'u-caller',
      status: 'approved',
      targetSectionId: 'sec-a',
    });
    (prisma.announcement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...annA,
      replies: [],
    });
    const rows = [
      { id: 'r-top', announcementId: 'ann-a', parentId: null, authorId: 'u-a' },
      { id: 'r-mid', announcementId: 'ann-a', parentId: 'r-top', authorId: 'u-b' },
    ];
    (prisma.announcementReply.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(rows);
    (prisma.announcementReply.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { where: { id: string } }) => rows.find((r) => r.id === args.where.id) ?? null
    );
    (prisma.announcementReply.create as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: 'r-new',
        announcementId: 'ann-a',
        authorId: 'u-caller',
        content: 'second',
        parentId: args.data.parentId ?? null,
      })
    );
    (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'n1' });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/announcements/ann-a/replies')
      .set('Authorization', 'Bearer x')
      .send({ content: 'second', parentId: 'r-mid' });

    expect(res.status).toBe(201);
    expect(res.body.reply.parentId).toBe('r-mid');
    expect(prisma.announcementReply.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: 'r-mid' }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    const calls = (prisma.notification.create as ReturnType<typeof vi.fn>).mock.calls;
    const recipients = calls.map(
      (call) => (call[0] as { data: { recipientId: string } }).data.recipientId
    );
    expect(recipients).toContain('u-b');
    expect(recipients).toContain('u-a');
    for (const call of calls) {
      expect((call[0] as { data: { type: string } }).data.type).toBe('announcement_reply');
    }
  });

  it('rejects cross-announcement, missing, and non-string parentId', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-caller',
      role: 'student',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: 'c1',
      studentId: 'u-caller',
      status: 'approved',
      targetSectionId: 'sec-a',
    });
    (prisma.announcement.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...annA,
      replies: [],
    });
    (prisma.announcementReply.findUnique as ReturnType<typeof vi.fn>).mockImplementation(
      async (args: { where: { id: string } }) =>
        args.where.id === 'other-ann-reply'
          ? { id: 'other-ann-reply', announcementId: 'ann-other', authorId: 'u-x' }
          : null
    );

    const request = (await import('supertest')).default(app());
    const cross = await request
      .post('/api/announcements/ann-a/replies')
      .set('Authorization', 'Bearer x')
      .send({ content: 'bad', parentId: 'other-ann-reply' });
    const missing = await request
      .post('/api/announcements/ann-a/replies')
      .set('Authorization', 'Bearer x')
      .send({ content: 'bad', parentId: 'ghost' });
    const nonString = await request
      .post('/api/announcements/ann-a/replies')
      .set('Authorization', 'Bearer x')
      .send({ content: 'bad', parentId: 123 });
    const blank = await request
      .post('/api/announcements/ann-a/replies')
      .set('Authorization', 'Bearer x')
      .send({ content: 'bad', parentId: '   ' });

    expect(cross.status).toBe(400);
    expect(missing.status).toBe(400);
    expect(nonString.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(prisma.announcementReply.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
