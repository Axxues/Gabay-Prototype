import { Router } from 'express';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken } from '../middleware/auth.js';
import { extractExecutionTelemetry } from '../utils/n8nTelemetry.js';

export const ragRouter = Router();

interface ChartSpec {
  type: string;
  title?: string;
  description?: string;
  data: Array<{ label: string; value: number; color?: string; [key: string]: unknown }>;
}

function webhookUrl(): string {
  const url = process.env.N8N_RAG_WEBHOOK_URL?.trim();
  if (!url) {
    throw new ApiError(502, 'rag_unavailable', 'RAG webhook is not configured.');
  }
  return url;
}

export function isReportRequested(message: string): boolean {
  return /\b(report|reports|reporting|summary\s+report|full\s+report|status\s+report|overview\s+report)\b/i.test(
    message || ''
  );
}

export function isChartRequested(message: string): boolean {
  if (isReportRequested(message)) return true;
  return /\b(chart|charts|graph|graphs|plot|plots|diagram|diagrams|visualiz|visualize|visualization|visualizations|bar\s*chart|pie\s*chart|line\s*chart)\b/i.test(
    message || ''
  );
}

export function isTableRequested(message: string): boolean {
  if (isReportRequested(message)) return true;
  return /\b(table|tables|tabular|grid|grids|matrix|spreadsheet|spreadsheets)\b/i.test(message || '');
}

export function convertMarkdownTablesToBullets(text: string): string {
  if (!text.includes('|')) return text;

  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      const isSeparator = cells.every((c) => /^[-:\s]+$/.test(c));
      if (isSeparator) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        headers = cells;
        continue;
      }

      if (headers.length > 0) {
        const parts: string[] = [];
        cells.forEach((cell, idx) => {
          if (!cell) return;
          const header = headers[idx];
          if (idx === 0) {
            parts.push(cell);
          } else if (header) {
            parts.push(`${header}: ${cell}`);
          } else {
            parts.push(cell);
          }
        });
        result.push(`- ${parts.join(' - ')}`);
      } else {
        result.push(`- ${cells.join(' - ')}`);
      }
    } else {
      if (inTable) {
        inTable = false;
        headers = [];
      }
      result.push(lines[i]);
    }
  }

  return result.join('\n');
}

export function isValidChartSpec(obj: unknown): obj is ChartSpec {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;
  return typeof c.type === 'string' && Array.isArray(c.data) && c.data.length > 0;
}

export function extractChartFromText(text: string): ChartSpec | null {
  if (!text || typeof text !== 'string') return null;

  // 1. Check for ```chart or ```json block
  const blockMatch = /```(?:chart|json)?\s*([\s\S]*?)\s*```/.exec(text);
  if (blockMatch) {
    try {
      const parsed = JSON.parse(blockMatch[1]);
      if (isValidChartSpec(parsed)) {
        return {
          type: parsed.type,
          title: typeof parsed.title === 'string' ? parsed.title : undefined,
          description: typeof parsed.description === 'string' ? parsed.description : undefined,
          data: parsed.data as any,
        };
      }
    } catch {
      // not JSON
    }
  }

  // 2. Check for raw JSON string
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (isValidChartSpec(parsed)) {
        return {
          type: parsed.type,
          title: typeof parsed.title === 'string' ? parsed.title : undefined,
          description: typeof parsed.description === 'string' ? parsed.description : undefined,
          data: parsed.data as any,
        };
      }
    } catch {
      // not JSON
    }
  }

  return null;
}

export function extractChart(data: unknown): ChartSpec | null {
  if (!data) return null;

  if (typeof data === 'string') {
    return extractChartFromText(data);
  }

  if (typeof data === 'object') {
    if (isValidChartSpec(data)) {
      return {
        type: data.type,
        title: typeof data.title === 'string' ? data.title : undefined,
        description: typeof data.description === 'string' ? data.description : undefined,
        data: data.data as any,
      };
    }

    const obj = data as Record<string, unknown>;

    if (isValidChartSpec(obj.chart)) {
      return extractChart(obj.chart);
    }
    if (isValidChartSpec(obj.output)) {
      return extractChart(obj.output);
    }

    if (typeof obj.output === 'string') {
      const fromText = extractChartFromText(obj.output);
      if (fromText) return fromText;
    }
    if (typeof obj.text === 'string') {
      const fromText = extractChartFromText(obj.text);
      if (fromText) return fromText;
    }
    if (typeof obj.reply === 'string') {
      const fromText = extractChartFromText(obj.reply);
      if (fromText) return fromText;
    }

    if (Array.isArray(obj.data) && obj.data.length > 0) {
      for (const item of obj.data) {
        const found = extractChart(item);
        if (found) return found;
      }
    }
    if (Array.isArray(data) && data.length > 0) {
      for (const item of data) {
        const found = extractChart(item);
        if (found) return found;
      }
    }
  }

  return null;
}

export function normalizeReply(data: unknown, userMessage?: string): {
  reply: string;
  sources: { label: string; detail: string }[];
  chart?: ChartSpec | null;
} {
  const wantsChart = userMessage ? isChartRequested(userMessage) : true;
  const wantsTable = userMessage ? isTableRequested(userMessage) : true;
  let chart = extractChart(data);

  if (!wantsChart) {
    chart = null;
  }

  const cleanReplyText = (raw: string): string => {
    let text = raw;
    if (!wantsChart) {
      text = text.replace(/```chart[\s\S]*?```/g, '').trim();
    }
    if (!wantsTable) {
      text = convertMarkdownTablesToBullets(text).trim();
    }
    return text;
  };

  const formatChartBlock = (cSpec: ChartSpec): string => {
    const title = cSpec.title ? '**' + cSpec.title + '**\n\n' : '';
    return title + '```chart\n' + JSON.stringify(cSpec, null, 2) + '\n```';
  };

  const ensureChartBlock = (text: string, cSpec: ChartSpec | null): string => {
    if (!wantsChart || !cSpec) return text;
    if (/```chart\b[\s\S]*?```/.test(text)) {
      return text;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (isValidChartSpec(parsed)) {
          return formatChartBlock(parsed);
        }
      } catch {
        // keep text
      }
    }
    if (/```json\s*\{[\s\S]*?"type"[\s\S]*?"data"[\s\S]*?\}\s*```/.test(text)) {
      return text.replace(/```json/g, '```chart');
    }
    return text;
  };

  const rawCandidates: unknown[] = [];
  const sourcesList: unknown[] = [];

  if (typeof data === 'string') {
    rawCandidates.push(data);
  } else if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object') {
        const io = item as Record<string, unknown>;
        if (io.json && typeof io.json === 'object') {
          const jo = io.json as Record<string, unknown>;
          rawCandidates.push(jo.output, jo.text, jo.reply, jo.answer, jo.message, jo.result, jo);
          if (Array.isArray(jo.sources)) sourcesList.push(...jo.sources);
        } else {
          rawCandidates.push(io.output, io.text, io.reply, io.answer, io.message, io.result, io);
          if (Array.isArray(io.sources)) sourcesList.push(...io.sources);
        }
      } else if (typeof item === 'string') {
        rawCandidates.push(item);
      }
    }
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    rawCandidates.push(obj.output, obj.text, obj.reply, obj.answer, obj.message, obj.result);
    if (Array.isArray(obj.sources)) sourcesList.push(...obj.sources);

    if (Array.isArray(obj.data) && obj.data.length > 0) {
      for (const item of obj.data) {
        if (item && typeof item === 'object') {
          const io = item as Record<string, unknown>;
          rawCandidates.push(io.output, io.text, io.reply, io.answer, io.message, io.result, io);
          if (Array.isArray(io.sources)) sourcesList.push(...io.sources);
        }
      }
    }
  }

  const sources = sourcesList
    .map((s) => {
      if (typeof s === 'string') return { label: s, detail: '' };
      if (s && typeof s === 'object') {
        const so = s as Record<string, unknown>;
        return {
          label: String(so.label ?? so.title ?? so.source ?? 'Source'),
          detail: String(so.detail ?? so.snippet ?? so.collection ?? ''),
        };
      }
      return null;
    })
    .filter((s): s is { label: string; detail: string } => s !== null)
    .slice(0, 6);

  const finalSources =
    sources.length > 0 ? sources : [{ label: 'LIKHA RAG', detail: 'Semantic search via Qdrant' }];

  for (const c of rawCandidates) {
    if (typeof c === 'string' && c.trim()) {
      let cleaned = cleanReplyText(c);
      cleaned = ensureChartBlock(cleaned, chart);
      if (!cleaned && chart) {
        cleaned = formatChartBlock(chart);
      }
      if (cleaned.trim()) {
        return {
          reply: cleaned.trim(),
          sources: finalSources,
          chart,
        };
      }
    } else if (c && typeof c === 'object') {
      if (isValidChartSpec(c)) {
        if (!chart) chart = extractChart(c);
        if (wantsChart) {
          return {
            reply: formatChartBlock(c),
            sources: finalSources,
            chart: c,
          };
        } else {
          return {
            reply: c.title ? String(c.title) : 'Chart omitted as requested.',
            sources: finalSources,
            chart: null,
          };
        }
      }
    }
  }

  if (chart && wantsChart) {
    return {
      reply: formatChartBlock(chart),
      sources: finalSources,
      chart,
    };
  }

  throw new ApiError(502, 'rag_unavailable', 'RAG returned an empty response.');
}

// GET /api/rag/health
ragRouter.get(
  '/health',
  authenticateToken,
  asyncHandler(async (_req, res) => {
    const url = process.env.N8N_RAG_WEBHOOK_URL?.trim();
    if (!url) {
      res.json({ configured: false, webhookHost: null });
      return;
    }
    let webhookHost: string | null = null;
    try {
      webhookHost = new URL(url).host;
    } catch {
      webhookHost = null;
    }
    res.json({ configured: true, webhookHost });
  })
);

// GET /api/rag/progress/:sessionId
ragRouter.get(
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

// POST /api/rag/chat
ragRouter.post(
  '/chat',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim()
        : `session-${Date.now().toString(36)}`;
    if (!message) {
      throw new ApiError(400, 'bad_request', 'Field message is required.');
    }
    if (message.length > 4000) {
      throw new ApiError(400, 'bad_request', 'Field message is too long (max 4000 chars).');
    }

    const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const url = webhookUrl();

    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatInput: message,
          message,
          sessionId,
          requestId,
          userId: req.auth!.sub,
          role: req.auth!.role,
        }),
      });
      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '');
        console.error(`[rag] n8n upstream ${upstream.status} for ${url}: ${errText.slice(0, 500)}`);
        if (upstream.status === 404) {
          throw new ApiError(
            502,
            'rag_unavailable',
            'RAG webhook not registered (404). In n8n, open the gabay-rag workflow and toggle Activate ON (top-right) so the production webhook runs. Test URLs (/webhook-test/…) only work while listening.'
          );
        }
        const snippet = errText.trim().slice(0, 200);
        const suffix = snippet ? `: ${snippet}` : '';
        throw new ApiError(502, 'rag_unavailable', `RAG upstream failed (${upstream.status})${suffix}`);
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
        console.warn('[rag] Telemetry extraction error:', e);
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
      console.error(`[rag] n8n fetch failed for ${url}: ${msg}`);

      throw new ApiError(
        502,
        'rag_unavailable',
        'RAG service is unreachable. Is n8n running on the configured host?'
      );
    }
  })
);
