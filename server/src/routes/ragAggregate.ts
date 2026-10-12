import { Router } from 'express';
import { prisma } from '../db.js';
import { ApiError } from '../utils/errors.js';
import { verifyRequesterToken } from '../utils/requesterToken.js';
import { RagSectionKeyOrder } from '../syllabi/contracts.js';
import { getRagSyllabusRepository } from '../syllabi/runtime.js';

export const ragAggregateRouter = Router();
ragAggregateRouter.use((req, _res, next) => {
  if (!process.env.RAG_EXPORT_KEY || req.header('x-rag-export-key') !== process.env.RAG_EXPORT_KEY) {
    throw new ApiError(401, 'unauthorized', 'Missing or invalid export key.');
  }
  next();
});

type Metric = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'rows';
type TableDefinition = {
  model: 'course' | 'courseSection' | 'enrollmentRequest' | 'user' | 'module' | 'moduleItem' | 'activity' | 'quiz' | 'exam' | 'announcement' | 'submission' | 'courseGrade' | 'calendarEvent';
  scope: 'open' | 'own';
  fields: string[];
  select: Record<string, true>;
  orderBy: Record<string, 'asc' | 'desc'>[];
  idField?: 'id';
  identityFields?: string[];
  studentKey?: string;
};
// Tables the endpoint may touch. `own` tables are always constrained to
// requesterId (per-student privacy); `open` tables take optional equality
// filters on their listed fields only.
const TABLES: Record<string, TableDefinition> = {
  course: {
    model: 'course',
    scope: 'open',
    fields: ['code', 'published', 'instructorId', 'enrolledCount'],
    select: { id: true, code: true, title: true, section: true, instructorName: true, published: true, enrolledCount: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  course_section: {
    model: 'courseSection',
    scope: 'open',
    fields: ['courseId', 'name'],
    select: { id: true, courseId: true, name: true, capacity: true, enrolledCount: true, schedule: true, location: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  enrollment_request: {
    model: 'enrollmentRequest',
    scope: 'open',
    fields: ['courseId', 'type', 'status', 'studentId'],
    select: { id: true, courseId: true, studentId: true, studentName: true, type: true, status: true, requestedAt: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  user_directory: {
    model: 'user',
    scope: 'open',
    fields: ['role', 'department'],
    select: { id: true, name: true, role: true, department: true, title: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  module: {
    model: 'module',
    scope: 'open',
    fields: ['courseId', 'published'],
    select: { id: true, courseId: true, title: true, order: true, published: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  module_item: {
    model: 'moduleItem',
    scope: 'open',
    fields: ['type', 'published'],
    select: { id: true, moduleId: true, title: true, type: true, published: true, required: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  activity: {
    model: 'activity',
    scope: 'open',
    fields: ['courseId', 'term', 'published'],
    select: { id: true, courseId: true, title: true, instructions: true, term: true, pointsPossible: true, published: true, dueDate: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  quiz: {
    model: 'quiz',
    scope: 'open',
    fields: ['courseId', 'term', 'published'],
    select: { id: true, courseId: true, title: true, instructions: true, term: true, timeLimitMinutes: true, published: true, dueDate: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  exam: {
    model: 'exam',
    scope: 'open',
    fields: ['courseId', 'term', 'published'],
    select: { id: true, courseId: true, title: true, instructions: true, term: true, timeLimitMinutes: true, published: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  announcement: {
    model: 'announcement',
    scope: 'open',
    fields: ['courseId'],
    select: { id: true, courseId: true, title: true, content: true, authorName: true, createdAt: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  calendar_event: {
    model: 'calendarEvent',
    scope: 'open',
    fields: ['courseId', 'type'],
    select: { id: true, title: true, date: true, time: true, courseId: true, courseCode: true, type: true, description: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
  },
  submission: {
    model: 'submission',
    scope: 'own',
    fields: ['courseId', 'status'],
    select: { id: true, courseId: true, studentId: true, studentName: true, grade: true, status: true, submittedAt: true },
    orderBy: [{ id: 'asc' }],
    idField: 'id',
    studentKey: 'studentId',
  },
  course_grade: {
    model: 'courseGrade',
    scope: 'own',
    fields: ['courseId'],
    select: { courseId: true, studentId: true, midtermGrade: true, finalGrade: true, sprCells: true, updatedAt: true },
    orderBy: [{ courseId: 'asc' }, { studentId: 'asc' }],
    identityFields: ['courseId', 'studentId'],
    studentKey: 'studentId',
  },
};
const NUMERIC_FIELDS = new Set([
  'course.enrolledCount',
  'course_section.capacity', 'course_section.enrolledCount',
  'submission.grade',
  'course_grade.midtermGrade', 'course_grade.finalGrade',
]);
// Enrollment requests always carry per-student identity, so they are never
// readable with the service key alone. Verified privileged roles
// (admin/faculty/staff) may query course/all rows; every other role is
// forced to its own studentId scope, exactly like an own table.
const ENROLLMENT_PRIVILEGED_ROLES = new Set(['admin', 'faculty', 'staff']);
const METRICS: Metric[] = ['count', 'sum', 'avg', 'min', 'max', 'rows'];

// Logical structured syllabus table (Task 2). Backed by the published-only
// PrismaSyllabusRepository projection through the shared runtime singleton —
// never by raw Prisma models, so drafts, archived revisions, audit tables,
// source payloads (fileDataUrl/legacyPayload), extension values, actor IDs,
// signatory data, consultation/schedule/room details, and internal IDs can
// never leak into structured reads. Empty sections are filtered (no record),
// stable export ids `<courseId>#<sectionKey>` are preserved, text keeps the
// 1,500-character export bound, and recordIds hydration stays unsupported
// because identity is the composite (courseId, sectionKey). Only count/rows
// metrics are supported in this phase; sum/avg/min/max are intentionally
// omitted for this logical table.
const COURSE_SYLLABUS_TABLE = 'course_syllabus';
const COURSE_SYLLABUS_FIELDS = [
  'id',
  'courseId',
  'courseCode',
  'courseTitle',
  'syllabusId',
  'revisionNo',
  'sectionKey',
  'sectionText',
] as const;
const COURSE_SYLLABUS_FILTERS = ['courseId', 'courseCode', 'sectionKey'] as const;
const COURSE_SYLLABUS_SECTION_LIMIT = 1500;

interface CourseSyllabusRow {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  syllabusId: string;
  revisionNo: number;
  sectionKey: string;
  sectionText: string;
}

const boundSyllabusText = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > COURSE_SYLLABUS_SECTION_LIMIT
    ? `${normalized.slice(0, COURSE_SYLLABUS_SECTION_LIMIT - 1)}…`
    : normalized;
};

async function handleCourseSyllabus(
  body: Record<string, unknown>,
  rawFilters: Record<string, unknown>,
  res: { json: (payload: unknown) => void },
): Promise<void> {
  const metric = typeof body.metric === 'string' ? body.metric : '';
  if (body.recordIds !== undefined) {
    throw new ApiError(400, 'bad_request', 'recordIds are unsupported for composite-key tables');
  }
  if (metric !== 'count' && metric !== 'rows') {
    throw new ApiError(
      400,
      'bad_request',
      `Unknown table '${COURSE_SYLLABUS_TABLE}' or metric '${metric}'. Allowed tables: ${[...Object.keys(TABLES), COURSE_SYLLABUS_TABLE].join(', ')}. Allowed metrics: ${METRICS.join(', ')}.`,
    );
  }
  const limit = body.limit === undefined ? 100 : Number(body.limit);
  const offset = body.offset === undefined ? 0 : Number(body.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new ApiError(400, 'bad_request', 'limit must be an integer between 1 and 500.');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApiError(400, 'bad_request', 'offset must be a non-negative integer.');
  }
  let requested: string[] | null = null;
  if (body.fields !== undefined) {
    if (!Array.isArray(body.fields) || body.fields.some((field: unknown) => typeof field !== 'string')) {
      throw new ApiError(400, 'bad_request', 'fields must be an array of strings.');
    }
    requested = [];
    for (const field of body.fields as string[]) {
      if (!(COURSE_SYLLABUS_FIELDS as readonly string[]).includes(field)) {
        throw new ApiError(400, 'bad_request', `Field not allowed: ${field}.`);
      }
      requested.push(field);
    }
  }
  for (const [k, v] of Object.entries(rawFilters)) {
    if (!(COURSE_SYLLABUS_FILTERS as readonly string[]).includes(k)) {
      throw new ApiError(400, 'bad_request', `Filter not allowed: ${k}.`);
    }
    if (!['string', 'number', 'boolean'].includes(typeof v) ||
        (typeof v === 'number' && !Number.isFinite(v))) {
      throw new ApiError(400, 'bad_request', `Filter value for ${k} must be a string, number, or boolean.`);
    }
  }
  if (body.requesterToken !== undefined && body.requesterId !== undefined) {
    throw new ApiError(400, 'bad_request', 'requesterId must be omitted when requesterToken is provided.');
  }
  const where: { id?: string; code?: string } = {};
  if (rawFilters.courseId !== undefined) where.id = String(rawFilters.courseId);
  if (rawFilters.courseCode !== undefined) where.code = String(rawFilters.courseCode);
  const courses = await prisma.course.findMany({
    where,
    select: { id: true, code: true, title: true },
    orderBy: { id: 'asc' },
  });
  const repository = getRagSyllabusRepository();
  const sectionKeyFilter = rawFilters.sectionKey as string | undefined;
  const keyRank = new Map<string, number>(RagSectionKeyOrder.map((key, index) => [key, index]));
  const rows: CourseSyllabusRow[] = [];
  for (const course of courses) {
    let records: Array<{ syllabusId: string; revisionNo: number; sectionKey: string; sectionText: string }>;
    try {
      if (typeof repository.getRagSectionRecords === 'function') {
        records = await repository.getRagSectionRecords(course.id);
      } else {
        const sections = await repository.getRagSections(course.id);
        records = RagSectionKeyOrder
          .filter((key) => (sections[key] ?? '') !== '')
          .map((key) => ({ syllabusId: '', revisionNo: 0, sectionKey: key, sectionText: sections[key] }));
      }
    } catch (err) {
      console.error(`[rag-aggregate] Skipping syllabus sections for course ${course.id}: ${(err as Error)?.message ?? err}`);
      continue;
    }
    for (const record of records) {
      if (sectionKeyFilter !== undefined && record.sectionKey !== sectionKeyFilter) continue;
      const text = boundSyllabusText(record.sectionText ?? '');
      if (!text) continue;
      rows.push({
        id: `${course.id}#${record.sectionKey}`,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        syllabusId: record.syllabusId,
        revisionNo: record.revisionNo,
        sectionKey: record.sectionKey,
        sectionText: text,
      });
    }
  }
  rows.sort((a, b) =>
    a.courseId.localeCompare(b.courseId) ||
    (keyRank.get(a.sectionKey) ?? Number.MAX_SAFE_INTEGER) - (keyRank.get(b.sectionKey) ?? Number.MAX_SAFE_INTEGER),
  );
  if (metric === 'count') {
    res.json({ table: COURSE_SYLLABUS_TABLE, metric, value: rows.length });
    return;
  }
  const project = (row: CourseSyllabusRow): Record<string, unknown> => {
    if (!requested) return { ...row };
    const out: Record<string, unknown> = {};
    for (const field of requested) {
      out[field] = (row as unknown as Record<string, unknown>)[field];
    }
    for (const identity of ['id', 'courseId', 'sectionKey']) {
      out[identity] = (row as unknown as Record<string, unknown>)[identity];
    }
    return out;
  };
  const page = rows.slice(offset, offset + limit);
  const hasMore = rows.length > offset + limit;
  res.json({
    table: COURSE_SYLLABUS_TABLE,
    metric,
    value: page.map(project),
    count: page.length,
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

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
    const rawFilters = body.filters === undefined ? {} : body.filters;
    if (!isPlainObject(rawFilters)) {
      throw new ApiError(400, 'bad_request', 'filters must be a plain object.');
    }
    const question = typeof body.question === 'string' ? body.question : '';
    if (table === COURSE_SYLLABUS_TABLE) {
      await handleCourseSyllabus(body, rawFilters, res);
      return;
    }
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
        `Unknown table '${table}' or metric '${metric}'. Allowed tables: ${[...Object.keys(TABLES), COURSE_SYLLABUS_TABLE].join(', ')}. Allowed metrics: ${METRICS.join(', ')}.`,
      );
    }
    const recordIds = body.recordIds;
    if (recordIds !== undefined) {
      if (metric !== 'rows') {
        throw new ApiError(400, 'bad_request', 'recordIds are only supported for rows.');
      }
      if (!Array.isArray(recordIds) || recordIds.some((id) => typeof id !== 'string')) {
        throw new ApiError(400, 'bad_request', 'recordIds must be an array of strings.');
      }
      if (recordIds.length > 500) {
        throw new ApiError(400, 'bad_request', 'recordIds must contain at most 500 IDs.');
      }
      if (def.idField !== 'id') {
        throw new ApiError(400, 'bad_request', 'recordIds are unsupported for composite-key tables');
      }
    }
    if ((metric === 'sum' || metric === 'avg' || metric === 'min' || metric === 'max') &&
        (!field || !NUMERIC_FIELDS.has(`${table}.${field}`))) {
      throw new ApiError(400, 'bad_request', 'Metric requires an allowed numeric field.');
    }
    const limit = body.limit === undefined ? 100 : Number(body.limit);
    const offset = body.offset === undefined ? 0 : Number(body.offset);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new ApiError(400, 'bad_request', 'limit must be an integer between 1 and 500.');
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new ApiError(400, 'bad_request', 'offset must be a non-negative integer.');
    }
    let requestedSelect = { ...def.select };
    if (body.fields !== undefined) {
      if (!Array.isArray(body.fields) || body.fields.some((field: unknown) => typeof field !== 'string')) {
        throw new ApiError(400, 'bad_request', 'fields must be an array of strings.');
      }
      requestedSelect = {};
      for (const field of body.fields as string[]) {
        if (!Object.prototype.hasOwnProperty.call(def.select, field)) {
          throw new ApiError(400, 'bad_request', `Field not allowed: ${field}.`);
        }
        requestedSelect[field] = true;
      }
    }
    for (const identityField of def.identityFields ?? ['id']) {
      requestedSelect[identityField] = true;
    }
    const where: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawFilters)) {
      if (!def.fields.includes(k)) {
        throw new ApiError(400, 'bad_request', `Filter not allowed: ${k}.`);
      }
      if (!['string', 'number', 'boolean'].includes(typeof v) ||
          (typeof v === 'number' && !Number.isFinite(v))) {
        throw new ApiError(400, 'bad_request', `Filter value for ${k} must be a string, number, or boolean.`);
      }
      where[k] = v;
    }
    if (recordIds !== undefined) {
      where[def.idField!] = { in: [...new Set(recordIds as string[])] };
    }
    if (body.requesterToken !== undefined && body.requesterId !== undefined) {
      throw new ApiError(400, 'bad_request', 'requesterId must be omitted when requesterToken is provided.');
    }
    if (def.scope === 'own') {
      if (typeof body.requesterToken !== 'string' || !body.requesterToken) {
        throw new ApiError(401, 'unauthorized', 'Per-student tables require a valid requester token.');
      }
      let requesterId: string;
      try {
        requesterId = verifyRequesterToken(body.requesterToken).sub;
      } catch {
        throw new ApiError(401, 'unauthorized', 'Invalid or expired requester token.');
      }
      if (!def.studentKey) {
        throw new ApiError(401, 'unauthorized', 'Per-student tables require a valid requester token.');
      }
      where[def.studentKey] = requesterId;
    }
    if (table === 'enrollment_request') {
      if (typeof body.requesterToken !== 'string' || !body.requesterToken) {
        throw new ApiError(401, 'unauthorized', 'Enrollment requests require a valid requester token.');
      }
      let requester: { sub: string; role: string };
      try {
        requester = verifyRequesterToken(body.requesterToken);
      } catch {
        throw new ApiError(401, 'unauthorized', 'Invalid or expired requester token.');
      }
      if (!ENROLLMENT_PRIVILEGED_ROLES.has(requester.role)) {
        where['studentId'] = requester.sub;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[def.model];
    let value: unknown;
    if (metric === 'count') {
      value = await delegate.count({ where });
    } else if (metric === 'rows') {
      const rows = await delegate.findMany({
        where,
        select: requestedSelect,
        orderBy: def.orderBy,
        skip: offset,
        take: limit + 1,
      });
      const hasMore = rows.length > limit;
      const rowValue = hasMore ? rows.slice(0, limit) : rows;
      value = rowValue;
      res.json({
        table,
        metric,
        value: rowValue,
        count: rowValue.length,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      });
      return;
    } else {
      const agg = await delegate.aggregate({ where, [`_${metric}`]: { [field as string]: true } });
      value = agg[`_${metric}`]?.[field as string] ?? null;
    }
    res.json({ table, metric, value });
  } catch (e) { next(e); }
});
