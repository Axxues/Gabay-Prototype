import { LIKHA_URL, getValidToken, likhaRequest } from '../../../shared/api/likhaLmsApi';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import type { CollaboratorInfo } from '../hooks/useSyllabusCollaboration';

export interface GroupDraftPayload {
  syllabusData?: OfficialSyllabusData;
  presence?: Record<string, CollaboratorInfo>;
  submissionAgreements?: Record<string, boolean>;
  status?: string;
  evaluators?: any[];
  lastUpdatedBy?: string;
  lastUpdatedBySessionId?: string;
  updatedAt?: number;
}

export function getWebSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  // If running on localhost or via local IP against Vite dev server, proxy via Vite
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '5173'
  ) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/likha/websocket`;
  }
  if (LIKHA_URL.startsWith('http')) {
    return LIKHA_URL.replace(/^http/, 'ws') + '/websocket';
  }
  return 'wss://gabay.zyberlab.com/websocket';
}

export function makeDraftId(canonicalCourseId: string): string {
  return `syl-draft-${canonicalCourseId}`;
}

/** Presence lives in its own column now; legacy drafts kept it inside content. */
function parsePresence(value: any): Record<string, CollaboratorInfo> | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return typeof value === 'object' ? value : undefined;
}

export async function fetchRemoteDraft(canonicalCourseId: string): Promise<{
  id: string;
  payload: GroupDraftPayload;
} | null> {
  const token = await getValidToken();
  if (!token) return null;

  try {
    const draftId = makeDraftId(canonicalCourseId);
    const row = await likhaRequest<any>(
      `/items/syllabi/${encodeURIComponent(draftId)}?fields=id,content,presence`
    ).catch(() => null);

    if (row?.content) {
      try {
        const parsed = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        const payload: GroupDraftPayload = parsed?.syllabusData
          ? parsed
          : { syllabusData: parsed };
        payload.presence = parsePresence(row.presence) || payload.presence;
        if (parsed?.submissionAgreements) payload.submissionAgreements = parsed.submissionAgreements;
        if (parsed?.status) payload.status = parsed.status;
        if (parsed?.evaluators) payload.evaluators = parsed.evaluators;
        return { id: row.id || draftId, payload };
      } catch {
        return null;
      }
    }

    // Fallback: Query by course_id and status=draft
    const items = await likhaRequest<any[]>(
      `/items/syllabi?filter%5Bcourse_id%5D%5B_eq%5D=${encodeURIComponent(
        canonicalCourseId
      )}&filter%5Bstatus%5D%5B_eq%5D=draft&sort=-version&limit=1&fields=id,content,presence`
    ).catch(() => []);

    if (Array.isArray(items) && items.length > 0) {
      const first = items[0];
      const parsed = typeof first.content === 'string' && first.content ? JSON.parse(first.content) : first.content;
      const payload: GroupDraftPayload = parsed?.syllabusData
        ? parsed
        : { syllabusData: parsed };
      payload.presence = parsePresence(first.presence) || payload.presence;
      if (parsed?.submissionAgreements) payload.submissionAgreements = parsed.submissionAgreements;
      if (parsed?.status) payload.status = parsed.status;
      if (parsed?.evaluators) payload.evaluators = parsed.evaluators;
      return { id: first.id, payload };
    }

    return null;
  } catch (err) {
    console.warn('[syllabusCollaborationApi] fetchRemoteDraft error:', err);
    return null;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Network drops, gateway restarts and rate limits are worth another try; 4xx are not. */
function isRetryableSaveError(err: any): boolean {
  const status = Number(err?.status);
  if (!status) return true;
  return status >= 500 || status === 408 || status === 429;
}

async function writeDraftContent(
  draftId: string,
  canonicalCourseId: string,
  contentJson: string
): Promise<void> {
  try {
    await likhaRequest(`/items/syllabi/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: contentJson })
    });
  } catch (err: any) {
    // 403 is how Directus reports a missing item under restricted permissions,
    // so the row is created on first save; other errors are rethrown for retry.
    const status = Number(err?.status);
    if (status !== 404 && status !== 403) throw err;
    await likhaRequest('/items/syllabi', {
      method: 'POST',
      body: JSON.stringify({
        id: draftId,
        course_id: canonicalCourseId,
        version: 1,
        status: 'draft',
        content: contentJson
      })
    });
  }
}

// One in-flight write per draft: two saves racing could otherwise land out of
// order and leave the older document on the server ("it didn't save my edit").
const draftSaveQueues = new Map<string, Promise<string | null>>();

async function persistDraft(
  canonicalCourseId: string,
  contentJson: string
): Promise<string | null> {
  const draftId = makeDraftId(canonicalCourseId);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const token = await getValidToken();
    if (!token) return null;
    try {
      await writeDraftContent(draftId, canonicalCourseId, contentJson);
      return draftId;
    } catch (err) {
      if (attempt === maxAttempts || !isRetryableSaveError(err)) {
        console.warn('[syllabusCollaborationApi] saveRemoteDraft failed:', err);
        return null;
      }
      await sleep(400 * attempt + Math.random() * 200);
    }
  }

  return null;
}

export function saveRemoteDraft(
  canonicalCourseId: string,
  syllabusData: OfficialSyllabusData,
  lastUpdatedBy?: string,
  lastUpdatedBySessionId?: string,
  submissionAgreements?: Record<string, boolean>,
  status?: string,
  evaluators?: any[]
): Promise<string | null> {
  const draftId = makeDraftId(canonicalCourseId);
  // Only `content` is written here. Presence has its own column, so a
  // heartbeat can never overwrite syllabus content with a stale copy.
  const payload: GroupDraftPayload = {
    syllabusData,
    lastUpdatedBy,
    lastUpdatedBySessionId,
    submissionAgreements,
    status,
    evaluators,
    updatedAt: Date.now()
  };

  const previous = draftSaveQueues.get(draftId) || Promise.resolve(null);
  const next = previous
    .catch(() => null)
    .then(() => persistDraft(canonicalCourseId, JSON.stringify(payload)));

  draftSaveQueues.set(draftId, next);
  void next.finally(() => {
    if (draftSaveQueues.get(draftId) === next) draftSaveQueues.delete(draftId);
  });

  return next;
}

export async function sendRemotePresence(
  canonicalCourseId: string,
  presenceItem: CollaboratorInfo
): Promise<void> {
  const token = await getValidToken();
  if (!token) return;

  const draftId = makeDraftId(canonicalCourseId);
  try {
    // Reads and writes only the presence column: heartbeat traffic must never
    // rewrite syllabus content.
    const row = await likhaRequest<any>(
      `/items/syllabi/${encodeURIComponent(draftId)}?fields=id,presence`
    ).catch(() => null);
    const existingPresence = parsePresence(row?.presence) || {};
    const cutoff = Date.now() - 15000;

    const mergedPresence: Record<string, CollaboratorInfo> = {};
    for (const [key, info] of Object.entries(existingPresence)) {
      if (info && (info.lastSeen || 0) >= cutoff) {
        mergedPresence[key] = info;
      }
    }
    const presenceKey = presenceItem.sessionId || presenceItem.senderId;
    mergedPresence[presenceKey] = presenceItem;

    await likhaRequest(`/items/syllabi/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ presence: mergedPresence })
    }).catch(async () => {
      // Draft row not created yet: make a presence-only row. Content stays
      // empty until the first real save, so readers fall back to the baseline.
      await likhaRequest('/items/syllabi', {
        method: 'POST',
        body: JSON.stringify({
          id: draftId,
          course_id: canonicalCourseId,
          version: 1,
          status: 'draft',
          content: null,
          presence: mergedPresence
        })
      }).catch(() => null);
    });
  } catch (err) {
    console.warn('[syllabusCollaborationApi] sendRemotePresence error:', err);
  }
}

export async function removeRemotePresence(
  canonicalCourseId: string,
  sessionIdOrSenderId: string
): Promise<void> {
  const token = await getValidToken();
  if (!token) return;

  const draftId = makeDraftId(canonicalCourseId);
  try {
    const row = await likhaRequest<any>(
      `/items/syllabi/${encodeURIComponent(draftId)}?fields=id,presence`
    ).catch(() => null);
    const presence = parsePresence(row?.presence);
    if (!presence) return;

    const next = { ...presence };
    delete next[sessionIdOrSenderId];
    for (const [k, v] of Object.entries(next)) {
      if (v?.sessionId === sessionIdOrSenderId || v?.senderId === sessionIdOrSenderId) {
        delete next[k];
      }
    }

    // Presence-only write; content is untouched on unmount.
    await likhaRequest(`/items/syllabi/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ presence: next })
    }).catch(() => null);
  } catch {
    // Ignore cleanup errors on unmount
  }
}
