import { isDeepStrictEqual } from 'node:util';
import type { PrismaClient } from '@prisma/client';
import type { SyllabusWriteModel } from '../src/syllabi/contracts.js';
import { mapWriteModelToDocument } from '../src/syllabi/mapper.js';
import {
  buildSyllabusRagSections,
  readPublishedSyllabusWriteModel,
} from '../src/syllabi/repository.js';
import { buildBackfillWriteModel, type BackfillCourseSource } from './backfillSyllabi.js';

export interface SyllabusParityMismatch {
  courseId: string;
  code: string;
  paths: string[];
}

export interface SyllabusParityResult {
  scanned: number;
  matched: number;
  mismatched: number;
  mismatches: SyllabusParityMismatch[];
}

export interface VerifySyllabiParityOptions {
  report?: (message: string) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const appendPath = (path: string, key: string | number): string =>
  typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key;

const collectDifferences = (
  expected: unknown,
  actual: unknown,
  path: string,
  differences: string[],
): void => {
  if (isDeepStrictEqual(expected, actual)) return;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      collectDifferences(expected[index], actual[index], appendPath(path, index), differences);
    }
    return;
  }
  if (isRecord(expected) && isRecord(actual)) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      collectDifferences(expected[key], actual[key], appendPath(path, key), differences);
    }
    return;
  }
  differences.push(path || 'value');
};

export function compareSyllabusParity(
  expected: SyllabusWriteModel,
  actual: SyllabusWriteModel,
): string[] {
  const differences: string[] = [];
  collectDifferences(
    mapWriteModelToDocument(expected),
    mapWriteModelToDocument(actual),
    '',
    differences,
  );
  collectDifferences(expected.extensions, actual.extensions, 'extensions', differences);
  collectDifferences(expected.sourceDocument, actual.sourceDocument, 'sourceDocument', differences);
  return [...new Set(differences)].sort();
}

export async function verifySyllabiParity(
  client: PrismaClient,
  options: VerifySyllabiParityOptions = {},
): Promise<SyllabusParityResult> {
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
  const result: SyllabusParityResult = {
    scanned: courses.length,
    matched: 0,
    mismatched: 0,
    mismatches: [],
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
    let actual: SyllabusWriteModel | null;
    let expected: SyllabusWriteModel;
    try {
      expected = buildBackfillWriteModel(course, 'parity-revision', new Date(0));
      actual = await readPublishedSyllabusWriteModel(client, course.id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      report(`invalid parity source ${course.id} (${course.code}): ${reason}`);
      result.mismatched += 1;
      result.mismatches.push({ courseId: course.id, code: course.code, paths: ['source'] });
      continue;
    }
    if (!actual) {
      result.mismatched += 1;
      result.mismatches.push({
        courseId: course.id,
        code: course.code,
        paths: ['publishedRevision'],
      });
      report(`missing published revision ${course.id} (${course.code})`);
      continue;
    }
    const paths = compareSyllabusParity(expected, actual);
    const expectedRag = buildSyllabusRagSections(
      { code: course.code, title: course.title },
      mapWriteModelToDocument(expected),
    );
    const actualRag = buildSyllabusRagSections(
      { code: course.code, title: course.title },
      mapWriteModelToDocument(actual),
    );
    collectDifferences(expectedRag, actualRag, 'rag', paths);
    const uniquePaths = [...new Set(paths)].sort();
    if (uniquePaths.length > 0) {
      result.mismatched += 1;
      result.mismatches.push({ courseId: course.id, code: course.code, paths: uniquePaths });
      report(`syllabus parity mismatch ${course.id} (${course.code}): ${uniquePaths.join(', ')}`);
    } else {
      result.matched += 1;
    }
  }

  return result;
}

async function main(): Promise<void> {
  await import('../src/env.js');
  const { prisma } = await import('../src/db.js');
  try {
    const result = await verifySyllabiParity(prisma);
    console.log(
      `scanned ${result.scanned}; matched ${result.matched}; mismatched ${result.mismatched}`,
    );
    if (result.mismatched > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1]?.endsWith('verifySyllabiParity.ts') ||
  process.argv[1]?.endsWith('verifySyllabiParity.js')
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
