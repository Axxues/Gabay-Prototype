import { Router } from 'express';
import { ApiError, asyncHandler } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { assertCourseAccess, assertCourseOwner, loadCourseOr404 } from '../utils/courseAccess.js';
import {
  PrismaSyllabusRepository,
  SyllabusConflictError,
  SyllabusNotFoundError,
  SyllabusPublishError,
  SyllabusRepositoryError,
  SyllabusSourceFileError,
  type SyllabusRepository,
  type SyllabusRevisionEnvelope,
} from '../syllabi/repository.js';
import { SyllabusNormalizationError } from '../utils/syllabusNormalization.js';
import { prisma } from '../db.js';
import { saveCourseSyllabus } from '../likha/repositories/syllabiRepo.js';
import {
  SYLLABUS_SECTION_KEYS,
  SyllabusValidationError,
  parseExpectedRowVersion,
  validateSectionPayload,
} from '../syllabi/validation.js';
import type { SyllabusSectionKey } from '../syllabi/contracts.js';

export type SyllabusRevisionResponse = SyllabusRevisionEnvelope;

const mapSyllabusError = (err: unknown): unknown => {
  if (err instanceof SyllabusNotFoundError) return new ApiError(404, err.code, err.message);
  if (err instanceof SyllabusConflictError) return new ApiError(409, err.code, err.message);
  if (err instanceof SyllabusPublishError) return new ApiError(422, err.code, err.message);
  if (
    err instanceof SyllabusValidationError ||
    err instanceof SyllabusRepositoryError ||
    err instanceof SyllabusSourceFileError ||
    err instanceof SyllabusNormalizationError
  ) {
    return new ApiError(422, 'invalid_syllabus_section', (err as Error).message);
  }
  return err;
};

const runSyllabus = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (err) {
    throw mapSyllabusError(err);
  }
};

let activeRepository: SyllabusRepository | null = null;

export function getSyllabusRepository(): SyllabusRepository {
  if (!activeRepository) activeRepository = new PrismaSyllabusRepository(prisma);
  return activeRepository;
}

export function setSyllabusRepository(repository: SyllabusRepository | null): void {
  activeRepository = repository;
}

export function createSyllabusRouter(repository: SyllabusRepository = getSyllabusRepository()) {
  const router = Router();

  router.get(
    '/:courseId/syllabus',
    authenticateToken,
    asyncHandler(async (req, res) => {
      const course = await loadCourseOr404(req.params.courseId);
      await assertCourseAccess(course, req.auth!);
      const envelope = await runSyllabus(() => repository.getPublishedEnvelope(course.id));
      if (!envelope) throw new ApiError(404, 'syllabus_not_found', 'No published syllabus for this course.');
      res.json(envelope satisfies SyllabusRevisionResponse);
    }),
  );

  router.get(
    '/:courseId/syllabus/revisions',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const course = await loadCourseOr404(req.params.courseId);
      assertCourseOwner(course, req.auth!);
      const revisions = await runSyllabus(() => repository.listRevisions(course.id));
      res.json({ revisions });
    }),
  );

  router.post(
    '/:courseId/syllabus/revisions',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const course = await loadCourseOr404(req.params.courseId);
      assertCourseOwner(course, req.auth!);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const sourceRevisionId =
        typeof body.sourceRevisionId === 'string' && body.sourceRevisionId !== ''
          ? body.sourceRevisionId
          : undefined;
      const revision = await runSyllabus(() => repository.createDraft(course.id, req.auth!.sub, sourceRevisionId));
      const envelope = await runSyllabus(() => repository.getRevisionEnvelope(course.id, revision.id));
      if (!envelope) throw new ApiError(404, 'syllabus_not_found', 'The syllabus revision was not found for this course.');
      res.status(201).json(envelope satisfies SyllabusRevisionResponse);
    }),
  );

  router.get(
    '/:courseId/syllabus/revisions/:revisionId',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const course = await loadCourseOr404(req.params.courseId);
      assertCourseOwner(course, req.auth!);
      const envelope = await runSyllabus(() => repository.getRevisionEnvelope(course.id, req.params.revisionId));
      if (!envelope) throw new ApiError(404, 'syllabus_not_found', 'The syllabus revision was not found for this course.');
      res.json(envelope satisfies SyllabusRevisionResponse);
    }),
  );

  router.patch(
    '/:courseId/syllabus/revisions/:revisionId/sections/:section',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const course = await loadCourseOr404(req.params.courseId);
      assertCourseOwner(course, req.auth!);
      const section = req.params.section as SyllabusSectionKey;
      if (!(SYLLABUS_SECTION_KEYS as readonly string[]).includes(section)) {
        throw new ApiError(422, 'invalid_syllabus_section', `Unknown syllabus section: ${req.params.section}.`);
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const value = await runSyllabus(async () => validateSectionPayload(section, body.value));
      const expectedRowVersion = await runSyllabus(async () => parseExpectedRowVersion(req));
      await runSyllabus(() =>
        repository.replaceSection(course.id, req.params.revisionId, expectedRowVersion, section, value),
      );
      const envelope = await runSyllabus(() => repository.getRevisionEnvelope(course.id, req.params.revisionId));
      if (!envelope) throw new ApiError(404, 'syllabus_not_found', 'The syllabus revision was not found for this course.');
      res.json(envelope satisfies SyllabusRevisionResponse);
    }),
  );

  router.post(
    '/:courseId/syllabus/revisions/:revisionId/publish',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const course = await loadCourseOr404(req.params.courseId);
      assertCourseOwner(course, req.auth!);
      const expectedRowVersion = await runSyllabus(async () => parseExpectedRowVersion(req));
      await runSyllabus(() =>
        repository.publish(course.id, req.params.revisionId, expectedRowVersion, req.auth!.sub),
      );
      const envelope = await runSyllabus(() => repository.getRevisionEnvelope(course.id, req.params.revisionId));
      if (!envelope) throw new ApiError(404, 'syllabus_not_found', 'The syllabus revision was not found for this course.');
      try {
        await saveCourseSyllabus(course.id, envelope.syllabus);
      } catch (e) {
        console.warn('[syllabi] Failed to sync published syllabus to Likha:', e);
      }
      res.json(envelope satisfies SyllabusRevisionResponse);
    }),
  );

  router.delete(
    '/:courseId/syllabus/revisions/:revisionId',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const course = await loadCourseOr404(req.params.courseId);
      assertCourseOwner(course, req.auth!);
      await runSyllabus(() => repository.deleteDraft(course.id, req.params.revisionId));
      res.json({ ok: true });
    }),
  );

  router.delete(
    '/:courseId/syllabus',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const course = await loadCourseOr404(req.params.courseId);
      assertCourseOwner(course, req.auth!);
      await runSyllabus(() => repository.withdrawSyllabus(course.id));
      res.json({ ok: true });
    }),
  );

  return router;
}

export const syllabusRouter = createSyllabusRouter();
