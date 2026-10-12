import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { getCourseById, getRequestsForCourse } from '../likha/repositories/coursesRepo.js';
import { getCourseSprConfig, saveCourseSprConfig, upsertCourseGrade } from '../likha/repositories/gradesRepo.js';

export const sprRouter = Router();

function parseScoreMap(value: unknown, field: string): Record<string, number | null> {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be an object.`);
  }
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== null && (typeof v !== 'number' || Number.isNaN(v) || v < 0)) {
      throw new ApiError(400, 'bad_request', `Field '${field}.${k}' must be a non-negative number or null.`);
    }
    out[k] = v as number | null;
  }
  return out;
}

function parseExam(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be a non-negative number or null.`);
  }
  return value;
}

async function loadCourseOwnerOr404(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });
  if (course) return course;

  try {
    const likhaCourse = await getCourseById(courseId);
    if (likhaCourse) {
      return { id: likhaCourse.id, instructorId: likhaCourse.instructorId };
    }
  } catch {
    // ignore
  }

  throw new ApiError(404, 'not_found', 'Course not found.');
}

sprRouter.get(
  '/courses/:id/spr',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      select: { id: true, sprConfig: true },
    });
    if (course) {
      res.json({ config: course.sprConfig ? JSON.parse(course.sprConfig) : null });
      return;
    }

    try {
      const likhaCourse = await getCourseById(req.params.id);
      if (likhaCourse) {
        const config = await getCourseSprConfig(likhaCourse.id);
        res.json({ config });
        return;
      }
    } catch {
      // ignore
    }

    throw new ApiError(404, 'not_found', 'Course not found.');
  })
);

sprRouter.put(
  '/courses/:id/spr',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadCourseOwnerOr404(req.params.id);
    if (req.auth!.role !== 'admin' && course.instructorId !== req.auth!.sub) {
      throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
    }
    const config = (req.body ?? {}).config;
    if (!config || typeof config !== 'object') {
      throw new ApiError(400, 'bad_request', "Field 'config' is required.");
    }
    const updated = await saveCourseSprConfig(course.id, config);
    res.json({ config: updated });
  })
);

sprRouter.put(
  '/courses/:id/spr/:studentId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadCourseOwnerOr404(req.params.id);
    if (req.auth!.role !== 'admin' && course.instructorId !== req.auth!.sub) {
      throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const studentId = req.params.studentId;

    let isMember = false;
    const membership = await prisma.enrollmentRequest.findFirst({
      where: { courseId: course.id, studentId, status: 'approved' },
    });
    if (membership) {
      isMember = true;
    } else {
      try {
        const likhaReqs = await getRequestsForCourse(course.id);
        const found = likhaReqs.find((r: any) => r.studentId === studentId && r.status === 'approved');
        if (found) isMember = true;
      } catch {
        // ignore
      }
    }

    if (!isMember) {
      throw new ApiError(403, 'forbidden', 'Student is not enrolled in this course.');
    }

    const cells = {
      midtermScores: parseScoreMap(body.midtermScores, 'midtermScores'),
      mtExam: parseExam(body.mtExam, 'mtExam'),
      finalScores: parseScoreMap(body.finalScores, 'finalScores'),
      ftExam: parseExam(body.ftExam, 'ftExam'),
    };

    const grade = await upsertCourseGrade(course.id, studentId, { sprCells: cells });
    res.json({ cells: typeof grade.sprCells === 'string' ? JSON.parse(grade.sprCells) : grade.sprCells });
  })
);
