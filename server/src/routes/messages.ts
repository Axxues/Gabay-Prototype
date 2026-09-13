import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken } from '../middleware/auth.js';

export const messagesRouter = Router();
export const groupsRouter = Router();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function myGroupIds(userId: string): Promise<string[]> {
  const rows = await prisma.chatGroupMember.findMany({ where: { userId } });
  return rows.map((r: { groupId: string }) => r.groupId);
}

async function assertGroupMember(groupId: string, userId: string): Promise<void> {
  const membership = await prisma.chatGroupMember.findFirst({
    where: { groupId, userId },
  });
  if (!membership) throw new ApiError(403, 'forbidden', 'You are not a member of this group.');
}

function assertParticipant(
  message: { senderId: string; recipientId: string },
  userId: string,
): void {
  if (message.senderId !== userId && message.recipientId !== userId) {
    throw new ApiError(403, 'forbidden', 'You do not have access to this message.');
  }
}

// GET /api/messages?box=inbox|course&courseId=
messagesRouter.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const box = req.query.box as string | undefined;
    const courseId = req.query.courseId as string | undefined;
    const groups = await myGroupIds(me);

    if (box === 'course') {
      if (!courseId) throw new ApiError(400, 'bad_request', 'Query courseId is required.');
      const messages = await prisma.message.findMany({
        where: {
          courseId,
          OR: [
            { senderId: me },
            { recipientId: me },
            ...(groups.length ? [{ groupId: { in: groups } }] : []),
          ],
        },
        orderBy: { timestamp: 'desc' },
      });
      res.json({ messages });
      return;
    }

    if (box === 'inbox' || box === undefined) {
      const where: Record<string, unknown> =
        box === 'inbox'
          ? {
              OR: [
                { recipientId: me },
                ...(groups.length
                  ? [{ groupId: { in: groups }, senderId: { not: me } }]
                  : []),
              ],
            }
          : {
              OR: [
                { senderId: me },
                { recipientId: me },
                ...(groups.length ? [{ groupId: { in: groups } }] : []),
              ],
            };
      if (courseId) (where as Record<string, unknown>).courseId = courseId;
      const messages = await prisma.message.findMany({
        where,
        orderBy: { timestamp: 'desc' },
      });
      res.json({ messages });
      return;
    }

    throw new ApiError(400, 'bad_request', "Query box must be 'inbox' or 'course'.");
  }),
);

// GET /api/messages/:id (participant check)
messagesRouter.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message) throw new ApiError(404, 'not_found', 'Message not found.');
    if (message.senderId !== me && message.recipientId !== me) {
      // Group messages address the group, not the member — allow fellow members.
      if (message.groupId) {
        await assertGroupMember(message.groupId, me);
      } else {
        assertParticipant(message, me);
      }
    }
    res.json({ message });
  }),
);

// POST /api/messages { recipientId, subject, body, courseId?, groupId? }
messagesRouter.post(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { subject, courseId, groupId } = body;
    let { recipientId } = body;

    if (typeof subject !== 'string' || !subject.trim()) {
      throw new ApiError(400, 'bad_request', 'Field subject is required.');
    }
    if (typeof body.body !== 'string' || !(body.body as string).trim()) {
      throw new ApiError(400, 'bad_request', 'Field body is required.');
    }

    let isGroup = false;
    if (typeof groupId === 'string' && groupId) {
      await assertGroupMember(groupId, me);
      // Client convention: single row with groupId, isGroup true, recipientId = group id.
      recipientId = groupId;
      isGroup = true;
    }

    if (typeof recipientId !== 'string' || !recipientId) {
      throw new ApiError(400, 'bad_request', 'Field recipientId is required.');
    }
    if (recipientId === me) {
      throw new ApiError(400, 'bad_request', 'You cannot send a message to yourself.');
    }

    const sender = await prisma.user.findUnique({ where: { id: me } });
    const recipient = isGroup
      ? await prisma.chatGroup.findUnique({ where: { id: recipientId } })
      : await prisma.user.findUnique({ where: { id: recipientId } });

    const message = await prisma.message.create({
      data: {
        id: newId('msg'),
        senderId: me,
        senderName: (sender as { name?: string } | null)?.name ?? '',
        senderRole: req.auth!.role,
        recipientId,
        recipientName: (recipient as { name?: string } | null)?.name ?? '',
        recipientRole: '',
        courseId: typeof courseId === 'string' ? courseId : null,
        subject: (subject as string).trim(),
        body: (body.body as string).trim(),
        read: false,
        groupId: isGroup ? (groupId as string) : null,
        isGroup,
      },
    });
    res.status(201).json({ message });
  }),
);

// POST /api/messages/thread/read { partnerId } or { groupId }
messagesRouter.post(
  '/thread/read',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { partnerId, groupId } = body;

    if (typeof partnerId === 'string' && partnerId) {
      const result = await prisma.message.updateMany({
        where: { recipientId: me, senderId: partnerId, read: false },
        data: { read: true },
      });
      res.json({ updated: (result as { count: number }).count });
      return;
    }
    if (typeof groupId === 'string' && groupId) {
      await assertGroupMember(groupId, me);
      const result = await prisma.message.updateMany({
        where: { groupId, read: false, senderId: { not: me } },
        data: { read: true },
      });
      res.json({ updated: (result as { count: number }).count });
      return;
    }
    throw new ApiError(400, 'bad_request', 'Provide partnerId or groupId.');
  }),
);

// POST /api/messages/:id/react { reaction }
messagesRouter.post(
  '/:id/react',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.reaction !== 'string' || !(body.reaction as string).trim()) {
      throw new ApiError(400, 'bad_request', 'Field reaction is required.');
    }
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message) throw new ApiError(404, 'not_found', 'Message not found.');
    if (message.senderId !== me && message.recipientId !== me) {
      if (message.groupId) {
        await assertGroupMember(message.groupId, me);
      } else {
        assertParticipant(message, me);
      }
    }
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { reaction: (body.reaction as string).trim() },
    });
    res.json({ message: updated });
  }),
);

// DELETE /api/messages/:id/react (participant only — same guard as POST react)
messagesRouter.delete(
  '/:id/react',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message) throw new ApiError(404, 'not_found', 'Message not found.');
    if (message.senderId !== me && message.recipientId !== me) {
      if (message.groupId) {
        await assertGroupMember(message.groupId, me);
      } else {
        assertParticipant(message, me);
      }
    }
    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { reaction: null },
    });
    res.json({ message: updated });
  }),
);

// GET /api/groups (groups I belong to)
groupsRouter.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const ids = await myGroupIds(me);
    const groups = ids.length
      ? await prisma.chatGroup.findMany({
          where: { id: { in: ids } },
          include: { members: true },
        })
      : [];
    res.json({ groups });
  }),
);

// POST /api/groups { name, memberIds, courseId? }
groupsRouter.post(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.name !== 'string' || !(body.name as string).trim()) {
      throw new ApiError(400, 'bad_request', 'Field name is required.');
    }
    if (!Array.isArray(body.memberIds)) {
      throw new ApiError(400, 'bad_request', 'Field memberIds must be an array.');
    }
    const memberIds = [...new Set([...(body.memberIds as unknown[]), me])].filter(
      (id): id is string => typeof id === 'string' && !!id,
    );
    const group = await prisma.chatGroup.create({
      data: {
        id: newId('grp'),
        name: (body.name as string).trim(),
        courseId: typeof body.courseId === 'string' ? body.courseId : null,
        createdBy: me,
      },
    });
    for (const userId of memberIds) {
      await prisma.chatGroupMember.create({ data: { groupId: group.id, userId } });
    }
    const members = await prisma.chatGroupMember.findMany({ where: { groupId: group.id } });
    res.status(201).json({ group: { ...group, members } });
  }),
);

// POST /api/groups/:id/messages (client single-row group convention)
groupsRouter.post(
  '/:id/messages',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const group = await prisma.chatGroup.findUnique({ where: { id: req.params.id } });
    if (!group) throw new ApiError(404, 'not_found', 'Group not found.');
    await assertGroupMember(group.id, me);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.subject !== 'string' || !(body.subject as string).trim()) {
      throw new ApiError(400, 'bad_request', 'Field subject is required.');
    }
    if (typeof body.body !== 'string' || !(body.body as string).trim()) {
      throw new ApiError(400, 'bad_request', 'Field body is required.');
    }
    const sender = await prisma.user.findUnique({ where: { id: me } });
    const message = await prisma.message.create({
      data: {
        id: newId('msg'),
        senderId: me,
        senderName: (sender as { name?: string } | null)?.name ?? '',
        senderRole: req.auth!.role,
        recipientId: group.id,
        recipientName: (group as { name?: string }).name ?? '',
        recipientRole: '',
        courseId: (group as { courseId?: string | null }).courseId ?? null,
        subject: (body.subject as string).trim(),
        body: (body.body as string).trim(),
        read: false,
        groupId: group.id,
        isGroup: true,
      },
    });
    res.status(201).json({ message });
  }),
);
