import './env.js';
import express from 'express';
import path from 'node:path';
import { errorMiddleware } from './utils/errors.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { coursesRouter, sectionsRouter } from './routes/courses.js';
import { requestsRouter } from './routes/requests.js';
import { modulesRouter } from './routes/modules.js';
import { quizzesRouter, activitiesRouter, examsRouter, submissionsRouter } from './routes/assessments.js';
import { announcementsRouter } from './routes/announcements.js';
import { discussionsRouter } from './routes/discussions.js';
import { messagesRouter, groupsRouter } from './routes/messages.js';
import { calendarRouter, advisingRouter } from './routes/calendar.js';
import { notificationsRouter } from './routes/notifications.js';
import { filesRouter } from './routes/files.js';
import { gradesRouter } from './routes/grades.js';
import { sprRouter } from './routes/spr.js';
import { ragRouter } from './routes/rag.js';

const app = express();
// 35mb accommodates the 25MB file-upload cap: base64 inflates files by ~4/3
// (25MB -> ~33.4MB) plus JSON overhead. Real uploads ride multipart
// (/files/upload, multer 25MB); JSON bodies only carry short /uploads URLs,
// so anything bigger than 35mb gets an honest 413.
app.use(express.json({ limit: '35mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api', requestsRouter);
app.use('/api', modulesRouter);
app.use('/api', submissionsRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/exams', examsRouter);
app.use('/api', announcementsRouter);
app.use('/api', discussionsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/advising', advisingRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', filesRouter);
app.use('/api', gradesRouter);
app.use('/api', sprRouter);
app.use('/api/rag', ragRouter);

const uploadsDir =
  process.cwd().endsWith('server') ? path.resolve('uploads') : path.resolve('server/uploads');
app.use('/uploads', express.static(uploadsDir));

app.use(errorMiddleware);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`gabay-server listening on http://localhost:${port}`);
});
