import { Router } from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken } from '../middleware/auth.js';
import { authenticateUser, getUserById } from '../likha/repositories/usersRepo.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      throw new ApiError(400, 'bad_request', 'Email and password are required.');
    }
    const { user, token } = await authenticateUser(email, password);
    res.json({ token, user });
  })
);

authRouter.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.auth!.sub);
    if (!user) throw new ApiError(401, 'unauthorized', 'Account no longer exists.');
    res.json({ user });
  })
);
