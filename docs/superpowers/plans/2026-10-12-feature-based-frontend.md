# Feature-Based Frontend Folder Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Gabay LMS frontend from a flat `pages/` and generic `components/` hierarchy into a domain-driven, feature-based folder architecture (`src/features/` + `src/shared/`) with barrel exports and complete test coverage preservation.

**Architecture:** Encapsulate features into domain slices (`auth`, `accounts`, `courses`, `syllabus`, `modules`, `assessments`, `calendar`, `inbox`, `people`, `files`, `rag`, `dashboard`, `system`) with co-located components, pages, and tests. Centralize foundational UI primitives, layout wrappers, contexts, hooks, utilities, and types under `src/shared/`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Router v7.

**Spec:** [`docs/superpowers/specs/2026-10-12-feature-based-frontend-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-12-feature-based-frontend-design.md)

## Global Constraints
- Target workspace: `client/`
- Maintain 100% test pass rate across all 60 test suites (320 tests) using `npx vitest run`.
- Preserve all existing export names and component behaviors.
- Each feature folder must contain an `index.ts` barrel file exposing its public API.
- Zero lint errors with `oxlint` (`npm run lint`).
- Clean production build with `npm run build`.

---

### Task 1: Scaffolding `src/shared/` and Migrating Primitives

**Files:**
- Create:
  - `client/src/shared/index.ts`
  - `client/src/shared/components/layout/index.ts`
  - `client/src/shared/components/common/index.ts`
- Move & Modify:
  - `client/src/types/` -> `client/src/shared/types/`
  - `client/src/utils/` -> `client/src/shared/utils/`
  - `client/src/config/` -> `client/src/shared/config/`
  - `client/src/api/` -> `client/src/shared/api/`
  - `client/src/data/` -> `client/src/shared/data/`
  - `client/src/hooks/` -> `client/src/shared/hooks/`
  - `client/src/context/` -> `client/src/shared/context/`
  - `client/src/components/layout/` -> `client/src/shared/components/layout/`
  - `client/src/components/common/` -> `client/src/shared/components/common/`

- [ ] **Step 1: Move foundational directories into `src/shared/`**
  Move directories: `types`, `utils`, `config`, `api`, `data`, `hooks`, `context`, `components/layout`, `components/common` into `src/shared/`.

- [ ] **Step 2: Update internal relative imports within `src/shared/`**
  Update cross-references between `shared/utils`, `shared/context`, `shared/hooks`, `shared/components`.

- [ ] **Step 3: Create barrel files in `src/shared/`**
  Create `src/shared/components/layout/index.ts`, `src/shared/components/common/index.ts`, and `src/shared/index.ts`.

- [ ] **Step 4: Run shared tests to verify integrity**
  Run: `npx vitest run src/shared/`
  Expected: PASS for all context, hook, util, and layout tests.

---

### Task 2: Auth, Accounts, and System Feature Slices

**Files:**
- Create:
  - `client/src/features/auth/index.ts`
  - `client/src/features/accounts/index.ts`
  - `client/src/features/system/index.ts`
- Move & Modify:
  - `client/src/pages/LoginPage.tsx` -> `client/src/features/auth/LoginPage.tsx`
  - `client/src/pages/ProfilePage.tsx` -> `client/src/features/auth/ProfilePage.tsx`
  - `client/src/pages/CreateAccountPage.tsx` -> `client/src/features/accounts/CreateAccountPage.tsx`
  - `client/src/pages/EditAccountPage.tsx` -> `client/src/features/accounts/EditAccountPage.tsx`
  - `client/src/pages/ManageAccountsPage.tsx` -> `client/src/features/accounts/ManageAccountsPage.tsx`
  - `client/src/pages/EmptyPage.tsx` -> `client/src/features/system/EmptyPage.tsx`
  - `client/src/pages/HelpPage.tsx` -> `client/src/features/system/HelpPage.tsx`
  - `client/src/pages/HistoryPage.tsx` -> `client/src/features/system/HistoryPage.tsx`
  - `client/src/pages/HistoryPage.test.tsx` -> `client/src/features/system/HistoryPage.test.tsx`

- [ ] **Step 1: Move files into `features/auth/`, `features/accounts/`, `features/system/`**
  Relocate auth, accounts, and system pages.

- [ ] **Step 2: Update import paths to reference `src/shared/`**
  Adjust relative imports for contexts, components, and types to `../../shared/...`.

- [ ] **Step 3: Create feature barrel exports**
  Create `index.ts` in each feature exporting the page components.

- [ ] **Step 4: Run tests for these features**
  Run: `npx vitest run src/features/system/ src/shared/config/editAccountNavigation.test.ts`
  Expected: PASS

---

### Task 3: Dashboard, Courses, People, and Files Feature Slices

**Files:**
- Create:
  - `client/src/features/dashboard/index.ts`
  - `client/src/features/courses/index.ts`
  - `client/src/features/people/index.ts`
  - `client/src/features/files/index.ts`
- Move & Modify:
  - `client/src/pages/DashboardPage.tsx` -> `client/src/features/dashboard/DashboardPage.tsx`
  - `client/src/pages/DashboardPage.test.tsx` -> `client/src/features/dashboard/DashboardPage.test.tsx`
  - `client/src/pages/CoursesPage.tsx` -> `client/src/features/courses/CoursesPage.tsx`
  - `client/src/pages/CreateCoursePage.tsx` -> `client/src/features/courses/CreateCoursePage.tsx`
  - `client/src/pages/SectionSelectionPage.tsx` -> `client/src/features/courses/SectionSelectionPage.tsx`
  - `client/src/pages/PendingRequestsPage.tsx` -> `client/src/features/courses/PendingRequestsPage.tsx`
  - `client/src/pages/PendingRequestsPage.test.tsx` -> `client/src/features/courses/PendingRequestsPage.test.tsx`
  - `client/src/pages/PeopleView.tsx` -> `client/src/features/people/PeopleView.tsx`
  - `client/src/pages/PeopleView.test.tsx` -> `client/src/features/people/PeopleView.test.tsx`
  - `client/src/pages/FilesView.tsx` -> `client/src/features/files/FilesView.tsx`
  - `client/src/pages/FilesView.test.tsx` -> `client/src/features/files/FilesView.test.tsx`

- [ ] **Step 1: Move files to their respective feature folders**
  Relocate dashboard, courses, people, and files pages and tests.

- [ ] **Step 2: Update import paths**
  Fix relative imports to `../../shared/` and sibling features.

- [ ] **Step 3: Create barrel files in each feature**
  Export public pages and components from `index.ts`.

- [ ] **Step 4: Run tests for these features**
  Run: `npx vitest run src/features/dashboard/ src/features/courses/ src/features/people/ src/features/files/`
  Expected: PASS

---

### Task 4: Syllabus, Modules, and Calendar Feature Slices

**Files:**
- Create:
  - `client/src/features/syllabus/index.ts`
  - `client/src/features/modules/index.ts`
  - `client/src/features/calendar/index.ts`
- Move & Modify:
  - `client/src/pages/SyllabusView.tsx` -> `client/src/features/syllabus/SyllabusView.tsx`
  - `client/src/pages/SyllabusView.test.tsx` -> `client/src/features/syllabus/SyllabusView.test.tsx`
  - `client/src/components/syllabus/*` -> `client/src/features/syllabus/components/*`
  - `client/src/pages/ModulesView.tsx` -> `client/src/features/modules/ModulesView.tsx`
  - `client/src/pages/ModulesView.test.tsx` -> `client/src/features/modules/ModulesView.test.tsx`
  - `client/src/pages/AddModuleItemPage.tsx` -> `client/src/features/modules/AddModuleItemPage.tsx`
  - `client/src/pages/CalendarPage.tsx` -> `client/src/features/calendar/CalendarPage.tsx`
  - `client/src/pages/CalendarPage.test.tsx` -> `client/src/features/calendar/CalendarPage.test.tsx`
  - `client/src/pages/CreateEventPage.tsx` -> `client/src/features/calendar/CreateEventPage.tsx`
  - `client/src/components/calendar/*` -> `client/src/features/calendar/components/*`

- [ ] **Step 1: Move syllabus, modules, and calendar files**
  Relocate views, subcomponents, and test files into the feature directories.

- [ ] **Step 2: Update import paths**
  Adjust relative imports for syllabus editor dialogs, revision bars, calendar components, and shared helpers.

- [ ] **Step 3: Create feature barrel exports**
  Export `SyllabusView`, `ModulesView`, `AddModuleItemPage`, `CalendarPage`, `CreateEventPage` in `index.ts`.

- [ ] **Step 4: Run tests for syllabus, modules, and calendar**
  Run: `npx vitest run src/features/syllabus/ src/features/modules/ src/features/calendar/`
  Expected: PASS

---

### Task 5: Assessments & Communications (Inbox/Announcements)

**Files:**
- Create:
  - `client/src/features/assessments/index.ts`
  - `client/src/features/inbox/index.ts`
- Move & Modify:
  - `client/src/pages/ActivitiesView.tsx` & `.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/ActivityRunnerView.tsx` & `.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/AssessmentsOverviewView.tsx` & `.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/AssignmentsView.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/CreateActivityPage.tsx` & `.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/CreateAssessmentPages.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/CreateAssignmentPage.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/CreateExamPage.tsx` & `.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/CreatePresentationPage.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/CreateProjectPage.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/CreateQuizPage.tsx` & `.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/DedicatedAssessmentViews.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/ExamsView.tsx` & `.test.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/PresentationsView.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/ProjectsView.tsx` -> `client/src/features/assessments/`
  - `client/src/pages/QuizzesView.tsx` & `.test.tsx` -> `client/src/features/assessments/`
  - `client/src/components/forms/*` -> `client/src/features/assessments/components/forms/*`
  - `client/src/components/grading/*` -> `client/src/features/assessments/components/grading/*`
  - `client/src/pages/InboxPage.tsx` & `.test.tsx` -> `client/src/features/inbox/`
  - `client/src/pages/AnnouncementsView.tsx` & `.test.tsx` -> `client/src/features/inbox/`
  - `client/src/pages/CreateAnnouncementPage.tsx` & `.test.tsx` -> `client/src/features/inbox/`

- [ ] **Step 1: Move assessment and communications files**
  Relocate all assessment views, grading subcomponents, form fields, and inbox/announcement files.

- [ ] **Step 2: Update import paths**
  Fix relative imports across grading modals, forms, and tests.

- [ ] **Step 3: Create feature barrel exports**
  Export assessment views, SpeedGraderModal, gradebooks, and inbox views.

- [ ] **Step 4: Run tests for assessments and inbox**
  Run: `npx vitest run src/features/assessments/ src/features/inbox/`
  Expected: PASS

---

### Task 6: RAG Chat Feature, Root Barrels, App Routing & Final Verification

**Files:**
- Create:
  - `client/src/features/rag/index.ts`
  - `client/src/features/index.ts`
- Move & Modify:
  - `client/src/pages/GabayRAGPage.tsx` -> `client/src/features/rag/GabayRAGPage.tsx`
  - `client/src/pages/SourceFilter.test.tsx` -> `client/src/features/rag/SourceFilter.test.tsx`
  - `client/src/components/rag/*` -> `client/src/features/rag/components/*`
  - `client/src/App.tsx` (update imports to `./features` and `./shared`)
  - Remove empty `client/src/pages/` and `client/src/components/` directories.

- [ ] **Step 1: Move RAG Chat files into `features/rag/`**
  Relocate `GabayRAGPage.tsx`, `SourceFilter.test.tsx`, and `components/rag/*`.

- [ ] **Step 2: Create root features barrel `src/features/index.ts`**
  Re-export all features cleanly.

- [ ] **Step 3: Update `App.tsx` and remaining global consumers**
  Update imports in `App.tsx` to reference `features` and `shared`.

- [ ] **Step 4: Clean up obsolete folders**
  Remove empty `pages/` and legacy `components/` folders.

- [ ] **Step 5: Run full verification suite**
  1. `npx vitest run` -> Verify all 60 test files and 320 tests PASS.
  2. `npm run typecheck` (`tsc -b`) -> Verify zero type errors.
  3. `npm run lint` (`oxlint`) -> Verify zero lint errors.
  4. `npm run build` -> Verify clean Vite production bundle.
