import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('delays updating value until specified timeout has elapsed', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'initial' },
    });

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
    vi.useRealTimers();
  });

  it('resets timer when value changes rapidly before delay', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'first' },
    });

    rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('first');

    rerender({ value: 'third' });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    // Not enough time has passed for 'third' yet (only 150ms since 'third')
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('third');
    vi.useRealTimers();
  });
});
