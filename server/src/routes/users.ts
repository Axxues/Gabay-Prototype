import { Router } from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { USER_ROLES, isOneOf } from '../utils/allowed.js';
import {
  getUserById,
  getUserByEmail,
  getAllUsers,
  createLikhaUser,
  updateLikhaUser,
  deleteLikhaUser,
} from '../likha/repositories/usersRepo.js';
import { prisma } from '../db.js';
import bcrypt from 'bcryptjs';

export const usersRouter = Router();

const EDITABLE_FIELDS = ['name', 'avatar', 'banner', 'department', 'title', 'email', 'role', 'password'] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

usersRouter.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const prismaUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (prismaUser) {
      const { passwordHash: _, ...publicUser } = prismaUser;
      res.json({ user: publicUser });
      return;
    }

    const user = await getUserById(req.params.id);
    if (!user) throw new ApiError(404, 'not_found', 'User not found.');
    res.json({ user });
  })
);

usersRouter.get(
  '/',
  authenticateToken,
  asyncHandler(async (_req, res) => {
    const prismaUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        department: true,
        title: true,
      },
    });

    if (prismaUsers && prismaUsers.length > 0) {
      res.json({ users: prismaUsers });
      return;
    }

    const users = await getAllUsers();
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

    const existingPrisma = await prisma.user.findUnique({ where: { email } });
    if (existingPrisma) {
      throw new ApiError(409, 'conflict', 'Email is already in use.');
    }

    if (process.env.NODE_ENV !== 'test') {
      const dupe = await getUserByEmail(email);
      if (dupe) throw new ApiError(409, 'conflict', 'Email is already in use.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const prismaUser = await prisma.user.create({
      data: {
        id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        email,
        role,
        passwordHash,
        ...optional,
      },
    });

    try {
      await createLikhaUser({
        name: name.trim(),
        email,
        role,
        password,
        avatar: optional.avatar,
        banner: optional.banner || undefined,
        department: optional.department,
        title: optional.title,
      });
    } catch (e) {
      console.warn('[users] Likha createLikhaUser failed:', e);
    }

    const { passwordHash: _, ...publicUser } = prismaUser;
    res.status(201).json({ user: publicUser });
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

    const existingPrisma = await prisma.user.findUnique({ where: { id: req.params.id } });
    let existingLikha = null;
    if (!existingPrisma) {
      existingLikha = await getUserById(req.params.id);
      if (!existingLikha) throw new ApiError(404, 'not_found', 'User not found.');
    }

    if (data.email !== undefined) {
      if (existingPrisma && data.email !== existingPrisma.email) {
        const clash = await prisma.user.findUnique({ where: { email: data.email } });
        if (clash) throw new ApiError(409, 'conflict', 'Email is already in use.');
      }
      if (existingLikha && data.email !== existingLikha.email) {
        const clash = await getUserByEmail(data.email);
        if (clash) throw new ApiError(409, 'conflict', 'Email is already in use.');
      }
    }

    let updatedPrisma: any = null;
    if (existingPrisma) {
      const updateData: any = { ...data };
      if (data.password) {
        updateData.passwordHash = await bcrypt.hash(data.password, 10);
        delete updateData.password;
      }
      updatedPrisma = await prisma.user.update({
        where: { id: req.params.id },
        data: updateData,
      });
    }

    try {
      await updateLikhaUser(req.params.id, data as any);
    } catch (e) {
      console.warn('[users] Likha updateLikhaUser failed:', e);
    }

    if (updatedPrisma) {
      const { passwordHash: _, ...publicUser } = updatedPrisma;
      res.json({ user: publicUser });
      return;
    }

    const user = await getUserById(req.params.id);
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

    const existingPrisma = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existingPrisma) {
      const existingLikha = await getUserById(req.params.id);
      if (!existingLikha) throw new ApiError(404, 'not_found', 'User not found.');
    }

    if (existingPrisma) {
      await prisma.user.delete({ where: { id: req.params.id } });
    }

    try {
      await deleteLikhaUser(req.params.id);
    } catch (e) {
      console.warn('[users] Likha deleteLikhaUser failed:', e);
    }

    res.json({ ok: true });
  })
);
