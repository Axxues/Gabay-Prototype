import { useEffect, useRef, useState } from 'react';
import { LIKHA_URL, getValidToken } from '../../../shared/api/likhaLmsApi';
import { likhaCache } from '../../../shared/api/likhaCache';
import {
  emitRealtimeChange,
  getLikhaWebSocketUrl,
  getSubscriptionByUid,
  isLiveSyncSuppressed,
  REALTIME_COLLECTIONS,
} from '../api/realtimeApi';

export type RealtimeStatus = 'disabled' | 'connecting' | 'live' | 'offline';

const DEBOUNCE_MS = 400;
const SUPPRESSED_RETRY_MS = 1500;
const MAX_RECONNECT_MS = 30000;

interface PendingBatch {
  courseIds: Set<string>;
  parentIds: Map<string, Set<string>>;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Extract course ids (or, for courses rows, the row id itself). */
function extractCourseIds(data: unknown, sub: typeof REALTIME_COLLECTIONS[number]): string[] {
  const items = Array.isArray(data) ? data : [data];
  const ids: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (sub.idIsCourse) {
      const id = (item as { id?: unknown }).id;
      if (typeof id === 'string' && id) ids.push(id);
      continue;
    }
    for (const field of sub.courseIdFields ?? []) {
      const courseId = (item as Record<string, unknown>)[field];
      if (typeof courseId === 'string' && courseId) {
        ids.push(courseId);
        break;
      }
    }
  }
  return ids;
}

/** Extract parent row ids per configured parent field (e.g. module_id). */
function extractParentIds(data: unknown, sub: typeof REALTIME_COLLECTIONS[number]): Record<string, string[]> {
  const fields = Object.keys(sub.parentFields ?? {});
  if (fields.length === 0) return {};
  const items = Array.isArray(data) ? data : [data];
  const byField = new Map<string, Set<string>>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    for (const field of fields) {
      const parentId = (item as Record<string, unknown>)[field];
      if (typeof parentId === 'string' && parentId) {
        if (!byField.has(field)) byField.set(field, new Set());
        byField.get(field)!.add(parentId);
      }
    }
  }
  const out: Record<string, string[]> = {};
  for (const [field, set] of byField) out[field] = [...set];
  return out;
}

/**
 * One Likha ERP WebSocket per client session. Authenticates with the active
 * user's session JWT (RBAC-safe: Directus only streams rows the role may
 * read), subscribes to the hot course collections, and on each create/update
 * event: debounces -> invalidates that collection's cache keys -> emits a
 * targeted change event. Reconnects with capped exponential backoff; falls
 * back to the existing cache TTL staleness until the socket returns.
 */
export function useRealtimeSync(enabled: boolean): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>(enabled ? 'connecting' : 'disabled');
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined') {
      setStatus('disabled');
      return;
    }

    let disposed = false;
    let ws: WebSocket | null = null;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const pending = new Map<string, PendingBatch>();

    const flush = (collection: string) => {
      const batch = pending.get(collection);
      if (!batch) return;
      // Assessment runner is open: buffer the batch and retry shortly so no
      // update is lost mid-attempt — it flushes when the runner closes.
      if (isLiveSyncSuppressed()) {
        batch.timer = setTimeout(() => flush(collection), SUPPRESSED_RETRY_MS);
        return;
      }
      const sub = REALTIME_COLLECTIONS.find(c => c.collection === collection);
      pending.delete(collection);
      if (!sub) return;
      likhaCache.invalidate(sub.path);
      const parentIds: Record<string, string[]> = {};
      for (const [field, set] of batch.parentIds) parentIds[field] = [...set];
      emitRealtimeChange({
        collection,
        path: sub.path,
        courseIds: [...batch.courseIds],
        ...(Object.keys(parentIds).length > 0 ? { parentIds } : {}),
      });
    };

    const handleEvent = (collection: string, data: unknown) => {
      const sub = REALTIME_COLLECTIONS.find(c => c.collection === collection);
      let batch = pending.get(collection);
      if (!batch) {
        batch = { courseIds: new Set(), parentIds: new Map(), timer: null };
        pending.set(collection, batch);
      }
      if (sub) {
        for (const id of extractCourseIds(data, sub)) batch.courseIds.add(id);
        for (const [field, ids] of Object.entries(extractParentIds(data, sub))) {
          let set = batch.parentIds.get(field);
          if (!set) {
            set = new Set();
            batch.parentIds.set(field, set);
          }
          for (const id of ids) set.add(id);
        }
      }
      if (batch.timer) clearTimeout(batch.timer);
      batch.timer = setTimeout(() => flush(collection), DEBOUNCE_MS);
    };

    const handleMessages = (eventData: string) => {
      let msg: any;
      try {
        msg = JSON.parse(eventData);
      } catch {
        return;
      }
      if (msg?.type === 'auth' && msg.status === 'ok') {
        attempt = 0;
        setStatus('live');
        for (const sub of REALTIME_COLLECTIONS) {
          ws?.send(
            JSON.stringify({
              type: 'subscribe',
              collection: sub.collection,
              uid: sub.collection,
              query: { fields: sub.fields },
            })
          );
        }
        return;
      }
      // init replays current rows we already hold; create/update only.
      if (msg?.type === 'subscription' && (msg.event === 'create' || msg.event === 'update')) {
        const sub = getSubscriptionByUid(msg.uid);
        if (sub) handleEvent(sub.collection, msg.data);
        return;
      }
      if (msg?.type === 'auth' && msg.status === 'error') {
        ws?.close();
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      const delay = Math.min(MAX_RECONNECT_MS, 1000 * 2 ** attempt++);
      setStatus('offline');
      reconnectTimer = setTimeout(() => void connect(), delay);
    };

    const connect = async () => {
      if (disposed) return;
      let token: string | null = null;
      try {
        token = await getValidToken();
      } catch {
        token = null;
      }
      if (!token || disposed) {
        scheduleReconnect();
        return;
      }
      const url = getLikhaWebSocketUrl();
      if (!url || !LIKHA_URL) {
        return; // No reachable backend to stream from
      }
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'auth', access_token: token }));
      };
      ws.onmessage = (event: MessageEvent) => handleMessages(String(event.data));
      ws.onclose = () => {
        if (disposed) return;
        ws = null;
        scheduleReconnect();
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          // Ignored — onclose schedules the reconnect.
        }
      };
    };

    setStatus('connecting');
    void connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      for (const batch of pending.values()) {
        if (batch.timer) clearTimeout(batch.timer);
      }
      pending.clear();
      try {
        ws?.close();
      } catch {
        // Ignored
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return status;
}
