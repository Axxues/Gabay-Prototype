// server/src/routes/auth.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../likha/repositories/usersRepo.js', () => ({
  authenticateUser: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('jsonwebtoken', () => {
  const verify = vi.fn();
  const sign = vi.fn(() => 'test-token');
  return { verify, sign, default: { verify, sign } };
});

process.env.JWT_SECRET ??= 'test-secret';

import { authenticateUser } from '../likha/repositories/usersRepo.js';
import { authRouter } from './auth.js';
import { ApiError } from '../utils/errors.js';
import express from 'express';
import request from 'supertest';

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
    (authenticateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: 'test-token',
      user: {
        id: 'u1',
        name: 'Faculty 1',
        email: 'faculty1@dmmmsu.edu.ph',
        role: 'faculty',
        avatar: 'a',
        department: 'd',
        title: 't',
      },
    });

    const res = await request(app()).post('/api/auth/login').send({ email: 'faculty1@dmmmsu.edu.ph', password: 'p' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('test-token');
    expect(res.body.user.name).toBe('Faculty 1');
  });

  it('rejects wrong password with the generic message', async () => {
    (authenticateUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(401, 'invalid_credentials', 'Invalid email or password.')
    );

    const res = await request(app()).post('/api/auth/login').send({ email: 'e', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app()).post('/api/auth/login').send({ email: 'e' });
    expect(res.status).toBe(400);
  });
});
