import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSyllabusDraftsStorage, STORAGE_KEY } from './useSyllabusDraftsStorage';

describe('useSyllabusDraftsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with a default draft when storage is empty', () => {
    const { result } = renderHook(() => useSyllabusDraftsStorage());
    expect(result.current.drafts.length).toBeGreaterThan(0);
    expect(result.current.activeDraft).toBeDefined();
    expect(result.current.activeDraft?.data.institution.university).toContain('Don Mariano Marcos Memorial State University');
  });

  it('creates, clones, and deletes drafts correctly', () => {
    const { result } = renderHook(() => useSyllabusDraftsStorage());
    let newDraftId = '';
    act(() => {
      const created = result.current.createDraft(undefined, 'CS 101 Syllabus');
      newDraftId = created.id;
    });
    expect(result.current.drafts.some(d => d.id === newDraftId)).toBe(true);

    let clonedId = '';
    act(() => {
      const cloned = result.current.cloneDraft(newDraftId);
      clonedId = cloned.id;
    });
    expect(result.current.drafts.some(d => d.id === clonedId)).toBe(true);

    act(() => {
      result.current.deleteDraft(newDraftId);
    });
    expect(result.current.drafts.some(d => d.id === newDraftId)).toBe(false);
  });

  it('handles corrupted localStorage gracefully (Review Focus 1)', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json');
    const { result } = renderHook(() => useSyllabusDraftsStorage());
    expect(result.current.drafts.length).toBeGreaterThan(0);
    expect(result.current.activeDraft).toBeDefined();
  });

  it('filters out malformed or corrupt draft items from localStorage array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([null, { id: 'broken' }, { id: 'no-data', data: {} }]));
    const { result } = renderHook(() => useSyllabusDraftsStorage());
    expect(result.current.drafts.length).toBeGreaterThan(0);
    expect(result.current.activeDraft?.data?.courseInfo).toBeDefined();
  });
});
