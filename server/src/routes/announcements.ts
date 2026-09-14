import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { dedupeFileName } from '../utils/names.js';

export const announcementsRouter = Router();

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

async function loadAnnouncementOr404(announcementId: string) {
  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: {
      attachments: true,
      replies: { include: { likedBy: true } },
      likedBy: true,
      readBy: true,
    },
  });
  if (!ann) throw new ApiError(404, 'not_found', 'Announcement not found.');
  return ann;
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

// Port of the client's isAnnouncementVisibleToViewer rule verbatim:
// faculty/admin see all; students see sectionId 'all' or their section
// (resolved from their approved request targetSectionId).
function isVisibleToViewer(
  sectionId: string | null | undefined,
  viewerSectionId: string | null,
  viewerRole: string
): boolean {
  if (viewerRole === 'faculty' || viewerRole === 'admin') return true;
  const scope = sectionId || 'all';
  if (scope === 'all') return true;
  return viewerSectionId === scope;
}

async function resolveStudentSectionId(
  courseId: string,
  studentId: string
): Promise<string | null> {
  const req = await prisma.enrollmentRequest.findFirst({
    where: { courseId, studentId, status: 'approved' },
  });
  return req?.targetSectionId ?? null;
}

async function assertSectionScope(
  sectionId: string | null | undefined,
  courseId: string,
  auth: AuthPayload
): Promise<void> {
  if (auth.role === 'faculty' || auth.role === 'admin') return;
  const viewerSectionId = await resolveStudentSectionId(courseId, auth.sub);
  if (!isVisibleToViewer(sectionId, viewerSectionId, auth.role)) {
    throw new ApiError(403, 'forbidden', 'This announcement is not visible to your section.');
  }
}

function mapAnnouncement<
  T extends {
    likedBy: Array<{ userId: string }>;
    readBy: Array<{ userId: string }>;
    replies: Array<{ likedBy: Array<{ userId: string }> }>;
  }
>(a: T) {
  return {
    ...a,
    likedBy: a.likedBy.map((l) => l.userId),
    readBy: a.readBy.map((r) => r.userId),
    replies: a.replies.map((r) => ({ ...r, likedBy: r.likedBy.map((l) => l.userId) })),
  };
}

// Mirrors the client's fileUploadToArea filing rule for the Announcements
// area: ensure the area:announcements folder, dedupe the name against
// siblings, create the CourseFile row with sourceArea/sourceId.
async function fileAnnouncementAttachment(input: {
  courseId: string;
  announcementId: string;
  name: string;
  size?: string;
  url?: string;
  uploadedBy: string;
  uploadedByName: string;
}) {
  let areaFolder = await prisma.courseFolder.findFirst({
    where: { courseId: input.courseId, autoKey: 'area:announcements' },
  });
  if (!areaFolder) {
    areaFolder = await prisma.courseFolder.create({
      data: {
        id: newId('fld'),
        courseId: input.courseId,
        parentId: null,
        name: 'Announcements',
        autoKey: 'area:announcements',
      },
    });
  }
  const siblings = await prisma.courseFile.findMany({
    where: { courseId: input.courseId, folderId: areaFolder.id },
    select: { name: true },
  });
  const name = dedupeFileName(input.name, siblings.map((f) => f.name));
  return prisma.courseFile.create({
    data: {
      id: newId('file'),
      courseId: input.courseId,
      folderId: areaFolder.id,
      name,
      formattedSize: input.size ?? '',
      type: 'document',
      visibility: 'published',
      uploadedBy: input.uploadedBy,
      uploadedByName: input.uploadedByName,
      content: '',
      url: input.url ?? null,
      fileUrl: input.url ?? null,
      sourceArea: 'announcements',
      sourceId: input.announcementId,
    },
  });
}

announcementsRouter.get(
  '/courses/:id/announcements',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    await assertCourseAccess(course, auth);
    const rows = await prisma.announcement.findMany({
      where: { courseId: course.id },
      include: {
        attachments: true,
        replies: { include: { likedBy: true } },
        likedBy: true,
        readBy: true,
      },
    });
    let items = rows;
    if (auth.role !== 'faculty' && auth.role !== 'admin') {
      const viewerSectionId = await resolveStudentSectionId(course.id, auth.sub);
      items = rows.filter((a) => isVisibleToViewer(a.sectionId, viewerSectionId, auth.role));
    }
    res.json({ announcements: items.map(mapAnnouncement) });
  })
);

interface AttachmentInput {
  name?: unknown;
  size?: unknown;
  url?: unknown;
}

function parseAttachmentsInput(value: unknown): Array<{ name: string; size: string; url: string | null }> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'bad_request', 'Field attachments must be an array.');
  }
  return (value as AttachmentInput[]).map((att, i) => {
    if (!att || typeof att.name !== 'string' || !att.name) {
      throw new ApiError(400, 'bad_request', `Attachment ${i + 1}: field name is required.`);
    }
    if (att.size !== undefined && typeof att.size !== 'string') {
      throw new ApiError(400, 'bad_request', `Attachment ${i + 1}: field size must be a string.`);
    }
    if (att.url !== undefined && att.url !== null && typeof att.url !== 'string') {
      throw new ApiError(400, 'bad_request', `Attachment ${i + 1}: field url must be a string.`);
    }
    return {
      name: att.name,
      size: typeof att.size === 'string' ? att.size : '',
      url: typeof att.url === 'string' ? att.url : null,
    };
  });
}

announcementsRouter.post(
  '/courses/:id/announcements',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { title, content } = body;
    if (typeof title !== 'string' || !title.trim()) {
      throw new ApiError(400, 'bad_request', 'Field title is required.');
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError(400, 'bad_request', 'Field content is required.');
    }
    const sectionId = typeof body.sectionId === 'string' && body.sectionId ? body.sectionId : 'all';
    const attachments = parseAttachmentsInput(body.attachments);
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const created = await prisma.announcement.create({
      data: {
        id: newId('ann'),
        courseId: course.id,
        title: title.trim(),
        content: content.trim(),
        authorId: auth.sub,
        authorName: me?.name ?? '',
        authorAvatar: me?.avatar ?? '',
        authorRole: auth.role,
        sectionId,
      },
    });
    const rows = [];
    for (const att of attachments) {
      rows.push(
        await prisma.announcementAttachment.create({
          data: {
            id: newId('annatt'),
            announcementId: created.id,
            name: att.name,
            size: att.size,
            url: att.url,
          },
        })
      );
      await fileAnnouncementAttachment({
        courseId: course.id,
        announcementId: created.id,
        name: att.name,
        size: att.size,
        url: att.url ?? undefined,
        uploadedBy: auth.sub,
        uploadedByName: me?.name ?? '',
      });
    }
    res.status(201).json({ announcement: { ...created, attachments: rows } });
  })
);

announcementsRouter.post(
  '/announcements/:id/replies',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const ann = await loadAnnouncementOr404(req.params.id);
    const course = await loadCourseOr404(ann.courseId);
    await assertCourseAccess(course, auth);
    await assertSectionScope(ann.sectionId, course.id, auth);
    const { content, parentId } = (req.body ?? {}) as { content?: unknown; parentId?: unknown };
    if (typeof content !== 'string' || !content.trim()) {
      throw new ApiError(400, 'bad_request', 'Field content is required.');
    }
    let resolvedParentId: string | null = null;
    if (parentId !== undefined && parentId !== null) {
      if (typeof parentId !== 'string' || !parentId.trim()) {
        throw new ApiError(400, 'bad_request', 'Field parentId must be a string.');
      }
      const parent = await prisma.announcementReply.findUnique({ where: { id: parentId.trim() } });
      if (!parent || parent.announcementId !== ann.id) {
        throw new ApiError(400, 'bad_request', 'Parent reply not found in this announcement.');
      }
      resolvedParentId = parent.id;
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const reply = await prisma.announcementReply.create({
      data: {
        id: newId('annreply'),
        announcementId: ann.id,
        parentId: resolvedParentId,
        authorId: auth.sub,
        authorName: me?.name ?? '',
        authorAvatar: me?.avatar ?? '',
        authorRole: auth.role,
        content: content.trim(),
      },
    });
    // Port of the client's resolveAnnouncementReplyRecipient rule verbatim
    // for the top-level path: notify the announcement author, never self.
    // Second-layer replies instead notify the parent + root authors.
    const recipients = new Set<string>();
    if (resolvedParentId) {
      const prior =
        (await prisma.announcementReply.findMany({ where: { announcementId: ann.id } })) ?? [];
      const byId = new Map(prior.map((r) => [r.id, r]));
      let parent = byId.get(resolvedParentId);
      if (!parent) {
        const row = await prisma.announcementReply.findUnique({ where: { id: resolvedParentId } });
        if (row) {
          byId.set(row.id, row);
          parent = row;
        }
      }
      if (parent) {
        if (parent.authorId && parent.authorId !== auth.sub) recipients.add(parent.authorId);
        let root = parent;
        const seen = new Set<string>([parent.id]);
        let guard = 0;
        while (root.parentId && guard < 25) {
          guard += 1;
          let next = byId.get(root.parentId);
          if (!next) {
            const row = await prisma.announcementReply.findUnique({ where: { id: root.parentId } });
            if (!row || row.announcementId !== ann.id) break;
            byId.set(row.id, row);
            next = row;
          }
          if (seen.has(next.id)) break;
          seen.add(next.id);
          root = next;
        }
        if (root.id !== parent.id && root.authorId && root.authorId !== auth.sub) {
          recipients.add(root.authorId);
        }
      }
    } else if (ann.authorId !== auth.sub) {
      recipients.add(ann.authorId);
    }
    for (const recipient of recipients) {
      await createNotification({
        type: 'announcement_reply',
        recipientId: recipient,
        actorId: auth.sub,
        actorName: me?.name ?? '',
        actorAvatar: me?.avatar ?? '',
        relatedId: ann.id,
        relatedTitle: ann.title,
        content: content.trim(),
      });
    }
    res.status(201).json({ reply: { ...reply, likedBy: [] as string[] } });
  })
);

announcementsRouter.post(
  '/announcements/:id/read',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const ann = await loadAnnouncementOr404(req.params.id);
    const course = await loadCourseOr404(ann.courseId);
    await assertCourseAccess(course, auth);
    await assertSectionScope(ann.sectionId, course.id, auth);
    const existing = await prisma.announcementRead.findFirst({
      where: { announcementId: ann.id, userId: auth.sub },
    });
    if (!existing) {
      await prisma.announcementRead.create({
        data: { announcementId: ann.id, userId: auth.sub },
      });
    }
    res.json({ ok: true });
  })
);

announcementsRouter.post(
  '/announcements/:id/like',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const ann = await loadAnnouncementOr404(req.params.id);
    const course = await loadCourseOr404(ann.courseId);
    await assertCourseAccess(course, auth);
    await assertSectionScope(ann.sectionId, course.id, auth);
    const existing = await prisma.announcementLike.findFirst({
      where: { announcementId: ann.id, userId: auth.sub },
    });
    let liked: boolean;
    if (existing) {
      await prisma.announcementLike.delete({
        where: { announcementId_userId: { announcementId: ann.id, userId: auth.sub } },
      });
      liked = false;
    } else {
      await prisma.announcementLike.create({
        data: { announcementId: ann.id, userId: auth.sub },
      });
      liked = true;
    }
    const likes = await prisma.announcementLike.count({ where: { announcementId: ann.id } });
    const updated = await prisma.announcement.update({
      where: { id: ann.id },
      data: { likes },
    });
    res.json({ announcement: updated, likes, liked });
  })
);

announcementsRouter.patch(
  '/announcements/:id',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const ann = await loadAnnouncementOr404(req.params.id);
    const course = await loadCourseOr404(ann.courseId);
    assertCourseOwner(course, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      if (key !== 'pinned') {
        throw new ApiError(400, 'bad_request', `Unknown field '${key}'. Only 'pinned' is allowed.`);
      }
    }
    if (body.pinned === undefined || typeof body.pinned !== 'boolean') {
      throw new ApiError(400, 'bad_request', "Field 'pinned' must be a boolean.");
    }
    const updated = await prisma.announcement.update({
      where: { id: ann.id },
      data: { pinned: body.pinned },
    });
    res.json({ announcement: updated });
  })
);

announcementsRouter.delete(
  '/announcements/:id',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const ann = await loadAnnouncementOr404(req.params.id);
    const course = await loadCourseOr404(ann.courseId);
    assertCourseOwner(course, auth);
    // Deletes the announcement only — filed CourseFile copies stay; their
    // label degrades via the client's resolver reading live data.
    await prisma.announcement.delete({ where: { id: ann.id } });
    res.json({ ok: true });
  })
);
