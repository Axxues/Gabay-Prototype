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
  type: 'PRESENCE_PING' | 'SECTION_UPDATE' | 'CONSENSUS_UPDATE';
  sessionId?: string;
  groupId: string;
  senderId: string;
  senderName: string;
  activeStep: string;
  sectionTitle?: string;
  syllabusData?: OfficialSyllabusData;
  submissionAgreements?: Record<string, boolean>;
  status?: string;
  evaluators?: any[];
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
  'review': 'Submit'
};

const CHANNEL_NAME = 'gabay_syllabus_live_sync';
const OWN_SESSION_STORAGE_KEY = 'gabay_syllabus_session_ids';
const MAX_REMEMBERED_SESSIONS = 20;

const sessionStorageKey = (userId?: string) => `${OWN_SESSION_STORAGE_KEY}:${userId || 'anon'}`;

/**
 * Session ids this tab has already used. Presence is keyed by session id, so
 * after a remount (reload, route change, HMR) the server still holds the row
 * written by the previous mount. Recognising those ids keeps the tab from
 * reporting its own leftover presence as "<Name> (Other Session)".
 */
export function getOwnSessionIds(userId?: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(sessionStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // Private mode / storage disabled.
    return [];
  }
}

function rememberSessionId(userId: string | undefined, sessionId: string) {
  if (typeof window === 'undefined') return;
  try {
    const ids = getOwnSessionIds(userId).filter(id => id !== sessionId);
    ids.push(sessionId);
    window.sessionStorage.setItem(
      sessionStorageKey(userId),
      JSON.stringify(ids.slice(-MAX_REMEMBERED_SESSIONS))
    );
  } catch {
    // Storage disabled: presence still works, the tab just can't recognise its old rows.
  }
}

export type SyllabusSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PendingSave {
  courseId: string;
  data: OfficialSyllabusData;
  userId: string;
  sessionId: string;
}

export function useSyllabusCollaboration(
  groupId: string | undefined,
  activeUser: { id?: string; name?: string } | null | undefined,
  activeStep: string = 'course-info',
  canonicalCourseId?: string,
  onRemoteUpdate?: (syllabusData: OfficialSyllabusData, updatedAt?: number) => void,
  onRemoteConsensusUpdate?: (agreements: Record<string, boolean>, status?: string, evaluators?: any[]) => void
) {
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyllabusSaveStatus>('idle');
  const lastRemoteTimestampRef = useRef<number>(0);
  // A remote snapshot older than the newest local edit must never be applied:
  // that is how edits made just before a slow poll/save used to disappear.
  const lastLocalEditRef = useRef<number>(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The newest document that has not reached the server yet.
  const pendingSaveRef = useRef<PendingSave | null>(null);

  // Unique per-tab session ID that still differentiates multiple tabs/devices
  // using the same user account.
  const clientSessionId = useMemo(() => {
    const id = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    rememberSessionId(activeUser?.id, id);
    return id;
  }, [activeUser?.id]);

  // Same tab across remounts, not a second co-editor.
  const isOwnSession = useCallback(
    (sessionId?: string) => {
      if (!sessionId) return false;
      return sessionId === clientSessionId || getOwnSessionIds(activeUser?.id).includes(sessionId);
    },
    [clientSessionId, activeUser?.id]
  );

  const handlePeerMessage = useCallback((msg: PeerMessage) => {
    if (!groupId || msg.groupId !== groupId) return;
    // Ignore echos from this tab, including rows left by an earlier mount.
    if (msg.sessionId && isOwnSession(msg.sessionId)) return;
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
      onRemoteUpdate(msg.syllabusData, msg.timestamp);
    }

    if (onRemoteConsensusUpdate && (msg.submissionAgreements || msg.status || msg.evaluators)) {
      onRemoteConsensusUpdate(msg.submissionAgreements || {}, msg.status, msg.evaluators);
    }
  }, [groupId, activeUser?.id, clientSessionId, isOwnSession, onRemoteUpdate, onRemoteConsensusUpdate]);

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
                query: { fields: ['id', 'course_id', 'status', 'content', 'presence', 'version'] }
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

                // Sync remote presence (own column; legacy drafts keep it in content)
                const rawPresence = (relevant as any)?.presence ?? parsed.presence;
                const presenceMap =
                  typeof rawPresence === 'string'
                    ? (() => { try { return JSON.parse(rawPresence); } catch { return null; } })()
                    : rawPresence;
                if (presenceMap && typeof presenceMap === 'object') {
                  const cutoff = Date.now() - 15000;
                  const remotePeers: CollaboratorInfo[] = Object.values(presenceMap)
                    .filter((p: any) => {
                      if (!p || (!p.senderId && !p.sessionId)) return false;
                      return !isOwnSession(p.sessionId) && (p.lastSeen || 0) >= cutoff;
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

                const remoteUpdatedAt = parsed.updatedAt || 0;
                if (
                  isOtherSession &&
                  parsed.syllabusData &&
                  remoteUpdatedAt > Math.max(lastRemoteTimestampRef.current, lastLocalEditRef.current)
                ) {
                  lastRemoteTimestampRef.current = remoteUpdatedAt || Date.now();
                  onRemoteUpdate?.(parsed.syllabusData, remoteUpdatedAt);
                }

                if (onRemoteConsensusUpdate && (parsed.submissionAgreements || parsed.status || parsed.evaluators)) {
                  onRemoteConsensusUpdate(parsed.submissionAgreements || {}, parsed.status, parsed.evaluators);
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
                p => !isOwnSession(p.sessionId) && (p.lastSeen || 0) >= cutoff
              );
              setCollaborators(peers);
            }
            const isOtherSession =
              (lastUpdatedBySessionId && lastUpdatedBySessionId !== clientSessionId) ||
              (!lastUpdatedBySessionId && lastUpdatedBy && lastUpdatedBy !== activeUser.id);

            const remoteUpdatedAt = updatedAt || 0;
            if (
              isOtherSession &&
              syllabusData &&
              remoteUpdatedAt > Math.max(lastRemoteTimestampRef.current, lastLocalEditRef.current)
            ) {
              lastRemoteTimestampRef.current = remoteUpdatedAt || Date.now();
              onRemoteUpdate?.(syllabusData, remoteUpdatedAt);
            }

            if (onRemoteConsensusUpdate && (remote.payload.submissionAgreements || remote.payload.status || remote.payload.evaluators)) {
              onRemoteConsensusUpdate(
                remote.payload.submissionAgreements || {},
                remote.payload.status,
                remote.payload.evaluators
              );
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
  }, [canonicalCourseId, groupId, activeUser?.id, activeUser?.name, activeStep, clientSessionId, isOwnSession, onRemoteUpdate]);

  /**
   * Writes the newest document that has not reached the server yet. Ordering is
   * handled inside saveRemoteDraft, so a flush can never lose to an older write.
   */
  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const pending = pendingSaveRef.current;
    if (!pending) return true;
    pendingSaveRef.current = null;

    setSyncStatus('saving');
    const savedId = await saveRemoteDraft(
      pending.courseId,
      pending.data,
      pending.userId,
      pending.sessionId
    );

    if (savedId) {
      // A newer edit may already be queued; let its own save report the status.
      if (!pendingSaveRef.current) setSyncStatus('saved');
      return true;
    }

    // Keep the newest document so the user can retry without editing again.
    if (!pendingSaveRef.current) pendingSaveRef.current = pending;
    setSyncStatus('error');
    return false;
  }, []);

  // Leaving the studio (or the page) must not drop the last debounced edit.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      void flushPendingSave();
    };
  }, [flushPendingSave]);

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
      // Moving to another step is a natural checkpoint: push the last edit now
      // instead of leaving it in a timer that a reload could drop.
      void flushPendingSave();
      sendRemotePresence(canonicalCourseId, {
        sessionId: clientSessionId,
        senderId: activeUser.id,
        senderName: activeUser.name || 'Co-Instructor',
        activeStep: stepId,
        lastSeen: Date.now()
      }).catch(() => {});
    }
  }, [groupId, canonicalCourseId, activeUser?.id, activeUser?.name, clientSessionId, flushPendingSave]);

  const broadcastSectionUpdate = useCallback((
    stepId: string,
    sectionTitle: string,
    updatedData?: OfficialSyllabusData
  ) => {
    if (!groupId || !activeUser?.id) return;

    const now = Date.now();
    // Marks the local copy as newer than anything the server had before this edit.
    lastLocalEditRef.current = now;

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
      // Content only; presence is heartbeated separately into its own column.
      pendingSaveRef.current = {
        courseId: canonicalCourseId,
        data: updatedData,
        userId: activeUser.id,
        sessionId: clientSessionId
      };
      setSyncStatus('saving');
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        void flushPendingSave();
      }, 350);
    }
  }, [groupId, canonicalCourseId, activeUser?.id, activeUser?.name, clientSessionId, flushPendingSave]);

  const broadcastConsensusUpdate = useCallback((
    agreements: Record<string, boolean>,
    status?: string,
    updatedData?: OfficialSyllabusData
  ) => {
    if (!groupId || !activeUser?.id) return;
    const now = Date.now();

    // 1. Local BroadcastChannel for other tabs
    if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({
          type: 'CONSENSUS_UPDATE',
          sessionId: clientSessionId,
          groupId,
          senderId: activeUser.id,
          senderName: activeUser.name || 'Co-Instructor',
          activeStep,
          submissionAgreements: agreements,
          status,
          syllabusData: updatedData,
          timestamp: now
        } satisfies PeerMessage);
        channel.close();
      } catch {
        // Ignore
      }
    }

    // 2. Persist directly to remote Likha draft row
    if (canonicalCourseId) {
      const dataToSave = updatedData || pendingSaveRef.current?.data;
      if (dataToSave) {
        saveRemoteDraft(
          canonicalCourseId,
          dataToSave,
          activeUser.id,
          clientSessionId,
          agreements,
          status
        ).catch(() => {});
      }
    }
  }, [groupId, canonicalCourseId, activeUser?.id, activeUser?.name, clientSessionId, activeStep]);

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
    broadcastSectionUpdate,
    broadcastConsensusUpdate,
    syncStatus,
    retrySave: flushPendingSave
  };
}
