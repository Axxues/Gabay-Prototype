import { prisma } from '../db.js';
import { ApiError } from './errors.js';
import type { AuthPayload } from '../middleware/auth.js';

export interface CourseRow {
  id: string;
  instructorId: string;
  published: boolean;
}

export async function loadCourseOr404(courseId: string): Promise<CourseRow> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true, published: true },
  });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  return course;
}

export async function assertCourseAccess(course: CourseRow, auth: AuthPayload): Promise<void> {
  if (auth.role === 'faculty' || auth.role === 'admin') return;
  if (course.instructorId === auth.sub) return;
  const membership = await prisma.enrollmentRequest.findFirst({
    where: { courseId: course.id, studentId: auth.sub, status: 'approved' },
  });
  if (!membership) throw new ApiError(403, 'forbidden', 'You are not a member of this course.');
}

export function assertCourseOwner(course: { instructorId: string }, auth: AuthPayload): void {
  if (auth.role !== 'admin' && course.instructorId !== auth.sub) {
    throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
  }
}
