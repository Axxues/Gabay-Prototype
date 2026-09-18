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
  // Narrow select: this file needs id/instructorId (access checks) plus
  // title (approval notifications). A full row drag would pull the
  // multi-MB image/syllabus blobs on every course-scoped call.
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true, title: true },
  });
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

// Enrollment rows carry no course snapshot, and students only cache
// enrolled courses — so a pending request's course is unresolvable
// client-side (dashboard renders "—"). Attach code/title at read time so
// payloads are self-describing; read-time attach also covers old rows.
async function withCourseSnapshot<T extends { courseId: string }>(rows: T[]) {
  const withNulls = (r: T) => ({ ...r, courseCode: null as string | null, courseTitle: null as string | null });
  if (rows.length === 0) return rows.map(withNulls);
  const ids = [...new Set(rows.map(r => r.courseId))];
  const courses = await prisma.course.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, title: true },
  });
  const byId = new Map(courses.map(c => [c.id, c]));
  return rows.map(r => ({
    ...r,
    courseCode: byId.get(r.courseId)?.code ?? null,
    courseTitle: byId.get(r.courseId)?.title ?? null,
  }));
}

requestsRouter.get(
  '/requests/mine',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const requests = await prisma.enrollmentRequest.findMany({
      where: { studentId: req.auth!.sub },
      orderBy: { requestedAt: 'desc' },
    });
    res.json({ requests: await withCourseSnapshot(requests) });
  })
);

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
    res.json({ requests: await withCourseSnapshot(requests) });
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
    // Idempotency is scoped to invitations only: a pending self_join (or
    // switch) request is a different request, not a duplicate invite.
    const existing = await prisma.enrollmentRequest.findFirst({
      where: { courseId: course.id, studentId, status: 'pending', type: 'faculty_enroll' },
    });
    if (existing) {
      res.json({ request: { ...existing, courseCode: course.code, courseTitle: course.title } });
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
    res.status(201).json({ request: { ...request, courseCode: course.code, courseTitle: course.title } });
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
    // Faculty invitations are accepted by the invited student (POST /accept),
    // never approved by faculty — the student must consent to enrollment.
    if (enrollment.type === 'faculty_enroll') {
      throw new ApiError(403, 'forbidden', 'Only the invited student can accept this invitation.');
    }
    if (enrollment.status !== 'pending') {
      throw new ApiError(409, 'conflict', 'Only pending requests can be approved.');
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
    if (enrollment.status !== 'pending') {
      throw new ApiError(409, 'conflict', 'Only pending requests can be rejected.');
    }
    const request = await prisma.enrollmentRequest.update({
      where: { id: enrollment.id },
      data: { status: 'rejected', resolvedAt: new Date(), resolvedBy: auth.sub },
    });
    res.json({ request });
  })
);

requestsRouter.post(
  '/courses/:id/remove-student',
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
    if (studentId === auth.sub) {
      throw new ApiError(403, 'forbidden', 'You cannot remove yourself from the course.');
    }
    const approved = await prisma.enrollmentRequest.findMany({
      where: { courseId: course.id, studentId, status: 'approved' },
    });
    if (approved.length === 0) {
      throw new ApiError(404, 'not_enrolled', 'Student is not enrolled in this course.');
    }
    // Free section slots held by the removed membership rows. Coursework
    // (submissions, grades) is intentionally left intact.
    const sectionIds = [
      ...new Set(
        approved
          .map(r => r.targetSectionId)
          .filter((s): s is string => typeof s === 'string' && !!s),
      ),
    ];
    for (const sectionId of sectionIds) {
      const section = await prisma.courseSection.findUnique({ where: { id: sectionId } });
      if (section && section.courseId === course.id && section.enrolledCount > 0) {
        await prisma.courseSection.update({
          where: { id: section.id },
          data: { enrolledCount: { decrement: 1 } },
        });
      }
    }
    const result = await prisma.enrollmentRequest.deleteMany({
      where: { courseId: course.id, studentId, status: 'approved' },
    });
    const actor = await prisma.user.findUnique({ where: { id: auth.sub } });
    await createNotification({
      type: 'removed_from_course',
      recipientId: studentId,
      actorId: auth.sub,
      actorName: actor?.name ?? '',
      actorAvatar: actor?.avatar ?? '',
      relatedId: course.id,
      relatedTitle: course.title,
      content: `You were removed from ${course.title}.`,
    });
    res.json({ removed: result.count });
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
    // Invitations (faculty_enroll) are accepted by the student; join and
    // switch requests require faculty approval and can never be self-accepted.
    if (enrollment.type !== 'faculty_enroll') {
      throw new ApiError(403, 'forbidden', 'Only pending faculty invitations can be accepted.');
    }
    if (enrollment.status !== 'pending') {
      throw new ApiError(409, 'conflict', 'Only pending invitations can be accepted.');
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
    // Faculty/admin pick sections without an approved membership row
    // (students still require one).
    const bypass = !membership && (auth.role === 'faculty' || auth.role === 'admin');
    if (!membership && !bypass) {
      throw new ApiError(403, 'forbidden', 'Only enrolled students can choose a section.');
    }
    const section = await prisma.courseSection.findUnique({ where: { id: sectionId } });
    if (!section || section.courseId !== course.id) {
      throw new ApiError(400, 'bad_request', 'Section does not belong to this course.');
    }
    if (section.capacity != null && section.enrolledCount >= section.capacity) {
      throw new ApiError(409, 'section_full', 'Section has reached capacity.');
    }
    if (bypass) {
      const me = await prisma.user.findUnique({ where: { id: auth.sub } });
      const request = await prisma.enrollmentRequest.create({
        data: {
          id: newId('req'),
          courseId: course.id,
          studentId: auth.sub,
          studentName: me?.name ?? '',
          type: 'faculty_enroll',
          status: 'approved',
          targetSectionId: section.id,
        },
      });
      await prisma.courseSection.update({
        where: { id: section.id },
        data: { enrolledCount: { increment: 1 } },
      });
      res.json({ request });
      return;
    }
    const request = await prisma.enrollmentRequest.update({
      where: { id: membership!.id },
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
