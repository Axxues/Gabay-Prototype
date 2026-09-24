import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => {
  const txCourseUpdate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data }));
  const tx = {
    course: {
      update: txCourseUpdate,
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
    },
    courseFile: { findUnique: vi.fn().mockResolvedValue(null) },
    syllabus: {
      aggregate: vi.fn().mockResolvedValue({ _max: { revisionNo: 0 } }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        courseId: 'c1',
        revisionNo: 1,
        status: 'draft',
        schemaVersion: '1',
        rowVersion: 1,
        createdAt: new Date('2026-09-24T08:00:00.000Z'),
        updatedAt: new Date('2026-09-24T09:00:00.000Z'),
        publishedAt: null,
      })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
    },
    syllabusInstitution: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })) },
    syllabusCourseInfo: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })) },
    syllabusInstitutionalStatement: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })),
    },
    syllabusGradingSystem: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })) },
    syllabusExtensionField: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data })) },
    syllabusFaculty: { create: vi.fn() },
    syllabusRequirement: { create: vi.fn() },
    syllabusPolicy: { create: vi.fn(), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    syllabusRubric: { create: vi.fn() },
    syllabusOutlineBlock: { create: vi.fn() },
    syllabusLearningPlan: { create: vi.fn() },
    syllabusCourseOutcome: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    syllabusCourseMap: { create: vi.fn() },
    syllabusReference: { create: vi.fn() },
    syllabusSignatory: { create: vi.fn() },
    syllabusProgramOutcome: { create: vi.fn() },
    syllabusCoreValue: { create: vi.fn() },
    syllabusGraduateAttribute: { create: vi.fn() },
    programOutcome: { upsert: vi.fn() },
    coreValue: { upsert: vi.fn() },
    graduateAttribute: { upsert: vi.fn() },
  };
  return {
    prisma: {
      course: {
        findUnique: vi.fn(),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data })),
      },
      enrollmentRequest: { findFirst: vi.fn() },
      syllabus: tx.syllabus,
      $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx)),
    },
    __tx: tx,
  };
});
vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});

process.env.JWT_SECRET ??= 'test-secret';

import { prisma } from '../db.js';
import * as db from '../db.js';
import jwt from 'jsonwebtoken';
import express from 'express';
import { coursesRouter } from './courses.js';
import { setSyllabusRepository } from './syllabi.js';
import { SyllabusSourceFileError } from '../syllabi/repository.js';
import { SyllabusNormalizationError } from '../utils/syllabusNormalization.js';
import { errorMiddleware } from '../utils/errors.js';

type Mock = ReturnType<typeof vi.fn>;

interface TxHandles {
  course: { update: Mock; findUnique: Mock };
  courseFile: { findUnique: Mock };
  syllabus: { aggregate: Mock; findUnique: Mock; create: Mock };
  syllabusInstitution: { create: Mock };
  syllabusCourseInfo: { create: Mock };
}

const tx = (db as unknown as Record<string, unknown>).__tx as unknown as TxHandles;

function app() {
  const a = express();
  a.use(express.json({ limit: '35mb' }));
  a.use('/api/courses', coursesRouter);
  a.use(errorMiddleware);
  return a;
}

async function request() {
  return (await import('supertest')).default;
}

describe('courses PATCH legacy dual-write', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSyllabusRepository(null);
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-fac', role: 'faculty' });
    (prisma.course.findUnique as Mock).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-fac',
      published: true,
    });
    (tx.courseFile.findUnique as Mock).mockResolvedValue(null);
    (tx.syllabus.aggregate as Mock).mockResolvedValue({ _max: { revisionNo: 0 } });
  });

  it('writes relational rows and the legacy column in one transaction', async () => {
    const res = await (await request())(app())
      .patch('/api/courses/c1')
      .set('Authorization', 'Bearer x')
      .send({ syllabus: JSON.stringify({ courseInfo: { code: 'CS 201' } }) });

    expect(res.status).toBe(200);
    expect(prisma.$transaction as Mock).toHaveBeenCalledTimes(1);
    expect(tx.syllabus.create as Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: 'c1', revisionNo: 1, status: 'draft' }),
      }),
    );
    expect(tx.syllabusCourseInfo.create as Mock).toHaveBeenCalledTimes(1);
    const legacyUpdate = (tx.course.update as Mock).mock.calls[0][0];
    expect(legacyUpdate).toEqual({
      where: { id: 'c1' },
      data: { syllabus: expect.any(String) },
    });
    expect(JSON.parse(legacyUpdate.data.syllabus).courseInfo.code).toBe('CS 201');
    expect(prisma.course.update as Mock).not.toHaveBeenCalled();
  });

  it('creates no draft for a null legacy syllabus and clears the column', async () => {
    (prisma.course.update as Mock).mockImplementation(
      (args: { where: unknown; data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'c1', ...args.data }),
    );
    const res = await (await request())(app())
      .patch('/api/courses/c1')
      .set('Authorization', 'Bearer x')
      .send({ syllabus: null });

    expect(res.status).toBe(200);
    expect(prisma.$transaction as Mock).not.toHaveBeenCalled();
    expect(prisma.course.update as Mock).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { syllabus: null },
    });
  });

  it('fails without committing the legacy column when relational persistence fails', async () => {
    (tx.syllabusInstitution.create as Mock).mockRejectedValueOnce(new Error('child insert failed'));
    const res = await (await request())(app())
      .patch('/api/courses/c1')
      .set('Authorization', 'Bearer x')
      .send({ syllabus: JSON.stringify({ courseInfo: { code: 'CS 201' } }) });

    expect(res.status).toBe(500);
    expect(tx.course.update as Mock).not.toHaveBeenCalled();
    expect(prisma.course.update as Mock).not.toHaveBeenCalled();
  });

  it('maps a source-file error to 422 like the section router', async () => {
    setSyllabusRepository({
      replaceFromLegacy: async () => {
        throw new SyllabusSourceFileError();
      },
    } as never);
    const res = await (await request())(app())
      .patch('/api/courses/c1')
      .set('Authorization', 'Bearer x')
      .send({ syllabus: JSON.stringify({ courseInfo: { code: 'CS 201' } }) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_syllabus_section');
  });

  it('maps a normalization error to 422 like the section router', async () => {
    setSyllabusRepository({
      replaceFromLegacy: async () => {
        throw new SyllabusNormalizationError('Syllabus must be a JSON object.');
      },
    } as never);
    const res = await (await request())(app())
      .patch('/api/courses/c1')
      .set('Authorization', 'Bearer x')
      .send({ syllabus: JSON.stringify({ courseInfo: { code: 'CS 201' } }) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_syllabus_section');
  });

  it('documents draft-only visibility so students keep seeing the published revision', async () => {
    const res = await (await request())(app())
      .patch('/api/courses/c1')
      .set('Authorization', 'Bearer x')
      .send({ syllabus: JSON.stringify({ courseInfo: { code: 'CS 201' } }) });

    expect(res.status).toBe(200);
    expect(tx.syllabus.create as Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'draft' }),
      }),
    );
    expect(res.body.syllabusCompat?.mode).toBe('draft');
    expect(String(res.body.syllabusCompat?.message ?? '')).toMatch(/published/i);
  });
});
