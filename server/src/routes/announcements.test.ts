// server/src/routes/announcements.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    announcement: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    announcementAttachment: { create: vi.fn() },
    announcementReply: { create: vi.fn() },
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
});
