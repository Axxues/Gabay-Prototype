import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEvaluationMatrix } from './useEvaluationMatrix';
import * as evaluationMatrixApiModule from '../api/evaluationMatrixApi';
import { DEFAULT_EVALUATION_MATRIX } from '../utils/defaultMatrixTemplate';
import type { EvaluationMatrix, MatrixSection } from '../types/lifecycle';

describe('useEvaluationMatrix', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  beforeEach(() => {
    vi.spyOn(evaluationMatrixApiModule, 'matrixScopeId').mockReturnValue('bscs');
    vi.spyOn(evaluationMatrixApiModule, 'fetchMatrixTemplate').mockResolvedValue(null);
    vi.spyOn(evaluationMatrixApiModule, 'createMatrixTemplate').mockResolvedValue(null);
    vi.spyOn(evaluationMatrixApiModule, 'updateMatrixTemplate').mockResolvedValue(null);
    vi.spyOn(evaluationMatrixApiModule, 'readCachedMatrix').mockReturnValue(null);
    vi.spyOn(evaluationMatrixApiModule, 'writeCachedMatrix').mockReturnValue(undefined);
  });

  it('seeds default when cache and remote are empty', async () => {
    evaluationMatrixApiModule.readCachedMatrix.mockReturnValue(null);
    evaluationMatrixApiModule.fetchMatrixTemplate.mockResolvedValue(null);

    const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'c1', 'Chair'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.template).toEqual(DEFAULT_EVALUATION_MATRIX);
    expect(evaluationMatrixApiModule.readCachedMatrix).toHaveBeenCalledWith('bscs');
    expect(evaluationMatrixApiModule.fetchMatrixTemplate).toHaveBeenCalledWith('bscs');
  });

  it('remote wins when newer version', async () => {
    const newerMatrix: EvaluationMatrix = {
      ...DEFAULT_EVALUATION_MATRIX,
      version: 2,
      updatedAt: '2026-10-31T00:00:00.000Z'
    };
    evaluationMatrixApiModule.readCachedMatrix.mockReturnValue(DEFAULT_EVALUATION_MATRIX);
    evaluationMatrixApiModule.fetchMatrixTemplate.mockResolvedValue({ id: 'remote-1', matrix: newerMatrix });

    const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'c1', 'Chair'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.template.version).toBe(2);
    expect(result.current.remoteId).toBe('remote-1');
    expect(evaluationMatrixApiModule.writeCachedMatrix).toHaveBeenCalledWith('bscs', newerMatrix);
  });

  it('saveTemplate creates then updates (version increments 1→2)', async () => {
    evaluationMatrixApiModule.readCachedMatrix.mockReturnValue(null);
    evaluationMatrixApiModule.fetchMatrixTemplate.mockResolvedValue(null);
    evaluationMatrixApiModule.createMatrixTemplate.mockResolvedValue({ id: 'new-1', matrix: { ...DEFAULT_EVALUATION_MATRIX, version: 2 } });

    const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'c1', 'Chair'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // First save (create)
    const sections = DEFAULT_EVALUATION_MATRIX.sections;
    const save1 = await act(async () => result.current.saveTemplate(sections));
    expect(save1).toBe(true);
    expect(evaluationMatrixApiModule.createMatrixTemplate).toHaveBeenCalledTimes(1);
    expect(result.current.template.version).toBe(2);

    // Second save (update)
    evaluationMatrixApiModule.updateMatrixTemplate.mockResolvedValue({ ...DEFAULT_EVALUATION_MATRIX, version: 3 });
    const save2 = await act(async () => result.current.saveTemplate(sections));
    expect(save2).toBe(true);
    expect(evaluationMatrixApiModule.updateMatrixTemplate).toHaveBeenCalledTimes(1);
    expect(result.current.template.version).toBe(3);
  });

  it('resetTemplate saves default sections with version bump', async () => {
    evaluationMatrixApiModule.readCachedMatrix.mockReturnValue(null);
    evaluationMatrixApiModule.fetchMatrixTemplate.mockResolvedValue(null);
    evaluationMatrixApiModule.createMatrixTemplate.mockResolvedValue({ id: 'new-1', matrix: { ...DEFAULT_EVALUATION_MATRIX, version: 2 } });

    const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'c1', 'Chair'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const resetResult = await act(async () => result.current.resetTemplate());
    expect(resetResult).toBe(true);
    expect(evaluationMatrixApiModule.createMatrixTemplate).toHaveBeenCalled();
    const createdMatrix = evaluationMatrixApiModule.createMatrixTemplate.mock.calls[0][1] as any;
    expect(createdMatrix.sections).toEqual(DEFAULT_EVALUATION_MATRIX.sections);
    expect(createdMatrix.version).toBe(2);
  });

  it('guards double save', async () => {
    evaluationMatrixApiModule.readCachedMatrix.mockReturnValue(null);
    evaluationMatrixApiModule.fetchMatrixTemplate.mockResolvedValue(null);
    let resolveCreate: (val: any) => void;
    const createPromise = new Promise(resolve => { resolveCreate = resolve; });
    evaluationMatrixApiModule.createMatrixTemplate.mockReturnValue(createPromise);

    const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'c1', 'Chair'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Fire two rapid saves
    const save1Promise = act(async () => result.current.saveTemplate(DEFAULT_EVALUATION_MATRIX.sections));
    const save2Promise = act(async () => result.current.saveTemplate(DEFAULT_EVALUATION_MATRIX.sections));

    resolveCreate!({ id: 'new-1', matrix: { ...DEFAULT_EVALUATION_MATRIX, version: 2 } });

    const [save1Result, save2Result] = await Promise.all([save1Promise, save2Promise]);

    // Only one should succeed
    const successCount = [save1Result, save2Result].filter(Boolean).length;
    expect(successCount).toBe(1);
    expect(evaluationMatrixApiModule.createMatrixTemplate).toHaveBeenCalledTimes(1);
  });

  it('getSnapshotForAssign falls back to default on 403', async () => {
    evaluationMatrixApiModule.readCachedMatrix.mockReturnValue(null);
    evaluationMatrixApiModule.fetchMatrixTemplate.mockResolvedValue(null);

    const { result } = renderHook(() => useEvaluationMatrix('BSCS', 'c1', 'Chair'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const snapshot = await act(async () => result.current.getSnapshotForAssign());
    expect(snapshot).toEqual(DEFAULT_EVALUATION_MATRIX);
  });
});