import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { legacyFixture } from './fixtures.js';
import { mapLegacyToWriteModel, mapWriteModelToDocument } from './mapper.js';
import { buildSyllabusRagSections } from './repository.js';

const delegates = () => ({
  course: { findUnique: vi.fn() },
  syllabus: { findFirst: vi.fn() },
});

const createHarness = async () => {
  const tx = delegates();
  const client = { ...tx } as unknown as PrismaClient;
  const { PrismaSyllabusRepository } = await import('./repository.js');
  const repository = new PrismaSyllabusRepository(client, (prefix) => `${prefix}-1`);
  return { repository, tx };
};

const publishedRelational = (model: ReturnType<typeof mapLegacyToWriteModel>) => ({
  id: 'revision-1',
  courseId: 'course-1',
  revisionNo: 3,
  status: 'published',
  schemaVersion: '1',
  rowVersion: 2,
  createdAt: new Date('2026-09-24T08:00:00.000Z'),
  updatedAt: new Date('2026-09-24T09:00:00.000Z'),
  publishedAt: new Date('2026-09-24T10:00:00.000Z'),
  createdById: 'faculty-1',
  publishedById: 'faculty-2',
  institution: { ...model.institution },
  courseInfo: { ...model.courseInfo, lectureHours: 2, labHours: 3 },
  institutionalStatement: {
    philosophy: model.institutionalStatements.philosophy,
    vision: model.institutionalStatements.vision,
    mission: model.institutionalStatements.mission,
    goal: model.institutionalStatements.goal,
  },
  gradingSystem: {
    termFormula: model.gradingSystem.termFormula,
    finalFormula: model.gradingSystem.finalFormula,
    passingGrade: model.gradingSystem.passingGrade,
    components: model.gradingSystem.classStandingComponents.map((c) => ({ text: c.text, position: c.position })),
  },
  sourceDocument: {
    fileName: 'cs201-syllabus.pdf',
    fileSize: '42 KB',
    fileType: 'pdf',
    uploadedAt: new Date('2026-09-24T08:00:00.000Z'),
    fileDataUrl: 'data:application/pdf;base64,SECRET-SOURCE-PAYLOAD',
    legacyPayload: '{"inline":"SECRET-LEGACY"}',
    courseFileId: null,
  },
  faculty: model.facultyMembers.map((f, i) => ({
    id: `faculty-${i}`,
    syllabusId: 'revision-1',
    name: f.name,
    consultation: 'PRIVATE-CONSULTATION',
    position: f.position,
    sections: f.sections.map((s, j) => ({
      id: `sec-${i}-${j}`,
      section: s.section,
      schedule: 'PRIVATE-SCHEDULE',
      room: 'PRIVATE-ROOM',
      position: s.position,
    })),
  })),
  requirements: [
    ...model.courseRequirements.major.map((r) => ({ ...r, id: `req-major-${r.position}` })),
    ...model.courseRequirements.other.map((r) => ({ ...r, id: `req-other-${r.position}` })),
  ],
  policies: model.policyRows.map((r, i) => ({ id: `policy-${i}`, syllabusId: 'revision-1', text: r.text, position: r.position })),
  rubrics: model.projectRubrics.map((r, i) => ({
    id: `rubric-${i}`,
    syllabusId: 'revision-1',
    category: r.category,
    position: r.position,
    levels: r.levelRows.map((l) => ({ level: l.level, description: l.description })),
  })),
  outlineBlocks: model.courseOutline.map((b, i) => ({
    id: `outline-${i}`,
    syllabusId: 'revision-1',
    timeFrame: b.timeFrame,
    title: b.title,
    position: b.position,
    topics: b.topics.map((t) => ({ id: `topic-${i}-${t.position}`, outlineBlockId: `outline-${i}`, text: t.text, position: t.position })),
  })),
  learningPlans: model.learningPlan.map((p, i) => ({
    id: `lp-${i}`,
    syllabusId: 'revision-1',
    week: p.week,
    hoursLab: p.hoursLab,
    hoursLec: p.hoursLec,
    position: p.position,
    outcomes: p.learningOutcomes.map((r) => ({ id: `lpout-${i}-${r.position}`, text: r.text, position: r.position })),
    topics: p.topics.map((r) => ({ id: `lptopic-${i}-${r.position}`, text: r.text, position: r.position })),
    methods: p.methodology.map((r) => ({ id: `lpmethod-${i}-${r.position}`, text: r.text, position: r.position })),
    resources: p.resources.map((r) => ({ id: `lpres-${i}-${r.position}`, text: r.text, position: r.position })),
    assessments: p.assessment.map((r) => ({ id: `lpass-${i}-${r.position}`, text: r.text, position: r.position })),
    sdg: p.sdgCoherence
      ? { goal: p.sdgCoherence.goal, title: p.sdgCoherence.title, description: p.sdgCoherence.description, target: (p.sdgCoherence as { target?: string }).target ?? null }
      : null,
  })),
  courseOutcomes: model.courseOutcomes.map((r, i) => ({ id: `co-${i}`, syllabusId: 'revision-1', number: r.number, statement: r.statement, position: r.position })),
  courseMaps: model.courseMap.map((m, i) => ({
    id: `map-${i}`,
    syllabusId: 'revision-1',
    coNumber: m.coNumber,
    coStatement: m.coStatement,
    position: m.position,
    programOutcomes: m.poAlignments.map((a) => ({
      programOutcome: { id: `po-${a.programOutcomeNumber}`, number: a.programOutcomeNumber, description: `Program outcome ${a.programOutcomeNumber}.` },
      level: a.level,
      position: a.position,
    })),
  })),
  references: model.references.map((r, i) => ({ id: `ref-${i}`, syllabusId: 'revision-1', citation: r.citation, year: r.year, doiOrPublisher: (r as { doiOrPublisher?: string }).doiOrPublisher ?? null, position: r.position })),
  signatories: [{ id: 'sig-1', syllabusId: 'revision-1', role: 'prepared', name: 'PRIVATE-SIGNATORY', title: 'PRIVATE-TITLE', position: 0 }],
  extensionFields: [{ id: 'ext-1', syllabusId: 'revision-1', path: '$.extensions.example', value: '{"enabled":true}', valueType: 'object' }],
  programOutcomes: model.programOutcomes.map((r, i) => ({
    syllabusId: 'revision-1',
    programOutcomeId: `po-${i}`,
    position: r.position,
    programOutcome: { id: `po-${i}`, number: r.number, description: r.description, catalogVersion: '1', createdAt: new Date(), updatedAt: new Date() },
  })),
  coreValues: model.institutionalStatements.coreValues.map((r, i) => ({
    syllabusId: 'revision-1',
    coreValueId: `cv-${i}`,
    position: r.position,
    coreValue: { id: `cv-${i}`, acronym: r.acronym, keyword: r.keyword, description: r.description, catalogVersion: '1', createdAt: new Date(), updatedAt: new Date() },
  })),
  graduateAttributes: model.institutionalStatements.graduateAttributes.map((r, i) => ({
    syllabusId: 'revision-1',
    graduateAttributeId: `ga-${i}`,
    position: r.position,
    graduateAttribute: { id: `ga-${i}`, number: r.number, title: r.title, description: r.description, catalogVersion: '1', createdAt: new Date(), updatedAt: new Date() },
  })),
});

describe('Task 1: expanded published syllabus RAG projection (RED)', () => {
  it('exposes exactly the sixteen public section keys with published metadata', async () => {
    const { RagSectionKeyOrder } = await import('./contracts.js');
    const { getRagSyllabusRepository } = await import('./runtime.js');
    expect(Array.isArray(RagSectionKeyOrder)).toBe(true);
    expect([...RagSectionKeyOrder].sort()).toEqual(
      [
        'institution',
        'description',
        'faculty',
        'institutional_statement',
        'program_outcomes',
        'core_values',
        'graduate_attributes',
        'requirements',
        'grading',
        'rubrics',
        'policies',
        'outline',
        'learning_plan',
        'outcomes',
        'course_map',
        'references',
      ].sort(),
    );
    expect(typeof getRagSyllabusRepository).toBe('function');

    const { repository, tx } = await createHarness();
    const model = mapLegacyToWriteModel(legacyFixture, 'revision-1', 'course-1');
    tx.course.findUnique.mockResolvedValue({
      code: 'CS 201',
      title: 'Data Structures',
      currentSyllabus: publishedRelational(model),
    });
    const sections = await repository.getRagSections('course-1');
    expect(Object.keys(sections).sort()).toEqual([...RagSectionKeyOrder].sort());

    const records = await (repository as unknown as { getRagSectionRecords(courseId: string): Promise<Array<{ syllabusId: string; revisionNo: number; status: string; sectionKey: string; sectionText: string }>> }).getRagSectionRecords('course-1');
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.syllabusId).toBe('revision-1');
      expect(record.revisionNo).toBe(3);
      expect(record.status).toBe('published');
      expect(RagSectionKeyOrder).toContain(record.sectionKey);
    }
  });

  it('keeps the old seven section texts byte-stable', async () => {
    const { repository, tx } = await createHarness();
    const model = mapLegacyToWriteModel(legacyFixture, 'revision-1', 'course-1');
    tx.course.findUnique.mockResolvedValue({
      code: 'CS 201',
      title: 'Data Structures',
      currentSyllabus: publishedRelational(model),
    });
    const sections = await repository.getRagSections('course-1');
    const document = mapWriteModelToDocument(model);
    const legacy = buildSyllabusRagSections({ code: 'CS 201', title: 'Data Structures' }, document);
    for (const key of ['outcomes', 'grading', 'policies', 'outline', 'references', 'faculty'] as const) {
      expect((sections as Record<string, string>)[key]).toBe(legacy[key]);
    }
    expect((sections as Record<string, string>).description).toContain('CS 201: Data Structures.');
    expect((sections as Record<string, string>).description).toContain(
      'Study foundational data structures and algorithms.',
    );
  });

  it('excludes drafts, private, audit, source payload, and extension content', async () => {
    const { repository, tx } = await createHarness();
    const model = mapLegacyToWriteModel(legacyFixture, 'revision-1', 'course-1');
    tx.course.findUnique.mockResolvedValue({
      code: 'CS 201',
      title: 'Data Structures',
      currentSyllabus: publishedRelational(model),
    });
    const sections = await repository.getRagSections('course-1');
    const joined = Object.values(sections).join('\n');
    for (const forbidden of [
      'SECRET-SOURCE-PAYLOAD',
      'SECRET-LEGACY',
      'PRIVATE-SIGNATORY',
      'PRIVATE-TITLE',
      'PRIVATE-CONSULTATION',
      'PRIVATE-SCHEDULE',
      'PRIVATE-ROOM',
      'faculty-1',
      'faculty-2',
    ]) {
      expect(joined).not.toContain(forbidden);
    }

    tx.course.findUnique.mockResolvedValue({
      code: 'CS 201',
      title: 'Data Structures',
      currentSyllabus: { ...publishedRelational(model), status: 'draft' },
    });
    const draftSections = await repository.getRagSections('course-1');
    expect(Object.values(draftSections).every((text) => text === '')).toBe(true);
    const draftRecords = await (repository as unknown as { getRagSectionRecords(courseId: string): Promise<unknown[]> }).getRagSectionRecords('course-1');
    expect(draftRecords).toEqual([]);
  });
});
