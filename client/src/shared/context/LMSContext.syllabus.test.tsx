// @vitest-environment jsdom
// src/context/LMSContext.syllabus.test.tsx — Task 5 revision state (TDD RED).
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';
import type { OfficialSyllabusData } from '../data/syllabusData';

const baseUser = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'faculty',
  avatar: 'A',
  department: 'CS',
  title: 'Instructor',
} as any;

const seededCourse = {
  id: 'c1',
  code: 'C1',
  title: 'T',
  section: 'S',
  term: 'T',
  instructorId: 'u1',
  instructorName: 'N',
  published: true,
  enrolledCount: 0,
};

const draftDoc = (courseId: string): OfficialSyllabusData => ({
  courseId,
  institution: { university: 'U', college: 'C', formCode: 'F', revision: 'R' },
  courseInfo: {
    code: 'C1', title: 'T', semester: 'S', academicYear: 'Y', type: 'Lec',
    credit: '3', lectureHours: '3', labHours: '0', prerequisite: '', description: 'D',
  },
  facultyMembers: [],
  institutionalStatements: {
    philosophy: 'P', vision: 'V', mission: 'M', goal: 'G', coreValues: [], graduateAttributes: [],
  },
  programOutcomes: [],
  courseOutcomes: [{ number: 1, statement: 'CO1' }],
  courseRequirements: { major: ['M1'], other: [] },
  gradingSystem: { termFormula: 'T', finalFormula: 'F', classStandingComponents: [], passingGrade: '3.0' },
  projectRubrics: [],
  classroomPolicies: ['Be kind.'],
  courseOutline: [],
  learningPlan: [],
  courseMap: [],
  references: [],
  signatories: {
    preparedBy: [{ name: 'N', title: 'T' }],
    recommendingApproval: { name: '', title: '' },
    approved: { name: '', title: '' },
  },
});

const revHeader = (over: Record<string, unknown> = {}) => ({
  id: 'rev-draft-1',
  courseId: 'c1',
  revisionNo: 3,
  status: 'draft',
  schemaVersion: '1',
  rowVersion: 1,
  createdAt: '2026-09-24T00:00:00.000Z',
  updatedAt: '2026-09-24T00:00:00.000Z',
  publishedAt: null,
  ...over,
});

const okRes = (body: unknown, status = 200) => ({ ok: true, status, json: async () => body });
const errRes = (status: number, code: string, message: string) => ({
  ok: false,
  status,
  json: async () => ({ error: { code, message } }),
});

type Route = { match: (url: string, init: any) => boolean; handle: (url: string, init: any) => any };
let routes: Route[] = [];
let fetchCalls: Array<{ url: string; init: any }> = [];

const defaultRoutes = (): Route[] => [
  // Likha-only auth (Task 2): login reads the real Likha /auth/login +
  // /users/me over stubbed fetch. Express /api/auth/login stays unmocked
  // so any fallback regression throws loudly.
  { match: (u, init) => u.endsWith('/auth/login') && init?.method === 'POST', handle: () => okRes({ data: { access_token: 't-likha-syllabus' } }) },
  { match: u => u.includes('/users/me'), handle: () => okRes({ data: { id: 'u1', first_name: 'Test', last_name: 'User', email: 'test@example.com', role: { name: 'Faculty' } } }) },
  { match: u => u === '/api/courses', handle: () => okRes({ courses: [{ ...seededCourse }] }) },
  { match: u => u === '/api/notifications?limit=200', handle: () => okRes({ notifications: [] }) },
  { match: u => u === '/api/messages', handle: () => okRes({ messages: [] }) },
  { match: u => u === '/api/calendar', handle: () => okRes({ events: [] }) },
  { match: u => u === '/api/users', handle: () => okRes({ users: [{ ...baseUser }] }) },
  { match: u => u === '/api/groups', handle: () => okRes({ groups: [] }) },
  { match: u => u === '/api/advising', handle: () => okRes({ slots: [] }) },
  { match: u => u.endsWith('/sections'), handle: () => okRes({ sections: [] }) },
  { match: u => u.includes('/requests?status='), handle: () => okRes({ requests: [] }) },
  { match: u => u === '/api/requests/mine', handle: () => okRes({ requests: [] }) },
  { match: u => u.endsWith('/modules'), handle: () => okRes({ modules: [] }) },
  { match: u => u.endsWith('/announcements'), handle: () => okRes({ announcements: [] }) },
  { match: u => u.endsWith('/discussions'), handle: () => okRes({ discussions: [] }) },
  { match: u => u.startsWith('/api/quizzes?'), handle: () => okRes({ quizzes: [] }) },
  { match: u => u.startsWith('/api/exams?'), handle: () => okRes({ exams: [] }) },
  { match: u => u.startsWith('/api/activities?'), handle: () => okRes({ activities: [] }) },
  { match: u => u.endsWith('/grades'), handle: () => okRes({ grades: [] }) },
  { match: u => u.endsWith('/spr'), handle: () => okRes({ config: null }) },
  { match: u => u.endsWith('/folders'), handle: () => okRes({ folders: [] }) },
  { match: u => u.endsWith('/files'), handle: () => okRes({ files: [] }) },
];

beforeEach(() => {
  vi.unstubAllGlobals();
  routes = defaultRoutes();
  fetchCalls = [];
  try {
    localStorage.clear();
  } catch {}
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: any = {}) => {
      fetchCalls.push({ url, init });
      for (const r of routes) {
        if (r.match(url, init)) return r.handle(url, init);
      }
      throw new Error(`unmocked fetch: ${init?.method || 'GET'} ${url}`);
    }),
  );
});

const prependRoutes = (...extra: Route[]) => {
  routes = [...extra, ...routes];
};

/** In-memory syllabus fake: draft creation, section PATCH with If-Match, publish. */
const syllabusFake = (fullDoc: OfficialSyllabusData) => {
  let rowVersion = 1;
  let nextPatchFailure: { status: number; code: string; message: string } | undefined;
  let patchCount = 0;
  let patchFailureAt: { call: number; failure: { status: number; code: string; message: string } } | undefined;
  let publishedAbsent = false;
  const createdDraftIds: string[] = [];
  const publishedDoc: OfficialSyllabusData = { ...fullDoc, courseInfo: { ...fullDoc.courseInfo, title: 'Published T' } };
  const draftEnvelope = () => ({ revision: revHeader({ rowVersion }), syllabus: fullDoc });
  return {
    publishedDoc,
    createdDraftIds,
    failNextSectionPatch(f: { status: number; code: string; message: string }) {
      nextPatchFailure = f;
    },
    failSectionPatchOnCall(call: number, failure: { status: number; code: string; message: string }) {
      patchFailureAt = { call, failure };
    },
    setPublishedAbsent() {
      publishedAbsent = true;
    },
    routes: (): Route[] => [
      {
        match: (u, init) => u === '/api/courses/c1/syllabus/revisions' && init?.method === 'POST',
        handle: () => {
          createdDraftIds.push('rev-draft-1');
          return okRes(draftEnvelope(), 201);
        },
      },
      {
        match: (u, init) => u.includes('/syllabus/revisions/') && u.includes('/sections/') && init?.method === 'PATCH',
        handle: (_u, init) => {
          patchCount += 1;
          if (patchFailureAt && patchCount === patchFailureAt.call) {
            const f = patchFailureAt.failure;
            patchFailureAt = undefined;
            return errRes(f.status, f.code, f.message);
          }
          if (nextPatchFailure) {
            const f = nextPatchFailure;
            nextPatchFailure = undefined;
            return errRes(f.status, f.code, f.message);
          }
          const sent = init?.headers?.['If-Match'];
          if (sent !== String(rowVersion)) {
            return errRes(409, 'revision_conflict', 'The syllabus revision changed.');
          }
          rowVersion += 1;
          return okRes({ revision: revHeader({ rowVersion }), syllabus: fullDoc });
        },
      },
      {
        match: (u, init) => u === '/api/courses/c1/syllabus/revisions/rev-draft-1/publish' && init?.method === 'POST',
        handle: (_u, init) => {
          if (init?.headers?.['If-Match'] !== String(rowVersion)) {
            return errRes(409, 'revision_conflict', 'The syllabus revision changed.');
          }
          rowVersion += 1;
          return okRes({
            revision: revHeader({ status: 'published', rowVersion, publishedAt: '2026-09-24T01:00:00.000Z' }),
            syllabus: publishedDoc,
          });
        },
      },
      {
        match: (u, init) =>
          u === '/api/courses/c1/syllabus/revisions/rev-draft-1' && init?.method === 'DELETE',
        handle: () => okRes({ ok: true }),
      },
      {
        match: (u, init) => u === '/api/courses/c1/syllabus' && init?.method === 'DELETE',
        handle: () => okRes({ ok: true }),
      },
      {
        match: u => u === '/api/courses/c1/syllabus' && !u.includes('revisions'),
        handle: () =>
          publishedAbsent
            ? errRes(404, 'syllabus_not_found', 'No published syllabus.')
            : okRes({ revision: revHeader({ id: 'rev-pub-1', status: 'published', rowVersion: 9 }), syllabus: publishedDoc }),
      },
    ],
  };
};

import { LMSProvider, useLMS } from './LMSContext';

let snap: { courses: any[]; revisions: any; lastError: string | null } = { courses: [], revisions: {}, lastError: null };
const api: any = {};

const Probe: React.FC = () => {
  const ctx = useLMS() as any;
  snap = { courses: ctx.db.courses, revisions: ctx.syllabusRevisions, lastError: ctx.lastError };
  api.login = (...a: any[]) => ctx.login(...a);
  api.updateCourseSyllabus = (...a: any[]) => ctx.updateCourseSyllabus(...a);
  api.removeCourseSyllabus = (...a: any[]) => ctx.removeCourseSyllabus(...a);
  api.refreshPublishedSyllabus = (...a: any[]) => ctx.refreshPublishedSyllabus(...a);
  api.updateSyllabusSection = (...a: any[]) => ctx.updateSyllabusSection(...a);
  api.publishSyllabusDraft = (...a: any[]) => ctx.publishSyllabusDraft(...a);
  return null;
};

const renderProvider = () => {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>,
  );
};

const login = async () => {
  await act(async () => {
    await api.login('test@example.com', 'pw');
  });
};

const courseOf = () => snap.courses.find(c => c.id === 'c1');

describe('syllabus revision state', () => {
  test('updateCourseSyllabus replaces the draft and stores revision metadata', async () => {
    const doc = draftDoc('c1');
    prependRoutes(...syllabusFake(doc).routes());
    renderProvider();
    await login();

    await act(async () => {
      await api.updateCourseSyllabus('c1', doc);
    });

    const patched = fetchCalls.filter(c => c.url.includes('/sections/'));
    expect(patched.length).toBeGreaterThan(0);
    expect(patched.every(c => c.init.method === 'PATCH')).toBe(true);
    const sections = patched.map(c => c.url.split('/sections/')[1]);
    expect(sections).toContain('courseInfo');
    expect(sections).toContain('courseOutcomes');
    const creates = fetchCalls.filter(
      c => c.url === '/api/courses/c1/syllabus/revisions' && c.init?.method === 'POST',
    );
    expect(creates).toHaveLength(1);
    expect(JSON.parse(creates[0]!.init.body)).toEqual({ sourceRevisionId: 'rev-pub-1' });
    await waitFor(() => {
      expect(courseOf()?.syllabus).toEqual({ ...doc, courseId: 'c1' });
      expect(snap.revisions['c1']).toMatchObject({ id: 'rev-draft-1', status: 'draft' });
      expect(typeof snap.revisions['c1'].rowVersion).toBe('number');
    });
  });

  test('refreshPublishedSyllabus replaces course state with the published envelope', async () => {
    const doc = draftDoc('c1');
    const fake = syllabusFake(doc);
    prependRoutes(...fake.routes());
    renderProvider();
    await login();

    await act(async () => {
      await api.refreshPublishedSyllabus('c1');
    });

    await waitFor(() => {
      expect(courseOf()?.syllabus).toEqual(fake.publishedDoc);
      expect(snap.revisions['c1']).toMatchObject({ id: 'rev-pub-1', status: 'published' });
    });
  });

  test('mid-chain conflicts delete the partial draft before recovering published state', async () => {
    const doc = draftDoc('c1');
    const fake = syllabusFake(doc);
    prependRoutes(...fake.routes());
    renderProvider();
    await login();
    fake.failSectionPatchOnCall(2, { status: 409, code: 'revision_conflict', message: 'The syllabus revision changed.' });

    const result = await act(async () => api.updateCourseSyllabus('c1', doc).catch((e: unknown) => e));
    expect((result as Error)?.message).toMatch(/changed|conflict/i);

    const deletes = fetchCalls.filter(c => c.init?.method === 'DELETE');
    expect(fake.createdDraftIds.length).toBeGreaterThan(0);
    for (const id of fake.createdDraftIds) {
      expect(deletes.map(d => d.url)).toContain(`/api/courses/c1/syllabus/revisions/${id}`);
    }
    await waitFor(() => {
      expect(courseOf()?.syllabus).toEqual(fake.publishedDoc);
      expect(snap.revisions['c1']).toMatchObject({ id: 'rev-pub-1', status: 'published' });
      expect(snap.lastError).toMatch(/changed|conflict/i);
    });
  });

  test('stale row versions recover from the published envelope and report the conflict', async () => {
    const doc = draftDoc('c1');
    const fake = syllabusFake(doc);
    prependRoutes(...fake.routes());
    renderProvider();
    await login();
    await act(async () => {
      await api.updateCourseSyllabus('c1', doc);
    });
    fake.failNextSectionPatch({ status: 409, code: 'revision_conflict', message: 'The syllabus revision changed.' });

    const result = await act(async () => api.updateSyllabusSection('c1', 'courseInfo', doc.courseInfo).catch((e: unknown) => e));
    expect((result as Error)?.message).toMatch(/changed|conflict/i);

    await waitFor(() => {
      expect(courseOf()?.syllabus).toEqual(fake.publishedDoc);
      expect(snap.lastError).toMatch(/changed|conflict/i);
    });
  });

  test('removeCourseSyllabus withdraws the whole syllabus and clears local state', async () => {
    const doc = draftDoc('c1');
    const fake = syllabusFake(doc);
    prependRoutes(...fake.routes());
    renderProvider();
    await login();
    await act(async () => {
      await api.updateCourseSyllabus('c1', doc);
    });

    await act(async () => {
      await api.removeCourseSyllabus('c1');
    });

    const deletes = fetchCalls.filter(c => c.init?.method === 'DELETE');
    expect(deletes.map(d => d.url)).toContain('/api/courses/c1/syllabus');
    await waitFor(() => {
      expect(courseOf()?.syllabus).toBeNull();
      expect(snap.revisions['c1']).toBeUndefined();
    });
  });

  test('removeCourseSyllabus with published-only state withdraws and clears the local cache', async () => {
    const doc = draftDoc('c1');
    const fake = syllabusFake(doc);
    prependRoutes(...fake.routes());
    renderProvider();
    await login();
    await act(async () => {
      await api.refreshPublishedSyllabus('c1');
    });
    expect(courseOf()?.syllabus).toEqual(fake.publishedDoc);

    await act(async () => {
      await api.removeCourseSyllabus('c1');
    });

    const deletes = fetchCalls.filter(c => c.init?.method === 'DELETE');
    expect(deletes.map(d => d.url)).toContain('/api/courses/c1/syllabus');
    await waitFor(() => {
      expect(courseOf()?.syllabus).toBeNull();
      expect(snap.revisions['c1']).toBeUndefined();
    });
  });

  test('removeCourseSyllabus clears local state when no published revision exists', async () => {
    const doc = draftDoc('c1');
    const fake = syllabusFake(doc);
    fake.setPublishedAbsent();
    prependRoutes(...fake.routes());
    renderProvider();
    await login();
    await act(async () => {
      await api.updateCourseSyllabus('c1', doc);
    });

    await act(async () => {
      await api.removeCourseSyllabus('c1');
    });

    const deletes = fetchCalls.filter(c => c.init?.method === 'DELETE');
    expect(deletes.map(d => d.url)).toContain('/api/courses/c1/syllabus');
    await waitFor(() => {
      expect(courseOf()?.syllabus).toBeNull();
      expect(snap.revisions['c1']).toBeUndefined();
    });
  });

  test('publishSyllabusDraft stores the published envelope with the row version', async () => {
    const doc = draftDoc('c1');
    const fake = syllabusFake(doc);
    prependRoutes(...fake.routes());
    renderProvider();
    await login();
    await act(async () => {
      await api.updateCourseSyllabus('c1', doc);
    });
    const draftRowVersion = snap.revisions['c1'].rowVersion;

    await act(async () => {
      await api.publishSyllabusDraft('c1');
    });

    const publishCalls = fetchCalls.filter(c => c.url.endsWith('/publish'));
    expect(publishCalls).toHaveLength(1);
    expect(publishCalls[0]!.init.headers['If-Match']).toBe(String(draftRowVersion));
    await waitFor(() => {
      expect(courseOf()?.syllabus).toEqual(fake.publishedDoc);
      expect(snap.revisions['c1']).toMatchObject({ status: 'published' });
    });
  });
});
