import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyFixture } from './fixtures.js';
import { mapLegacyToWriteModel, mapWriteModelToDocument } from './mapper.js';
import {
  PrismaSyllabusRepository,
  buildSyllabusRagSections,
  recordSyllabusMigrationAudit,
  SyllabusConflictError,
  SyllabusSourceFileError,
} from './repository.js';

type Mock = ReturnType<typeof vi.fn>;

type RelationalRevision = {
  id: string;
  courseId: string;
  parentSyllabusId: string | null;
  revisionNo: number;
  status: string;
  schemaVersion: string;
  rowVersion: number;
  createdById: string;
  publishedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  institution: Record<string, unknown> | null;
  courseInfo: Record<string, unknown> | null;
  institutionalStatement: Record<string, unknown> | null;
  gradingSystem: (Record<string, unknown> & { components: Record<string, unknown>[] }) | null;
  sourceDocument: Record<string, unknown> | null;
  faculty: Record<string, unknown>[];
  requirements: Record<string, unknown>[];
  policies: Record<string, unknown>[];
  rubrics: Record<string, unknown>[];
  outlineBlocks: Record<string, unknown>[];
  learningPlans: Record<string, unknown>[];
  courseOutcomes: Record<string, unknown>[];
  courseMaps: Record<string, unknown>[];
  references: Record<string, unknown>[];
  signatories: Record<string, unknown>[];
  extensionFields: Record<string, unknown>[];
  programOutcomes: Record<string, unknown>[];
  coreValues: Record<string, unknown>[];
  graduateAttributes: Record<string, unknown>[];
};

const header = (overrides: Partial<RelationalRevision> = {}): RelationalRevision => ({
  id: 'revision-1',
  courseId: 'course-1',
  parentSyllabusId: null,
  revisionNo: 1,
  status: 'draft',
  schemaVersion: '1',
  rowVersion: 3,
  createdById: 'faculty-1',
  publishedById: null,
  createdAt: new Date('2026-09-24T08:00:00.000Z'),
  updatedAt: new Date('2026-09-24T09:00:00.000Z'),
  publishedAt: null,
  institution: {
    university: 'Example University',
    college: 'College of Computing',
    formCode: 'INS-F003',
    revision: 'REV. 03',
  },
  courseInfo: {
    code: 'CS 201',
    title: 'Data Structures',
    semester: 'First Semester',
    academicYear: '2026-2027',
    type: 'Lecture and Laboratory',
    credit: '3 units',
    lectureHours: 2,
    labHours: 3,
    prerequisite: 'CS 101',
    description: 'Study foundational data structures and algorithms.',
  },
  institutionalStatement: {
    philosophy: 'Education for service.',
    vision: 'A trusted learning community.',
    mission: 'Teach responsible computing.',
    goal: 'Produce capable and ethical graduates.',
  },
  gradingSystem: {
    termFormula: '60% class standing + 40% examination',
    finalFormula: '50% midterm + 50% final',
    passingGrade: '3.0',
    components: [
      { text: 'Quizzes', position: 0 },
      { text: 'Laboratory work', position: 1 },
    ],
  },
  sourceDocument: null,
  faculty: [],
  requirements: [],
  policies: [
    { id: 'policy-1', syllabusId: 'revision-1', text: 'Attend every class.', position: 0 },
  ],
  rubrics: [],
  outlineBlocks: [
    {
      id: 'outline-1',
      syllabusId: 'revision-1',
      timeFrame: 'Prelim',
      title: 'Foundations',
      position: 0,
      topics: [
        { id: 'topic-1', outlineBlockId: 'outline-1', text: 'Arrays', position: 0 },
        { id: 'topic-2', outlineBlockId: 'outline-1', text: 'Complexity', position: 1 },
      ],
    },
    {
      id: 'outline-2',
      syllabusId: 'revision-1',
      timeFrame: 'Finals',
      title: 'Capstone',
      position: 1,
      topics: [],
    },
  ],
  learningPlans: [],
  courseOutcomes: [
    {
      id: 'co-1',
      syllabusId: 'revision-1',
      number: 1,
      statement: 'Explain abstract data types.',
      position: 0,
    },
  ],
  courseMaps: [],
  references: [],
  signatories: [],
  extensionFields: [],
  programOutcomes: [
    {
      syllabusId: 'revision-1',
      programOutcomeId: 'po-1',
      position: 0,
      programOutcome: {
        id: 'po-1',
        number: 1,
        description: 'Apply computing knowledge to solve problems.',
        catalogVersion: '1',
        createdAt: new Date('2026-09-24T08:00:00.000Z'),
        updatedAt: new Date('2026-09-24T08:00:00.000Z'),
      },
    },
  ],
  coreValues: [],
  graduateAttributes: [],
  ...overrides,
});

const createMock = () =>
  vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));

const delegates = () => ({
  $queryRaw: vi.fn().mockResolvedValue([{ id: 'revision-1' }]),
  course: {
    findUnique: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  courseFile: {
    findUnique: vi.fn(),
  },
  syllabus: {
    aggregate: vi.fn().mockResolvedValue({ _max: { revisionNo: 4 } }),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
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
    createMany: vi.fn().mockResolvedValue({ count: 2 }),
  },
  syllabusRubric: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusOutlineBlock: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusLearningPlan: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }), create: createMock() },
  syllabusLearningPlanOutcome: { create: createMock() },
  syllabusLearningPlanTopic: { create: createMock() },
  syllabusLearningPlanMethod: { create: createMock() },
  syllabusLearningPlanResource: { create: createMock() },
  syllabusLearningPlanAssessment: { create: createMock() },
  syllabusLearningPlanSdg: { create: createMock() },
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
  syllabusMigrationAudit: { upsert: vi.fn() },
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

describe('PrismaSyllabusRepository', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-25T11:00:00.000Z'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a draft by copying ordered owned children in one transaction', async () => {
    const { client, repository, tx } = createHarness();
    const source = header({ status: 'published', publishedAt: new Date('2026-09-24T08:30:00.000Z') });
    tx.syllabus.findFirst.mockResolvedValue(source);
    tx.syllabus.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      createdAt: new Date('2026-09-25T08:00:00.000Z'),
      updatedAt: new Date('2026-09-25T08:00:00.000Z'),
    }));
    tx.programOutcome.upsert.mockResolvedValue({ id: 'po-1' });

    const created = await repository.createDraft('course-1', 'faculty-2', 'revision-1');

    expect(created).toMatchObject({
      courseId: 'course-1',
      revisionNo: 5,
      status: 'draft',
      rowVersion: 1,
    });
    expect(tx.syllabus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentSyllabusId: 'revision-1' }),
      }),
    );
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    const outlineCreates = tx.syllabusOutlineBlock.create.mock.calls.map((call) => call[0].data as {
      timeFrame: string;
      position: number;
      topics: { create: Array<{ text: string; position: number }> };
    });
    expect(outlineCreates.map((row) => [row.timeFrame, row.position])).toEqual([
      ['Prelim', 0],
      ['Finals', 1],
    ]);
    expect(outlineCreates[0].topics.create.map((topic) => [topic.text, topic.position])).toEqual([
      ['Arrays', 0],
      ['Complexity', 1],
    ]);
    expect(tx.syllabusCourseInfo.create).toHaveBeenCalledTimes(1);
    expect(tx.syllabusProgramOutcome.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale section replacement with a typed conflict before deleting rows', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(header({ rowVersion: 5 }));

    await expect(
      repository.replaceSection('course-1', 'revision-1', 4, 'policies', ['New policy']),
    ).rejects.toBeInstanceOf(SyllabusConflictError);
    expect(tx.syllabusPolicy.deleteMany).not.toHaveBeenCalled();
    expect(tx.syllabus.updateMany).not.toHaveBeenCalled();
  });

  it('replaces only the selected section and returns the incremented header', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(header({ rowVersion: 3 }));
    tx.syllabus.findUnique.mockResolvedValue(header({ rowVersion: 4, updatedAt: new Date('2026-09-25T10:00:00.000Z') }));

    const result = await repository.replaceSection(
      'course-1',
      'revision-1',
      3,
      'policies',
      ['New policy', 'Second policy'],
    );

    expect(result.rowVersion).toBe(4);
    expect(tx.syllabusPolicy.deleteMany).toHaveBeenCalledWith({ where: { syllabusId: 'revision-1' } });
    expect(tx.syllabusPolicy.createMany).toHaveBeenCalledWith({
      data: [
        { id: 'policy-1', syllabusId: 'revision-1', text: 'New policy', position: 0 },
        { id: 'policy-2', syllabusId: 'revision-1', text: 'Second policy', position: 1 },
      ],
    });
    expect(tx.syllabusOutlineBlock.deleteMany).not.toHaveBeenCalled();
    expect(tx.historyLog.create).toHaveBeenCalledTimes(1);
  });

  it('replaces course information without reinserting unrelated extension fields', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(
      header({
        rowVersion: 3,
        extensionFields: [
          {
            id: 'extension-1',
            syllabusId: 'revision-1',
            path: '$.extensions.example',
            value: '{"enabled":true}',
            valueType: 'object',
          },
        ],
      }),
    );
    tx.syllabus.findUnique.mockResolvedValue(header({ rowVersion: 4 }));

    await repository.replaceSection('course-1', 'revision-1', 3, 'courseInfo', {
      ...mapLegacyToWriteModel(legacyFixture, 'revision-1', 'course-1').courseInfo,
      title: 'Updated Data Structures',
    });

    const createdPaths = tx.syllabusExtensionField.create.mock.calls.map(
      (call) => (call[0].data as { path: string }).path,
    );
    expect(createdPaths).toEqual([
      '$.migration.courseInfo.lectureHours',
      '$.migration.courseInfo.labHours',
    ]);
    expect(createdPaths).not.toContain('$.extensions.example');
  });

  it('does not increment the parent version when a child insert fails', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(header({ rowVersion: 3 }));
    tx.syllabusPolicy.createMany.mockRejectedValue(new Error('child insert failed'));

    await expect(
      repository.replaceSection('course-1', 'revision-1', 3, 'policies', ['New policy']),
    ).rejects.toThrow('child insert failed');
    expect(tx.syllabus.updateMany).not.toHaveBeenCalled();
  });

  it('publishes atomically by archiving the prior revision and moving the current pointer', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(header({ rowVersion: 3 }));
    tx.syllabus.findUnique.mockResolvedValue(
      header({
        status: 'published',
        rowVersion: 4,
        publishedById: 'faculty-2',
        publishedAt: new Date('2026-09-25T11:00:00.000Z'),
        updatedAt: new Date('2026-09-25T11:00:00.000Z'),
      }),
    );

    const result = await repository.publish('course-1', 'revision-1', 3, 'faculty-2');

    expect(result).toMatchObject({ status: 'published', rowVersion: 4 });
    expect(result.publishedAt).toBe('2026-09-25T11:00:00.000Z');
    expect(tx.syllabus.updateMany).toHaveBeenCalledWith({
      where: { courseId: 'course-1', status: 'published' },
      data: { status: 'archived' },
    });
    expect(tx.syllabus.updateMany).toHaveBeenCalledWith({
      where: { id: 'revision-1', courseId: 'course-1', status: 'draft', rowVersion: 3 },
      data: {
        status: 'published',
        publishedAt: new Date('2026-09-25T11:00:00.000Z'),
        publishedById: 'faculty-2',
        rowVersion: { increment: 1 },
      },
    });
    expect(tx.course.updateMany).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: { currentSyllabusId: 'revision-1' },
    });
  });

  it('rejects foreign and missing source files when creating a draft before writing rows', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(
      header({
        sourceDocument: {
          fileName: 'other-course.pdf',
          fileSize: '10 KB',
          fileType: 'pdf',
          uploadedAt: new Date('2026-09-25T12:00:00.000Z'),
          fileDataUrl: null,
          legacyPayload: null,
          courseFileId: 'file-2',
        },
        courseMaps: [],
      }),
    );
    tx.courseFile.findUnique.mockResolvedValueOnce({ courseId: 'course-2' }).mockResolvedValueOnce(null);
    tx.syllabus.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      createdAt: new Date('2026-09-25T08:00:00.000Z'),
      updatedAt: new Date('2026-09-25T08:00:00.000Z'),
    }));
    tx.programOutcome.upsert.mockResolvedValue({ id: 'po-1' });

    await expect(repository.createDraft('course-1', 'faculty-2', 'revision-1')).rejects.toBeInstanceOf(
      SyllabusSourceFileError,
    );
    await expect(repository.createDraft('course-1', 'faculty-2', 'revision-1')).rejects.toBeInstanceOf(
      SyllabusSourceFileError,
    );
    expect(tx.syllabus.create).not.toHaveBeenCalled();
  });

  it('rejects a source file owned by another course before changing source metadata', async () => {
    const { repository, tx } = createHarness();
    tx.syllabus.findFirst.mockResolvedValue(header({ rowVersion: 3 }));
    tx.courseFile.findUnique.mockResolvedValue({ courseId: 'course-2' });

    await expect(
      repository.replaceSection('course-1', 'revision-1', 3, 'sourceDocument', {
        fileName: 'other-course.pdf',
        fileSize: '10 KB',
        fileType: 'pdf',
        uploadedAt: '2026-09-25T12:00:00.000Z',
        courseFileId: 'file-2',
      }),
    ).rejects.toBeInstanceOf(SyllabusSourceFileError);
    expect(tx.syllabusSourceDocument.deleteMany).not.toHaveBeenCalled();
    expect(tx.syllabus.updateMany).not.toHaveBeenCalled();
  });

  it('creates migration audit snapshots and nullable live link rows without changing snapshots on update', async () => {
    const { tx } = createHarness();

    await recordSyllabusMigrationAudit(tx as never, {
      originalCourseId: 'course-1',
      originalRevisionId: 'revision-1',
      sourceChecksum: 'checksum-1',
      status: 'created',
      scannedCount: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      conflictedCount: 0,
      errorText: null,
    });

    expect(tx.syllabusMigrationAudit.upsert).toHaveBeenCalledTimes(1);
    const call = tx.syllabusMigrationAudit.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({
      originalCourseId: 'course-1',
      originalRevisionId: 'revision-1',
      sourceChecksum: 'checksum-1',
      courseLink: { create: { courseId: 'course-1' } },
      revisionLink: { create: { revisionId: 'revision-1' } },
    });
    expect(call.update).not.toHaveProperty('originalCourseId');
    expect(call.update).not.toHaveProperty('originalRevisionId');
    expect(call.update).not.toHaveProperty('sourceChecksum');
    expect(call.update.courseLink).toEqual({
      upsert: { create: { courseId: 'course-1' }, update: { courseId: 'course-1' } },
    });
    expect(call.update.revisionLink).toEqual({
      upsert: { create: { revisionId: 'revision-1' }, update: { revisionId: 'revision-1' } },
    });
  });

  it('returns all seven stable RAG section keys from the current published document', async () => {
    const { repository, tx } = createHarness();
    const model = mapLegacyToWriteModel(legacyFixture, 'revision-1', 'course-1');
    const relational = header({
      status: 'published',
      faculty: [
        {
          id: 'faculty-1',
          syllabusId: 'revision-1',
          name: 'Dr. Ada Lovelace',
          consultation: 'M 15:00-16:00',
          position: 0,
          sections: [],
        },
      ],
      courseOutcomes: model.courseOutcomes.map((row, index) => ({
        id: `co-${index + 1}`,
        syllabusId: 'revision-1',
        ...row,
      })),
      policies: model.policyRows.map((row, index) => ({
        id: `policy-${index + 1}`,
        syllabusId: 'revision-1',
        ...row,
      })),
      outlineBlocks: model.courseOutline.map((row, index) => ({
        id: `outline-${index + 1}`,
        syllabusId: 'revision-1',
        timeFrame: row.timeFrame,
        title: row.title,
        position: row.position,
        topics: row.topics.map((topic) => ({
          id: `topic-${index + 1}-${topic.position + 1}`,
          outlineBlockId: `outline-${index + 1}`,
          ...topic,
        })),
      })),
      references: model.references.map((row, index) => ({
        id: `reference-${index + 1}`,
        syllabusId: 'revision-1',
        ...row,
      })),
    });
    tx.course.findUnique.mockResolvedValue({ code: 'CS 201', title: 'Data Structures', currentSyllabus: relational });

    const sections = await repository.getRagSections('course-1');
    const expectedDocument = mapWriteModelToDocument(model);

    expect(Object.keys(sections)).toEqual([
      'description',
      'outcomes',
      'grading',
      'policies',
      'outline',
      'references',
      'faculty',
    ]);
    expect(sections.description).toContain('CS 201: Data Structures.');
    expect(sections.outcomes).toBe(
      `Course outcomes: ${expectedDocument.courseOutcomes.map((row) => `CO${row.number}: ${row.statement}`).join(' ')}`,
    );
    expect(sections.policies).toBe(`Classroom policies: ${expectedDocument.classroomPolicies.join(' ')}`);
  });

  it('caps every RAG section at a total of 1500 characters', () => {
    const base = mapWriteModelToDocument(mapLegacyToWriteModel(legacyFixture, 'revision-1', 'course-1'));
    const exactPolicies = `Classroom policies: ${'p'.repeat(1480)}`;
    expect(exactPolicies.length).toBe(1500);
    const sections = buildSyllabusRagSections(
      { code: 'CS 201', title: 'Data Structures' },
      {
        ...base,
        courseInfo: { ...base.courseInfo, description: 'x'.repeat(5000) },
        classroomPolicies: ['p'.repeat(1480)],
      },
    );
    expect(Object.keys(sections)).toEqual([
      'description',
      'outcomes',
      'grading',
      'policies',
      'outline',
      'references',
      'faculty',
    ]);
    for (const text of Object.values(sections)) {
      expect(text.length).toBeLessThanOrEqual(1500);
    }
    expect(sections.description.length).toBe(1500);
    expect(sections.description.endsWith('…')).toBe(true);
    expect(sections.policies).toBe(exactPolicies);
  });
});
