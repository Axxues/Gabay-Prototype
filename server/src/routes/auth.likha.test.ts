import { describe, expect, it } from 'vitest';
import { authenticateUser, getUserById, getUserByEmail, getAllUsers } from '../likha/repositories/usersRepo.js';

describe('Likha Users Repository & Auth Flow', () => {
  it('authenticates seed faculty user against Likha ERP', async () => {
    const { user, token } = await authenticateUser('faculty1@dmmmsu.edu.ph', 'faculty2026');
    expect(user).toBeDefined();
    expect(user.email).toBe('faculty1@dmmmsu.edu.ph');
    expect(user.role).toBe('faculty');
    expect(typeof token).toBe('string');
  });

  it('authenticates seed student user against Likha ERP', async () => {
    const { user, token } = await authenticateUser('student1@dmmmsu.edu.ph', 'gabay2026');
    expect(user).toBeDefined();
    expect(user.email).toBe('student1@dmmmsu.edu.ph');
    expect(user.role).toBe('student');
    expect(typeof token).toBe('string');
  });

  it('fails authentication on invalid password with ApiError 401', async () => {
    await expect(
      authenticateUser('faculty1@dmmmsu.edu.ph', 'wrong-password-xyz')
    ).rejects.toThrow();
  });

  it('queries user by email', async () => {
    const user = await getUserByEmail('faculty1@dmmmsu.edu.ph');
    expect(user).not.toBeNull();
    expect(user?.role).toBe('faculty');
  });

  it('queries directory list of all Likha users', async () => {
    const users = await getAllUsers();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(3);
    const emails = users.map((u) => u.email);
    expect(emails).toContain('faculty1@dmmmsu.edu.ph');
    expect(emails).toContain('student1@dmmmsu.edu.ph');
  });
});
