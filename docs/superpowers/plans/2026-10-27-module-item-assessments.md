# Module Item Assessments Resource Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include all assessment types (Activity, Quiz, Assignment, Project, Presentation) as resource types when adding items to a module, rename Activity Milestone to Activity and Assessment Quiz to Quiz, remove the External Reference Link option, and connect module navigation directly to dedicated assessment views.

**Architecture:** Extend `ModuleItem['type']` with `'assignment' | 'project' | 'presentation'`, update `RESOURCE_TYPES` in `AddModuleItemPage.tsx` to author assignments/projects/presentations via `ActivityFormFields` with their respective `assessmentType`, and extend `ModulesView.tsx` and `CoursesPage.tsx` to route item clicks to their dedicated assessment tabs (`assignments`, `projects`, `presentations`).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide icons, Vitest, Testing Library.

**Spec:** User request from 2026-10-27: Include all assessments in Add Item to Module resource types, rename "Activity milestone" -> "Activity", rename "Assessment quiz" -> "Quiz", remove "External reference link" (`external_url`), render assessment authoring inline directly in the module form, and navigate directly to their assessment views.

## Global Constraints
- Domain-driven encapsulation: feature elements remain within `features/modules/`, `features/courses/`, or `features/assessments/`.
- No regression on existing module item types (`page`, `file`, `activity`, `quiz`).
- Remove `external_url` from `RESOURCE_TYPES` without crashing if historical data contains legacy `external_url` items.

## Review Focus
1. `RESOURCE_TYPES` array in `AddModuleItemPage.tsx` contains Page, Handout, Activity, Quiz, Assignment, Project, Presentation, and no `external_url`.
2. Saving an Assignment, Project, or Presentation invokes `createActivity` with `assessmentType: 'assignment' | 'project' | 'presentation'` and adds the module item with matching `type` and `activityId`.
3. Selecting an Assignment/Project/Presentation module item in `ModulesView` navigates to the respective tab with the item ID selected.
4. Editing an existing Assignment, Project, or Presentation item from a module pre-populates `ActivityFormFields` from the linked activity record.
5. Cross-section replication properly replicates the assessment item across selected course sections.

---

### Task 1: Update ModuleItem Types & Module Item Icons/Labels

**Files:**
- Modify: `client/src/shared/types/lms.ts:214`
- Modify: `client/src/features/modules/ModulesView.tsx:38-48, 343-365, 685-705`
- Modify: `client/src/features/courses/CoursesPage.tsx:274-290`
- Test: `client/src/features/modules/ModulesView.test.tsx`

- [ ] Add `'assignment' | 'project' | 'presentation'` to `ModuleItem['type']` union in `client/src/shared/types/lms.ts`.
- [ ] Add `onSelectAssignment`, `onSelectProject`, and `onSelectPresentation` to `ModulesViewProps` in `ModulesView.tsx`.
- [ ] Update `getItemIcon` in `ModulesView.tsx` with icons for `assignment` (`FileText`), `project` (`Briefcase`), and `presentation` (`Presentation`).
- [ ] Update `getItemTypeLabel` in `ModulesView.tsx` to capitalize/format `assignment`, `project`, `presentation`.
- [ ] Update `isNavigable` and `onClick` handler in `ModulesView.tsx` to route `assignment`, `project`, and `presentation` clicks to their respective callbacks.
- [ ] Wire `onSelectAssignment`, `onSelectProject`, and `onSelectPresentation` in `CoursesPage.tsx` to set the selected ID, return tab to `'modules'`, and navigate to `'assignments'`, `'projects'`, and `'presentations'`.
- [ ] Run tests to verify module navigation routing.

### Task 2: Update AddModuleItemPage Resource Types & Authoring Form

**Files:**
- Modify: `client/src/features/modules/AddModuleItemPage.tsx:70-115, 270-320, 818-830, 935-1015, 1420-1510`
- Test: `client/src/features/modules/AddModuleItemPage.test.tsx`

- [ ] Update `RESOURCE_TYPES` in `AddModuleItemPage.tsx`:
  - Rename `label: 'Activity milestone'` to `label: 'Activity'`, badge `Activity`.
  - Rename `label: 'Assessment quiz'` to `label: 'Quiz'`, badge `Quiz`.
  - Remove `external_url` (`External reference link`).
  - Add `assignment`: label `Assignment`, badge `Assignment`, icon `FileText`.
  - Add `project`: label `Project`, badge `Project`, icon `Briefcase`.
  - Add `presentation`: label `Presentation`, badge `Presentation`, icon `Presentation`.
- [ ] Define helper `isActivityAssessment(type: string): boolean` (`activity`, `assignment`, `project`, `presentation`).
- [ ] Update form state initialization to prefill `activityForm` if editing an `assignment`, `project`, or `presentation`.
- [ ] Update title validation and pending title calculation in `getPendingItemTitle()`.
- [ ] Update `executeSaveToSections` to create the activity record with `assessmentType: itemType` for `assignment`, `project`, `presentation`, and create the module item with `type: itemType` and `activityId: created.id`.
- [ ] Update rendering in `AddModuleItemPage.tsx` to show `ActivityFormFields` when `itemType` is `activity`, `assignment`, `project`, or `presentation` (keeping mode toggle for `activity` and direct rubric/deadline form for assignment/project/presentation).
- [ ] Hide generic content input and generic file attachment when an assessment resource type is selected.

### Task 3: Comprehensive Test Coverage & Verification

**Files:**
- Create/Modify: `client/src/features/modules/AddModuleItemPage.assessments.test.tsx`
- Run: `npm run test --workspace=client -- src/features/modules/`

- [ ] Write integration test verifying that:
  - The dropdown renders Page, Handout, Activity, Quiz, Assignment, Project, Presentation.
  - The dropdown does NOT contain "External reference link".
  - "Activity milestone" is replaced with "Activity", and "Assessment quiz" is replaced with "Quiz".
  - Selecting "Assignment", "Project", or "Presentation" renders `ActivityFormFields`.
  - Submitting an Assignment/Project/Presentation calls `createActivity` with corresponding `assessmentType` and calls `addModuleItem` with matching `type` and `activityId`.
- [ ] Run full test suite for `features/modules` and verify clean execution.
