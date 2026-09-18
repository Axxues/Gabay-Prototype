import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { USER_ROLES, isOneOf } from '../utils/allowed.js';

export const usersRouter = Router();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  banner: true,
  department: true,
  title: true,
} as const;

const EDITABLE_FIELDS = ['name', 'avatar', 'banner', 'department', 'title', 'email', 'role', 'password'] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

usersRouter.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: PUBLIC_USER,
    });
    if (!user) throw new ApiError(404, 'not_found', 'User not found.');
    res.json({ user });
  })
);

usersRouter.get(
  '/',
  authenticateToken,
  asyncHandler(async (_req, res) => {
    // Directory listing for messaging/compose flows. Any authenticated user
    // may list it; rows use the public select (never password hashes).
    const users = await prisma.user.findMany({
      select: PUBLIC_USER,
      orderBy: { name: 'asc' },
    });
    res.json({ users });
  })
);

usersRouter.post(
  '/',
  authenticateToken,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { name, email, role, password } = body;
    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'bad_request', 'Field name is required.');
    }
    if (typeof email !== 'string' || !email || !email.includes('@')) {
      throw new ApiError(400, 'bad_request', 'Field email must be a valid email address.');
    }
    if (!isOneOf(role, USER_ROLES)) {
      throw new ApiError(400, 'bad_request', `Field 'role' must be one of: ${USER_ROLES.join(', ')}.`);
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw new ApiError(400, 'bad_request', 'Field password must be at least 8 characters.');
    }
    const optional: Record<'avatar' | 'banner' | 'department' | 'title', string> = {
      avatar: '',
      banner: '',
      department: '',
      title: '',
    };
    for (const key of ['avatar', 'banner', 'department', 'title'] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        throw new ApiError(400, 'bad_request', `Field '${key}' must be a string.`);
      }
      optional[key] = value;
    }
    const dupe = await prisma.user.findUnique({ where: { email } });
    if (dupe) throw new ApiError(409, 'conflict', 'Email is already in use.');
    const user = await prisma.user.create({
      data: {
        id: newId('usr'),
        name: name.trim(),
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        avatar: optional.avatar,
        banner: optional.banner || null,
        department: optional.department,
        title: optional.title,
      },
      select: PUBLIC_USER,
    });
    res.status(201).json({ user });
  })
);

usersRouter.patch(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    if (auth.sub !== req.params.id && auth.role !== 'admin') {
      throw new ApiError(403, 'forbidden', 'You can only edit your own profile.');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const unknownKeys = Object.keys(body).filter(
      (k) => !(EDITABLE_FIELDS as readonly string[]).includes(k)
    );
    if (unknownKeys.length > 0) {
      throw new ApiError(400, 'bad_request', `Unknown fields: ${unknownKeys.join(', ')}.`);
    }
    const data: Record<EditableField, string> = {} as Record<EditableField, string>;
    for (const key of EDITABLE_FIELDS) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        throw new ApiError(400, 'bad_request', `Field '${key}' must be a string.`);
      }
      data[key] = value;
    }
    if (data.email !== undefined && (!data.email || !data.email.includes('@'))) {
      throw new ApiError(400, 'bad_request', 'Field email must be a valid email address.');
    }
    if (data.role !== undefined && !isOneOf(data.role, USER_ROLES)) {
      throw new ApiError(400, 'bad_request', `Field 'role' must be one of: ${USER_ROLES.join(', ')}.`);
    }
    if (data.password !== undefined && data.password.length < 8) {
      throw new ApiError(400, 'bad_request', 'Field password must be at least 8 characters.');
    }
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'not_found', 'User not found.');
    if (data.email !== undefined && data.email !== existing.email) {
      const clash = await prisma.user.findUnique({ where: { email: data.email } });
      if (clash) throw new ApiError(409, 'conflict', 'Email is already in use.');
    }
    const { password: newPassword, ...profileData } = data;
    const updateData = { ...profileData };
    if (newPassword !== undefined) {
      (updateData as Record<string, string>).passwordHash = await bcrypt.hash(newPassword, 10);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: PUBLIC_USER,
    });
    res.json({ user });
  })
);

usersRouter.delete(
  '/:id',
  authenticateToken,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    if (req.params.id === auth.sub) {
      throw new ApiError(403, 'forbidden', 'You cannot delete your own account.');
    }
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'not_found', 'User not found.');
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  })
);
