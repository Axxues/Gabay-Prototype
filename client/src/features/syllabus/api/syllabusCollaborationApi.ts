import { LIKHA_URL, getValidToken, likhaRequest } from '../../../shared/api/likhaLmsApi';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import type { CollaboratorInfo } from '../hooks/useSyllabusCollaboration';

export interface GroupDraftPayload {
  syllabusData?: OfficialSyllabusData;
  presence?: Record<string, CollaboratorInfo>;
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

export async function fetchRemoteDraft(canonicalCourseId: string): Promise<{
  id: string;
  payload: GroupDraftPayload;
} | null> {
  const token = await getValidToken();
  if (!token) return null;

  try {
    const draftId = makeDraftId(canonicalCourseId);
    const row = await likhaRequest<any>(`/items/syllabi/${encodeURIComponent(draftId)}`).catch(() => null);

    if (row?.content) {
      try {
        const parsed = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
        const payload: GroupDraftPayload = parsed?.syllabusData
          ? parsed
          : { syllabusData: parsed };
        return { id: row.id || draftId, payload };
      } catch {
        return null;
      }
    }

    // Fallback: Query by course_id and status=draft
    const items = await likhaRequest<any[]>(
      `/items/syllabi?filter%5Bcourse_id%5D%5B_eq%5D=${encodeURIComponent(
        canonicalCourseId
      )}&filter%5Bstatus%5D%5B_eq%5D=draft&sort=-version&limit=1`
    ).catch(() => []);

    if (Array.isArray(items) && items.length > 0) {
      const first = items[0];
      const parsed = typeof first.content === 'string' ? JSON.parse(first.content) : first.content;
      const payload: GroupDraftPayload = parsed?.syllabusData
        ? parsed
        : { syllabusData: parsed };
      return { id: first.id, payload };
    }

    return null;
  } catch (err) {
    console.warn('[syllabusCollaborationApi] fetchRemoteDraft error:', err);
    return null;
  }
}

export async function saveRemoteDraft(
  canonicalCourseId: string,
  syllabusData: OfficialSyllabusData,
  presenceMap: Record<string, CollaboratorInfo>,
  lastUpdatedBy?: string,
  lastUpdatedBySessionId?: string
): Promise<string | null> {
  const token = await getValidToken();
  if (!token) return null;

  const draftId = makeDraftId(canonicalCourseId);
  const payload: GroupDraftPayload = {
    syllabusData,
    presence: presenceMap,
    lastUpdatedBy,
    lastUpdatedBySessionId,
    updatedAt: Date.now()
  };

  try {
    // 1. Try PATCH first via likhaRequest
    const updated = await likhaRequest<any>(`/items/syllabi/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: JSON.stringify(payload)
      })
    }).catch(async (err) => {
      // 2. If 404 or 403 (item not found yet), create with POST
      const isNotFound =
        err?.status === 404 ||
        err?.status === 403 ||
        String(err?.message || err).includes('404') ||
        String(err?.message || err).includes('not_found');

      if (isNotFound) {
        return likhaRequest<any>('/items/syllabi', {
          method: 'POST',
          body: JSON.stringify({
            id: draftId,
            course_id: canonicalCourseId,
            version: 1,
            status: 'draft',
            content: JSON.stringify(payload)
          })
        }).catch(() => null);
      }
      return null;
    });

    return updated ? draftId : null;
  } catch (err) {
    console.warn('[syllabusCollaborationApi] saveRemoteDraft error:', err);
    return null;
  }
}

export async function sendRemotePresence(
  canonicalCourseId: string,
  presenceItem: CollaboratorInfo
): Promise<void> {
  const token = await getValidToken();
  if (!token) return;

  const draftId = makeDraftId(canonicalCourseId);
  try {
    const current = await fetchRemoteDraft(canonicalCourseId);
    const existingPresence = current?.payload?.presence || {};
    const cutoff = Date.now() - 15000;

    const mergedPresence: Record<string, CollaboratorInfo> = {};
    for (const [key, info] of Object.entries(existingPresence)) {
      if (info && (info.lastSeen || 0) >= cutoff) {
        mergedPresence[key] = info;
      }
    }
    const presenceKey = presenceItem.sessionId || presenceItem.senderId;
    mergedPresence[presenceKey] = presenceItem;

    const payload: GroupDraftPayload = {
      ...(current?.payload || {}),
      presence: mergedPresence,
      updatedAt: Date.now()
    };

    await likhaRequest(`/items/syllabi/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: JSON.stringify(payload)
      })
    }).catch(async () => {
      await likhaRequest('/items/syllabi', {
        method: 'POST',
        body: JSON.stringify({
          id: draftId,
          course_id: canonicalCourseId,
          version: 1,
          status: 'draft',
          content: JSON.stringify(payload)
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
    const current = await fetchRemoteDraft(canonicalCourseId);
    if (!current?.payload?.presence) return;

    const presence = { ...current.payload.presence };
    delete presence[sessionIdOrSenderId];
    for (const [k, v] of Object.entries(presence)) {
      if (v?.sessionId === sessionIdOrSenderId || v?.senderId === sessionIdOrSenderId) {
        delete presence[k];
      }
    }

    const payload: GroupDraftPayload = {
      ...current.payload,
      presence,
      updatedAt: Date.now()
    };

    await likhaRequest(`/items/syllabi/${encodeURIComponent(draftId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: JSON.stringify(payload)
      })
    }).catch(() => null);
  } catch {
    // Ignore cleanup errors on unmount
  }
}
