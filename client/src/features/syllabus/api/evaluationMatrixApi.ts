import { getValidToken, likhaRequest } from '../../../shared/api/likhaLmsApi';
import type { EvaluationMatrix, MatrixSection } from '../types/lifecycle';

const COLLECTION = '/items/gabay_syllabus_eval_matrix';
const CACHE_PREFIX = 'gabay_syllabus_eval_matrix:';

export function matrixScopeId(department: string | undefined, collegeId: string): string {
  const dept = (department || '').trim().toLowerCase().replace(/\s+/g, '-');
  return dept || collegeId;
}

export function readCachedMatrix(scopeId: string): EvaluationMatrix | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + scopeId);
    return raw ? (JSON.parse(raw) as EvaluationMatrix) : null;
  } catch {
    return null;
  }
}

function writeCachedMatrix(scopeId: string, matrix: EvaluationMatrix): void {
  try {
    localStorage.setItem(CACHE_PREFIX + scopeId, JSON.stringify(matrix));
  } catch {
    // Storage full or disabled: the cache is only an optimisation.
  }
}

function parseSections(value: any): MatrixSection[] | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toMatrix(row: any, fallback: EvaluationMatrix): EvaluationMatrix {
  return {
    version: row?.version ?? fallback.version,
    updatedAt: row?.date_updated || fallback.updatedAt,
    updatedBy: row?.updated_by_name || fallback.updatedBy,
    sections: parseSections(row?.sections) ?? fallback.sections
  };
}

export async function fetchMatrixTemplate(
  scopeId: string
): Promise<{ id: string; matrix: EvaluationMatrix } | null> {
  const token = await getValidToken();
  if (!token) return null;

  try {
    const items = await likhaRequest<any[]>(
      `${COLLECTION}?filter%5Bscope_id%5D%5B_eq%5D=${encodeURIComponent(
        scopeId
      )}&fields=id,scope_id,sections,version,updated_by_name,date_updated`
    );
    const row = Array.isArray(items) ? items[0] : undefined;
    if (!row) return null;
    const sections = parseSections(row.sections);
    if (!sections) return null;
    return {
      id: String(row.id),
      matrix: {
        version: row.version ?? 1,
        updatedAt: row.date_updated || '',
        updatedBy: row.updated_by_name || undefined,
        sections
      }
    };
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isRetryableSaveError(err: any): boolean {
  const status = Number(err?.status);
  if (!status) return true;
  return status >= 500 || status === 408 || status === 429;
}

// A retried POST after an ambiguous 5xx is safe: scope_id is UNIQUE server-side,
// so a duplicate insert fails the constraint instead of creating a second template.
async function saveWithRetry<T>(write: () => Promise<T>): Promise<T | null> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await write();
    } catch (err) {
      if (attempt === maxAttempts || !isRetryableSaveError(err)) {
        console.warn('[evaluationMatrixApi] save failed:', err);
        return null;
      }
      await sleep(400 * attempt + Math.random() * 200);
    }
  }
  return null;
}

export async function createMatrixTemplate(
  scopeId: string,
  matrix: EvaluationMatrix,
  updatedByName?: string
): Promise<EvaluationMatrix | null> {
  const token = await getValidToken();
  if (!token) return null;

  const stored = await saveWithRetry(() =>
    likhaRequest<any>(COLLECTION, {
      method: 'POST',
      body: JSON.stringify({
        scope_id: scopeId,
        sections: JSON.stringify(matrix.sections),
        version: matrix.version,
        updated_by_name: updatedByName
      })
    })
  );
  if (!stored) return null;

  const saved = toMatrix(stored, { ...matrix, updatedBy: updatedByName ?? matrix.updatedBy });
  writeCachedMatrix(scopeId, saved);
  return saved;
}

export async function updateMatrixTemplate(
  id: string,
  matrix: EvaluationMatrix,
  updatedByName?: string
): Promise<EvaluationMatrix | null> {
  const token = await getValidToken();
  if (!token) return null;

  const stored = await saveWithRetry(() =>
    likhaRequest<any>(`${COLLECTION}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        sections: JSON.stringify(matrix.sections),
        version: matrix.version,
        updated_by_name: updatedByName
      })
    })
  );
  if (!stored) return null;

  const saved = toMatrix(stored, { ...matrix, updatedBy: updatedByName ?? matrix.updatedBy });
  if (stored.scope_id) writeCachedMatrix(stored.scope_id, saved);
  return saved;
}
