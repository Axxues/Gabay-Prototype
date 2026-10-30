import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWebSocketUrl,
  makeDraftId,
  fetchRemoteDraft,
  saveRemoteDraft,
  sendRemotePresence
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

    const saveRes = await saveRemoteDraft('course-uuid-123', {} as any);
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

  it('serializes writes so an older document cannot overwrite a newer one', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');

    const writtenInOrder: string[] = [];
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let callCount = 0;

    vi.spyOn(likhaApiModule, 'likhaRequest').mockImplementation((async (
      _path: string,
      options: RequestInit
    ) => {
      const body = JSON.parse(String(options?.body || '{}'));
      const payload = JSON.parse(body.content);
      callCount += 1;
      if (callCount === 1) await firstGate;
      writtenInOrder.push(payload.syllabusData.courseInfo.title);
      return { id: 'syl-draft-course-1' };
    }) as any);

    const firstSave = saveRemoteDraft('course-1', { courseInfo: { title: 'old' } } as any, 'u1');
    const secondSave = saveRemoteDraft('course-1', { courseInfo: { title: 'new' } } as any, 'u1');

    releaseFirst();
    await Promise.all([firstSave, secondSave]);

    // The newer document must land last, otherwise the server keeps stale content.
    expect(writtenInOrder).toEqual(['old', 'new']);
  });

  it('retries transient gateway failures instead of dropping the edit', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');

    const flaky = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('bad gateway'), { status: 502 }))
      .mockResolvedValueOnce({ id: 'syl-draft-course-1' });
    vi.spyOn(likhaApiModule, 'likhaRequest').mockImplementation(flaky as any);

    const savedId = await saveRemoteDraft('course-1', { courseInfo: { title: 'kept' } } as any, 'u1');

    expect(savedId).toBe('syl-draft-course-1');
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it('saves remote draft via PATCH and falls back to POST if 404', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');

    // First call rejects with 404, fallback calls POST with success
    const mockLikhaRequest = vi.fn()
      .mockRejectedValueOnce({ status: 404, message: 'not_found' })
      .mockResolvedValueOnce({ id: 'syl-draft-course-uuid-123' });
    vi.spyOn(likhaApiModule, 'likhaRequest').mockImplementation(mockLikhaRequest);

    const testSyllabus: any = { courseInfo: { title: 'SE2' } };
    const savedId = await saveRemoteDraft('course-uuid-123', testSyllabus, 'user-active');

    expect(savedId).toBe('syl-draft-course-uuid-123');
    expect(mockLikhaRequest).toHaveBeenCalledTimes(2);
    expect(mockLikhaRequest.mock.calls[0][1]?.method).toBe('PATCH');
    expect(mockLikhaRequest.mock.calls[1][1]?.method).toBe('POST');

    // Content saves never carry presence, so they cannot clobber heartbeats.
    const patchBody = JSON.parse(mockLikhaRequest.mock.calls[0][1]?.body as string);
    expect(Object.keys(patchBody)).toEqual(['content']);
    expect(JSON.parse(patchBody.content).syllabusData).toEqual(testSyllabus);
  });

  it('prefers the presence column over legacy content.presence', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');
    vi.spyOn(likhaApiModule, 'likhaRequest').mockResolvedValue({
      id: 'syl-draft-course-uuid-123',
      content: JSON.stringify({ syllabusData: { courseInfo: { code: 'CSPC 112' } } }),
      presence: {
        'sess-1': { senderId: 'u-1', senderName: 'Raymund Dilan', activeStep: 'course-info', lastSeen: Date.now() }
      }
    });

    const result = await fetchRemoteDraft('course-uuid-123');
    expect(result?.payload.presence?.['sess-1'].senderName).toBe('Raymund Dilan');
  });

  it('writes presence to its own column without touching content', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue('mock-jwt-token');
    const now = Date.now();
    const mockLikhaRequest = vi.fn()
      // presence read
      .mockResolvedValueOnce({
        id: 'syl-draft-course-uuid-123',
        presence: { stale: { senderId: 'old', senderName: 'Old', activeStep: 'course-info', lastSeen: now - 60000 } }
      })
      // presence write
      .mockResolvedValueOnce({ id: 'syl-draft-course-uuid-123' });
    vi.spyOn(likhaApiModule, 'likhaRequest').mockImplementation(mockLikhaRequest);

    await sendRemotePresence('course-uuid-123', {
      sessionId: 'sess-me',
      senderId: 'u-1',
      senderName: 'Raymund Dilan',
      activeStep: 'course-info',
      lastSeen: now
    });

    const [path, options] = mockLikhaRequest.mock.calls[1];
    expect(path).toContain('/items/syllabi/');
    expect(options?.method).toBe('PATCH');
    const body = JSON.parse(options?.body as string);
    expect(Object.keys(body)).toEqual(['presence']);
    expect(body.presence['sess-me'].senderName).toBe('Raymund Dilan');
    // Expired peers are pruned on merge.
    expect(body.presence.stale).toBeUndefined();
  });
});
