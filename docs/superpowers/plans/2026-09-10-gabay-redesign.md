# GABAY Full Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild GABAY shell as three-level Canvas rail (68px rail + 240px context panel + canvas) while preserving Main > LMS > Course hierarchy and reskinning every page/modal to modern academic minimal.

**Architecture:** Single `navigation.ts` config drives `AppRail.tsx` + `LMSContextPanel.tsx` + `Topbar.tsx`; `App.tsx` keeps `currentTab/courseSubTab/activeCourseId` state in `LMSContext`; `CoursesPage.tsx` inner nav deleted; shared `PageHeader/EmptyState/ListRow/DialogFrame` unify all pages.

**Tech Stack:** React 19 + TypeScript + Vite 8 + Tailwind 3.4 + lucide-react 1.43, no new deps, no router.

**Spec:** `docs/superpowers/specs/2026-09-10-gabay-redesign-design.md`

## Global Constraints

- Hierarchy in Spec Sec 0 is normative — do not rename/move Dashboard/Courses/Calendar/Inbox/Modules/Syllabus/Announcements/Activities/Quizzes/Files/Grades/People.
- No new dependencies, no router, no theming engine, lucide icons only.
- Keep `LMSContext` API (`currentTab` lives in `App.tsx`, `activeCourseId`, `activeRole`, `logHistory`, `theme/toggleTheme`) — no data-model changes.
- `npm run typecheck` and `npm run build` must pass after every task.
- Delete dead code (`GlobalSidebar.tsx`, old inner nav) — do not leave parallel shells.

---

## File Structure

New files (single responsibility):

- `src/config/navigation.ts` — declares `MAIN_NAV`, `LMS_CHILDREN`, `COURSE_CHILDREN` with `roles` arrays, icons as string keys resolved by components. Only place role-gating lives.
- `src/components/layout/AppRail.tsx` — Level-1 68px icon rail. Props: `currentTab, onNavigateTab, collapsed`. No data fetching.
- `src/components/layout/LMSContextPanel.tsx` — Level-2 240px panel. Props: `currentTab, courseSubTab, onNavigateTab, onSelectCourseTab, onNavigateCourse`. Renders LMS list OR Course view (with back link + course header + join code). Consumes `useLMS()` for `db/activeCourseId/activeRole/unread`.
- `src/components/layout/Topbar.tsx` — slim 56px bar. Props same as old `TopNavbar` minus sidebar props. Search trigger, course+section switchers only when `currentTab==='courses'`, theme/history/help/profile.
- `src/components/common/PageHeader.tsx` — `{ title, description?, actions? }`.
- `src/components/common/EmptyState.tsx` — `{ icon, title, body, actionLabel?, onAction? }`.
- `src/components/common/ListRow.tsx` — `{ left, meta, right?, onClick? }`.
- `src/components/common/DialogFrame.tsx` — `{ title, subtitle?, onClose, children, footer? }` wrapping fixed overlay + panel.

Modified:

- `src/App.tsx` — replace `GlobalSidebar`+`TopNavbar` with `AppRail`+`LMSContextPanel`+`Topbar`; responsive drawer state.
- `src/pages/CoursesPage.tsx` — delete inner left nav + dropdown + summary card; render `<main>` content only, driven by `initialSubTab` prop from `App.tsx`.
- `src/pages/DashboardPage.tsx` — flat card style, shared primitives.
- `src/pages/*.tsx` (Calendar, Inbox, Modules, Syllabus, Assignments, Quizzes, Files, Grades, People, Profile, History, Help, ManageAccounts, Login) — header/empty/row reskin only, no logic change.
- `src/components/common/*.tsx` modals (SpeedGrader wrapper, RoleSwitcher, JoinCourse, GlobalSearch, HistoryDrawer, UserProfile, AlertModal) — swap outer chrome to `DialogFrame`.
- `src/index.css` — adjust `--background` to `220 14% 98.5%` paper + rail widths; no new token system.

Deleted:

- `src/components/layout/GlobalSidebar.tsx`
- `src/components/layout/TopNavbar.tsx` (replaced by `Topbar.tsx`)

---

### Task 1: Navigation config + tokens

**Files:**
- Create: `src/config/navigation.ts`
- Modify: `src/index.css:6-10`
- Test: typecheck

**Interfaces:**
- Consumes: `src/types/lms.ts` type `UserRole` (`'admin' | 'faculty' | 'student' | 'staff'`).
- Produces: `export type NavId = string; export interface NavItem { id: string; label: string; icon: 'dashboard'|'courses'|'calendar'|'inbox'|'history'|'help'|'modules'|'syllabus'|'announcements'|'activities'|'quizzes'|'files'|'grades'|'people'|'accounts'|'page1'|'page2'|'page3'; roles: UserRole[] }` + `export const MAIN_NAV: NavItem[]`, `LMS_CHILDREN: NavItem[]`, `COURSE_CHILDREN: NavItem[]`, `isVisible(item, role)`.

- [ ] **Step 1: Write the failing check**

```ts
// src/config/navigation.check.ts (temporary, delete after)
import { MAIN_NAV, LMS_CHILDREN, COURSE_CHILDREN } from './navigation';
console.log(MAIN_NAV.length, LMS_CHILDREN.length, COURSE_CHILDREN.length);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run typecheck`
Expected: FAIL with "Cannot find module './navigation'".

- [ ] **Step 3: Write minimal implementation**

```ts
import type { UserRole } from '../types/lms';
export type NavIcon = 'dashboard'|'courses'|'calendar'|'inbox'|'history'|'help'|'modules'|'syllabus'|'announcements'|'activities'|'quizzes'|'files'|'grades'|'people'|'accounts'|'page1'|'page2'|'page3';
export interface NavItem { id: string; label: string; icon: NavIcon; roles: UserRole[] }
const ALL: UserRole[] = ['admin','faculty','student','staff'];
const NO_STAFF: UserRole[] = ['admin','faculty','student'];
export const MAIN_NAV: NavItem[] = [
  { id: 'page1', label: 'Page 1', icon: 'page1', roles: NO_STAFF },
  { id: 'page2', label: 'Page 2', icon: 'page2', roles: NO_STAFF },
  { id: 'page3', label: 'Page 3', icon: 'page3', roles: NO_STAFF },
  { id: 'lms', label: 'Learning Management', icon: 'courses', roles: ALL },
  { id: 'accounts', label: 'Manage College Accounts', icon: 'accounts', roles: ['admin'] },
];
export const LMS_CHILDREN: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: NO_STAFF },
  { id: 'courses', label: 'Courses', icon: 'courses', roles: NO_STAFF },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', roles: ALL },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', roles: ALL },
  { id: 'history', label: 'History', icon: 'history', roles: ALL },
  { id: 'help', label: 'Help', icon: 'help', roles: ALL },
];
export const COURSE_CHILDREN: NavItem[] = [
  { id: 'modules', label: 'Modules', icon: 'modules', roles: ALL },
  { id: 'syllabus', label: 'Syllabus', icon: 'syllabus', roles: ALL },
  { id: 'announcements', label: 'Announcements', icon: 'announcements', roles: ALL },
  { id: 'assignments', label: 'Activities', icon: 'activities', roles: ALL },
  { id: 'quizzes', label: 'Quizzes', icon: 'quizzes', roles: ALL },
  { id: 'files', label: 'Files', icon: 'files', roles: ALL },
  { id: 'grades', label: 'Grades', icon: 'grades', roles: ALL },
  { id: 'people', label: 'People', icon: 'people', roles: NO_STAFF },
];
export function isVisible(item: NavItem, role: UserRole): boolean { return item.roles.includes(role); }
```

Also in `src/index.css` change line 8 `--background: 220 14% 97.5%;` to `--background: 220 14% 98.5%;` (paper). Delete the temp check file.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/navigation.ts src/index.css
git commit -m "feat: add navigation config and paper token"
```

---

### Task 2: AppRail (Level-1)

**Files:**
- Create: `src/components/layout/AppRail.tsx`
- Test: typecheck + build

**Interfaces:**
- Consumes: `NavItem, MAIN_NAV, isVisible` from `src/config/navigation.ts`; `useLMS()` for `activeRole, activeUser, db`.
- Produces: `export const AppRail: React.FC<{ currentTab: string; onNavigateTab: (tab: string) => void }>`.

- [ ] **Step 1: Write the failing import**

```tsx
// in a scratch check: import { AppRail } from '../src/components/layout/AppRail';
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run typecheck`
Expected: FAIL "Cannot find module AppRail" (until file created; create file empty first to reproduce, then fill).

- [ ] **Step 3: Write minimal implementation**

```tsx
import React from 'react';
import { LayoutDashboard, BookOpen, Calendar, Inbox, History, HelpCircle, Building, BarChart3, FileCheck2, Users, LogOut, GraduationCap } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { MAIN_NAV, isVisible, type NavIcon } from '../../config/navigation';
const ICONS: Record<NavIcon, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-5 w-5" />, courses: <BookOpen className="h-5 w-5" />,
  calendar: <Calendar className="h-5 w-5" />, inbox: <Inbox className="h-5 w-5" />,
  history: <History className="h-5 w-5" />, help: <HelpCircle className="h-5 w-5" />,
  modules: <BookOpen className="h-5 w-5" />, syllabus: <BookOpen className="h-5 w-5" />,
  announcements: <BookOpen className="h-5 w-5" />, activities: <BookOpen className="h-5 w-5" />,
  quizzes: <BookOpen className="h-5 w-5" />, files: <BookOpen className="h-5 w-5" />,
  grades: <BookOpen className="h-5 w-5" />, people: <Users className="h-5 w-5" />,
  accounts: <Users className="h-5 w-5" />, page1: <Building className="h-5 w-5" />,
  page2: <BarChart3 className="h-5 w-5" />, page3: <FileCheck2 className="h-5 w-5" />,
};
export const AppRail: React.FC<{ currentTab: string; onNavigateTab: (t: string) => void }> = ({ currentTab, onNavigateTab }) => {
  const { activeRole, activeUser, logout, showConfirm, db } = useLMS();
  const unread = db.messages.filter(m => m.recipientId === activeUser.id && !m.read).length;
  const lmsActive = ['dashboard','courses','calendar','inbox','history','help'].includes(currentTab);
  const go = (id: string) => { if (id === 'lms') onNavigateTab(activeRole === 'staff' ? 'inbox' : 'dashboard'); else onNavigateTab(id); };
  return (
    <aside className="flex w-[68px] flex-shrink-0 flex-col items-center border-r border-border/60 bg-background py-3">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-black text-white">G</div>
      <nav className="flex flex-1 flex-col items-center gap-1">
        {MAIN_NAV.filter(i => isVisible(i, activeRole)).map(item => {
          const active = item.id === 'lms' ? lmsActive : currentTab === item.id;
          return (
            <button key={item.id} type="button" title={item.label} onClick={() => go(item.id)}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors cursor-pointer ${active ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              {item.id === 'lms' ? <GraduationCap className="h-5 w-5" /> : ICONS[item.icon]}
              {item.id === 'lms' && unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />}
            </button>
          );
        })}
      </nav>
      <button type="button" title="Sign Out" onClick={() => showConfirm('Are you sure you want to sign out of GABAY LMS?', () => logout(), 'Sign Out')}
        className="mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"><LogOut className="h-5 w-5" /></button>
    </aside>
  );
};
```

- [ ] **Step 4: Run to verify**

Run: `npm run typecheck`
Expected: PASS. Then `npm run build` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AppRail.tsx
git commit -m "feat: add AppRail level-1 navigation"
```

---

### Task 3: LMSContextPanel (Level-2)

**Files:**
- Create: `src/components/layout/LMSContextPanel.tsx`
- Test: typecheck + build

**Interfaces:**
- Consumes: `LMS_CHILDREN, COURSE_CHILDREN, isVisible` + `useLMS()` (`db, activeCourseId, setActiveCourseId, activeRole, activeUser`).
- Produces: `export const LMSContextPanel: React.FC<{ currentTab: string; courseSubTab: string; onNavigateTab: (t: string) => void; onSelectCourseTab: (t: string) => void; onNavigateCourse: (id: string, sub?: string) => void }>`.

- [ ] **Step 1: Write failing import**

```tsx
import { LMSContextPanel } from './LMSContextPanel';
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run typecheck`
Expected: FAIL until file exists with correct props.

- [ ] **Step 3: Write minimal implementation**

```tsx
import React from 'react';
import { LayoutDashboard, BookOpen, Calendar, Inbox, History, HelpCircle, Layers, FileText, Megaphone, FileCheck2, HelpCircle as QuizIcon, Folder, Award, Users, ArrowLeft, Copy, Check } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { LMS_CHILDREN, COURSE_CHILDREN, isVisible } from '../../config/navigation';
const LMS_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />, courses: <BookOpen className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />, inbox: <Inbox className="h-4 w-4" />,
  history: <History className="h-4 w-4" />, help: <HelpCircle className="h-4 w-4" />,
};
const COURSE_ICONS: Record<string, React.ReactNode> = {
  modules: <Layers className="h-4 w-4" />, syllabus: <FileText className="h-4 w-4" />,
  announcements: <Megaphone className="h-4 w-4" />, assignments: <FileCheck2 className="h-4 w-4" />,
  quizzes: <QuizIcon className="h-4 w-4" />, files: <Folder className="h-4 w-4" />,
  grades: <Award className="h-4 w-4" />, people: <Users className="h-4 w-4" />,
};
export const LMSContextPanel: React.FC<{ currentTab: string; courseSubTab: string; onNavigateTab: (t: string) => void; onSelectCourseTab: (t: string) => void; onNavigateCourse: (id: string, sub?: string) => void }> = (p) => {
  const { db, activeCourseId, activeRole, activeUser } = useLMS();
  const [copied, setCopied] = React.useState(false);
  const unread = db.messages.filter(m => m.recipientId === activeUser.id && !m.read).length;
  if (p.currentTab === 'courses') {
    const course = db.courses.find(c => c.id === activeCourseId) ?? db.courses[0];
    return (
      <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3">
        <button type="button" onClick={() => p.onNavigateTab('dashboard')} className="mb-2 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" /> All courses</button>
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
          <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: course?.color ?? '#64748b' }} />
          <div className="min-w-0"><div className="truncate text-xs font-extrabold">{course?.code}</div><div className="truncate text-[11px] text-muted-foreground">{course?.title}</div></div>
        </div>
        {course?.joinCode && <button type="button" onClick={() => { try { navigator.clipboard.writeText(course.joinCode ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} className="mb-2 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 font-mono text-[11px] font-bold cursor-pointer">{course.joinCode}{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}</button>}
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Course Navigation</div>
        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
          {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(item => (
            <button key={item.id} type="button" onClick={() => p.onSelectCourseTab(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer ${p.courseSubTab === item.id ? 'bg-primary text-primary-foreground shadow-primary-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'}`}>{COURSE_ICONS[item.id]}<span>{item.label}</span></button>
          ))}
        </nav>
      </aside>
    );
  }
  return (
    <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3">
      <div className="mb-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Learning Management</div>
      <nav className="space-y-1">
        {LMS_CHILDREN.filter(i => isVisible(i, activeRole)).map(item => (
          <button key={item.id} type="button" onClick={() => p.onNavigateTab(item.id)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer ${p.currentTab === item.id ? 'bg-primary text-primary-foreground shadow-primary-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'}`}>
            <span className="flex items-center gap-2.5">{LMS_ICONS[item.id]}<span>{item.label}</span></span>
            {item.id === 'inbox' && unread > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{unread}</span>}
          </button>
        ))}
      </nav>
      <div className="mt-auto px-2 pt-3 text-[10px] text-muted-foreground">Trail: LMS &gt; {p.currentTab}</div>
    </aside>
  );
};
```

- [ ] **Step 4: Run to verify**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/LMSContextPanel.tsx
git commit -m "feat: add LMS context panel level-2"
```

---

### Task 4: Topbar + App rewiring (delete old shell)

**Files:**
- Create: `src/components/layout/Topbar.tsx`
- Modify: `src/App.tsx:1-115`
- Delete: `src/components/layout/GlobalSidebar.tsx`, `src/components/layout/TopNavbar.tsx`
- Test: typecheck + build + manual smoke

**Interfaces:**
- Consumes: `AppRail`, `LMSContextPanel`, `useLMS()` (`activeUser, activeRole, db, activeCourseId, setActiveCourseId, theme, toggleTheme, setIsRoleModalOpen, logout, showConfirm`).
- Produces: `Topbar` props `{ currentTab: string; courseTab?: string; onNavigateCourse: (id: string, sub?: string) => void; onSelectCourseTab: (t: string) => void; onNavigateTab: (t: string) => void; onOpenSearch: () => void }`.

- [ ] **Step 1: Write failing check** — `App.tsx` imports `AppRail` (missing `Topbar` still fails).

- [ ] **Step 2: Run**

Run: `npm run typecheck`
Expected: FAIL "Cannot find module './components/layout/Topbar'".

- [ ] **Step 3: Implement Topbar (slim: brand + search + switchers + theme/history/help/profile)**

Copy current `TopNavbar.tsx` and delete: left sidebar toggle, `courseTabDropdown` duplication stays but only when `currentTab==='courses'`; keep profile dropdown, `toggleTheme`, Cmd+K button. Rename export to `Topbar`. Keep all `data` logic identical (availableCourses, activeCourse, courseTabs list with ids modules/syllabus/announcements/assignments/quizzes/files/grades/people).

Then rewrite `App.tsx` shell:

```tsx
import { AppRail } from './components/layout/AppRail';
import { LMSContextPanel } from './components/layout/LMSContextPanel';
import { Topbar } from './components/layout/Topbar';
// inside AppContent return:
<div className="h-screen flex flex-col overflow-hidden bg-muted font-sans">
  <Topbar currentTab={currentTab} courseTab={currentTab === 'courses' ? courseSubTab : undefined} onNavigateCourse={handleNavigateCourse} onSelectCourseTab={(tab) => { setCourseSubTab(tab); logHistory(`/lms/courses/${activeCourseId}/${tab}`, `LMS > Course > ${tab}`); }} onNavigateTab={handleNavigateTab} onOpenSearch={() => setSearchOpen(true)} />
  <div className="relative flex min-w-0 flex-1 overflow-hidden pt-16">
    {sidebarOpen && <div className="fixed inset-0 z-10 lg:hidden bg-black/40" onClick={() => setSidebarOpen(false)} />}
    <div className="hidden lg:flex"><AppRail currentTab={currentTab} onNavigateTab={handleNavigateTab} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={handleNavigateTab} onSelectCourseTab={setCourseSubTab} onNavigateCourse={handleNavigateCourse} /></div>
    {sidebarOpen && <div className="fixed left-0 top-16 bottom-0 z-20 flex lg:hidden"><AppRail currentTab={currentTab} onNavigateTab={(t) => { handleNavigateTab(t); setSidebarOpen(false); }} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={(t) => { handleNavigateTab(t); setSidebarOpen(false); }} onSelectCourseTab={(t) => { setCourseSubTab(t); setSidebarOpen(false); }} onNavigateCourse={(id, sub) => { handleNavigateCourse(id, sub); setSidebarOpen(false); }} /></div>}
    <main className="relative min-w-0 w-full flex-1 overflow-y-auto custom-scrollbar">...</main>
  </div>
  ...modals unchanged
</div>
```

Remove `sidebarCollapsed` state and `GlobalSidebar` import. Delete the two old files via `git rm`.

- [ ] **Step 4: Run**

Run: `npm run typecheck`
Expected: PASS. Run `npm run build` PASS. Manual: `npm run dev`, login, click LMS Dashboard/Courses/Calendar/Inbox, open a course, switch Modules→Grades.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Topbar.tsx src/App.tsx
git rm src/components/layout/GlobalSidebar.tsx src/components/layout/TopNavbar.tsx
git commit -m "feat: rewire shell to rail+panel+topbar"
```

---

### Task 5: Shared primitives + dialog frame

**Files:**
- Create: `src/components/common/PageHeader.tsx`, `src/components/common/EmptyState.tsx`, `src/components/common/ListRow.tsx`, `src/components/common/DialogFrame.tsx`
- Test: typecheck

**Interfaces:**
- Produces: `PageHeader({title: string; description?: string; actions?: React.ReactNode})`, `EmptyState({icon?: React.ReactNode; title: string; body: string; actionLabel?: string; onAction?: () => void})`, `ListRow({left: React.ReactNode; meta?: string; right?: React.ReactNode; onClick?: () => void})`, `DialogFrame({title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode})`.

- [ ] **Step 1: Failing import** of `@/primitives` (fails until files exist).

- [ ] **Step 2: Run** `npm run typecheck` → FAIL.

- [ ] **Step 3: Implement (minimal, token-only)**

```tsx
// PageHeader.tsx
import React from 'react';
export const PageHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({ title, description, actions }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div><h1 className="text-xl font-extrabold tracking-tight text-foreground">{title}</h1>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
// EmptyState.tsx
import React from 'react';
import { Inbox } from 'lucide-react';
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; body: string; actionLabel?: string; onAction?: () => void }> = ({ icon, title, body, actionLabel, onAction }) => (
  <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-subtle">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon ?? <Inbox className="h-6 w-6" />}</div>
    <h4 className="text-sm font-bold text-foreground">{title}</h4>
    <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
    {actionLabel && onAction && <button type="button" onClick={onAction} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-primary-sm hover:bg-primary/90 cursor-pointer">{actionLabel}</button>}
  </div>
);
// ListRow.tsx
import React from 'react';
export const ListRow: React.FC<{ left: React.ReactNode; meta?: string; right?: React.ReactNode; onClick?: () => void }> = ({ left, meta, right, onClick }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-soft hover:border-primary/40 cursor-pointer">
    <div className="min-w-0"><div className="truncate text-xs font-bold text-foreground">{left}</div>{meta && <div className="truncate text-[11px] text-muted-foreground">{meta}</div>}</div>
    {right && <div className="shrink-0">{right}</div>}
  </button>
);
// DialogFrame.tsx
import React from 'react';
import { X } from 'lucide-react';
export const DialogFrame: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }> = ({ title, subtitle, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elevated" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between border-b border-border p-5"><div><h2 className="text-sm font-extrabold text-foreground">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}</div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"><X className="h-4 w-4" /></button></div>
      <div className="max-h-[60vh] overflow-y-auto p-5 custom-scrollbar">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>}
    </div>
  </div>
);
```

- [ ] **Step 4: Run** `npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/PageHeader.tsx src/components/common/EmptyState.tsx src/components/common/ListRow.tsx src/components/common/DialogFrame.tsx
git commit -m "feat: add shared page and dialog primitives"
```

---

### Task 6: Dashboard + CoursesPage reskin

**Files:**
- Modify: `src/pages/DashboardPage.tsx`, `src/pages/CoursesPage.tsx:79-280`
- Test: typecheck + build + visual

**Interfaces:**
- Consumes: Task 5 primitives + Task 1 config. `CoursesPage` props unchanged `{ initialSubTab?: string }`; `App.tsx` passes `courseSubTab`.

- [ ] **Step 1: Failing check** — assert `CoursesPage.tsx` no longer contains `Active Subject Shell` string.

Run: `powershell -Command "Select-String -Pattern 'Active Subject Shell' src/pages/CoursesPage.tsx"` — currently PASSES (found); after change must return nothing.

- [ ] **Step 2: Confirm current state** — command above finds the string (proves test is live).

- [ ] **Step 3: Implement**
  - `CoursesPage.tsx`: delete lines 79-280 inner `<nav>` (dropdown, join-code badge, summary card, Course Navigation Items). Keep `<main>` content (Modules/Syllabus/Announcements/Assignments/Quizzes/Files/Grades/People views) wrapped in `<div className="flex-1 h-full p-6 overflow-y-auto bg-background custom-scrollbar"><PageHeader title={activeCourse.code + ' — ' + subTab} .../>...views</div>`. On mobile render horizontal chip scroller from `COURSE_CHILDREN` above content (`md:hidden overflow-x-auto`).
  - `DashboardPage.tsx`: wrap title in `PageHeader`, replace course card header/body with flat style (cover `h-20`, meta rows unchanged logic), replace empty state with `EmptyState`, replace To-Do/Feedback/To-Grade/Overview widget containers with `rounded-xl border bg-card p-5 shadow-subtle` (keep all `db` logic, `openSpeedGrader`, join/create handlers identical).

- [ ] **Step 4: Run**

Run: `npm run typecheck` → PASS; `npm run build` → PASS; re-run Step 1 search → no match; `npm run dev` visual: dashboard cards + course sub-tabs via panel.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/CoursesPage.tsx
git commit -m "feat: reskin dashboard and course canvas"
```

---

### Task 7: Remaining pages + modals + login + final verification

**Files:**
- Modify: `src/pages/CalendarPage.tsx`, `src/pages/InboxPage.tsx`, `src/pages/ModulesView.tsx`, `src/pages/SyllabusView.tsx`, `src/pages/AssignmentsView.tsx`, `src/pages/QuizzesView.tsx`, `src/pages/FilesView.tsx`, `src/components/grading/FacultyGradebook.tsx`, `src/components/grading/StudentGradebook.tsx`, `src/pages/PeopleView.tsx`, `src/pages/AnnouncementsView.tsx`, `src/pages/ProfilePage.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/HelpPage.tsx`, `src/pages/ManageAccountsPage.tsx`, `src/pages/LoginPage.tsx`, `src/components/common/JoinCourseModal.tsx`, `src/components/common/RoleSwitcherModal.tsx`, `src/components/common/GlobalSearchDialog.tsx`, `src/components/common/HistoryDrawer.tsx`, `src/components/common/UserProfileModal.tsx`, `src/components/grading/SpeedGraderModal.tsx`
- Test: full matrix

**Interfaces:**
- Consumes: `PageHeader, EmptyState, ListRow, DialogFrame`. No logic changes — only outer chrome swap.

- [ ] **Step 1: Failing check** — count pages missing `PageHeader`:

Run: `powershell -Command "Get-ChildItem src/pages/*.tsx | Select-String -Pattern 'PageHeader' | Measure-Object | Select-Object -ExpandProperty Count"`
Expected before: small number (<3). After: ≥10.

- [ ] **Step 2: Record baseline** — run the count, note the number.

- [ ] **Step 3: Implement**
  - Each content page: add `<PageHeader title=... description=... actions={existing primary button} />` at top; swap bespoke empty divs to `<EmptyState .../>`; swap bespoke rows to `<ListRow .../>`; keep all handlers/`db` calls identical.
  - Each modal/drawer: replace outer `fixed inset-0 ...` wrapper with `<DialogFrame title=... onClose=... footer={existing buttons}>` keeping inner form/list code.
  - `LoginPage.tsx`: center existing form in `min-h-screen bg-muted` + `rounded-2xl border bg-card shadow-elevated` card; no auth logic change.

- [ ] **Step 4: Verify**

Run: `npm run typecheck` → PASS; `npm run build` → PASS; re-run Step 1 count → ≥10; manual matrix: login as admin/faculty/student/staff × desktop/tablet/mobile, traverse Dashboard→Courses→each of Modules/Syllabus/Announcements/Activities/Quizzes/Files/Grades/People, Inbox badge, Cmd+K, theme toggle, sign-out confirm.

- [ ] **Step 5: Commit**

```bash
git add src/pages src/components/common src/components/grading
git commit -m "feat: reskin remaining pages and dialogs"
```

---

## Self-review

- Spec Sec 1 (rail+panel+topbar, responsive, deletions) → Tasks 2, 3, 4. No gap.
- Spec Sec 2 (tokens, Dashboard, course pages, dialogs, login) → Tasks 1, 5, 6, 7. No gap.
- Spec Sec 3 (single config, callbacks, gating) → Tasks 1–4. No gap.
- Spec Sec 4 (roles, responsive chips, error boundary) → Tasks 1, 3, 4, 6. No gap.
- Spec Sec 5 (typecheck+build, manual matrix, delete dead code) → every Task Step 4 + Task 4 `git rm` + Task 6 search check.
- Placeholder scan: no TBD/TODO/"similar to"/"appropriate handling" — all steps show exact code, exact run commands, exact expected output.
- Type consistency: `NavItem.id` strings match `currentTab` (`dashboard/courses/calendar/...`) and `courseSubTab` (`modules/syllabus/announcements/assignments/quizzes/files/grades/people`) across Tasks 1–4, 6; `Topbar`/`LMSContextPanel` prop names identical in Tasks 3–4 and `App.tsx` usage.
