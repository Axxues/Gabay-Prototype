import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';

export const coursesRouter = Router();
export const sectionsRouter = Router();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

function isOversizedDataUrl(value: unknown): boolean {
  // Covers must be URLs (/uploads/…, https://…). An inlined data URL photo
  // balloons the Course row to tens of MB and makes every course query
  // (list + all per-course access checks) take ~1s. Small inline SVGs stay
  // allowed; anything bigger must be uploaded as a file first.
  return (
    typeof value === 'string' && value.startsWith('data:') && value.length > 200_000
  );
}

function isJoinCodeConflict(err: unknown): boolean {
  if ((err as { code?: unknown })?.code !== 'P2002') return false;
  const target = (err as { meta?: { target?: unknown } })?.meta?.target;
  if (target === undefined) return true;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some((t) => typeof t === 'string' && t.includes('joinCode'));
}

interface CourseRow {
  id: string;
  instructorId: string;
  published: boolean;
}

async function loadCourseOr404(courseId: string) {
  // Narrow select: access checks only need id/instructorId/published. A full
  // row drag would pull the multi-MB image/syllabus blobs on every
  // course-scoped call. (GET /:id detail uses its own full-row query below.)
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true, published: true },
  });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  return course;
}

async function assertCourseAccess(course: CourseRow, auth: AuthPayload): Promise<void> {
  if (auth.role === 'faculty' || auth.role === 'admin') return;
  if (course.instructorId === auth.sub) return;
  const membership = await prisma.enrollmentRequest.findFirst({
    where: { courseId: course.id, studentId: auth.sub, status: 'approved' },
  });
  if (!membership) throw new ApiError(403, 'forbidden', 'You are not a member of this course.');
}

function assertCourseOwner(course: { instructorId: string }, auth: AuthPayload): void {
  if (auth.role !== 'admin' && course.instructorId !== auth.sub) {
    throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
  }
}

coursesRouter.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const enrolled = req.query.enrolled;
    if (enrolled !== undefined && typeof enrolled !== 'string') {
      throw new ApiError(400, 'bad_request', 'Query param enrolled must be a user id.');
    }
    // The unfiltered catalog is for staff managing courses; students may
    // only list their own approved enrollments (never the full catalog with
    // join codes and syllabi).
    if (!enrolled && req.auth!.role === 'student') {
      throw new ApiError(403, 'forbidden', 'Students may only list their enrolled courses.');
    }
    const courses = enrolled
      ? await prisma.course.findMany({
          where: {
            published: true,
            OR: [
              { instructorId: enrolled },
              { requests: { some: { studentId: enrolled, status: 'approved' } } },
            ],
          },
        })
      : await prisma.course.findMany({ where: { published: true } });
    res.json({ courses });
  })
);

coursesRouter.post(
  '/',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { code, title, section, term } = body;
    if (
      typeof code !== 'string' ||
      !code ||
      typeof title !== 'string' ||
      !title ||
      typeof section !== 'string' ||
      !section ||
      typeof term !== 'string' ||
      !term
    ) {
      throw new ApiError(400, 'bad_request', 'Fields code, title, section, term are required.');
    }
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const suppliedJoinCode = str(body.joinCode);
    if (isOversizedDataUrl(body.image)) {
      throw new ApiError(413, 'image_too_large', 'Cover image must be uploaded as a file (/uploads/…) or an external URL, not an inlined data URL.');
    }
    const baseData = {
      id: newId('c'),
      code,
      title,
      section,
      term,
      instructorId: auth.sub,
      instructorName: str(body.instructorName) ?? '',
      published: typeof body.published === 'boolean' ? body.published : false,
      color: str(body.color) ?? null,
      image: str(body.image) ?? null,
      credits: typeof body.credits === 'number' ? body.credits : null,
      chedComplianceCode: str(body.chedComplianceCode) ?? null,
      syllabus: str(body.syllabus) ?? null,
    };
    if (typeof suppliedJoinCode === 'string' && suppliedJoinCode !== '') {
      const course = await prisma.course.create({
        data: { ...baseData, joinCode: suppliedJoinCode },
      });
      res.status(201).json({ course });
      return;
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const course = await prisma.course.create({
          data: { ...baseData, joinCode: generateJoinCode() },
        });
        res.status(201).json({ course });
        return;
      } catch (err) {
        if (!isJoinCodeConflict(err)) throw err;
        lastErr = err;
      }
    }
    if (lastErr) {
      // Exhausted retries; surface the last collision only if it is still a
      // joinCode conflict, otherwise let the original error propagate.
      if (isJoinCodeConflict(lastErr)) {
        throw new ApiError(409, 'conflict', 'Join code collision, please retry.');
      }
      throw lastErr;
    }
    throw new ApiError(409, 'conflict', 'Join code collision, please retry.');
  })
);

coursesRouter.post(
  '/join',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const { code } = (req.body ?? {}) as { code?: unknown };
    if (typeof code !== 'string' || !code) {
      throw new ApiError(400, 'bad_request', 'Field code is required.');
    }
    const course = await prisma.course.findUnique({ where: { joinCode: code } });
    if (!course || !course.published) {
      throw new ApiError(404, 'course_not_found', 'No published course matches that code.');
    }
    const existing = await prisma.enrollmentRequest.findFirst({
      where: { courseId: course.id, studentId: auth.sub, status: 'pending' },
    });
    if (existing) {
      res.json({ request: { ...existing, courseCode: course.code, courseTitle: course.title } });
      return;
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const request = await prisma.enrollmentRequest.create({
      data: {
        id: newId('req'),
        courseId: course.id,
        studentId: auth.sub,
        studentName: me?.name ?? '',
        type: 'self_join',
        status: 'pending',
      },
    });
    res.json({ request: { ...request, courseCode: course.code, courseTitle: course.title } });
  })
);

coursesRouter.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Detail view needs the full row (image/syllabus included); the shared
    // loader above intentionally stays narrow for the hot access-check path.
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
    await assertCourseAccess(course, req.auth!);
    res.json({ course });
  })
);

const KNOWN_TERMS = ['prelim', 'midterm', 'finals'] as const;

const COURSE_PATCH_STRINGS = [
  'code',
  'title',
  'section',
  'term',
  'instructorName',
  'color',
  'image',
  'chedComplianceCode',
  'joinCode',
  'syllabus',
] as const;

coursesRouter.patch(
  '/:id',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (isOversizedDataUrl(body.image)) {
      throw new ApiError(413, 'image_too_large', 'Cover image must be uploaded as a file (/uploads/…) or an external URL, not an inlined data URL.');
    }
    const data: Record<string, string | boolean | number | null> = {};
    if (body.gradingTerms !== undefined) {
      if (body.gradingTerms !== null) {
        if (!Array.isArray(body.gradingTerms) || body.gradingTerms.some(t => typeof t !== 'string' || !(KNOWN_TERMS as readonly string[]).includes(t))) {
          throw new ApiError(400, 'bad_request', `Field 'gradingTerms' must be an array of prelim, midterm, finals.`);
        }
        data.gradingTerms = JSON.stringify([...new Set(body.gradingTerms)]);
      } else {
        data.gradingTerms = null;
      }
    }
    for (const key of COURSE_PATCH_STRINGS) {
      const value = body[key];
      if (value === undefined) continue;
      // `syllabus: null` is the CLEAR sentinel (sets the column NULL);
      // other non-string types still 400.
      if (key === 'syllabus' && value === null) {
        data[key] = null;
        continue;
      }
      if (typeof value !== 'string') {
        throw new ApiError(400, 'bad_request', `Field '${key}' must be a string.`);
      }
      data[key] = value;
    }
    if (typeof body.published === 'boolean') data.published = body.published;
    if (typeof body.credits === 'number') data.credits = body.credits;
    const updated = await prisma.course.update({ where: { id: course.id }, data });
    res.json({ course: updated });
  })
);

coursesRouter.patch(
  '/:id/grades-release',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    // Full row: need the current gradesReleased blob to merge one term.
    const row = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!row) throw new ApiError(404, 'not_found', 'Course not found.');
    assertCourseOwner(row, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.term !== 'string' || !(KNOWN_TERMS as readonly string[]).includes(body.term)) {
      throw new ApiError(400, 'bad_request', `Field 'term' must be one of prelim, midterm, finals.`);
    }
    if (typeof body.released !== 'boolean') {
      throw new ApiError(400, 'bad_request', `Field 'released' must be a boolean.`);
    }
    let merged: Record<string, boolean> = {};
    if (typeof row.gradesReleased === 'string' && row.gradesReleased) {
      try {
        const parsed: unknown = JSON.parse(row.gradesReleased);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if ((KNOWN_TERMS as readonly string[]).includes(k) && typeof v === 'boolean') {
              merged[k] = v;
            }
          }
        }
      } catch {
        merged = {};
      }
    }
    merged[body.term] = body.released;
    const updated = await prisma.course.update({
      where: { id: row.id },
      data: { gradesReleased: JSON.stringify(merged) },
    });
    res.json({ course: updated });
  })
);

coursesRouter.delete(
  '/:id',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);
    // Sections + enrollment requests cascade off the Course FK. Everything
    // else keys off a plain-string courseId, so clean it explicitly first.
    await prisma.$transaction([
      prisma.submission.deleteMany({ where: { courseId: course.id } }),
      prisma.quiz.deleteMany({ where: { courseId: course.id } }),
      prisma.activity.deleteMany({ where: { courseId: course.id } }),
      prisma.module.deleteMany({ where: { courseId: course.id } }),
      prisma.announcement.deleteMany({ where: { courseId: course.id } }),
      prisma.discussion.deleteMany({ where: { courseId: course.id } }),
      prisma.message.deleteMany({ where: { courseId: course.id } }),
      prisma.chatGroup.deleteMany({ where: { courseId: course.id } }),
      prisma.calendarEvent.deleteMany({ where: { courseId: course.id } }),
      prisma.courseFile.deleteMany({ where: { courseId: course.id } }),
      prisma.courseFolder.deleteMany({ where: { courseId: course.id } }),
      prisma.courseGrade.deleteMany({ where: { courseId: course.id } }),
      prisma.course.delete({ where: { id: course.id } }),
    ]);
    res.json({ ok: true });
  })
);

coursesRouter.get(
  '/:id/sections',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const course = await loadCourseOr404(req.params.id);
    await assertCourseAccess(course, req.auth!);
    const sections = await prisma.courseSection.findMany({ where: { courseId: course.id } });
    res.json({ sections });
  })
);

coursesRouter.post(
  '/:id/sections',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);
    const { name, capacity } = (req.body ?? {}) as { name?: unknown; capacity?: unknown };
    if (typeof name !== 'string' || !name) {
      throw new ApiError(400, 'bad_request', 'Field name is required.');
    }
    if (capacity !== undefined && typeof capacity !== 'number') {
      throw new ApiError(400, 'bad_request', 'Field capacity must be a number.');
    }
    const section = await prisma.courseSection.create({
      data: {
        id: newId('sec'),
        courseId: course.id,
        name,
        capacity: capacity ?? null,
        enrolledCount: 0,
      },
    });
    res.status(201).json({ section });
  })
);

async function loadSectionWithCourse(sectionId: string, auth: AuthPayload) {
  const section = await prisma.courseSection.findUnique({ where: { id: sectionId } });
  if (!section) throw new ApiError(404, 'not_found', 'Section not found.');
  const course = await prisma.course.findUnique({
    where: { id: section.courseId },
    select: { id: true, instructorId: true, published: true },
  });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  assertCourseOwner(course, auth);
  return { section, course };
}

const SECTION_PATCH_FIELDS = ['name', 'capacity', 'schedule', 'location'] as const;

sectionsRouter.patch(
  '/:sectionId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const { section } = await loadSectionWithCourse(req.params.sectionId, req.auth!);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, string | number | null> = {};
    for (const key of SECTION_PATCH_FIELDS) {
      const value = body[key];
      if (value === undefined) continue;
      if (key === 'capacity') {
        if (typeof value !== 'number') {
          throw new ApiError(400, 'bad_request', "Field 'capacity' must be a number.");
        }
        data.capacity = value;
      } else {
        if (typeof value !== 'string') {
          throw new ApiError(400, 'bad_request', `Field '${key}' must be a string.`);
        }
        data[key] = value;
      }
    }
    const updated = await prisma.courseSection.update({ where: { id: section.id }, data });
    res.json({ section: updated });
  })
);

sectionsRouter.delete(
  '/:sectionId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const { section } = await loadSectionWithCourse(req.params.sectionId, req.auth!);
    const inUse = await prisma.enrollmentRequest.findFirst({
      where: { targetSectionId: section.id, status: 'approved' },
    });
    if (inUse) {
      throw new ApiError(409, 'section_in_use', 'Section is assigned to enrolled students.');
    }
    await prisma.courseSection.delete({ where: { id: section.id } });
    res.json({ ok: true });
  })
);
