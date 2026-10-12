import { Router } from 'express';
import { prisma } from '../db.js';
import { ApiError } from '../utils/errors.js';
import { RagSectionKeyOrder, type RagSectionKey } from '../syllabi/contracts.js';
import { type SyllabusRagRecord, type SyllabusRagSections } from '../syllabi/repository.js';
import { getRagSyllabusRepository } from '../syllabi/runtime.js';

export const ragExportRouter = Router();
ragExportRouter.use((req, _res, next) => {
  const expected = process.env.RAG_EXPORT_KEY;
  if (!expected || req.header('x-rag-export-key') !== expected) {
    throw new ApiError(401, 'unauthorized', 'Missing or invalid export key.');
  }
  next();
});

type Table = { collection: string; domain: string; isJunction: false; records: unknown[] };
const pack = (collection: string, domain: string, records: unknown[]): Table =>
  ({ collection, domain, isJunction: false, records });

export interface RagSyllabusSectionSource {
  getRagSections(courseId: string): Promise<Partial<SyllabusRagSections>>;
  getRagSectionRecords?(courseId: string): Promise<SyllabusRagRecord[]>;
}

let activeRagSyllabusSource: RagSyllabusSectionSource | null = null;

export function setRagSyllabusRepository(source: RagSyllabusSectionSource | null): void {
  activeRagSyllabusSource = source;
}

function getRagSyllabusSource(): RagSyllabusSectionSource {
  // Shared runtime singleton: both the export and the structured
  // course_syllabus reads use getRagSyllabusRepository() by default.
  return activeRagSyllabusSource ?? getRagSyllabusRepository();
}

// RAG section docs for course syllabi. The raw Course.syllabus column holds a
// ~30KB OfficialSyllabusData JSON string — far beyond one embedding chunk —
// so the export parses it and emits one bounded record per section. Returns []
// for missing/malformed/empty syllabi (ingestion skips the course, never fails).
export interface SyllabusSection {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  syllabusId: string;
  revisionNo: number;
  status: 'published';
  section_key: string;
  section_text: string;
}

const SYLLABUS_SECTION_LIMIT = 1500;

function cap(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > SYLLABUS_SECTION_LIMIT ? t.slice(0, SYLLABUS_SECTION_LIMIT - 1) + '…' : t;
}

export function buildSyllabusSections(course: {
  id: string; code: string; title: string; syllabus: string | null;
}): SyllabusSection[] {
  if (!course.syllabus) return [];
  let s: any;
  try {
    s = JSON.parse(course.syllabus);
  } catch {
    return [];
  }
  if (!s || typeof s !== 'object') return [];
  const out: SyllabusSection[] = [];
  const push = (key: string, text: string) => {
    const capped = cap(text);
    // Legacy JSON path has no revision pointer; export metadata stays empty
    // while the repository-backed path below fills real values.
    if (capped) out.push({ id: `${course.id}#${key}`, courseId: course.id, courseCode: course.code, courseTitle: course.title, syllabusId: '', revisionNo: 0, status: 'published', section_key: key, section_text: capped });
  };
  const info = s.courseInfo ?? {};
  const hasInfo = ['semester', 'academicYear', 'credit', 'lectureHours', 'labHours', 'prerequisite', 'description']
    .some((k) => typeof info[k] === 'string' && info[k].trim() !== '');
  if (hasInfo) {
    push('description', [
      `${course.code}: ${course.title}.`,
      info.semester ? `Semester: ${info.semester}.` : '',
      info.academicYear ? `Academic year: ${info.academicYear}.` : '',
      info.credit ? `Credits: ${info.credit}.` : '',
      info.lectureHours ? `Lecture: ${info.lectureHours}.` : '',
      info.labHours ? `Laboratory: ${info.labHours}.` : '',
      info.prerequisite ? `Prerequisite: ${info.prerequisite}.` : '',
      info.description ?? '',
    ].filter(Boolean).join(' '));
  }
  if (Array.isArray(s.courseOutcomes) && s.courseOutcomes.length > 0) {
    push('outcomes', 'Course outcomes: ' + s.courseOutcomes
      .map((o: any) => `CO${o.number}: ${o.statement}`).join(' '));
  }
  const g = s.gradingSystem;
  if (g && typeof g === 'object') {
    push('grading', [
      g.termFormula ? `Term grade formula: ${g.termFormula}.` : '',
      g.finalFormula ? `Final grade formula: ${g.finalFormula}.` : '',
      Array.isArray(g.classStandingComponents) && g.classStandingComponents.length > 0
        ? `Class standing components: ${g.classStandingComponents.join(', ')}.` : '',
      g.passingGrade ? `Passing grade: ${g.passingGrade}.` : '',
    ].filter(Boolean).join(' '));
  }
  if (Array.isArray(s.classroomPolicies) && s.classroomPolicies.length > 0) {
    push('policies', 'Classroom policies: ' + s.classroomPolicies.join(' '));
  }
  if (Array.isArray(s.courseOutline) && s.courseOutline.length > 0) {
    push('outline', 'Course outline: ' + s.courseOutline
      .map((o: any) => `${o.timeFrame ?? ''} ${o.title ?? ''}${Array.isArray(o.topics) && o.topics.length > 0 ? ` (${o.topics.join(', ')})` : ''};`).join(' '));
  }
  if (Array.isArray(s.references) && s.references.length > 0) {
    push('references', 'References: ' + s.references
      .map((r: any) => `${r.citation ?? ''}${r.year ? ` (${r.year})` : ''};`).join(' '));
  }
  if (Array.isArray(s.facultyMembers) && s.facultyMembers.length > 0) {
    push('faculty', 'Syllabus faculty: ' + s.facultyMembers
      .map((f: any) => String(f.name ?? '')).filter(Boolean).join(', ') + '.');
  }
  return out;
}

// Sixteen-key export backed by the published-only repository projection.
// Intentional inclusions/omissions (per normalized-syllabus plan §2-3):
// - Emitted: the sixteen public section texts with stable ids
//   `<courseId>#<section_key>` (old seven ids byte-preserved), plus
//   syllabusId, revisionNo, and status 'published' from getRagSectionRecords.
// - Filtered: empty sections produce no record (courses with no published
//   syllabus contribute zero rows; ingestion skips them, never fails).
// - Never read: drafts/archived revisions, audit tables, source payloads
//   (fileDataUrl/legacyPayload), extension values, actor ids
//   (createdById/publishedById), signatory names/titles, faculty user ids,
//   consultation/schedule/room details, or raw internal child ids.
// - Export text is the repository builder text verbatim (cap-only), so
//   `description` and every other key compare strictly equal to
//   getRagSections().
export function buildSyllabusSectionRecords(
  course: { id: string; code: string; title: string },
  sections: Partial<SyllabusRagSections>,
  records: SyllabusRagRecord[] = [],
): SyllabusSection[] {
  const meta = new Map<RagSectionKey, SyllabusRagRecord>();
  for (const record of records) {
    if (!meta.has(record.sectionKey)) meta.set(record.sectionKey, record);
  }
  const out: SyllabusSection[] = [];
  for (const key of RagSectionKeyOrder) {
    const capped = cap(sections[key] ?? meta.get(key)?.sectionText ?? '');
    if (capped) {
      const known = meta.get(key);
      out.push({
        id: `${course.id}#${key}`,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        syllabusId: known?.syllabusId ?? '',
        revisionNo: known?.revisionNo ?? 0,
        status: 'published',
        section_key: key,
        section_text: capped,
      });
    }
  }
  return out;
}

ragExportRouter.get('/courses', async (_req, res, next) => {
  try {
    const courses = await prisma.course.findMany({ select: { id: true, code: true, title: true, section: true, instructorName: true, published: true, enrolledCount: true } });
    const source = getRagSyllabusSource();
    const sectionLists = await Promise.all(
      courses.map(async (c) => {
        try {
          const sections = await source.getRagSections(c.id);
          const records = typeof source.getRagSectionRecords === 'function'
            ? await source.getRagSectionRecords(c.id)
            : [];
          return buildSyllabusSectionRecords(c, sections, records);
        } catch (err) {
          console.error(`[rag-export] Skipping syllabus sections for course ${c.id}: ${(err as Error)?.message ?? err}`);
          return [];
        }
      }),
    );
    const syllabusSections = sectionLists.flat();
    res.json({ area: 'courses', tables: [
      pack('course', 'courses', courses),
      pack('course_section', 'courses', await prisma.courseSection.findMany({ select: { id: true, courseId: true, name: true, capacity: true, enrolledCount: true, schedule: true, location: true } })),
      pack('enrollment_request', 'courses', await prisma.enrollmentRequest.findMany({ select: { id: true, courseId: true, studentId: true, studentName: true, type: true, status: true, requestedAt: true } })),
      pack('course_syllabus', 'courses', syllabusSections),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/learning', async (_req, res, next) => {
  try {
    res.json({ area: 'learning', tables: [
      pack('module', 'learning', await prisma.module.findMany({ select: { id: true, courseId: true, title: true, order: true, published: true } })),
      pack('module_item', 'learning', await prisma.moduleItem.findMany({ select: { id: true, moduleId: true, title: true, type: true, published: true, required: true } })),
      pack('activity', 'learning', await prisma.activity.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, pointsPossible: true, published: true, dueDate: true } })),
      pack('quiz', 'learning', await prisma.quiz.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, timeLimitMinutes: true, published: true, dueDate: true } })),
      pack('exam', 'learning', await prisma.exam.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, timeLimitMinutes: true, published: true } })),
      pack('announcement', 'learning', await prisma.announcement.findMany({ select: { id: true, courseId: true, title: true, content: true, authorName: true, createdAt: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/people', async (_req, res, next) => {
  try {
    res.json({ area: 'people', tables: [
      pack('user_directory', 'people', await prisma.user.findMany({ select: { id: true, name: true, role: true, department: true, title: true } })),
      pack('calendar_event', 'people', await prisma.calendarEvent.findMany({ select: { id: true, title: true, date: true, time: true, courseId: true, courseCode: true, type: true, description: true } })),
      pack('message_meta', 'people', await prisma.message.findMany({ select: { id: true, senderName: true, senderRole: true, recipientName: true, courseCode: true, subject: true, timestamp: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/progress', async (_req, res, next) => {
  try {
    res.json({ area: 'progress', tables: [
      pack('submission', 'progress', await prisma.submission.findMany({ select: { id: true, courseId: true, studentId: true, studentName: true, grade: true, status: true, submittedAt: true } })),
      pack('course_grade', 'progress', await prisma.courseGrade.findMany({ select: { courseId: true, studentId: true, midtermGrade: true, finalGrade: true, sprCells: true, updatedAt: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.use((req, _res, next) => next(new ApiError(404, 'not_found', `Unknown export area: ${req.path}`)));
