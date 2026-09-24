import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaSyllabusRepository, SyllabusRepositoryError } from './repository.js';
import * as validation from './validation.js';
import type { SyllabusSectionKey } from './contracts.js';

type Mock = ReturnType<typeof vi.fn>;

const createMock = () =>
  vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));

const headerRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'revision-1',
  courseId: 'course-1',
  revisionNo: 1,
  status: 'published',
  schemaVersion: '1',
  rowVersion: 2,
  createdAt: new Date('2026-09-24T08:00:00.000Z'),
  updatedAt: new Date('2026-09-24T09:00:00.000Z'),
  publishedAt: new Date('2026-09-24T10:00:00.000Z'),
  ...overrides,
});

const delegates = () => ({
  course: {
    findUnique: vi.fn(),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'course-1', ...data })),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  courseFile: { findUnique: vi.fn().mockResolvedValue(null) },
  syllabus: {
    aggregate: vi.fn().mockResolvedValue({ _max: { revisionNo: 2 } }),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: createMock(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  syllabusInstitution: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusCourseInfo: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusInstitutionalStatement: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusGradingSystem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusGradingComponent: { create: createMock() },
  syllabusSourceDocument: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusFaculty: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusRequirement: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusPolicy: {
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    create: createMock(),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  syllabusRubric: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusOutlineBlock: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusLearningPlan: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusCourseOutcome: {
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    create: createMock(),
    findMany: vi.fn().mockResolvedValue([]),
    update: createMock(),
    delete: createMock(),
  },
  syllabusCourseMap: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusCourseMapProgramOutcome: { create: createMock() },
  syllabusReference: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusSignatory: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusExtensionField: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusProgramOutcome: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusCoreValue: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusGraduateAttribute: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  programOutcome: { upsert: vi.fn() },
  coreValue: { upsert: vi.fn() },
  graduateAttribute: { upsert: vi.fn() },
  historyLog: { create: vi.fn() },
});

type TestDelegates = ReturnType<typeof delegates>;

const createHarness = () => {
  const tx = delegates();
  let id = 0;
  const client = {
    ...tx,
    $transaction: vi.fn(async (callback: (value: TestDelegates) => unknown) => callback(tx)),
  } as unknown as PrismaClient;
  const repository = new PrismaSyllabusRepository(client, (prefix) => `${prefix}-${++id}`);
  return { client, repository, tx };
};

const publishedRecord = () => ({
  ...headerRow(),
  institution: { university: 'Example University', college: 'College', formCode: 'F', revision: 'R' },
  courseInfo: {
    code: 'CS 201',
    title: 'Data Structures',
    semester: 'First',
    academicYear: '2026-2027',
    type: 'Lecture',
    credit: '3',
    lectureHours: 2,
    labHours: 3,
    prerequisite: 'CS 101',
    description: 'Study data structures.',
  },
  institutionalStatement: { philosophy: 'p', vision: 'v', mission: 'm', goal: 'g' },
  gradingSystem: { termFormula: '60% + 40%', finalFormula: '50% + 50%', passingGrade: '3.0', components: [] },
  sourceDocument: null,
  faculty: [],
  requirements: [],
  policies: [],
  rubrics: [],
  outlineBlocks: [],
  learningPlans: [],
  courseOutcomes: [],
  courseMaps: [],
  references: [],
  signatories: [],
  extensionFields: [],
  programOutcomes: [],
  coreValues: [],
  graduateAttributes: [],
});

describe('syllabus repository reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('returns the published envelope from the current pointer in one query', async () => {
    const { repository, tx } = createHarness();
    tx.course.findUnique.mockResolvedValue({ currentSyllabus: publishedRecord() });

    const envelope = await repository.getPublishedEnvelope('course-1');

    expect(tx.course.findUnique).toHaveBeenCalledTimes(1);
    expect(envelope?.revision).toMatchObject({ id: 'revision-1', courseId: 'course-1', status: 'published' });
    expect(envelope?.syllabus.courseId).toBe('course-1');
    expect(envelope?.syllabus.courseInfo.code).toBe('CS 201');
  });

  it('returns null when no published revision is pointed at', async () => {
    const { repository, tx } = createHarness();
    tx.course.findUnique.mockResolvedValue({ currentSyllabus: null });

    await expect(repository.getPublishedEnvelope('course-1')).resolves.toBeNull();
  });

  it('returns a revision envelope pairing one header with its document', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(publishedRecord());

    const envelope = await repository.getRevisionEnvelope('course-1', 'revision-1');

    expect(tx.syllabus.findFirst).toHaveBeenCalledTimes(1);
    expect(envelope?.revision.id).toBe('revision-1');
    expect(envelope?.syllabus.courseInfo.title).toBe('Data Structures');
  });

  it('returns null for an unknown revision', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(null);

    await expect(repository.getRevisionEnvelope('course-1', 'missing')).resolves.toBeNull();
  });

  it('lists revision headers ordered by revision number', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findMany.mockResolvedValue([headerRow({ revisionNo: 1 }), headerRow({ id: 'revision-2', revisionNo: 2 })]);

    const revisions = await repository.listRevisions('course-1');

    expect(tx.syllabus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { courseId: 'course-1' } }),
    );
    expect(revisions.map((row) => row.revisionNo)).toEqual([1, 2]);
  });
});

describe('syllabus repository legacy replacement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  const legacyJson = JSON.stringify({ courseInfo: { code: 'CS 201', title: 'Data Structures' } });

  it('validates every section before opening a transaction', async () => {
    const { repository, client, tx } = createHarness();
    tx.syllabus.findUnique.mockResolvedValue(headerRow({ status: 'draft', rowVersion: 1, revisionNo: 3, publishedAt: null }));
    const spy = vi.spyOn(validation, 'validateSectionPayload');

    await repository.replaceFromLegacy('course-1', 'faculty-1', legacyJson);

    const sections = spy.mock.calls.map((call) => call[0] as SyllabusSectionKey);
    expect(sections).toHaveLength(16);
    expect(new Set(sections).size).toBe(16);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });

  it('writes relational rows and the legacy column in one transaction', async () => {
    const { repository, client, tx } = createHarness();
    tx.syllabus.findUnique.mockResolvedValue(headerRow({ status: 'draft', rowVersion: 1, revisionNo: 3, publishedAt: null }));

    const created = await repository.replaceFromLegacy('course-1', 'faculty-1', legacyJson);

    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.syllabus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ courseId: 'course-1', revisionNo: 3, status: 'draft' }),
      }),
    );
    expect(tx.syllabusInstitution.create).toHaveBeenCalledTimes(1);
    expect(tx.syllabusCourseInfo.create).toHaveBeenCalledTimes(1);
    expect(tx.course.update).toHaveBeenCalledTimes(1);
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: { syllabus: legacyJson },
    });
    expect(created).toMatchObject({ courseId: 'course-1', revisionNo: 3, status: 'draft' });
  });

  it('rejects malformed legacy JSON without opening a transaction', async () => {
    const { repository, client } = createHarness();

    await expect(repository.replaceFromLegacy('course-1', 'faculty-1', '{bad')).rejects.toBeInstanceOf(
      SyllabusRepositoryError,
    );
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a non-object legacy payload without opening a transaction', async () => {
    const { repository, client } = createHarness();

    await expect(repository.replaceFromLegacy('course-1', 'faculty-1', '42')).rejects.toBeInstanceOf(
      SyllabusRepositoryError,
    );
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('propagates a child-insert failure without updating the legacy column', async () => {
    const { repository, client, tx } = createHarness();
    tx.syllabusInstitution.create.mockRejectedValue(new Error('child insert failed'));

    await expect(repository.replaceFromLegacy('course-1', 'faculty-1', legacyJson)).rejects.toThrow(
      'child insert failed',
    );
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.course.update).not.toHaveBeenCalled();
  });
});
