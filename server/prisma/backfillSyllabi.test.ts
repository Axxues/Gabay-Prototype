import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { legacyFixture } from '../src/syllabi/fixtures.js';
import { mapWriteModelToDocument } from '../src/syllabi/mapper.js';
import {
  backfillSyllabi,
  buildBackfillWriteModel,
  syllabusSourceChecksum,
} from './backfillSyllabi.js';
import { compareSyllabusParity } from './verifySyllabiParity.js';

type SourceCourse = {
  id: string;
  code: string;
  title: string;
  instructorId: string;
  instructorName: string;
  syllabus: string;
  currentSyllabusId?: string | null;
};

type SyllabusRow = {
  id: string;
  courseId: string;
  revisionNo: number;
  status: string;
};

const source = (id: string, code: string): SourceCourse => ({
  id,
  code,
  title: id === 'course-1' ? 'Data Structures' : 'Algorithms',
  instructorId: `${id}-faculty`,
  instructorName: 'Dr. Faculty',
  syllabus: JSON.stringify({ ...legacyFixture, courseId: id, courseInfo: { ...legacyFixture.courseInfo, code } }),
});

const rowCreate = () =>
  vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));

const createDatabase = (courses: SourceCourse[]) => {
  const audits = new Map<string, Record<string, unknown>>();
  const programOutcomes = new Map<string, { id: string }>();
  const courseOutcomes: Array<{ id: string; syllabusId: string; number: number }> = [];
  const syllabusRows: SyllabusRow[] = [];
  let courseUpdateCount = 1;
  let courseFile: { courseId: string } | null = null;
  const db: Record<string, unknown> = {
    course: {
      findMany: vi.fn().mockResolvedValue(courses),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const course = courses.find((candidate) => candidate.id === where.id);
        return course ? { ...course, currentSyllabusId: course.currentSyllabusId ?? null } : null;
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: { id: string; syllabus?: string }; data: { currentSyllabusId: string } }) => {
          if (courseUpdateCount === 0) return { count: 0 };
          const course = courses.find((candidate) => candidate.id === where.id);
          if (!course || (where.syllabus !== undefined && course.syllabus !== where.syllabus)) {
            return { count: 0 };
          }
          course.currentSyllabusId = data.currentSyllabusId;
          return { count: 1 };
        },
      ),
    },
    courseFile: { findUnique: vi.fn(async () => courseFile) },
    syllabus: {
      create: vi.fn(async ({ data }: { data: SyllabusRow }) => {
        const row = {
          id: String(data.id),
          courseId: String(data.courseId),
          revisionNo: Number(data.revisionNo),
          status: String(data.status),
        };
        syllabusRows.push(row);
        return {
          ...data,
          createdAt: new Date('2026-09-25T12:00:00.000Z'),
          updatedAt: new Date('2026-09-25T12:00:00.000Z'),
        };
      }),
      aggregate: vi.fn(async ({ where }: { where: { courseId: string } }) => ({
        _max: {
          revisionNo: Math.max(
            0,
            ...syllabusRows.filter((row) => row.courseId === where.courseId).map((row) => row.revisionNo),
          ),
        },
      })),
      findFirst: vi.fn(async ({ where }: { where: { courseId: string; status: string } }) =>
        [...syllabusRows]
          .filter((row) => row.courseId === where.courseId && row.status === where.status)
          .sort((left, right) => right.revisionNo - left.revisionNo)[0] ?? null,
      ),
      updateMany: vi.fn(async ({ where, data }: { where: { courseId: string; status: string }; data: { status: string } }) => {
        let count = 0;
        for (const row of syllabusRows) {
          if (row.courseId === where.courseId && row.status === where.status) {
            row.status = data.status;
            count += 1;
          }
        }
        return { count };
      }),
    },
    syllabusInstitution: { create: rowCreate() },
    syllabusCourseInfo: { create: rowCreate() },
    syllabusInstitutionalStatement: { create: rowCreate() },
    syllabusGradingSystem: { create: rowCreate() },
    syllabusGradingComponent: { create: rowCreate() },
    syllabusSourceDocument: { create: rowCreate() },
    syllabusFaculty: { create: rowCreate() },
    syllabusRequirement: { create: rowCreate() },
    syllabusPolicy: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    syllabusRubric: { create: rowCreate() },
    syllabusOutlineBlock: { create: rowCreate() },
    syllabusLearningPlan: { create: rowCreate() },
    syllabusLearningPlanOutcome: { create: rowCreate() },
    syllabusLearningPlanTopic: { create: rowCreate() },
    syllabusLearningPlanMethod: { create: rowCreate() },
    syllabusLearningPlanResource: { create: rowCreate() },
    syllabusLearningPlanAssessment: { create: rowCreate() },
    syllabusLearningPlanSdg: { create: rowCreate() },
    syllabusCourseOutcome: {
      create: vi.fn(async ({ data }: { data: { id: string; syllabusId: string; number: number } }) => {
        courseOutcomes.push(data);
        return data;
      }),
      findMany: vi.fn(async ({ where }: { where: { syllabusId: string } }) =>
        courseOutcomes.filter((outcome) => outcome.syllabusId === where.syllabusId),
      ),
    },
    syllabusCourseMap: { create: rowCreate() },
    syllabusCourseMapProgramOutcome: { create: rowCreate() },
    syllabusReference: { create: rowCreate() },
    syllabusSignatory: { create: rowCreate() },
    syllabusExtensionField: { create: rowCreate() },
    syllabusProgramOutcome: { create: rowCreate() },
    syllabusCoreValue: { create: rowCreate() },
    syllabusGraduateAttribute: { create: rowCreate() },
    programOutcome: {
      upsert: vi.fn(async ({ where, create }: { where: { catalogVersion_number: { catalogVersion: string; number: number } }; create: { id: string } }) => {
        const key = `${where.catalogVersion_number.catalogVersion}:${where.catalogVersion_number.number}`;
        const existing = programOutcomes.get(key);
        if (existing) return existing;
        const row = { id: `po-${where.catalogVersion_number.number}` };
        programOutcomes.set(key, row);
        return row;
      }),
    },
    coreValue: {
      upsert: vi.fn(async ({ where }: { where: { catalogVersion_acronym: { catalogVersion: string; acronym: string } } }) => ({
        id: `cv-${where.catalogVersion_acronym.acronym}`,
      })),
    },
    graduateAttribute: {
      upsert: vi.fn(async ({ where }: { where: { catalogVersion_number: { catalogVersion: string; number: number } } }) => ({
        id: `ga-${where.catalogVersion_number.number}`,
      })),
    },
    syllabusMigrationAudit: {
      findUnique: vi.fn(async ({ where }: { where: { originalCourseId_sourceChecksum: { originalCourseId: string; sourceChecksum: string } } }) => {
        const key = `${where.originalCourseId_sourceChecksum.originalCourseId}:${where.originalCourseId_sourceChecksum.sourceChecksum}`;
        return audits.get(key) ?? null;
      }),
      upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const originalCourseId = String(create.originalCourseId);
        const sourceChecksum = String(create.sourceChecksum);
        const key = `${originalCourseId}:${sourceChecksum}`;
        const current = audits.get(key);
        const next = {
          id: 'audit-existing',
          ...(current ?? create),
          ...update,
          originalCourseId,
          originalRevisionId: (current ?? create).originalRevisionId,
          sourceChecksum,
        };
        audits.set(key, next);
        return next;
      }),
    },
  };
  db.$transaction = vi.fn(async (callback: (value: Record<string, unknown>) => unknown) => callback(db));
  return {
    db: db as unknown as PrismaClient,
    raw: db,
    courses,
    syllabusRows,
    audits,
    setCourseUpdateCount(value: number) {
      courseUpdateCount = value;
    },
    setCourseFile(value: { courseId: string } | null) {
      courseFile = value;
    },
  };
};

const options = () => {
  let id = 0;
  return {
    idFactory: (prefix: string) => `${prefix}-${++id}`,
    now: () => new Date('2026-09-25T12:00:00.000Z'),
    report: vi.fn(),
  };
};

describe('backfillSyllabi', () => {
  it('creates revision 1 transactionally and preserves canonical ordered and source data', async () => {
    const canonical = source('course-1', 'CS 201');
    const harness = createDatabase([canonical]);
    const dependencies = options();
    const model = buildBackfillWriteModel(
      canonical,
      'revision-fixed',
      dependencies.now(),
    );
    const reconstructed = mapWriteModelToDocument(model);

    expect(model.courseOutline.map((row) => [row.timeFrame, row.position])).toEqual([
      ['Prelim', 0],
      ['Finals', 1],
    ]);
    expect(reconstructed.courseOutline.map((row) => row.timeFrame)).toEqual(['Prelim', 'Finals']);
    expect(reconstructed.courseMap[0].coStatement).toBe('Historical map wording');
    expect(reconstructed.sourceDocument).toEqual({
      fileName: 'cs201-syllabus.pdf',
      fileSize: '42 KB',
      fileType: 'pdf',
      fileDataUrl: 'data:application/pdf;base64,fixture',
      uploadedAt: '2026-09-24T08:00:00.000Z',
    });

    const result = await backfillSyllabi(harness.db, dependencies);

    expect(result).toEqual({ scanned: 1, created: 1, updated: 0, skipped: 0, conflicts: 0 });
    expect(harness.raw.$transaction).toHaveBeenCalledTimes(1);
    const raw = harness.raw as {
      syllabus: { create: ReturnType<typeof vi.fn> };
      syllabusCourseMap: { create: ReturnType<typeof vi.fn> };
      syllabusSourceDocument: { create: ReturnType<typeof vi.fn> };
      syllabusExtensionField: { create: ReturnType<typeof vi.fn> };
      course: { updateMany: ReturnType<typeof vi.fn> };
    };
    expect(raw.syllabus.create.mock.calls[0][0].data).toMatchObject({
      courseId: 'course-1',
      revisionNo: 1,
      status: 'published',
      createdById: 'course-1-faculty',
      publishedById: 'course-1-faculty',
    });
    expect(raw.syllabusCourseMap.create.mock.calls[0][0].data).toMatchObject({
      coNumber: 1,
      coStatement: 'Historical map wording',
      position: 0,
    });
    expect(raw.syllabusSourceDocument.create.mock.calls[0][0].data).toMatchObject({
      fileName: 'cs201-syllabus.pdf',
      fileType: 'pdf',
      courseFileId: null,
    });
    expect(
      raw.syllabusExtensionField.create.mock.calls.map((call) => call[0].data.path),
    ).toEqual(
      expect.arrayContaining([
        '$.extensions.example',
        '$.migration.courseInfo.lectureHours',
        '$.migration.courseInfo.labHours',
      ]),
    );
    expect(raw.course.updateMany).toHaveBeenCalledWith({
      where: { id: 'course-1', syllabus: canonical.syllabus },
      data: { currentSyllabusId: expect.any(String) },
    });
  });

  it('quarantines a foreign source file without creating a relational revision', async () => {
    const canonical = source('course-1', 'CS 201');
    const parsed = JSON.parse(canonical.syllabus) as {
      sourceDocument?: Record<string, unknown>;
    };
    const foreign = {
      ...canonical,
      syllabus: JSON.stringify({
        ...parsed,
        sourceDocument: { ...parsed.sourceDocument, courseFileId: 'file-foreign' },
      }),
    };
    const harness = createDatabase([foreign]);
    harness.setCourseFile({ courseId: 'course-2' });

    const result = await backfillSyllabi(harness.db, options());

    expect(result).toEqual({ scanned: 1, created: 0, updated: 0, skipped: 0, conflicts: 1 });
    expect((harness.raw.syllabus as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
    const auditUpsert = (harness.raw.syllabusMigrationAudit as { upsert: ReturnType<typeof vi.fn> }).upsert;
    expect(auditUpsert.mock.calls[0][0].create).toMatchObject({
      originalCourseId: 'course-1',
      originalRevisionId: null,
      status: 'conflict',
      conflictedCount: 1,
      errorText: expect.any(String),
    });
  });

  it('reports and audits malformed rows without creating relational revisions', async () => {
    const malformed = { ...source('course-bad', 'BAD 101'), syllabus: '[]' };
    const harness = createDatabase([malformed]);
    const dependencies = options();

    const result = await backfillSyllabi(harness.db, dependencies);

    expect(result).toEqual({ scanned: 1, created: 0, updated: 0, skipped: 1, conflicts: 0 });
    expect(dependencies.report).toHaveBeenCalledWith(expect.stringContaining('course-bad'));
    const auditCall = (harness.raw.syllabusMigrationAudit as { upsert: ReturnType<typeof vi.fn> }).upsert.mock.calls[0][0];
    expect(auditCall.create).toMatchObject({
      originalCourseId: 'course-bad',
      originalRevisionId: null,
      status: 'skipped',
      skippedCount: 1,
      courseLink: { create: { courseId: 'course-bad' } },
      revisionLink: { create: { revisionId: null } },
    });
    expect((harness.raw.syllabus as { create: ReturnType<typeof vi.fn> }).create).not.toHaveBeenCalled();
  });

  it('performs no audit update on a second run for the same malformed checksum', async () => {
    const malformed = { ...source('course-bad', 'BAD 101'), syllabus: '[]' };
    const harness = createDatabase([malformed]);
    const dependencies = options();
    await backfillSyllabi(harness.db, dependencies);
    const auditUpsert = (harness.raw.syllabusMigrationAudit as { upsert: ReturnType<typeof vi.fn> }).upsert;
    const transactionCalls = (harness.raw.$transaction as ReturnType<typeof vi.fn>).mock.calls.length;

    const result = await backfillSyllabi(harness.db, dependencies);

    expect(result).toEqual({ scanned: 1, created: 0, updated: 0, skipped: 1, conflicts: 0 });
    expect(auditUpsert).toHaveBeenCalledTimes(1);
    expect(harness.raw.$transaction).toHaveBeenCalledTimes(transactionCalls);
  });

  it('reuses duplicate global catalog identities across course transactions', async () => {
    const harness = createDatabase([
      source('course-1', 'CS 201'),
      source('course-2', 'CS 202'),
    ]);

    const result = await backfillSyllabi(harness.db, options());

    expect(result).toEqual({ scanned: 2, created: 2, updated: 0, skipped: 0, conflicts: 0 });
    expect(harness.raw.$transaction).toHaveBeenCalledTimes(2);
    const raw = harness.raw as {
      syllabusProgramOutcome: { create: ReturnType<typeof vi.fn> };
    };
    const links = raw.syllabusProgramOutcome.create.mock.calls.map((call) => ({
      syllabusId: call[0].data.syllabusId,
      programOutcomeId: call[0].data.programOutcomeId,
      position: call[0].data.position,
    }));
    expect(links.filter((link) => link.position === 0).map((link) => link.programOutcomeId)).toEqual([
      'po-1',
      'po-1',
    ]);
  });

  it('marks a checksum conflict when the course source changes during the transaction', async () => {
    const harness = createDatabase([source('course-1', 'CS 201')]);
    harness.setCourseUpdateCount(0);
    const dependencies = options();

    const result = await backfillSyllabi(harness.db, dependencies);

    expect(result).toEqual({ scanned: 1, created: 0, updated: 0, skipped: 0, conflicts: 1 });
    expect(harness.raw.$transaction).toHaveBeenCalledTimes(2);
    const auditUpsert = (harness.raw.syllabusMigrationAudit as { upsert: ReturnType<typeof vi.fn> }).upsert;
    expect(auditUpsert).toHaveBeenCalledTimes(1);
    expect(auditUpsert.mock.calls[0][0].create).toMatchObject({
      originalCourseId: 'course-1',
      originalRevisionId: null,
      status: 'conflict',
      conflictedCount: 1,
      revisionLink: { create: { revisionId: null } },
    });
  });

  it('performs no writes on a second run for an already-current checksum', async () => {
    const harness = createDatabase([source('course-1', 'CS 201')]);
    const dependencies = options();
    const first = await backfillSyllabi(harness.db, dependencies);
    const transactionCalls = (harness.raw.$transaction as ReturnType<typeof vi.fn>).mock.calls.length;
    const revisionCreate = (harness.raw.syllabus as { create: ReturnType<typeof vi.fn> }).create;
    const revisionCreates = revisionCreate.mock.calls.length;

    const second = await backfillSyllabi(harness.db, dependencies);

    expect(first.created).toBe(1);
    expect(second).toEqual({ scanned: 1, created: 0, updated: 0, skipped: 1, conflicts: 0 });
    expect((harness.raw.$transaction as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(transactionCalls);
    expect(revisionCreate).toHaveBeenCalledTimes(revisionCreates);
  });

  it('archives the prior published revision and creates the next revision when the checksum changes', async () => {
    const harness = createDatabase([source('course-1', 'CS 201')]);
    const dependencies = options();
    const first = await backfillSyllabi(harness.db, dependencies);
    const firstRevision = (harness.raw.syllabus as { create: ReturnType<typeof vi.fn> }).create.mock.calls[0][0]
      .data as { id: string };
    const parsed = JSON.parse(harness.courses[0].syllabus) as {
      courseInfo?: Record<string, unknown>;
    };
    harness.courses[0].syllabus = JSON.stringify({
      ...parsed,
      courseInfo: { ...parsed.courseInfo, title: 'Advanced Data Structures' },
    });

    const second = await backfillSyllabi(harness.db, dependencies);

    expect(first).toEqual({ scanned: 1, created: 1, updated: 0, skipped: 0, conflicts: 0 });
    expect(second).toEqual({ scanned: 1, created: 0, updated: 1, skipped: 0, conflicts: 0 });
    const raw = harness.raw as {
      syllabus: { create: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
      course: { updateMany: ReturnType<typeof vi.fn> };
      syllabusMigrationAudit: { upsert: ReturnType<typeof vi.fn> };
    };
    const secondCreate = raw.syllabus.create.mock.calls[1][0].data as {
      id: string;
      revisionNo: number;
      status: string;
      parentSyllabusId: string | null;
    };
    expect(secondCreate).toMatchObject({
      revisionNo: 2,
      status: 'published',
      parentSyllabusId: firstRevision.id,
    });
    expect(raw.syllabus.updateMany).toHaveBeenCalledWith({
      where: { courseId: 'course-1', status: 'published' },
      data: { status: 'archived' },
    });
    expect(harness.syllabusRows.filter((row) => row.status === 'published')).toHaveLength(1);
    expect(harness.syllabusRows.map((row) => [row.id, row.revisionNo, row.status])).toEqual([
      [firstRevision.id, 1, 'archived'],
      [secondCreate.id, 2, 'published'],
    ]);
    expect(harness.courses[0].currentSyllabusId).toBe(secondCreate.id);
    expect(raw.syllabusMigrationAudit.upsert.mock.calls[1][0].create).toMatchObject({
      originalCourseId: 'course-1',
      originalRevisionId: secondCreate.id,
      status: 'updated',
      updatedCount: 1,
      revisionLink: { create: { revisionId: secondCreate.id } },
    });
    expect(harness.raw.$transaction).toHaveBeenCalledTimes(2);
    const transactionsBeforeThirdRun = (harness.raw.$transaction as ReturnType<typeof vi.fn>).mock.calls.length;
    const revisionsBeforeThirdRun = raw.syllabus.create.mock.calls.length;
    const auditsBeforeThirdRun = raw.syllabusMigrationAudit.upsert.mock.calls.length;
    const archivesBeforeThirdRun = raw.syllabus.updateMany.mock.calls.length;

    const third = await backfillSyllabi(harness.db, dependencies);

    expect(third).toEqual({ scanned: 1, created: 0, updated: 0, skipped: 1, conflicts: 0 });
    expect(harness.raw.$transaction).toHaveBeenCalledTimes(transactionsBeforeThirdRun);
    expect(raw.syllabus.create).toHaveBeenCalledTimes(revisionsBeforeThirdRun);
    expect(raw.syllabus.updateMany).toHaveBeenCalledTimes(archivesBeforeThirdRun);
    expect(raw.syllabusMigrationAudit.upsert).toHaveBeenCalledTimes(auditsBeforeThirdRun);
    expect(harness.syllabusRows.filter((row) => row.status === 'published')).toHaveLength(1);
    expect(harness.syllabusRows.map((row) => [row.id, row.revisionNo, row.status])).toEqual([
      [firstRevision.id, 1, 'archived'],
      [secondCreate.id, 2, 'published'],
    ]);
    expect(harness.courses[0].currentSyllabusId).toBe(secondCreate.id);
  });

  it('propagates operational database errors', async () => {
    const harness = createDatabase([source('course-1', 'CS 201')]);
    (harness.raw.course as { findMany: ReturnType<typeof vi.fn> }).findMany.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(backfillSyllabi(harness.db, options())).rejects.toThrow('database unavailable');
  });

  it('reports exact parity differences in reconstructed map statements', () => {
    const canonical = source('course-1', 'CS 201');
    const expected = buildBackfillWriteModel(
      canonical,
      'revision-fixed',
      new Date('2026-09-25T12:00:00.000Z'),
    );
    const actual = structuredClone(expected);

    expect(compareSyllabusParity(expected, actual)).toEqual([]);
    actual.courseMap[0].coStatement = 'Changed historical wording';
    expect(compareSyllabusParity(expected, actual)).toContain('courseMap[0].coStatement');
  });

  it('computes a stable SHA-256 checksum for the exact source row', () => {
    const canonical = source('course-1', 'CS 201');
    const checksum = syllabusSourceChecksum(canonical.syllabus);

    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(syllabusSourceChecksum(canonical.syllabus)).toBe(checksum);
    expect(syllabusSourceChecksum(`${canonical.syllabus} `)).not.toBe(checksum);
  });
});
