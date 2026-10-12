import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';
import { getCourseById, getRequestsForCourse } from '../likha/repositories/coursesRepo.js';
import { getCourseGrades, upsertCourseGrade } from '../likha/repositories/gradesRepo.js';

export const gradesRouter = Router();

interface CourseRow {
  id: string;
  instructorId: string;
}

async function loadCourseOr404(courseId: string): Promise<CourseRow> {
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
  } catch (err) {
    // ignore
  }

  throw new ApiError(404, 'not_found', 'Course not found.');
}

async function assertCourseAccess(course: CourseRow, auth: AuthPayload): Promise<void> {
  if (auth.role === 'faculty' || auth.role === 'admin') return;
  if (course.instructorId === auth.sub) return;

  const membership = await prisma.enrollmentRequest.findFirst({
    where: { courseId: course.id, studentId: auth.sub, status: 'approved' },
  });
  if (membership) return;

  try {
    const likhaReqs = await getRequestsForCourse(course.id);
    const found = likhaReqs.find((r: any) => r.studentId === auth.sub && r.status === 'approved');
    if (found) return;
  } catch {
    // ignore
  }

  throw new ApiError(403, 'forbidden', 'You are not a member of this course.');
}

function assertCourseOwner(course: { instructorId: string }, auth: AuthPayload): void {
  if (auth.role !== 'admin' && course.instructorId !== auth.sub) {
    throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
  }
}

function parseGrade(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ApiError(400, 'bad_request', `Field ${field} must be a number or null.`);
  }
  return value;
}

// GET /api/courses/:id/grades (faculty: all rows; student: own row only;
// ?studentId= narrows; a student asking for another student gets 403)
gradesRouter.get(
  '/courses/:id/grades',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    await assertCourseAccess(course, auth);
    const q = req.query.studentId;
    const wanted = typeof q === 'string' && q ? q : null;

    if (auth.role === 'faculty' || auth.role === 'admin') {
      const grades = await getCourseGrades(course.id, wanted);
      res.json({ grades });
      return;
    }

    if (wanted && wanted !== auth.sub) {
      throw new ApiError(403, 'forbidden', 'You can only view your own grades.');
    }

    const grades = await getCourseGrades(course.id, auth.sub);
    res.json({ grades });
  })
);

// PUT /api/courses/:id/grades/:studentId (faculty; upsert midterm/final)
gradesRouter.put(
  '/courses/:id/grades/:studentId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const midtermGrade = parseGrade(body.midtermGrade, 'midtermGrade');
    const finalGrade = parseGrade(body.finalGrade, 'finalGrade');
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

    const grade = await upsertCourseGrade(course.id, studentId, {
      ...(midtermGrade !== undefined ? { midtermGrade } : {}),
      ...(finalGrade !== undefined ? { finalGrade } : {}),
    });

    res.json({ grade });
  })
);
