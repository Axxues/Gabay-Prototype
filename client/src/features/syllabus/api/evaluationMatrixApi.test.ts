import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  matrixScopeId,
  readCachedMatrix,
  fetchMatrixTemplate,
  createMatrixTemplate,
  updateMatrixTemplate
} from './evaluationMatrixApi';
import * as likhaApiModule from '../../../shared/api/likhaLmsApi';
import type { EvaluationMatrix } from '../types/lifecycle';

const sections = [{ id: 's1', title: 'Course Info', criteria: [{ id: 'c1', text: 'Has code' }] }];
const matrix: EvaluationMatrix = { version: 3, updatedAt: '2026-10-31T00:00:00.000Z', sections };

describe('evaluationMatrixApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('derives the scope id from department, falling back to college', () => {
    expect(matrixScopeId('BSCS', 'c1')).toBe('bscs');
    expect(matrixScopeId('  ', 'c1')).toBe('c1');
    expect(matrixScopeId('Computer Science', 'c1')).toBe('computer-science');
  });

  it('maps a fetched row, parsing sections from its JSON string', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');
    const spy = vi.spyOn(likhaApiModule, 'likhaRequest').mockResolvedValue([
      {
        id: 'row-1',
        scope_id: 'bscs',
        sections: JSON.stringify(sections),
        version: 3,
        updated_by_name: 'Dr. Santos',
        date_updated: '2026-10-30T10:00:00.000Z'
      }
    ]);

    const result = await fetchMatrixTemplate('bscs');

    expect(result).toEqual({
      version: 3,
      updatedAt: '2026-10-30T10:00:00.000Z',
      updatedBy: 'Dr. Santos',
      sections
    });
    expect(String(spy.mock.calls[0][0])).toContain(
      '/items/gabay_syllabus_eval_matrix?filter%5Bscope_id%5D%5B_eq%5D=bscs'
    );
  });

  it('returns null when the template is forbidden (403)', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');
    vi.spyOn(likhaApiModule, 'likhaRequest').mockRejectedValue(Object.assign(new Error('forbidden'), { status: 403 }));

    expect(await fetchMatrixTemplate('bscs')).toBeNull();
  });

  it('returns null when no template exists for the scope', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');
    vi.spyOn(likhaApiModule, 'likhaRequest').mockResolvedValue([]);

    expect(await fetchMatrixTemplate('bscs')).toBeNull();
  });

  it('POSTs the template payload and caches the stored matrix on success', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');
    const spy = vi.spyOn(likhaApiModule, 'likhaRequest').mockResolvedValue({
      id: 'row-1',
      scope_id: 'bscs',
      sections: JSON.stringify(sections),
      version: 3,
      updated_by_name: 'Dr. Santos',
      date_updated: '2026-10-31T01:00:00.000Z'
    });

    const saved = await createMatrixTemplate('bscs', matrix, 'Dr. Santos');

    const [path, options] = spy.mock.calls[0];
    expect(path).toBe('/items/gabay_syllabus_eval_matrix');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({
      scope_id: 'bscs',
      sections: JSON.stringify(sections),
      version: 3,
      updated_by_name: 'Dr. Santos'
    });
    expect(saved?.updatedAt).toBe('2026-10-31T01:00:00.000Z');
    expect(readCachedMatrix('bscs')).toEqual(saved);
  });

  it('returns null from PATCH after retrying transient failures', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');
    const spy = vi
      .spyOn(likhaApiModule, 'likhaRequest')
      .mockRejectedValue(Object.assign(new Error('bad gateway'), { status: 502 }));

    expect(await updateMatrixTemplate('row-1', matrix, 'Dr. Santos')).toBeNull();
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls[0][1]?.method).toBe('PATCH');
  });

  it('returns null from saves when logged out', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue(null);
    const spy = vi.spyOn(likhaApiModule, 'likhaRequest');

    expect(await createMatrixTemplate('bscs', matrix)).toBeNull();
    expect(await updateMatrixTemplate('row-1', matrix)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns null when the cached matrix is invalid JSON', () => {
    localStorage.setItem('gabay_syllabus_eval_matrix:bscs', '{not json');

    expect(readCachedMatrix('bscs')).toBeNull();
  });
});
