// server/src/routes/spr.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    course: { findUnique: vi.fn(), update: vi.fn() },
    courseGrade: { upsert: vi.fn(), findMany: vi.fn() },
    enrollmentRequest: { findFirst: vi.fn() },
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
import { sprRouter } from './spr.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api', sprRouter);
  a.use(errorMiddleware);
  return a;
}

describe('SPR routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'u-fac',
      role: 'faculty',
    });
  });

  it('rejects unauthenticated SPR reads with 401', async () => {
    const res = await (await import('supertest'))
      .default(app())
      .get('/api/courses/any-course/spr');
    expect([401, 403]).toContain(res.status);
  });

  it('GET returns parsed config or null; unknown course → 404', async () => {
    const config = { midtermColumns: [], finalColumns: [], mtExamPerfect: 60, ftExamPerfect: 60 };
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'c1',
      instructorId: 'u-fac',
      sprConfig: JSON.stringify(config),
    });
    const ok = await (await import('supertest'))
      .default(app())
      .get('/api/courses/c1/spr')
      .set('Authorization', 'Bearer x');
    expect(ok.status).toBe(200);
    expect(ok.body.config).toEqual(config);

    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const missing = await (await import('supertest'))
      .default(app())
      .get('/api/courses/nope/spr')
      .set('Authorization', 'Bearer x');
    expect(missing.status).toBe(404);
  });

  it('PUT config without config → 400; success echoes config', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-fac',
    });
    const request = (await import('supertest')).default;
    const bad = await request(app())
      .put('/api/courses/c1/spr')
      .set('Authorization', 'Bearer x')
      .send({});
    expect(bad.status).toBe(400);

    const config = { midtermColumns: [], finalColumns: [], mtExamPerfect: 60, ftExamPerfect: 60 };
    (prisma.course.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      sprConfig: JSON.stringify(config),
    });
    const good = await request(app())
      .put('/api/courses/c1/spr')
      .set('Authorization', 'Bearer x')
      .send({ config });
    expect(good.status).toBe(200);
    expect(good.body.config).toEqual(config);
  });

  it('PUT config as non-owner faculty → 403', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-other',
    });
    const res = await (await import('supertest'))
      .default(app())
      .put('/api/courses/c1/spr')
      .set('Authorization', 'Bearer x')
      .send({ config: { midtermColumns: [], finalColumns: [], mtExamPerfect: 60, ftExamPerfect: 60 } });
    expect(res.status).toBe(403);
  });

  it('PUT cells for unenrolled student → 403', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-fac',
    });
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await (await import('supertest'))
      .default(app())
      .put('/api/courses/c1/spr/u-stranger')
      .set('Authorization', 'Bearer x')
      .send({ midtermScores: {}, mtExam: null, finalScores: {}, ftExam: null });

    expect(res.status).toBe(403);
    expect(prisma.courseGrade.upsert).not.toHaveBeenCalled();
  });

  it('PUT cells validates scores; upserts and echoes cells', async () => {
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-fac',
    });
    (prisma.enrollmentRequest.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: 'c1',
      studentId: 's1',
      status: 'approved',
    });
    (prisma.course.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-fac',
    });
    const request = (await import('supertest')).default;
    const bad = await request(app())
      .put('/api/courses/c1/spr/s1')
      .set('Authorization', 'Bearer x')
      .send({ midtermScores: { q1: -5 }, mtExam: null, finalScores: {}, ftExam: null });
    expect(bad.status).toBe(400);

    const cells = { midtermScores: { q1: 8 }, mtExam: 50, finalScores: {}, ftExam: null };
    (prisma.courseGrade.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      courseId: 'c1',
      studentId: 's1',
      sprCells: JSON.stringify(cells),
    });
    const good = await request(app())
      .put('/api/courses/c1/spr/s1')
      .set('Authorization', 'Bearer x')
      .send(cells);
    expect(good.status).toBe(200);
    expect(good.body.cells).toEqual(cells);
  });
});
