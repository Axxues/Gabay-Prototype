import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken } from '../middleware/auth.js';

export const usersRouter = Router();

const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  department: true,
  title: true,
} as const;

const EDITABLE_FIELDS = ['name', 'avatar', 'department', 'title'] as const;
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
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'not_found', 'User not found.');
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: PUBLIC_USER,
    });
    res.json({ user });
  })
);
