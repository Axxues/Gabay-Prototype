# Task 6 brief — Dashboard + CoursesPage reskin

Single source of requirements. Follow exactly.

**Files:**
- Modify: `src/pages/DashboardPage.tsx`, `src/pages/CoursesPage.tsx`
- Test: typecheck PASS + build PASS + search proof + dev visual

**Interfaces (unchanged):**
- `CoursesPage` props `{ initialSubTab?: string }` — `App.tsx` passes `courseSubTab`. Keep `subTab` state + `returnToTab/selectedAssignmentId/selectedQuizId` + `JoinCourseModal` logic identical.
- `DashboardPage` props `{ onNavigateCourse, onNavigateTab }` — keep all `db` logic, `openSpeedGrader`, join/create handlers identical.

**CoursesPage surgery (exact):**
1. Read the file in the worktree. Delete the entire inner left `<nav className="w-full md:w-60 ...">...</nav>` block: course-select dropdown (`Active Subject Shell` label), join-code badge (`Course Join Code`), summary card (`activeCourse.code ... section`), and `Course Navigation Items` (`Course Navigation` label + `courseTabs.map`). The pass criterion: `Select-String 'Active Subject Shell|Course Navigation|Active Subject' src/pages/CoursesPage.tsx` returns NOTHING after.
2. Remove now-unused imports/state it leaves behind: `useRef/useEffect` (dropdown outside-click), `ChevronDown, Check, Copy, KeyRound` icons if unused elsewhere, `isCourseDropdownOpen, isJoinModalOpen?` — KEEP `isJoinModalOpen` + `JoinCourseModal` (students still join via Dashboard; keep the modal mounted). KEEP `copiedCode` only if join badge remains — it won't, so delete `copiedCode` state. Keep `useLMS` fields actually used (`activeCourseId, setActiveCourseId?, db, activeRole, activeUser` — drop `setActiveCourseId` if the dropdown was its only user; the panel now owns switching).
3. Outer wrapper stays `<div className="flex flex-col md:flex-row h-full overflow-hidden">` → replace with `<div className="flex h-full flex-col overflow-hidden">` (no more inner sidebar row). Main content `<main className="flex-1 h-full p-6 overflow-y-auto bg-background custom-scrollbar">` stays.
4. At top of `<main>`, add mobile chip scroller (visible below md, since panel is hidden on small screens... actually panel shows in drawer; chips are a shortcut — keep per plan):
```tsx
import { COURSE_CHILDREN, isVisible } from '../config/navigation';
// inside main, before subTab views:
<div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
  {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(tab => (
    <button key={tab.id} type="button" onClick={() => { setSubTab(tab.id); setReturnToTab(null); }} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold cursor-pointer ${subTab === tab.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border'}`}>{tab.label}</button>
  ))}
</div>
```
5. Add `<PageHeader title={`${activeCourse?.code ?? 'Course'} — ${subTab}`} description={activeCourse?.title} />` above the views (import from `../components/common/PageHeader`). Keep all 8 subTab view branches byte-identical below it.

**DashboardPage reskin (exact, logic untouched):**
1. Import `PageHeader`, `EmptyState`.
2. Replace the `My Courses` header row (`<h2 ...><BookOpen/> My Courses</h2>` + buttons + count) with `<PageHeader title="My Courses" description="Your enrolled course shells" actions={<>...same Join/Create buttons + count badge...</>} />` — same buttons/handlers, just moved into `actions`.
3. Replace the `No Enrolled Courses` empty div with `<EmptyState icon={<BookOpen className="h-6 w-6" />} title="No Enrolled Courses" body={same role-dependent text} actionLabel={activeRole === 'student' ? 'Enter Course Join Code' : undefined} onAction={activeRole === 'student' ? () => setIsJoinModalOpen(true) : undefined} />`.
4. Course card: change cover `h-24` → `h-20`, keep color/image/code/title logic identical; card body + footer logic identical.
5. Widgets (To-Do, Feedback, To-Grade, System Overview): keep ALL logic/handlers; only ensure outer containers use `rounded-xl border border-border bg-card p-5 shadow-subtle` (they already do — change only if a container deviates).

Steps:
- [ ] Step 1: `Select-String 'Active Subject Shell' src/pages/CoursesPage.tsx` → FOUND (proves live check).
- [ ] Step 2: record hit.
- [ ] Step 3: implement both files per above.
- [ ] Step 4: typecheck PASS + build PASS + re-run search → NO match + dev visual (dashboard + panel-driven course tabs).
- [ ] Step 5: `git add src/pages/DashboardPage.tsx src/pages/CoursesPage.tsx` + `git commit -m "feat: reskin dashboard and course canvas"`.
