// server/prisma/seed.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({ prisma: { user: { upsert: vi.fn() } } }));
vi.mock('bcryptjs', () => {
  const hash = vi.fn(async (pw: string) => `hashed:${pw}`);
  const compare = vi.fn();
  return { hash, compare, default: { hash, compare } };
});

import { prisma } from '../src/db.js';
import { seed } from './seed.js';

describe('seed', () => {
  it('upserts 4 accounts by email with hashed passwords', async () => {
    const emails = await seed();
    expect(emails).toHaveLength(4);
    const upsert = prisma.user.upsert as ReturnType<typeof vi.fn>;
    expect(upsert).toHaveBeenCalledTimes(4);
    for (const call of upsert.mock.calls) {
      expect(call[0].where.email).toBeTruthy();
      expect(call[0].create.passwordHash).toMatch(/^hashed:/);
      expect(call[0].create.passwordHash).not.toBe(call[0].where.email);
    }
  });
  it('is idempotent (upsert, not create)', async () => {
    const upsert = prisma.user.upsert as ReturnType<typeof vi.fn>;
    upsert.mockClear();
    await seed();
    expect(upsert).toHaveBeenCalledTimes(4);
  });
});
