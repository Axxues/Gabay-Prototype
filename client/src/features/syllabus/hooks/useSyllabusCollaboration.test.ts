import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSyllabusCollaboration, getOwnSessionIds } from './useSyllabusCollaboration';
import * as collaborationApi from '../api/syllabusCollaborationApi';
import * as likhaApiModule from '../../../shared/api/likhaLmsApi';

describe('useSyllabusCollaboration', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('flushes the pending debounced save when the studio closes', async () => {
    // No live backend in tests: tokenless hooks short-circuit remote calls.
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue(null);
    const saveSpy = vi
      .spyOn(collaborationApi, 'saveRemoteDraft')
      .mockResolvedValue('syl-draft-course-1');

    const user = { id: 'u1', name: 'Dr. Santos' };
    const syllabus: any = { courseInfo: { title: 'Software Engineering 2' } };
    const { result, unmount } = renderHook(() =>
      useSyllabusCollaboration('grp-1', user, 'course-info', 'course-1')
    );

    act(() => {
      result.current.broadcastSectionUpdate('course-info', 'Course Info', syllabus);
    });

    // Closed before the 350ms debounce fired.
    unmount();

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][0]).toBe('course-1');
    expect(saveSpy.mock.calls[0][1]).toEqual(syllabus);
  });

  it('reports a failed save and can retry it without another edit', async () => {
    vi.spyOn(likhaApiModule, 'getValidToken').mockResolvedValue(null);
    const saveSpy = vi
      .spyOn(collaborationApi, 'saveRemoteDraft')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('syl-draft-course-1');

    const user = { id: 'u1', name: 'Dr. Santos' };
    const syllabus: any = { courseInfo: { title: 'Software Engineering 2' } };
    const { result } = renderHook(() =>
      useSyllabusCollaboration('grp-1', user, 'course-info', 'course-1')
    );

    await act(async () => {
      result.current.broadcastSectionUpdate('course-info', 'Course Info', syllabus);
      await new Promise(resolve => setTimeout(resolve, 400));
    });
    expect(result.current.syncStatus).toBe('error');

    await act(async () => {
      await result.current.retrySave();
    });

    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(result.current.syncStatus).toBe('saved');
  });

  it('broadcasts presence and tracks active peer collaborators', () => {
    const userA = { id: 'u1', name: 'Dr. Santos' };
    const { result: hookA } = renderHook(() =>
      useSyllabusCollaboration('grp-1', userA, 'course-info')
    );

    expect(hookA.current.collaborators).toEqual([]);

    // Simulate peer presence message from Dr. Reyes in the same group
    act(() => {
      hookA.current.handlePeerMessage({
        type: 'PRESENCE_PING',
        groupId: 'grp-1',
        senderId: 'u2',
        senderName: 'Prof. Reyes',
        activeStep: 'learning-plan',
        timestamp: Date.now()
      });
    });

    expect(hookA.current.collaborators).toHaveLength(1);
    expect(hookA.current.collaborators[0].senderName).toBe('Prof. Reyes');
    expect(hookA.current.collaborators[0].activeStep).toBe('learning-plan');
    expect(hookA.current.activePresenceNotice).toContain('Prof. Reyes is editing Learning Plan');
  });

  it('ignores peer messages belonging to a different syllabus group', () => {
    const userA = { id: 'u1', name: 'Dr. Santos' };
    const { result: hookA } = renderHook(() =>
      useSyllabusCollaboration('grp-1', userA, 'course-info')
    );

    act(() => {
      hookA.current.handlePeerMessage({
        type: 'PRESENCE_PING',
        groupId: 'grp-DIFFERENT',
        senderId: 'u3',
        senderName: 'Dr. Garcia',
        activeStep: 'outcomes',
        timestamp: Date.now()
      });
    });

    expect(hookA.current.collaborators).toEqual([]);
    expect(hookA.current.activePresenceNotice).toBeUndefined();
  });

  it('triggers onRemoteUpdate when a peer broadcasts syllabus data', () => {
    let receivedData: any = null;
    const userA = { id: 'u1', name: 'Dr. Santos' };
    const { result: hookA } = renderHook(() =>
      useSyllabusCollaboration('grp-1', userA, 'course-info', undefined, (data) => {
        receivedData = data;
      })
    );

    const testSyllabus: any = {
      institution: { university: 'DMMMSU North La Union' },
      courseInfo: { code: 'CSPC 112', title: 'Software Engineering 2' }
    };

    act(() => {
      hookA.current.handlePeerMessage({
        type: 'SECTION_UPDATE',
        groupId: 'grp-1',
        senderId: 'u2',
        senderName: 'Prof. Reyes',
        activeStep: 'course-info',
        sectionTitle: 'Course Info',
        syllabusData: testSyllabus,
        timestamp: Date.now()
      });
    });

    expect(receivedData).toEqual(testSyllabus);
    expect(hookA.current.activePresenceNotice).toContain('Prof. Reyes is co-editing this step');
  });

  it('ignores its own presence left behind by an earlier mount', () => {
    const user = { id: 'u1', name: 'Raymund Dilan' };

    const first = renderHook(() => useSyllabusCollaboration('grp-1', user, 'course-info'));
    const firstSessionId = getOwnSessionIds('u1')[0];
    expect(firstSessionId).toBeTruthy();
    first.unmount();

    // A remount (reload / route change / HMR) keeps the earlier id on record.
    const second = renderHook(() => useSyllabusCollaboration('grp-1', user, 'course-info'));
    expect(getOwnSessionIds('u1')).toContain(firstSessionId);

    act(() => {
      second.result.current.handlePeerMessage({
        type: 'PRESENCE_PING',
        sessionId: firstSessionId!,
        groupId: 'grp-1',
        senderId: 'u1',
        senderName: 'Raymund Dilan',
        activeStep: 'course-info',
        timestamp: Date.now()
      });
    });

    expect(second.result.current.collaborators).toEqual([]);
    expect(second.result.current.activePresenceNotice).toBeUndefined();
  });

  it('still flags a genuinely separate session of the same account', () => {
    const user = { id: 'u1', name: 'Raymund Dilan' };
    const { result } = renderHook(() => useSyllabusCollaboration('grp-1', user, 'course-info'));

    act(() => {
      result.current.handlePeerMessage({
        type: 'PRESENCE_PING',
        sessionId: 'sess_other_tab',
        groupId: 'grp-1',
        senderId: 'u1',
        senderName: 'Raymund Dilan',
        activeStep: 'course-info',
        timestamp: Date.now()
      });
    });

    expect(result.current.activePresenceNotice).toContain(
      'Raymund Dilan (Other Session) is co-editing this step'
    );
  });

  it('renders multi-peer collaboration notice when multiple colleagues are present', () => {
    const userA = { id: 'u1', name: 'Dr. Santos' };
    const { result: hookA } = renderHook(() =>
      useSyllabusCollaboration('grp-1', userA, 'course-info')
    );

    act(() => {
      hookA.current.handlePeerMessage({
        type: 'PRESENCE_PING',
        groupId: 'grp-1',
        senderId: 'u2',
        senderName: 'Prof. Reyes',
        activeStep: 'outcomes',
        timestamp: Date.now()
      });
      hookA.current.handlePeerMessage({
        type: 'PRESENCE_PING',
        groupId: 'grp-1',
        senderId: 'u3',
        senderName: 'Engr. Dilan',
        activeStep: 'learning-plan',
        timestamp: Date.now()
      });
    });

    expect(hookA.current.collaborators).toHaveLength(2);
    expect(hookA.current.activePresenceNotice).toContain('Prof. & Engr. are active on this syllabus');
  });

  it('broadcasts consensus agreements and triggers onRemoteConsensusUpdate for peers', () => {
    let receivedAgreements: Record<string, boolean> | null = null;
    let receivedStatus: string | undefined;

    const userElena = { id: 'u-elena', name: 'Elena Santos' };
    const { result: hookElena } = renderHook(() =>
      useSyllabusCollaboration(
        'grp-1',
        userElena,
        'review',
        'c-1',
        undefined,
        (agreements, status) => {
          receivedAgreements = agreements;
          receivedStatus = status;
        }
      )
    );

    // Simulate receiving consensus agreement from Raymund Dilan
    act(() => {
      hookElena.current.handlePeerMessage({
        type: 'CONSENSUS_UPDATE',
        groupId: 'grp-1',
        senderId: 'u-raymund',
        senderName: 'Raymund Dilan',
        activeStep: 'review',
        submissionAgreements: { 'u-raymund': true },
        status: 'submission_in_progress',
        timestamp: Date.now()
      });
    });

    expect(receivedAgreements).toEqual({ 'u-raymund': true });
    expect(receivedStatus).toBe('submission_in_progress');
  });
});
