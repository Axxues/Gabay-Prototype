import '../env.js';
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ragExportRouter, setRagSyllabusRepository } from './ragExport.js';
import { ragAggregateRouter } from './ragAggregate.js';
import { setRagSyllabusRepositoryForTests } from '../syllabi/runtime.js';
import { RagSectionKeyOrder } from '../syllabi/contracts.js';
import { errorMiddleware } from '../utils/errors.js';

function exportApp() {
  const a = express();
  a.use('/api/rag-export', ragExportRouter);
  a.use(errorMiddleware);
  return a;
}

function aggregateApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/rag-aggregate', ragAggregateRouter);
  a.use(errorMiddleware);
  return a;
}

const SIXTEEN = [...RagSectionKeyOrder];

const sections16 = (tag: string) =>
  Object.fromEntries(SIXTEEN.map((key) => [key, `${key} text ${tag}.`]));

const records16 = (tag: string) =>
  SIXTEEN.map((sectionKey) => ({
    syllabusId: 'syl-1',
    revisionNo: 3,
    status: 'published' as const,
    sectionKey,
    sectionText: `${sectionKey} text ${tag}.`,
  }));

const FORBIDDEN = [
  'fileDataUrl',
  'legacyPayload',
  'PRIVATE-SIGNATORY',
  'PRIVATE-CONSULTATION',
  'PRIVATE-SCHEDULE',
  'PRIVATE-ROOM',
  'createdById',
  'publishedById',
  'password',
];

describe('Task 2: enriched RAG export (sixteen sections with published metadata)', () => {
  afterEach(() => {
    setRagSyllabusRepository(null);
    setRagSyllabusRepositoryForTests(null);
  });

  it('emits all sixteen keys with published metadata, stable ids, and strict description equality', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    setRagSyllabusRepository({
      getRagSections: async (courseId: string) => sections16(courseId),
      getRagSectionRecords: async (courseId: string) => records16(courseId),
    });
    const res = await request(exportApp()).get('/api/rag-export/courses')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(200);
    const table = res.body.tables.find((t: { collection: string }) => t.collection === 'course_syllabus');
    expect(table).toBeDefined();
    expect(table.domain).toBe('courses');
    expect(table.records.length).toBeGreaterThan(0);
    const byCourse = new Map<string, Array<Record<string, unknown>>>();
    for (const r of table.records as Array<Record<string, unknown>>) {
      const list = byCourse.get(r.courseId as string) ?? [];
      list.push(r);
      byCourse.set(r.courseId as string, list);
    }
    const firstCourseId = [...byCourse.keys()][0] as string;
    const rows = byCourse.get(firstCourseId) as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.section_key).sort()).toEqual([...SIXTEEN].sort());
    for (const r of rows) {
      // Stable composite id preserved from the old seven-key export.
      expect(r.id).toBe(`${firstCourseId}#${r.section_key}`);
      expect(r.syllabusId).toBe('syl-1');
      expect(r.revisionNo).toBe(3);
      expect(r.status).toBe('published');
      expect(typeof r.section_text).toBe('string');
      expect((r.section_text as string).length).toBeGreaterThan(0);
      expect((r.section_text as string).length).toBeLessThanOrEqual(1500);
      // Strict equality: export text is exactly the repository builder text.
      expect(r.section_text).toBe(`${r.section_key} text ${firstCourseId}.`);
    }
    const description = rows.find((r) => r.section_key === 'description');
    expect(description?.section_text).toBe(`description text ${firstCourseId}.`);
    expect(JSON.stringify(table)).not.toContain('password');
    for (const forbidden of FORBIDDEN) {
      expect(JSON.stringify(table)).not.toContain(forbidden);
    }
  });

  it('filters empty sections so courses with no published content contribute zero records', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    setRagSyllabusRepository({
      getRagSections: async (courseId: string) => ({ description: `only description ${courseId}.` }),
      getRagSectionRecords: async (courseId: string) => ([
        { syllabusId: 'syl-1', revisionNo: 3, status: 'published' as const, sectionKey: 'description' as const, sectionText: `only description ${courseId}.` },
      ]),
    });
    const res = await request(exportApp()).get('/api/rag-export/courses')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(200);
    const table = res.body.tables.find((t: { collection: string }) => t.collection === 'course_syllabus');
    for (const r of table.records) {
      expect(r.section_key).toBe('description');
      expect(r.section_text.length).toBeGreaterThan(0);
    }
  });

  it('wires the runtime.ts singleton as the default export source', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    setRagSyllabusRepository(null);
    setRagSyllabusRepositoryForTests({
      getRagSections: async (courseId: string) => ({ description: `runtime-wire ${courseId}.` }),
      getRagSectionRecords: async () => [],
    } as unknown as Parameters<typeof setRagSyllabusRepositoryForTests>[0]);
    const res = await request(exportApp()).get('/api/rag-export/courses')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(200);
    const table = res.body.tables.find((t: { collection: string }) => t.collection === 'course_syllabus');
    expect(table.records.length).toBeGreaterThan(0);
    expect(JSON.stringify(table.records)).toContain('runtime-wire');
  });
});

describe('Task 2: structured course_syllabus reads via the repository', () => {
  afterEach(() => {
    setRagSyllabusRepositoryForTests(null);
  });

  const installRuntimeMock = () => {
    setRagSyllabusRepositoryForTests({
      getRagSections: async (courseId: string) => ({
        description: `desc ${courseId}.`,
        outcomes: `outcomes ${courseId}.`,
      }),
      getRagSectionRecords: async (courseId: string) => ([
        { syllabusId: 'syl-9', revisionNo: 5, status: 'published', sectionKey: 'description', sectionText: `desc ${courseId}.` },
        { syllabusId: 'syl-9', revisionNo: 5, status: 'published', sectionKey: 'outcomes', sectionText: `outcomes ${courseId}.` },
      ]),
    } as unknown as Parameters<typeof setRagSyllabusRepositoryForTests>[0]);
  };

  it('serves rows with safe fields and pagination', async () => {
    installRuntimeMock();
    const res = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', process.env.RAG_EXPORT_KEY as string)
      .send({ table: 'course_syllabus', metric: 'rows', limit: 1 });
    expect(res.status).toBe(200);
    expect(res.body.table).toBe('course_syllabus');
    expect(res.body.value).toHaveLength(1);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextOffset).toBe(1);
    const row = res.body.value[0] as Record<string, unknown>;
    for (const key of ['courseId', 'courseCode', 'courseTitle', 'syllabusId', 'revisionNo', 'sectionKey', 'sectionText']) {
      expect(row).toHaveProperty(key);
    }
    expect(row.syllabusId).toBe('syl-9');
    expect(row.revisionNo).toBe(5);
    expect(JSON.stringify(row)).not.toContain('passwordHash');
    expect(JSON.stringify(row)).not.toContain('fileDataUrl');
  });

  it('supports count and equality filters on courseId, courseCode, and sectionKey', async () => {
    installRuntimeMock();
    const key = process.env.RAG_EXPORT_KEY as string;
    const first = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', key)
      .send({ table: 'course_syllabus', metric: 'rows', limit: 1 });
    expect(first.status).toBe(200);
    const sample = first.body.value[0] as { courseId: string; courseCode: string };
    const bySection = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', key)
      .send({ table: 'course_syllabus', metric: 'rows', filters: { sectionKey: 'description' }, limit: 500 });
    expect(bySection.status).toBe(200);
    expect(bySection.body.value.length).toBeGreaterThan(0);
    for (const r of bySection.body.value) {
      expect(r.sectionKey).toBe('description');
    }
    const byCourse = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', key)
      .send({ table: 'course_syllabus', metric: 'rows', filters: { courseId: sample.courseId }, limit: 500 });
    expect(byCourse.status).toBe(200);
    for (const r of byCourse.body.value) {
      expect(r.courseId).toBe(sample.courseId);
    }
    const byCode = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', key)
      .send({ table: 'course_syllabus', metric: 'rows', filters: { courseCode: sample.courseCode }, limit: 500 });
    expect(byCode.status).toBe(200);
    expect(byCode.body.value.length).toBeGreaterThan(0);
    const count = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', key)
      .send({ table: 'course_syllabus', metric: 'count', filters: { sectionKey: 'outcomes' } });
    expect(count.status).toBe(200);
    const byOutcomes = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', key)
      .send({ table: 'course_syllabus', metric: 'rows', filters: { sectionKey: 'outcomes' }, limit: 500 });
    expect(byOutcomes.status).toBe(200);
    expect(count.body.value).toBe(byOutcomes.body.value.length);
    expect(count.body.value).toBeGreaterThan(0);
  });

  it('returns no rows when nothing is published', async () => {
    setRagSyllabusRepositoryForTests({
      getRagSections: async () => ({}),
      getRagSectionRecords: async () => [],
    } as unknown as Parameters<typeof setRagSyllabusRepositoryForTests>[0]);
    const res = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', process.env.RAG_EXPORT_KEY as string)
      .send({ table: 'course_syllabus', metric: 'rows' });
    expect(res.status).toBe(200);
    expect(res.body.value).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('rejects recordIds for the composite-key syllabus table', async () => {
    installRuntimeMock();
    const res = await request(aggregateApp()).post('/api/rag-aggregate')
      .set('x-rag-export-key', process.env.RAG_EXPORT_KEY as string)
      .send({ table: 'course_syllabus', metric: 'rows', recordIds: ['course-1#description'] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('recordIds are unsupported for composite-key tables');
  });

  it('rejects unsafe fields and filters', async () => {
    installRuntimeMock();
    const key = process.env.RAG_EXPORT_KEY as string;
    for (const body of [
      { table: 'course_syllabus', metric: 'rows', fields: ['passwordHash'] },
      { table: 'course_syllabus', metric: 'rows', fields: ['fileDataUrl'] },
      { table: 'course_syllabus', metric: 'rows', filters: { bogus: 'x' } },
      { table: 'course_syllabus', metric: 'rows', filters: { status: 'draft' } },
      { table: 'course_syllabus', metric: 'sum', field: 'revisionNo' },
    ]) {
      const res = await request(aggregateApp()).post('/api/rag-aggregate')
        .set('x-rag-export-key', key).send(body);
      expect(res.status).toBe(400);
    }
  });
});
