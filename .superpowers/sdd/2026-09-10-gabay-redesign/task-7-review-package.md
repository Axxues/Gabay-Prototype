# Review package — Task 7 (BASE 469dc79..HEAD 970507e)

## Commits
- 970507e feat: reskin remaining pages and dialogs

## Stat
- 17 files, +414/−669 (src/pages, src/components/common, src/components/grading)

## Notes
- 12+ pages get PageHeader (count 4 → 28); converted dialogs: Join, Files create-folder, Announcements compose, ManageAccounts create/edit/delete, Syllabus delete + upload-scanner.
- Skipped as DialogFrame-unsafe (brief-allowed): RoleSwitcher, GlobalSearch, HistoryDrawer, UserProfile, SpeedGrader, AlertModal, People enroll, Inbox compose + wide previewers; InboxPage no header (messenger layout).
- typecheck PASS + build PASS. Grep GlobalSidebar|TopNavbar: zero.
- Known concerns in report: EmptyState `body=""` call sites; DialogFrame drops role=dialog + animations; scanner denser at max-w-lg.
- Report: `task-7-report.md`.
