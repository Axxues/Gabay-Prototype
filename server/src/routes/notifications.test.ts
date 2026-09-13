// server/src/routes/notifications.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    advisingSlot: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    notification: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});

process.env.JWT_SECRET ??= 'test-secret';

import { prisma } from '../db.js';
import jwt from 'jsonwebtoken';
import express from 'express';
import { advisingRouter } from './calendar.js';
import { notificationsRouter } from './notifications.js';
import { pruneNotifications } from '../utils/notifications.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/advising', advisingRouter);
  a.use('/api/notifications', notificationsRouter);
  a.use(errorMiddleware);
  return a;
}

describe('notifications + advising booking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creating the 201st notification prunes to 200 (deleteMany called with the overflow ids)', async () => {
    const rows = Array.from({ length: 201 }, (_, i) => ({ id: `n-${i + 1}` }));
    (prisma.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(rows);
    (prisma.notification.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

    await pruneNotifications('user-1');

    expect(prisma.notification.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['n-201'] } },
    });
  });

  it('read-all with type only touches that type', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'me',
      role: 'student',
    });
    (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 3 });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/notifications/read-all')
      .set('Authorization', 'Bearer x')
      .send({ type: 'announcement_reply' });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(3);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'me', read: false, type: 'announcement_reply' },
      data: { read: true },
    });
  });

  it('double-book returns 409 slot_taken without overwrite', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'student-1',
      role: 'student',
    });
    (prisma.advisingSlot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'adv-1',
      instructorId: 'fac-1',
      status: 'booked',
      bookedByStudentId: 'other-student',
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/advising/adv-1/book')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('slot_taken');
    expect(prisma.advisingSlot.update).not.toHaveBeenCalled();
  });
});
