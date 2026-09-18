import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { parseJsonField, stringifyJsonField } from '../utils/jsonFields.js';

export const quizzesRouter = buildAssessmentRouter('quiz');
export const activitiesRouter = buildAssessmentRouter('activity');
export const examsRouter = buildAssessmentRouter('exam');

type AssessmentKind = 'quiz' | 'activity' | 'exam';

const KNOWN_TERMS = ['prelim', 'midterm', 'finals'] as const;

function parseTermInput(value: unknown, field = 'term'): string {
  if (typeof value !== 'string' || !(KNOWN_TERMS as readonly string[]).includes(value)) {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be one of prelim, midterm, finals.`);
  }
  return value;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface CourseRow {
  id: string;
  instructorId: string;
}

type RawQuestion = Record<string, unknown> & { options: string };

interface AssessmentRow {
  id: string;
  courseId: string;
  title: string;
  questions: RawQuestion[];
  format?: string | null;
}

async function loadCourseOr404(courseId: string) {
  // Narrow select: access checks only need id/instructorId. A full row drag
  // would pull the multi-MB image/syllabus blobs on every course-scoped call.
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  return course;
}

async function assertCourseAccess(course: CourseRow, auth: AuthPayload): Promise<void> {
  if (auth.role === 'faculty' || auth.role === 'admin') return;
  if (course.instructorId === auth.sub) return;
  const membership = await prisma.enrollmentRequest.findFirst({
    where: { courseId: course.id, studentId: auth.sub, status: 'approved' },
  });
  if (!membership) throw new ApiError(403, 'forbidden', 'You are not a member of this course.');
}

function assertCourseOwner(course: { instructorId: string }, auth: AuthPayload): void {
  if (auth.role !== 'admin' && course.instructorId !== auth.sub) {
    throw new ApiError(403, 'forbidden', 'Only the course instructor can do this.');
  }
}

// `options` is stored as a JSON string; the API speaks arrays.
function mapQuestion(q: RawQuestion): Record<string, unknown> {
  return { ...q, options: parseJsonField<unknown[]>(q.options, []) };
}

// Students must never see the key — delete it, don't null it.
function stripAnswer(q: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...q };
  delete rest.correctAnswer;
  return rest;
}

function canSeeAnswers(role: string): boolean {
  return role === 'faculty' || role === 'admin';
}

function mapQuestionsFor(role: string, questions: RawQuestion[]): Record<string, unknown>[] {
  return questions
    .map(mapQuestion)
    .map((q) => (canSeeAnswers(role) ? q : stripAnswer(q)));
}

function mapSubmission<T extends { rubricScores: string }>(s: T) {
  return { ...s, rubricScores: parseJsonField<Record<string, number>>(s.rubricScores, {}) };
}

function mapActivity<T extends { id: string; submissionTypes?: string | null; rubric?: string | null }>(a: T) {
  return {
    ...a,
    submissionTypes: parseJsonField<unknown[]>(a.submissionTypes, []),
    rubric: parseJsonField<unknown[]>(a.rubric, []),
  };
}

// Column widths (schema.prisma): oversized values would otherwise surface as
// an opaque 500 from the driver. Reject early with an honest 400 instead —
// same rule as the modules items guard. Data URLs (>1024 chars) must never
// be embedded here; the client uploads bytes to /files/upload first.
const ACTIVITY_STRING_MAX: Record<string, number> = {
  title: 256,
  category: 64,
  fileName: 256,
  fileUrl: 1024,
  fileSize: 32,
  sectionRestriction: 128,
};

function assertActivityStringLengths(body: Record<string, unknown>): void {
  for (const [key, max] of Object.entries(ACTIVITY_STRING_MAX)) {
    const value = body[key];
    if (typeof value !== 'string') continue;
    if (value.length > max) {
      throw new ApiError(
        400,
        'bad_request',
        `Field '${key}' exceeds the ${max}-character limit. Upload the file to the server first instead of embedding it as a data URL.`
      );
    }
  }
}

const QUESTION_STRING_FIELDS = [
  'description',
  'rubricNotes',
  'imageUrl',
  'imageName',
  'fileUrl',
  'fileName',
] as const;

interface ParsedQuestion {
  text: string;
  type: string;
  options: unknown[];
  correctAnswer: string | null;
  points: number;
  extras: Record<string, string | null>;
}

function parseQuestionInput(raw: unknown, index: number): ParsedQuestion {
  const q = (raw ?? {}) as Record<string, unknown>;
  if (typeof q.text !== 'string' || !q.text.trim()) {
    throw new ApiError(400, 'bad_request', `Question ${index + 1}: field text is required.`);
  }
  if (q.type !== undefined && typeof q.type !== 'string') {
    throw new ApiError(400, 'bad_request', `Question ${index + 1}: field type must be a string.`);
  }
  const options = q.options === undefined ? [] : q.options;
  if (!Array.isArray(options)) {
    throw new ApiError(400, 'bad_request', `Question ${index + 1}: field options must be an array.`);
  }
  if (q.correctAnswer !== undefined && q.correctAnswer !== null && typeof q.correctAnswer !== 'string') {
    throw new ApiError(400, 'bad_request', `Question ${index + 1}: field correctAnswer must be a string.`);
  }
  if (q.points !== undefined && typeof q.points !== 'number') {
    throw new ApiError(400, 'bad_request', `Question ${index + 1}: field points must be a number.`);
  }
  const extras: Record<string, string | null> = {};
  for (const key of QUESTION_STRING_FIELDS) {
    const value = q[key];
    if (value === undefined || value === null) {
      extras[key] = null;
    } else if (typeof value !== 'string') {
      throw new ApiError(400, 'bad_request', `Question ${index + 1}: field '${key}' must be a string.`);
    } else {
      extras[key] = value;
    }
  }
  return {
    text: q.text,
    type: typeof q.type === 'string' && q.type ? q.type : 'multiple_choice',
    options,
    correctAnswer: typeof q.correctAnswer === 'string' ? q.correctAnswer : null,
    points: typeof q.points === 'number' ? q.points : 1,
    extras,
  };
}

function parseQuestionsInput(body: Record<string, unknown>): ParsedQuestion[] {
  const raw = body.questions === undefined ? [] : body.questions;
  if (!Array.isArray(raw)) {
    throw new ApiError(400, 'bad_request', 'Field questions must be an array.');
  }
  return raw.map((q, i) => parseQuestionInput(q, i));
}

function parseOptionalDate(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be a date string.`);
  }
  return new Date(value);
}

function buildAssessmentRouter(kind: AssessmentKind) {
  const router = Router();
  const isQuiz = kind === 'quiz';
  const isExam = kind === 'exam';
  const singular = isQuiz ? 'Quiz' : isExam ? 'Exam' : 'Activity';
  const syntheticActivityKey = (id: string) =>
    isQuiz ? `asg-quiz-${id}` : isExam ? `asg-exam-${id}` : `asg-activity-${id}`;

  async function loadOr404(id: string): Promise<AssessmentRow> {
    const row = (isQuiz
      ? await prisma.quiz.findUnique({ where: { id }, include: { questions: true } })
      : isExam
        ? await prisma.exam.findUnique({ where: { id }, include: { questions: true } })
        : await prisma.activity.findUnique({
            where: { id },
            include: { questions: true },
          })) as unknown as AssessmentRow | null;
    if (!row) throw new ApiError(404, 'not_found', `${singular} not found.`);
    return row;
  }

  async function listForCourse(courseId: string): Promise<AssessmentRow[]> {
    const rows = (isQuiz
      ? await prisma.quiz.findMany({ where: { courseId }, include: { questions: true } })
      : isExam
        ? await prisma.exam.findMany({ where: { courseId }, include: { questions: true } })
        : await prisma.activity.findMany({
            where: { courseId },
            include: { questions: true },
          })) as unknown as AssessmentRow[];
    return rows;
  }

  router.get(
    '/',
    authenticateToken,
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const courseId = req.query.courseId;
      if (typeof courseId !== 'string' || !courseId) {
        throw new ApiError(400, 'bad_request', 'Query param courseId is required.');
      }
      const course = await loadCourseOr404(courseId);
      await assertCourseAccess(course, auth);
      const rows = await listForCourse(course.id);
      const items = rows.map((r) => ({
        ...((isQuiz || isExam) ? r : mapActivity(r)),
        questions: mapQuestionsFor(auth.role, r.questions),
      }));
      res.json(isQuiz ? { quizzes: items } : isExam ? { exams: items } : { activities: items });
    })
  );

  router.post(
    '/',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const { courseId } = body;
      if (typeof courseId !== 'string' || !courseId) {
        throw new ApiError(400, 'bad_request', 'Field courseId is required.');
      }
      const course = await loadCourseOr404(courseId);
      assertCourseOwner(course, auth);
      const { title, instructions } = body;
      if (typeof title !== 'string' || !title.trim()) {
        throw new ApiError(400, 'bad_request', 'Field title is required.');
      }
      if (typeof instructions !== 'string' || !instructions.trim()) {
        throw new ApiError(400, 'bad_request', 'Field instructions is required.');
      }
      const published = typeof body.published === 'boolean' ? body.published : false;
      const questions = parseQuestionsInput(body);

      if (isQuiz) {
        const timeLimitMinutes =
          typeof body.timeLimitMinutes === 'number' ? body.timeLimitMinutes : 30;
        const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
        const created = await prisma.quiz.create({
          data: {
            id: newId('quiz'),
            courseId: course.id,
            title,
            instructions,
            timeLimitMinutes,
            published,
            term: parseTermInput(body.term ?? 'midterm'),
            delayedUntil: parseOptionalDate(body.delayedUntil, 'delayedUntil') ?? null,
            dueDate: parseOptionalDate(body.dueDate, 'dueDate') ?? null,
            fileName: str(body.fileName),
            fileUrl: str(body.fileUrl),
            fileSize: str(body.fileSize),
          },
        });
        const rows: RawQuestion[] = [];
        for (const q of questions) {
          rows.push(
            (await prisma.quizQuestion.create({
              data: {
                id: newId('qq'),
                quizId: created.id,
                text: q.text,
                type: q.type,
                options: stringifyJsonField(q.options),
                correctAnswer: q.correctAnswer,
                points: q.points,
                ...q.extras,
              },
            })) as unknown as RawQuestion
          );
        }
        res.status(201).json({
          quiz: { ...created, questions: mapQuestionsFor(auth.role, rows) },
        });
        return;
      }

      if (isExam) {
        const term = parseTermInput(body.term);
        const timeLimitMinutes =
          typeof body.timeLimitMinutes === 'number' ? body.timeLimitMinutes : 30;
        const created = await prisma.exam.create({
          data: {
            id: newId('exam'),
            courseId: course.id,
            title,
            instructions,
            timeLimitMinutes,
            published,
            dueDate: parseOptionalDate(body.dueDate, 'dueDate') ?? null,
            term,
          },
        });
        const rows: RawQuestion[] = [];
        for (const q of questions) {
          rows.push(
            (await prisma.quizQuestion.create({
              data: {
                id: newId('qq'),
                examId: created.id,
                text: q.text,
                type: q.type,
                options: stringifyJsonField(q.options),
                correctAnswer: q.correctAnswer,
                points: q.points,
                ...q.extras,
              },
            })) as unknown as RawQuestion
          );
        }
        res.status(201).json({
          exam: { ...created, questions: mapQuestionsFor(auth.role, rows) },
        });
        return;
      }

      const { pointsPossible } = body;
      if (typeof pointsPossible !== 'number') {
        throw new ApiError(400, 'bad_request', 'Field pointsPossible must be a number.');
      }
      if (body.format === 'classic') {
        const { dueDate } = body;
        const due =
          dueDate instanceof Date ? dueDate : typeof dueDate === 'string' ? new Date(dueDate) : null;
        if (!due || isNaN(due.getTime())) {
          throw new ApiError(400, 'bad_request', 'Field dueDate must be a valid date.');
        }
        const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
        const term = body.term === undefined ? 'midterm' : parseTermInput(body.term);
        assertActivityStringLengths(body);
        const created = await prisma.activity.create({
          data: {
            id: newId('act'),
            courseId: course.id,
            title,
            instructions,
            format: 'classic',
            term,
            pointsPossible,
            dueDate: due,
            submissionTypes: stringifyJsonField(
              Array.isArray(body.submissionTypes) ? body.submissionTypes : []
            ),
            published,
            category: str(body.category) ?? '',
            weight: typeof body.weight === 'number' ? body.weight : 0,
            rubric: stringifyJsonField(Array.isArray(body.rubric) ? body.rubric : []),
            fileName: str(body.fileName) ?? null,
            fileUrl: str(body.fileUrl) ?? null,
            fileSize: str(body.fileSize) ?? null,
            availableFrom: str(body.availableFrom) ? new Date(str(body.availableFrom)!) : null,
            availableUntil: str(body.availableUntil) ? new Date(str(body.availableUntil)!) : null,
            sectionRestriction: str(body.sectionRestriction) ?? null,
          },
        });
        res.status(201).json({ activity: { ...mapActivity(created), questions: [] } });
        return;
      }
      const created = await prisma.activity.create({
        data: {
          id: newId('act'),
          courseId: course.id,
          title,
          instructions,
          format: 'questionset',
          pointsPossible,
          term: parseTermInput(body.term ?? 'midterm'),
          dueDate: parseOptionalDate(body.dueDate, 'dueDate') ?? null,
          published,
        },
      });
      const rows: RawQuestion[] = [];
      for (const q of questions) {
        rows.push(
          (await prisma.quizQuestion.create({
            data: {
              id: newId('qq'),
              activityId: created.id,
              text: q.text,
              type: q.type,
              options: stringifyJsonField(q.options),
              correctAnswer: q.correctAnswer,
              points: q.points,
              ...q.extras,
            },
          })) as unknown as RawQuestion
        );
      }
      res.status(201).json({
        activity: { ...created, questions: mapQuestionsFor(auth.role, rows) },
      });
    })
  );

  router.get(
    '/:id',
    authenticateToken,
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const row = await loadOr404(req.params.id);
      const course = await loadCourseOr404(row.courseId);
      await assertCourseAccess(course, auth);
      const base = isQuiz || isExam ? row : mapActivity(row);
      const item = { ...base, questions: mapQuestionsFor(auth.role, row.questions) };
      res.json(isQuiz ? { quiz: item } : isExam ? { exam: item } : { activity: item });
    })
  );

  router.patch(
    '/:id',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const row = await loadOr404(req.params.id);
      const course = await loadCourseOr404(row.courseId);
      assertCourseOwner(course, auth);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const data: Record<string, string | boolean | number | Date | null> = {};
      if (body.title !== undefined) {
        if (typeof body.title !== 'string' || !body.title.trim()) {
          throw new ApiError(400, 'bad_request', "Field 'title' must be a non-empty string.");
        }
        data.title = body.title;
      }
      if (body.instructions !== undefined) {
        if (typeof body.instructions !== 'string' || !body.instructions.trim()) {
          throw new ApiError(400, 'bad_request', "Field 'instructions' must be a non-empty string.");
        }
        data.instructions = body.instructions;
      }
      if (body.published !== undefined) {
        if (typeof body.published !== 'boolean') {
          throw new ApiError(400, 'bad_request', "Field 'published' must be a boolean.");
        }
        data.published = body.published;
      }
      for (const key of ['dueDate', 'delayedUntil'] as const) {
        if (isQuiz || key === 'dueDate') {
          const parsed = parseOptionalDate(body[key], key);
          if (parsed !== undefined) data[key] = parsed;
        }
      }
      if (isQuiz) {
        if (body.timeLimitMinutes !== undefined) {
          if (typeof body.timeLimitMinutes !== 'number') {
            throw new ApiError(400, 'bad_request', "Field 'timeLimitMinutes' must be a number.");
          }
          data.timeLimitMinutes = body.timeLimitMinutes;
        }
        if (body.term !== undefined) {
          data.term = parseTermInput(body.term);
        }
        const updated = await prisma.quiz.update({ where: { id: row.id }, data });
        res.json({ quiz: updated });
        return;
      }
      if (isExam) {
        if (body.timeLimitMinutes !== undefined) {
          if (typeof body.timeLimitMinutes !== 'number') {
            throw new ApiError(400, 'bad_request', "Field 'timeLimitMinutes' must be a number.");
          }
          data.timeLimitMinutes = body.timeLimitMinutes;
        }
        if (body.term !== undefined) {
          data.term = parseTermInput(body.term);
        }
        const updated = await prisma.exam.update({ where: { id: row.id }, data });
        res.json({ exam: updated });
        return;
      }
      if (body.pointsPossible !== undefined) {
        if (typeof body.pointsPossible !== 'number') {
          throw new ApiError(400, 'bad_request', "Field 'pointsPossible' must be a number.");
        }
        data.pointsPossible = body.pointsPossible;
      }
      if (body.term !== undefined) {
        data.term = parseTermInput(body.term);
      }
      assertActivityStringLengths(body);
      for (const key of ['category', 'fileName', 'fileUrl', 'fileSize', 'sectionRestriction'] as const) {
        const value = body[key];
        if (value === undefined) continue;
        if (typeof value !== 'string') {
          throw new ApiError(400, 'bad_request', `Field '${key}' must be a string.`);
        }
        data[key] = value;
      }
      if (body.weight !== undefined) {
        if (typeof body.weight !== 'number') {
          throw new ApiError(400, 'bad_request', "Field 'weight' must be a number.");
        }
        data.weight = body.weight;
      }
      if (body.submissionTypes !== undefined) {
        if (!Array.isArray(body.submissionTypes)) {
          throw new ApiError(400, 'bad_request', "Field 'submissionTypes' must be an array.");
        }
        data.submissionTypes = stringifyJsonField(body.submissionTypes);
      }
      if (body.rubric !== undefined) {
        if (!Array.isArray(body.rubric)) {
          throw new ApiError(400, 'bad_request', "Field 'rubric' must be an array.");
        }
        data.rubric = stringifyJsonField(body.rubric);
      }
      for (const key of ['availableFrom', 'availableUntil'] as const) {
        const value = body[key];
        if (value === undefined) continue;
        if (typeof value !== 'string') {
          throw new ApiError(400, 'bad_request', `Field '${key}' must be a date string.`);
        }
        data[key] = new Date(value);
      }
      const updated = await prisma.activity.update({ where: { id: row.id }, data });
      res.json({ activity: mapActivity(updated) });
    })
  );

  router.delete(
    '/:id',
    authenticateToken,
    requireRole('faculty', 'admin'),
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const row = await loadOr404(req.params.id);
      const course = await loadCourseOr404(row.courseId);
      assertCourseOwner(course, auth);
      if (isQuiz) {
        await prisma.quiz.delete({ where: { id: row.id } });
      } else if (isExam) {
        await prisma.exam.delete({ where: { id: row.id } });
      } else {
        await prisma.activity.delete({ where: { id: row.id } });
      }
      res.json({ ok: true });
    })
  );

  router.get(
    '/:id/submissions',
    authenticateToken,
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const row = await loadOr404(req.params.id);
      const course = await loadCourseOr404(row.courseId);
      // Classic activities link submissions by the raw activityKey row id;
      // question-set activities link via the activityId FK (synthetic
      // asg-activity-<id> key). Quiz/exam branches stay FK-only.
      const isClassic = !isQuiz && !isExam && row.format === 'classic';
      const where = (
        isQuiz
          ? { quizId: row.id }
          : isExam
            ? { examId: row.id }
            : isClassic
              ? { activityKey: row.id }
              : { activityId: row.id }
      ) as Record<string, string>;
      if (auth.role === 'faculty' || auth.role === 'admin') {
        assertCourseOwner(course, auth);
        const submissions = await prisma.submission.findMany({
          where,
          include: { comments: true },
          orderBy: { submittedAt: 'desc' },
        });
        res.json({ submissions: submissions.map(mapSubmission) });
        return;
      }
      await assertCourseAccess(course, auth);
      const submissions = await prisma.submission.findMany({
        where: { ...where, studentId: auth.sub },
        include: { comments: true },
        orderBy: { submittedAt: 'desc' },
      });
      res.json({ submissions: submissions.map(mapSubmission) });
    })
  );

  router.post(
    '/:id/submissions',
    authenticateToken,
    requireRole('student'),
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const row = await loadOr404(req.params.id);
      const course = await loadCourseOr404(row.courseId);
      await assertCourseAccess(course, auth);
      if (!isQuiz && !isExam && row.format !== 'classic') {
        throw new ApiError(400, 'bad_request', 'This endpoint only accepts classic-format activities.');
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
      const content =
        str(body.content) ??
        (body.answers !== undefined ? stringifyJsonField(body.answers) : undefined) ??
        null;
      const submissionType =
        str(body.submissionType) ?? (body.fileUrl || body.fileName ? 'file' : 'online_text');
      const me = await prisma.user.findUnique({ where: { id: auth.sub } });
      const existing = await prisma.submission.findFirst({
        where: { activityKey: row.id, studentId: auth.sub },
      });
      // Scoring stays client-side per current design — compute nothing here.
      const submission = existing
        ? await prisma.submission.update({
            where: { id: existing.id },
            data: {
              submissionType,
              content,
              fileUrl: str(body.fileUrl) ?? null,
              fileName: str(body.fileName) ?? null,
              status: 'submitted',
              submittedAt: new Date(),
            },
          })
        : await prisma.submission.create({
            data: {
              id: newId('sub'),
              activityKey: row.id,
              courseId: course.id,
              studentId: auth.sub,
              studentName: me?.name ?? '',
              studentAvatar: me?.avatar ?? '',
              submissionType,
              content,
              fileUrl: str(body.fileUrl) ?? null,
              fileName: str(body.fileName) ?? null,
              status: 'submitted',
              rubricScores: stringifyJsonField({}),
            },
          });
      await createNotification({
        type: 'activity_submitted',
        recipientId: course.instructorId,
        actorId: auth.sub,
        actorName: me?.name ?? '',
        actorAvatar: me?.avatar ?? '',
        relatedId: row.id,
        relatedTitle: row.title,
        content: `${me?.name ?? 'A student'} submitted ${row.title}.`,
      });
      res.status(201).json({ submission: mapSubmission(submission) });
    })
  );

  router.post(
    '/:id/submit',
    authenticateToken,
    requireRole('student'),
    asyncHandler(async (req, res) => {
      const auth = req.auth!;
      const row = await loadOr404(req.params.id);
      const course = await loadCourseOr404(row.courseId);
      await assertCourseAccess(course, auth);
      if (!isQuiz && !isExam && row.format === 'classic') {
        throw new ApiError(400, 'bad_request', 'This endpoint only accepts question-set activities.');
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.answers !== 'object' || body.answers === null || Array.isArray(body.answers)) {
        throw new ApiError(400, 'bad_request', 'Field answers must be an object.');
      }
      const answers = body.answers as Record<string, string>;
      const activityKey = syntheticActivityKey(row.id);
      const me = await prisma.user.findUnique({ where: { id: auth.sub } });
      const existing = await prisma.submission.findFirst({
        where: { activityKey, studentId: auth.sub },
      });
      const content = stringifyJsonField(answers);
      // Quiz-taking state lives in Submission rows under the synthetic
      // asg-quiz-<id> / asg-activity-<id> / asg-exam-<id> activityKey convention
      // (SpeedGrader compat). Essay answers are stored as-is; grading happens
      // via the submissions grade endpoint.
      const submission = existing
        ? await prisma.submission.update({
            where: { id: existing.id },
            data: {
              content,
              status: 'submitted',
              submittedAt: new Date(),
              ...(isQuiz ? { quizId: row.id } : isExam ? { examId: row.id } : { activityId: row.id }),
            },
          })
        : await prisma.submission.create({
            data: {
              id: newId('sub'),
              activityKey,
              ...(isQuiz ? { quizId: row.id } : isExam ? { examId: row.id } : { activityId: row.id }),
              courseId: course.id,
              studentId: auth.sub,
              studentName: me?.name ?? '',
              studentAvatar: me?.avatar ?? '',
              submissionType: 'online_text',
              content,
              status: 'submitted',
              rubricScores: stringifyJsonField({}),
            },
          });
      await createNotification({
        type: 'activity_submitted',
        recipientId: course.instructorId,
        actorId: auth.sub,
        actorName: me?.name ?? '',
        actorAvatar: me?.avatar ?? '',
        relatedId: row.id,
        relatedTitle: row.title,
        content: `${me?.name ?? 'A student'} submitted ${row.title}.`,
      });
      res.status(201).json({ submission: mapSubmission(submission) });
    })
  );

  return router;
}

export const submissionsRouter = Router();

submissionsRouter.post(
  '/submissions/:submissionId/grade',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.submissionId },
    });
    if (!submission) throw new ApiError(404, 'not_found', 'Submission not found.');
    // Quiz/activity submissions carry the synthetic asg-quiz-*/asg-activity-*
    // activityKey (no classic Activity row for question-set kinds) — resolve
    // ownership through the quiz/activity course instead. Classic submissions
    // carry the activity row id as activityKey.
    let relatedId: string;
    let relatedTitle: string;
    let course;
    if (submission.quizId) {
      const quiz = await prisma.quiz.findUnique({ where: { id: submission.quizId } });
      if (!quiz) throw new ApiError(404, 'not_found', 'Quiz not found.');
      course = await loadCourseOr404(quiz.courseId);
      assertCourseOwner(course, auth);
      relatedId = quiz.id;
      relatedTitle = quiz.title;
    } else if (submission.activityId) {
      const activity = await prisma.activity.findUnique({
        where: { id: submission.activityId },
      });
      if (!activity) throw new ApiError(404, 'not_found', 'Activity not found.');
      course = await loadCourseOr404(activity.courseId);
      assertCourseOwner(course, auth);
      relatedId = activity.id;
      relatedTitle = activity.title;
    } else {
      if (!submission.activityKey) throw new ApiError(404, 'not_found', 'Activity not found.');
      const activity = await prisma.activity.findUnique({
        where: { id: submission.activityKey },
      });
      if (!activity) throw new ApiError(404, 'not_found', 'Activity not found.');
      course = await loadCourseOr404(activity.courseId);
      assertCourseOwner(course, auth);
      relatedId = activity.id;
      relatedTitle = activity.title;
    }
    const { grade, feedback, rubricScores } = (req.body ?? {}) as {
      grade?: unknown;
      feedback?: unknown;
      rubricScores?: unknown;
    };
    if (typeof grade !== 'number' || Number.isNaN(grade)) {
      throw new ApiError(400, 'bad_request', 'Field grade must be a number.');
    }
    if (feedback !== undefined && typeof feedback !== 'string') {
      throw new ApiError(400, 'bad_request', 'Field feedback must be a string.');
    }
    let rubricScoresJson: string | undefined;
    if (rubricScores !== undefined) {
      if (typeof rubricScores !== 'object' || rubricScores === null || Array.isArray(rubricScores)) {
        throw new ApiError(400, 'bad_request', 'Field rubricScores must be an object.');
      }
      for (const [k, v] of Object.entries(rubricScores as Record<string, unknown>)) {
        if (typeof v !== 'number' || Number.isNaN(v) || v < 0) {
          throw new ApiError(400, 'bad_request', `Field rubricScores["${k}"] must be a non-negative number.`);
        }
      }
      rubricScoresJson = stringifyJsonField(rubricScores as Record<string, number>);
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const graded = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        grade,
        status: 'graded',
        gradedAt: new Date(),
        gradedBy: me?.name ?? auth.sub,
        ...(rubricScoresJson !== undefined ? { rubricScores: rubricScoresJson } : {}),
      },
    });
    if (feedback && feedback.trim()) {
      await prisma.submissionComment.create({
        data: {
          id: newId('sc'),
          submissionId: submission.id,
          authorId: auth.sub,
          authorName: me?.name ?? '',
          authorRole: auth.role,
          text: feedback.trim(),
        },
      });
    }
    await createNotification({
      type: 'grade_posted',
      recipientId: submission.studentId,
      actorId: auth.sub,
      actorName: me?.name ?? '',
      actorAvatar: me?.avatar ?? '',
      relatedId,
      relatedTitle,
      content: feedback && feedback.trim() ? feedback.trim() : `Your submission for ${relatedTitle} was graded.`,
    });
    res.json({ submission: mapSubmission(graded) });
  })
);

submissionsRouter.post(
  '/submissions/:submissionId/comments',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const submission = await prisma.submission.findUnique({
      where: { id: req.params.submissionId },
    });
    if (!submission) throw new ApiError(404, 'not_found', 'Submission not found.');
    // Same synthetic-aware resolution as the grade path: quiz/activity
    // submissions resolve their course through the quiz/activity row,
    // classic submissions through the activityKey activity row.
    let course;
    if (submission.quizId) {
      const quiz = await prisma.quiz.findUnique({ where: { id: submission.quizId } });
      if (!quiz) throw new ApiError(404, 'not_found', 'Quiz not found.');
      course = await loadCourseOr404(quiz.courseId);
    } else if (submission.activityId) {
      const activity = await prisma.activity.findUnique({
        where: { id: submission.activityId },
      });
      if (!activity) throw new ApiError(404, 'not_found', 'Activity not found.');
      course = await loadCourseOr404(activity.courseId);
    } else {
      if (!submission.activityKey) throw new ApiError(404, 'not_found', 'Activity not found.');
      const activity = await prisma.activity.findUnique({
        where: { id: submission.activityKey },
      });
      if (!activity) throw new ApiError(404, 'not_found', 'Activity not found.');
      course = await loadCourseOr404(activity.courseId);
    }
    if (auth.role === 'faculty' || auth.role === 'admin') {
      assertCourseOwner(course, auth);
    } else {
      await assertCourseAccess(course, auth);
      if (submission.studentId !== auth.sub) {
        throw new ApiError(403, 'forbidden', 'You can only comment on your own submission.');
      }
    }
    const { text } = (req.body ?? {}) as { text?: unknown };
    if (typeof text !== 'string' || !text.trim()) {
      throw new ApiError(400, 'bad_request', 'Field text is required.');
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const comment = await prisma.submissionComment.create({
      data: {
        id: newId('sc'),
        submissionId: submission.id,
        authorId: auth.sub,
        authorName: me?.name ?? '',
        authorRole: auth.role,
        text: text.trim(),
      },
    });
    res.status(201).json({ comment });
  })
);
