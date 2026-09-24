import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    course: { findUnique: vi.fn() },
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
import { createSyllabusRouter } from './syllabi.js';
import { errorMiddleware } from '../utils/errors.js';
import {
  SyllabusConflictError,
  SyllabusNotFoundError,
  SyllabusPublishError,
} from '../syllabi/repository.js';

type Mock = ReturnType<typeof vi.fn>;

const header = (overrides: Record<string, unknown> = {}) => ({
  id: 'rev-1',
  courseId: 'c1',
  revisionNo: 1,
  status: 'draft',
  schemaVersion: '1',
  rowVersion: 4,
  createdAt: '2026-09-24T08:00:00.000Z',
  updatedAt: '2026-09-24T09:00:00.000Z',
  publishedAt: null,
  ...overrides,
});

const document = { courseId: 'c1', courseInfo: { code: 'CS 201', title: 'Data Structures' } };

const envelope = (overrides: Record<string, unknown> = {}) => ({
  revision: header(overrides),
  syllabus: document,
});

function mockRepo() {
  return {
    getPublishedEnvelope: vi.fn(),
    getRevisionEnvelope: vi.fn(),
    listRevisions: vi.fn(),
    createDraft: vi.fn(),
    replaceSection: vi.fn(),
    publish: vi.fn(),
    deleteDraft: vi.fn(),
    replaceFromLegacy: vi.fn(),
  };
}

type Repo = ReturnType<typeof mockRepo>;

function app(repo: Repo) {
  const a = express();
  a.use(express.json());
  a.use('/api/courses', createSyllabusRouter(repo as never));
  a.use(errorMiddleware);
  return a;
}

async function request() {
  return (await import('supertest')).default;
}

describe('syllabus router', () => {
  let repo: Repo;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = mockRepo();
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-fac', role: 'faculty' });
    (prisma.course.findUnique as Mock).mockResolvedValue({
      id: 'c1',
      instructorId: 'u-fac',
      published: true,
    });
  });

  it('GET published returns the repository envelope for a member student', async () => {
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-stu', role: 'student' });
    (prisma.enrollmentRequest.findFirst as Mock).mockResolvedValue({ id: 'req-1' });
    repo.getPublishedEnvelope.mockResolvedValue(envelope({ status: 'published' }));
    const res = await (await request())(app(repo))
      .get('/api/courses/c1/syllabus')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(200);
    expect(repo.getPublishedEnvelope).toHaveBeenCalledWith('c1');
    expect(res.body.syllabus).toEqual(document);
    expect(res.body.revision.courseId).toBe('c1');
  });

  it('GET published without a token returns 401', async () => {
    const res = await (await request())(app(repo)).get('/api/courses/c1/syllabus');
    expect(res.status).toBe(401);
  });

  it('GET published for a non-member student returns 403', async () => {
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-stu', role: 'student' });
    (prisma.enrollmentRequest.findFirst as Mock).mockResolvedValue(null);
    const res = await (await request())(app(repo))
      .get('/api/courses/c1/syllabus')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(403);
  });

  it('GET published with no published revision returns 404 syllabus_not_found', async () => {
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-stu', role: 'student' });
    (prisma.enrollmentRequest.findFirst as Mock).mockResolvedValue({ id: 'req-1' });
    repo.getPublishedEnvelope.mockResolvedValue(null);
    const res = await (await request())(app(repo))
      .get('/api/courses/c1/syllabus')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('syllabus_not_found');
  });

  it('GET published for an unknown course returns 404', async () => {
    (prisma.course.findUnique as Mock).mockResolvedValue(null);
    const res = await (await request())(app(repo))
      .get('/api/courses/nope/syllabus')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(404);
  });

  it('GET revisions lists headers for the owning instructor', async () => {
    repo.listRevisions.mockResolvedValue([header(), header({ id: 'rev-2', revisionNo: 2 })]);
    const res = await (await request())(app(repo))
      .get('/api/courses/c1/syllabus/revisions')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(200);
    expect(repo.listRevisions).toHaveBeenCalledWith('c1');
    expect(res.body.revisions.map((row: { id: string }) => row.id)).toEqual(['rev-1', 'rev-2']);
  });

  it('GET revisions rejects students and non-owners with 403', async () => {
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-stu', role: 'student' });
    const student = await (await request())(app(repo))
      .get('/api/courses/c1/syllabus/revisions')
      .set('Authorization', 'Bearer x');
    expect(student.status).toBe(403);
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-other', role: 'faculty' });
    const outsider = await (await request())(app(repo))
      .get('/api/courses/c1/syllabus/revisions')
      .set('Authorization', 'Bearer x');
    expect(outsider.status).toBe(403);
    expect(repo.listRevisions).not.toHaveBeenCalled();
  });

  it('GET one revision returns the repository envelope', async () => {
    repo.getRevisionEnvelope.mockResolvedValue(envelope());
    const res = await (await request())(app(repo))
      .get('/api/courses/c1/syllabus/revisions/rev-1')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(200);
    expect(repo.getRevisionEnvelope).toHaveBeenCalledWith('c1', 'rev-1');
    expect(res.body.revision.id).toBe('rev-1');
  });

  it('GET one revision maps a missing revision to 404 syllabus_not_found', async () => {
    repo.getRevisionEnvelope.mockResolvedValue(null);
    const res = await (await request())(app(repo))
      .get('/api/courses/c1/syllabus/revisions/rev-9')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('syllabus_not_found');
  });

  it('POST revisions creates a draft and returns 201', async () => {
    repo.createDraft.mockResolvedValue(header());
    repo.getRevisionEnvelope.mockResolvedValue(envelope());
    const res = await (await request())(app(repo))
      .post('/api/courses/c1/syllabus/revisions')
      .set('Authorization', 'Bearer x')
      .send({});
    expect(res.status).toBe(201);
    expect(repo.createDraft).toHaveBeenCalledWith('c1', 'u-fac', undefined);
    expect(res.body.revision.id).toBe('rev-1');
  });

  it('POST revisions forwards a source revision id and maps a missing source to 404', async () => {
    repo.createDraft.mockResolvedValueOnce(header()).mockRejectedValueOnce(new SyllabusNotFoundError());
    repo.getRevisionEnvelope.mockResolvedValue(envelope());
    const ok = await (await request())(app(repo))
      .post('/api/courses/c1/syllabus/revisions')
      .set('Authorization', 'Bearer x')
      .send({ sourceRevisionId: 'rev-0' });
    expect(ok.status).toBe(201);
    expect(repo.createDraft).toHaveBeenCalledWith('c1', 'u-fac', 'rev-0');
    const missing = await (await request())(app(repo))
      .post('/api/courses/c1/syllabus/revisions')
      .set('Authorization', 'Bearer x')
      .send({ sourceRevisionId: 'rev-9' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('syllabus_not_found');
  });

  it('students cannot create drafts (403) and non-owners cannot either', async () => {
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-stu', role: 'student' });
    const student = await (await request())(app(repo))
      .post('/api/courses/c1/syllabus/revisions')
      .set('Authorization', 'Bearer x')
      .send({});
    expect(student.status).toBe(403);
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'u-other', role: 'faculty' });
    const outsider = await (await request())(app(repo))
      .post('/api/courses/c1/syllabus/revisions')
      .set('Authorization', 'Bearer x')
      .send({});
    expect(outsider.status).toBe(403);
    expect(repo.createDraft).not.toHaveBeenCalled();
  });

  it('PATCH section calls replaceSection once with route values', async () => {
    repo.replaceSection.mockResolvedValue(header());
    repo.getRevisionEnvelope.mockResolvedValue(envelope());
    const res = await (await request())(app(repo))
      .patch('/api/courses/c1/syllabus/revisions/rev-1/sections/policies')
      .set('Authorization', 'Bearer x')
      .set('If-Match', '3')
      .send({ value: ['New policy'] });
    expect(res.status).toBe(200);
    expect(repo.replaceSection).toHaveBeenCalledTimes(1);
    expect(repo.replaceSection).toHaveBeenCalledWith('c1', 'rev-1', 3, 'policies', ['New policy']);
    expect(res.body.revision.rowVersion).toBe(4);
  });

  it('PATCH section prefers the If-Match header over the body version', async () => {
    repo.replaceSection.mockResolvedValue(header());
    repo.getRevisionEnvelope.mockResolvedValue(envelope());
    const res = await (await request())(app(repo))
      .patch('/api/courses/c1/syllabus/revisions/rev-1/sections/policies')
      .set('Authorization', 'Bearer x')
      .set('If-Match', '5')
      .send({ value: [], expectedRowVersion: 3 });
    expect(res.status).toBe(200);
    expect(repo.replaceSection).toHaveBeenCalledWith('c1', 'rev-1', 5, 'policies', []);
  });

  it('PATCH section falls back to the body version without a header', async () => {
    repo.replaceSection.mockResolvedValue(header());
    repo.getRevisionEnvelope.mockResolvedValue(envelope());
    const res = await (await request())(app(repo))
      .patch('/api/courses/c1/syllabus/revisions/rev-1/sections/policies')
      .set('Authorization', 'Bearer x')
      .send({ value: [], expectedRowVersion: 3 });
    expect(res.status).toBe(200);
    expect(repo.replaceSection).toHaveBeenCalledWith('c1', 'rev-1', 3, 'policies', []);
  });

  it('PATCH section maps a missing version to 422 invalid_syllabus_section', async () => {
    const res = await (await request())(app(repo))
      .patch('/api/courses/c1/syllabus/revisions/rev-1/sections/policies')
      .set('Authorization', 'Bearer x')
      .send({ value: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_syllabus_section');
    expect(repo.replaceSection).not.toHaveBeenCalled();
  });

  it('PATCH section maps a malformed version to 422 invalid_syllabus_section', async () => {
    const res = await (await request())(app(repo))
      .patch('/api/courses/c1/syllabus/revisions/rev-1/sections/policies')
      .set('Authorization', 'Bearer x')
      .set('If-Match', 'stale')
      .send({ value: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_syllabus_section');
    expect(repo.replaceSection).not.toHaveBeenCalled();
  });

  it('PATCH section rejects unknown section names with 422', async () => {
    const res = await (await request())(app(repo))
      .patch('/api/courses/c1/syllabus/revisions/rev-1/sections/bogus')
      .set('Authorization', 'Bearer x')
      .set('If-Match', '3')
      .send({ value: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_syllabus_section');
    expect(repo.replaceSection).not.toHaveBeenCalled();
  });

  it('PATCH section rejects invalid payloads with 422', async () => {
    const res = await (await request())(app(repo))
      .patch('/api/courses/c1/syllabus/revisions/rev-1/sections/policies')
      .set('Authorization', 'Bearer x')
      .set('If-Match', '3')
      .send({ value: 'not-a-list' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_syllabus_section');
    expect(repo.replaceSection).not.toHaveBeenCalled();
  });

  it('PATCH section maps stale versions to 409 revision_conflict', async () => {
    repo.replaceSection.mockRejectedValue(new SyllabusConflictError());
    const res = await (await request())(app(repo))
      .patch('/api/courses/c1/syllabus/revisions/rev-1/sections/policies')
      .set('Authorization', 'Bearer x')
      .set('If-Match', '2')
      .send({ value: [] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('revision_conflict');
  });

  it('POST publish maps incomplete drafts to 422 revision_not_publishable', async () => {
    repo.publish.mockRejectedValue(new SyllabusPublishError('Course information is required.'));
    const res = await (await request())(app(repo))
      .post('/api/courses/c1/syllabus/revisions/rev-1/publish')
      .set('Authorization', 'Bearer x')
      .set('If-Match', '3')
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('revision_not_publishable');
  });

  it('POST publish maps a missing version to 422 invalid_syllabus_section', async () => {
    const res = await (await request())(app(repo))
      .post('/api/courses/c1/syllabus/revisions/rev-1/publish')
      .set('Authorization', 'Bearer x')
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('invalid_syllabus_section');
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it('POST publish succeeds with the envelope', async () => {
    repo.publish.mockResolvedValue(header({ status: 'published', rowVersion: 5 }));
    repo.getRevisionEnvelope.mockResolvedValue(envelope({ status: 'published', rowVersion: 5 }));
    const res = await (await request())(app(repo))
      .post('/api/courses/c1/syllabus/revisions/rev-1/publish')
      .set('Authorization', 'Bearer x')
      .set('If-Match', '3')
      .send({});
    expect(res.status).toBe(200);
    expect(repo.publish).toHaveBeenCalledWith('c1', 'rev-1', 3, 'u-fac');
    expect(res.body.revision.status).toBe('published');
  });

  it('DELETE draft returns ok and maps missing drafts to 404', async () => {
    repo.deleteDraft.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new SyllabusNotFoundError());
    const ok = await (await request())(app(repo))
      .delete('/api/courses/c1/syllabus/revisions/rev-1')
      .set('Authorization', 'Bearer x');
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    const missing = await (await request())(app(repo))
      .delete('/api/courses/c1/syllabus/revisions/rev-9')
      .set('Authorization', 'Bearer x');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('syllabus_not_found');
  });
});
