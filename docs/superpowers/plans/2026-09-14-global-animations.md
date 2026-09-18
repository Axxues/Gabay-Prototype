# Global Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fast-subtle appear/disappear animations everywhere, starting with navigation tabs.

**Architecture:** Pure CSS expansion in `src/index.css` (transform/opacity only, 150-220ms) plus two small React primitives: `PageTransition` (keyed crossfade for tab switches) and reuse of `AnimatedModal`/`useModalAnimate` for exits. No new dependencies.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v3; existing `index.css` keyframes; `vitest` stays green.

**Spec:** `docs/superpowers/specs/2026-09-14-global-animations-design.md`

## Global Constraints

- No new dependencies (no framer-motion).
- Durations 150-250ms max; easing enter `cubic-bezier(0.16,1,0.3,1)`, exit `cubic-bezier(0.4,0,0.2,1)`.
- Animate transform/opacity only; no blur transitions.
- Respect `prefers-reduced-motion: reduce` -> instant.
- No data/API/persistence changes; presentational only.

---

### Task 1: Motion foundation in index.css

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: existing keyframes `fadeIn`, `fadeOut`, `fadeInUp`, `scaleIn`, `scaleOut`, `slideInRight`, `slideOutRight`, `dropdownOpen`.
- Produces: CSS classes `anim-page-enter`, `anim-page-exit`, `anim-stagger-item`, `animate-dropdown-out`, `animate-fade-up-out` + `@media (prefers-reduced-motion: reduce)` rule consumed by Tasks 2-4.

- [ ] **Step 1: Add exit + page + stagger CSS to index.css**

Append after `.animate-dropdown` block (around line 431):

```css
@keyframes fadeUpOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(8px); }
}
@keyframes dropdownClose {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-6px) scale(0.98); }
}
.anim-page-enter { animation: fadeInUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) both; }
.anim-page-exit { animation: fadeUpOut 0.15s cubic-bezier(0.4, 0, 0.2, 1) both; }
.animate-fade-up-out { animation: fadeUpOut 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
.animate-dropdown-out { animation: dropdownClose 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards; transform-origin: top; }
.anim-stagger-item { animation: fadeInUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(min(var(--i, 0), 5) * 30ms); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 2: Verify CSS builds**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS (no output). CSS has no type surface; build check ensures no syntax break via Vite import.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add global motion foundation with exits and reduced-motion"
```

### Task 2: Navigation tab appear/disappear animations

**Files:**
- Create: `src/components/common/PageTransition.tsx`
- Modify: `src/App.tsx:130-132`
- Modify: `src/pages/CoursesPage.tsx:280-377`

**Interfaces:**
- Consumes: `anim-page-enter`, `anim-page-exit` from Task 1.
- Produces: `<PageTransition pageKey: string>` wrapper used by App + CoursesPage.

- [ ] **Step 1: Create PageTransition component**

```tsx
// src/components/common/PageTransition.tsx
import React, { useEffect, useRef, useState } from 'react';

export const PageTransition: React.FC<{ pageKey: string; children: React.ReactNode; className?: string }> = ({ pageKey, children, className }) => {
  const [renderKey, setRenderKey] = useState(pageKey);
  const [renderChildren, setRenderChildren] = useState(children);
  const [exiting, setExiting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; setRenderKey(pageKey); setRenderChildren(children); return; }
    if (pageKey === renderKey) { setRenderChildren(children); return; }
    setExiting(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setRenderKey(pageKey);
      setRenderChildren(children);
      setExiting(false);
    }, 150);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [pageKey, children, renderKey]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <div key={renderKey} className={`${className ?? ''} ${exiting ? 'anim-page-exit' : 'anim-page-enter'}`}>
      {renderChildren}
    </div>
  );
};
```

- [ ] **Step 2: Wrap App.tsx page canvas**

In `src/App.tsx` line 132, wrap the conditional page views with `<PageTransition pageKey={currentTab}>`. Keep the existing container classes on the outer div; put PageTransition inside with `className="w-full"`.

- [ ] **Step 3: Wrap CoursesPage subTab canvas**

In `src/pages/CoursesPage.tsx`, wrap the `{subTab === ...}` block (lines 280-377) with `<PageTransition pageKey={subTab + ':' + activeCourse.id}>`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/PageTransition.tsx src/App.tsx src/pages/CoursesPage.tsx
git commit -m "feat: animate navigation tab appearance and disappearance"
```

### Task 3: Overlays + sidebar + list stagger

**Files:**
- Modify: `src/App.tsx:119-128` (sidebar backdrop + mobile drawer)
- Modify: `src/components/layout/LMSContextPanel.tsx:41-46,114-124` (nav button transitions)
- Modify: `src/pages/AnnouncementsView.tsx`, `src/pages/ModulesView.tsx`, `src/pages/InboxPage.tsx` (stagger)

**Interfaces:**
- Consumes: `anim-stagger-item`, `animate-fade-in/out`, `animate-slide-in/out-right` from Task 1; `AnimatedModal` existing API.
- Produces: no new exports; visual-only class changes.

- [ ] **Step 1: Animate sidebar backdrop + drawer**

In `src/App.tsx`: backdrop div gets `animate-fade-in`; mobile drawer wrapper gets `animate-slide-in-right`.

- [ ] **Step 2: Add transform transition to nav buttons**

In `LMSContextPanel.tsx` buttons, append `transition-all duration-150` to existing classes (both LMS and course nav buttons).

- [ ] **Step 3: Add stagger to feed cards**

In `AnnouncementsView.tsx` map, `ModulesView.tsx` list, `InboxPage.tsx` list: add `anim-stagger-item` class + `style={{ ['--i' as string]: Math.min(idx, 5) }}` on each card root. Type as `React.CSSProperties`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: PASS.
Run: `npm run lint`
Expected: PASS (no new warnings).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/layout/LMSContextPanel.tsx src/pages/AnnouncementsView.tsx src/pages/ModulesView.tsx src/pages/InboxPage.tsx
git commit -m "feat: animate overlays, sidebar, and staggered lists"
```
