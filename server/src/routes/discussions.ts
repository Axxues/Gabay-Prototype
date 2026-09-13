import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

export const discussionsRouter = Router();

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

async function loadDiscussionOr404(discussionId: string) {
  const discussion = await prisma.discussion.findUnique({
    where: { id: discussionId },
    include: { replies: { include: { likedBy: true } } },
  });
  if (!discussion) throw new ApiError(404, 'not_found', 'Discussion not found.');
  return discussion;
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

function mapDiscussion<
  T extends { replies: Array<{ likedBy: Array<{ userId: string }> }> }
>(d: T) {
  return {
    ...d,
    replies: d.replies.map((r) => ({ ...r, likedBy: r.likedBy.map((l) => l.userId) })),
  };
}

discussionsRouter.get(
  '/courses/:id/discussions',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const course = await loadCourseOr404(req.params.id);
    await assertCourseAccess(course, req.auth!);
    const discussions = await prisma.discussion.findMany({
      where: { courseId: course.id },
      include: { replies: { include: { likedBy: true } } },
    });
    res.json({ discussions: discussions.map(mapDiscussion) });
  })
);

discussionsRouter.post(
  '/courses/:id/discussions',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { title, prompt } = body;
    if (typeof title !== 'string' || !title.trim()) {
      throw new ApiError(400, 'bad_request', 'Field title is required.');
    }
    if (typeof prompt !== 'string' || !prompt.trim()) {
      throw new ApiError(400, 'bad_request', 'Field prompt is required.');
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const discussion = await prisma.discussion.create({
      data: {
        id: newId('dis'),
        courseId: course.id,
        title: title.trim(),
        prompt: prompt.trim(),
        authorId: auth.sub,
        authorName: me?.name ?? '',
        authorAvatar: me?.avatar ?? '',
        authorRole: auth.role,
      },
    });
    res.status(201).json({ discussion: { ...discussion, replies: [] } });
  })
);

discussionsRouter.post(
  '/discussions/:id/replies',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const discussion = await loadDiscussionOr404(req.params.id);
    const course = await loadCourseOr404(discussion.courseId);
    await assertCourseAccess(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { content } = body;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError(400, 'bad_request', 'Field content is required.');
    }
    if (body.parentId !== undefined && body.parentId !== null && typeof body.parentId !== 'string') {
      throw new ApiError(400, 'bad_request', 'Field parentId must be a string.');
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const reply = await prisma.discussionReply.create({
      data: {
        id: newId('disreply'),
        discussionId: discussion.id,
        parentId: typeof body.parentId === 'string' ? body.parentId : null,
        authorId: auth.sub,
        authorName: me?.name ?? '',
        authorAvatar: me?.avatar ?? '',
        authorRole: auth.role,
        content: (content as string).trim(),
      },
    });
    // Notify the discussion author, never self.
    if (discussion.authorId !== auth.sub) {
      await createNotification({
        type: 'discussion_reply',
        recipientId: discussion.authorId,
        actorId: auth.sub,
        actorName: me?.name ?? '',
        actorAvatar: me?.avatar ?? '',
        relatedId: discussion.id,
        relatedTitle: discussion.title,
        content: (content as string).trim(),
      });
    }
    res.status(201).json({ reply: { ...reply, likedBy: [] as string[] } });
  })
);

discussionsRouter.post(
  '/discussions/:id/replies/:replyId/like',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const discussion = await loadDiscussionOr404(req.params.id);
    const course = await loadCourseOr404(discussion.courseId);
    await assertCourseAccess(course, auth);
    const reply = await prisma.discussionReply.findUnique({ where: { id: req.params.replyId } });
    if (!reply || reply.discussionId !== discussion.id) {
      throw new ApiError(404, 'not_found', 'Reply not found.');
    }
    const existing = await prisma.discussionReplyLike.findFirst({
      where: { replyId: reply.id, userId: auth.sub },
    });
    let liked: boolean;
    if (existing) {
      await prisma.discussionReplyLike.delete({
        where: { replyId_userId: { replyId: reply.id, userId: auth.sub } },
      });
      liked = false;
    } else {
      await prisma.discussionReplyLike.create({
        data: { replyId: reply.id, userId: auth.sub },
      });
      liked = true;
    }
    const likes = await prisma.discussionReplyLike.count({ where: { replyId: reply.id } });
    const updated = await prisma.discussionReply.update({
      where: { id: reply.id },
      data: { likes },
    });
    res.json({ reply: updated, likes, liked });
  })
);

discussionsRouter.patch(
  '/discussions/:id',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const discussion = await loadDiscussionOr404(req.params.id);
    const course = await loadCourseOr404(discussion.courseId);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, boolean> = {};
    for (const key of ['locked', 'pinned'] as const) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== 'boolean') {
        throw new ApiError(400, 'bad_request', `Field '${key}' must be a boolean.`);
      }
      data[key] = body[key] as boolean;
    }
    const updated = await prisma.discussion.update({ where: { id: discussion.id }, data });
    res.json({ discussion: updated });
  })
);

discussionsRouter.delete(
  '/discussions/:id',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const discussion = await loadDiscussionOr404(req.params.id);
    const course = await loadCourseOr404(discussion.courseId);
    assertCourseOwner(course, auth);
    // Replies cascade via the schema (onDelete: Cascade).
    await prisma.discussion.delete({ where: { id: discussion.id } });
    res.json({ ok: true });
  })
);
