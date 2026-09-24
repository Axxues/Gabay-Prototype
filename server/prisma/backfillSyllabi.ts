import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { mapLegacyToWriteModel } from '../src/syllabi/mapper.js';
import {
  persistSyllabusRevision,
  recordSyllabusMigrationAudit,
  SyllabusSourceFileError,
  validateSourceFile,
  type SyllabusIdFactory,
} from '../src/syllabi/repository.js';
import { SyllabusNormalizationError } from '../src/utils/syllabusNormalization.js';

export interface BackfillCourseSource {
  id: string;
  code: string;
  title: string;
  instructorId: string;
  instructorName: string;
  syllabus: string;
}

export interface BackfillSyllabiResult {
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
}

export interface BackfillSyllabiOptions {
  idFactory?: SyllabusIdFactory;
  now?: () => Date;
  report?: (message: string) => void;
}

class SourceChangedDuringBackfillError extends Error {
  constructor() {
    super('The legacy syllabus changed after it was read.');
    this.name = 'SourceChangedDuringBackfillError';
  }
}

const defaultIdFactory: SyllabusIdFactory = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function syllabusSourceChecksum(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex');
}

export function buildBackfillWriteModel(
  course: BackfillCourseSource,
  revisionId: string,
  publishedAt: Date,
) {
  const model = mapLegacyToWriteModel(course.syllabus, revisionId, course.id);
  return {
    ...model,
    revisionNo: 1,
    status: 'published' as const,
    rowVersion: 1,
    createdAt: publishedAt.toISOString(),
    updatedAt: publishedAt.toISOString(),
    publishedAt: publishedAt.toISOString(),
  };
}

const isCurrentAudit = (audit: {
  status: string;
  originalRevisionId: string | null;
} | null): boolean => {
  if (audit === null) return false;
  if (audit.status === 'skipped') return true;
  return (
    (audit.status === 'created' || audit.status === 'updated') &&
    audit.originalRevisionId !== null
  );
};

export async function backfillSyllabi(
  client: PrismaClient,
  options: BackfillSyllabiOptions = {},
): Promise<BackfillSyllabiResult> {
  const idFactory = options.idFactory ?? defaultIdFactory;
  const now = options.now ?? (() => new Date());
  const report = options.report ?? console.warn;
  const courses = await client.course.findMany({
    where: { syllabus: { not: null } },
    select: {
      id: true,
      code: true,
      title: true,
      instructorId: true,
      instructorName: true,
      syllabus: true,
    },
    orderBy: { id: 'asc' },
  });
  const result: BackfillSyllabiResult = {
    scanned: courses.length,
    created: 0,
    updated: 0,
    skipped: 0,
    conflicts: 0,
  };

  for (const row of courses) {
    if (row.syllabus === null) continue;
    const course: BackfillCourseSource = {
      id: row.id,
      code: row.code,
      title: row.title,
      instructorId: row.instructorId,
      instructorName: row.instructorName,
      syllabus: row.syllabus,
    };
    const sourceChecksum = syllabusSourceChecksum(course.syllabus);
    const existing = await client.syllabusMigrationAudit.findUnique({
      where: {
        originalCourseId_sourceChecksum: {
          originalCourseId: course.id,
          sourceChecksum,
        },
      },
      select: { status: true, originalRevisionId: true },
    });
    if (isCurrentAudit(existing)) {
      result.skipped += 1;
      continue;
    }

    const publishedAt = now();
    let model: ReturnType<typeof buildBackfillWriteModel>;
    try {
      model = buildBackfillWriteModel(course, idFactory('syl'), publishedAt);
    } catch (error) {
      if (!(error instanceof SyllabusNormalizationError)) throw error;
      result.skipped += 1;
      const reason = error.message;
      report(`skipped syllabus ${course.id} (${course.code}): ${reason}`);
      await client.$transaction(async (tx) => {
        await recordSyllabusMigrationAudit(tx, {
          originalCourseId: course.id,
          originalRevisionId: null,
          sourceChecksum,
          status: 'skipped',
          scannedCount: 1,
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 1,
          conflictedCount: 0,
          errorText: reason,
        });
      });
      continue;
    }

    try {
      await validateSourceFile(client, course.id, model);
    } catch (error) {
      if (!(error instanceof SyllabusSourceFileError)) throw error;
      result.conflicts += 1;
      report(`rejected syllabus ${course.id} (${course.code}): ${error.message}`);
      await client.$transaction(async (tx) => {
        await recordSyllabusMigrationAudit(tx, {
          originalCourseId: course.id,
          originalRevisionId: null,
          sourceChecksum,
          status: 'conflict',
          scannedCount: 1,
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          conflictedCount: 1,
          errorText: error.message,
        });
      });
      continue;
    }

    try {
      let replacement = false;
      await client.$transaction(async (tx) => {
        const prior = await tx.course.findUnique({
          where: { id: course.id },
          select: { currentSyllabusId: true },
        });
        const latest = await tx.syllabus.aggregate({
          where: { courseId: course.id },
          _max: { revisionNo: true },
        });
        const revision = { ...model, revisionNo: (latest._max.revisionNo ?? 0) + 1 };
        replacement = prior?.currentSyllabusId != null;
        if (replacement) {
          await tx.syllabus.updateMany({
            where: { courseId: course.id, status: 'published' },
            data: { status: 'archived' },
          });
        }
        await persistSyllabusRevision(
          tx,
          revision,
          {
            createdById: course.instructorId,
            publishedById: course.instructorId,
            publishedAt,
            parentSyllabusId: prior?.currentSyllabusId ?? null,
          },
          idFactory,
        );
        const current = await tx.course.updateMany({
          where: { id: course.id, syllabus: course.syllabus },
          data: { currentSyllabusId: revision.id },
        });
        if (current.count !== 1) throw new SourceChangedDuringBackfillError();
        await recordSyllabusMigrationAudit(tx, {
          originalCourseId: course.id,
          originalRevisionId: revision.id,
          sourceChecksum,
          status: replacement ? 'updated' : 'created',
          scannedCount: 1,
          createdCount: replacement ? 0 : 1,
          updatedCount: replacement ? 1 : 0,
          skippedCount: 0,
          conflictedCount: 0,
          errorText: null,
        });
      });
      result[replacement ? 'updated' : 'created'] += 1;
    } catch (error) {
      if (!(error instanceof SourceChangedDuringBackfillError)) throw error;
      result.conflicts += 1;
      report(`conflict syllabus ${course.id} (${course.code}); row changed during backfill`);
      await client.$transaction(async (tx) => {
        await recordSyllabusMigrationAudit(tx, {
          originalCourseId: course.id,
          originalRevisionId: null,
          sourceChecksum,
          status: 'conflict',
          scannedCount: 1,
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          conflictedCount: 1,
          errorText: error.message,
        });
      });
    }
  }

  return result;
}

async function main(): Promise<void> {
  await import('../src/env.js');
  const { prisma } = await import('../src/db.js');
  try {
    const result = await backfillSyllabi(prisma);
    console.log(
      `scanned ${result.scanned}; created ${result.created}; updated ${result.updated}; skipped ${result.skipped}; conflicts ${result.conflicts}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1]?.endsWith('backfillSyllabi.ts') ||
  process.argv[1]?.endsWith('backfillSyllabi.js')
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
