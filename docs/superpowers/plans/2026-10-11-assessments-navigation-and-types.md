# Assessments Navigation & New Assessment Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate course assessments into a clean, collapsible sidebar navigation with an Assessments Overview hub, and implement three new assessment types—Assignments, Projects, and Presentations—integrated with SpeedGrader and the Gradebook.

**Architecture:** Use a unified assessment engine by extending the `Activity` database model and API routes with an `assessmentType` discriminator (`'activity' | 'assignment' | 'project' | 'presentation'`) and type-specific `metadata`. Implement a collapsible sidebar group in `LMSContextPanel.tsx` that links to a new `AssessmentsOverviewView.tsx` hub as well as dedicated category views (`AssignmentsView`, `ProjectsView`, `PresentationsView`). Submissions across all types seamlessly leverage the existing submission and SpeedGrader grading pipelines.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Express.js, Prisma, SQL Server, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-11-assessments-navigation-and-types-design.md`

## Global Constraints
- Backward compatibility: Existing `activities`, `quizzes`, `exams`, and `submissions` rows must remain completely unaffected.
- No placeholder code: Every file modification and test must be fully implemented with exact types and logic.
- Responsive design: Both desktop collapsible sidebar and mobile top scrollable tab navigation must render cleanly.
- Strict typing: TypeScript types must align across client and server with zero lint or compilation errors.

---

### Task 1: Type Definitions & Schema Discriminator

**Files:**
- Modify: `client/src/types/lms.ts:155-177`
- Modify: `server/prisma/schema.prisma:215-238`
- Test: `client/src/types/lms.test.ts`

**Interfaces:**
- Consumes: Existing `Activity`, `RubricCriterion`, `TermId` from `client/src/types/lms.ts`.
- Produces: `AssessmentType`, `AssessmentMetadata`, and updated `Activity` interface with `assessmentType?: AssessmentType` and `metadata?: AssessmentMetadata`.

- [ ] **Step 1: Write the failing type test**

Create `client/src/types/lms.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Activity, AssessmentType, AssessmentMetadata } from './lms';

describe('AssessmentType and Activity definitions', () => {
  it('supports assignments, projects, and presentations', () => {
    const types: AssessmentType[] = ['activity', 'assignment', 'project', 'presentation'];
    expect(types).toHaveLength(4);

    const projectMeta: AssessmentMetadata = {
      groupMode: 'group',
      maxGroupSize: 4,
      repositoryUrlRequired: true,
      liveDemoUrlRequired: true,
    };

    const projectActivity: Activity = {
      id: 'act-proj-1',
      courseId: 'c1',
      title: 'Capstone Milestone 1',
      instructions: 'Submit project repository and live link',
      term: 'midterm',
      pointsPossible: 100,
      published: true,
      format: 'classic',
      assessmentType: 'project',
      metadata: projectMeta,
      questions: [],
    };

    expect(projectActivity.assessmentType).toBe('project');
    expect(projectActivity.metadata?.groupMode).toBe('group');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test client/src/types/lms.test.ts`
Expected: FAIL due to missing `AssessmentType` and `AssessmentMetadata` exports in `lms.ts`.

- [ ] **Step 3: Update `types/lms.ts` and `server/prisma/schema.prisma`**

In `client/src/types/lms.ts`, add:
```ts
export type AssessmentType = 'activity' | 'assignment' | 'project' | 'presentation';

export interface AssessmentMetadata {
  groupMode?: 'individual' | 'group';
  maxGroupSize?: number;
  repositoryUrlRequired?: boolean;
  liveDemoUrlRequired?: boolean;
  presentationMode?: 'in_person' | 'recorded' | 'slide_only';
  durationMinutes?: number;
  slideDeckRequired?: boolean;
  rubricFocus?: 'delivery' | 'content' | 'qa' | 'visuals';
}
```
And add to `export interface Activity`:
```ts
  assessmentType?: AssessmentType;
  metadata?: AssessmentMetadata;
```

In `server/prisma/schema.prisma`, update `model Activity`:
```prisma
  assessmentType     String?        @default("activity") @db.NVarChar(32)
  metadata           String?        @db.NVarChar(Max)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test client/src/types/lms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/types/lms.ts client/src/types/lms.test.ts server/prisma/schema.prisma
git commit -m "feat(types): add AssessmentType, AssessmentMetadata, and schema fields"
```

---

### Task 2: Backend Assessment API Route Filtering & Persistence

**Files:**
- Modify: `server/src/routes/assessments.ts:380-450`
- Test: `server/src/routes/assessments.test.ts`

**Interfaces:**
- Consumes: Prisma `Activity` with `assessmentType` and `metadata`.
- Produces: `GET /api/activities?assessmentType=...` and `POST /api/activities` handling `assessmentType` and `metadata`.

- [ ] **Step 1: Write test for assessmentType filtering in API**

Add test in `server/src/routes/assessments.test.ts`:
```ts
it('filters activities by assessmentType', async () => {
  const course = await createTestCourse();
  await createTestActivity({ courseId: course.id, title: 'Essay 1', assessmentType: 'assignment' });
  await createTestActivity({ courseId: course.id, title: 'Final Project', assessmentType: 'project' });

  const assignmentRes = await request(app)
    .get(`/api/activities?courseId=${course.id}&assessmentType=assignment`)
    .set('Authorization', `Bearer ${facultyToken}`);
  expect(assignmentRes.status).toBe(200);
  expect(assignmentRes.body.activities).toHaveLength(1);
  expect(assignmentRes.body.activities[0].title).toBe('Essay 1');

  const allRes = await request(app)
    .get(`/api/activities?courseId=${course.id}`)
    .set('Authorization', `Bearer ${facultyToken}`);
  expect(allRes.status).toBe(200);
  expect(allRes.body.activities.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix server test src/routes/assessments.test.ts`
Expected: FAIL due to `assessmentType` filter not implemented.

- [ ] **Step 3: Implement assessmentType query and payload handling in `assessments.ts`**

In `server/src/routes/assessments.ts`:
1. In `GET /api/activities`:
```ts
const assessmentType = typeof req.query.assessmentType === 'string' ? req.query.assessmentType : undefined;
const whereClause: any = { courseId: course.id };
if (assessmentType) {
  whereClause.assessmentType = assessmentType;
}
```
2. In `POST /api/activities` & `PATCH /api/activities/:id`:
Parse and persist `assessmentType: body.assessmentType || 'activity'` and `metadata: stringifyJsonField(body.metadata || {})`.
3. In `mapActivity`:
```ts
function mapActivity<T extends { id: string; submissionTypes?: string | null; rubric?: string | null; metadata?: string | null }>(a: T) {
  return {
    ...a,
    submissionTypes: parseJsonField<unknown[]>(a.submissionTypes, []),
    rubric: parseJsonField<unknown[]>(a.rubric, []),
    metadata: parseJsonField<Record<string, unknown>>(a.metadata, {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix server test src/routes/assessments.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/assessments.ts server/src/routes/assessments.test.ts
git commit -m "feat(api): support assessmentType query filter and metadata in assessments route"
```

---

### Task 3: Badge Counters & Navigation Helpers

**Files:**
- Modify: `client/src/utils/notifiers.ts`
- Modify: `client/src/config/navigation.ts`
- Test: `client/src/utils/notifiers.test.ts`

**Interfaces:**
- Consumes: `Activity[]`, `Quiz[]`, `Exam[]`, `Submission[]` from LMS state.
- Produces: `countAssessmentCategoryBadge`, `countTotalAssessmentBadge`, updated `COURSE_CHILDREN`, and `ASSESSMENT_SUB_ITEMS`.

- [ ] **Step 1: Write failing test for assessment badges**

In `client/src/utils/notifiers.test.ts`, add:
```ts
import { describe, it, expect } from 'vitest';
import { countAssessmentCategoryBadge, countTotalAssessmentBadge } from './notifiers';
import type { Activity, Submission } from '../types/lms';

describe('Assessment badge counters', () => {
  it('counts unsubmitted assignments for students', () => {
    const activities: Activity[] = [
      { id: '1', courseId: 'c1', title: 'A1', format: 'classic', published: true, assessmentType: 'assignment', term: 'midterm', pointsPossible: 10, questions: [] },
      { id: '2', courseId: 'c1', title: 'P1', format: 'classic', published: true, assessmentType: 'project', term: 'midterm', pointsPossible: 50, questions: [] },
    ];
    const submissions: Submission[] = [
      { id: 's1', activityId: '1', activityKey: '1', courseId: 'c1', studentId: 'u1', studentName: 'Test', studentAvatar: '', submittedAt: '', submissionType: 'file', status: 'submitted', rubricScores: {}, comments: [] }
    ];

    const assignmentBadge = countAssessmentCategoryBadge(activities, submissions, 'assignment', 'u1');
    const projectBadge = countAssessmentCategoryBadge(activities, submissions, 'project', 'u1');

    expect(assignmentBadge).toBe(0); // '1' is submitted
    expect(projectBadge).toBe(1);    // '2' is unsubmitted

    const totalBadge = countTotalAssessmentBadge({
      activities,
      quizzes: [],
      exams: [],
      submissions,
      userId: 'u1',
      role: 'student',
      courseId: 'c1'
    });
    expect(totalBadge).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test client/src/utils/notifiers.test.ts`
Expected: FAIL due to missing badge counting functions.

- [ ] **Step 3: Implement badge counters and update `navigation.ts`**

1. In `client/src/utils/notifiers.ts`:
Implement `countAssessmentCategoryBadge` and `countTotalAssessmentBadge`.
2. In `client/src/config/navigation.ts`:
Define:
```ts
export const ASSESSMENT_SUB_ITEMS = [
  { id: 'assessments', label: 'Overview', icon: 'modules' },
  { id: 'activities', label: 'Activities', icon: 'activities' },
  { id: 'quizzes', label: 'Quizzes', icon: 'quizzes' },
  { id: 'assignments', label: 'Assignments', icon: 'activities' },
  { id: 'projects', label: 'Projects', icon: 'modules' },
  { id: 'presentations', label: 'Presentations', icon: 'syllabus' },
  { id: 'exams', label: 'Exams', icon: 'exams' },
] as const;
```
And update `COURSE_CHILDREN`:
```ts
export const COURSE_CHILDREN: NavItem[] = [
  { id: 'modules', label: 'Modules', icon: 'modules', roles: ALL },
  { id: 'syllabus', label: 'Syllabus', icon: 'syllabus', roles: ALL },
  { id: 'announcements', label: 'Announcements', icon: 'announcements', roles: ALL },
  { id: 'assessments', label: 'Assessments', icon: 'activities', roles: ALL },
  { id: 'files', label: 'Files', icon: 'files', roles: ALL },
  { id: 'grades', label: 'Grades', icon: 'grades', roles: ALL },
  { id: 'people', label: 'People', icon: 'people', roles: NO_STAFF },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test client/src/utils/notifiers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/notifiers.ts client/src/utils/notifiers.test.ts client/src/config/navigation.ts
git commit -m "feat(navigation): add assessment sub items and badge calculation functions"
```

---

### Task 4: Collapsible Assessments Sidebar Navigation

**Files:**
- Modify: `client/src/components/layout/LMSContextPanel.tsx`
- Test: `client/src/components/layout/LMSContextPanel.test.tsx`

**Interfaces:**
- Consumes: `COURSE_CHILDREN`, `ASSESSMENT_SUB_ITEMS`, `courseSubTab`, `onSelectCourseTab`.
- Produces: Collapsible "Assessments" navigation item with animated sub-list and rolled-up badges.

- [ ] **Step 1: Write test for collapsible assessments menu**

In `client/src/components/layout/LMSContextPanel.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LMSContextPanel } from './LMSContextPanel';
// test with mock LMS provider...
it('expands assessment sub-items when Assessments is clicked', () => {
  // Verifies that clicking Assessments reveals Overview, Activities, Quizzes, Assignments, Projects, Presentations, Exams
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test client/src/components/layout/LMSContextPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement collapsible Assessments group in `LMSContextPanel.tsx`**

In `LMSContextPanel.tsx`:
1. Track local state `const [isAssessmentsOpen, setIsAssessmentsOpen] = useState(true);`.
2. When `courseSubTab` matches any of `['assessments', 'activities', 'quizzes', 'assignments', 'projects', 'presentations', 'exams']`, ensure `isAssessmentsOpen` defaults to true.
3. Render the `assessments` item with a ChevronDown / ChevronRight toggle icon.
4. When expanded, render the 7 child items with indentation, active highlight, and individual badge counts.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test client/src/components/layout/LMSContextPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/layout/LMSContextPanel.tsx client/src/components/layout/LMSContextPanel.test.tsx
git commit -m "feat(ui): implement collapsible assessments navigation in LMSContextPanel"
```

---

### Task 5: Assessments Overview Hub Page (`AssessmentsOverviewView.tsx`)

**Files:**
- Create: `client/src/pages/AssessmentsOverviewView.tsx`
- Modify: `client/src/pages/CoursesPage.tsx`
- Test: `client/src/pages/AssessmentsOverviewView.test.tsx`

**Interfaces:**
- Consumes: Course ID, LMS database assessments (`activities`, `quizzes`, `exams`, `submissions`), and navigation callbacks.
- Produces: Overview hub with metric cards, category filters, term filters, search, and direct action cards.

- [ ] **Step 1: Write test for AssessmentsOverviewView**

Create `client/src/pages/AssessmentsOverviewView.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssessmentsOverviewView } from './AssessmentsOverviewView';

describe('AssessmentsOverviewView', () => {
  it('renders metric cards and filter pills', () => {
    // Verifies metric counts, category pill switching, and term filtering
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test client/src/pages/AssessmentsOverviewView.test.tsx`
Expected: FAIL due to missing component.

- [ ] **Step 3: Implement `AssessmentsOverviewView.tsx` and wire into `CoursesPage.tsx`**

1. Create `client/src/pages/AssessmentsOverviewView.tsx` with:
   - Metric cards: Total Assessments, Due This Week, Graded, Total Points.
   - Category filter pills: `All`, `Activities`, `Quizzes`, `Assignments`, `Projects`, `Presentations`, `Exams`.
   - Term filter dropdown: `All Terms`, `Prelim`, `Midterm`, `Finals`.
   - Search bar.
   - Quick create menu for faculty (`+ Create Assessment`).
   - Assessment item cards with direct navigation triggers (`onNavigateSubTab(type, id)`).
2. In `client/src/pages/CoursesPage.tsx`, wire `subTab === 'assessments'` to render `<AssessmentsOverviewView courseId={activeCourse.id} onNavigateCategory={(cat) => setSubTab(cat)} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test client/src/pages/AssessmentsOverviewView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AssessmentsOverviewView.tsx client/src/pages/AssessmentsOverviewView.test.tsx client/src/pages/CoursesPage.tsx
git commit -m "feat(pages): implement AssessmentsOverviewView hub and mount in CoursesPage"
```

---

### Task 6: Dedicated Views for Assignments, Projects, and Presentations

**Files:**
- Create: `client/src/pages/AssignmentsView.tsx`
- Create: `client/src/pages/ProjectsView.tsx`
- Create: `client/src/pages/PresentationsView.tsx`
- Modify: `client/src/pages/CoursesPage.tsx`
- Test: `client/src/pages/DedicatedAssessmentViews.test.tsx`

**Interfaces:**
- Consumes: `courseId`, `db.activities`, `db.submissions`, user role.
- Produces: Dedicated categorized views for Assignments, Projects, and Presentations with creation actions and submission drawers.

- [ ] **Step 1: Write test for dedicated assessment views**

Create `client/src/pages/DedicatedAssessmentViews.test.tsx`:
```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentsView } from './AssignmentsView';
import { ProjectsView } from './ProjectsView';
import { PresentationsView } from './PresentationsView';

describe('Dedicated Assessment Views', () => {
  it('filters items strictly by assessmentType', () => {
    // Tests that AssignmentsView only shows assignments, ProjectsView only projects, etc.
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test client/src/pages/DedicatedAssessmentViews.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `AssignmentsView`, `ProjectsView`, and `PresentationsView`**

1. `AssignmentsView.tsx`: Displays assignments with due dates, file/text submission options, rubric details, and faculty action to create.
2. `ProjectsView.tsx`: Displays projects with group mode badges (`Individual` / `Group`), max group size, repository link submission field, and demo URL field.
3. `PresentationsView.tsx`: Displays presentations with delivery mode badges (`In-Person`, `Recorded`, `Slide Only`), duration, slide deck link submission, and presentation rubric.
4. Mount `subTab === 'assignments'`, `subTab === 'projects'`, and `subTab === 'presentations'` in `CoursesPage.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test client/src/pages/DedicatedAssessmentViews.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AssignmentsView.tsx client/src/pages/ProjectsView.tsx client/src/pages/PresentationsView.tsx client/src/pages/DedicatedAssessmentViews.test.tsx client/src/pages/CoursesPage.tsx
git commit -m "feat(pages): implement dedicated Assignments, Projects, and Presentations views"
```

---

### Task 7: Assessment Creation Pages (`CreateAssignmentPage`, `CreateProjectPage`, `CreatePresentationPage`)

**Files:**
- Create: `client/src/pages/CreateAssignmentPage.tsx`
- Create: `client/src/pages/CreateProjectPage.tsx`
- Create: `client/src/pages/CreatePresentationPage.tsx`
- Test: `client/src/pages/CreateAssessmentPages.test.tsx`

**Interfaces:**
- Consumes: `createActivity` from `LMSContext`, course terms.
- Produces: Authoring forms tailored for assignments, projects (with group/repo settings), and presentations (with presentation format/duration/rubrics).

- [ ] **Step 1: Write test for assessment creation forms**

Create `client/src/pages/CreateAssessmentPages.test.tsx`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateProjectPage } from './CreateProjectPage';

describe('CreateProjectPage', () => {
  it('validates project-specific fields before submitting', async () => {
    // Verify group mode selection, max group size validation, and payload packaging
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test client/src/pages/CreateAssessmentPages.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement creation pages**

1. `CreateAssignmentPage.tsx`: Title, instructions, term, points, due date, submission types (file / text), rubric builder. Calls `createActivity({ ...payload, assessmentType: 'assignment' })`.
2. `CreateProjectPage.tsx`: Includes group mode (`individual` vs `group`), max group size, repository URL requirement toggle, live demo URL toggle. Calls `createActivity({ ...payload, assessmentType: 'project', metadata: { ... } })`.
3. `CreatePresentationPage.tsx`: Includes presentation mode (`in_person` vs `recorded` vs `slide_only`), duration in minutes, slide deck required toggle, and presentation rubric templates. Calls `createActivity({ ...payload, assessmentType: 'presentation', metadata: { ... } })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test client/src/pages/CreateAssessmentPages.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/CreateAssignmentPage.tsx client/src/pages/CreateProjectPage.tsx client/src/pages/CreatePresentationPage.tsx client/src/pages/CreateAssessmentPages.test.tsx
git commit -m "feat(pages): implement specialized creation pages for assignments, projects, and presentations"
```

---

### Task 8: SpeedGrader, Gradebook & End-to-End Verification

**Files:**
- Modify: `client/src/components/grading/SpeedGraderModal.tsx`
- Modify: `client/src/components/grading/FacultyGradebook.tsx`
- Modify: `client/src/components/grading/StudentGradebook.tsx`
- Test: `client/src/components/grading/AssessmentsGrading.test.tsx`

**Interfaces:**
- Consumes: Submissions with `activityKey` / `activityId` across all 6 assessment types.
- Produces: Verified grading, rubric evaluation, and term grade computation for assignments, projects, and presentations.

- [ ] **Step 1: Write test for SpeedGrader and Gradebook integration**

Create `client/src/components/grading/AssessmentsGrading.test.tsx`:
```ts
import { describe, it, expect } from 'vitest';
// Verifies SpeedGrader displays project links & presentation decks, and Gradebook lists assignments/projects/presentations
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test client/src/components/grading/AssessmentsGrading.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement SpeedGrader and Gradebook support**

1. In `SpeedGraderModal.tsx`, display project repository/demo links and presentation slide links when present on the submission or assessment metadata.
2. In `FacultyGradebook.tsx` and `StudentGradebook.tsx`, ensure assessments of all types (`activity`, `assignment`, `project`, `presentation`) are recognized and grouped under their respective term columns.
3. Run full client and server test suites:
   `npm --prefix server test`
   `npm --prefix client test`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test client/src/components/grading/AssessmentsGrading.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/grading/SpeedGraderModal.tsx client/src/components/grading/FacultyGradebook.tsx client/src/components/grading/StudentGradebook.tsx client/src/components/grading/AssessmentsGrading.test.tsx
git commit -m "feat(grading): integrate new assessment types with SpeedGrader and Gradebook"
```
