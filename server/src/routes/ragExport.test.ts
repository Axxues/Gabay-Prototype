import '../env.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ragExportRouter, buildSyllabusSections, setRagSyllabusRepository } from './ragExport.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use('/api/rag-export', ragExportRouter);
  a.use(errorMiddleware);
  return a;
}

describe('ragExport', () => {
  beforeEach(() => {
    setRagSyllabusRepository({
      getRagSections: async (courseId: string) => ({
        description: `Export description ${courseId}.`,
        outcomes: `Export outcomes ${courseId}.`,
        grading: `Export grading ${courseId}.`,
        policies: `Export policies ${courseId}.`,
        outline: `Export outline ${courseId}.`,
        references: `Export references ${courseId}.`,
        faculty: `Export faculty ${courseId}.`,
      }),
    });
  });
  afterEach(() => {
    setRagSyllabusRepository(null);
  });
  it('401s without the service key', async () => {
    const res = await request(app()).get('/api/rag-export/courses');
    expect(res.status).toBe(401);
  });
  it('401s fail-closed when RAG_EXPORT_KEY is unset or empty', async () => {
    const prev = process.env.RAG_EXPORT_KEY;
    try {
      delete process.env.RAG_EXPORT_KEY;
      const resNoHeader = await request(app()).get('/api/rag-export/courses');
      expect(resNoHeader.status).toBe(401);
      const resAnyHeader = await request(app()).get('/api/rag-export/courses')
        .set('x-rag-export-key', 'anything');
      expect(resAnyHeader.status).toBe(401);
      process.env.RAG_EXPORT_KEY = '';
      const resEmptyEnv = await request(app()).get('/api/rag-export/courses');
      expect(resEmptyEnv.status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.RAG_EXPORT_KEY;
      else process.env.RAG_EXPORT_KEY = prev;
    }
  });
  it('returns courses-area tables with the key', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    const res = await request(app()).get('/api/rag-export/courses')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(200);
    const names = res.body.tables.map((t: { collection: string }) => t.collection);
    expect(names).toEqual(expect.arrayContaining(['course', 'course_section', 'enrollment_request']));
    expect(res.body.tables[0]).toHaveProperty('records');
    expect(JSON.stringify(res.body)).not.toContain('password');
  });
  it('omits email from the people user_directory export', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    const res = await request(app()).get('/api/rag-export/people')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(200);
    const table = res.body.tables.find((t: { collection: string }) => t.collection === 'user_directory');
    expect(table).toBeDefined();
    expect(table.records.length).toBeGreaterThan(0);
    for (const r of table.records) {
      expect(r).not.toHaveProperty('email');
    }
    expect(Object.keys(table.records[0]).sort()).toEqual(['department', 'id', 'name', 'role', 'title']);
    expect(JSON.stringify(table)).not.toMatch(/@/);
  });
  it('404s unknown area', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    const res = await request(app()).get('/api/rag-export/nope')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(404);
  });
  it('exposes course_syllabus sections with course keys and bounded text', async () => {
    process.env.RAG_EXPORT_KEY = 'test-key';
    const res = await request(app()).get('/api/rag-export/courses')
      .set('x-rag-export-key', 'test-key');
    expect(res.status).toBe(200);
    const table = res.body.tables.find((t: { collection: string }) => t.collection === 'course_syllabus');
    expect(table).toBeDefined();
    expect(table.domain).toBe('courses');
    for (const r of table.records) {
      expect(r.id).toBeTruthy();
      expect(r.courseId).toBeTruthy();
      expect(r.courseCode).toBeTruthy();
      expect(r.section_key).toBeTruthy();
      expect(typeof r.section_text).toBe('string');
      expect(r.section_text.length).toBeGreaterThan(0);
      expect(r.section_text.length).toBeLessThanOrEqual(1500);
    }
    expect(JSON.stringify(table)).not.toContain('password');
  });
  describe('buildSyllabusSections', () => {
    const valid = {
      id: 'c1', code: 'CMSC 131', title: 'Web Engineering',
      syllabus: JSON.stringify({
        courseInfo: { code: 'CMSC 131', title: 'Web Engineering', semester: '1st', academicYear: '2026-2027', credit: '3 units', prerequisite: 'None', description: 'Web fundamentals.' },
        courseOutcomes: [{ number: 1, statement: 'Build responsive sites.' }],
        gradingSystem: { termFormula: '60% class standing + 40% exam', finalFormula: 'Midterm 50% + Finals 50%', classStandingComponents: ['Quizzes'], passingGrade: '3.0' },
        classroomPolicies: ['Attend regularly.'],
        courseOutline: [{ timeFrame: 'Weeks 1-3', title: 'HTML', topics: ['Tags', 'Forms'] }],
        references: [{ citation: 'Doe (2020)', year: '2020' }],
        facultyMembers: [{ name: 'Faculty 1', sections: [], consultation: 'MW 2pm' }],
      }),
    };
    it('emits one bounded record per syllabus section', () => {
      const out = buildSyllabusSections(valid);
      const keys = out.map((r) => r.section_key);
      expect(keys).toEqual(expect.arrayContaining(['description', 'outcomes', 'grading', 'policies', 'outline', 'references', 'faculty']));
      for (const r of out) {
        expect(r.courseId).toBe('c1');
        expect(r.section_text.length).toBeLessThanOrEqual(1500);
      }
    });
    it('returns [] for null, malformed, or empty syllabi (never throws)', () => {
      expect(buildSyllabusSections({ id: 'c1', code: 'C', title: 'T', syllabus: null })).toEqual([]);
      expect(buildSyllabusSections({ id: 'c1', code: 'C', title: 'T', syllabus: '{oops' })).toEqual([]);
      expect(buildSyllabusSections({ id: 'c1', code: 'C', title: 'T', syllabus: '{}' })).toEqual([]);
    });
    it('never emits records longer than 1500 characters', () => {
      const overlong = {
        id: 'c1', code: 'CMSC 131', title: 'Web Engineering',
        syllabus: JSON.stringify({
          courseInfo: { description: 'y'.repeat(5000) },
          courseOutcomes: [{ number: 1, statement: 'z'.repeat(5000) }],
          gradingSystem: { termFormula: 't'.repeat(5000), finalFormula: 'f'.repeat(5000), classStandingComponents: ['c'.repeat(5000)], passingGrade: '3.0' },
          classroomPolicies: ['p'.repeat(5000)],
          courseOutline: [{ timeFrame: 'Weeks 1-3', title: 'o'.repeat(5000), topics: ['q'.repeat(5000)] }],
          references: [{ citation: 'r'.repeat(5000), year: '2020' }],
          facultyMembers: [{ name: 'n'.repeat(5000), sections: [], consultation: 'MW 2pm' }],
        }),
      };
      const out = buildSyllabusSections(overlong);
      expect(out.length).toBe(7);
      for (const r of out) {
        expect(r.section_text.length).toBeLessThanOrEqual(1500);
      }
    });
    it('leaves sections of exactly 1500 characters untouched', () => {
      const exact = {
        id: 'c1', code: 'C', title: 'T',
        syllabus: JSON.stringify({ classroomPolicies: ['p'.repeat(1480)] }),
      };
      const out = buildSyllabusSections(exact);
      expect(out).toHaveLength(1);
      expect(out[0]?.section_text.length).toBeLessThanOrEqual(1500);
      expect(out[0]?.section_text.endsWith('…')).toBe(false);
    });
  });
  describe('relational syllabus repository', () => {
    const keys = ['description', 'outcomes', 'grading', 'policies', 'outline', 'references', 'faculty'] as const;
    afterEach(() => {
      setRagSyllabusRepository(null);
    });
    it('builds records from assembled repository sections with deterministic ids', async () => {
      process.env.RAG_EXPORT_KEY = 'test-key';
      setRagSyllabusRepository({
        getRagSections: async (courseId: string) => ({
          description: `relational-description ${courseId}`,
          outcomes: `relational-outcomes ${courseId}`,
          grading: `relational-grading ${courseId}`,
          policies: `relational-policies ${courseId}`,
          outline: `relational-outline ${courseId}`,
          references: `relational-references ${courseId}`,
          faculty: `relational-faculty ${courseId}`,
        }),
      });
      const res = await request(app()).get('/api/rag-export/courses')
        .set('x-rag-export-key', 'test-key');
      expect(res.status).toBe(200);
      const table = res.body.tables.find((t: { collection: string }) => t.collection === 'course_syllabus');
      expect(table).toBeDefined();
      expect(table.records.length).toBeGreaterThan(0);
      for (const r of table.records) {
        expect(keys).toContain(r.section_key);
        expect(r.id).toBe(`${r.courseId}#${r.section_key}`);
        expect(r.section_text).toContain(`relational-${r.section_key} ${r.courseId}`);
        expect(r.section_text.length).toBeLessThanOrEqual(1500);
      }
      const seen = new Set(table.records.map((r: { section_key: string }) => r.section_key));
      expect([...seen].sort()).toEqual([...keys].sort());
    });
    it('caps overlong repository sections at 1500 characters', async () => {
      process.env.RAG_EXPORT_KEY = 'test-key';
      setRagSyllabusRepository({
        getRagSections: async () => ({
          description: 'x'.repeat(5000),
          outcomes: '',
          grading: '',
          policies: '',
          outline: '',
          references: '',
          faculty: '',
        }),
      });
      const res = await request(app()).get('/api/rag-export/courses')
        .set('x-rag-export-key', 'test-key');
      expect(res.status).toBe(200);
      const table = res.body.tables.find((t: { collection: string }) => t.collection === 'course_syllabus');
      expect(table.records.length).toBeGreaterThan(0);
      for (const r of table.records) {
        expect(r.section_key).toBe('description');
        expect(r.section_text.length).toBeLessThanOrEqual(1500);
      }
      expect(table.records[0].section_text.length).toBe(1500);
    });
    it('passes repository sections of exactly 1500 characters through uncapped', async () => {
      process.env.RAG_EXPORT_KEY = 'test-key';
      const exact = 'e'.repeat(1500);
      setRagSyllabusRepository({
        getRagSections: async () => ({
          description: exact,
          outcomes: '',
          grading: '',
          policies: '',
          outline: '',
          references: '',
          faculty: '',
        }),
      });
      const res = await request(app()).get('/api/rag-export/courses')
        .set('x-rag-export-key', 'test-key');
      expect(res.status).toBe(200);
      const table = res.body.tables.find((t: { collection: string }) => t.collection === 'course_syllabus');
      expect(table.records.length).toBeGreaterThan(0);
      for (const r of table.records) {
        expect(r.section_text).toBe(exact);
      }
    });
    it('omits courses with no published repository sections', async () => {
      process.env.RAG_EXPORT_KEY = 'test-key';
      setRagSyllabusRepository({
        getRagSections: async () => ({
          description: '',
          outcomes: '',
          grading: '',
          policies: '',
          outline: '',
          references: '',
          faculty: '',
        }),
      });
      const res = await request(app()).get('/api/rag-export/courses')
        .set('x-rag-export-key', 'test-key');
      expect(res.status).toBe(200);
      const table = res.body.tables.find((t: { collection: string }) => t.collection === 'course_syllabus');
      expect(table.records).toEqual([]);
    });
    it('isolates a per-course syllabus failure without losing other records', async () => {
      process.env.RAG_EXPORT_KEY = 'test-key';
      let calls = 0;
      setRagSyllabusRepository({
        getRagSections: async (courseId: string) => {
          calls += 1;
          if (calls === 1) throw new Error('syllabus store down');
          return {
            description: `relational-description ${courseId}`,
            outcomes: `relational-outcomes ${courseId}`,
            grading: `relational-grading ${courseId}`,
            policies: `relational-policies ${courseId}`,
            outline: `relational-outline ${courseId}`,
            references: `relational-references ${courseId}`,
            faculty: `relational-faculty ${courseId}`,
          };
        },
      });
      const errors: unknown[][] = [];
      const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        errors.push(args);
      });
      try {
        const res = await request(app()).get('/api/rag-export/courses')
          .set('x-rag-export-key', 'test-key');
        expect(res.status).toBe(200);
        const byCollection = Object.fromEntries(
          res.body.tables.map((t: { collection: string; records: unknown[] }) => [t.collection, t.records]),
        );
        const courseIds = (byCollection.course as { id: string }[]).map((c) => c.id);
        expect(courseIds.length).toBeGreaterThan(1);
        expect(byCollection.course_section).toBeDefined();
        expect(byCollection.enrollment_request).toBeDefined();
        const syllabus = byCollection.course_syllabus as { id: string; courseId: string; section_key: string; section_text: string }[];
        const byCourse = new Map<string, number>();
        for (const r of syllabus) {
          expect(r.id).toBe(`${r.courseId}#${r.section_key}`);
          expect(r.section_text.length).toBeLessThanOrEqual(1500);
          byCourse.set(r.courseId, (byCourse.get(r.courseId) ?? 0) + 1);
        }
        const missing = courseIds.filter((id) => !byCourse.has(id));
        expect(missing).toHaveLength(1);
        for (const id of courseIds) {
          if (id !== missing[0]) expect(byCourse.get(id)).toBe(7);
        }
        const logged = errors.flat().map((a) => String(a)).join(' ');
        expect(logged).toContain(missing[0] as string);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
