// server/src/routes/files.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    course: { findUnique: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
    courseFolder: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    courseFile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    courseGrade: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

process.env.JWT_SECRET ??= 'test-secret';

import { prisma } from '../db.js';
import jwt from 'jsonwebtoken';
import express from 'express';
import { writeFileSync } from 'node:fs';
import { filesRouter } from './files.js';
import { gradesRouter } from './grades.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', filesRouter);
  a.use('/api', gradesRouter);
  a.use(errorMiddleware);
  return a;
}

const course = { id: 'c1', instructorId: 'u-fac' };

describe('files + grades routers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(course);
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u-fac',
      name: 'Fac',
    });
  });

  it('upload with colliding name stores `name (2).ext`', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.courseFile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { name: 'report.pdf' },
    ]);
    (prisma.courseFile.create as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'file-1', ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/files/upload')
      .set('Authorization', 'Bearer x')
      .attach('file', Buffer.from('pdf-bytes'), 'report.pdf');

    expect(res.status).toBe(201);
    expect(prisma.courseFile.create).toHaveBeenCalledTimes(1);
    expect(prisma.courseFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'report (2).pdf', courseId: 'c1' }),
      })
    );
    expect(res.body.file.name).toBe('report (2).pdf');
  });

  it('folder autoKey `area:announcements` is reused (create NOT called)', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.courseFolder.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'fld-ann',
      courseId: 'c1',
      autoKey: 'area:announcements',
    });
    (prisma.courseFile.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.courseFile.create as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'file-2', ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/files/upload')
      .set('Authorization', 'Bearer x')
      .field('area', 'announcements')
      .attach('file', Buffer.from('pdf-bytes'), 'memo.pdf');

    expect(res.status).toBe(201);
    expect(prisma.courseFolder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { courseId: 'c1', autoKey: 'area:announcements' } })
    );
    expect(prisma.courseFolder.create).not.toHaveBeenCalled();
    expect(prisma.courseFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ folderId: 'fld-ann', name: 'memo.pdf' }),
      })
    );
  });

  it('metadata POST creates the row with no fs write', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.courseFile.create as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'file-meta', ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/files')
      .set('Authorization', 'Bearer x')
      .send({ name: 'syllabus.pdf', url: 'https://cdn.example/s.pdf', visibility: 'published' });

    expect(res.status).toBe(201);
    expect(prisma.courseFile.create).toHaveBeenCalledTimes(1);
    expect(prisma.courseFile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'syllabus.pdf', courseId: 'c1', type: 'pdf' }),
      })
    );
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(res.body.file.name).toBe('syllabus.pdf');
  });

  it('metadata POST rejects unknown keys (400)', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/files')
      .set('Authorization', 'Bearer x')
      .send({ name: 'a.pdf', bogus: 1 });

    expect(res.status).toBe(400);
    expect(prisma.courseFile.create).not.toHaveBeenCalled();
  });

  it('metadata POST without name → 400', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/courses/c1/files')
      .set('Authorization', 'Bearer x')
      .send({ url: 'https://cdn.example/s.pdf' });

    expect(res.status).toBe(400);
    expect(prisma.courseFile.create).not.toHaveBeenCalled();
  });

  it('faculty PUT grades for unenrolled student → 403', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await (await import('supertest'))
      .default(app())
      .put('/api/courses/c1/grades/u-stranger')
      .set('Authorization', 'Bearer x')
      .send({ midtermGrade: 90 });

    expect(res.status).toBe(403);
    expect(prisma.courseGrade.upsert).not.toHaveBeenCalled();
  });

  it('student GET grades of another student → 403', async () => {
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

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/courses/c1/grades?studentId=u-other')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(403);
    expect(prisma.courseGrade.findMany).not.toHaveBeenCalled();
  });
});
