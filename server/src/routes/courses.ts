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

interface CourseRow {
  id: string;
  instructorId: string;
  published: boolean;
}

async function loadCourseOr404(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
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
    const course = await prisma.course.create({
      data: {
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
        joinCode: str(body.joinCode) ?? null,
        syllabus: str(body.syllabus) ?? null,
      },
    });
    res.status(201).json({ course });
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
      res.json({ request: existing });
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
    res.json({ request });
  })
);

coursesRouter.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const course = await loadCourseOr404(req.params.id);
    await assertCourseAccess(course, req.auth!);
    res.json({ course });
  })
);

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
    const data: Record<string, string | boolean | number | null> = {};
    for (const key of COURSE_PATCH_STRINGS) {
      const value = body[key];
      if (value === undefined) continue;
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
  const course = await prisma.course.findUnique({ where: { id: section.courseId } });
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
