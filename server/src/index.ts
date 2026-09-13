import express from 'express';
import { errorMiddleware } from './utils/errors.js';
import { authRouter } from './routes/auth.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);

app.use(errorMiddleware);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`gabay-server listening on http://localhost:${port}`);
});
