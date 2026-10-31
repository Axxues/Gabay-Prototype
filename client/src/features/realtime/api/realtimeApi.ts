import { LIKHA_URL } from '../../../shared/api/likhaLmsApi';

/**
 * Likha ERP (Directus) native realtime over WebSocket.
 *
 * Push-driven live updates: instead of polling on timers, a single WebSocket
 * per client session subscribes to the data collections and pushes create/
 * update events milliseconds after a peer writes them (school-wide or on the
 * other side of the room). Each event invalidates only that collection's
 * likhaCache keys and triggers a targeted re-hydration, so we get instant
 * freshness with LESS network traffic than TTL-expiry refetches.
 */

/**
 * Every app data collection participates in live sync. Collections that
 * carry `course_id` route straight to that course's re-hydration; child
 * collections keyed by a parent row (comments, replies, rubric scores) route
 * through their parent id, which the bridge resolves against the local db.
 */
export interface RealtimeCollectionConfig {
  collection: string;
  /** Cache path prefix invalidated for this collection. */
  path: string;
  /** Fields requested in the WS subscribe query — must be real columns. */
  fields: string[];
  /** Row fields that may directly hold a course id (checked in order). */
  courseIdFields?: string[];
  /** The row id IS the course id (courses collection itself). */
  idIsCourse?: boolean;
  /** Row field -> bridge-side owner collection used to resolve the course. */
  parentFields?: Record<string, string>;
}

export const REALTIME_COLLECTIONS: readonly RealtimeCollectionConfig[] = [
  // Course-scoped collections (rows carry course_id directly)
  { collection: 'courses', path: '/items/courses', fields: ['id'], idIsCourse: true },
  { collection: 'course_sections', path: '/items/course_sections', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'enrollment_requests', path: '/items/enrollment_requests', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'modules', path: '/items/modules', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'activities', path: '/items/activities', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'quizzes', path: '/items/quizzes', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'exams', path: '/items/exams', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'assignments', path: '/items/assignments', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'projects', path: '/items/projects', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'presentations', path: '/items/presentations', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'announcements', path: '/items/announcements', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'discussions', path: '/items/discussions', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  {
    collection: 'submissions',
    path: '/items/submissions',
    fields: ['id', 'course_id', 'activity_id', 'quiz_id', 'exam_id', 'assignment_id', 'project_id', 'presentation_id'],
    courseIdFields: ['course_id'],
    parentFields: {
      activity_id: 'activities',
      assignment_id: 'activities',
      project_id: 'activities',
      presentation_id: 'activities',
      quiz_id: 'quizzes',
      exam_id: 'exams',
    },
  },
  { collection: 'course_grades', path: '/items/course_grades', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'course_folders', path: '/items/course_folders', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'course_files', path: '/items/course_files', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  { collection: 'syllabi', path: '/items/syllabi', fields: ['id', 'course_id'], courseIdFields: ['course_id'] },
  // Parent-keyed child collections (resolve course via the parent row)
  { collection: 'module_items', path: '/items/module_items', fields: ['id', 'module_id'], parentFields: { module_id: 'modules' } },
  { collection: 'module_comments', path: '/items/module_comments', fields: ['id', 'module_id'], parentFields: { module_id: 'modules' } },
  { collection: 'announcement_replies', path: '/items/announcement_replies', fields: ['id', 'announcement_id'], parentFields: { announcement_id: 'announcements' } },
  { collection: 'discussion_replies', path: '/items/discussion_replies', fields: ['id', 'discussion_id'], parentFields: { discussion_id: 'discussions' } },
  { collection: 'submission_comments', path: '/items/submission_comments', fields: ['id', 'submission_id'], parentFields: { submission_id: 'submissions' } },
  { collection: 'submission_rubric_scores', path: '/items/submission_rubric_scores', fields: ['id', 'submission_id'], parentFields: { submission_id: 'submissions' } },
  { collection: 'assessment_questions', path: '/items/assessment_questions', fields: ['id', 'activity_id', 'quiz_id', 'assignment_id', 'project_id', 'presentation_id'], parentFields: { activity_id: 'activities', quiz_id: 'quizzes', assignment_id: 'assignments', project_id: 'projects', presentation_id: 'presentations' } },
  { collection: 'rubric_criteria', path: '/items/rubric_criteria', fields: ['id', 'activity_id', 'assignment_id', 'project_id', 'presentation_id'], parentFields: { activity_id: 'activities', assignment_id: 'assignments', project_id: 'projects', presentation_id: 'presentations' } },
] as const;

const COLLECTIONS_BY_NAME = new Map(REALTIME_COLLECTIONS.map(c => [c.collection, c]));

export function getLikhaWebSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  // Localhost / Vite dev server: ride the ws:true Vite proxy (/likha/websocket)
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '5173'
  ) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/likha/websocket`;
  }
  if (LIKHA_URL.startsWith('http')) {
    return LIKHA_URL.replace(/^http/, 'ws') + '/websocket';
  }
  return 'wss://gabay.zyberlab.com/websocket';
}

// ---------- Change event bus (connection hook -> data owners) ----------

export interface RealtimeChangeEvent {
  collection: string;
  /** Cache path prefix invalidated for this collection. */
  path: string;
  /** course_id of affected rows (empty when unknown, e.g. deletes). */
  courseIds: string[];
  /** Parent row ids per field (e.g. { module_id: [...] }) for children. */
  parentIds?: Record<string, string[]>;
}

type RealtimeChangeListener = (event: RealtimeChangeEvent) => void;

const changeListeners = new Set<RealtimeChangeListener>();

const REALTIME_CHANNEL_NAME = 'gabay_realtime_sync_v1';
let syncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
  try {
    syncChannel = new BroadcastChannel(REALTIME_CHANNEL_NAME);
    syncChannel.onmessage = (msgEvent) => {
      if (msgEvent.data && typeof msgEvent.data === 'object' && msgEvent.data.type === 'gabay_change') {
        const payload: RealtimeChangeEvent = msgEvent.data.payload;
        for (const listener of changeListeners) {
          try {
            listener(payload);
          } catch {
            // One bad listener must not starve the rest.
          }
        }
      }
    };
  } catch {
    // BroadcastChannel unsupported or restricted in sandbox
  }
}

/** Register a handler for debounced change events; returns unsubscribe. */
export function onRealtimeChange(listener: RealtimeChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function emitRealtimeChange(event: RealtimeChangeEvent): void {
  for (const listener of changeListeners) {
    try {
      listener(event);
    } catch {
      // One bad listener must not starve the rest.
    }
  }
  try {
    syncChannel?.postMessage({ type: 'gabay_change', payload: event });
  } catch {
    // Cross-tab message delivery failed silently
  }
}

// ---------- Assessment runner suppression ----------
// Live refetches swap db arrays wholesale; while a student is mid-attempt we
// pause them (buffered and flushed once the runner closes) so an incoming
// publish cannot yank the quiz data they are working against.

export function isLiveSyncSuppressed(): boolean {
  return (globalThis as { __gabayLiveSyncSuppressed?: boolean }).__gabayLiveSyncSuppressed === true;
}

export function setLiveSyncSuppressed(suppressed: boolean): void {
  (globalThis as { __gabayLiveSyncSuppressed?: boolean }).__gabayLiveSyncSuppressed = suppressed;
}

/** id -> collection payload guard: ignore events for unknown collections. */
export function getSubscriptionByUid(uid: unknown): RealtimeCollectionConfig | undefined {
  return typeof uid === 'string' ? COLLECTIONS_BY_NAME.get(uid) : undefined;
}
