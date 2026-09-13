import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { parseJsonField, stringifyJsonField } from '../utils/jsonFields.js';

export const assignmentsRouter = Router();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface CourseRow {
  id: string;
  instructorId: string;
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

function mapAssignment<T extends { submissionTypes: string; rubric: string }>(a: T) {
  return {
    ...a,
    submissionTypes: parseJsonField<unknown[]>(a.submissionTypes, []),
    rubric: parseJsonField<unknown[]>(a.rubric, []),
  };
}

function mapSubmission<T extends { rubricScores: string }>(s: T) {
  return { ...s, rubricScores: parseJsonField<Record<string, number>>(s.rubricScores, {}) };
}

async function loadAssignmentOr404(assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ApiError(404, 'not_found', 'Assignment not found.');
  return assignment;
}

assignmentsRouter.get(
  '/courses/:id/assignments',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const course = await loadCourseOr404(req.params.id);
    await assertCourseAccess(course, req.auth!);
    const assignments = await prisma.assignment.findMany({ where: { courseId: course.id } });
    res.json({ assignments: assignments.map(mapAssignment) });
  })
);

assignmentsRouter.post(
  '/courses/:id/assignments',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { title, instructions, pointsPossible, dueDate } = body;
    if (typeof title !== 'string' || !title) {
      throw new ApiError(400, 'bad_request', 'Field title is required.');
    }
    if (typeof instructions !== 'string' || !instructions) {
      throw new ApiError(400, 'bad_request', 'Field instructions is required.');
    }
    if (typeof pointsPossible !== 'number') {
      throw new ApiError(400, 'bad_request', 'Field pointsPossible must be a number.');
    }
    const due = dueDate instanceof Date ? dueDate : typeof dueDate === 'string' ? new Date(dueDate) : null;
    if (!due || isNaN(due.getTime())) {
      throw new ApiError(400, 'bad_request', 'Field dueDate must be a valid date.');
    }
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const assignment = await prisma.assignment.create({
      data: {
        id: newId('asg'),
        courseId: course.id,
        title,
        instructions,
        pointsPossible,
        dueDate: due,
        submissionTypes: stringifyJsonField(
          Array.isArray(body.submissionTypes) ? body.submissionTypes : []
        ),
        published: typeof body.published === 'boolean' ? body.published : false,
        category: str(body.category) ?? '',
        weight: typeof body.weight === 'number' ? body.weight : 0,
        rubric: stringifyJsonField(Array.isArray(body.rubric) ? body.rubric : []),
        fileName: str(body.fileName) ?? null,
        fileUrl: str(body.fileUrl) ?? null,
        fileSize: str(body.fileSize) ?? null,
        availableFrom: str(body.availableFrom) ? new Date(str(body.availableFrom)!) : null,
        availableUntil: str(body.availableUntil) ? new Date(str(body.availableUntil)!) : null,
        sectionRestriction: str(body.sectionRestriction) ?? null,
      },
    });
    res.status(201).json({ assignment: mapAssignment(assignment) });
  })
);

const ASSIGNMENT_PATCH_STRINGS = [
  'title',
  'instructions',
  'category',
  'fileName',
  'fileUrl',
  'fileSize',
  'sectionRestriction',
] as const;

assignmentsRouter.patch(
  '/assignments/:assignmentId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const assignment = await loadAssignmentOr404(req.params.assignmentId);
    const course = await loadCourseOr404(assignment.courseId);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, string | boolean | number | Date | null> = {};
    for (const key of ASSIGNMENT_PATCH_STRINGS) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        throw new ApiError(400, 'bad_request', `Field '${key}' must be a string.`);
      }
      data[key] = value;
    }
    if (body.pointsPossible !== undefined) {
      if (typeof body.pointsPossible !== 'number') {
        throw new ApiError(400, 'bad_request', "Field 'pointsPossible' must be a number.");
      }
      data.pointsPossible = body.pointsPossible;
    }
    if (body.weight !== undefined) {
      if (typeof body.weight !== 'number') {
        throw new ApiError(400, 'bad_request', "Field 'weight' must be a number.");
      }
      data.weight = body.weight;
    }
    if (body.published !== undefined) {
      if (typeof body.published !== 'boolean') {
        throw new ApiError(400, 'bad_request', "Field 'published' must be a boolean.");
      }
      data.published = body.published;
    }
    if (body.submissionTypes !== undefined) {
      if (!Array.isArray(body.submissionTypes)) {
        throw new ApiError(400, 'bad_request', "Field 'submissionTypes' must be an array.");
      }
      data.submissionTypes = stringifyJsonField(body.submissionTypes);
    }
    if (body.rubric !== undefined) {
      if (!Array.isArray(body.rubric)) {
        throw new ApiError(400, 'bad_request', "Field 'rubric' must be an array.");
      }
      data.rubric = stringifyJsonField(body.rubric);
    }
    for (const key of ['dueDate', 'availableFrom', 'availableUntil'] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        throw new ApiError(400, 'bad_request', `Field '${key}' must be a date string.`);
      }
      data[key] = new Date(value);
    }
    const updated = await prisma.assignment.update({ where: { id: assignment.id }, data });
    res.json({ assignment: mapAssignment(updated) });
  })
);

assignmentsRouter.delete(
  '/assignments/:assignmentId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const assignment = await loadAssignmentOr404(req.params.assignmentId);
    const course = await loadCourseOr404(assignment.courseId);
    assertCourseOwner(course, auth);
    await prisma.assignment.delete({ where: { id: assignment.id } });
    res.json({ ok: true });
  })
);

assignmentsRouter.get(
  '/assignments/:id/submissions',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const assignment = await loadAssignmentOr404(req.params.id);
    const course = await loadCourseOr404(assignment.courseId);
    if (auth.role === 'faculty' || auth.role === 'admin') {
      assertCourseOwner(course, auth);
      const submissions = await prisma.submission.findMany({
        where: { assignmentId: assignment.id },
        include: { comments: true },
      });
      res.json({ submissions: submissions.map(mapSubmission) });
      return;
    }
    await assertCourseAccess(course, auth);
    const submissions = await prisma.submission.findMany({
      where: { assignmentId: assignment.id, studentId: auth.sub },
      include: { comments: true },
    });
    res.json({ submissions: submissions.map(mapSubmission) });
  })
);

assignmentsRouter.post(
  '/assignments/:id/submissions',
  authenticateToken,
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const assignment = await loadAssignmentOr404(req.params.id);
    const course = await loadCourseOr404(assignment.courseId);
    await assertCourseAccess(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const content =
      str(body.content) ??
      (body.answers !== undefined ? stringifyJsonField(body.answers) : undefined) ??
      null;
    const submissionType =
      str(body.submissionType) ?? (body.fileUrl || body.fileName ? 'file' : 'online_text');
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const existing = await prisma.submission.findFirst({
      where: { assignmentId: assignment.id, studentId: auth.sub },
    });
    // Scoring stays client-side per current design — compute nothing here.
    const submission = existing
      ? await prisma.submission.update({
          where: { id: existing.id },
          data: {
            submissionType,
            content,
            fileUrl: str(body.fileUrl) ?? null,
            fileName: str(body.fileName) ?? null,
            status: 'submitted',
            submittedAt: new Date(),
          },
        })
      : await prisma.submission.create({
          data: {
            id: newId('sub'),
            assignmentId: assignment.id,
            courseId: course.id,
            studentId: auth.sub,
            studentName: me?.name ?? '',
            studentAvatar: me?.avatar ?? '',
            submissionType,
            content,
            fileUrl: str(body.fileUrl) ?? null,
            fileName: str(body.fileName) ?? null,
            status: 'submitted',
            rubricScores: stringifyJsonField({}),
          },
        });
    await createNotification({
      type: 'assignment_submitted',
      recipientId: course.instructorId,
      actorId: auth.sub,
      actorName: me?.name ?? '',
      actorAvatar: me?.avatar ?? '',
      relatedId: assignment.id,
      relatedTitle: assignment.title,
      content: `${me?.name ?? 'A student'} submitted ${assignment.title}.`,
    });
    res.status(201).json({ submission: mapSubmission(submission) });
  })
);

assignmentsRouter.post(
  '/submissions/:submissionId/grade',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.submissionId },
    });
    if (!submission) throw new ApiError(404, 'not_found', 'Submission not found.');
    // Quiz/activity submissions carry the synthetic asg-quiz-*/asg-activity-*
    // assignmentId (no real Assignment row) — resolve ownership through the
    // quiz/activity course instead.
    let relatedId: string;
    let relatedTitle: string;
    let course;
    if (submission.quizId) {
      const quiz = await prisma.quiz.findUnique({ where: { id: submission.quizId } });
      if (!quiz) throw new ApiError(404, 'not_found', 'Quiz not found.');
      course = await loadCourseOr404(quiz.courseId);
      assertCourseOwner(course, auth);
      relatedId = quiz.id;
      relatedTitle = quiz.title;
    } else if (submission.activityId) {
      const activity = await prisma.activity.findUnique({
        where: { id: submission.activityId },
      });
      if (!activity) throw new ApiError(404, 'not_found', 'Activity not found.');
      course = await loadCourseOr404(activity.courseId);
      assertCourseOwner(course, auth);
      relatedId = activity.id;
      relatedTitle = activity.title;
    } else {
      if (!submission.assignmentId) throw new ApiError(404, 'not_found', 'Assignment not found.');
      const assignment = await loadAssignmentOr404(submission.assignmentId);
      course = await loadCourseOr404(assignment.courseId);
      assertCourseOwner(course, auth);
      relatedId = assignment.id;
      relatedTitle = assignment.title;
    }
    const { grade, feedback } = (req.body ?? {}) as { grade?: unknown; feedback?: unknown };
    if (typeof grade !== 'number') {
      throw new ApiError(400, 'bad_request', 'Field grade must be a number.');
    }
    if (feedback !== undefined && typeof feedback !== 'string') {
      throw new ApiError(400, 'bad_request', 'Field feedback must be a string.');
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const graded = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        grade,
        status: 'graded',
        gradedAt: new Date(),
        gradedBy: me?.name ?? auth.sub,
      },
    });
    if (feedback && feedback.trim()) {
      await prisma.submissionComment.create({
        data: {
          id: newId('sc'),
          submissionId: submission.id,
          authorId: auth.sub,
          authorName: me?.name ?? '',
          authorRole: auth.role,
          text: feedback.trim(),
        },
      });
    }
    await createNotification({
      type: 'grade_posted',
      recipientId: submission.studentId,
      actorId: auth.sub,
      actorName: me?.name ?? '',
      actorAvatar: me?.avatar ?? '',
      relatedId,
      relatedTitle,
      content: feedback && feedback.trim() ? feedback.trim() : `Your submission for ${relatedTitle} was graded.`,
    });
    res.json({ submission: mapSubmission(graded) });
  })
);

assignmentsRouter.post(
  '/submissions/:submissionId/comments',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.submissionId },
    });
    if (!submission) throw new ApiError(404, 'not_found', 'Submission not found.');
    // Same synthetic-aware resolution as the grade path: quiz/activity
    // submissions resolve their course through the quiz/activity row.
    let course;
    if (submission.quizId) {
      const quiz = await prisma.quiz.findUnique({ where: { id: submission.quizId } });
      if (!quiz) throw new ApiError(404, 'not_found', 'Quiz not found.');
      course = await loadCourseOr404(quiz.courseId);
    } else if (submission.activityId) {
      const activity = await prisma.activity.findUnique({
        where: { id: submission.activityId },
      });
      if (!activity) throw new ApiError(404, 'not_found', 'Activity not found.');
      course = await loadCourseOr404(activity.courseId);
    } else {
      if (!submission.assignmentId) throw new ApiError(404, 'not_found', 'Assignment not found.');
      const assignment = await loadAssignmentOr404(submission.assignmentId);
      course = await loadCourseOr404(assignment.courseId);
    }
    if (auth.role === 'faculty' || auth.role === 'admin') {
      assertCourseOwner(course, auth);
    } else {
      await assertCourseAccess(course, auth);
      if (submission.studentId !== auth.sub) {
        throw new ApiError(403, 'forbidden', 'You can only comment on your own submission.');
      }
    }
    const { text } = (req.body ?? {}) as { text?: unknown };
    if (typeof text !== 'string' || !text.trim()) {
      throw new ApiError(400, 'bad_request', 'Field text is required.');
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const comment = await prisma.submissionComment.create({
      data: {
        id: newId('sc'),
        submissionId: submission.id,
        authorId: auth.sub,
        authorName: me?.name ?? '',
        authorRole: auth.role,
        text: text.trim(),
      },
    });
    res.status(201).json({ comment });
  })
);
