# Cross-Tab Notifiers + Reply Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every course nav tab (calendar, inbox, modules, announcements, activities, quizzes, files, grades, people) shows the viewer's unread count badge on its right side, and module/announcement replies notify the original commenter/author only.

**Architecture:** Local-first incremental (Approach A). Pure badge/recipient rules live in `src/utils/notifiers.ts` (vitest-covered, no React, no localStorage). State lives in `LMSContext` + `MockDatabase` persisted to the existing localStorage key. UI reuses `LMSContextPanel`, `CoursesPage` mobile tab strip, and `NotificationBell`. Reply flows in `ModulesView`/`AnnouncementsView` are conformed to the pure recipient resolvers.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind; vitest (already a devDependency in `package.json`).

**Spec:** `docs/superpowers/specs/2026-09-13-lms-extensions-design.md` (§3)

## Global Constraints

- No backend; all state in `LMSContext` + localStorage key `gabay_lms_db_v6`.
- Badges show the viewer's unread count; viewing the item clears it.
- Role-aware counts; out-of-section announcements never badge students in other sections.
- No badge for own actions (never self-notify).
- Notifications cap at latest ~200 per user with pruning.
- **User override (binds every task): do NOT commit. Leave all work uncommitted in the working tree. Steps saying "verify" end the task; no `git add`, no `git commit`.**
- Shell is Windows PowerShell 5.1: never use `&&` to chain commands.

---

## File structure

- `src/utils/notifiers.ts` (new) — pure rules: reply-recipient resolvers, per-tab badge selectors, visit-tracking helpers. No React, no localStorage.
- `src/utils/notifiers.test.ts` (new) — vitest units for the above.
- `src/types/lms.ts` (modify) — add `User.lastVisitedAt?: Record<string, string>`; add `CalendarEvent.createdAt?: string`; extend `Notification.type` with `'calendar_event' | 'file_uploaded' | 'grade_posted'` (kept for future use; badges derive from existing collections, these types only prevent type errors if used).
- `src/context/LMSContext.tsx` (modify) — `markTabVisited`, `markModuleCommentsRead`, notification pruning cap, wire visit timestamps into provider value.
- `src/pages/ModulesView.tsx` (modify) — comment reply uses `resolveModuleReplyRecipient`; viewing a module marks its reply notifications read.
- `src/pages/AnnouncementsView.tsx` (modify) — reply uses `resolveAnnouncementReplyRecipient` (already near-correct, conform to resolver); section-invisible replies never notify.
- `src/components/layout/LMSContextPanel.tsx` (modify) — right-side count badges on every course nav tab.
- `src/pages/CoursesPage.tsx` (modify) — extend the existing mobile badge strip (lines 68-106) from 4 tabs to all 9 tabs with the same selectors.
- `src/components/common/NotificationBell.tsx` (modify) — group by type with per-group "mark all read" using existing `markAllNotificationsRead`.

---

### Task 1: Pure notifier selectors + recipient rules + tests

**Files:**
- Create: `src/utils/notifiers.ts`
- Create: `src/utils/notifiers.test.ts`

**Interfaces:**
- Consumes: `Announcement`, `CourseSection`, `EnrollmentRequest`, `Notification`, `User`, `UserRole` types from `src/types/lms.ts` (import type only); `isAnnouncementVisibleToViewer` from `src/utils/sections.ts`
- Produces: `resolveAnnouncementReplyRecipient(...)`, `resolveModuleReplyRecipient(...)`, `countUnreadAnnouncements(...)`, `countUnreadMessages(...)`, `countPendingPeople(...)`, `countNewFiles(...)`, `countNewGrades(...)`, `countUpcomingCalendar(...)`, `countStudentAssessmentBadge(...)`, `countFacultyGradingBadge(...)`, `isNewerThanVisit(...)` used by Tasks 3–5. Keep exact names and signatures.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/notifiers.test.ts
import { describe, expect, it } from 'vitest';
import {
  countNewFiles,
  countPendingPeople,
  countUnreadAnnouncements,
  countUnreadMessages,
  isNewerThanVisit,
  resolveAnnouncementReplyRecipient,
  resolveModuleReplyRecipient,
} from './notifiers';

describe('reply recipients', () => {
  it('notifies the announcement author on reply', () => {
    expect(
      resolveAnnouncementReplyRecipient({ authorId: 'u-fac' }, { id: 'u-stu' })
    ).toBe('u-fac');
  });
  it('never self-notifies on announcement reply', () => {
    expect(
      resolveAnnouncementReplyRecipient({ authorId: 'u-fac' }, { id: 'u-fac' })
    ).toBeNull();
  });
  it('notifies the module author on comment', () => {
    expect(
      resolveModuleReplyRecipient(
        { authorId: 'u-fac', comments: [] },
        { id: 'u-stu' }
      )
    ).toBe('u-fac');
  });
  it('prefers the most-recent prior commenter over the module author', () => {
    expect(
      resolveModuleReplyRecipient(
        {
          authorId: 'u-fac',
          comments: [
            { authorId: 'u-a' },
            { authorId: 'u-b' },
          ],
        },
        { id: 'u-c' }
      )
    ).toBe('u-b');
  });
  it('never self-notifies on module comment', () => {
    expect(
      resolveModuleReplyRecipient(
        { authorId: 'u-stu', comments: [] },
        { id: 'u-stu' }
      )
    ).toBeNull();
  });
});

describe('badge selectors', () => {
  it('counts only section-visible unread announcements', () => {
    const anns = [
      { id: 'a1', courseId: 'c1', sectionId: 'all', readBy: [] },
      { id: 'a2', courseId: 'c1', sectionId: 'sec-a', readBy: [] },
      { id: 'a3', courseId: 'c1', sectionId: 'sec-a', readBy: ['u-stu'] },
    ];
    expect(
      countUnreadAnnouncements(anns, { id: 'u-stu', role: 'student', sectionId: 'sec-b' })
    ).toBe(1);
  });
  it('counts unread direct messages for the viewer', () => {
    const msgs = [
      { id: 'm1', recipientId: 'u-stu', read: false },
      { id: 'm2', recipientId: 'u-stu', read: true },
      { id: 'm3', recipientId: 'u-other', read: false },
    ];
    expect(countUnreadMessages(msgs, 'u-stu')).toBe(1);
  });
  it('counts pending enrollment requests for faculty', () => {
    const reqs = [
      { courseId: 'c1', status: 'pending' },
      { courseId: 'c1', status: 'approved' },
      { courseId: 'c2', status: 'pending' },
    ];
    expect(countPendingPeople(reqs, 'c1')).toBe(1);
  });
  it('counts files newer than the last files visit', () => {
    const files = [
      { id: 'f1', courseId: 'c1', updatedAt: '2026-09-13T10:00:00.000Z' },
      { id: 'f2', courseId: 'c1', updatedAt: '2026-09-10T10:00:00.000Z' },
    ];
    expect(
      countNewFiles(files, 'c1', { 'files:c1': '2026-09-12T00:00:00.000Z' })
    ).toBe(1);
  });
  it('compares timestamps safely', () => {
    expect(isNewerThanVisit('2026-09-13T00:00:00.000Z', undefined)).toBe(true);
    expect(isNewerThanVisit('2026-09-10T00:00:00.000Z', '2026-09-12T00:00:00.000Z')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/notifiers.test.ts`
Expected: FAIL with "Failed to resolve import ./notifiers" (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/notifiers.ts
import { isAnnouncementVisibleToViewer } from './sections';
import type { UserRole } from '../types/lms';

interface ReplyAuthor { id: string }
interface AnnLike { authorId: string }
interface ModuleLike {
  authorId?: string;
  comments?: Array<{ authorId: string }>;
}

export function resolveAnnouncementReplyRecipient(
  announcement: AnnLike,
  replier: ReplyAuthor
): string | null {
  if (announcement.authorId === replier.id) return null;
  return announcement.authorId;
}

export function resolveModuleReplyRecipient(
  mod: ModuleLike,
  commenter: ReplyAuthor
): string | null {
  const comments = mod.comments || [];
  for (let i = comments.length - 1; i >= 0; i--) {
    const priorId = comments[i].authorId;
    if (priorId && priorId !== commenter.id) return priorId;
  }
  if (mod.authorId && mod.authorId !== commenter.id) return mod.authorId;
  return null;
}

interface AnnBadgeLike {
  id: string;
  courseId: string;
  sectionId?: string;
  sectionRestriction?: string;
  readBy?: string[];
}

export function countUnreadAnnouncements(
  announcements: AnnBadgeLike[],
  viewer: { id: string; role: UserRole; sectionId: string | null },
  courseId: string
): number {
  return announcements.filter(a => {
    if (a.courseId !== courseId && a.courseId !== 'all') return false;
    const scope = a.sectionId ?? (a.sectionRestriction && a.sectionRestriction !== 'All Sections' ? a.sectionRestriction : 'all');
    if (!isAnnouncementVisibleToViewer({ sectionId: scope }, viewer.sectionId, viewer.role)) return false;
    return !(a.readBy || []).includes(viewer.id);
  }).length;
}

export function countUnreadMessages(
  messages: Array<{ recipientId: string; read: boolean }>,
  viewerId: string
): number {
  return messages.filter(m => m.recipientId === viewerId && !m.read).length;
}

export function countPendingPeople(
  requests: Array<{ courseId: string; status: string }>,
  courseId: string
): number {
  return requests.filter(r => r.courseId === courseId && r.status === 'pending').length;
}

export function isNewerThanVisit(updatedAt: string, lastVisit: string | undefined): boolean {
  if (!lastVisit) return true;
  return new Date(updatedAt).getTime() > new Date(lastVisit).getTime();
}

export function countNewFiles(
  files: Array<{ courseId: string; updatedAt: string }>,
  courseId: string,
  lastVisitedAt: Record<string, string>
): number {
  const visit = lastVisitedAt[`files:${courseId}`];
  return files.filter(f => f.courseId === courseId && isNewerThanVisit(f.updatedAt, visit)).length;
}

export function countNewGrades(
  grades: Array<{ courseId: string; studentId: string; updatedAt?: string }>,
  courseId: string,
  studentId: string,
  lastVisitedAt: Record<string, string>
): number {
  const visit = lastVisitedAt[`grades:${courseId}`];
  return grades.filter(
    g => g.courseId === courseId && g.studentId === studentId && g.updatedAt && isNewerThanVisit(g.updatedAt, visit)
  ).length;
}

export function countUpcomingCalendar(
  events: Array<{ courseId?: string; date: string; createdAt?: string }>,
  courseId: string,
  lastVisitedAt: Record<string, string>
): number {
  const visit = lastVisitedAt[`calendar:${courseId}`];
  const now = new Date();
  const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return events.filter(e => {
    if (e.courseId && e.courseId !== courseId) return false;
    const d = new Date(e.date);
    if (isNaN(d.getTime()) || d < now || d > in14d) return false;
    if (e.createdAt && visit) return isNewerThanVisit(e.createdAt, visit);
    if (visit) return false;
    return true;
  }).length;
}

export function countStudentAssessmentBadge(
  publishedIds: string[],
  submittedAssignmentIds: string[]
): number {
  const submitted = new Set(submittedAssignmentIds);
  return publishedIds.filter(id => !submitted.has(id)).length;
}

export function countFacultyGradingBadge(
  submissions: Array<{ assignmentId: string; status: string }>,
  assignmentIds: string[]
): number {
  const wanted = new Set(assignmentIds);
  return submissions.filter(s => wanted.has(s.assignmentId) && s.status === 'submitted').length;
}
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npx vitest run src/utils/notifiers.test.ts`
Expected: 11/11 PASS.
Run: `npx tsc -b`
Expected: PASS (no output).

- [ ] **Step 5: Leave uncommitted (user override — no commit)**

---

### Task 2: Types — visit tracking + notification union + calendar createdAt

**Files:**
- Modify: `src/types/lms.ts` (User interface lines 3-15; Notification interface lines 104-116; CalendarEvent interface lines 242-260)

**Interfaces:**
- Consumes: none
- Produces: `User.lastVisitedAt?: Record<string, string>`, `CalendarEvent.createdAt?: string`, extended `Notification['type']` used by Tasks 3–5. Keep exact names.

- [ ] **Step 1: Add the fields**

```ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  studentId?: string;
  department: string;
  title: string;
  password?: string;
  enrolledCourseIds?: string[];
  courseSections?: Record<string, string>;
  lastVisitedAt?: Record<string, string>;
}
```

In `Notification`, change the type union to:

```ts
export interface Notification {
  id: string;
  type: 'module_comment_reply' | 'announcement_reply' | 'quiz_draft_saved' | 'assignment_submitted' | 'calendar_event' | 'file_uploaded' | 'grade_posted';
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar: string;
  relatedId: string;
  relatedTitle: string;
  content: string;
  read: boolean;
  createdAt: string;
}
```

In `CalendarEvent`, after `description: string;` add:

```ts
  createdAt?: string;
```

`lastVisitedAt` keys are namespaced per area: `calendar:<courseId>`, `files:<courseId>`, `grades:<courseId>`. All three are optional so saved databases without them keep working; every consumer guards with `(activeUser.lastVisitedAt || {})`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Leave uncommitted (user override — no commit)**

---

### Task 3: Store — visit tracking, module-read clearing, notification pruning

**Files:**
- Modify: `src/context/LMSContext.tsx` (interface near `markAnnouncementRead: (id: string) => void;` line 139 and `markAllNotificationsRead` line 146; implementations after `markAllNotificationsRead` lines 2004-2017; `createNotification` lines 1956-1980)

**Interfaces:**
- Consumes: `isNewerThanVisit` NOT needed in store (pure selectors stay in Task 1); `Notification` type (Task 2)
- Produces: `markTabVisited: (tab: string, courseId?: string) => void`, `markModuleCommentsRead: (moduleId: string) => void` used by Tasks 4–5. Keep exact names and signatures.

- [ ] **Step 1: Add interface entries**

```ts
markTabVisited: (tab: string, courseId?: string) => void;
markModuleCommentsRead: (moduleId: string) => void;
```

Place them directly after the `markAllNotificationsRead: (userId: string, type?: string) => void;` line in the context interface.

- [ ] **Step 2: Add implementations after `markAllNotificationsRead`**

```ts
const markTabVisited = (tab: string, courseId?: string) => {
  const key = courseId ? `${tab}:${courseId}` : tab;
  const stamp = new Date().toISOString();
  setDb(prev => ({
    ...prev,
    users: prev.users.map(u =>
      u.id === activeUser.id
        ? { ...u, lastVisitedAt: { ...(u.lastVisitedAt || {}), [key]: stamp } }
        : u
    )
  }));
};

const markModuleCommentsRead = (moduleId: string) => {
  setNotifications(prev =>
    prev.map(n =>
      n.recipientId === activeUser.id && n.relatedId === moduleId && !n.read
        ? { ...n, read: true }
        : n
    )
  );
  setDb(prev => ({
    ...prev,
    notifications: (prev.notifications || []).map(n =>
      n.recipientId === activeUser.id && n.relatedId === moduleId && !n.read
        ? { ...n, read: true }
        : n
    )
  }));
};
```

Wire both names into the provider `value` object next to `markAnnouncementRead` / `markAllNotificationsRead`.

- [ ] **Step 3: Cap notifications at 200 per recipient inside `createNotification`**

Replace the `setDb` block inside `createNotification` (lines 1974-1977) with:

```ts
setDb(prev => {
  const merged = (prev.notifications || []).concat(newNotification);
  const others = merged.filter(n => n.recipientId !== newNotification.recipientId);
  const mine = merged
    .filter(n => n.recipientId === newNotification.recipientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);
  return { ...prev, notifications: [...others, ...mine] };
});
```

Also mirror the same cap on the `setNotifications` call directly above it:

```ts
setNotifications(prev => {
  const merged = [newNotification, ...prev];
  const others = merged.filter(n => n.recipientId !== newNotification.recipientId);
  const mine = merged
    .filter(n => n.recipientId === newNotification.recipientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);
  return [...others, ...mine];
});
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Leave uncommitted (user override — no commit)**

---

### Task 4: Conform reply flows to recipient resolvers + viewing clears

**Files:**
- Modify: `src/pages/ModulesView.tsx` (comment composer lines 824-845, module open handler)
- Modify: `src/pages/AnnouncementsView.tsx` (reply handler lines 106-123; select handler lines 101-104)

**Interfaces:**
- Consumes: `resolveModuleReplyRecipient`, `resolveAnnouncementReplyRecipient` (Task 1); `markModuleCommentsRead`, `markAnnouncementRead` (existing + Task 3)
- Produces: reply notifications with correct single recipient, no self-notify. No downstream consumers.

- [ ] **Step 1: ModulesView — use the resolver and clear on view**

Add to the imports at the top of `ModulesView.tsx`:

```tsx
import { resolveModuleReplyRecipient } from '../utils/notifiers';
```

Replace the recipient lookup inside the comment composer `onSubmit` (lines 830-843) with:

```tsx
const text = (commentInputs[mod.id] || '').trim();
if (!text) return;
addModuleComment(mod.id, text);
const recipientId = resolveModuleReplyRecipient(mod, activeUser);
if (recipientId) {
  createNotification({
    type: 'module_comment_reply',
    recipientId,
    actorId: activeUser.id,
    actorName: activeUser.name,
    actorAvatar: activeUser.avatar,
    relatedId: mod.id,
    relatedTitle: mod.title,
    content: text,
  });
}
setCommentInputs(prev => ({ ...prev, [mod.id]: '' }));
```

Where the module thread is expanded/selected (the same click handler that toggles the module open), add one line after the toggle:

```tsx
markModuleCommentsRead(mod.id);
```

Use the existing destructured `markModuleCommentsRead` from `useLMS()` (add it to the destructure list alongside `createNotification`).

- [ ] **Step 2: AnnouncementsView — use the resolver (keeps section rule)**

Add to the imports at the top of `AnnouncementsView.tsx`:

```tsx
import { resolveAnnouncementReplyRecipient } from '../utils/notifiers';
```

Replace the body of `handleSendReply` (lines 106-123) with:

```tsx
const handleSendReply = (announcementId: string) => {
  if (!replyText.trim()) return;
  addAnnouncementReply(announcementId, replyText.trim());
  const ann = (db.announcements || []).find(a => a.id === announcementId);
  if (ann) {
    const recipientId = resolveAnnouncementReplyRecipient(ann, activeUser);
    if (recipientId) {
      createNotification({
        type: 'announcement_reply',
        recipientId,
        actorId: activeUser.id,
        actorName: activeUser.name,
        actorAvatar: activeUser.avatar,
        relatedId: announcementId,
        relatedTitle: ann.title,
        content: replyText.trim(),
      });
    }
  }
  setReplyText('');
};
```

`handleSelectAnnouncement` already calls `markAnnouncementRead(ann.id)` (line 102) — leave it untouched; that is the viewing-clears rule for announcements. Out-of-section students never see the reply composer because the feed filter (lines 68-80) already hides those announcements.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Leave uncommitted (user override — no commit)**

---

### Task 5: Badges on every course nav tab + bell grouping

**Files:**
- Modify: `src/components/layout/LMSContextPanel.tsx` (course nav lines 60-64; LMS nav inbox line 36)
- Modify: `src/pages/CoursesPage.tsx` (mobile strip lines 68-106)
- Modify: `src/components/common/NotificationBell.tsx` (notifications group lines 259-300)

**Interfaces:**
- Consumes: `countUnreadAnnouncements`, `countUnreadMessages`, `countPendingPeople`, `countNewFiles`, `countNewGrades`, `countUpcomingCalendar`, `countStudentAssessmentBadge`, `countFacultyGradingBadge` (Task 1); `getUnreadNotificationCount`, `getPendingRequestsForCourse`, `markAllNotificationsRead`, `markTabVisited` (store)
- Produces: badge UI only, terminal for badges. Bell grouping uses existing `markAllNotificationsRead`.

- [ ] **Step 1: LMSContextPanel — right-side badges per course tab**

In `LMSContextPanel.tsx`, extend the `useLMS()` destructure to include `getUnreadNotificationCount` and `getPendingRequestsForCourse`. Add a helper above the return:

```tsx
const courseBadgeFor = (tabId: string): number => {
  if (!course) return 0;
  const cid = course.id;
  const visits = activeUser.lastVisitedAt || {};
  if (tabId === 'inbox') return 0;
  if (tabId === 'modules') return getUnreadNotificationCount(activeUser.id, 'module_comment_reply');
  if (tabId === 'announcements') {
    const sectionId = activeUser.courseSections?.[cid] ?? null;
    return countUnreadAnnouncements(db.announcements || [], { id: activeUser.id, role: activeRole, sectionId }, cid);
  }
  if (tabId === 'assignments') {
    if (activeRole === 'faculty') {
      const ids = [...(db.assignments || []).filter(a => a.courseId === cid).map(a => a.id),
        ...(db.activities || []).filter(a => a.courseId === cid).map(a => `asg-activity-${a.id}`)];
      return countFacultyGradingBadge(db.submissions.filter(s => s.courseId === cid), ids);
    }
    const pub = [...(db.assignments || []).filter(a => a.courseId === cid && a.published).map(a => a.id),
      ...(db.activities || []).filter(a => a.courseId === cid && a.published).map(a => `asg-activity-${a.id}`)];
    const mine = db.submissions.filter(s => s.courseId === cid && s.studentId === activeUser.id).map(s => s.assignmentId);
    return countStudentAssessmentBadge(pub, mine);
  }
  if (tabId === 'quizzes') {
    if (activeRole === 'faculty') {
      const ids = (db.quizzes || []).filter(q => q.courseId === cid).map(q => `asg-quiz-${q.id}`);
      return countFacultyGradingBadge(db.submissions.filter(s => s.courseId === cid), ids);
    }
    const pub = (db.quizzes || []).filter(q => q.courseId === cid && q.published).map(q => q.id);
    const taken = db.submissions.filter(s => s.courseId === cid && s.studentId === activeUser.id && s.assignmentId.startsWith('asg-quiz-')).map(s => s.assignmentId.replace('asg-quiz-', ''));
    const submitted = new Set(taken);
    return pub.filter(id => !submitted.has(id)).length;
  }
  if (tabId === 'files') return countNewFiles(db.courseFiles || [], cid, visits);
  if (tabId === 'grades') {
    if (activeRole !== 'student') return 0;
    return countNewGrades(db.courseGrades || [], cid, activeUser.id, visits);
  }
  if (tabId === 'people') {
    if (activeRole !== 'faculty' && activeRole !== 'admin') return 0;
    return countPendingPeople(db.enrollmentRequests || [], cid);
  }
  if (tabId === 'calendar') return countUpcomingCalendar(db.calendarEvents || [], cid, visits);
  return 0;
};
```

Render the badge on the right side of each course row (inside the existing course button, after the label span):

```tsx
{(() => {
  const n = courseBadgeFor(item.id);
  return n > 0 ? (
    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
      {n}
    </span>
  ) : null;
})()}
```

Change the course button class from `gap-2.5` row to `flex w-full items-center gap-2.5 ...` (keep existing classes, only ensure `items-center` + `justify-between` so the badge sits at the right side). Faculty `pending-requests` tab uses the same `people` count path: map `'pending-requests'` to `countPendingPeople` in the helper.

- [ ] **Step 2: CoursesPage mobile strip — same selectors for all 9 tabs**

Replace the badge-count block (lines 70-82) with calls to the same `Task-1` selectors imported from `../utils/notifiers`. Import at top:

```tsx
import {
  countNewFiles,
  countNewGrades,
  countPendingPeople,
  countStudentAssessmentBadge,
  countFacultyGradingBadge,
  countUpcomingCalendar,
  countUnreadAnnouncements,
  countUnreadMessages,
} from '../utils/notifiers';
```

Compute per tab:

```tsx
const visits = activeUser.lastVisitedAt || {};
const cid = activeCourse.id;
if (tab.id === 'inbox') {
  badgeCount = countUnreadMessages(db.messages, activeUser.id)
    + getUnreadNotificationCount(activeUser.id, 'module_comment_reply')
    + getUnreadNotificationCount(activeUser.id, 'announcement_reply');
} else if (tab.id === 'modules') {
  badgeCount = getUnreadNotificationCount(activeUser.id, 'module_comment_reply');
} else if (tab.id === 'announcements') {
  badgeCount = countUnreadAnnouncements(db.announcements || [], { id: activeUser.id, role: activeRole, sectionId: activeUser.courseSections?.[cid] ?? null }, cid);
} else if (tab.id === 'assignments') {
  badgeCount = activeRole === 'faculty'
    ? countFacultyGradingBadge(db.submissions.filter(s => s.courseId === cid), [...(db.assignments || []).filter(a => a.courseId === cid).map(a => a.id), ...(db.activities || []).filter(a => a.courseId === cid).map(a => `asg-activity-${a.id}`)])
    : countStudentAssessmentBadge([...(db.assignments || []).filter(a => a.courseId === cid && a.published).map(a => a.id), ...(db.activities || []).filter(a => a.courseId === cid && a.published).map(a => `asg-activity-${a.id}`)], db.submissions.filter(s => s.courseId === cid && s.studentId === activeUser.id).map(s => s.assignmentId));
} else if (tab.id === 'quizzes') {
  badgeCount = activeRole === 'faculty'
    ? countFacultyGradingBadge(db.submissions.filter(s => s.courseId === cid), (db.quizzes || []).filter(q => q.courseId === cid).map(q => `asg-quiz-${q.id}`))
    : (db.quizzes || []).filter(q => q.courseId === cid && q.published && !db.submissions.some(s => s.assignmentId === `asg-quiz-${q.id}` && s.studentId === activeUser.id)).length;
} else if (tab.id === 'files') {
  badgeCount = countNewFiles(db.courseFiles || [], cid, visits);
} else if (tab.id === 'grades') {
  badgeCount = activeRole === 'student' ? countNewGrades(db.courseGrades || [], cid, activeUser.id, visits) : 0;
} else if (tab.id === 'people' || tab.id === 'pending-requests') {
  badgeCount = (activeRole === 'faculty' || activeRole === 'admin') ? countPendingPeople(db.enrollmentRequests || [], cid) : 0;
} else if (tab.id === 'calendar') {
  badgeCount = countUpcomingCalendar(db.calendarEvents || [], cid, visits);
}
```

Keep the existing badge `<span>` markup (lines 84-93) unchanged.

- [ ] **Step 3: Bell panel — group by type with per-group mark-all-read**

In `NotificationBell.tsx`, add `markAllNotificationsRead` to the `useLMS()` destructure. Above the notifications group header (line 260), group the already-fetched `notifications` array:

```tsx
const groups: Record<string, typeof notifications> = {};
for (const n of notifications) {
  (groups[n.type] = groups[n.type] || []).push(n);
}
```

Under each group header row render a "Mark all read" button:

```tsx
<button
  type="button"
  onClick={() => markAllNotificationsRead(activeUser.id, groupType)}
  className="px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
>
  Mark all read
</button>
```

Render one section per group (`module_comment_reply`, `announcement_reply`, others) reusing the existing notification row markup (lines 271-299) unchanged inside each group. Approvals/invitations sections above stay untouched — they share the same request store so approving in either place clears the other (already implemented).

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Leave uncommitted (user override — no commit)**

---

### Task 6: Viewing-clears wiring + manual verification matrix

**Files:**
- Modify: `src/pages/CoursesPage.tsx` (tab switch handler `setSubTab` call sites), `src/pages/CalendarPage.tsx` + `src/pages/FilesView.tsx` + gradebook views (visit marking only, no UI redesign)
- Test: manual only (no new automated tests; Task 1 covers the rules)

**Interfaces:**
- Consumes: `markTabVisited` (Task 3); existing `markThreadAsRead`, `markAnnouncementRead`, `markModuleCommentsRead`
- Produces: nothing (terminal task — badges clear on view).

- [ ] **Step 1: Mark visits on tab selection**

In `CoursesPage.tsx`, find the two `setSubTab` call sites (mobile strip line 99 and the desktop `onSelectCourseTab` passthrough). After each successful tab change, call:

```tsx
markTabVisited(tab.id, activeCourse.id);
```

For `calendar` (a top-level LMS tab, not a course tab), add the same call in the `onNavigateTab('calendar')` path with the active course id if present, otherwise without a course id. For `inbox`, viewing a thread already calls `markThreadAsRead` (existing) — leave it; the message badge clears through `countUnreadMessages`.

- [ ] **Step 2: Mark files/grades/calendar visits inside their views**

At the top of `FilesView.tsx`, `CalendarPage.tsx`, and the student gradebook component, add a mount effect:

```tsx
const { markTabVisited, activeCourseId } = useLMS();
React.useEffect(() => {
  markTabVisited('files', courseId);
}, [courseId]);
```

Replace `'files'` with `'calendar'` / `'grades'` in the other two views. No other changes to those views.

- [ ] **Step 3: Typecheck + manual verification matrix**

Run: `npx tsc -b`
Expected: PASS.
Run: `npx vitest run src/utils/notifiers.test.ts`
Expected: 11/11 PASS.

Manual matrix (both roles, course with sections A/B):
1. Post announcement to Section A → Section B student sees no badge and no feed item; Section A student badge +1; opening it clears to 0.
2. Comment on a module as student → faculty/instructor badge +1 on Modules; opening the module clears it; reply notifies the prior commenter only, never self.
3. Upload a file → student Files badge +1; opening Files clears it.
4. Faculty posts a grade → student Grades badge +1; opening Grades clears it.
5. New quiz/activity published → student Quizzes/Activities badge +1; submitting clears it; faculty Quizzes/Activities badge shows ungraded submissions until graded in SpeedGrader.
6. Join-by-code request → faculty People badge +1; approving clears it in both People and bell.

- [ ] **Step 4: Leave uncommitted (user override — no commit)**

---

## Self-Review

**1. Spec coverage (§3):** Single unread model from `readBy`/`read` + `Notification` capped at 200 → Tasks 1, 3. Per-tab badges for calendar, inbox, modules, announcements (scoped), activities/quizzes (role-aware), files (since last visit), grades (new posts), people (pending for faculty) → Tasks 1, 5, 6. Reply types to original commenter/author only, never self → Tasks 1, 4. Bell total + per-group mark-all-read → Task 5. Request approvals actionable from bell or People queue → reused existing store (Task 5 notes it, no rebuild). Viewing clears → Tasks 4, 6. Role-aware + out-of-section exclusion + no self-badge → Tasks 1, 4, 5.

**2. Placeholder scan:** No TBD/TODO; every step names exact files with line anchors, exact function names/signatures, exact commands with expected outputs, and full code blocks. No "similar to" references without content. All produced names (`resolveAnnouncementReplyRecipient`, `resolveModuleReplyRecipient`, `countUnreadAnnouncements`, `countUnreadMessages`, `countPendingPeople`, `countNewFiles`, `countNewGrades`, `countUpcomingCalendar`, `countStudentAssessmentBadge`, `countFacultyGradingBadge`, `isNewerThanVisit`, `markTabVisited`, `markModuleCommentsRead`) match their consumed uses across tasks.

**3. Type consistency:** `lastVisitedAt` key format `<tab>:<courseId>` is identical in Tasks 1–3, 5–6. `Notification.type` extension is additive so existing `'module_comment_reply' | 'announcement_reply'` literals keep compiling. `countUnreadAnnouncements` viewer shape `{ id, role, sectionId }` matches both call sites. Mock assessment ids `asg-activity-<id>` / `asg-quiz-<id>` match the activities plan convention. `countPendingPeople` takes the raw `enrollmentRequests` array so it works with the real `EnrollmentRequest` type (extra fields ignored structurally).
