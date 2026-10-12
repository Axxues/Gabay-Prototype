# Feature-Based Frontend Folder Architecture Design

**Date:** 2026-10-12  
**Status:** Approved  
**Scope:** Client workspace (`client/src/`)

---

## 1. Executive Summary

This specification defines the migration of the Gabay LMS frontend from a flat `pages/` and generic `components/` hierarchy to a **domain-driven, feature-based folder architecture**. All components, views, pages, sub-components, and unit/integration tests are co-located within distinct feature folders under `client/src/features/`. Shared UI primitives, global layout shells, context providers, utility functions, and foundational types are centralized under `client/src/shared/`.

---

## 2. Goals & Success Criteria

1. **Feature Encapsulation:** Every major domain in Gabay LMS owns its pages, sub-components, and unit tests in a dedicated folder.
2. **Clean Public API via Barrel Exports:** Each feature folder exports its public pages and components through an `index.ts` file, eliminating deep internal imports from outside callers.
3. **Zero Test Regressions:** All 60 test suites (320 tests) must pass with `npx vitest run`.
4. **Clean Builds:** Zero linter errors with `oxlint` and zero new type errors with `tsc -b`.
5. **Preserved Runtime Functionality:** Navigation, authentication, syllabus editing, grading, assessments, messaging, calendar, and RAG chat function identically before and after restructuring.

---

## 3. Directory Layout Specification

```text
client/src/
├── features/
│   ├── accounts/
│   │   ├── CreateAccountPage.tsx
│   │   ├── EditAccountPage.tsx
│   │   ├── ManageAccountsPage.tsx
│   │   └── index.ts
│   ├── assessments/
│   │   ├── ActivitiesView.tsx
│   │   ├── ActivitiesView.test.tsx
│   │   ├── ActivityRunnerView.tsx
│   │   ├── ActivityRunnerView.test.tsx
│   │   ├── AssessmentsOverviewView.tsx
│   │   ├── AssessmentsOverviewView.test.tsx
│   │   ├── AssignmentsView.tsx
│   │   ├── CreateActivityPage.tsx
│   │   ├── CreateActivityPage.test.tsx
│   │   ├── CreateAssessmentPages.test.tsx
│   │   ├── CreateAssignmentPage.tsx
│   │   ├── CreateExamPage.tsx
│   │   ├── CreateExamPage.test.tsx
│   │   ├── CreatePresentationPage.tsx
│   │   ├── CreateProjectPage.tsx
│   │   ├── CreateQuizPage.tsx
│   │   ├── CreateQuizPage.test.tsx
│   │   ├── DedicatedAssessmentViews.test.tsx
│   │   ├── ExamsView.tsx
│   │   ├── ExamsView.test.tsx
│   │   ├── PresentationsView.tsx
│   │   ├── ProjectsView.tsx
│   │   ├── QuizzesView.tsx
│   │   ├── QuizzesView.test.tsx
│   │   ├── components/
│   │   │   ├── forms/
│   │   │   │   ├── ActivityFormFields.test.ts
│   │   │   │   ├── AssessmentBaseForm.tsx
│   │   │   │   ├── RubricBuilder.tsx
│   │   │   │   └── ...
│   │   │   └── grading/
│   │   │       ├── AssessmentsGrading.test.tsx
│   │   │       ├── FacultyGradebook.tsx
│   │   │       ├── FacultyGradebook.test.tsx
│   │   │       ├── StudentGradebook.tsx
│   │   │       ├── StudentGradebook.test.tsx
│   │   │       ├── SpeedGraderModal.tsx
│   │   │       └── ...
│   │   └── index.ts
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── index.ts
│   ├── calendar/
│   │   ├── CalendarPage.tsx
│   │   ├── CalendarPage.test.tsx
│   │   ├── CreateEventPage.tsx
│   │   ├── components/
│   │   │   ├── EventCalendar.tsx
│   │   │   └── ...
│   │   └── index.ts
│   ├── courses/
│   │   ├── CoursesPage.tsx
│   │   ├── CreateCoursePage.tsx
│   │   ├── PendingRequestsPage.tsx
│   │   ├── PendingRequestsPage.test.tsx
│   │   ├── SectionSelectionPage.tsx
│   │   └── index.ts
│   ├── dashboard/
│   │   ├── DashboardPage.tsx
│   │   ├── DashboardPage.test.tsx
│   │   └── index.ts
│   ├── files/
│   │   ├── FilesView.tsx
│   │   ├── FilesView.test.tsx
│   │   └── index.ts
│   ├── inbox/
│   │   ├── AnnouncementsView.tsx
│   │   ├── AnnouncementsView.test.tsx
│   │   ├── CreateAnnouncementPage.tsx
│   │   ├── CreateAnnouncementPage.test.tsx
│   │   ├── InboxPage.tsx
│   │   ├── InboxPage.test.tsx
│   │   └── index.ts
│   ├── modules/
│   │   ├── AddModuleItemPage.tsx
│   │   ├── ModulesView.tsx
│   │   ├── ModulesView.test.tsx
│   │   └── index.ts
│   ├── people/
│   │   ├── PeopleView.tsx
│   │   ├── PeopleView.test.tsx
│   │   └── index.ts
│   ├── rag/
│   │   ├── GabayRAGPage.tsx
│   │   ├── SourceFilter.test.tsx
│   │   ├── components/
│   │   │   ├── ChatMarkdown.tsx
│   │   │   ├── ChatMarkdown.test.tsx
│   │   │   ├── ChatProgressTimeline.tsx
│   │   │   ├── ChatProgressTimeline.test.tsx
│   │   │   ├── InteractiveChart.tsx
│   │   │   ├── InteractiveChart.test.tsx
│   │   │   └── ...
│   │   └── index.ts
│   ├── syllabus/
│   │   ├── SyllabusView.tsx
│   │   ├── SyllabusView.test.tsx
│   │   ├── components/
│   │   │   ├── SyllabusRevisionBar.tsx
│   │   │   ├── SyllabusRevisionBar.test.tsx
│   │   │   ├── SyllabusEditorDialog.tsx
│   │   │   └── ...
│   │   └── index.ts
│   └── system/
│       ├── EmptyPage.tsx
│       ├── HelpPage.tsx
│       ├── HistoryPage.tsx
│       ├── HistoryPage.test.tsx
│       └── index.ts
├── shared/
│   ├── components/
│   │   ├── common/
│   │   │   ├── AppSkeleton.tsx
│   │   │   ├── GlobalSearchDialog.tsx
│   │   │   ├── PageTransition.tsx
│   │   │   ├── RoleSwitcherModal.tsx
│   │   │   └── ...
│   │   └── layout/
│   │       ├── AppRail.tsx
│   │       ├── AppRail.test.tsx
│   │       ├── LMSContextPanel.tsx
│   │       ├── LMSContextPanel.test.tsx
│   │       ├── Topbar.tsx
│   │       └── ...
│   ├── context/
│   │   ├── LMSContext.tsx
│   │   ├── LMSContext.syllabus.test.tsx
│   │   ├── LMSContext.authReady.test.tsx
│   │   ├── LMSContext.markTabVisited.test.tsx
│   │   ├── LMSContext.gradesRelease.test.tsx
│   │   ├── LMSContext.enrollmentScope.test.tsx
│   │   ├── LMSContext.updateUser.test.tsx
│   │   └── GabayChatContext.tsx
│   ├── hooks/
│   │   ├── useCourseFiles.ts
│   │   ├── useCourseFiles.test.ts
│   │   ├── useChatSessions.ts
│   │   └── useChatSessions.test.ts
│   ├── utils/
│   │   ├── activities.ts
│   │   ├── activities.test.ts
│   │   ├── avatar.ts
│   │   ├── avatar.test.ts
│   │   ├── notifiers.ts
│   │   ├── notifiers.test.ts
│   │   ├── syllabusParser.ts
│   │   ├── syllabusParser.test.ts
│   │   └── ...
│   ├── types/
│   │   ├── lms.ts
│   │   ├── lms.test.ts
│   │   └── ...
│   ├── api/
│   │   ├── client.ts
│   │   ├── client.test.ts
│   │   ├── rag.ts
│   │   ├── rag.test.ts
│   │   ├── syllabus.ts
│   │   └── syllabus.test.ts
│   ├── config/
│   │   ├── routes.ts
│   │   ├── editAccountNavigation.test.ts
│   │   └── ...
│   └── data/
│       └── mockData.ts
├── App.tsx
├── main.tsx
└── index.css
```

---

## 4. Barrel Export Architecture

Every feature folder will expose an `index.ts` file. For example, `client/src/features/syllabus/index.ts`:

```typescript
export { SyllabusView } from './SyllabusView';
export { SyllabusRevisionBar } from './components/SyllabusRevisionBar';
// and any feature-specific subcomponents / types needed outside the feature
```

And `client/src/features/index.ts`:
```typescript
export * from './accounts';
export * from './assessments';
export * from './auth';
export * from './calendar';
export * from './courses';
export * from './dashboard';
export * from './files';
export * from './inbox';
export * from './modules';
export * from './people';
export * from './rag';
export * from './syllabus';
export * from './system';
```

`App.tsx` and context routers can therefore import cleanly:
```typescript
import {
  DashboardPage,
  CoursesPage,
  CalendarPage,
  InboxPage,
  LoginPage,
  ProfilePage,
  HistoryPage,
  HelpPage,
  EmptyPage,
  CreateCoursePage,
  ManageAccountsPage,
  CreateAccountPage,
  EditAccountPage,
  GabayRAGPage,
} from './features';
```

---

## 5. Migration Strategy & Import Path Updates

1. **Step-by-Step Directory Migration:**
   - Create destination folders under `client/src/features/` and `client/src/shared/`.
   - Relocate files by domain slice.
   - Add feature barrel files (`index.ts`).
2. **Update Relative Imports:**
   - Update imports in moved files to reference `../../shared/` or sibling features.
   - Update `App.tsx` and `shared/components/layout/` to use new feature paths.
3. **Remove Empty Legacy Directories:**
   - Clean up old `pages/` and old top-level `components/` once all files are migrated.
4. **Verification Gates:**
   - Run `npx vitest run` -> 60 test suites must pass.
   - Run `npm run typecheck` (`tsc -b`).
   - Run `npm run lint` (`oxlint`).
   - Run `npm run build` (`vite build`).
