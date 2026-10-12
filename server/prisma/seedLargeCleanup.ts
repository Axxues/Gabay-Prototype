// server/prisma/seedLargeCleanup.ts — removes all `seed-` rows (rollback for seedLarge.ts).
import '../src/env.js';
import { prisma } from '../src/db.js';

async function main() {
  await prisma.submission.deleteMany({ where: { OR: [{ id: { startsWith: 'seed-' } }, { courseId: { startsWith: 'seed-' } }] } });
  await prisma.enrollmentRequest.deleteMany({ where: { OR: [{ id: { startsWith: 'seed-' } }, { courseId: { startsWith: 'seed-' } }] } });
  await prisma.courseGrade.deleteMany({ where: { OR: [{ studentId: { startsWith: 'seed-' } }, { courseId: { startsWith: 'seed-' } }] } });
  await prisma.moduleItem.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.activity.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.quiz.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.exam.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.announcement.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.module.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.courseSection.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.course.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.message.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.calendarEvent.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: 'seed-' } } });
  console.log('seed- rows removed (re-ingest Qdrant afterwards to reflect rollback)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
