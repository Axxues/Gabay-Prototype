# Cross-Section Course Content Synchronization Design

## 1. Intent & The Why

Faculty instructors frequently teach multiple sections of the identical course within the same academic term (e.g. `CS 101: Data Structures and Algorithms` across sections `BSCS 3-1`, `BSCS 3-2`, and `BSCS 3-3`). Currently, when an instructor uploads a syllabus, constructs a learning module, adds module items, posts announcements, creates assessments (activities, quizzes, exams, assignments, projects, presentations), or uploads files, they must repeat the identical manual entry process for each section individually.

This feature introduces an automatic, non-intrusive cross-posting workflow: whenever an instructor creates or uploads any of these items, the system checks for sibling sections sharing the same course name, course code, school year, and semester taught by the instructor. If found, an interstitial confirmation modal allows the instructor to replicate the content across any or all of their other sections with a single click.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Unified Interception:** Intercept the submission action for all 6 core content workflows:
  1. Syllabus upload/apply
  2. Module creation
  3. Module item creation
  4. Announcement creation
  5. Assessment creation (activities, quizzes, exams, assignments, projects, presentations)
  6. Course file uploads
- **Accurate Section Discovery:** Sibling courses must strictly match:
  - Exact course code (`code`, case-insensitive trim)
  - Exact course name/title (`title`, case-insensitive trim)
  - Exact school year (`schoolYear`)
  - Exact semester/term (`semester` or `term`, normalized)
  - Same instructor (`course.instructorId === currentCourse.instructorId` and matching the current active user)
  - Different course ID (`id !== currentCourseId`)
- **Zero Friction for Single-Section Courses:** If an instructor only has one section of a course, the modal is completely bypassed and saving happens immediately.
- **Intelligent Parent Module Resolution:** When cross-posting a module item, the system automatically finds a parent module in each destination section with a matching title; if none exists, it creates the parent module in that section before adding the item.
- **Intelligent Folder Resolution for Files:** When uploading a file into a specific folder, the system matches or creates the folder with the same name in the destination section.
- **Clear Instructor Choice:** Provide two explicit actions in the modal:
  - "Post to this course only" (proceed with only the current section)
  - "Post to selected sections" (replicate to the current section plus all checked sections)

### Non-Goals
- Two-way continuous live synchronization after creation (editing or deleting an item in one section later will not automatically mutate other sections).
- Cross-posting across different school years, different semesters, or different instructors.
- Overwriting or wiping student submissions or existing items in target sections.

### Anti-Goals
- Blocking the instructor if one sibling section has an error (graceful partial completion with detailed feedback).
- Showing the modal when an instructor is merely editing an existing item (this feature applies to newly created items and fresh uploads).
- Altering the backend schema (strict adherence to `AGENTS.md`: Directus DDL modifications are prohibited; all persistence uses existing client application operations).

---

## 3. Constraints & Settled Design Decisions

1. **Directus / Likha ERP Safety:** Must never make DDL calls or alter schema tables. All cross-posted items must utilize existing `LMSContext` methods (`createAnnouncement`, `createModule`, `addModuleItem`, `createActivity`, `createQuiz`, `createExam`, `updateCourseSyllabus`, `uploadCourseFile`).
2. **Ponytail Philosophy:** Keep code additions minimal, consolidated, and reusable. Create one shared modal component (`CrossSectionPromptModal.tsx`) and one discovery utility (`crossSectionSync.ts`) rather than duplicating modal UI code across 7 different page files.
3. **School Year, Semester, and Instructor Scoping (User Decision):** Sibling discovery strictly verifies identical `schoolYear`, identical `semester` / `term`, and identical `instructorId`.
4. **Linked Assessment Cloning in Module Items (Builder Call):** When adding a module item that links an Activity or Quiz, the underlying activity/quiz record is cloned into each target course first, and the target module item is linked to the newly generated assessment ID to prevent cross-section gradebook collisions.
5. **Syllabus Trigger Scope (Builder Call):** Cross-section sync triggers exclusively on syllabus upload/scan application (`handleApplyScan`), preserving individual target section names while duplicating academic syllabus content and uploading the syllabus file to target course files.
6. **Idempotent Module Creation (Builder Call):** When cross-posting a module, if a module with the identical title already exists in the destination section, the system reuses that module instead of creating a duplicate.

---

## 4. Architecture & Component Design

### A. Sibling Course Discovery (`crossSectionSync.ts`)
```typescript
export interface SiblingCourseMatch {
  course: Course;
  selected: boolean;
}

export function normalizeSemester(termOrSem?: string | null): string {
  if (!termOrSem) return '';
  const s = termOrSem.trim().toLowerCase();
  if (s.includes('1st') || s.includes('first')) return '1st';
  if (s.includes('2nd') || s.includes('second')) return '2nd';
  if (s.includes('mid') || s.includes('summer')) return 'summer';
  return s;
}

export function findMatchingSiblingCourses(
  currentCourse: Course,
  allCourses: Course[],
  activeUserId?: string
): Course[] {
  if (!currentCourse) return [];
  const curCode = (currentCourse.code || '').trim().toLowerCase();
  const curTitle = (currentCourse.title || '').trim().toLowerCase();
  const curYear = (currentCourse.schoolYear || '').trim();
  const curSem = normalizeSemester(currentCourse.semester || currentCourse.term);
  const instructorId = activeUserId || currentCourse.instructorId;

  return allCourses.filter(c => {
    if (c.id === currentCourse.id) return false;
    const sameCode = (c.code || '').trim().toLowerCase() === curCode;
    const sameTitle = (c.title || '').trim().toLowerCase() === curTitle;
    const sameYear = (c.schoolYear || '').trim() === curYear;
    const sameSem = normalizeSemester(c.semester || c.term) === curSem;
    const sameInstructor = Boolean(instructorId && c.instructorId === instructorId);

    return sameCode && sameTitle && sameYear && sameSem && sameInstructor;
  });
}
```

### B. Shared Interstitial Modal (`CrossSectionPromptModal.tsx`)
A reusable dialog that accepts:
- `isOpen: boolean`
- `onClose: () => void` (cancels submit)
- `itemType: 'syllabus' | 'module' | 'module_item' | 'announcement' | 'assessment' | 'file'`
- `itemTitle: string`
- `siblingCourses: Course[]`
- `onConfirm: (selectedCourseIds: string[]) => Promise<void>`
- `onSkipToCurrentOnly: () => Promise<void>`
- `isSubmitting: boolean`

UI Elements:
- Header badge showing item type icon and title.
- Explanatory copy: "You teach other sections of **[Course Code]** for **[Semester]**, School Year **[Year]**. Would you like to publish this to other sections too?"
- Selection list with "Select All" / "Deselect All".
- List of sections with checkboxes, section names, and student counts.
- Buttons:
  - "Post to Current Section Only" (secondary outline)
  - "Post to Selected Sections ([N])" (primary button with spinner during submit)

### C. Execution Handlers

#### 1. Announcements (`CreateAnnouncementPage.tsx`)
- On submit, if sibling courses exist, intercept and show modal.
- On confirm with selected IDs:
  - Create announcement for `currentCourse.id`.
  - For each `targetId` in `selectedCourseIds`, call `createAnnouncement({ ...data, courseId: targetId })`.

#### 2. Modules (`ModulesView.tsx`)
- On create module modal submit, if sibling courses exist, show prompt.
- Create module in current course.
- For each selected target course, check if module with title exists; if not, call `createModule(targetId, title)`.

#### 3. Module Items (`AddModuleItemPage.tsx`)
- On submit, if sibling courses exist, show prompt.
- Add item to current module.
- For each selected target course:
  - Look for an existing module in `db.modules` where `m.courseId === targetId` and `m.title.trim().toLowerCase() === currentModule.title.trim().toLowerCase()`.
  - If not found, call `createModule(targetId, currentModule.title)` first.
  - If the item references an activity (`activityId`) or quiz (`quizId`), clone the activity/quiz record for `targetId` first and remap the ID.
  - Call `addModuleItem(targetModId, clonedItemPayload)`.

#### 4. Assessments (`CreateActivityPage.tsx`, `CreateAssignmentPage.tsx`, `CreateQuizPage.tsx`, `CreateExamPage.tsx`, `CreateProjectPage.tsx`, `CreatePresentationPage.tsx`)
- On save/publish submit, show prompt if sibling courses exist.
- Persist assessment in current course.
- For each target course, dispatch `createActivity` / `createQuiz` / `createExam` with `{ ...payload, courseId: targetId }`.

#### 5. Syllabus (`SyllabusView.tsx`)
- When applying scanned syllabus (`handleApplyScan`):
  - Persist to current course.
  - For each target course, call `updateCourseSyllabus(targetId, { ...boundSyllabus, courseId: targetId })`.
  - Replicate uploaded syllabus file entry into target course's `course_files`.

#### 6. Course Files (`FilesView.tsx`)
- On file drop or file select upload:
  - If sibling courses exist, open prompt before or immediately upon file selection.
  - Save file to current course.
  - For each target course, find/create matching folder if applicable, and call `uploadCourseFile({ ...fileData, courseId: targetId, folderId: targetFolderId })`.

---

## 5. What's Left to the Builder
- Exact layout styling matching the LMS design system (`DialogFrame`, Tailwind classes, Lucide icons).
- Unit tests validating `findMatchingSiblingCourses`, sibling section checkbox selection, and multi-course dispatching.
- Toast/alert message formatting summarizing how many sections received the new item (e.g., *"Published to 3 sections successfully"*).
