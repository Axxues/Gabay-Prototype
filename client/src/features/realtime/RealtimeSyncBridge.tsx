import React, { useEffect, useRef } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { onRealtimeChange } from './api/realtimeApi';
// verbatimModuleSyntax: the event is a type-only binding; a value-style
// named import survives the esbuild transform and breaks the boot load.
import type { RealtimeChangeEvent } from './api/realtimeApi';
import { useRealtimeSync } from './hooks/useRealtimeSync';

const COURSE_REFRESH_DEBOUNCE_MS = 250;

/**
 * Parent field -> db array to resolve the owning course. Child rows (comments,
 * replies, rubric scores, questions) do not carry course_id, so we map their
 * parent id onto the hydrated course data already held client-side.
 */
const PARENT_OWNER_MAP: Record<string, string> = {
  module_id: 'modules',
  announcement_id: 'announcements',
  submission_id: 'submissions',
  discussion_id: 'discussions',
  activity_id: 'activities',
  quiz_id: 'quizzes',
  exam_id: 'exams',
  assignment_id: 'activities',
  project_id: 'activities',
  presentation_id: 'activities',
};

/** Resolve parentIds in a change event to courseIds using the current db. */
function resolveParentCourses(event: RealtimeChangeEvent, db: any): string[] {
  const parentIds = event.parentIds ?? {};
  const out = new Set<string>();
  for (const [field, ids] of Object.entries(parentIds)) {
    const rows: any[] = db?.[PARENT_OWNER_MAP[field]] ?? [];
    const byId = new Map(rows.map(r => [String(r.id), r]));
    for (const id of ids) {
      const course: unknown = byId.get(String(id))?.courseId;
      if (typeof course === 'string' && course) out.add(course);
    }
  }
  return [...out];
}

/**
 * App-level mount point for live sync: runs the WebSocket connection when the
 * session is authenticated and applies each debounced change event as a
 * targeted course re-hydration through LMSContext. Renders nothing.
 */
export const RealtimeSyncBridge: React.FC = () => {
  const { isAuthenticated, refreshCourseContent, db } = useLMS();
  useRealtimeSync(isAuthenticated);

  // Latest handler refs so the bus subscription survives context identity
  // churn without re-subscribing.
  const refreshRef = useRef(refreshCourseContent);
  refreshRef.current = refreshCourseContent;
  const dbRef = useRef(db);
  dbRef.current = db;

  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queue = (courseId: string) => {
    if (!courseId) return;
    const timers = timersRef.current;
    const existing = timers.get(courseId);
    if (existing) clearTimeout(existing);
    timers.set(
      courseId,
      setTimeout(() => {
        timers.delete(courseId);
        void refreshRef.current(courseId);
      }, COURSE_REFRESH_DEBOUNCE_MS)
    );
  };

  useEffect(() => {
    return onRealtimeChange(event => {
      if (event.courseIds.length > 0) {
        for (const courseId of [...new Set(event.courseIds)]) queue(courseId);
      }
      // Parent-keyed children (comments, replies, grades on rows): resolve
      // parent -> course against the hydrated db. Rows still unknown locally
      // (e.g. a module published mid-refresh) arrive via the parent
      // collection's own course-scoped event, so no global refetch needed.
      for (const courseId of resolveParentCourses(event, dbRef.current)) queue(courseId);
    });
  }, []);

  return null;
};
