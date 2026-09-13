import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const sprRouter = Router();

function parseScoreMap(value: unknown, field: string): Record<string, number | null> {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be an object.`);
  }
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== null && (typeof v !== 'number' || Number.isNaN(v) || v < 0)) {
      throw new ApiError(400, 'bad_request', `Field '${field}.${k}' must be a non-negative number or null.`);
    }
    out[k] = v as number | null;
  }
  return out;
}

function parseExam(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be a non-negative number or null.`);
  }
  return value;
}

sprRouter.get(
  '/courses/:id/spr',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
    res.json({ config: course.sprConfig ? JSON.parse(course.sprConfig) : null });
  })
);

sprRouter.put(
  '/courses/:id/spr',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
    if (req.auth!.role !== 'admin' && course.instructorId !== req.auth!.sub) {
      throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
    }
    const config = (req.body ?? {}).config;
    if (!config || typeof config !== 'object') {
      throw new ApiError(400, 'bad_request', "Field 'config' is required.");
    }
    const updated = await prisma.course.update({
      where: { id: course.id },
      data: { sprConfig: JSON.stringify(config) },
    });
    res.json({ config: JSON.parse(updated.sprConfig!) });
  })
);

sprRouter.put(
  '/courses/:id/spr/:studentId',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
    if (req.auth!.role !== 'admin' && course.instructorId !== req.auth!.sub) {
      throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const cells = {
      midtermScores: parseScoreMap(body.midtermScores, 'midtermScores'),
      mtExam: parseExam(body.mtExam, 'mtExam'),
      finalScores: parseScoreMap(body.finalScores, 'finalScores'),
      ftExam: parseExam(body.ftExam, 'ftExam'),
    };
    const grade = await prisma.courseGrade.upsert({
      where: { courseId_studentId: { courseId: course.id, studentId: req.params.studentId } },
      update: { sprCells: JSON.stringify(cells) },
      create: { courseId: course.id, studentId: req.params.studentId, sprCells: JSON.stringify(cells) },
    });
    res.json({ cells: JSON.parse(grade.sprCells!) });
  })
);
