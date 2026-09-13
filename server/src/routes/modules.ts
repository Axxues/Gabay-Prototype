import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { dedupeFileName } from '../utils/names.js';

export const modulesRouter = Router();

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

async function loadModuleOr404(moduleId: string) {
  const mod = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!mod) throw new ApiError(404, 'not_found', 'Module not found.');
  return mod;
}

function mapComment<T extends { likedBy: Array<{ userId: string }> }>(c: T) {
  return { ...c, likedBy: c.likedBy.map((l) => l.userId) };
}

// Port of the client's resolveModuleReplyRecipient rule verbatim:
// scan comments desc, first authorId !== caller, else module authorId, else skip.
function resolveModuleReplyRecipient(
  comments: Array<{ authorId: string }>,
  callerId: string,
  moduleAuthorId: string | null | undefined
): string | null {
  for (let i = comments.length - 1; i >= 0; i--) {
    const priorId = comments[i].authorId;
    if (priorId && priorId !== callerId) return priorId;
  }
  if (moduleAuthorId && moduleAuthorId !== callerId) return moduleAuthorId;
  return null;
}

const FILE_TYPES = ['pdf', 'document', 'slide', 'code', 'archive', 'image'] as const;

// Mirrors the client's fileUploadToArea/ensureModuleFolder filing rules:
// ensure area:modules folder, ensure module:<id> child folder, dedupe the
// name against siblings, create the CourseFile row with sourceArea/sourceId.
async function fileModuleItem(input: {
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  sourceId: string;
  name: string;
  url?: string;
  fileUrl?: string;
  formattedSize?: string;
  visibility?: string;
  type?: string;
}) {
  let areaFolder = await prisma.courseFolder.findFirst({
    where: { courseId: input.courseId, autoKey: 'area:modules' },
  });
  if (!areaFolder) {
    areaFolder = await prisma.courseFolder.create({
      data: {
        id: newId('fld'),
        courseId: input.courseId,
        parentId: null,
        name: 'Modules',
        autoKey: 'area:modules',
      },
    });
  }
  const moduleAutoKey = `module:${input.moduleId}`;
  let moduleFolder = await prisma.courseFolder.findFirst({
    where: { courseId: input.courseId, autoKey: moduleAutoKey },
  });
  if (!moduleFolder) {
    moduleFolder = await prisma.courseFolder.create({
      data: {
        id: newId('fld'),
        courseId: input.courseId,
        parentId: areaFolder.id,
        name: input.moduleTitle,
        autoKey: moduleAutoKey,
      },
    });
  }
  const siblings = await prisma.courseFile.findMany({
    where: { courseId: input.courseId, folderId: moduleFolder.id },
    select: { name: true },
  });
  const name = dedupeFileName(input.name, siblings.map((f) => f.name));
  const type = (FILE_TYPES as readonly string[]).includes(input.type ?? '')
    ? input.type!
    : 'document';
  return prisma.courseFile.create({
    data: {
      id: newId('file'),
      courseId: input.courseId,
      folderId: moduleFolder.id,
      name,
      formattedSize: input.formattedSize ?? '',
      type,
      visibility: input.visibility ?? 'published',
      uploadedBy: '',
      uploadedByName: '',
      content: '',
      url: input.url ?? null,
      fileUrl: input.fileUrl ?? null,
      sourceArea: 'modules',
      sourceId: input.sourceId,
    },
  });
}

modulesRouter.get(
  '/courses/:id/modules',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const course = await loadCourseOr404(req.params.id);
    await assertCourseAccess(course, req.auth!);
    const modules = await prisma.module.findMany({
      where: { courseId: course.id },
      include: { items: true, comments: { include: { likedBy: true } } },
    });
    res.json({ modules: modules.map((m) => ({ ...m, comments: m.comments.map(mapComment) })) });
  })
);

modulesRouter.post(
  '/courses/:id/modules',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);
    const { title } = (req.body ?? {}) as { title?: unknown };
    if (typeof title !== 'string' || !title) {
      throw new ApiError(400, 'bad_request', 'Field title is required.');
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const mod = await prisma.module.create({
      data: {
        id: newId('mod'),
        courseId: course.id,
        title,
        authorId: auth.sub,
        authorName: me?.name ?? null,
      },
    });
    res.status(201).json({ module: mod });
  })
);

modulesRouter.patch(
  '/modules/:moduleId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, string | boolean | number | null> = {};
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title) {
        throw new ApiError(400, 'bad_request', "Field 'title' must be a non-empty string.");
      }
      data.title = body.title;
    }
    if (body.published !== undefined) {
      if (typeof body.published !== 'boolean') {
        throw new ApiError(400, 'bad_request', "Field 'published' must be a boolean.");
      }
      data.published = body.published;
    }
    if (body.order !== undefined) {
      if (typeof body.order !== 'number') {
        throw new ApiError(400, 'bad_request', "Field 'order' must be a number.");
      }
      data.order = body.order;
    }
    const updated = await prisma.module.update({ where: { id: mod.id }, data });
    if (typeof data.title === 'string' && data.title !== mod.title) {
      await prisma.courseFolder.updateMany({
        where: { autoKey: 'module:' + mod.id },
        data: { name: data.title },
      });
    }
    res.json({ module: updated });
  })
);

modulesRouter.delete(
  '/modules/:moduleId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    assertCourseOwner(course, auth);
    // Deletes the module only — filed CourseFile rows stay; their label
    // degrades via the client's resolver reading live data.
    await prisma.module.delete({ where: { id: mod.id } });
    res.json({ ok: true });
  })
);

const ITEM_STRING_FIELDS = [
  'title',
  'type',
  'completionCondition',
  'content',
  'assignmentId',
  'quizId',
  'fileUrl',
  'fileName',
  'fileSize',
  'fileType',
] as const;

modulesRouter.post(
  '/modules/:moduleId/items',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
    for (const key of ITEM_STRING_FIELDS) {
      const value = body[key];
      if (value !== undefined && typeof value !== 'string') {
        throw new ApiError(400, 'bad_request', `Field '${key}' must be a string.`);
      }
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const item = await prisma.moduleItem.create({
      data: {
        id: newId('item'),
        moduleId: mod.id,
        title:
          typeof body.title === 'string' && body.title ? body.title : 'New Learning Resource',
        type: typeof body.type === 'string' && body.type ? body.type : 'page',
        published: typeof body.published === 'boolean' ? body.published : true,
        required: typeof body.required === 'boolean' ? body.required : false,
        completionCondition:
          typeof body.completionCondition === 'string' ? body.completionCondition : 'view',
        minScore: typeof body.minScore === 'number' ? body.minScore : null,
        content: strOrNull(body.content),
        assignmentId: strOrNull(body.assignmentId),
        quizId: strOrNull(body.quizId),
        fileUrl: strOrNull(body.fileUrl),
        fileName: strOrNull(body.fileName),
        fileSize: strOrNull(body.fileSize),
        fileType: strOrNull(body.fileType),
        authorId: auth.sub,
        authorName: me?.name ?? '',
      },
    });
    if (item.fileName || item.fileUrl) {
      await fileModuleItem({
        courseId: course.id,
        moduleId: mod.id,
        moduleTitle: mod.title,
        sourceId: item.id,
        name: item.fileName || item.title,
        url: item.fileUrl ?? undefined,
        fileUrl: item.fileUrl ?? undefined,
        formattedSize: item.fileSize ?? undefined,
        visibility: item.published ? 'published' : 'unpublished',
        type: item.fileType ?? undefined,
      });
    }
    res.status(201).json({ item });
  })
);

modulesRouter.patch(
  '/modules/:moduleId/items/:itemId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    assertCourseOwner(course, auth);
    const prev = await prisma.moduleItem.findUnique({ where: { id: req.params.itemId } });
    if (!prev || prev.moduleId !== mod.id) {
      throw new ApiError(404, 'not_found', 'Module item not found.');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, string | boolean | number | null> = {};
    for (const key of ITEM_STRING_FIELDS) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        throw new ApiError(400, 'bad_request', `Field '${key}' must be a string.`);
      }
      data[key] = value;
    }
    if (body.published !== undefined) {
      if (typeof body.published !== 'boolean') {
        throw new ApiError(400, 'bad_request', "Field 'published' must be a boolean.");
      }
      data.published = body.published;
    }
    if (body.required !== undefined) {
      if (typeof body.required !== 'boolean') {
        throw new ApiError(400, 'bad_request', "Field 'required' must be a boolean.");
      }
      data.required = body.required;
    }
    if (body.minScore !== undefined) {
      if (typeof body.minScore !== 'number') {
        throw new ApiError(400, 'bad_request', "Field 'minScore' must be a number.");
      }
      data.minScore = body.minScore;
    }
    if (body.completed !== undefined) {
      if (typeof body.completed !== 'boolean') {
        throw new ApiError(400, 'bad_request', "Field 'completed' must be a boolean.");
      }
      data.completed = body.completed;
    }
    if (body.targetModuleId !== undefined) {
      if (typeof body.targetModuleId !== 'string' || !body.targetModuleId) {
        throw new ApiError(400, 'bad_request', "Field 'targetModuleId' must be a non-empty string.");
      }
      const target = await loadModuleOr404(body.targetModuleId);
      if (target.courseId !== course.id) {
        throw new ApiError(400, 'bad_request', 'Target module must belong to the same course.');
      }
      // Move: update ONLY the FK — the item id is PRESERVED.
      data.moduleId = target.id;
    }
    const item = await prisma.moduleItem.update({ where: { id: prev.id }, data });
    const hadFile = !!(prev.fileName || prev.fileUrl);
    const willHaveFile = !!(
      ((data.fileName ?? prev.fileName) as string | null) ||
      ((data.fileUrl ?? prev.fileUrl) as string | null)
    );
    if (!hadFile && willHaveFile) {
      const alreadyFiled = await prisma.courseFile.findFirst({ where: { sourceId: item.id } });
      if (!alreadyFiled) {
        await fileModuleItem({
          courseId: course.id,
          moduleId: mod.id,
          moduleTitle: mod.title,
          sourceId: item.id,
          name: item.fileName || item.title,
          url: item.fileUrl ?? undefined,
          fileUrl: item.fileUrl ?? undefined,
          formattedSize: item.fileSize ?? undefined,
          visibility: item.published ? 'published' : 'unpublished',
          type: item.fileType ?? undefined,
        });
      }
    }
    res.json({ item });
  })
);

modulesRouter.delete(
  '/modules/:moduleId/items/:itemId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    assertCourseOwner(course, auth);
    const prev = await prisma.moduleItem.findUnique({ where: { id: req.params.itemId } });
    if (!prev || prev.moduleId !== mod.id) {
      throw new ApiError(404, 'not_found', 'Module item not found.');
    }
    await prisma.moduleItem.delete({ where: { id: prev.id } });
    res.json({ ok: true });
  })
);

modulesRouter.post(
  '/modules/:moduleId/comments',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    await assertCourseAccess(course, auth);
    const { content } = (req.body ?? {}) as { content?: unknown };
    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError(400, 'bad_request', 'Field content is required.');
    }
    const prior = await prisma.moduleComment.findMany({
      where: { moduleId: mod.id },
      orderBy: { createdAt: 'asc' },
    });
    const recipientId = resolveModuleReplyRecipient(prior, auth.sub, mod.authorId);
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const comment = await prisma.moduleComment.create({
      data: {
        id: newId('mc'),
        moduleId: mod.id,
        authorId: auth.sub,
        authorName: me?.name ?? '',
        authorAvatar: me?.avatar ?? '',
        authorRole: auth.role,
        content: content.trim(),
      },
    });
    if (recipientId) {
      await createNotification({
        type: 'module_comment_reply',
        recipientId,
        actorId: auth.sub,
        actorName: me?.name ?? '',
        actorAvatar: me?.avatar ?? '',
        relatedId: mod.id,
        relatedTitle: mod.title,
        content: content.trim(),
      });
    }
    res.status(201).json({ comment: { ...comment, likedBy: [] as string[] } });
  })
);

modulesRouter.patch(
  '/modules/:moduleId/comments/:commentId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    const comment = await prisma.moduleComment.findUnique({
      where: { id: req.params.commentId },
      include: { likedBy: true },
    });
    if (!comment || comment.moduleId !== mod.id) {
      throw new ApiError(404, 'not_found', 'Comment not found.');
    }
    if (comment.authorId !== auth.sub) {
      if (auth.role !== 'faculty' && auth.role !== 'admin') {
        throw new ApiError(403, 'forbidden', 'Only the author or faculty can edit this comment.');
      }
      assertCourseOwner(course, auth);
    } else {
      await assertCourseAccess(course, auth);
    }
    const { content } = (req.body ?? {}) as { content?: unknown };
    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError(400, 'bad_request', 'Field content is required.');
    }
    const updated = await prisma.moduleComment.update({
      where: { id: comment.id },
      data: { content: content.trim(), isEdited: true, editedAt: new Date() },
      include: { likedBy: true },
    });
    res.json({ comment: mapComment(updated) });
  })
);

modulesRouter.post(
  '/modules/:moduleId/comments/:commentId/like',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    await assertCourseAccess(course, auth);
    const comment = await prisma.moduleComment.findUnique({
      where: { id: req.params.commentId },
    });
    if (!comment || comment.moduleId !== mod.id) {
      throw new ApiError(404, 'not_found', 'Comment not found.');
    }
    const existing = await prisma.moduleCommentLike.findFirst({
      where: { commentId: comment.id, userId: auth.sub },
    });
    let liked: boolean;
    if (existing) {
      await prisma.moduleCommentLike.delete({
        where: { commentId_userId: { commentId: comment.id, userId: auth.sub } },
      });
      liked = false;
    } else {
      await prisma.moduleCommentLike.create({
        data: { commentId: comment.id, userId: auth.sub },
      });
      liked = true;
    }
    const likes = await prisma.moduleCommentLike.count({ where: { commentId: comment.id } });
    await prisma.moduleComment.update({ where: { id: comment.id }, data: { likes } });
    res.json({ likes, liked });
  })
);

modulesRouter.delete(
  '/modules/:moduleId/comments/:commentId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const mod = await loadModuleOr404(req.params.moduleId);
    const course = await loadCourseOr404(mod.courseId);
    const comment = await prisma.moduleComment.findUnique({
      where: { id: req.params.commentId },
    });
    if (!comment || comment.moduleId !== mod.id) {
      throw new ApiError(404, 'not_found', 'Comment not found.');
    }
    if (comment.authorId !== auth.sub) {
      if (auth.role !== 'faculty' && auth.role !== 'admin') {
        throw new ApiError(403, 'forbidden', 'Only the author or faculty can delete this comment.');
      }
      assertCourseOwner(course, auth);
    } else {
      await assertCourseAccess(course, auth);
    }
    await prisma.moduleComment.delete({ where: { id: comment.id } });
    res.json({ ok: true });
  })
);
