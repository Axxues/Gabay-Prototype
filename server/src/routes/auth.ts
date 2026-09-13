import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, signToken } from '../middleware/auth.js';

export const authRouter = Router();

const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  department: true,
  title: true,
} as const;

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new ApiError(400, 'bad_request', 'Email and password are required.');
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new ApiError(401, 'invalid_credentials', 'Invalid email or password.');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, 'invalid_credentials', 'Invalid email or password.');
    const { passwordHash: _omit, ...publicUser } = user;
    void _omit;
    res.json({ token: signToken(user.id, user.role), user: publicUser });
  })
);

authRouter.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      select: PUBLIC_USER,
    });
    if (!user) throw new ApiError(401, 'unauthorized', 'Account no longer exists.');
    res.json({ user });
  })
);
