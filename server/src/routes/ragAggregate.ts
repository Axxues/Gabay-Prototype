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

// Deterministic keyword routing: maps a raw user question to an aggregation
// when the caller supplies no usable table. Never throws for unknown text:
// falls back to user_directory + role=student for people-count phrasing,
// otherwise course count.
function inferFromQuestion(question: string): {
  table: string; metric: Metric; field?: string; filters: Record<string, unknown>;
} {
  const q = question.toLowerCase();
  const courseCode = question.match(/[A-Z]{2,}\s*\d+/);
  if (q.includes('student') && !q.includes('enroll')) {
    return { table: 'user_directory', metric: 'count', filters: { role: 'student' } };
  }
  if (q.includes('enroll')) {
    return { table: 'enrollment_request', metric: 'count', filters: {} };
  }
  if (q.includes('average') || q.includes('avg') || q.includes('mean')) {
    return { table: 'submission', metric: 'avg', field: 'grade', filters: {} };
  }
  if (q.includes('grade')) {
    return { table: 'submission', metric: 'rows', filters: {} };
  }
  if (q.includes('activit')) {
    return { table: 'activity', metric: 'count', filters: {} };
  }
  if (q.includes('quiz')) {
    return { table: 'quiz', metric: 'count', filters: {} };
  }
  if (q.includes('exam')) {
    return { table: 'exam', metric: 'count', filters: {} };
  }
  if (q.includes('module')) {
    return { table: 'module', metric: 'count', filters: {} };
  }
  if (q.includes('announcement')) {
    return { table: 'announcement', metric: 'count', filters: {} };
  }
  if (q.includes('calendar') || q.includes('event') || q.includes('schedule')) {
    return { table: 'calendar_event', metric: 'count', filters: {} };
  }
  if (q.includes('course') || q.includes('subject') || q.includes('class')) {
    return {
      table: 'course', metric: 'count',
      filters: courseCode ? { code: courseCode[0].replace(/\s+/, ' ') } : {},
    };
  }
  return { table: 'course', metric: 'count', filters: {} };
}

ragAggregateRouter.post('/', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    let table = typeof body.table === 'string' ? body.table : '';
    let metric = typeof body.metric === 'string' ? body.metric : '';
    let field = typeof body.field === 'string' ? body.field : undefined;
    const rawFilters = (body.filters ?? {}) as Record<string, unknown>;
    const question = typeof body.question === 'string' ? body.question : '';
    if ((!TABLES[table] || !METRICS.includes(metric as Metric)) && question) {
      const inferred = inferFromQuestion(question);
      if (!TABLES[table]) {
        table = inferred.table;
        Object.assign(rawFilters, inferred.filters);
      }
      if (!METRICS.includes(metric as Metric)) {
        metric = inferred.metric;
      }
      if (!field && inferred.field) {
        field = inferred.field;
      }
    }
    const def = TABLES[table];
    if (!def || !METRICS.includes(metric as Metric)) {
      throw new ApiError(
        400,
        'bad_request',
        `Unknown table '${table}' or metric '${metric}'. Allowed tables: ${Object.keys(TABLES).join(', ')}. Allowed metrics: ${METRICS.join(', ')}.`,
      );
    }
    if ((metric === 'sum' || metric === 'avg' || metric === 'min' || metric === 'max') &&
        (!field || !NUMERIC_FIELDS.has(`${table}.${field}`))) {
      throw new ApiError(400, 'bad_request', 'Metric requires an allowed numeric field.');
    }
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
