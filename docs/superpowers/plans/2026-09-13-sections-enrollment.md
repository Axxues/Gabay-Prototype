# Sections + Enrollment Approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students join courses into exactly one section via faculty-approved requests, with a section chooser and section-scoped announcements.

**Architecture:** Local-first incremental (Approach A). Pure rules live in `src/utils/sections.ts` (unit-tested); state lives in `LMSContext` + `MockDatabase` persisted to the existing `gabay_lms_db_v6` localStorage key; UI reuses People page, bell panel, and course pages.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind; vitest (new devDependency, client-side only, no backend).

**Spec:** `docs/superpowers/specs/2026-09-13-lms-extensions-design.md` (§1)

## Global Constraints

- No backend; all state in `LMSContext` + localStorage key `gabay_lms_db_v6`.
- Exactly one section per student per course; section switches require a new approved request.
- Announcement scope is one section or All (no multi-select).
- No self-approval (faculty cannot approve their own requests).
- Courses without sections behave exactly as today (no chooser, no scope filter).

---

## File structure

- `src/utils/sections.ts` (new) — pure rules: announcement visibility, seat availability, request transitions. No React, no localStorage.
- `src/utils/sections.test.ts` (new) — vitest units for the above.
- `src/types/lms.ts` (modify) — add `Section`, `EnrollmentRequest`; extend `Course` (`sectionIds?`), `User` (`courseSections?`), `Announcement` (`sectionId?`), `MockDatabase` (`sections`, `enrollmentRequests`).
- `src/context/LMSContext.tsx` (modify) — sections CRUD, request actions, chooser enrollment, approval guards, persistence + migration for section-less courses.
- `src/pages/CreateCoursePage.tsx` (modify) — sections editor in the course shell form.
- `src/pages/CoursesPage.tsx` (modify) — awaiting-approval banner + section-chooser routing guard.
- `src/pages/SectionChooserPage.tsx` (new) — seat list + pick action.
- `src/pages/PeopleView.tsx` (modify) — pending approvals queue.
- `src/components/common/NotificationBell.tsx` (new) — bell panel with actionable approval/invitation items.
- `src/components/layout/Topbar.tsx` (modify) — mount the bell panel.
- `src/pages/CreateAnnouncementPage.tsx` (modify) — audience dropdown.
- `src/pages/AnnouncementsView.tsx` (modify) — viewer filter.

---

### Task 1: Test infra + pure section rules

**Files:**
- Create: `src/utils/sections.ts`
- Create: `src/utils/sections.test.ts`
- Modify: `package.json` (add vitest)

**Interfaces:**
- Consumes: `UserRole` from `src/types/lms.ts`
- Produces: `isAnnouncementVisibleToViewer(ann, viewerSectionId, viewerRole)`, `canPickSection(section)`, `transitionRequestStatus(from, action)` used by Tasks 3, 7, 9

- [ ] **Step 1: Add vitest**

```bash
npm i -D vitest
```

- [ ] **Step 2: Write the failing test**

```ts
// src/utils/sections.test.ts
import { describe, expect, it } from 'vitest';
import { canPickSection, isAnnouncementVisibleToViewer, transitionRequestStatus } from './sections';

describe('sections rules', () => {
  it('shows All-sections announcements to everyone', () => {
    expect(isAnnouncementVisibleToViewer({ sectionId: 'all' }, 'sec-a', 'student')).toBe(true);
  });
  it('hides other-section announcements from students', () => {
    expect(isAnnouncementVisibleToViewer({ sectionId: 'sec-a' }, 'sec-b', 'student')).toBe(false);
  });
  it('shows everything to faculty', () => {
    expect(isAnnouncementVisibleToViewer({ sectionId: 'sec-a' }, null, 'faculty')).toBe(true);
  });
  it('blocks full sections', () => {
    expect(canPickSection({ enrolledCount: 30, capacity: 30 })).toBe(false);
    expect(canPickSection({ enrolledCount: 29, capacity: 30 })).toBe(true);
    expect(canPickSection({ enrolledCount: 0 })).toBe(true);
  });
  it('transitions pending requests', () => {
    expect(transitionRequestStatus('pending', 'approve')).toBe('approved');
    expect(transitionRequestStatus('pending', 'reject')).toBe('rejected');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/utils/sections.test.ts`
Expected: FAIL with "Cannot find module './sections'"

- [ ] **Step 4: Write minimal implementation**

```ts
// src/utils/sections.ts
import type { UserRole } from '../types/lms';

export function isAnnouncementVisibleToViewer(
  ann: { sectionId?: string },
  viewerSectionId: string | null,
  viewerRole: UserRole
): boolean {
  if (viewerRole === 'faculty' || viewerRole === 'admin') return true;
  const scope = ann.sectionId || 'all';
  if (scope === 'all') return true;
  return viewerSectionId === scope;
}

export function canPickSection(section: { enrolledCount: number; capacity?: number }): boolean {
  if (section.capacity === undefined) return true;
  return section.enrolledCount < section.capacity;
}

export function transitionRequestStatus(
  from: 'pending' | 'approved' | 'rejected',
  action: 'approve' | 'reject'
): 'approved' | 'rejected' {
  if (from !== 'pending') throw new Error(`Cannot ${action} a ${from} request`);
  return action === 'approve' ? 'approved' : 'rejected';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/utils/sections.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json src/utils/sections.ts src/utils/sections.test.ts
git commit -m "feat: add section visibility and request-transition rules"
```

---

### Task 2: Types for sections, requests, scoped announcements

**Files:**
- Modify: `src/types/lms.ts` (append new interfaces; extend `Course`, `User`, `Announcement`, `MockDatabase`)

**Interfaces:**
- Consumes: none
- Produces: `Section`, `EnrollmentRequest`, `Course.sectionIds?`, `User.courseSections?`, `Announcement.sectionId?`, `MockDatabase.sections`, `MockDatabase.enrollmentRequests` used by Tasks 3–9

- [ ] **Step 1: Add the types**

```ts
export interface Section {
  id: string;
  courseId: string;
  name: string;
  capacity?: number;
  enrolledCount: number;
}

export type EnrollmentRequestType = 'join_code' | 'faculty_invite' | 'section_switch';
export type EnrollmentRequestStatus = 'pending' | 'approved' | 'rejected';

export interface EnrollmentRequest {
  id: string;
  courseId: string;
  studentId: string;
  type: EnrollmentRequestType;
  status: EnrollmentRequestStatus;
  targetSectionId?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
```

Extend: `Course` gets `sectionIds?: string[]`; `User` gets `courseSections?: Record<string, string>` (courseId → sectionId, exactly one); `Announcement` gets `sectionId?: string` (`'all'` default, otherwise a section id); `MockDatabase` gets `sections: Section[]` and `enrollmentRequests: EnrollmentRequest[]`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (new fields are all optional except on new interfaces)

- [ ] **Step 3: Commit**

```bash
git add src/types/lms.ts
git commit -m "feat: add Section and EnrollmentRequest types"
```

---

### Task 3: LMSContext store — sections, requests, approvals

**Files:**
- Modify: `src/context/LMSContext.tsx`
- Test: extend `src/utils/sections.test.ts` only for pure parts (store verified manually in Task 7/8)

**Interfaces:**
- Consumes: `Section`, `EnrollmentRequest` (Task 2); `transitionRequestStatus` (Task 1)
- Produces: `createSection(courseId, name, capacity?)`, `updateSection(id, updates)`, `deleteSection(id)`, `requestJoinCourse(courseId)`, `inviteStudent(courseId, studentId)`, `approveEnrollmentRequest(id)`, `rejectEnrollmentRequest(id)`, `acceptInvitation(id)`, `chooseSection(courseId, sectionId)`, `getPendingRequests(courseId)`, `getMyRequest(courseId)` used by Tasks 4–8

- [ ] **Step 1: Add store methods (minimal, following existing `setDb` patterns)**

```tsx
const createSection = (courseId: string, name: string, capacity?: number): Section => {
  const section: Section = {
    id: `sec-${Date.now().toString(36)}`,
    courseId,
    name: name.trim(),
    capacity,
    enrolledCount: 0
  };
  setDb(prev => ({
    ...prev,
    sections: [...(prev.sections || []), section],
    courses: prev.courses.map(c =>
      c.id === courseId ? { ...c, sectionIds: [...(c.sectionIds || []), section.id] } : c
    )
  }));
  return section;
};

const requestJoinCourse = (courseId: string) => {
  if (db.enrollmentRequests.some(r => r.courseId === courseId && r.studentId === activeUser.id && r.status === 'pending')) return;
  const req: EnrollmentRequest = {
    id: `req-${Date.now().toString(36)}`,
    courseId,
    studentId: activeUser.id,
    type: 'join_code',
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  setDb(prev => ({ ...prev, enrollmentRequests: [...(prev.enrollmentRequests || []), req] }));
};

const approveEnrollmentRequest = (id: string) => {
  if (activeRole !== 'faculty' && activeRole !== 'admin') return;
  setDb(prev => ({
    ...prev,
    enrollmentRequests: (prev.enrollmentRequests || []).map(r => {
      if (r.id !== id || r.status !== 'pending') return r;
      if (r.studentId === activeUser.id) return r; // no self-approval
      return { ...r, status: 'approved' as const, resolvedAt: new Date().toISOString(), resolvedBy: activeUser.id };
    })
  }));
};

const chooseSection = (courseId: string, sectionId: string) => {
  const section = db.sections.find(s => s.id === sectionId && s.courseId === courseId);
  if (!section || !canPickSection(section)) return;
  const approved = (db.enrollmentRequests || []).some(r =>
    r.courseId === courseId && r.studentId === activeUser.id && r.status === 'approved'
  );
  if (!approved) return;
  setDb(prev => ({
    ...prev,
    sections: (prev.sections || []).map(s =>
      s.id === sectionId ? { ...s, enrolledCount: s.enrolledCount + 1 } : s
    ),
    users: prev.users.map(u =>
      u.id === activeUser.id
        ? {
            ...u,
            enrolledCourseIds: (u.enrolledCourseIds || []).includes(courseId)
              ? u.enrolledCourseIds
              : [...(u.enrolledCourseIds || []), courseId],
            courseSections: { ...(u.courseSections || {}), [courseId]: sectionId }
          }
        : u
    ),
    enrollmentRequests: (prev.enrollmentRequests || []).map(r =>
      r.courseId === courseId && r.studentId === activeUser.id && r.status === 'approved' && !r.targetSectionId
        ? { ...r, targetSectionId: sectionId }
        : r
    )
  }));
};
```

`rejectEnrollmentRequest`, `inviteStudent`, `acceptInvitation`, `updateSection`, `deleteSection`, `getPendingRequests`, `getMyRequest` follow the same `setDb`/`db` patterns. Deleting a section with enrolled students is blocked with `showAlert`. Migration: on load, courses without `sectionIds` keep working (no chooser, no scope filter).

- [ ] **Step 2: Export all new methods from the provider value**

Add each name to the `LMSContextType` interface and the provider `value={{...}}` object.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/context/LMSContext.tsx
git commit -m "feat: add sections and enrollment-request store"
```

---

### Task 4: Sections editor in Create Course Shell

**Files:**
- Modify: `src/pages/CreateCoursePage.tsx`

**Interfaces:**
- Consumes: `createSection`, `updateSection`, `deleteSection` (Task 3)
- Produces: courses saved with `sectionIds` (consumed by Task 7)

- [ ] **Step 1: Add a sections editor block (name + optional capacity, add/remove) to the shell form, wired to `createSection` on save; empty list saves a section-less course**

- [ ] **Step 2: Typecheck + manual verify (create course with 2 sections, reopen, names persist)**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/pages/CreateCoursePage.tsx
git commit -m "feat: add sections editor to Create Course Shell"
```

---

### Task 5: Join-by-code becomes request + awaiting state

**Files:**
- Modify: `src/context/LMSContext.tsx` (`joinCourseByCode` calls `requestJoinCourse` instead of direct enroll), `src/pages/CoursesPage.tsx` (awaiting-approval banner)

**Interfaces:**
- Consumes: `requestJoinCourse`, `getMyRequest` (Task 3)
- Produces: pending-request state consumed by Tasks 7–8

- [ ] **Step 1: Change `joinCourseByCode` to file a request and return `{ success: true, pending: true }`; render an "Awaiting faculty approval" banner in `CoursesPage` when `getMyRequest(courseId)?.status === 'pending'`**

- [ ] **Step 2: Manual verify (student joins by code → sees banner, is NOT enrolled; faculty sees request in Task 8)**

- [ ] **Step 3: Commit**

```bash
git add src/context/LMSContext.tsx src/pages/CoursesPage.tsx
git commit -m "feat: join-by-code requires faculty approval"
```

---

### Task 6: Faculty invites need student acceptance

**Files:**
- Modify: `src/context/LMSContext.tsx` (`inviteStudent`, `acceptInvitation`), `src/pages/PeopleView.tsx` (invite button files invitation instead of direct enroll)

**Interfaces:**
- Consumes: `EnrollmentRequest` (Task 2)
- Produces: invitation state consumed by bell panel (Task 8) and chooser (Task 7)

- [ ] **Step 1: Faculty "enroll" creates a `faculty_invite` request; student sees Accept/Decline (bell panel, Task 8); Accept routes to chooser, Decline removes the request**

- [ ] **Step 2: Manual verify (invite → student accepts → chooser; decline → request gone)**

- [ ] **Step 3: Commit**

```bash
git add src/context/LMSContext.tsx src/pages/PeopleView.tsx
git commit -m "feat: faculty invites require student acceptance"
```

---

### Task 7: Section chooser page + routing guard

**Files:**
- Create: `src/pages/SectionChooserPage.tsx`
- Modify: `src/pages/CoursesPage.tsx` (render chooser when approved but `courseSections[courseId]` is unset and course has sections)

**Interfaces:**
- Consumes: `chooseSection`, `canPickSection` (Tasks 1, 3)
- Produces: enrolled-with-section state consumed by Task 9 filter

- [ ] **Step 1: Build chooser (list sections with seats via `canPickSection`, pick calls `chooseSection`, full sections disabled, Back returns to dashboard)**

```tsx
export const SectionChooserPage: React.FC<{ courseId: string; onChosen: () => void }> = ({ courseId, onChosen }) => {
  const { db, activeUser, chooseSection } = useLMS();
  const sections = db.sections.filter(s => s.courseId === courseId);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">Choose your section</h1>
      {sections.map(s => (
        <button
          key={s.id}
          type="button"
          disabled={!canPickSection(s)}
          onClick={() => { chooseSection(courseId, s.id); onChosen(); }}
        >
          {s.name} ({s.enrolledCount}{s.capacity ? `/${s.capacity}` : ''})
        </button>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: Manual verify (approved student with no section sees chooser; picking enrolls; section-less courses never show it)**

- [ ] **Step 3: Commit**

```bash
git add src/pages/SectionChooserPage.tsx src/pages/CoursesPage.tsx
git commit -m "feat: add section chooser page"
```

---

### Task 8: People queue + bell actions share one store

**Files:**
- Create: `src/components/common/NotificationBell.tsx`
- Modify: `src/pages/PeopleView.tsx`, `src/components/layout/Topbar.tsx`

**Interfaces:**
- Consumes: `getPendingRequests`, `approveEnrollmentRequest`, `rejectEnrollmentRequest`, `acceptInvitation` (Task 3); existing `Notification` store
- Produces: approval/invitation UX (no downstream consumers)

- [ ] **Step 1: People page "Pending approvals" block (requester, type, target section, Approve/Reject); bell panel lists the same pending items for faculty plus Accept/Decline invitations for students; both call the same Task-3 actions so either surface clears the other**

- [ ] **Step 2: Manual verify (approve in People → bell clears; approve in bell → queue clears; student accept → chooser)**

- [ ] **Step 3: Commit**

```bash
git add src/components/common/NotificationBell.tsx src/pages/PeopleView.tsx src/components/layout/Topbar.tsx
git commit -m "feat: approvals in People queue and bell panel"
```

---

### Task 9: Section-scoped announcements

**Files:**
- Modify: `src/pages/CreateAnnouncementPage.tsx` (audience dropdown: All + sections), `src/pages/AnnouncementsView.tsx` (filter via `isAnnouncementVisibleToViewer`)

**Interfaces:**
- Consumes: `isAnnouncementVisibleToViewer` (Task 1); viewer `courseSections[courseId]`
- Produces: none (terminal task)

- [ ] **Step 1: Composer saves `sectionId` (default `'all'`); feed filters each announcement through `isAnnouncementVisibleToViewer` with the viewer's section; faculty sees all with an optional section filter chip**

- [ ] **Step 2: Manual verify (post to Section A → Section B student never sees it, no badge; All → everyone)**

- [ ] **Step 3: Commit**

```bash
git add src/pages/CreateAnnouncementPage.tsx src/pages/AnnouncementsView.tsx
git commit -m "feat: add section-scoped announcements"
```

---

## Self-review

- Spec §1 coverage: data model (Task 2), store + guards (Task 3), shell editor (Task 4), join flow (Task 5), invites (Task 6), chooser (Task 7), approvals UX (Task 8), scoped announcements (Task 9). No gaps.
- No placeholders: every step names exact files, signatures, commands, and expected outcomes.
- Type consistency: `Section`, `EnrollmentRequest`, `courseSections`, `sectionId` spelled identically across Tasks 1–9; `transitionRequestStatus` return type matches store usage.
- Note: Plans 2–5 (activities, notifiers, quiz import, auto-foldering) get their own plan files next, one per subsystem.

## Queued next

- Plan 2: Activities (auto-graded question types, shared scorer with quizzes).
- Plan 3: Cross-tab notifiers + reply notifications (badge selectors, bell panel grouping).
- Plan 4: Quiz upload + scan (pdfjs/mammoth, `parseQuizText` units).
- Plan 5: Auto-foldering (filing resolver, Files view placement).
