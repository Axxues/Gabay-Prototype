import '../src/env.js';
import { prisma } from '../src/db.js';
import { normalizeSyllabusField, SyllabusNormalizationError } from '../src/utils/syllabusNormalization.js';

export interface NormalizeSyllabiResult {
  scanned: number;
  updated: number;
  skipped: number;
  conflicts: number;
}

export async function normalizeSyllabi(): Promise<NormalizeSyllabiResult> {
  const courses = await prisma.course.findMany({
    where: { syllabus: { not: null } },
    select: { id: true, code: true, syllabus: true },
  });
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const course of courses) {
    let normalized: string | null;
    try {
      normalized = normalizeSyllabusField(course.syllabus);
    } catch (error) {
      if (!(error instanceof SyllabusNormalizationError)) throw error;
      skipped += 1;
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`skipped syllabus ${course.id} (${course.code}): ${reason}`);
      continue;
    }

    if (normalized === null || normalized === course.syllabus) continue;
    const result = await prisma.course.updateMany({
      where: { id: course.id, syllabus: course.syllabus },
      data: { syllabus: normalized },
    });
    if (result.count === 1) {
      updated += 1;
    } else {
      conflicts += 1;
      console.warn(`conflict syllabus ${course.id} (${course.code}); row changed during normalization`);
    }
  }

  return { scanned: courses.length, updated, skipped, conflicts };
}

async function main() {
  const result = await normalizeSyllabi();
  console.log(
    `normalized ${result.updated} of ${result.scanned} syllabi; skipped ${result.skipped}; conflicts ${result.conflicts}`,
  );
}

if (process.argv[1]?.endsWith('normalizeSyllabi.ts')) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
