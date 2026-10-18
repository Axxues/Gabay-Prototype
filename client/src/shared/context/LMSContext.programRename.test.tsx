import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LMSProvider, useLMS } from './LMSContext';

describe('LMSContext - Program Rename & Terminology Support', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LMSProvider>{children}</LMSProvider>
  );

  it('exposes programs matching departments with canonical Program terminology', () => {
    const { result } = renderHook(() => useLMS(), { wrapper });

    expect(result.current.programs).toBeDefined();
    expect(result.current.programs.length).toBeGreaterThanOrEqual(1);
    expect(result.current.programs).toBe(result.current.departments);

    const defaultProg = result.current.programs.find(p => p.code === 'CS');
    expect(defaultProg).toBeDefined();
    expect(defaultProg?.name).toBe('Computer Science');
  });

  it('allows adding a new program via addProgram and updates programs state', async () => {
    const { result } = renderHook(() => useLMS(), { wrapper });

    await act(async () => {
      await result.current.addProgram({
        id: 'prog-it',
        collegeId: 'col-ccs',
        name: 'Program in Information Technology',
        code: 'IT',
      });
    });

    const itProg = result.current.programs.find(p => p.id === 'prog-it');
    expect(itProg).toBeDefined();
    expect(itProg?.name).toBe('Program in Information Technology');
    expect(itProg?.code).toBe('IT');
  });

  it('evaluates program deletion blockers using Program terminology', () => {
    const { result } = renderHook(() => useLMS(), { wrapper });

    // The default CS program has a chairperson and affiliated users
    const blockers = result.current.getProgramDeleteBlockers('dept-cs');
    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.some(b => b.includes('Program has an assigned Program Chairperson'))).toBe(true);
  });

  it('deletes an eligible program using deleteProgram with Program terminology', async () => {
    const { result } = renderHook(() => useLMS(), { wrapper });

    // Add empty program with no chairperson or affiliated users
    await act(async () => {
      await result.current.addProgram({
        id: 'prog-empty',
        collegeId: 'col-ccs',
        name: 'Program in Data Science',
        code: 'DS',
      });
    });

    expect(result.current.programs.some(p => p.id === 'prog-empty')).toBe(true);
    expect(result.current.getProgramDeleteBlockers('prog-empty')).toEqual([]);

    let deleteRes: any;
    await act(async () => {
      deleteRes = await result.current.deleteProgram('prog-empty');
    });

    expect(deleteRes.success).toBe(true);
    expect(deleteRes.message).toMatch(/Program "Program in Data Science" \(DS\) was deleted successfully/i);
    expect(result.current.programs.some(p => p.id === 'prog-empty')).toBe(false);
  });
});
