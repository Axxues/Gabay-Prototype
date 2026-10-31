import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import {
  onRealtimeChange,
  REALTIME_COLLECTIONS,
  setLiveSyncSuppressed,
} from './api/realtimeApi';
import { likhaCache } from '../../shared/api/likhaCache';

// ─── WebSocket test double ───────────────────────────────────────────────────

interface TestSocket {
  url: string;
  sent: string[];
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: () => void;
}

let openSockets: TestSocket[] = [];

class WebSocketStub implements TestSocket {
  url: string;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    openSockets.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
  /** Test helper: simulate the server emitting a message. */
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

const mine = () => openSockets.filter(s => s instanceof WebSocketStub);
const latest = () => mine()[mine().length - 1];

/** Render the hook and flush connect()'s async token lookup so the socket exists. */
const renderLiveSync = async () => {
  renderHook(() => useRealtimeSync(true));
  await act(async () => {
    await Promise.resolve();
  });
  const socket = latest();
  act(() => socket.onopen?.());
  act(() => socket.emit({ type: 'auth', status: 'ok' }));
  return socket;
};

const TOKEN = 'tok-live-sync';

vi.mock('../../shared/api/likhaLmsApi', () => ({
  LIKHA_URL: 'https://gabay.zyberlab.com',
  getValidToken: vi.fn(async () => TOKEN),
}));

const LAST_EVENT_KEY = 'test-last-event';
const originalNow = Date.now;
const flushCollectors: Array<() => void> = [];
const collectEvents = () => {
  const events: unknown[] = [];
  const off = onRealtimeChange(e => events.push(e));
  flushCollectors.push(off);
  return {
    events,
    stop: () => {
      off();
    },
  };
};

describe('useRealtimeSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    openSockets = [];
    (globalThis as any).WebSocket = WebSocketStub;
    (globalThis as any).__gabayLiveSyncSuppressed = false;
    likhaCache.clear();
    (globalThis as any).__testLastRealtimeEvent = null;
    // Capture emitted events for assertions
    const off = onRealtimeChange(e => {
      (globalThis as any).__testLastRealtimeEvent = e;
    });
    void off;
  });

  afterEach(() => {
    while (flushCollectors.length) flushCollectors.pop()!();
    setLiveSyncSuppressed(false);
    delete (globalThis as any).WebSocket;
    Date.now = originalNow;
    vi.useRealTimers();
  });

  it('authenticates and subscribes to every realtime collection', async () => {
    const socket = await renderLiveSync();
    // jsdom runs on localhost → the Vite ws proxy form
    expect(socket.url).toBe('ws://localhost:3000/likha/websocket');
    const subscribeMessages = socket.sent
      .map(s => JSON.parse(s))
      .filter(m => m.type === 'subscribe');
    expect(new Set(subscribeMessages.map(m => m.collection))).toEqual(
      new Set(REALTIME_COLLECTIONS.map(c => c.collection))
    );
    for (const m of subscribeMessages) {
      const cfg = REALTIME_COLLECTIONS.find(c => c.collection === m.collection);
      expect(cfg).toBeDefined();
      expect(m.query.fields).toEqual(cfg!.fields);
    }
  });

  it('invalidates the collection cache and emits a targeted change event', async () => {
    const invalidateSpy = vi.spyOn(likhaCache, 'invalidate');
    likhaCache.set('tok:/items/activities?filter=1', [{ id: 'a1' }], 60000);

    await renderLiveSync();
    act(() =>
      latest().emit({
        type: 'subscription',
        event: 'create',
        uid: 'activities',
        data: { id: 'act-9', course_id: 'crs-1' },
      })
    );
    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(invalidateSpy).toHaveBeenCalledWith('/items/activities');
    expect(likhaCache.get('tok:/items/activities?filter=1')).toBeNull();
    expect((globalThis as any).__testLastRealtimeEvent).toEqual({
      collection: 'activities',
      path: '/items/activities',
      courseIds: ['crs-1'],
    });
    invalidateSpy.mockRestore();
  });

  it('buffers events while the assessment runner holds live sync', async () => {
    const events = collectEvents();
    const socket = await renderLiveSync();

    setLiveSyncSuppressed(true);
    act(() =>
      socket.emit({
        type: 'subscription',
        event: 'update',
        uid: 'quizzes',
        data: [{ id: 'q-1', course_id: 'crs-2' }],
      })
    );
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(events.events.length).toBe(0); // Held until the runner closes

    setLiveSyncSuppressed(false);
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(events.events).toEqual([
      { collection: 'quizzes', path: '/items/quizzes', courseIds: ['crs-2'] },
    ]);
  });

  it('coalesces bursts and reconnects with capped backoff', async () => {
    const first = await renderLiveSync();
    // Burst: server pushes multiple update frames in a row
    act(() => {
      first.emit({
        type: 'subscription',
        event: 'update',
        uid: 'activities',
        data: [{ id: 'i1', course_id: 'crs-1' }],
      });
      first.emit({
        type: 'subscription',
        event: 'update',
        uid: 'activities',
        data: [{ id: 'i2', course_id: 'crs-1' }],
      });
    });

    // Drop the socket: reconnect should back off (1s then 2s), capped at 30s
    act(() => first.close());
    expect(mine().length).toBe(1);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(mine().length).toBe(2);
    act(() => latest().close());
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(mine().length).toBe(3);
  });

  it('emits parentIds for parent-keyed collections (comments, replies)', async () => {
    const events = collectEvents();
    const socket = await renderLiveSync();
    act(() =>
      socket.emit({
        type: 'subscription',
        event: 'create',
        uid: 'module_comments',
        data: { id: 'mc-1', module_id: 'mod-9', course_id: undefined },
      })
    );
    act(() =>
      socket.emit({
        type: 'subscription',
        event: 'create',
        uid: 'announcement_replies',
        data: { id: 'ar-1', announcement_id: 'ann-3' },
      })
    );
    await act(async () => vi.advanceTimersByTimeAsync(500));
    const moduleEvent = events.events.find((e: any) => e.collection === 'module_comments') as any;
    expect(moduleEvent.parentIds).toEqual({ module_id: ['mod-9'] });
    const replyEvent = events.events.find((e: any) => e.collection === 'announcement_replies') as any;
    expect(replyEvent.parentIds).toEqual({ announcement_id: ['ann-3'] });
  });

  it('emits exactly one coalesced event per burst', async () => {
    const events = collectEvents();
    const socket = await renderLiveSync();
    act(() => {
      for (let i = 0; i < 5; i++) {
        socket.emit({
          type: 'subscription',
          event: 'update',
          uid: 'announcements',
          data: [{ id: `n${i}`, course_id: 'crs-7' }],
        });
      }
    });
    await act(async () => vi.advanceTimersByTimeAsync(500));
    const emitted = events.events.filter((e: any) => e.collection === 'announcements');
    expect(emitted.length).toBe(1);
    expect((emitted[0] as any).courseIds).toEqual(
      expect.arrayContaining(['crs-7'])
    );
  });
});
