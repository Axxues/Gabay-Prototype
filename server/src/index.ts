import './env.js';
import express from 'express';
import { nativeCompression } from './middleware/compression.js';
import { errorMiddleware } from './utils/errors.js';
import { ragRouter } from './routes/rag.js';
import { ragBaselineRouter } from './routes/ragBaseline.js';
import { ragAggregateRouter } from './routes/ragAggregate.js';
import { ragExportRouter } from './routes/ragExport.js';

const app = express();
app.use(nativeCompression());
app.use(express.json({ limit: '35mb' }));

// ============================================================================
// 1. DEDICATED RAG MICROSERVICE & ANALYTICAL TELEMETRY ENGINE
// ============================================================================
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gabay-rag-microservice',
    port: 4001,
    backend: 'Likha ERP (https://gabay.zyberlab.com)',
  });
});

app.use('/api/rag', ragRouter);
app.use('/api/rag-baseline', ragBaselineRouter);
app.use('/api/rag-aggregate', ragAggregateRouter);
app.use('/api/rag-export', ragExportRouter);

// ============================================================================
// 2. MIGRATED TO LIKHA ERP (https://gabay.zyberlab.com)
// All LMS data models, relations, rich field types, SpeedGrader mutations,
// SPR grade calculation, and event-driven automation Flows now run natively
// on Likha ERP (Directus). Express server on port 4001 is decoupled to act
// strictly as a high-performance RAG microservice and n8n telemetry proxy.
app.use(errorMiddleware);

const port = Number(process.env.PORT || 4001);
const server = app.listen(port, () => {
  console.log(`[gabay-server] RAG Microservice listening on http://localhost:${port}`);
  console.log(`[gabay-server] Likha ERP true backend active at https://gabay.zyberlab.com`);
});
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use (another dev server is still running).\n` +
      `Fix: kill it or reuse another port.\n` +
      `  - PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess) -Force\n` +
      `  - Or run on another port: $env:PORT=4001; npm run dev`
    );
    process.exit(1);
  }
  throw err;
});
