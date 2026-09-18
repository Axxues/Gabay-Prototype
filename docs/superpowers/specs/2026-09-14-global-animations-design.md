# Global Animations Design — Smooth Appear / Disappear System

Date: 2026-09-14 | Scope: system-wide motion polish | Status: spec approved (sections 1-3), awaiting implementation plan
Approach: A — CSS system expansion (zero new dependencies)

## Context

Gabay Prototype is React 19 + TypeScript + Vite + Tailwind, local-first. `src/index.css` already defines keyframes (`fadeIn`, `fadeOut`, `fadeInUp`, `scaleIn`, `scaleOut`, `slideInRight`, `slideOutRight`, `dropdownOpen`) and utilities (`animate-fade-in`, `animate-fade-out`, `animate-fade-in-up`, `animate-scale-in/out`, `animate-slide-in/out-right`, `animate-dropdown`). `src/hooks/useModalAnimate.ts` already coordinates modal exit (sets `isClosing`, delays `onClose` ~200ms). Many surfaces use enter animations + `transition-colors`/`transition-all` on hover, but page/tab switches in `src/App.tsx` are instant conditional renders with no exit, and modal/drawer/dropdown exit coverage is inconsistent.

User request: add animation on every appearance and disappearance to make everything smooth, e.g. navigations. Clarified decisions:
- Scope: everything, globally.
- Style: fast and subtle (150-250ms).
- Exits: yes, with ~150-200ms unmount delay + respect `prefers-reduced-motion`.

## Goals / Non-goals

Goals:
- Every mount animates in fast + subtle; every unmount animates out (no instant pops) on key surfaces.
- Navigation switches feel smooth (crossfade/slide, no flash).
- One consistent motion language, transform/opacity only.
- Accessible: `prefers-reduced-motion: reduce` forces instant.

Non-goals:
- No new animation library (no framer-motion).
- No bouncy/springy or long cinematic transitions.
- No data, API, or persistence changes. Purely presentational.
- No per-item physics or layout-animating drag/reorder.

## §1 — Motion foundation (approved)

Extend `src/index.css`:
- Tokens: `--motion-fast: 150ms`, `--motion-base: 200ms`, `--motion-slow: 250ms`; easing `cubic-bezier(0.16, 1, 0.3, 1)` for enter, `cubic-bezier(0.4, 0, 0.2, 1)` for exit.
- Primitives (enter + exit pairs, transform/opacity only):
  - fade (opacity 0<->1)
  - fade-up (opacity + translateY 12px -> 0; exit reverse)
  - scale (opacity + scale 0.97 -> 1; exit reverse)
  - slide-right (drawers: translateX 100% / 24px -> 0; exit reverse)
  - dropdown (existing `dropdownOpen` + new `dropdownClose`)
- Stagger: `--i` custom property, `animation-delay: calc(var(--i, 0) * 30ms)`, cap at 6 items (later items get `--i: 5`).
- Utilities naming: keep existing `animate-*` names; add `animate-enter-*` / `animate-exit-*` aliases only if needed to avoid breaking current classes.
- Reduced motion: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`.

Self-review: no TBD; distances fixed at 12px/0.97 to stay subtle; durations bounded 150-250ms.

## §2 — Coverage (approved)

1. PageTransition wrapper (`src/App.tsx`):
   - New small component `<PageTransition pageKey={currentTab + ':' + courseSubTab}>` wrapping the page canvas div.
   - `key={pageKey}` remount triggers enter (`animate-fade-in-up`-class, ~200ms).
   - Crossfade on switch: keep previous child mounted 150ms with exit class before swapping (timer + cleanup; fast-switch safe by clearing timer).
   - Applies to all `currentTab` views (dashboard, courses, calendar, inbox, gabay-rag, profile, history, help, accounts, etc.).
2. Overlays (standardize on `useModalAnimate` exit pattern, 150-180ms):
   - `ModalPortal` / `AnimatedModal`, `CalendarEventFormDialog`, `GlobalSearchDialog`, `RoleSwitcherModal`, `SpeedGraderModal`, `UserProfileModal`, `FilePickerModal`, `AlertModal`, `JoinCourseModal`.
   - Drawers: `HistoryDrawer`, `HelpDrawer`, mobile sidebar backdrop + panel in `App.tsx`, `LMSContextPanel` mobile drawer.
   - Dropdowns/panels: `Topbar` profile menu, `NotificationBell` panel, `CalendarPage` dropdowns, `AddModuleItemPage` / create-page dropdowns (enter already `animate-dropdown`; add exit via delayed unmount).
   - Where a component already uses `useModalAnimate`, keep it; where it unmounts instantly, wrap close path with the same hook.
3. Lists/cards stagger (enter only, no exit delay to avoid list lag):
   - Feeds: `AnnouncementsView`, `ModulesView`, `InboxPage`, `PeopleView`, `ActivitiesView`, `AssignmentsView`, `QuizzesView`, `FilesView`, `DashboardPage` cards.
   - Apply `style={{ '--i': Math.min(idx, 5) }}` + stagger utility.
4. Sidebar/nav micro-motion:
   - `AppRail` active pill + `LMSContextPanel` items: keep existing `transition-colors`, add `transition-transform` slide for active indicator; mobile drawer uses slide-right pair.

Explicitly out: exit stagger on list filtering (enter-only), layout animation on reorder, route-level code splitting.

## §3 — Behavior, edge cases, verification (approved)

Behavior:
- Enter: fire on mount, once, no re-trigger on re-render (key-driven only).
- Exit: `startClose` -> `isClosing=true` swaps enter class for exit class -> timer (150-180ms) -> `onClose`/unmount + reset. Timer cleanup on unmount; re-entrant `startClose` ignored while closing.
- Fast tab switching: PageTransition clears pending swap timer before scheduling a new one; never shows two pages longer than 150ms.
- Performance: only `opacity`/`transform` animated; no `blur` transitions; mobile drawer uses `translate3d`.
- Accessibility: reduced-motion forces instant show/hide; focus management unchanged; no animation blocks pointer events beyond the exit window.

Verification:
- `npx tsc --noEmit --skipLibCheck` + `npm run lint` (oxlint) pass.
- Manual matrix: (a) tab/nav switch both directions, (b) modal open/close incl. ESC/backdrop, (c) mobile drawer open/close, (d) dropdown open/close + outside-click, (e) list render + search filter, (f) OS reduced-motion on -> instant.
- No unit tests (presentational only); existing vitest suites must stay green.

## Files touched (implementation plan scope)

- Modify: `src/index.css` (tokens, exit keyframes, stagger, reduced-motion).
- Add: `src/components/common/PageTransition.tsx` (or inline in `App.tsx` if smaller), possibly `src/hooks/useExitDelay.ts` generalizing `useModalAnimate` (or reuse hook as-is).
- Modify: `src/App.tsx` (wrap canvas, animate sidebar/backdrop).
- Modify (standardize exits): `Topbar.tsx`, `NotificationBell.tsx`, `HistoryDrawer.tsx`, `HelpDrawer.tsx`, `GlobalSearchDialog.tsx`, `ModalPortal.tsx` consumers, `CalendarEventFormDialog.tsx`, create-page dropdowns.
- Modify (stagger enter): `AnnouncementsView.tsx`, `ModulesView.tsx`, `InboxPage.tsx`, `PeopleView.tsx`, `ActivitiesView.tsx`, `DashboardPage.tsx` (+ siblings as needed).
- No changes to `LMSContext`, types, API, or persistence.

## Risks

- Over-animating lists (too many staggered items feels laggy) -> mitigated by 30ms step + 6-item cap + enter-only.
- Exit delays feeling sluggish on fast navigation -> mitigated by 150ms max + instant under reduced-motion.
- Inconsistent exit wiring across many dropdowns -> mitigated by one shared hook + one dropdown exit class.
