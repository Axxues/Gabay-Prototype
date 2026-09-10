# Task 7 brief — Remaining pages + modals + login + final verification

Single source of requirements. This is a batch of same-shape small reskins — one implementer, one review.

**Files (modify only, no creates, no deletes):**
Content pages: `src/pages/CalendarPage.tsx`, `src/pages/InboxPage.tsx`, `src/pages/ModulesView.tsx`, `src/pages/SyllabusView.tsx`, `src/pages/AssignmentsView.tsx`, `src/pages/QuizzesView.tsx`, `src/pages/FilesView.tsx`, `src/components/grading/FacultyGradebook.tsx`, `src/components/grading/StudentGradebook.tsx`, `src/pages/PeopleView.tsx`, `src/pages/AnnouncementsView.tsx`, `src/pages/ProfilePage.tsx`, `src/pages/HistoryPage.tsx`, `src/pages/HelpPage.tsx`, `src/pages/ManageAccountsPage.tsx`, `src/pages/LoginPage.tsx`
Dialogs: `src/components/common/JoinCourseModal.tsx`, `src/components/common/RoleSwitcherModal.tsx`, `src/components/common/GlobalSearchDialog.tsx`, `src/components/common/HistoryDrawer.tsx`, `src/components/common/UserProfileModal.tsx`, `src/components/grading/SpeedGraderModal.tsx` (+ `AlertModal.tsx` outer chrome only if trivially safe; skip if risky)
Also: fix stale comment `src/components/common/ModalPortal.tsx:11` (`including TopNavbar and GlobalSidebar` → `including Topbar, rail and context panel`).

**Reskin rules (chrome only, logic frozen):**
1. Each content page: add at top `<PageHeader title="<Existing page title>" description="<one-line existing subtitle or omit>" actions={<existing primary button(s) moved here>} />` (import from `../components/common/PageHeader` or `../../components/common/PageHeader` for grading/). Do NOT rename titles, do NOT move handlers, do NOT change `db`/state calls.
2. Bespoke empty states (`No ... yet` divs) → `<EmptyState title body actionLabel? onAction? />` with IDENTICAL copy; keep the same action handler.
3. Leave lists/forms/rows logic as-is (do NOT force-convert every row to ListRow — only use ListRow where it's a drop-in; never restructure data flow).
4. Each dialog: replace ONLY the outer overlay wrapper (`fixed inset-0 ...` + panel div + header with X) with `<DialogFrame title="<existing dialog title>" subtitle? onClose={<existing close>} footer={<existing footer buttons>}>` keeping ALL inner form/list code byte-identical. If a dialog's structure makes DialogFrame unsafe (custom positioning, nested modals), SKIP it and note in report — chrome consistency is desired, breakage is not.
5. `LoginPage.tsx`: center existing form: outer `<div className="min-h-screen bg-muted flex items-center justify-center p-4">` + inner card `<div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elevated">`. No auth logic change.
6. `ModalPortal.tsx:11` comment fix (one line).

**Verification:**
- Baseline: `powershell -Command "Get-ChildItem src/pages/*.tsx | Select-String -Pattern 'PageHeader' | Measure-Object | Select-Object -ExpandProperty Count"` — record number before.
- After: same count must be ≥10 AND `npm run typecheck` PASS AND `npm run build` PASS.
- Confirm no `GlobalSidebar|TopNavbar` code references remain outside comments (grep).

Steps:
- [ ] Step 1: baseline PageHeader count.
- [ ] Step 2: record it.
- [ ] Step 3: implement reskins per rules (skip unsafe dialogs, note them).
- [ ] Step 4: verify (count ≥10, typecheck, build, grep).
- [ ] Step 5: `git add src/pages src/components/common src/components/grading` + `git commit -m "feat: reskin remaining pages and dialogs"`.
