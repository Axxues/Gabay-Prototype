import { Router } from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken } from '../middleware/auth.js';
import { normalizeReply } from './rag.js';
import { extractExecutionTelemetry } from '../utils/n8nTelemetry.js';

export const ragBaselineRouter = Router();

function baselineUrl(): string {
  const url = process.env.N8N_BASELINE_WEBHOOK_URL?.trim();
  if (!url) {
    throw new ApiError(502, 'rag_unavailable', 'Baseline webhook is not configured.');
  }
  return url;
}

// GET /api/rag-baseline/progress/:sessionId
ragBaselineRouter.get(
  '/progress/:sessionId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const sessionId = req.params.sessionId;
    if (!sessionId) {
      throw new ApiError(400, 'bad_request', 'Session ID is required.');
    }

    const execution = extractExecutionTelemetry({
      sessionId,
      allowRunning: true,
    });

    res.json({ execution });
  })
);

// POST /api/rag-baseline/chat
ragBaselineRouter.post(
  '/chat',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : 'default-session';
    if (!message) {
      throw new ApiError(400, 'bad_request', 'Field message is required.');
    }
    if (message.length > 4000) {
      throw new ApiError(400, 'bad_request', 'Field message is too long (max 4000 chars).');
    }

    const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const url = baselineUrl();

    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatInput: `${message} (My student ID is ${req.auth!.sub}.)`,
          message,
          sessionId,
          requestId,
          userId: req.auth!.sub,
          role: req.auth!.role,
        }),
      });
      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '');
        console.error(`[rag-baseline] n8n upstream ${upstream.status} for ${url}: ${errText.slice(0, 500)}`);
        if (upstream.status === 404) {
          throw new ApiError(
            502,
            'rag_unavailable',
            'Baseline webhook not registered (404). In n8n, open the Baseline Single-Agent RAG (Gabay Webhook) workflow and toggle Activate ON (top-right) so the production webhook runs. Test URLs (/webhook-test/…) only work while listening.'
          );
        }
        const snippet = errText.trim().slice(0, 200);
        const suffix = snippet ? `: ${snippet}` : '';
        throw new ApiError(502, 'rag_unavailable', `Baseline upstream failed (${upstream.status})${suffix}`);
      }
      const text = await upstream.text();
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : '';
      } catch {
        // keep raw text
      }
      const { reply, sources, chart } = normalizeReply(data, message);

      // Extract authentic execution telemetry from n8n SQLite execution database
      let execution: unknown = undefined;
      try {
        const telemetry = extractExecutionTelemetry({
          requestId,
          sessionId,
        });
        if (telemetry) {
          execution = telemetry;
        }
      } catch (e) {
        console.warn('[rag-baseline] Telemetry extraction error:', e);
      }

      res.json({
        reply,
        chart: chart ?? null,
        sources,
        sessionId,
        execution,
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[rag-baseline] n8n fetch failed for ${url}: ${msg}`);

      throw new ApiError(
        502,
        'rag_unavailable',
        'Baseline service is unreachable. Is n8n running on the configured host?'
      );
    }
  })
);
