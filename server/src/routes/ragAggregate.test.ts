import '../env.js';
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ragAggregateRouter } from './ragAggregate.js';
import { errorMiddleware } from '../utils/errors.js';
import { createRequesterToken } from '../utils/requesterToken.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/rag-aggregate', ragAggregateRouter);
  a.use(errorMiddleware);
  return a;
}

const KEY = process.env.RAG_EXPORT_KEY as string;

describe('ragAggregate', () => {
  it('401s without the service key', async () => {
    const res = await request(app()).post('/api/rag-aggregate').send({
      table: 'course', metric: 'count',
    });
    expect(res.status).toBe(401);
  });

  it('counts courses', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'course', metric: 'count' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ table: 'course', metric: 'count', value: expect.any(Number) });
  });

  it('counts with an equality filter', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'course', metric: 'count', filters: { published: true } });
    expect(res.status).toBe(200);
    expect(typeof res.body.value).toBe('number');
  });

  it('derives own-table scope from a valid requester token', async () => {
    const requesterToken = createRequesterToken({ sub: 'usr-stud-1', role: 'student' });
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'submission', metric: 'rows', fields: ['studentId'], requesterToken });

    expect(res.status).toBe(200);
    expect(res.body.value.length).toBeGreaterThan(0);
    expect(res.body.value.every((row: Record<string, unknown>) => row.studentId === 'usr-stud-1')).toBe(true);
  });

  it('rejects missing, invalid, and expired requester tokens for own tables', async () => {
    const expiredToken = jwt.sign(
      { role: 'student', type: 'rag-requester' },
      process.env.JWT_SECRET as string,
      { subject: 'usr-stud-1', issuer: 'gabay-rag', expiresIn: -1 },
    );
    const tokens = [undefined, 'invalid', expiredToken];

    for (const requesterToken of tokens) {
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'submission', metric: 'count', requesterToken });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('unauthorized');
    }
  });

  it('rejects body requesterId when a requester token is present', async () => {
    const requesterToken = createRequesterToken({ sub: 'usr-stud-1', role: 'student' });
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({
        table: 'submission',
        metric: 'rows',
        requesterToken,
        requesterId: 'usr-stud-2',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('requesterId must be omitted when requesterToken is provided.');
  });

  it('rejects non-object filters and non-primitive filter values', async () => {
    const invalidFilters = [
      null,
      [],
      [{ published: true }],
      1,
      'published',
      { published: { equals: true } },
      { published: ['true'] },
      { published: null },
    ];

    for (const filters of invalidFilters) {
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'course', metric: 'count', filters });
      expect(res.status).toBe(400);
    }
  });

  it('keeps aggregate response shape for sum, min, and max with row options', async () => {
    for (const metric of ['sum', 'min', 'max']) {
      const baseline = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'course', metric, field: 'enrolledCount' });
      const withOptions = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'course', metric, field: 'enrolledCount', fields: ['id'], limit: 1, offset: 1 });
      expect(baseline.status).toBe(200);
      expect(withOptions.status).toBe(200);
      expect(Object.keys(withOptions.body).sort()).toEqual(['metric', 'table', 'value']);
      expect(withOptions.body).toEqual({ table: 'course', metric, value: baseline.body.value });
    }
  });

  it('rejects unknown tables and metrics', async () => {
    for (const body of [
      { table: 'user', metric: 'count' },
      { table: 'course', metric: 'median' },
      { table: 'course', metric: 'sum', field: 'title' },
    ]) {
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY).send(body);
      expect(res.status).toBe(400);
    }
  });

  it('rejects email as a user_directory field or filter (directory privacy)', async () => {
    for (const body of [
      { table: 'user_directory', metric: 'rows', fields: ['name', 'email'] },
      { table: 'user_directory', metric: 'rows', fields: ['email'] },
      { table: 'user_directory', metric: 'count', filters: { email: 'student1@dmmmsu.edu.ph' } },
    ]) {
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY).send(body);
      expect(res.status).toBe(400);
    }
  });

  it('infers table and metric from a raw question', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ question: 'how many students are there?' });
    expect(res.status).toBe(200);
    // Seeded evaluation fixture (server/prisma/seedLarge.ts, deterministic): 46 students.
    expect(res.body).toEqual({ table: 'user_directory', metric: 'count', value: 46 });
  });

  it('infers average-grade questions to submission avg', async () => {
    const requesterToken = createRequesterToken({ sub: 'usr-stud-1', role: 'student' });
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ question: 'what is the average grade?', requesterToken });
    expect(res.status).toBe(200);
    expect(res.body.table).toBe('submission');
    expect(res.body.metric).toBe('avg');
    // Seeded evaluation fixture average over usr-stud-1's graded submissions.
    expect(res.body.value).toBeCloseTo(66.7, 0);
  });

  it('scopes per-student tables to the signed requester', async () => {
    const noToken = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'submission', metric: 'count' });
    expect(noToken.status).toBe(401);
    const requesterToken = createRequesterToken({ sub: 'usr-stud-1', role: 'student' });
    const ok = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'submission', metric: 'count', requesterToken });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.value).toBe('number');
  });

  it('returns only requested safe user fields with row metadata', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({
        table: 'user_directory',
        metric: 'rows',
        filters: { role: 'student' },
        fields: ['name', 'role'],
        limit: 100,
      });
    expect(res.status).toBe(200);
    expect(res.body.value).toEqual(expect.any(Array));
    expect(res.body.value.length).toBeGreaterThan(0);
    expect(res.body.value.every((row: Record<string, unknown>) => !('passwordHash' in row))).toBe(true);
    expect(Object.keys(res.body.value[0]).sort()).toEqual(['id', 'name', 'role']);
    expect(res.body).toMatchObject({ count: expect.any(Number), hasMore: expect.any(Boolean), nextOffset: null });
  });

  it('always includes course grade composite identity fields', async () => {
    const requesterToken = createRequesterToken({ sub: 'usr-stud-1', role: 'student' });
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({
        table: 'course_grade',
        metric: 'rows',
        fields: ['midtermGrade'],
        requesterToken,
      });
    expect(res.status).toBe(200);
    expect(res.body.value.length).toBeGreaterThan(0);
    expect(Object.keys(res.body.value[0]).sort()).toEqual(['courseId', 'midtermGrade', 'studentId']);
    expect(res.body.value.every((row: Record<string, unknown>) => row.studentId === 'usr-stud-1')).toBe(true);
  });

  it('returns the full safe user projection when fields are omitted', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'user_directory', metric: 'rows', filters: { role: 'student' }, limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.value.length).toBeGreaterThan(0);
    expect(Object.keys(res.body.value[0]).sort()).toEqual(['department', 'id', 'name', 'role', 'title']);
    expect(res.body.value.every((row: Record<string, unknown>) => !('passwordHash' in row))).toBe(true);
    expect(res.body).toMatchObject({ count: expect.any(Number), hasMore: expect.any(Boolean), nextOffset: null });
  });

  it('returns deterministic consecutive user pages', async () => {
    const first = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'user_directory', metric: 'rows', fields: ['id'], limit: 2 });
    const second = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'user_directory', metric: 'rows', fields: ['id'], limit: 2, offset: 2 });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.hasMore).toBe(true);
    expect(first.body.nextOffset).toBe(2);
    expect(first.body.value).toHaveLength(2);
    expect(second.body.value).toHaveLength(2);
    const firstIds = first.body.value.map((row: { id: string }) => row.id);
    const secondIds = second.body.value.map((row: { id: string }) => row.id);
    expect(firstIds).toEqual([...firstIds].sort((a, b) => a.localeCompare(b)));
    expect(secondIds).toEqual([...secondIds].sort((a, b) => a.localeCompare(b)));
    expect(firstIds).not.toEqual(secondIds);
  });

  it('rejects unsafe fields and invalid pagination bounds', async () => {
    for (const body of [
      { table: 'user_directory', metric: 'rows', fields: ['passwordHash'] },
      { table: 'user_directory', metric: 'rows', fields: ['name', 7] },
      { table: 'user_directory', metric: 'rows', limit: 0 },
      { table: 'user_directory', metric: 'rows', limit: 501 },
      { table: 'user_directory', metric: 'rows', offset: -1 },
      { table: 'user_directory', metric: 'rows', offset: 1.5 },
    ]) {
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY).send(body);
      expect(res.status).toBe(400);
    }
  });

  it('hydrates exact single-ID user rows with safe fields', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({
        table: 'user_directory',
        metric: 'rows',
        recordIds: ['usr-stud-1'],
        fields: ['name', 'role'],
      });
    expect(res.status).toBe(200);
    expect(res.body.value).toEqual([{ id: 'usr-stud-1', name: 'Student 1', role: 'student' }]);
    expect(res.body.value.every((row: Record<string, unknown>) => !('passwordHash' in row))).toBe(true);
  });

  it('returns no rows for unknown record IDs', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'user_directory', metric: 'rows', recordIds: ['unknown-user-id'] });
    expect(res.status).toBe(200);
    expect(res.body.value).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('rejects more than 500 record IDs', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'user_directory', metric: 'rows', recordIds: Array.from({ length: 501 }, (_, index) => `user-${index}`) });
    expect(res.status).toBe(400);
  });

  it('rejects record IDs for non-row metrics', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'user_directory', metric: 'count', recordIds: ['usr-stud-1'] });
    expect(res.status).toBe(400);
  });

  it('rejects record IDs for composite-key tables', async () => {
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({ table: 'course_grade', metric: 'rows', recordIds: ['course-1'], requesterId: 'usr-stud-1' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('recordIds are unsupported for composite-key tables');
  });

  it('preserves requester scope during record ID hydration', async () => {
    const requesterToken = createRequesterToken({ sub: 'usr-stud-1', role: 'student' });
    const res = await request(app()).post('/api/rag-aggregate')
      .set('x-rag-export-key', KEY)
      .send({
        table: 'submission',
        metric: 'rows',
        recordIds: ['seed-sub-0000', 'seed-sub-0001'],
        fields: ['id', 'studentId'],
        requesterToken,
      });
    expect(res.status).toBe(200);
    expect(res.body.value).toEqual([
      { id: 'seed-sub-0000', studentId: 'usr-stud-1' },
      { id: 'seed-sub-0001', studentId: 'usr-stud-1' },
    ]);
  });

  it('rejects sensitive submission fields', async () => {
    const requesterToken = createRequesterToken({ sub: 'usr-stud-1', role: 'student' });
    for (const field of ['content', 'fileUrl']) {
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'submission', metric: 'rows', fields: [field], requesterToken });
      expect(res.status).toBe(400);
    }
  });

  describe('enrollment_request isolation', () => {
    async function facultyRows() {
      const facultyToken = createRequesterToken({ sub: 'seed-fac-02', role: 'faculty' });
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'enrollment_request', metric: 'rows', limit: 500, requesterToken: facultyToken });
      expect(res.status).toBe(200);
      return res.body.value as Array<{ id: string; courseId: string; studentId: string }>;
    }

    it('requires a requester token: service key alone cannot read student-scoped enrollment rows', async () => {
      for (const body of [
        { table: 'enrollment_request', metric: 'count' },
        { table: 'enrollment_request', metric: 'rows', limit: 5 },
        { table: 'enrollment_request', metric: 'rows', filters: { courseId: 'c-mu1ckjxi-147t5i' } },
      ]) {
        const res = await request(app()).post('/api/rag-aggregate')
          .set('x-rag-export-key', KEY)
          .send(body);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('unauthorized');
      }
    });

    it('forces student scope to the token subject, ignoring a cross-student filter', async () => {
      const rows = await facultyRows();
      const studentA = rows[0].studentId;
      const other = rows.find((row) => row.studentId !== studentA)!.studentId;
      const studentToken = createRequesterToken({ sub: studentA, role: 'student' });

      const scoped = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'enrollment_request', metric: 'rows', limit: 500, requesterToken: studentToken });
      expect(scoped.status).toBe(200);
      expect(scoped.body.value.length).toBeGreaterThan(0);
      expect(scoped.body.value.every((row: { studentId: string }) => row.studentId === studentA)).toBe(true);

      const forced = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({
          table: 'enrollment_request', metric: 'rows', limit: 500,
          filters: { studentId: other }, requesterToken: studentToken,
        });
      expect(forced.status).toBe(200);
      expect(forced.body.value.length).toBeGreaterThan(0);
      expect(forced.body.value.every((row: { studentId: string }) => row.studentId === studentA)).toBe(true);

      const counted = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'enrollment_request', metric: 'count', requesterToken: studentToken });
      expect(counted.status).toBe(200);
      expect(counted.body.value).toBe(scoped.body.value.length);
    });

    it('lets faculty/admin/staff query course and all rows', async () => {
      const rows = await facultyRows();
      const courseId = rows[0].courseId;
      for (const role of ['faculty', 'admin', 'staff']) {
        const token = createRequesterToken({ sub: `role-check-${role}`, role });
        const byCourse = await request(app()).post('/api/rag-aggregate')
          .set('x-rag-export-key', KEY)
          .send({ table: 'enrollment_request', metric: 'rows', filters: { courseId }, limit: 500, requesterToken: token });
        expect(byCourse.status).toBe(200);
        expect(byCourse.body.value.length).toBeGreaterThan(0);
        expect(byCourse.body.value.every((row: { courseId: string }) => row.courseId === courseId)).toBe(true);
      }
      const facultyToken = createRequesterToken({ sub: 'seed-fac-02', role: 'faculty' });
      const counted = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'enrollment_request', metric: 'count', requesterToken: facultyToken });
      expect(counted.status).toBe(200);
      expect(counted.body.value).toBe(rows.length);
    });

    it('treats unknown roles as student-scoped', async () => {
      const rows = await facultyRows();
      const studentA = rows[0].studentId;
      const token = createRequesterToken({ sub: studentA, role: 'dean' });
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'enrollment_request', metric: 'rows', limit: 500, requesterToken: token });
      expect(res.status).toBe(200);
      expect(res.body.value.every((row: { studentId: string }) => row.studentId === studentA)).toBe(true);
    });

    it('rejects invalid and expired requester tokens for enrollment_request', async () => {
      const expiredToken = jwt.sign(
        { role: 'student', type: 'rag-requester' },
        process.env.JWT_SECRET as string,
        { subject: 'usr-stud-1', issuer: 'gabay-rag', expiresIn: -1 },
      );
      for (const requesterToken of ['invalid', expiredToken]) {
        const res = await request(app()).post('/api/rag-aggregate')
          .set('x-rag-export-key', KEY)
          .send({ table: 'enrollment_request', metric: 'rows', limit: 5, requesterToken });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('unauthorized');
      }
    });

    it('rejects body requesterId when a requester token is present', async () => {
      const token = createRequesterToken({ sub: 'seed-fac-02', role: 'faculty' });
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({ table: 'enrollment_request', metric: 'count', requesterToken: token, requesterId: 'anyone' });
      expect(res.status).toBe(400);
    });

    it('scopes recordIds hydration to the requesting student', async () => {
      const rows = await facultyRows();
      const studentA = rows[0].studentId;
      const idA = rows.find((row) => row.studentId === studentA)!.id;
      const idOther = rows.find((row) => row.studentId !== studentA)!.id;
      const studentToken = createRequesterToken({ sub: studentA, role: 'student' });
      const res = await request(app()).post('/api/rag-aggregate')
        .set('x-rag-export-key', KEY)
        .send({
          table: 'enrollment_request', metric: 'rows',
          recordIds: [idA, idOther], fields: ['studentId'], requesterToken: studentToken,
        });
      expect(res.status).toBe(200);
      expect(res.body.value).toEqual([{ id: idA, studentId: studentA }]);
    });
  });
});
