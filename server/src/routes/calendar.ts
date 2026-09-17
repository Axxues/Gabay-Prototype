import { Router } from 'express';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const calendarRouter = Router();
export const advisingRouter = Router();

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Client-verbatim CalendarEvent unions (src/types/lms.ts). Domain values from
// the client contract, not the Task 1 auth/request allow-lists.
const EVENT_TYPES = [
  'activity',
  'milestone',
  'advising',
  'lecture',
  'exam',
  'event',
  'holiday',
  'virtual_meeting',
] as const;
const MEETING_PLATFORMS = ['zoom', 'google_meet', 'teams', 'other'] as const;

function reqString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'bad_request', `Field ${field} is required.`);
  }
  return value.trim();
}

function optString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be a string.`);
  }
  return value;
}

function createDateOrNull(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be a date string.`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, 'bad_request', `Field '${field}' must be a valid date.`);
  }
  return d;
}

function patchDateOrNull(value: unknown, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  return createDateOrNull(value, field);
}

// GET /api/calendar?courseId= (upcoming filter stays client-side)
calendarRouter.get(
  '/',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const courseId = req.query.courseId as string | undefined;
    const events = await prisma.calendarEvent.findMany({
      ...(courseId ? { where: { courseId } } : {}),
      orderBy: { date: 'asc' },
    });
    res.json({ events });
  })
);

// POST /api/calendar (faculty/admin)
calendarRouter.post(
  '/',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = reqString(body, 'title');
    const date = reqString(body, 'date');
    const type = optString(body.type, 'type') ?? 'event';
    if (!(EVENT_TYPES as readonly string[]).includes(type)) {
      throw new ApiError(400, 'bad_request', 'Field type is not a valid event type.');
    }
    const meetingPlatform = optString(body.meetingPlatform, 'meetingPlatform') ?? null;
    if (meetingPlatform !== null && !(MEETING_PLATFORMS as readonly string[]).includes(meetingPlatform)) {
      throw new ApiError(400, 'bad_request', 'Field meetingPlatform is not a valid platform.');
    }
    if (body.isAllDay !== undefined && typeof body.isAllDay !== 'boolean') {
      throw new ApiError(400, 'bad_request', "Field 'isAllDay' must be a boolean.");
    }
    const event = await prisma.calendarEvent.create({
      data: {
        id: newId('evt'),
        title,
        date,
        time: optString(body.time, 'time') ?? '',
        courseId: optString(body.courseId, 'courseId') ?? null,
        courseCode: optString(body.courseCode, 'courseCode') ?? null,
        type,
        description: optString(body.description, 'description') ?? '',
        startAt: createDateOrNull(body.startAt, 'startAt'),
        endAt: createDateOrNull(body.endAt, 'endAt'),
        isAllDay: typeof body.isAllDay === 'boolean' ? body.isAllDay : false,
        colorHex: optString(body.colorHex, 'colorHex') ?? null,
        location: optString(body.location, 'location') ?? null,
        meetingPlatform,
        meetingId: optString(body.meetingId, 'meetingId') ?? null,
        meetingPasscode: optString(body.meetingPasscode, 'meetingPasscode') ?? null,
        meetingJoinUrl: optString(body.meetingJoinUrl, 'meetingJoinUrl') ?? null,
      },
    });
    res.status(201).json({ event });
  })
);

const CALENDAR_PATCH_STRINGS = [
  'title',
  'date',
  'time',
  'courseId',
  'courseCode',
  'type',
  'description',
  'colorHex',
  'location',
  'meetingPlatform',
  'meetingId',
  'meetingPasscode',
  'meetingJoinUrl',
] as const;

// PATCH /api/calendar/:id (faculty/admin)
calendarRouter.patch(
  '/:id',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'not_found', 'Calendar event not found.');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, string | boolean | Date | null> = {};
    for (const key of CALENDAR_PATCH_STRINGS) {
      if (body[key] === undefined) continue;
      const value = optString(body[key], key);
      if (value === undefined) continue;
      if (key === 'type' && value !== null && !(EVENT_TYPES as readonly string[]).includes(value)) {
        throw new ApiError(400, 'bad_request', 'Field type is not a valid event type.');
      }
      if (
        key === 'meetingPlatform' &&
        value !== null &&
        !(MEETING_PLATFORMS as readonly string[]).includes(value)
      ) {
        throw new ApiError(400, 'bad_request', 'Field meetingPlatform is not a valid platform.');
      }
      data[key] = value;
    }
    for (const key of ['startAt', 'endAt'] as const) {
      if (body[key] === undefined) continue;
      const value = patchDateOrNull(body[key], key);
      if (value !== undefined) data[key] = value;
    }
    if (body.isAllDay !== undefined) {
      if (typeof body.isAllDay !== 'boolean') {
        throw new ApiError(400, 'bad_request', "Field 'isAllDay' must be a boolean.");
      }
      data.isAllDay = body.isAllDay;
    }
    const event = await prisma.calendarEvent.update({ where: { id: existing.id }, data });
    res.json({ event });
  })
);

// DELETE /api/calendar/:id (faculty/admin)
calendarRouter.delete(
  '/:id',
  authenticateToken,
  requireRole('faculty', 'admin'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'not_found', 'Calendar event not found.');
    await prisma.calendarEvent.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

// GET /api/advising
advisingRouter.get(
  '/',
  authenticateToken,
  asyncHandler(async (_req, res) => {
    const slots = await prisma.advisingSlot.findMany({ orderBy: { date: 'asc' } });
    res.json({ slots });
  })
);

// POST /api/advising (faculty)
advisingRouter.post(
  '/',
  authenticateToken,
  requireRole('faculty'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const date = reqString(body, 'date');
    const timeSlot = reqString(body, 'timeSlot');
    const location = reqString(body, 'location');
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const slot = await prisma.advisingSlot.create({
      data: {
        id: newId('adv'),
        instructorId: auth.sub,
        instructorName: (me as { name?: string } | null)?.name ?? '',
        date,
        timeSlot,
        location,
        status: 'available',
        notes: optString(body.notes, 'notes') ?? null,
      },
    });
    res.status(201).json({ slot });
  })
);

// POST /api/advising/:id/book (student; 409 slot_taken when already booked)
advisingRouter.post(
  '/:id/book',
  authenticateToken,
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const slot = await prisma.advisingSlot.findUnique({ where: { id: req.params.id } });
    if (!slot) throw new ApiError(404, 'not_found', 'Advising slot not found.');
    if (slot.status === 'booked') {
      throw new ApiError(409, 'slot_taken', 'This advising slot is already booked.');
    }
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const name = (me as { name?: string } | null)?.name ?? '';
    // Port of the client's bookAdvisingSlot rule verbatim: status flips to
    // 'booked', bookedBy* identify the student, notes record the requester.
    const booked = await prisma.advisingSlot.update({
      where: { id: slot.id },
      data: {
        status: 'booked',
        bookedByStudentId: auth.sub,
        bookedByStudentName: name,
        notes: `Advising requested by ${name}`,
      },
    });
    res.json({ slot: booked });
  })
);

// POST /api/advising/:id/cancel
advisingRouter.post(
  '/:id/cancel',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const slot = await prisma.advisingSlot.findUnique({ where: { id: req.params.id } });
    if (!slot) throw new ApiError(404, 'not_found', 'Advising slot not found.');
    if (slot.status !== 'booked') {
      res.json({ slot });
      return;
    }
    if (
      auth.role !== 'admin' &&
      slot.bookedByStudentId !== auth.sub &&
      slot.instructorId !== auth.sub
    ) {
      throw new ApiError(
        403,
        'forbidden',
        'Only the booked student, the instructor, or an admin can cancel this booking.'
      );
    }
    const cleared = await prisma.advisingSlot.update({
      where: { id: slot.id },
      data: { status: 'available', bookedByStudentId: null, bookedByStudentName: null },
    });
    res.json({ slot: cleared });
  })
);
