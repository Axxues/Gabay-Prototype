# Activities with Question Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faculty build question-set activities (multiple choice, identification, true/false, essay) inside the course Activities tab; students answer them with MC/T-F/identification auto-scored on submit and essays routed to SpeedGrader manual review.

**Architecture:** Local-first incremental (Approach A). Pure scoring lives in `src/utils/activities.ts` (vitest-covered). State lives in `LMSContext` + `MockDatabase` (`activities` collection) persisted to the existing localStorage key. Submissions reuse the existing `Submission` type with mock assignment id `asg-activity-<activityId>`, mirroring the `recordQuizSubmission` → `asg-quiz-*` precedent, so SpeedGrader, the faculty To Grade widget, and Recent Feedback work with zero changes. No new course tab: the `assignments` subTab is already labeled "Activities" (`src/config/navigation.ts:25`).

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind; vitest (already a devDependency).

**Spec:** `docs/superpowers/specs/2026-09-13-lms-extensions-design.md` (§2)

## Global Constraints

- No backend; all state in `LMSContext` + localStorage key `gabay_lms_db_v6`.
- Reuse the existing `QuizQuestion` union (`src/types/lms.ts:201-214`) — no parallel question model.
- Auto-grade MC / true-false / identification on submit; essay always routes to manual review (no auto points for essays).
- Announcement-style scope rule does not apply; activities are visible to all enrolled students.
- Time limits stay quiz-only (YAGNI — no `timeLimitMinutes` on activities).
- Existing file / online_text assignments are untouched — activities are a new collection, not a migration.
- **User override (binds every task): do NOT commit. Leave all work uncommitted in the working tree. Steps saying "verify" end the task; no `git add`, no `git commit`.**
- Shell is Windows PowerShell 5.1: never use `&&` to chain commands.

---

## File structure

- `src/utils/activities.ts` (new) — pure scorer: `scoreActivityQuestions(questions, answers)` plus `activityPointsPossible(questions)`. No React, no localStorage.
- `src/utils/activities.test.ts` (new) — vitest units for the scorer.
- `src/types/lms.ts` (modify) — add `Activity`; extend `MockDatabase` with `activities?: Activity[]`.
- `src/context/LMSContext.tsx` (modify) — `createActivity`, `recordActivitySubmission`, `deleteActivity` + context wiring.
- `src/pages/CreateActivityPage.tsx` (new) — faculty authoring, clones the `CreateQuizPage` card pattern.
- `src/pages/ActivitiesView.tsx` (new) — student runner + result panel + faculty list entries.
- `src/pages/AssignmentsView.tsx` (modify) — hosts the question-set section inside the Activities tab.
- `src/pages/DashboardPage.tsx` (modify) — student To-Do includes activities.

---

### Task 1: Pure activity scorer + tests

**Files:**
- Create: `src/utils/activities.ts`
- Create: `src/utils/activities.test.ts`

**Interfaces:**
- Consumes: `QuizQuestion` from `src/types/lms.ts`
- Produces: `scoreActivityQuestions(questions: QuizQuestion[], answers: Record<string, string>) => { earned: number; possible: number; percent: number; needsReview: boolean; perQuestion: Record<string, { earned: number; possible: number; auto: boolean }> }` and `activityPointsPossible(questions: QuizQuestion[]) => number`, used by Task 3 (store) and Task 5 (runner result panel). Keep exact names and signatures.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/activities.test.ts
import { describe, expect, it } from 'vitest';
import { activityPointsPossible, scoreActivityQuestions } from './activities';
import type { QuizQuestion } from '../types/lms';

const mc: QuizQuestion = { id: 'q1', text: 'MC', type: 'multiple_choice', options: ['A', 'B'], correctAnswer: 'A', points: 10 };
const tf: QuizQuestion = { id: 'q2', text: 'TF', type: 'true_false', options: ['True', 'False'], correctAnswer: 'True', points: 5 };
const iden: QuizQuestion = { id: 'q3', text: 'ID', type: 'identification', correctAnswer: 'Manila', points: 5 };
const essay: QuizQuestion = { id: 'q4', text: 'ES', type: 'essay', points: 20 };

describe('scoreActivityQuestions', () => {
  it('scores MC and true/false by exact match', () => {
    const r = scoreActivityQuestions([mc, tf], { q1: 'A', q2: 'False' });
    expect(r.earned).toBe(10);
    expect(r.possible).toBe(15);
    expect(r.percent).toBe(67);
    expect(r.needsReview).toBe(false);
  });
  it('scores identification case-insensitively with trim', () => {
    const r = scoreActivityQuestions([iden], { q3: '  manila ' });
    expect(r.earned).toBe(5);
    expect(r.needsReview).toBe(false);
  });
  it('never auto-scores essays and flags review', () => {
    const r = scoreActivityQuestions([mc, essay], { q1: 'A', q4: 'a very long essay answer' });
    expect(r.earned).toBe(10);
    expect(r.possible).toBe(30);
    expect(r.needsReview).toBe(true);
    expect(r.perQuestion['q4'].auto).toBe(false);
    expect(r.perQuestion['q4'].earned).toBe(0);
  });
  it('treats blank answers as zero without review', () => {
    const r = scoreActivityQuestions([mc, iden], {});
    expect(r.earned).toBe(0);
    expect(r.needsReview).toBe(false);
  });
  it('skips description and page_break items', () => {
    const desc: QuizQuestion = { id: 'qx', text: 'Read this', type: 'description', points: 99 };
    const r = scoreActivityQuestions([mc, desc], { q1: 'B' });
    expect(r.possible).toBe(10);
    expect(r.earned).toBe(0);
  });
});

describe('activityPointsPossible', () => {
  it('sums gradable points only', () => {
    expect(activityPointsPossible([mc, tf, iden, essay])).toBe(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/activities.test.ts`
Expected: FAIL with "Failed to resolve import ./activities" (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/activities.ts
import type { QuizQuestion } from '../types/lms';

export interface ActivityQuestionScore {
  earned: number;
  possible: number;
  auto: boolean;
}

export interface ActivityScore {
  earned: number;
  possible: number;
  percent: number;
  needsReview: boolean;
  perQuestion: Record<string, ActivityQuestionScore>;
}

const GRADABLE = new Set(['multiple_choice', 'identification', 'true_false', 'essay']);

export function activityPointsPossible(questions: QuizQuestion[]): number {
  return questions.reduce((sum, q) => (GRADABLE.has(q.type) ? sum + (q.points || 0) : sum), 0);
}

export function scoreActivityQuestions(
  questions: QuizQuestion[],
  answers: Record<string, string>
): ActivityScore {
  let earned = 0;
  let possible = 0;
  let needsReview = false;
  const perQuestion: Record<string, ActivityQuestionScore> = {};

  for (const q of questions) {
    if (!GRADABLE.has(q.type)) continue;
    const qPts = q.points || 0;
    possible += qPts;
    const userAns = (answers[q.id] || '').trim();

    if (q.type === 'multiple_choice' || q.type === 'true_false') {
      const hit = userAns === (q.correctAnswer || '').trim();
      perQuestion[q.id] = { earned: hit ? qPts : 0, possible: qPts, auto: true };
      if (hit) earned += qPts;
    } else if (q.type === 'identification') {
      const hit = userAns.toLowerCase() === (q.correctAnswer || '').trim().toLowerCase();
      perQuestion[q.id] = { earned: hit ? qPts : 0, possible: qPts, auto: true };
      if (hit) earned += qPts;
    } else {
      // essay: never auto-scored; faculty grades in SpeedGrader
      needsReview = true;
      perQuestion[q.id] = { earned: 0, possible: qPts, auto: false };
    }
  }

  return { earned, possible, percent: Math.round((earned / (possible || 1)) * 100), needsReview, perQuestion };
}
```

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npx vitest run src/utils/activities.test.ts`
Expected: 6/6 PASS.
Run: `npx tsc -b`
Expected: PASS (no output).

- [ ] **Step 5: Leave uncommitted (user override — no commit)**

---

### Task 2: Activity types

**Files:**
- Modify: `src/types/lms.ts` (append `Activity` after the `Quiz` interface at lines 216-229; extend `MockDatabase` at lines 420-441)

**Interfaces:**
- Consumes: `QuizQuestion` (same file)
- Produces: `Activity { id, courseId, title, instructions, questions: QuizQuestion[], pointsPossible, dueDate?, published }` and `MockDatabase.activities?: Activity[]` used by Tasks 3–6. Keep exact names.

- [ ] **Step 1: Add the types**

```ts
export interface Activity {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  questions: QuizQuestion[];
  pointsPossible: number;
  dueDate?: string;
  published: boolean;
}
```

Insert after the `Quiz` interface closing brace (line 229). In `MockDatabase`, after `quizzes: Quiz[];` (line 426) add:

```ts
  activities?: Activity[];
```

`activities` is optional (same pattern as `notifications?`, `courseSections?`) so saved databases without it keep working; every consumer guards with `(db.activities || [])`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Leave uncommitted (user override — no commit)**

---

### Task 3: Activity store (create / submit / delete)

**Files:**
- Modify: `src/context/LMSContext.tsx` (add interface entries near `createQuiz: (quizData: Partial<Quiz>) => Quiz;` and `recordQuizSubmission` at line 87/1103; add implementations after `recordQuizSubmission` at line 1148)

**Interfaces:**
- Consumes: `Activity` type (Task 2), `scoreActivityQuestions` (Task 1), existing `Submission` type, `createNotification` for the `quiz_draft_saved`-style notice is NOT needed (no new notification type — YAGNI)
- Produces: `createActivity: (data: Partial<Activity>) => Activity`, `recordActivitySubmission: (activityId: string, studentId: string, answers: Record<string, string>) => Submission`, `deleteActivity: (activityId: string) => void` used by Tasks 4–5. Keep exact names and signatures.

- [ ] **Step 1: Add interface entries**

```ts
createActivity: (data: Partial<Activity>) => Activity;
recordActivitySubmission: (activityId: string, studentId: string, answers: Record<string, string>) => Submission;
deleteActivity: (activityId: string) => void;
```

`Activity` and `Submission` are already imported types in this file (verify the import block first; add `Activity` to it if missing).

- [ ] **Step 2: Add implementations after `recordQuizSubmission`**

```ts
const createActivity = (data: Partial<Activity>): Activity => {
  const questions = data.questions || [];
  const newActivity: Activity = {
    id: `act-${Date.now().toString(36)}`,
    courseId: data.courseId || activeCourseId || 'crs-cmsc131',
    title: data.title?.trim() || 'New Question-Set Activity',
    instructions: data.instructions || 'Answer all questions carefully.',
    questions,
    pointsPossible: data.pointsPossible ?? activityPointsPossible(questions),
    dueDate: data.dueDate,
    published: data.published ?? true
  };

  setDb(prev => ({
    ...prev,
    activities: [newActivity, ...(prev.activities || [])]
  }));

  return newActivity;
};

const recordActivitySubmission = (
  activityId: string,
  studentId: string,
  answers: Record<string, string>
): Submission => {
  const activity = (db.activities || []).find(a => a.id === activityId);
  if (!activity) throw new Error(`Activity not found: ${activityId}`);

  const result = scoreActivityQuestions(activity.questions, answers);
  const mockAssignmentId = `asg-activity-${activityId}`;
  const existingSubIndex = db.submissions.findIndex(
    s => s.assignmentId === mockAssignmentId && s.studentId === studentId
  );

  const hasEssay = activity.questions.some(q => q.type === 'essay');
  const graded = !result.needsReview;

  const submissionRecord: Submission = {
    id: existingSubIndex >= 0 ? db.submissions[existingSubIndex].id : `sub-activity-${Date.now()}`,
    assignmentId: mockAssignmentId,
    courseId: activity.courseId,
    studentId,
    studentName: activeUser.name,
    studentAvatar: activeUser.avatar,
    submittedAt: new Date().toISOString(),
    submissionType: 'online_text',
    content: `Activity Result: ${result.earned}/${result.possible} auto-scored${hasEssay ? '; essay pending faculty review' : ''}. Answers: ${JSON.stringify(answers)}`,
    grade: graded ? result.percent : undefined,
    gradedAt: graded ? new Date().toISOString() : undefined,
    gradedBy: graded ? 'GABAY Activity Auto-Evaluator' : undefined,
    status: graded ? 'graded' : 'submitted',
    rubricScores: graded ? { automated_eval: result.percent } : {},
    comments: graded
      ? [
          {
            id: `comm-${Date.now()}`,
            authorId: 'sys-auto-grader',
            authorName: 'GABAY Evaluation Engine',
            authorRole: 'admin',
            createdAt: new Date().toISOString(),
            text: `Automatic grading completed. Score ${result.earned}/${result.possible} (${result.percent}%) in activity "${activity.title}".`
          }
        ]
      : []
  };

  setDb(prev => {
    const updatedSubs = [...prev.submissions];
    if (existingSubIndex >= 0) {
      updatedSubs[existingSubIndex] = submissionRecord;
    } else {
      updatedSubs.unshift(submissionRecord);
    }
    return { ...prev, submissions: updatedSubs };
  });

  return submissionRecord;
};

const deleteActivity = (activityId: string): void => {
  setDb(prev => ({
    ...prev,
    activities: (prev.activities || []).filter(a => a.id !== activityId),
    submissions: prev.submissions.filter(s => s.assignmentId !== `asg-activity-${activityId}`)
  }));
};
```

Import `scoreActivityQuestions` and `activityPointsPossible` from `../utils/activities` at the top of `LMSContext.tsx`. Wire the three functions into the provider `value` object next to `createQuiz` / `recordQuizSubmission`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Leave uncommitted (user override — no commit)**

---

### Task 4: CreateActivityPage (faculty authoring)

**Files:**
- Create: `src/pages/CreateActivityPage.tsx`

**Interfaces:**
- Consumes: `createActivity` from `useLMS()`, `QuizQuestion` / `QuizItemType` types, `showAlert`
- Produces: `CreateActivityPage: React.FC<{ courseId: string; onBack: () => void; onActivityCreated: (id: string) => void }>` used by Task 5. Keep exact props.

- [ ] **Step 1: Implement the page**

Clone the `CreateQuizPage` question-card pattern (`src/pages/CreateQuizPage.tsx`): local `items: QuestionDraft[]` state where `QuestionDraft = { text, type: QuizItemType, options: string[], correctAnswer, points }`, type dropdown switching resets options exactly as `CreateQuizPage` lines 266-284 do (`multiple_choice` → `['','','','']`, `true_false` → `['True','False']`, others → `[]`). Support only the four gradable types in the type dropdown (`multiple_choice`, `identification`, `true_false`, `essay`) — no `description` / `page_break` (YAGNI: time limits and section breaks stay quiz-only). Fields: title (required), instructions, dueDate (optional `datetime-local`, defaults to +7 days like `CreateAssignmentPage.tsx:151`), one card per question with prompt input, points number input, options editor for MC, answer-key input for MC/T-F/identification (correctAnswer), no key for essay.

Validation on save (same warnings quizzes use — `CreateQuizPage.tsx:223-370`):
1. Title blank → `showAlert({ title: 'Title required', message: 'Give this activity a title.', type: 'warning' })`, return.
2. Zero cards → message `'An activity must contain at least one question.'`, return.
3. Zero gradable questions → message `'Please add at least one gradable question (Multiple Choice, Identification, True/False, or Essay).'`, return.
4. Any MC with fewer than 2 non-blank options → message `` `Question ${i + 1} requires at least 2 choices.` ``, return.
5. Any MC/T-F/identification with blank correctAnswer → message `` `Question ${i + 1} needs an answer key.` ``, return.

On success: map drafts to `QuizQuestion` (`id: q-${Date.now()}-${i}`, trimmed text/options filtered non-empty), call `createActivity({ courseId, title, instructions, questions, dueDate, published: true })`, then `onActivityCreated(newActivity.id)`. Layout shells (`PageHeader`, card classes, buttons) follow `CreateQuizPage` styling; do not import `CreateQuizPage` itself.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Leave uncommitted (user override — no commit)**

---

### Task 5: ActivitiesView runner + AssignmentsView integration

**Files:**
- Create: `src/pages/ActivitiesView.tsx`
- Modify: `src/pages/AssignmentsView.tsx` (list section + detail routing + create entry point)

**Interfaces:**
- Consumes: `db.activities`, `recordActivitySubmission`, `deleteActivity`, `createActivity` page (Task 4), `scoreActivityQuestions` NOT needed directly (store returns the graded `Submission`; per-question correctness for the result panel derives from comparing answers to keys for auto items only)
- Produces: question-set activities visible and answerable inside the Activities tab. No new exports consumed downstream except the default component.

- [ ] **Step 1: Create `ActivitiesView.tsx`**

Props: `{ courseId: string; activityId: string | null; onSelectActivity: (id: string | null) => void; onBackToModules?: () => void }`. Mirrors the `AssignmentsView` list/detail pattern and the `QuizzesView` runner widgets:

- List (when `activityId` is null): cards for `(db.activities || []).filter(a => a.courseId === courseId)` showing title, question count, pointsPossible, due date, and student status badge (`SUBMITTED`/`PENDING REVIEW`/`SCORED n%` from `db.submissions` with `assignmentId === asg-activity-<id>`). Faculty sees a `New Question Set` button rendering `CreateActivityPage` full-page (same pattern as `AssignmentsView.isCreatingAssignment` → `CreateAssignmentPage`).
- Runner (when `activityId` set): one card per question with widgets by type — radio list for MC, True/False two-radio, text input for identification, textarea for essay. Submit handler:

```tsx
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const submission = recordActivitySubmission(activity.id, activeUser.id, answers);
  setResult(submission);
};
```

Result panel: auto items show per-question correct/incorrect (compare trimmed answers to keys; identification case-insensitive); essay items show "pending review". If `submission.status === 'submitted'` show "Essay pending faculty review in SpeedGrader" notice. Faculty detail shows per-student submissions (from `db.submissions` filtered by the mock assignment id) with `openSpeedGrader(sub.id)` buttons (same as `AssignmentsView.tsx:234`).

- [ ] **Step 2: Integrate into `AssignmentsView.tsx`**

In the list branch (after the classic assignment cards, `AssignmentsView.tsx:115-...`): add a "Question Sets" section header + `ActivitiesView` in list mode with local `selectedActivityId` state; when set, render `ActivitiesView` in runner mode instead of the assignment list (same early-return pattern as `isCreatingAssignment`). Faculty delete uses `deleteActivity` behind the existing `showConfirm` pattern (`AssignmentsView.tsx:89-98`). Do not alter classic assignment rendering, submit flow, or SpeedGrader wiring.

- [ ] **Step 3: Typecheck + manual trace**

Run: `npx tsc -b`
Expected: PASS. Trace: create → list shows → answer → auto-score → essay pending → SpeedGrader grade → status flips.

- [ ] **Step 4: Leave uncommitted (user override — no commit)**

---

### Task 6: Dashboard To-Do includes activities

**Files:**
- Modify: `src/pages/DashboardPage.tsx` (student To-Do selector near line 50; card list near lines 340-366)

**Interfaces:**
- Consumes: `db.activities`, existing `db.submissions` lookup by `asg-activity-<id>`
- Produces: activities appear in student To-Do with due dates and SUBMITTED/DUE SOON badges. Nothing downstream.

- [ ] **Step 1: Extend the To-Do selector and cards**

Where `studentAssignments = db.assignments.filter(a => a.published)` (line 50), add:

```tsx
const studentActivities = (db.activities || []).filter(a => a.published);
```

and build the rendered list as `[...studentAssignments, ...studentActivities]` mapped to a shared shape `{ id, courseId, title, dueDate, pointsLabel, submitted }`, where for activities `pointsLabel` is `` `${a.pointsPossible} pts` `` and `submitted` is `db.submissions.some(s => s.assignmentId === `asg-activity-${a.id}` && s.studentId === activeUser.id)`. Cards keep the existing markup and `onNavigateCourse(asg.courseId, 'assignments')` navigation (the Activities tab hosts question sets after Task 5, so no new navigation target). Category line shows `asg.category` for assignments and `'Question Set'` for activities.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Leave uncommitted (user override — no commit)**

---

## Self-Review

**1. Spec coverage (§2):** Types reusing `QuizQuestion` union → Task 2. Auto-grade MC/T-F/identification on submit → Tasks 1, 3, 5. Essay → manual review held as `submitted` → Tasks 1, 3, 5. Create Activity page cloning CreateQuizPage cards → Task 4. Student card-per-question view with per-question correctness + pending-review → Task 5. SpeedGrader grading path → Task 3 (Submission reuse) + Task 5 faculty buttons. Gradebook/To-Do treatment → Task 6 (To-Do; gradebook matrix is midterm/final-only so nothing to change there). Empty-option/Missing-key validation → Task 4. Time limits quiz-only, no migration of file/text assignments → Global Constraints + Task 5 (untouched classic flow).

**2. Placeholder scan:** No TBD/TODO; every step has exact code or exact file:line references; no "similar to" references without content; no undefined functions (all produced/consumed names match across tasks: `scoreActivityQuestions`, `activityPointsPossible`, `createActivity`, `recordActivitySubmission`, `deleteActivity`, `CreateActivityPage`, `ActivitiesView`).

**3. Type consistency:** `Activity` fields match store construction (Task 3) and authoring mapping (Task 4). `recordActivitySubmission` returns `Submission` (existing type) — Task 5 uses `submission.status`/`submission.id` only, both real `Submission` fields. Mock id scheme `asg-activity-<id>` is identical in Tasks 3, 5, 6. `QuizItemType` values used in Task 4 dropdown are the four real union members from `src/types/lms.ts:193-199`.
