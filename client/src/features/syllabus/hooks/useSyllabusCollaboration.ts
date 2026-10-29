import { useState, useEffect, useCallback, useMemo } from 'react';

export interface PeerMessage {
  type: 'PRESENCE_PING' | 'SECTION_UPDATE';
  groupId: string;
  senderId: string;
  senderName: string;
  activeStep: string;
  sectionTitle?: string;
  timestamp: number;
}

export interface CollaboratorInfo {
  senderId: string;
  senderName: string;
  activeStep: string;
  sectionTitle?: string;
  lastSeen: number;
}

const STEP_LABELS: Record<string, string> = {
  'course-info': 'Course Info',
  'outcomes': 'Outcomes & Statements',
  'outline': 'Course Outline',
  'learning-plan': 'Learning Plan',
  'course-map': 'Course Map',
  'grading': 'Grading Policies',
  'review': 'Review & Signatories'
};

const CHANNEL_NAME = 'gabay_syllabus_live_sync';

export function useSyllabusCollaboration(
  groupId: string | undefined,
  activeUser: { id?: string; name?: string } | null | undefined,
  activeStep: string = 'course-info'
) {
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);

  const handlePeerMessage = useCallback((msg: PeerMessage) => {
    if (!groupId || msg.groupId !== groupId) return;
    if (activeUser?.id && msg.senderId === activeUser.id) return;

    setCollaborators(prev => {
      const filtered = prev.filter(c => c.senderId !== msg.senderId);
      return [
        ...filtered,
        {
          senderId: msg.senderId,
          senderName: msg.senderName,
          activeStep: msg.activeStep,
          sectionTitle: msg.sectionTitle,
          lastSeen: msg.timestamp || Date.now()
        }
      ];
    });
  }, [groupId, activeUser?.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined' || !groupId) {
      return;
    }

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<PeerMessage>) => {
        if (event.data) {
          handlePeerMessage(event.data);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel initialization error:', e);
    }

    // Periodically ping presence
    const sendPing = () => {
      if (channel && activeUser?.id) {
        try {
          channel.postMessage({
            type: 'PRESENCE_PING',
            groupId,
            senderId: activeUser.id,
            senderName: activeUser.name || 'Co-Instructor',
            activeStep,
            timestamp: Date.now()
          } satisfies PeerMessage);
        } catch {
          // Channel closed or unhandled
        }
      }
    };

    sendPing();
    const interval = setInterval(sendPing, 5000);

    return () => {
      clearInterval(interval);
      try {
        channel?.close();
      } catch {
        // Ignore
      }
    };
  }, [groupId, activeUser?.id, activeUser?.name, activeStep, handlePeerMessage]);

  const broadcastStepChange = useCallback((stepId: string) => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined' || !groupId || !activeUser?.id) {
      return;
    }
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({
        type: 'PRESENCE_PING',
        groupId,
        senderId: activeUser.id,
        senderName: activeUser.name || 'Co-Instructor',
        activeStep: stepId,
        timestamp: Date.now()
      } satisfies PeerMessage);
      channel.close();
    } catch {
      // Ignore
    }
  }, [groupId, activeUser?.id, activeUser?.name]);

  const broadcastSectionUpdate = useCallback((stepId: string, sectionTitle: string) => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined' || !groupId || !activeUser?.id) {
      return;
    }
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({
        type: 'SECTION_UPDATE',
        groupId,
        senderId: activeUser.id,
        senderName: activeUser.name || 'Co-Instructor',
        activeStep: stepId,
        sectionTitle,
        timestamp: Date.now()
      } satisfies PeerMessage);
      channel.close();
    } catch {
      // Ignore
    }
  }, [groupId, activeUser?.id, activeUser?.name]);

  const activePresenceNotice = useMemo(() => {
    if (collaborators.length === 0) return undefined;
    const peer = collaborators[0];
    const stepLabel = STEP_LABELS[peer.activeStep] || peer.activeStep;
    return `${peer.senderName} is editing ${stepLabel}`;
  }, [collaborators]);

  return {
    collaborators,
    activePresenceNotice,
    handlePeerMessage,
    broadcastStepChange,
    broadcastSectionUpdate
  };
}
