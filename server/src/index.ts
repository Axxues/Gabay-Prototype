import express from 'express';
import { errorMiddleware } from './utils/errors.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { coursesRouter, sectionsRouter } from './routes/courses.js';
import { requestsRouter } from './routes/requests.js';
import { modulesRouter } from './routes/modules.js';
import { assignmentsRouter } from './routes/assignments.js';
import { quizzesRouter, activitiesRouter } from './routes/assessments.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api', requestsRouter);
app.use('/api', modulesRouter);
app.use('/api', assignmentsRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/activities', activitiesRouter);

app.use(errorMiddleware);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`gabay-server listening on http://localhost:${port}`);
});
