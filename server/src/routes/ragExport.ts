import { Router } from 'express';
import { prisma } from '../db.js';
import { ApiError } from '../utils/errors.js';

export const ragExportRouter = Router();
ragExportRouter.use((req, _res, next) => {
  if (req.header('x-rag-export-key') !== process.env.RAG_EXPORT_KEY) {
    throw new ApiError(401, 'unauthorized', 'Missing or invalid export key.');
  }
  next();
});

type Table = { collection: string; domain: string; isJunction: false; records: unknown[] };
const pack = (collection: string, domain: string, records: unknown[]): Table =>
  ({ collection, domain, isJunction: false, records });

ragExportRouter.get('/courses', async (_req, res, next) => {
  try {
    res.json({ area: 'courses', tables: [
      pack('course', 'courses', await prisma.course.findMany({ select: { id: true, code: true, title: true, section: true, instructorName: true, published: true, enrolledCount: true } })),
      pack('course_section', 'courses', await prisma.courseSection.findMany({ select: { id: true, courseId: true, name: true, capacity: true, enrolledCount: true, schedule: true, location: true } })),
      pack('enrollment_request', 'courses', await prisma.enrollmentRequest.findMany({ select: { id: true, courseId: true, studentId: true, studentName: true, type: true, status: true, requestedAt: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/learning', async (_req, res, next) => {
  try {
    res.json({ area: 'learning', tables: [
      pack('module', 'learning', await prisma.module.findMany({ select: { id: true, courseId: true, title: true, order: true, published: true } })),
      pack('module_item', 'learning', await prisma.moduleItem.findMany({ select: { id: true, title: true, type: true, published: true, required: true } })),
      pack('activity', 'learning', await prisma.activity.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, pointsPossible: true, published: true, dueDate: true } })),
      pack('quiz', 'learning', await prisma.quiz.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, timeLimitMinutes: true, published: true, dueDate: true } })),
      pack('exam', 'learning', await prisma.exam.findMany({ select: { id: true, courseId: true, title: true, instructions: true, term: true, timeLimitMinutes: true, published: true } })),
      pack('announcement', 'learning', await prisma.announcement.findMany({ select: { id: true, courseId: true, title: true, content: true, authorName: true, createdAt: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/people', async (_req, res, next) => {
  try {
    res.json({ area: 'people', tables: [
      pack('user_directory', 'people', await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, department: true, title: true } })),
      pack('calendar_event', 'people', await prisma.calendarEvent.findMany({ select: { id: true, title: true, date: true, time: true, courseId: true, courseCode: true, type: true, description: true } })),
      pack('message_meta', 'people', await prisma.message.findMany({ select: { id: true, senderName: true, senderRole: true, recipientName: true, courseCode: true, subject: true, timestamp: true } })),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.get('/progress', async (_req, res, next) => {
  try {
    res.json({ area: 'progress', tables: [
      pack('submission', 'progress', await prisma.submission.findMany({ select: { id: true, courseId: true, studentId: true, studentName: true, grade: true, status: true, submittedAt: true } })),
      pack('course_grade', 'progress', await prisma.courseGrade.findMany()),
    ] });
  } catch (e) { next(e); }
});

ragExportRouter.use((req, _res, next) => next(new ApiError(404, 'not_found', `Unknown export area: ${req.path}`)));
