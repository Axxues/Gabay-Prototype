# Cross-Section Course Content Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an automatic interstitial option when an instructor uploads a syllabus, creates modules and items, posts announcements, creates assessments, or uploads files, allowing them to replicate the content across all other sections of the same course in the same school year and semester.

**Architecture:** Build a consolidated sibling course discovery utility (`crossSectionSync.ts`) and a shared modal component (`CrossSectionPromptModal.tsx`). Intercept the save/upload triggers across the 6 content creation pages, prompt the instructor if sibling sections exist, and batch-dispatch copies to selected target courses using existing LMSContext CRUD methods with idempotent parent module/folder resolution.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library.

**Spec:** [`docs/superpowers/specs/2026-10-19-cross-section-course-content-sync-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-19-cross-section-course-content-sync-design.md)

## Global Constraints
- Never execute Directus REST API DDL modifications (`/fields`, `/relations`, `/collections`).
- Use existing client application context operations (`createAnnouncement`, `createModule`, `addModuleItem`, `createActivity`, `createQuiz`, `createExam`, `updateCourseSyllabus`, `uploadCourseFile`).
- Sibling discovery requires exact matching on `code` (normalized), `title` (normalized), `schoolYear`, normalized `semester`/`term`, and assigned `instructorId`.
- If an instructor teaches only one section, the modal is completely bypassed and saves execute immediately without any prompt.
- Retain Ponytail efficiency: consolidate modal UI and selection logic in one shared component and utility.

## Review Focus
1. Single-section courses: verify no interstitial modal is shown and save proceeds synchronously.
2. Mismatched semester or school year: verify courses from different school years or semesters are strictly excluded from sibling discovery.
3. Module items with linked assessments: verify cloned module items in target sections point to newly cloned assessment IDs, not the original section's assessment ID.
4. Idempotent module resolution: verify cross-posting a module item to a target section reuses an existing module if one with the same title already exists.
5. Error resilience: verify failure to save in one target section does not block or erase successful saves in other sections.

---

### Task 1: Sibling Course Discovery Utility & Unit Tests

**Files:**
- Create: `client/src/shared/utils/crossSectionSync.ts`
- Test: `client/src/shared/utils/crossSectionSync.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export function normalizeSemester(termOrSem?: string | null): string;
  export function findMatchingSiblingCourses(
    currentCourse: Course,
    allCourses: Course[],
    activeUserId?: string
  ): Course[];
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/shared/utils/crossSectionSync.test.ts
import { describe, it, expect } from 'vitest';
import { findMatchingSiblingCourses, normalizeSemester } from './crossSectionSync';
import type { Course } from '../types/lms';

describe('crossSectionSync', () => {
  const baseCourse: Course = {
    id: 'c1',
    code: 'CS 101',
    title: 'Data Structures',
    section: 'BSCS 3-1',
    term: '1st Semester',
    schoolYear: '2026-2027',
    instructorId: 'inst-1',
    instructorName: 'Dr. Santos',
    published: true,
    enrolledCount: 30,
  };

  it('normalizes semester strings accurately', () => {
    expect(normalizeSemester('1st Semester')).toBe('1st');
    expect(normalizeSemester('First Sem')).toBe('1st');
    expect(normalizeSemester('2nd Semester')).toBe('2nd');
    expect(normalizeSemester('Summer Midyear')).toBe('summer');
  });

  it('finds matching sibling courses with same code, title, schoolYear, semester, and instructor', () => {
    const sibling: Course = {
      ...baseCourse,
      id: 'c2',
      section: 'BSCS 3-2',
    };
    const diffYear: Course = { ...baseCourse, id: 'c3', section: 'BSCS 3-3', schoolYear: '2025-2026' };
    const diffSem: Course = { ...baseCourse, id: 'c4', section: 'BSCS 3-4', term: '2nd Semester' };
    const diffInst: Course = { ...baseCourse, id: 'c5', section: 'BSCS 3-5', instructorId: 'inst-2' };
    const diffCode: Course = { ...baseCourse, id: 'c6', section: 'BSCS 3-6', code: 'CS 102' };

    const matches = findMatchingSiblingCourses(baseCourse, [baseCourse, sibling, diffYear, diffSem, diffInst, diffCode], 'inst-1');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('c2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test client/src/shared/utils/crossSectionSync.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `normalizeSemester` and `findMatchingSiblingCourses` in `client/src/shared/utils/crossSectionSync.ts`**

Implement semester normalization and filter logic checking code, title, schoolYear, semester, instructorId, and `id !== currentCourse.id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test client/src/shared/utils/crossSectionSync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/utils/crossSectionSync.ts client/src/shared/utils/crossSectionSync.test.ts
git commit -m "feat(courses): add sibling course cross-section discovery utility"
```

---

### Task 2: Reusable Cross-Section Interstitial Modal Component & Unit Tests

**Files:**
- Create: `client/src/shared/components/common/CrossSectionPromptModal.tsx`
- Test: `client/src/shared/components/common/CrossSectionPromptModal.test.tsx`

**Interfaces:**
- Consumes: `findMatchingSiblingCourses` from `crossSectionSync.ts`
- Produces:
  ```typescript
  export interface CrossSectionPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemType: 'syllabus' | 'module' | 'module_item' | 'announcement' | 'assessment' | 'file';
    itemTitle: string;
    siblingCourses: Course[];
    onConfirm: (selectedCourseIds: string[]) => Promise<void>;
    onSkipToCurrentOnly: () => Promise<void>;
    isSubmitting?: boolean;
  }
  export const CrossSectionPromptModal: React.FC<CrossSectionPromptModalProps>;
  ```

- [ ] **Step 1: Write the failing test**

```typescript
// client/src/shared/components/common/CrossSectionPromptModal.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrossSectionPromptModal } from './CrossSectionPromptModal';
import type { Course } from '../../types/lms';

describe('CrossSectionPromptModal', () => {
  const siblings: Course[] = [
    {
      id: 'c2',
      code: 'CS 101',
      title: 'Data Structures',
      section: 'BSCS 3-2',
      term: '1st Semester',
      schoolYear: '2026-2027',
      instructorId: 'inst-1',
      instructorName: 'Dr. Santos',
      published: true,
      enrolledCount: 25,
    },
  ];

  it('renders section options and calls onConfirm with selected course IDs', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSkip = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CrossSectionPromptModal
        isOpen={true}
        onClose={onClose}
        itemType="announcement"
        itemTitle="Exam Guidelines"
        siblingCourses={siblings}
        onConfirm={onConfirm}
        onSkipToCurrentOnly={onSkip}
      />
    );

    expect(screen.getByText(/BSCS 3-2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Post to Selected Sections/i }));
    expect(onConfirm).toHaveBeenCalledWith(['c2']);
  });

  it('calls onSkipToCurrentOnly when clicking post to this section only', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSkip = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CrossSectionPromptModal
        isOpen={true}
        onClose={onClose}
        itemType="announcement"
        itemTitle="Exam Guidelines"
        siblingCourses={siblings}
        onConfirm={onConfirm}
        onSkipToCurrentOnly={onSkip}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Post to This Course Only/i }));
    expect(onSkip).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test client/src/shared/components/common/CrossSectionPromptModal.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `CrossSectionPromptModal` in `client/src/shared/components/common/CrossSectionPromptModal.tsx`**

Build modal utilizing `DialogFrame`, `ModalPortal`, checkboxes for each sibling course with "Select All" toggle, section badges, and action buttons.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test client/src/shared/components/common/CrossSectionPromptModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/components/common/CrossSectionPromptModal.tsx client/src/shared/components/common/CrossSectionPromptModal.test.tsx
git commit -m "feat(ui): create reusable cross-section prompt modal"
```

---

### Task 3: Cross-Section Sync in Announcements (`CreateAnnouncementPage`)

**Files:**
- Modify: `client/src/features/inbox/CreateAnnouncementPage.tsx`
- Test: `client/src/features/inbox/CreateAnnouncementPage.test.tsx`

**Interfaces:**
- Consumes: `findMatchingSiblingCourses`, `CrossSectionPromptModal`
- Calls: `createAnnouncement` on current course and selected sibling courses.

- [ ] **Step 1: Write test covering cross-section announcement creation**

Add test in `CreateAnnouncementPage.test.tsx` verifying that when sibling courses exist, the modal opens on form submit and submitting calls `createAnnouncement` for each selected section.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test client/src/features/inbox/CreateAnnouncementPage.test.tsx`
Expected: FAIL on cross-section test.

- [ ] **Step 3: Integrate `CrossSectionPromptModal` into `CreateAnnouncementPage.tsx`**

In `handleSubmit`:
- Check `findMatchingSiblingCourses(course, db.courses, activeUser?.id)`.
- If sibling courses exist, open modal instead of saving immediately.
- Define `handleConfirmMultiSection` to create announcement for `courseId` and each target ID, then show toast and navigate back.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test client/src/features/inbox/CreateAnnouncementPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/inbox/CreateAnnouncementPage.tsx client/src/features/inbox/CreateAnnouncementPage.test.tsx
git commit -m "feat(announcements): support cross-section announcement replication"
```

---

### Task 4: Cross-Section Sync in Modules & Module Items (`ModulesView` & `AddModuleItemPage`)

**Files:**
- Modify: `client/src/features/modules/ModulesView.tsx`
- Modify: `client/src/features/modules/AddModuleItemPage.tsx`
- Test: `client/src/features/modules/ModulesView.test.tsx`
- Test: `client/src/features/modules/AddModuleItemPage.crossSection.test.tsx`

**Interfaces:**
- Consumes: `findMatchingSiblingCourses`, `CrossSectionPromptModal`
- Calls: `createModule(targetId, title)`, `addModuleItem(targetModId, itemPayload)`

- [ ] **Step 1: Write tests for module and module item cross-section sync**

Create `AddModuleItemPage.crossSection.test.tsx` asserting:
1. Creating a module replicates to selected target sections (reusing existing if title matches).
2. Adding a module item finds or creates the parent module by name in target sections.
3. Clones linked activity/quiz records for target sections and remaps assessment ID.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test client/src/features/modules/AddModuleItemPage.crossSection.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement cross-section sync in `ModulesView.tsx` and `AddModuleItemPage.tsx`**

- In `ModulesView.tsx`: intercept `handleCreateModule` with `CrossSectionPromptModal`. Replicate module title to selected sections with idempotent check.
- In `AddModuleItemPage.tsx`: intercept submit. On confirm, save to current module, and for each selected section, find or create the parent module, clone attached assessment if applicable, and call `addModuleItem`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test client/src/features/modules/AddModuleItemPage.crossSection.test.tsx client/src/features/modules/ModulesView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/modules/ModulesView.tsx client/src/features/modules/AddModuleItemPage.tsx client/src/features/modules/AddModuleItemPage.crossSection.test.tsx
git commit -m "feat(modules): add cross-section duplication for modules and items"
```

---

### Task 5: Cross-Section Sync in Assessments (`CreateActivityPage`, `CreateAssignmentPage`, `CreateQuizPage`, `CreateExamPage`)

**Files:**
- Modify: `client/src/features/assessments/CreateActivityPage.tsx`
- Modify: `client/src/features/assessments/CreateAssignmentPage.tsx`
- Modify: `client/src/features/assessments/CreateQuizPage.tsx`
- Modify: `client/src/features/assessments/CreateExamPage.tsx`
- Test: `client/src/features/assessments/CreateAssessmentPages.test.tsx`

**Interfaces:**
- Consumes: `findMatchingSiblingCourses`, `CrossSectionPromptModal`
- Calls: `createActivity`, `createQuiz`, `createExam` across target course IDs.

- [ ] **Step 1: Write test for assessment cross-section sync**

Add test cases in `CreateAssessmentPages.test.tsx` asserting that creating an assignment, quiz, exam, or activity intercepts with sibling sections and duplicates the payload with respective `courseId: targetId`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test client/src/features/assessments/CreateAssessmentPages.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement cross-section sync in assessment creation pages**

Wire `CrossSectionPromptModal` in `CreateActivityPage.tsx`, `CreateAssignmentPage.tsx`, `CreateQuizPage.tsx`, and `CreateExamPage.tsx`. When confirmed, persist current assessment and replicate across selected target courses.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test client/src/features/assessments/CreateAssessmentPages.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/assessments/CreateActivityPage.tsx client/src/features/assessments/CreateAssignmentPage.tsx client/src/features/assessments/CreateQuizPage.tsx client/src/features/assessments/CreateExamPage.tsx client/src/features/assessments/CreateAssessmentPages.test.tsx
git commit -m "feat(assessments): enable cross-section assessment duplication"
```

---

### Task 6: Cross-Section Sync in Syllabus (`SyllabusView`) & Files (`FilesView`)

**Files:**
- Modify: `client/src/features/syllabus/SyllabusView.tsx`
- Modify: `client/src/features/files/FilesView.tsx`
- Test: `client/src/features/syllabus/SyllabusView.test.tsx`
- Test: `client/src/features/files/FilesView.test.tsx`

**Interfaces:**
- Consumes: `findMatchingSiblingCourses`, `CrossSectionPromptModal`
- Calls: `updateCourseSyllabus(targetId, ...)`, `uploadCourseFile({ ...fileData, courseId: targetId })`

- [ ] **Step 1: Write tests for syllabus apply and file upload cross-section sync**

Add tests in `SyllabusView.test.tsx` and `FilesView.test.tsx` asserting cross-section replication on syllabus apply and file upload.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test client/src/features/syllabus/SyllabusView.test.tsx client/src/features/files/FilesView.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement cross-section sync in `SyllabusView.tsx` and `FilesView.tsx`**

- In `SyllabusView.tsx`: intercept `handleApplyScan`. If sibling courses exist, show prompt. On confirm, apply to current course and update syllabus on each target course, plus file upload.
- In `FilesView.tsx`: on file selection/drop, if sibling courses exist, prompt instructor and upload file to current course plus all selected courses (matching target folder if one is active).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test client/src/features/syllabus/SyllabusView.test.tsx client/src/features/files/FilesView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/SyllabusView.tsx client/src/features/files/FilesView.tsx client/src/features/syllabus/SyllabusView.test.tsx client/src/features/files/FilesView.test.tsx
git commit -m "feat(syllabus-files): support cross-section syllabus and file sync"
```

---

### Task 7: Full Regression & Vitest Suite Verification

**Files:**
- Entire repository

- [ ] **Step 1: Run complete test suite across client**

Run: `npm test -- --run` in `client` directory.
Expected: All tests pass with zero regressions.

- [ ] **Step 2: Run TypeScript compile check**

Run: `npm run build` or `npx tsc --noEmit` in `client` directory.
Expected: Clean compilation with 0 TypeScript errors.

- [ ] **Step 3: Final commit**

```bash
git commit --allow-empty -m "chore(sync): verify full test suite and compilation for cross-section sync"
```
