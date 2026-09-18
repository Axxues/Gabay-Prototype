import { apiFetch } from './client';
import type { ChartSpec } from '../types/chart';
import type { ChatProgressMetadata } from '../context/GabayChatContext';

export interface RagSource {
  label: string;
  detail: string;
}

export interface RagResponse {
  reply: string;
  sources: RagSource[];
  sessionId: string;
  chart?: ChartSpec | null;
  execution?: ChatProgressMetadata;
}

export async function sendRagMessage(message: string, sessionId: string): Promise<RagResponse> {
  return apiFetch<RagResponse>('/api/rag/chat', {
    method: 'POST',
    body: { message, sessionId },
  });
}

export async function fetchRagProgress(sessionId: string): Promise<{ execution: ChatProgressMetadata | null }> {
  try {
    return await apiFetch<{ execution: ChatProgressMetadata | null }>(
      `/api/rag/progress/${encodeURIComponent(sessionId)}`,
      { method: 'GET' }
    );
  } catch {
    return { execution: null };
  }
}
