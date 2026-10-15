// src/api/syllabus.test.ts — Task 10: Syllabus revision protocol via Likha ERP direct (TDD RED).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiError } from './client';
import { likhaLmsApi } from './likhaLmsApi';
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
  rowVersion: 2,
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
  publishedAt: null,
  ...over,
});

const sampleDoc = {
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
};

const envelope = (over: Partial<SyllabusRevisionResponse> = {}): SyllabusRevisionResponse => ({
  revision: header(over.revision ?? {}),
  syllabus: {
    ...sampleDoc,
    ...(over.syllabus ?? {}),
  },
  ...over,
});

const okRes = (body: unknown, status = 200) => ({
  ok: true,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const errRes = (status: number, code: string, message: string) => {
  const payload = { error: { code, message }, errors: [{ message, extensions: { code } }] };
  return {
    ok: false,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
};

let calls: Array<{ url: string; init: any }>;

beforeEach(() => {
  calls = [];
  likhaLmsApi.invalidateCache();
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
    if (url.includes('/api/courses/')) {
      throw new Error(`unmocked-express-syllabus: ${url}`);
    }
    calls.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fn);
};

describe('syllabusApi.getPublished (Likha Direct)', () => {
  it('queries Likha syllabi collection for published status and returns envelope', async () => {
    const row = {
      id: 'syl-1',
      course_id: 'c1',
      version: 2,
      status: 'published',
      published_at: '2026-09-24T00:00:00.000Z',
      created_at: '2026-09-24T00:00:00.000Z',
      content: JSON.stringify(sampleDoc),
    };
    stubFetch(() => okRes({ data: [row] }));
    const result = await syllabusApi.getPublished('c1');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]!.url).toContain('/items/syllabi');
    expect(calls[0]!.url).toContain('filter[course_id][_eq]=c1');
    expect(calls[0]!.url).toContain('filter[status][_eq]=published');
    expect(result?.revision.id).toBe('syl-1');
    expect(result?.revision.status).toBe('published');
    expect(result?.revision.revisionNo).toBe(2);
    expect(result?.syllabus.courseInfo.code).toBe('C1');
  });

  it('returns null when no published syllabus exists in Likha', async () => {
    stubFetch(() => okRes({ data: [] }));
    await expect(getPublished('c1')).resolves.toBeNull();
  });

  it('rethrows typed errors for failures', async () => {
    stubFetch(() => errRes(403, 'forbidden', 'Denied.'));
    const err = await getPublished('c1').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('forbidden');
  });
});

describe('syllabusApi.listRevisions (Likha Direct)', () => {
  it('returns the revision headers from Likha syllabi items', async () => {
    const rows = [
      { id: 'syl-2', course_id: 'c1', version: 2, status: 'published', created_at: '2026-09-24', published_at: '2026-09-24' },
      { id: 'syl-1', course_id: 'c1', version: 1, status: 'archived', created_at: '2026-09-20', published_at: '2026-09-20' },
    ];
    stubFetch(() => okRes({ data: rows }));
    const result = await listRevisions('c1');
    expect(calls[0]!.url).toContain('/items/syllabi');
    expect(calls[0]!.url).toContain('filter[course_id][_eq]=c1');
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('syl-2');
    expect(result[0]!.revisionNo).toBe(2);
  });
});

describe('syllabusApi.createDraft (Likha Direct)', () => {
  it('creates draft row in Likha syllabi with incremented version', async () => {
    const existing = [{ id: 'syl-1', course_id: 'c1', version: 2, status: 'published', content: JSON.stringify(sampleDoc) }];
    stubFetch((url, init) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        return okRes({ data: { ...body } }, 201);
      }
      return okRes({ data: existing });
    });
    const result = await createDraft('c1');
    const postCall = calls.find(c => c.init?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(postCall!.url).toContain('/items/syllabi');
    const posted = JSON.parse(postCall!.init.body);
    expect(posted.course_id).toBe('c1');
    expect(posted.status).toBe('draft');
    expect(posted.version).toBe(3);
    expect(result.revision.status).toBe('draft');
    expect(result.revision.revisionNo).toBe(3);
  });
});

describe('syllabusApi.updateSection (Likha Direct)', () => {
  it('patches the section in the Likha syllabi row when rowVersion matches', async () => {
    const current = {
      id: 'syl-draft-1',
      course_id: 'c1',
      version: 2,
      status: 'draft',
      content: JSON.stringify(sampleDoc),
    };
    stubFetch((url, init) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(init.body);
        return okRes({ data: { ...current, ...body } });
      }
      return okRes({ data: current });
    });
    const value = { ...sampleDoc.courseInfo, title: 'Updated Title' };
    const result = await updateSection('c1', 'syl-draft-1', 2, 'courseInfo', value);
    const patchCall = calls.find(c => c.init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall!.url).toContain('/items/syllabi/syl-draft-1');
    expect(result.syllabus.courseInfo.title).toBe('Updated Title');
  });

  it('throws revision_conflict (409) if rowVersion mismatches', async () => {
    const current = {
      id: 'syl-draft-1',
      course_id: 'c1',
      version: 5, // mismatched from expected 2
      status: 'draft',
      content: JSON.stringify(sampleDoc),
    };
    stubFetch(() => okRes({ data: current }));
    const err = await updateSection('c1', 'syl-draft-1', 2, 'policies', []).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).code).toBe('revision_conflict');
  });
});

describe('syllabusApi.publish (Likha Direct)', () => {
  it('updates draft to published in Likha syllabi', async () => {
    const current = {
      id: 'syl-draft-1',
      course_id: 'c1',
      version: 2,
      status: 'draft',
      content: JSON.stringify(sampleDoc),
    };
    stubFetch((url, init) => {
      if (init?.method === 'PATCH') {
        const body = JSON.parse(init.body);
        return okRes({ data: { ...current, ...body } });
      }
      return okRes({ data: current });
    });
    const result = await publish('c1', 'syl-draft-1', 2);
    const patchCall = calls.find(c => c.init?.method === 'PATCH');
    expect(patchCall).toBeDefined();
    const body = JSON.parse(patchCall!.init.body);
    expect(body.status).toBe('published');
    expect(result.revision.status).toBe('published');
  });
});

describe('deleteDraft (Likha Direct)', () => {
  it('deletes draft row from Likha syllabi', async () => {
    stubFetch(() => okRes({ ok: true }));
    await deleteDraft('c1', 'syl-draft-1');
    expect(calls[0]!.url).toContain('/items/syllabi/syl-draft-1');
    expect(calls[0]!.init.method).toBe('DELETE');
  });
});

describe('withdrawSyllabus (Likha Direct)', () => {
  it('deletes published syllabi for course from Likha', async () => {
    const publishedRows = [{ id: 'syl-pub-1', course_id: 'c1', status: 'published' }];
    stubFetch((url, init) => {
      if (init?.method === 'DELETE') return okRes({ ok: true });
      return okRes({ data: publishedRows });
    });
    await withdrawSyllabus('c1');
    const deleteCall = calls.find(c => c.init?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(deleteCall!.url).toContain('/items/syllabi/syl-pub-1');
  });
});
