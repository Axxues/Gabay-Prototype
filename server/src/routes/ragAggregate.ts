import { Router } from 'express';
import { prisma } from '../db.js';
import { ApiError } from '../utils/errors.js';

export const ragAggregateRouter = Router();
ragAggregateRouter.use((req, _res, next) => {
  if (!process.env.RAG_EXPORT_KEY || req.header('x-rag-export-key') !== process.env.RAG_EXPORT_KEY) {
    throw new ApiError(401, 'unauthorized', 'Missing or invalid export key.');
  }
  next();
});

type Metric = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'rows';
// Tables the endpoint may touch. `own` tables are always constrained to
// requesterId (per-student privacy); `open` tables take optional equality
// filters on their listed fields only.
const TABLES: Record<string, { model: 'course' | 'courseSection' | 'enrollmentRequest' | 'user' | 'module' | 'moduleItem' | 'activity' | 'quiz' | 'exam' | 'announcement' | 'submission' | 'courseGrade' | 'calendarEvent'; scope: 'open' | 'own'; fields: string[]; studentKey?: string }> = {
  course: { model: 'course', scope: 'open', fields: ['code', 'published', 'instructorId', 'enrolledCount'] },
  course_section: { model: 'courseSection', scope: 'open', fields: ['courseId', 'name'] },
  enrollment_request: { model: 'enrollmentRequest', scope: 'open', fields: ['courseId', 'type', 'status', 'studentId'] },
  user_directory: { model: 'user', scope: 'open', fields: ['role', 'department'] },
  module: { model: 'module', scope: 'open', fields: ['courseId', 'published'] },
  module_item: { model: 'moduleItem', scope: 'open', fields: ['type', 'published'] },
  activity: { model: 'activity', scope: 'open', fields: ['courseId', 'term', 'published'] },
  quiz: { model: 'quiz', scope: 'open', fields: ['courseId', 'term', 'published'] },
  exam: { model: 'exam', scope: 'open', fields: ['courseId', 'term', 'published'] },
  announcement: { model: 'announcement', scope: 'open', fields: ['courseId'] },
  calendar_event: { model: 'calendarEvent', scope: 'open', fields: ['courseId', 'type'] },
  submission: { model: 'submission', scope: 'own', fields: ['courseId', 'status'], studentKey: 'studentId' },
  course_grade: { model: 'courseGrade', scope: 'own', fields: ['courseId'], studentKey: 'studentId' },
};
const NUMERIC_FIELDS = new Set([
  'course.enrolledCount',
  'course_section.capacity', 'course_section.enrolledCount',
  'submission.grade',
  'course_grade.midtermGrade', 'course_grade.finalGrade',
]);
const METRICS: Metric[] = ['count', 'sum', 'avg', 'min', 'max', 'rows'];

ragAggregateRouter.post('/', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const table = typeof body.table === 'string' ? body.table : '';
    const metric = typeof body.metric === 'string' ? body.metric : '';
    const def = TABLES[table];
    if (!def || !METRICS.includes(metric as Metric)) {
      throw new ApiError(
        400,
        'bad_request',
        `Unknown table '${table}' or metric '${metric}'. Allowed tables: ${Object.keys(TABLES).join(', ')}. Allowed metrics: ${METRICS.join(', ')}.`,
      );
    }
    const field = typeof body.field === 'string' ? body.field : undefined;
    if ((metric === 'sum' || metric === 'avg' || metric === 'min' || metric === 'max') &&
        (!field || !NUMERIC_FIELDS.has(`${table}.${field}`))) {
      throw new ApiError(400, 'bad_request', 'Metric requires an allowed numeric field.');
    }
    const rawFilters = (body.filters ?? {}) as Record<string, unknown>;
    const where: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawFilters)) {
      if (!def.fields.includes(k) || v === undefined || v === null) {
        throw new ApiError(400, 'bad_request', `Filter not allowed: ${k}.`);
      }
      where[k] = v;
    }
    if (def.scope === 'own') {
      const requesterId = typeof body.requesterId === 'string' ? body.requesterId : '';
      if (!requesterId || !def.studentKey) {
        throw new ApiError(400, 'bad_request', 'Per-student tables require requesterId.');
      }
      where[def.studentKey] = requesterId;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[def.model];
    let value: unknown;
    if (metric === 'count') {
      value = await delegate.count({ where });
    } else if (metric === 'rows') {
      value = await delegate.findMany({ where, take: 50 });
    } else {
      const agg = await delegate.aggregate({ where, [`_${metric}`]: { [field as string]: true } });
      value = agg[`_${metric}`]?.[field as string] ?? null;
    }
    res.json({ table, metric, value });
  } catch (e) { next(e); }
});
