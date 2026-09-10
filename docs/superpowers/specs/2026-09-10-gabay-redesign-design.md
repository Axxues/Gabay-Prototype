# GABAY Full Redesign — Design Spec (Approach A: Three-Level Canvas Rail)

Date: 2026-09-10
Status: Approved design (5/5 sections), pending spec review
Scope: Full UX + visual redesign, modern academic minimal, every page + modal. Hierarchy preserved.

## 0. Locked hierarchy (must not change)

- Main Nav: Page 1, Page 2, Page 3, Learning Management (LMS, collapsible), Manage College Accounts (admin), Profile/Sign-out
- LMS children: Dashboard, Courses, Calendar, Inbox (+ History, Help as utility)
- Course children: Modules, Syllabus, Announcements, Activities (assignments), Quizzes, Files, Grades, People (hidden for students)

## 1. Architecture / Navigation IA

Desktop layout:

[Topbar 56px][----------------------------------]
[Rail 68px][Context 240px][ Page canvas        ]

- Level 1 Rail (icons only): Page 1/2/3, LMS, Accounts (admin only), spacer, Profile avatar, Sign out, Collapse. Approved.
- Level 2 Context panel swaps: LMS root (header "Learning Management" + Dashboard, Courses, Calendar, Inbox, History, Help) OR Course view (back link "All courses", color + code/title/section header, join-code row, then Modules, Syllabus, Announcements, Activities, Quizzes, Files, Grades, People).
- Topbar slimmed: GABAY mark, Cmd+K search centered, course shell + section switchers only on `courses` tab, theme, history, help, profile menu.
- Routing: no router. Keep `currentTab` + `courseSubTab` + `activeCourseId` in `LMSContext`. New pure components: `AppRail.tsx`, `LMSContextPanel.tsx` (includes `CourseContextPanel`), refactored `Topbar.tsx`. Replace/remove `GlobalSidebar.tsx`, `TopNavbar.tsx`, `CoursesPage` inner nav — not patched.
- Responsive: >=1024 rail+panel; 768-1023 rail overlays panel as drawer; <768 hamburger opens stacked drawer; course tabs become horizontal scroll chips.

## 2. Visual system / Components

- Tokens: keep Tailwind + `bg-background / card / primary` vars. Light paper `#FAFAF8`, ink `#1A1D21`, `border-border/60`. Dark via existing `.dark`. Primary stays GABAY green, single accent. Type Inter/system: 12px semibold nav, 10px uppercase headers, 20/24px extrabold titles. Radius 12px panels / 10px items. `shadow-subtle` only.
- Rebuilt: shell (Rail, Panel, Topbar); Dashboard cards to flat cover + meta list; Course pages share `PageHeader` + `EmptyState` + `ListRow`; Modals (SpeedGrader, RoleSwitcher, JoinCourse, GlobalSearch, HistoryDrawer, UserProfile) share one dialog frame; LoginPage re-skinned, no auth change.
- YAGNI: no animation lib, lucide only, no density toggle, no theming engine.

## 3. Data flow / State

- Reuse `LMSContext`: `activeRole`, `activeUser`, `db`, `activeCourseId`, `logHistory`, `theme`.
- Rail click -> `setCurrentTab` + `logHistory('/lms/<tab>')`. LMS icon expands panel.
- Panel items -> same callbacks. Course items -> `setCourseSubTab` + `logHistory('/lms/courses/<id>/<sub>')`.
- Single `navigation.ts` config with `roles` arrays drives Rail + Panel + Topbar to prevent drift.
- Switchers call `setActiveCourseId`. Search navigates via same callbacks.
- No router, no persisted nav beyond existing localStorage, no data-model changes.

## 4. Roles / Responsive / Error handling

- Roles: `navigation.ts` declares `MAIN_NAV`, `LMS_CHILDREN`, `COURSE_CHILDREN` with role arrays. Staff sees Inbox/Calendar/History/Help/Profile only. `People` hidden for students. `accounts` admin-only. Existing `App.tsx` guard stays as safety net.
- Responsive/empty: Panel becomes drawer below `lg` with backdrop close. Below `md`, course list becomes chip scroller reusing config. Targets >=40px. Single `EmptyState` with Join/Create.
- Errors: keep `AppErrorBoundary` + `showConfirm`. Orphaned `activeCourseId` falls back to first available. Clipboard in try/catch.

## 5. Testing / Rollout

- Gates: `npm run typecheck` + `npm run build` pass. Manual matrix: 4 roles x 3 breakpoints x LMS->Course->sub-tab traversal, badges, Cmd+K, theme, sign-out.
- Rollout: delete `GlobalSidebar.tsx` + `CoursesPage` inner nav, refactor `TopNavbar` -> `Topbar`. Touch: `App.tsx`, `navigation.ts` (new), `AppRail.tsx` (new), `LMSContextPanel.tsx` (new), `Topbar.tsx`, `CoursesPage.tsx`, `DashboardPage.tsx`, shared header/empty/row, dialog frame, `index.css` tokens only. Remove dead classes.

## Self-review

- No TBD/TODO. No contradictions (single config drives all nav; no router). Scope is single plan (shell + shared components + page reskin). No ambiguous requirements: hierarchy list in Sec 0 is normative.
