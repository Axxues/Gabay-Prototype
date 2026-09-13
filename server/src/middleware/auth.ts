import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError, asyncHandler } from '../utils/errors.js';
import { USER_ROLES } from '../utils/allowed.js';

export interface AuthPayload {
  sub: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

export const authenticateToken = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new ApiError(401, 'unauthorized', 'Missing bearer token.');
  try {
    const payload = jwt.verify(token, secret()) as AuthPayload;
    if (!payload.sub || !USER_ROLES.includes(payload.role as never)) {
      throw new ApiError(401, 'unauthorized', 'Invalid token.');
    }
    req.auth = payload;
    next();
  } catch {
    throw new ApiError(401, 'unauthorized', 'Invalid or expired token.');
  }
});

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw new ApiError(403, 'forbidden', 'Insufficient role.');
    }
    next();
  };
}

export function signToken(sub: string, role: string): string {
  return jwt.sign({ sub, role }, secret(), { expiresIn: '24h' });
}
