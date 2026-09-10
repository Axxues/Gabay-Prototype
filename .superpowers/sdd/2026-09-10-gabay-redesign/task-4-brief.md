# Task 4 brief — Topbar + App rewiring (delete old shell)

Single source of requirements. Follow exactly.

**Files:**
- Create: `src/components/layout/Topbar.tsx` (copy of old `TopNavbar.tsx`, renamed export, sidebar-toggle removed)
- Modify: `src/App.tsx` (replace GlobalSidebar+TopNavbar with AppRail+LMSContextPanel+Topbar; responsive drawer; drop `sidebarCollapsed`)
- Delete: `src/components/layout/GlobalSidebar.tsx`, `src/components/layout/TopNavbar.tsx` via `git rm`
- Test: typecheck PASS + build PASS + dev smoke (login, traverse Dashboard/Courses/Calendar/Inbox, open course Modules→Grades)

**Interfaces:**
- `Topbar` props (exact): `{ currentTab: string; courseTab?: string; onNavigateCourse: (id: string, sub?: string) => void; onSelectCourseTab: (t: string) => void; onNavigateTab: (t: string) => void; onOpenSearch: () => void }`.
- Consumes in `App.tsx`: `AppRail{currentTab,onNavigateTab}`, `LMSContextPanel{currentTab,courseSubTab,onNavigateTab,onSelectCourseTab,onNavigateCourse}`, `useLMS(){activeCourseId,logHistory,isAuthenticated,activeRole}`.

**Topbar construction (exact):**
1. Read `src/components/layout/TopNavbar.tsx` in the worktree.
2. Copy it to `src/components/layout/Topbar.tsx`.
3. Rename `export const TopNavbar` → `export const Topbar` and interface `TopNavbarProps` → `TopbarProps` (keep all fields EXCEPT remove `sidebarOpen` and `setSidebarOpen`).
4. Delete the mobile menu button block (the `<button onClick={() => setSidebarOpen...>` with Menu/X icons). Remove `Menu, X` from lucide imports if now unused. Keep everything else identical: brand GABAY, theme toggle, Cmd+K search, course+section switchers only when `currentTab==='courses'`, history/help buttons, profile dropdown with theme-toggle-mobile, sign-out confirm. No visual restyle beyond the deletion.

**App.tsx rewrite (exact shell):**
1. Replace imports: remove `GlobalSidebar`, `TopNavbar`; add `AppRail`, `LMSContextPanel`, `Topbar`.
2. Remove `sidebarCollapsed` state + `onToggleCollapse` (delete `const [sidebarCollapsed, setSidebarCollapsed] = useState(false);`).
3. Keep `currentTab, courseSubTab, sidebarOpen, searchOpen` states, role-guard effect, Cmd+K effect, `handleNavigateTab`, `handleNavigateCourse`, unauthenticated `LoginPage` return, page-canvas conditionals, and all three global modals unchanged.
4. Replace the `<TopNavbar .../>` element with `<Topbar currentTab={currentTab} courseTab={currentTab === 'courses' ? courseSubTab : undefined} onNavigateCourse={handleNavigateCourse} onSelectCourseTab={(tab) => { setCourseSubTab(tab); logHistory(`/lms/courses/${activeCourseId}/${tab}`, `LMS > Course > ${tab}`); }} onNavigateTab={handleNavigateTab} onOpenSearch={() => setSearchOpen(true)} />`.
5. Replace the sidebar `<div className="w-0 ..."><GlobalSidebar .../></div>` block with:
```tsx
<div className="hidden lg:flex"><AppRail currentTab={currentTab} onNavigateTab={handleNavigateTab} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={handleNavigateTab} onSelectCourseTab={(t) => setCourseSubTab(t)} onNavigateCourse={handleNavigateCourse} /></div>
{sidebarOpen && <div className="fixed left-0 top-16 bottom-0 z-20 flex lg:hidden"><AppRail currentTab={currentTab} onNavigateTab={(t) => { handleNavigateTab(t); setSidebarOpen(false); }} /><LMSContextPanel currentTab={currentTab} courseSubTab={courseSubTab} onNavigateTab={(t) => { handleNavigateTab(t); setSidebarOpen(false); }} onSelectCourseTab={(t) => { setCourseSubTab(t); setSidebarOpen(false); }} onNavigateCourse={(id, sub) => { handleNavigateCourse(id, sub); setSidebarOpen(false); }} /></div>}
```
6. The mobile hamburger lives in `Topbar`? No — brief keeps Topbar without sidebar toggle; instead add a small hamburger button in `App.tsx` above main? NO — keep `sidebarOpen` toggled from a button rendered in the Topbar? Decision: add hamburger inside `Topbar.tsx` as a new `onToggleSidebar: () => void` prop? NO — freeze scope: Topbar gets NO sidebar props; instead `App.tsx` renders a floating mobile button `<button className="lg:hidden fixed bottom-4 left-4 z-30 ..." onClick={() => setSidebarOpen(true)}>Menu</button>` only when `!sidebarOpen`. Keep simple, no new deps.

Wait — simpler and cleaner, ruling: add the hamburger INTO Topbar via optional prop `onOpenSidebar?: () => void` rendered only on mobile (`lg:hidden`), keeping Topbar's required props exactly as specified. If `onOpenSidebar` absent, no button. `App.tsx` passes `onOpenSidebar={() => setSidebarOpen(true)}`. This preserves mobile access without resurrecting sidebar state in Topbar. Implement this (one optional prop beyond the exact list, documented here).

7. Delete old files: `git rm src/components/layout/GlobalSidebar.tsx src/components/layout/TopNavbar.tsx`.

Steps:
- [ ] Step 1: read TopNavbar + App in worktree.
- [ ] Step 2: `npm run typecheck` baseline.
- [ ] Step 3: implement Topbar + App shell + `git rm` olds.
- [ ] Step 4: typecheck PASS + build PASS + `npm run dev` smoke (login traverse).
- [ ] Step 5: `git add src/components/layout/Topbar.tsx src/App.tsx` (+ deletions staged) + `git commit -m "feat: rewire shell to rail+panel+topbar"`.
