import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken } from '../middleware/auth.js';

export const notificationsRouter = Router();

// GET /api/notifications (own only, newest first, ?type= + ?limit=)
notificationsRouter.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const type = req.query.type as string | undefined;
    let take: number | undefined;
    if (req.query.limit !== undefined) {
      const n = Number(req.query.limit);
      if (!Number.isInteger(n) || n <= 0) {
        throw new ApiError(400, 'bad_request', 'Query limit must be a positive integer.');
      }
      take = n;
    }
    const notifications = await prisma.notification.findMany({
      where: { recipientId: me, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      ...(take !== undefined ? { take } : {}),
    });
    res.json({ notifications });
  })
);

// GET /api/notifications/unread-count ({ total, byType })
notificationsRouter.get(
  '/unread-count',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const rows = await prisma.notification.findMany({
      where: { recipientId: me, read: false },
      select: { type: true },
    });
    const byType: Record<string, number> = {};
    for (const row of rows as Array<{ type: string }>) {
      byType[row.type] = (byType[row.type] ?? 0) + 1;
    }
    res.json({ total: rows.length, byType });
  })
);

// POST /api/notifications/read-all (body { type? } marks own matching rows)
notificationsRouter.post(
  '/read-all',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { type } = body;
    if (type !== undefined && (typeof type !== 'string' || !type)) {
      throw new ApiError(400, 'bad_request', 'Field type must be a non-empty string.');
    }
    const result = await prisma.notification.updateMany({
      where: { recipientId: me, read: false, ...(typeof type === 'string' ? { type } : {}) },
      data: { read: true },
    });
    res.json({ updated: (result as { count: number }).count });
  })
);

// POST /api/notifications/:id/read (own only)
notificationsRouter.post(
  '/:id/read',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const me = req.auth!.sub;
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification) throw new ApiError(404, 'not_found', 'Notification not found.');
    if (notification.recipientId !== me) {
      throw new ApiError(403, 'forbidden', 'You do not have access to this notification.');
    }
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true },
    });
    res.json({ notification: updated });
  })
);
