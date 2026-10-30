import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWebSocketUrl,
  makeDraftId,
  fetchRemoteDraft,
  saveRemoteDraft
} from './syllabusCollaborationApi';
import * as likhaApiModule from '../../../shared/api/likhaLmsApi';

describe('syllabusCollaborationApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('constructs predictable draft ids from canonical course id', () => {
    expect(makeDraftId('course-uuid-123')).toBe('syl-draft-course-uuid-123');
  });

  it('computes WebSocket URL pointing to /websocket', () => {
    const wsUrl = getWebSocketUrl();
    expect(wsUrl).toContain('websocket');
  });

  it('returns null if user token is absent', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue(null);
    const draft = await fetchRemoteDraft('course-uuid-123');
    expect(draft).toBeNull();

    const saveRes = await saveRemoteDraft('course-uuid-123', {} as any, {});
    expect(saveRes).toBeNull();
  });

  it('fetches remote draft and parses JSON syllabusData', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');
    const mockContent = JSON.stringify({
      syllabusData: {
        courseInfo: { code: 'CSPC 112', title: 'Software Engineering 2' }
      },
      presence: {
        'u-1': { senderId: 'u-1', senderName: 'Prof. Reyes', activeStep: 'course-info', lastSeen: Date.now() }
      }
    });

    vi.spyOn(likhaApiModule, 'likhaRequest').mockResolvedValue({
      id: 'syl-draft-course-uuid-123',
      content: mockContent
    });

    const result = await fetchRemoteDraft('course-uuid-123');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('syl-draft-course-uuid-123');
    expect(result?.payload.syllabusData?.courseInfo?.code).toBe('CSPC 112');
    expect(result?.payload.presence?.['u-1'].senderName).toBe('Prof. Reyes');
  });

  it('saves remote draft via PATCH and falls back to POST if 404', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');

    // First call rejects with 404, fallback calls POST with success
    const mockLikhaRequest = vi.fn()
      .mockRejectedValueOnce({ status: 404, message: 'not_found' })
      .mockResolvedValueOnce({ id: 'syl-draft-course-uuid-123' });
    vi.spyOn(likhaApiModule, 'likhaRequest').mockImplementation(mockLikhaRequest);

    const testSyllabus: any = { courseInfo: { title: 'SE2' } };
    const savedId = await saveRemoteDraft('course-uuid-123', testSyllabus, {}, 'user-active');

    expect(savedId).toBe('syl-draft-course-uuid-123');
    expect(mockLikhaRequest).toHaveBeenCalledTimes(2);
    expect(mockLikhaRequest.mock.calls[0][1]?.method).toBe('PATCH');
    expect(mockLikhaRequest.mock.calls[1][1]?.method).toBe('POST');
  });
});
