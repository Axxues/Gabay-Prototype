// server/src/routes/messages.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    message: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    chatGroup: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    chatGroupMember: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
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
import { messagesRouter } from './messages.js';
import { errorMiddleware } from '../utils/errors.js';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/messages', messagesRouter);
  a.use(errorMiddleware);
  return a;
}

describe('messages router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.chatGroupMember.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("thread-read marks only the counterpart's unread rows", async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'me',
      role: 'student',
    });
    (prisma.message.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/messages/thread/read')
      .set('Authorization', 'Bearer x')
      .send({ partnerId: 'partner' });

    expect(res.status).toBe(200);
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'me', senderId: 'partner', read: false },
      data: { read: true },
    });
  });

  it('sending to self is rejected 400', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'me',
      role: 'student',
    });

    const res = await (await import('supertest'))
      .default(app())
      .post('/api/messages')
      .set('Authorization', 'Bearer x')
      .send({ recipientId: 'me', subject: 'hi', body: 'hello' });

    expect(res.status).toBe(400);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('non-participant cannot read another user message (403)', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'intruder',
      role: 'student',
    });
    (prisma.message.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'm1',
      senderId: 'alice',
      recipientId: 'bob',
      groupId: null,
      subject: 'private',
      body: 'secret',
    });

    const res = await (await import('supertest'))
      .default(app())
      .get('/api/messages/m1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(403);
  });

  it('DELETE react clears the reaction (participant)', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'alice',
      role: 'student',
    });
    (prisma.message.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'm1',
      senderId: 'alice',
      recipientId: 'bob',
      groupId: null,
      reaction: '❤️',
    });
    (prisma.message.update as ReturnType<typeof vi.fn>).mockImplementation(
      (args: { where: unknown; data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'm1', ...args.data })
    );

    const res = await (await import('supertest'))
      .default(app())
      .delete('/api/messages/m1/react')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { reaction: null },
    });
    expect(res.body.message.reaction).toBeNull();
  });

  it('DELETE react by non-participant → 403', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'intruder',
      role: 'student',
    });
    (prisma.message.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'm1',
      senderId: 'alice',
      recipientId: 'bob',
      groupId: null,
      reaction: '❤️',
    });

    const res = await (await import('supertest'))
      .default(app())
      .delete('/api/messages/m1/react')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(403);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('DELETE react for missing message → 404', async () => {
    (jwt.verify as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'alice',
      role: 'student',
    });
    (prisma.message.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await (await import('supertest'))
      .default(app())
      .delete('/api/messages/nope/react')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(404);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });
});
