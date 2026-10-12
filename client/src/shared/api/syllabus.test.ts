// src/api/syllabus.test.ts — Task 5 client API contracts (TDD RED).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError } from './client';
import {
  syllabusApi,
  getPublished,
  listRevisions,
  createDraft,
  updateSection,
  publish,
  deleteDraft,
  withdrawSyllabus,
} from './syllabus';
import type {
  SyllabusRevisionResponse,
  SyllabusRevisionHeader,
} from '../types/syllabusApi';

const header = (over: Partial<SyllabusRevisionHeader> = {}): SyllabusRevisionHeader => ({
  id: 'rev-1',
  courseId: 'c1',
  revisionNo: 2,
  status: 'draft',
  schemaVersion: '1',
  rowVersion: 3,
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
  publishedAt: null,
  ...over,
});

const envelope = (over: Partial<SyllabusRevisionResponse> = {}): SyllabusRevisionResponse => ({
  revision: header(over.revision ?? {}),
  syllabus: {
    institution: { university: 'U', college: 'C', formCode: 'F', revision: 'R' },
    courseInfo: {
      code: 'C1', title: 'T', semester: 'S', academicYear: 'Y', type: 'Lec',
      credit: '3', lectureHours: '3', labHours: '0', prerequisite: '', description: 'D',
    },
    facultyMembers: [],
    institutionalStatements: {
      philosophy: '', vision: '', mission: '', goal: '', coreValues: [], graduateAttributes: [],
    },
    programOutcomes: [],
    courseOutcomes: [],
    courseRequirements: { major: [], other: [] },
    gradingSystem: { termFormula: '', finalFormula: '', classStandingComponents: [], passingGrade: '' },
    projectRubrics: [],
    classroomPolicies: [],
    courseOutline: [],
    learningPlan: [],
    courseMap: [],
    references: [],
    signatories: {
      preparedBy: [],
      recommendingApproval: { name: '', title: '' },
      approved: { name: '', title: '' },
    },
  },
  ...over,
});

const okRes = (body: unknown, status = 200) => ({ ok: true, status, json: async () => body });
const errRes = (status: number, code: string, message: string) => ({
  ok: false,
  status,
  json: async () => ({ error: { code, message } }),
});

let calls: Array<{ url: string; init: any }>;

beforeEach(() => {
  calls = [];
  vi.unstubAllGlobals();
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  });
});

const stubFetch = (handler: (url: string, init: any) => unknown) => {
  const fn = vi.fn(async (url: string, init?: any) => {
    calls.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fn);
};

describe('syllabusApi.getPublished', () => {
  it('encodes the course id and returns the envelope', async () => {
    const body = envelope();
    stubFetch(() => okRes(body));
    const result = await syllabusApi.getPublished('c 1/2');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('/api/courses/c%201%2F2/syllabus');
    expect(result).toEqual(body);
  });

  it('returns null on 404 syllabus_not_found', async () => {
    stubFetch(() => errRes(404, 'syllabus_not_found', 'No published syllabus.'));
    await expect(getPublished('c1')).resolves.toBeNull();
  });

  it('rethrows typed errors for non-404 failures', async () => {
    stubFetch(() => errRes(403, 'forbidden', 'Denied.'));
    const err = await getPublished('c1').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('forbidden');
  });
});

describe('syllabusApi.listRevisions', () => {
  it('returns the revision headers for the encoded course', async () => {
    const revisions = [header({ id: 'r1' }), header({ id: 'r2', status: 'published' })];
    stubFetch(() => okRes({ revisions }));
    const result = await listRevisions('c 1');
    expect(calls[0]!.url).toBe('/api/courses/c%201/syllabus/revisions');
    expect(result).toEqual(revisions);
  });
});

describe('syllabusApi.createDraft', () => {
  it('posts the source revision id when provided', async () => {
    const body = envelope();
    stubFetch(() => okRes(body, 201));
    const result = await createDraft('c1', 'rev-9');
    expect(calls[0]!.url).toBe('/api/courses/c1/syllabus/revisions');
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(calls[0]!.init.body)).toEqual({ sourceRevisionId: 'rev-9' });
    expect(result).toEqual(body);
  });

  it('omits sourceRevisionId when creating a blank draft', async () => {
    stubFetch(() => okRes(envelope(), 201));
    await syllabusApi.createDraft('c1');
    const parsed = JSON.parse(calls[0]!.init.body);
    expect('sourceRevisionId' in parsed).toBe(false);
  });
});

describe('syllabusApi.updateSection', () => {
  it('patches the named section with the If-Match row version', async () => {
    const body = envelope();
    stubFetch(() => okRes(body));
    const value = { code: 'C1' };
    const result = await updateSection('c 1', 'rev/2', 4, 'courseInfo', value);
    expect(calls[0]!.url).toBe('/api/courses/c%201/syllabus/revisions/rev%2F2/sections/courseInfo');
    expect(calls[0]!.init.method).toBe('PATCH');
    expect(calls[0]!.init.headers['If-Match']).toBe('4');
    expect(JSON.parse(calls[0]!.init.body)).toEqual({ value });
    expect(result).toEqual(body);
  });

  it('passes section names through verbatim', async () => {
    stubFetch(() => okRes(envelope()));
    await syllabusApi.updateSection('c1', 'rev-1', 1, 'institutionalStatements', { vision: 'V' });
    expect(calls[0]!.url.endsWith('/sections/institutionalStatements')).toBe(true);
  });

  it('maps a 409 to a typed revision_conflict error', async () => {
    stubFetch(() => errRes(409, 'revision_conflict', 'Stale.'));
    const err = await updateSection('c1', 'rev-1', 1, 'policies', []).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).code).toBe('revision_conflict');
  });
});

describe('syllabusApi.publish', () => {
  it('posts to the publish endpoint with the If-Match row version', async () => {
    const body = envelope({ revision: header({ status: 'published', rowVersion: 5 }) });
    stubFetch(() => okRes(body));
    const result = await publish('c1', 'rev-1', 4);
    expect(calls[0]!.url).toBe('/api/courses/c1/syllabus/revisions/rev-1/publish');
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.headers['If-Match']).toBe('4');
    expect(result).toEqual(body);
  });
});

describe('deleteDraft', () => {
  it('deletes the encoded draft revision', async () => {
    stubFetch(() => okRes({ ok: true }));
    await deleteDraft('c 1', 'rev/2');
    expect(calls[0]!.url).toBe('/api/courses/c%201/syllabus/revisions/rev%2F2');
    expect(calls[0]!.init.method).toBe('DELETE');
  });
});

describe('withdrawSyllabus', () => {
  it('deletes the whole syllabus for the encoded course', async () => {
    stubFetch(() => okRes({ ok: true }));
    await withdrawSyllabus('c 1');
    expect(calls[0]!.url).toBe('/api/courses/c%201/syllabus');
    expect(calls[0]!.init.method).toBe('DELETE');
  });
});
