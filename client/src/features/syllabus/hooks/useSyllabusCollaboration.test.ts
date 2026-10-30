import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyllabusCollaboration } from './useSyllabusCollaboration';

describe('useSyllabusCollaboration', () => {
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
});
