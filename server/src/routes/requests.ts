import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

export const requestsRouter = Router();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadCourseOr404(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  return course;
}

function assertCourseOwner(course: { instructorId: string }, auth: AuthPayload): void {
  if (auth.role !== 'admin' && course.instructorId !== auth.sub) {
    throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
  }
}

async function loadRequestOr404(requestId: string) {
  const request = await prisma.enrollmentRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ApiError(404, 'not_found', 'Request not found.');
  return request;
}

requestsRouter.get(
  '/courses/:id/requests',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, req.auth!);
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    const requests = await prisma.enrollmentRequest.findMany({
      where: { courseId: course.id, status },
    });
    res.json({ requests });
  })
);

requestsRouter.post(
  '/courses/:id/invites',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);
    const { studentId } = (req.body ?? {}) as { studentId?: unknown };
    if (typeof studentId !== 'string' || !studentId) {
      throw new ApiError(400, 'bad_request', 'Field studentId is required.');
    }
    const existing = await prisma.enrollmentRequest.findFirst({
      where: { courseId: course.id, studentId, status: 'pending' },
    });
    if (existing) {
      res.json({ request: existing });
      return;
    }
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    const request = await prisma.enrollmentRequest.create({
      data: {
        id: newId('req'),
        courseId: course.id,
        studentId,
        studentName: student?.name ?? '',
        type: 'faculty_enroll',
        status: 'pending',
      },
    });
    res.status(201).json({ request });
  })
);

requestsRouter.post(
  '/requests/:requestId/approve',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const enrollment = await loadRequestOr404(req.params.requestId);
    const course = await loadCourseOr404(enrollment.courseId);
    assertCourseOwner(course, auth);
    if (enrollment.studentId === auth.sub) {
      throw new ApiError(403, 'forbidden', 'You cannot approve your own request.');
    }
    const request = await prisma.enrollmentRequest.update({
      where: { id: enrollment.id },
      data: { status: 'approved', resolvedAt: new Date(), resolvedBy: auth.sub },
    });
    const actor = await prisma.user.findUnique({ where: { id: auth.sub } });
    await createNotification({
      type: 'request_approved',
      recipientId: enrollment.studentId,
      actorId: auth.sub,
      actorName: actor?.name ?? '',
      actorAvatar: actor?.avatar ?? '',
      relatedId: course.id,
      relatedTitle: course.title,
      content: `Your request to join ${course.title} was approved.`,
    });
    res.json({ request });
  })
);

requestsRouter.post(
  '/requests/:requestId/reject',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const enrollment = await loadRequestOr404(req.params.requestId);
    const course = await loadCourseOr404(enrollment.courseId);
    assertCourseOwner(course, auth);
    if (enrollment.studentId === auth.sub) {
      throw new ApiError(403, 'forbidden', 'You cannot reject your own request.');
    }
    const request = await prisma.enrollmentRequest.update({
      where: { id: enrollment.id },
      data: { status: 'rejected', resolvedAt: new Date(), resolvedBy: auth.sub },
    });
    res.json({ request });
  })
);

requestsRouter.post(
  '/requests/:requestId/accept',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const enrollment = await loadRequestOr404(req.params.requestId);
    if (enrollment.studentId !== auth.sub) {
      throw new ApiError(403, 'forbidden', 'Only the invited student can accept this invite.');
    }
    const request = await prisma.enrollmentRequest.update({
      where: { id: enrollment.id },
      data: { status: 'approved', resolvedAt: new Date(), resolvedBy: auth.sub },
    });
    res.json({ request });
  })
);

requestsRouter.post(
  '/requests/:requestId/decline',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const enrollment = await loadRequestOr404(req.params.requestId);
    if (enrollment.studentId !== auth.sub) {
      throw new ApiError(403, 'forbidden', 'Only the invited student can decline this invite.');
    }
    await prisma.enrollmentRequest.delete({ where: { id: enrollment.id } });
    res.json({ ok: true });
  })
);

requestsRouter.post(
  '/courses/:id/choose-section',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    const { sectionId } = (req.body ?? {}) as { sectionId?: unknown };
    if (typeof sectionId !== 'string' || !sectionId) {
      throw new ApiError(400, 'bad_request', 'Field sectionId is required.');
    }
    const membership = await prisma.enrollmentRequest.findFirst({
      where: { courseId: course.id, studentId: auth.sub, status: 'approved' },
    });
    if (!membership) {
      throw new ApiError(403, 'forbidden', 'Only enrolled students can choose a section.');
    }
    const section = await prisma.courseSection.findUnique({ where: { id: sectionId } });
    if (!section || section.courseId !== course.id) {
      throw new ApiError(400, 'bad_request', 'Section does not belong to this course.');
    }
    if (section.capacity != null && section.enrolledCount >= section.capacity) {
      throw new ApiError(409, 'section_full', 'Section has reached capacity.');
    }
    const request = await prisma.enrollmentRequest.update({
      where: { id: membership.id },
      data: { targetSectionId: section.id },
    });
    await prisma.courseSection.update({
      where: { id: section.id },
      data: { enrolledCount: { increment: 1 } },
    });
    res.json({ request });
  })
);

requestsRouter.post(
  '/courses/:id/switch-section',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    const { sectionId } = (req.body ?? {}) as { sectionId?: unknown };
    if (typeof sectionId !== 'string' || !sectionId) {
      throw new ApiError(400, 'bad_request', 'Field sectionId is required.');
    }
    const section = await prisma.courseSection.findUnique({ where: { id: sectionId } });
    if (!section || section.courseId !== course.id) {
      throw new ApiError(400, 'bad_request', 'Section does not belong to this course.');
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const request = await prisma.enrollmentRequest.create({
      data: {
        id: newId('req'),
        courseId: course.id,
        studentId: auth.sub,
        studentName: me?.name ?? '',
        type: 'section_switch',
        status: 'pending',
        targetSectionId: section.id,
      },
    });
    res.status(201).json({ request });
  })
);
