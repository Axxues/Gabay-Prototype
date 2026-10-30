import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import { getValidToken } from '../../../shared/api/likhaLmsApi';
import {
  getWebSocketUrl,
  makeDraftId,
  fetchRemoteDraft,
  saveRemoteDraft,
  sendRemotePresence,
  removeRemotePresence
} from '../api/syllabusCollaborationApi';

export interface PeerMessage {
  type: 'PRESENCE_PING' | 'SECTION_UPDATE';
  sessionId?: string;
  groupId: string;
  senderId: string;
  senderName: string;
  activeStep: string;
  sectionTitle?: string;
  syllabusData?: OfficialSyllabusData;
  timestamp: number;
}

export interface CollaboratorInfo {
  sessionId?: string;
  senderId: string;
  senderName: string;
  activeStep: string;
  sectionTitle?: string;
  lastSeen: number;
}

export const STEP_LABELS: Record<string, string> = {
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
  activeStep: string = 'course-info',
  canonicalCourseId?: string,
  onRemoteUpdate?: (syllabusData: OfficialSyllabusData) => void
) {
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const lastRemoteTimestampRef = useRef<number>(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate a unique per-tab/per-desktop session ID to differentiate multiple devices using the same user account
  const clientSessionId = useMemo(() => {
    return 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  }, []);

  const handlePeerMessage = useCallback((msg: PeerMessage) => {
    if (!groupId || msg.groupId !== groupId) return;
    // Ignore echos from the same session
    if (msg.sessionId && msg.sessionId === clientSessionId) return;
    if (!msg.sessionId && activeUser?.id && msg.senderId === activeUser.id) return;

    setCollaborators(prev => {
      const peerKey = msg.sessionId || msg.senderId;
      const filtered = prev.filter(c => (c.sessionId || c.senderId) !== peerKey);
      return [
        ...filtered,
        {
          sessionId: msg.sessionId || msg.senderId,
          senderId: msg.senderId,
          senderName: msg.senderName,
          activeStep: msg.activeStep,
          sectionTitle: msg.sectionTitle,
          lastSeen: msg.timestamp || Date.now()
        }
      ];
    });

    if (msg.syllabusData && onRemoteUpdate && msg.timestamp > lastRemoteTimestampRef.current) {
      lastRemoteTimestampRef.current = msg.timestamp;
      onRemoteUpdate(msg.syllabusData);
    }
  }, [groupId, activeUser?.id, clientSessionId, onRemoteUpdate]);

  // 1. Same-origin BroadcastChannel for multi-tab sync
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

    const sendPing = () => {
      if (channel && activeUser?.id) {
        try {
          channel.postMessage({
            type: 'PRESENCE_PING',
            sessionId: clientSessionId,
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

    // Prune stale collaborators not seen within 15 seconds
    const pruneInterval = setInterval(() => {
      const cutoff = Date.now() - 15000;
      setCollaborators(prev => prev.filter(c => c.lastSeen >= cutoff));
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(pruneInterval);
      try {
        channel?.close();
      } catch {
        // Ignore
      }
    };
  }, [groupId, activeUser?.id, activeUser?.name, activeStep, clientSessionId, handlePeerMessage]);

  // 2. Cross-desktop real-time WebSocket connection to Likha ERP
  useEffect(() => {
    if (typeof window === 'undefined' || !canonicalCourseId || !groupId) {
      return;
    }

    let ws: WebSocket | null = null;
    let isSubscribed = false;
    let isDisposed = false;
    const targetDraftId = makeDraftId(canonicalCourseId);

    const connectWs = async () => {
      try {
        const token = await getValidToken();
        if (!token || isDisposed) return;

        const wsUrl = getWebSocketUrl();
        if (!wsUrl) return;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (isDisposed) {
            ws?.close();
            return;
          }
          ws?.send(JSON.stringify({ type: 'auth', access_token: token }));
        };

        ws.onmessage = (event) => {
          if (isDisposed) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'auth' && msg.status === 'ok') {
              isSubscribed = true;
              ws?.send(JSON.stringify({
                type: 'subscribe',
                collection: 'syllabi',
                query: { fields: ['id', 'course_id', 'status', 'content', 'version'] }
              }));
            } else if (
              msg.type === 'subscription' &&
              (msg.event === 'update' || msg.event === 'create' || msg.event === 'init')
            ) {
              const items = Array.isArray(msg.data) ? msg.data : [msg.data];
              const relevant = items.find(
                (item: any) =>
                  item &&
                  (item.id === targetDraftId ||
                    (item.course_id === canonicalCourseId && item.status === 'draft'))
              );

              if (relevant?.content) {
                const parsed =
                  typeof relevant.content === 'string'
                    ? JSON.parse(relevant.content)
                    : relevant.content;

                // Sync remote presence
                if (parsed.presence && typeof parsed.presence === 'object') {
                  const cutoff = Date.now() - 15000;
                  const remotePeers: CollaboratorInfo[] = Object.values(parsed.presence)
                    .filter((p: any) => {
                      if (!p || (!p.senderId && !p.sessionId)) return false;
                      const isMe = p.sessionId === clientSessionId;
                      return !isMe && (p.lastSeen || 0) >= cutoff;
                    })
                    .map((p: any) => ({
                      sessionId: p.sessionId || p.senderId,
                      senderId: p.senderId,
                      senderName: p.senderName,
                      activeStep: p.activeStep || 'course-info',
                      sectionTitle: p.sectionTitle,
                      lastSeen: p.lastSeen || Date.now()
                    }));

                  setCollaborators(remotePeers);
                }

                // Sync remote content edits from other sessions/desktops
                const isOtherSession =
                  (parsed.lastUpdatedBySessionId && parsed.lastUpdatedBySessionId !== clientSessionId) ||
                  (!parsed.lastUpdatedBySessionId && parsed.lastUpdatedBy && parsed.lastUpdatedBy !== activeUser?.id);

                if (
                  isOtherSession &&
                  parsed.syllabusData &&
                  (parsed.updatedAt || 0) > lastRemoteTimestampRef.current
                ) {
                  lastRemoteTimestampRef.current = parsed.updatedAt || Date.now();
                  onRemoteUpdate?.(parsed.syllabusData);
                }
              }
            }
          } catch {
            // Silently handle parse errors
          }
        };

        ws.onerror = () => {
          // Fallback polling will handle data sync if WS is blocked
        };

        ws.onclose = () => {
          isSubscribed = false;
        };
      } catch (err) {
        console.warn('[useSyllabusCollaboration] WebSocket connection error:', err);
      }
    };

    connectWs();

    // 3. Fallback polling and presence heartbeat every 4 seconds
    const pollAndHeartbeat = async () => {
      if (isDisposed || !canonicalCourseId || !activeUser?.id) return;

      const userPresence: CollaboratorInfo = {
        sessionId: clientSessionId,
        senderId: activeUser.id,
        senderName: activeUser.name || 'Co-Instructor',
        activeStep,
        lastSeen: Date.now()
      };

      // Send remote presence heartbeat
      sendRemotePresence(canonicalCourseId, userPresence).catch(() => {});

      // If WebSocket is not connected/subscribed, poll draft content
      if (!isSubscribed) {
        try {
          const remote = await fetchRemoteDraft(canonicalCourseId);
          if (remote?.payload && !isDisposed) {
            const { presence, syllabusData, lastUpdatedBy, lastUpdatedBySessionId, updatedAt } = remote.payload;
            if (presence) {
              const cutoff = Date.now() - 15000;
              const peers = Object.values(presence).filter(
                p => p.sessionId !== clientSessionId && (p.lastSeen || 0) >= cutoff
              );
              setCollaborators(peers);
            }
            const isOtherSession =
              (lastUpdatedBySessionId && lastUpdatedBySessionId !== clientSessionId) ||
              (!lastUpdatedBySessionId && lastUpdatedBy && lastUpdatedBy !== activeUser.id);

            if (
              isOtherSession &&
              syllabusData &&
              (updatedAt || 0) > lastRemoteTimestampRef.current
            ) {
              lastRemoteTimestampRef.current = updatedAt || Date.now();
              onRemoteUpdate?.(syllabusData);
            }
          }
        } catch {
          // Ignore polling errors
        }
      }
    };

    pollAndHeartbeat();
    const syncInterval = setInterval(pollAndHeartbeat, 4000);

    return () => {
      isDisposed = true;
      clearInterval(syncInterval);
      if (ws) {
        try {
          ws.close();
        } catch {
          // Ignore
        }
      }
      if (canonicalCourseId) {
        removeRemotePresence(canonicalCourseId, clientSessionId).catch(() => {});
      }
    };
  }, [canonicalCourseId, groupId, activeUser?.id, activeUser?.name, activeStep, clientSessionId, onRemoteUpdate]);

  const broadcastStepChange = useCallback((stepId: string) => {
    if (!groupId || !activeUser?.id) return;

    if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({
          type: 'PRESENCE_PING',
          sessionId: clientSessionId,
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
    }

    if (canonicalCourseId) {
      sendRemotePresence(canonicalCourseId, {
        sessionId: clientSessionId,
        senderId: activeUser.id,
        senderName: activeUser.name || 'Co-Instructor',
        activeStep: stepId,
        lastSeen: Date.now()
      }).catch(() => {});
    }
  }, [groupId, canonicalCourseId, activeUser?.id, activeUser?.name, clientSessionId]);

  const broadcastSectionUpdate = useCallback((
    stepId: string,
    sectionTitle: string,
    updatedData?: OfficialSyllabusData
  ) => {
    if (!groupId || !activeUser?.id) return;

    const now = Date.now();

    // 1. Local BroadcastChannel
    if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({
          type: 'SECTION_UPDATE',
          sessionId: clientSessionId,
          groupId,
          senderId: activeUser.id,
          senderName: activeUser.name || 'Co-Instructor',
          activeStep: stepId,
          sectionTitle,
          syllabusData: updatedData,
          timestamp: now
        } satisfies PeerMessage);
        channel.close();
      } catch {
        // Ignore
      }
    }

    // 2. Debounced save to remote Likha draft to trigger real-time WebSocket push across all desktops
    if (canonicalCourseId && updatedData) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        const userId = activeUser.id!;
        const currentPresenceMap: Record<string, CollaboratorInfo> = {};
        for (const c of collaborators) {
          const key = c.sessionId || c.senderId;
          currentPresenceMap[key] = c;
        }
        currentPresenceMap[clientSessionId] = {
          sessionId: clientSessionId,
          senderId: userId,
          senderName: activeUser.name || 'Co-Instructor',
          activeStep: stepId,
          sectionTitle,
          lastSeen: Date.now()
        };

        saveRemoteDraft(
          canonicalCourseId,
          updatedData,
          currentPresenceMap,
          userId,
          clientSessionId
        ).catch(() => {});
      }, 350);
    }
  }, [groupId, canonicalCourseId, activeUser?.id, activeUser?.name, clientSessionId, collaborators]);

  const activePresenceNotice = useMemo(() => {
    if (collaborators.length === 0) return undefined;
    if (collaborators.length === 1) {
      const peer = collaborators[0];
      const stepLabel = STEP_LABELS[peer.activeStep] || peer.activeStep;
      const isSelfOtherDevice = Boolean(activeUser?.id && peer.senderId === activeUser.id);
      const displayName = isSelfOtherDevice ? `${peer.senderName} (Other Session)` : peer.senderName;
      if (peer.activeStep === activeStep) {
        return `${displayName} is co-editing this step`;
      }
      return `${displayName} is editing ${stepLabel}`;
    }
    const names = collaborators.map(c => {
      const isSelfOtherDevice = Boolean(activeUser?.id && c.senderId === activeUser.id);
      const name = c.senderName.split(' ')[0];
      return isSelfOtherDevice ? `${name} (2nd Session)` : name;
    }).join(' & ');
    return `${names} are active on this syllabus`;
  }, [collaborators, activeStep, activeUser?.id]);

  return {
    collaborators,
    activePresenceNotice,
    handlePeerMessage,
    broadcastStepChange,
    broadcastSectionUpdate
  };
}
