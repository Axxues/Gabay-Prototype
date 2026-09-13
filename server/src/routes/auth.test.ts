// server/src/routes/auth.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db.js', () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock('bcryptjs', () => {
  const compare = vi.fn();
  return { compare, default: { compare } };
});
vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});

process.env.JWT_SECRET ??= 'test-secret';

import { prisma } from '../db.js';
import bcrypt from 'bcryptjs';
import { authRouter } from './auth.js';
import express from 'express';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/auth', authRouter);
  a.use(((err: unknown, _req: unknown, res: { status: (n: number) => { json: (o: unknown) => void } }, _next: unknown) => {
    const e = err as { status?: number; code?: string; message?: string };
    res.status(e.status ?? 500).json({ error: { code: e.code ?? 'internal', message: e.message ?? 'x' } });
  }) as never);
  return a;
}

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns token + public user on valid credentials', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'u1', name: 'N', email: 'e', role: 'faculty', avatar: 'a', department: 'd', title: 't', passwordHash: 'h',
    });
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const res = await (await import('supertest')).default(app()).post('/api/auth/login').send({ email: 'e', password: 'p' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('test-token');
    expect(res.body.user.passwordHash).toBeUndefined();
  });
  it('rejects wrong password with the generic message', async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'u1', passwordHash: 'h' });
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const res = await (await import('supertest')).default(app()).post('/api/auth/login').send({ email: 'e', password: 'p' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password.');
  });
  it('rejects missing fields with 400', async () => {
    const res = await (await import('supertest')).default(app()).post('/api/auth/login').send({ email: 'e' });
    expect(res.status).toBe(400);
  });
});
