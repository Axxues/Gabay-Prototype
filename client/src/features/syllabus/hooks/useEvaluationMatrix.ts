import { useState, useEffect, useCallback, useRef } from 'react';
import {
  matrixScopeId,
  fetchMatrixTemplate,
  createMatrixTemplate,
  updateMatrixTemplate,
  readCachedMatrix,
  writeCachedMatrix
} from '../api/evaluationMatrixApi';
import { DEFAULT_EVALUATION_MATRIX } from '../utils/defaultMatrixTemplate';
import type { EvaluationMatrix, MatrixSection } from '../types/lifecycle';

interface UseEvaluationMatrixReturn {
  template: EvaluationMatrix;
  loading: boolean;
  remoteId: string | null;
  saveTemplate: (sections: MatrixSection[]) => Promise<boolean>;
  resetTemplate: () => Promise<boolean>;
  getSnapshotForAssign: () => Promise<EvaluationMatrix>;
}

export function useEvaluationMatrix(
  department: string | undefined,
  collegeId: string,
  userName?: string
): UseEvaluationMatrixReturn {
  const scopeId = matrixScopeId(department, collegeId);

  const [template, setTemplate] = useState<EvaluationMatrix>(DEFAULT_EVALUATION_MATRIX);
  const [loading, setLoading] = useState(true);
  const [remoteId, setRemoteId] = useState<string | null>(null);
  const savingRef = useRef(false);

  // Load template on mount
  useEffect(() => {
    let mounted = true;

    async function loadTemplate() {
      setLoading(true);
      let cached: EvaluationMatrix | null = null;
      try {
        // 1. Check local cache first
        cached = readCachedMatrix(scopeId);
        if (cached && mounted) {
          setTemplate(cached);
        }

        // 2. Fetch from remote
        const remote = await fetchMatrixTemplate(scopeId);
        if (!mounted) return;

        if (remote) {
          // Remote wins only if version is newer
          if (remote.matrix.version > (cached?.version ?? 0)) {
            setTemplate(remote.matrix);
            writeCachedMatrix(scopeId, remote.matrix);
            setRemoteId(remote.id);
          }
        } else if (!cached) {
          // No cache, no remote - seed with default
          setTemplate(DEFAULT_EVALUATION_MATRIX);
        }
      } catch (err) {
        console.warn('[useEvaluationMatrix] Load failed:', err);
        if (!cached && mounted) {
          setTemplate(DEFAULT_EVALUATION_MATRIX);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTemplate();
    return () => { mounted = false; };
  }, [scopeId]);

  const saveTemplate = useCallback(async (sections: MatrixSection[]): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    try {
      const nextVersion = template.version + 1;
      const updatedMatrix: EvaluationMatrix = {
        ...template,
        sections,
        version: nextVersion,
        updatedAt: new Date().toISOString(),
        updatedBy: userName
      };

      let newRemoteId: string | null = null;
      if (remoteId) {
        await updateMatrixTemplate(remoteId, updatedMatrix, userName);
        newRemoteId = remoteId;
      } else {
        const result = await createMatrixTemplate(scopeId, updatedMatrix, userName);
        if (result) newRemoteId = result.id; // fetchMatrixTemplate returns { id, matrix }
      }

      if (!newRemoteId) return false;

      const finalMatrix = { ...updatedMatrix, id: newRemoteId };
      setTemplate(finalMatrix);
      writeCachedMatrix(scopeId, finalMatrix);
      setRemoteId(newRemoteId);
      return true;
    } catch (err) {
      console.warn('[useEvaluationMatrix] Save failed:', err);
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [template, remoteId, scopeId, userName]);

  const resetTemplate = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;
    savingRef.current = true;
    try {
      const nextVersion = template.version + 1;
      const defaultMatrix = {
        ...DEFAULT_EVALUATION_MATRIX,
        version: nextVersion,
        updatedAt: new Date().toISOString(),
        updatedBy: userName
      };

      if (remoteId) {
        await updateMatrixTemplate(remoteId, defaultMatrix, userName);
      } else {
        const result = await createMatrixTemplate(scopeId, defaultMatrix, userName);
        if (!result) return false;
      }

      const finalMatrix = { ...defaultMatrix };
      setTemplate(finalMatrix);
      writeCachedMatrix(scopeId, finalMatrix);
      return true;
    } catch (err) {
      console.warn('[useEvaluationMatrix] Reset failed:', err);
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [template, remoteId, scopeId, userName]);

  const getSnapshotForAssign = useCallback(async (): Promise<EvaluationMatrix> => {
    // Try local cache first
    const cached = readCachedMatrix(scopeId);
    if (cached) return cached;

    // Try remote
    const remote = await fetchMatrixTemplate(scopeId);
    if (remote) {
      writeCachedMatrix(scopeId, remote.matrix);
      return remote.matrix;
    }

    // Fallback to default
    return DEFAULT_EVALUATION_MATRIX;
  }, [scopeId]);

  return {
    template,
    loading,
    remoteId,
    saveTemplate,
    resetTemplate,
    getSnapshotForAssign
  };
}