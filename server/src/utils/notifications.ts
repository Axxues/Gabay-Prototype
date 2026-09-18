import { prisma } from '../db.js';

const CAP = 200;

export async function createNotification(input: {
  type: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  relatedId: string;
  relatedTitle: string;
  content: string;
}) {
  if (!input.recipientId || input.recipientId === input.actorId) return null;
  const created = await prisma.notification.create({
    data: { ...input, id: `notif-${Date.now().toString(36)}`, read: false },
  });
  await pruneNotifications(input.recipientId);
  return created;
}

export async function pruneNotifications(recipientId: string) {
  const mine = await prisma.notification.findMany({
    where: { recipientId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const overflow = mine.slice(CAP);
  if (overflow.length > 0) {
    await prisma.notification.deleteMany({ where: { id: { in: overflow.map((n: { id: string }) => n.id) } } });
  }
}
