import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { RealtimeSyncBridge } from './RealtimeSyncBridge';
import { emitRealtimeChange } from './api/realtimeApi';

const harness = vi.hoisted(() => ({
  refreshCourseContent: vi.fn(async () => {}),
  db: {
    modules: [{ id: 'mod-1', courseId: 'crs-1' }],
    announcements: [{ id: 'ann-1', courseId: 'crs-1' }],
    submissions: [{ id: 'sub-1', courseId: 'crs-4' }],
    activities: [{ id: 'act-1', courseId: 'crs-2' }],
  },
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    isAuthenticated: true,
    refreshCourseContent: harness.refreshCourseContent,
    db: harness.db,
  }),
}));

describe('RealtimeSyncBridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.refreshCourseContent.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const emit = (collection: string, parentIds: Record<string, string[]>, courseIds: string[] = []) =>
    emitRealtimeChange({ collection, path: `/items/${collection}`, courseIds, parentIds });

  const flush = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

  it('renders nothing', () => {
    const { container } = render(<RealtimeSyncBridge />);
    expect(container.innerHTML).toBe('');
  });

  it('refreshes the owning course of a parent-keyed comment event', async () => {
    render(<RealtimeSyncBridge />);
    act(() => emit('module_comments', { module_id: ['mod-1'] }));
    await flush();
    expect(harness.refreshCourseContent).toHaveBeenCalledTimes(1);
    expect(harness.refreshCourseContent).toHaveBeenCalledWith('crs-1');
  });

  it('resolves announcement replies and rubric scores to their courses', async () => {
    render(<RealtimeSyncBridge />);
    act(() => emit('announcement_replies', { announcement_id: ['ann-1'] }));
    await flush();
    expect(harness.refreshCourseContent).toHaveBeenCalledWith('crs-1');

    act(() => emit('submission_rubric_scores', { submission_id: ['sub-1'] }));
    await flush();
    expect(harness.refreshCourseContent).toHaveBeenCalledWith('crs-4');
  });

  it('coalesces parent events for the same course into one refresh', async () => {
    render(<RealtimeSyncBridge />);
    act(() => {
      emit('module_comments', { module_id: ['mod-1'] });
      emit('announcement_replies', { announcement_id: ['ann-1'] });
    });
    await flush();
    const crs1Calls = harness.refreshCourseContent.mock.calls.filter(c => c[0] === 'crs-1');
    expect(crs1Calls.length).toBe(1);
  });

  it('drops events whose parents are unknown locally', async () => {
    render(<RealtimeSyncBridge />);
    act(() => emit('module_comments', { module_id: ['mod-unknown'] }));
    await flush();
    expect(harness.refreshCourseContent).not.toHaveBeenCalled();
  });

  it('routes direct course events without parent resolution', async () => {
    render(<RealtimeSyncBridge />);
    act(() => emit('activities', [], ['crs-5']));
    await flush();
    expect(harness.refreshCourseContent).toHaveBeenCalledWith('crs-5');
  });
});
