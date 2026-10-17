import type { ChartSpec } from '../types/chart';
import type { ChatProgressMetadata } from '../context/GabayChatContext';

export interface RagSource {
  label: string;
  detail: string;
}

export interface ChatHistoryItem {
  role: string;
  content: string;
}

export interface SendRagMessageOptions {
  sessionId?: string;
  student_name?: string;
  active_course?: string;
  history?: ChatHistoryItem[];
}

export interface RagResponse {
  reply: string;
  category?: string;
  sources: RagSource[];
  sessionId?: string;
  chart?: ChartSpec | null;
  execution?: ChatProgressMetadata;
}

export function getRagApiUrl(): string {
  const envUrl = import.meta.env.VITE_RAG_API_URL;
  const baseUrl = (envUrl && typeof envUrl === 'string' && envUrl.trim()
    ? envUrl.trim()
    : 'http://localhost:8000').replace(/\/+$/, '');
  return `${baseUrl}/api/chat`;
}

export async function sendRagMessage(
  message: string,
  sessionIdOrOptions?: string | SendRagMessageOptions,
  extraOptions?: Partial<SendRagMessageOptions>
): Promise<RagResponse> {
  let opts: SendRagMessageOptions = {};
  if (typeof sessionIdOrOptions === 'string') {
    opts = { sessionId: sessionIdOrOptions, ...extraOptions };
  } else if (sessionIdOrOptions) {
    opts = { ...sessionIdOrOptions, ...extraOptions };
  }

  const url = getRagApiUrl();

  const payload: {
    message: string;
    student_name?: string;
    active_course?: string;
    history?: ChatHistoryItem[];
  } = {
    message,
  };

  if (opts.student_name) {
    payload.student_name = opts.student_name;
  }
  if (opts.active_course) {
    payload.active_course = opts.active_course;
  }
  if (opts.history && opts.history.length > 0) {
    payload.history = opts.history;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`RAG API request failed (${res.status}): ${errorBody || res.statusText}`);
  }

  const data = await res.json();
  const rawSources = Array.isArray(data?.sources) ? data.sources : [];
  const sources: RagSource[] = rawSources.map((s: any) => ({
    label: s?.title || s?.label || s?.source || 'University Resource',
    detail: s?.source || s?.detail || '',
  }));

  return {
    reply: data?.reply ?? '',
    category: data?.category,
    sources,
    sessionId: opts.sessionId,
  };
}

export async function fetchRagProgress(
  _sessionId: string
): Promise<{ execution: ChatProgressMetadata | null }> {
  return { execution: null };
}
