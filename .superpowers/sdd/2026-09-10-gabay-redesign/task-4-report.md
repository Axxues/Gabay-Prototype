# Task 4 report — Topbar + App rewiring (delete old shell)

Branch: `redesign` (worktree `.worktrees/redesign`). Main untouched.
Base: `8d86026`. Commit: `8687105 feat: rewire shell to rail+panel+topbar`.

## Changes
- Created `src/components/layout/Topbar.tsx` (git detects rename from `TopNavbar.tsx`, 97% similarity):
  - `TopNavbarProps` → `TopbarProps`; removed `sidebarOpen` / `setSidebarOpen` fields.
  - `export const TopNavbar` → `export const Topbar`.
  - Deleted the mobile toggle-button block (`setSidebarOpen` Menu/X toggle); removed `X` from lucide imports (`Menu` kept).
  - Added optional `onOpenSidebar?: () => void` per controller ruling; renders a mobile-only (`lg:hidden`) `Menu` hamburger in the same left-section slot, only when the prop is present. Required props exactly as specified.
  - Everything else byte-identical: brand GABAY, theme toggle (+mobile in profile), Cmd+K search trigger, course+section switchers gated on `currentTab==='courses'`, history/help buttons, profile dropdown, sign-out confirm.
- Modified `src/App.tsx`:
  - Imports: `GlobalSidebar`/`TopNavbar` out; `AppRail`/`LMSContextPanel`/`Topbar` in.
  - Deleted `sidebarCollapsed` state; `sidebarOpen` + `searchOpen` kept.
  - `<Topbar>` wired exactly per brief (incl. `onSelectCourseTab` with `logHistory`, `onOpenSearch`, `onOpenSidebar={() => setSidebarOpen(true)}`).
  - Desktop: `<div className="hidden lg:flex"><AppRail …/><LMSContextPanel …/></div>`; mobile: `sidebarOpen`-gated `fixed left-0 top-16 bottom-0 z-20 flex lg:hidden` drawer whose callbacks all close the drawer. Backdrop overlay kept.
  - Untouched: role-guard effect, Cmd+K effect, `handleNavigateTab`/`handleNavigateCourse` incl. all `logHistory` strings, unauthenticated `LoginPage` return, all page-canvas conditionals, all three global modals, error boundary.
- Deleted via `git rm`: `src/components/layout/GlobalSidebar.tsx`, `src/components/layout/TopNavbar.tsx`.

## Verification
- `npm run typecheck` (baseline, before changes): PASS (`tsc -b`, clean).
- `npm run typecheck` (after): PASS.
- `npm run build`: PASS (`tsc -b && vite build`, 1888 modules, ~2.3s; only pre-existing >500kB chunk-size warning).
- Dev smoke: `npm run dev` serves `HTTP 200` on `http://localhost:5173/` (curl). Interactive traverse (login → Dashboard/Courses/Calendar/Inbox → Modules→Grades) NOT performed — no browser automation available in this environment; needs human click-through.

## Self-review
- Diff reviewed: `App.tsx` shell matches brief snippets verbatim; only deviations are two HTML comments updated (`TopNavbar` → `Topbar` wording).
- `grep` for `GlobalSidebar|TopNavbar|sidebarCollapsed|onToggleCollapse` in `src`: only hit is a stale doc comment in `src/components/common/ModalPortal.tsx:11` ("including TopNavbar and GlobalSidebar") — comment-only, zero runtime effect; left unchanged per frozen scope, flagging for a later cleanup task.
- Desktop `LMSContextPanel.onSelectCourseTab={(t) => setCourseSubTab(t)}` intentionally omits `logHistory` per brief (Topbar path and course pages retain their logging).
- Mobile drawer duplicates rail+panel (one extra mounted instance only while open); acceptable per brief.

## Concerns
1. Interactive login traverse smoke test still outstanding — recommend human pass (login, traverse Dashboard/Courses/Calendar/Inbox, open course Modules→Grades, mobile drawer open/close) before integration.
2. `ModalPortal.tsx:11` comment references deleted components (cosmetic only).
3. `dist/` build output regenerated in worktree by `npm run build` (untracked or ignored — verify `.gitignore` covers it; `git status` post-commit is clean).
