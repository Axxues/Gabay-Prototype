# University Syllabus Lifecycle, Collaboration & Multi-Tier Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive university-standard syllabus governance system where courses created from Chair-Sheets are locked until released by the Department Chair, co-instructors teaching different sections collaborate on a shared syllabus with live presence, unanimous agreement is required for submission, and syllabi pass a 3-tier review hierarchy (Evaluators -> Chair -> Dean).

**Architecture:** Domain-driven feature architecture strictly encapsulated under `client/src/features/syllabus/`. Provides state management and persistence for `SyllabusDevelopmentRecord`s grouped by `(code, title, schoolYear, semester, collegeId)`. Live presence and tab collaboration uses browser `BroadcastChannel` with section-level autosave to Likha ERP. Renders role-adaptive governance tables for Chair/Dean and assigned course studios for faculty on `/page1`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS, Lucide icons, Vitest, Testing Library, Web `BroadcastChannel` API.

**Spec:** [`docs/superpowers/specs/2026-10-29-syllabus-lifecycle-and-collaboration-design.md`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/docs/superpowers/specs/2026-10-29-syllabus-lifecycle-and-collaboration-design.md)

## Global Constraints

- Domain encapsulation strictly inside `client/src/features/syllabus/` with exports defined in `client/src/features/syllabus/index.ts`. No deep internal imports.
- No frontend cascading deletes or service account elevations in client bundles (per `AGENTS.md`).
- Collaboration relies on section-level sync and presence notices via Likha REST API and `BroadcastChannel`, with zero external server dependencies.
- Evaluator pool restricted strictly to collegiate faculty, excluding the course's own instructors.
- 100% green tests on vitest before completion; zero TypeScript compiler errors (`tsc -b`).

## Review Focus

1. **Single Instructor Auto-Consensus**: When a course has only one assigned instructor, clicking "Agree to Submit" immediately transitions status to `ready_for_evaluation` without waiting for peer approvals.
2. **Conflict of Interest Gate**: Course instructors are strictly excluded from the evaluator selection pool for their own courses.
3. **Collegiate Boundary Scoping**: Evaluator candidates and department table courses are scoped strictly to `activeUser.collegeId`.
4. **Revision Agreement Reset**: When an evaluator requests revisions, all co-instructors' submission agreements reset to `false`, requiring unanimous re-confirmation before resubmitting.
5. **Multi-Section Fan-out on Approval**: When the Dean approves, all individual section courses in `record.courseIds` have their `course.syllabus` populated with the finalized institutional syllabus data.

---

### Task 1: Domain Types and Lifecycle Interfaces

**Files:**
- Create: `client/src/features/syllabus/types/lifecycle.ts`
- Modify: `client/src/features/syllabus/index.ts`
- Test: `client/src/features/syllabus/types/lifecycle.test.ts`

**Interfaces:**
- Consumes: `OfficialSyllabusData` from `client/src/shared/data/syllabusData.ts`
- Produces: `SyllabusLifecycleStatus`, `EvaluatorReview`, `SyllabusDevelopmentRecord`, `SyllabusGroup`

- [ ] **Step 1: Write the failing type contract test**

```typescript
// client/src/features/syllabus/types/lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import type { SyllabusLifecycleStatus, SyllabusDevelopmentRecord } from './lifecycle';

describe('Syllabus Lifecycle Types', () => {
  it('validates lifecycle status enum values and development record structure', () => {
    const statuses: SyllabusLifecycleStatus[] = [
      'locked',
      'in_development',
      'submission_in_progress',
      'ready_for_evaluation',
      'under_evaluation',
      'revisions_required',
      'evaluator_approved',
      'chair_approved',
      'approved'
    ];
    expect(statuses).toHaveLength(9);

    const record: Partial<SyllabusDevelopmentRecord> = {
      id: 'SYL-CSPC103-2026',
      courseCode: 'CSPC 103',
      status: 'locked',
      submissionAgreements: { 'inst-1': true },
      evaluators: []
    };
    expect(record.status).toBe('locked');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/types/lifecycle.test.ts --run`
Expected: FAIL (Cannot find module `./lifecycle`)

- [ ] **Step 3: Implement `client/src/features/syllabus/types/lifecycle.ts` and update `index.ts`**

Define `SyllabusLifecycleStatus`, `EvaluatorReview`, `SyllabusDevelopmentRecord`, and `SyllabusGroup`. Export them from `client/src/features/syllabus/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/types/lifecycle.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/types/lifecycle.ts client/src/features/syllabus/types/lifecycle.test.ts client/src/features/syllabus/index.ts
git commit -m "feat(syllabus): define syllabus lifecycle and collaboration domain types"
```

---

### Task 2: Syllabus Lifecycle State Management Hook

**Files:**
- Create: `client/src/features/syllabus/hooks/useSyllabusLifecycle.ts`
- Test: `client/src/features/syllabus/hooks/useSyllabusLifecycle.test.ts`
- Modify: `client/src/features/syllabus/index.ts`

**Interfaces:**
- Consumes: `useLMS` from `client/src/shared/context/LMSContext.tsx`, `SyllabusDevelopmentRecord` from Task 1
- Produces: `useSyllabusLifecycle()` returning `records`, `groups`, `releaseCourses()`, `proposeSubmission()`, `confirmAgreement()`, `assignEvaluators()`, `submitEvaluatorReview()`, `chairApprove()`, `deanApprove()`

- [ ] **Step 1: Write the failing hook test**

```typescript
// client/src/features/syllabus/hooks/useSyllabusLifecycle.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyllabusLifecycle } from './useSyllabusLifecycle';

describe('useSyllabusLifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes course groups from courses and defaults status to locked', () => {
    const mockCourses = [
      { id: 'c1', code: 'CSPC 103', title: 'IKM', section: '3A', instructorId: 'u1', instructorName: 'Santos', schoolYear: '2026-2027', semester: 'First', collegeId: 'col-1' },
      { id: 'c2', code: 'CSPC 103', title: 'IKM', section: '3B', instructorId: 'u2', instructorName: 'Reyes', schoolYear: '2026-2027', semester: 'First', collegeId: 'col-1' },
    ];
    const { result } = renderHook(() => useSyllabusLifecycle(mockCourses as any, 'col-1'));
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].courseCode).toBe('CSPC 103');
    expect(result.current.groups[0].status).toBe('locked');
  });

  it('releases course for development and tracks multi-instructor submission agreement', () => {
    const mockCourses = [
      { id: 'c1', code: 'CSPC 103', title: 'IKM', section: '3A', instructorId: 'u1', instructorName: 'Santos', schoolYear: '2026-2027', semester: 'First', collegeId: 'col-1' },
      { id: 'c2', code: 'CSPC 103', title: 'IKM', section: '3B', instructorId: 'u2', instructorName: 'Reyes', schoolYear: '2026-2027', semester: 'First', collegeId: 'col-1' },
    ];
    const { result } = renderHook(() => useSyllabusLifecycle(mockCourses as any, 'col-1'));
    const groupId = result.current.groups[0].id;

    act(() => {
      result.current.releaseCourses([groupId], 'chair-1');
    });
    expect(result.current.getRecord(groupId)?.status).toBe('in_development');

    // First instructor agrees -> submission_in_progress
    act(() => {
      result.current.confirmAgreement(groupId, 'u1');
    });
    expect(result.current.getRecord(groupId)?.status).toBe('submission_in_progress');

    // Second instructor agrees -> ready_for_evaluation
    act(() => {
      result.current.confirmAgreement(groupId, 'u2');
    });
    expect(result.current.getRecord(groupId)?.status).toBe('ready_for_evaluation');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/hooks/useSyllabusLifecycle.test.ts --run`
Expected: FAIL (Cannot find module `./useSyllabusLifecycle`)

- [ ] **Step 3: Implement `client/src/features/syllabus/hooks/useSyllabusLifecycle.ts`**

Group courses by canonical key `(code, title, schoolYear, semester, collegeId)`. Maintain records in local storage with automatic keying. Implement transitions:
- `releaseCourses(groupIds, chairId)` -> sets status `in_development`
- `confirmAgreement(groupId, instructorId)` -> sets agreement; if 100% agreed transitions to `ready_for_evaluation`, else `submission_in_progress`
- `assignEvaluators(groupId, evaluatorIds)` -> sets status `under_evaluation`
- `submitEvaluatorReview(groupId, evaluatorId, status, remarks)` -> if revisions requested, sets `revisions_required` and resets agreements; if all evaluators approve, sets `evaluator_approved`
- `chairApprove(groupId, chairId)` -> sets `chair_approved`
- `deanApprove(groupId, deanId, onSyncCourse)` -> sets `approved` and calls sync callback for course section fan-out.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/hooks/useSyllabusLifecycle.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/hooks/useSyllabusLifecycle.ts client/src/features/syllabus/hooks/useSyllabusLifecycle.test.ts client/src/features/syllabus/index.ts
git commit -m "feat(syllabus): implement syllabus lifecycle governance state hook"
```

---

### Task 3: Collaboration & Real-Time Presence Hook

**Files:**
- Create: `client/src/features/syllabus/hooks/useSyllabusCollaboration.ts`
- Test: `client/src/features/syllabus/hooks/useSyllabusCollaboration.test.ts`
- Modify: `client/src/features/syllabus/index.ts`

**Interfaces:**
- Consumes: Web `BroadcastChannel` API, `activeUser`
- Produces: `useSyllabusCollaboration(groupId, activeUser, activeStep)` returning `collaborators`, `broadcastStepChange()`, `broadcastSectionUpdate()`

- [ ] **Step 1: Write the failing collaboration hook test**

```typescript
// client/src/features/syllabus/hooks/useSyllabusCollaboration.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyllabusCollaboration } from './useSyllabusCollaboration';

describe('useSyllabusCollaboration', () => {
  it('broadcasts presence and tracks active peer collaborators', () => {
    const userA = { id: 'u1', name: 'Prof. Santos' };
    const { result: hookA } = renderHook(() => useSyllabusCollaboration('grp-1', userA, 'course-info'));

    expect(hookA.current.collaborators).toEqual([]);
    
    // Simulate peer presence message
    act(() => {
      hookA.current.handlePeerMessage({
        type: 'PRESENCE_PING',
        groupId: 'grp-1',
        senderId: 'u2',
        senderName: 'Prof. Reyes',
        activeStep: 'learning-plan',
        timestamp: Date.now()
      });
    });

    expect(hookA.current.collaborators).toHaveLength(1);
    expect(hookA.current.collaborators[0].senderName).toBe('Prof. Reyes');
    expect(hookA.current.collaborators[0].activeStep).toBe('learning-plan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/hooks/useSyllabusCollaboration.test.ts --run`
Expected: FAIL (Cannot find module `./useSyllabusCollaboration`)

- [ ] **Step 3: Implement `client/src/features/syllabus/hooks/useSyllabusCollaboration.ts`**

Setup `new BroadcastChannel('gabay_syllabus_live_sync')`.
Listen for `message` events, filter by `groupId !== activeGroupId`, and maintain active peers with heartbeats. Export collaborator state and action dispatchers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/hooks/useSyllabusCollaboration.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/hooks/useSyllabusCollaboration.ts client/src/features/syllabus/hooks/useSyllabusCollaboration.test.ts client/src/features/syllabus/index.ts
git commit -m "feat(syllabus): implement peer presence and broadcast collaboration hook"
```

---

### Task 4: Department Syllabus Governance & Monitoring Table

**Files:**
- Create: `client/src/features/syllabus/components/governance/DepartmentSyllabusTable.tsx`
- Test: `client/src/features/syllabus/components/governance/DepartmentSyllabusTable.test.tsx`
- Modify: `client/src/features/syllabus/index.ts`

**Interfaces:**
- Consumes: `SyllabusGroup` and lifecycle callbacks from Task 2
- Produces: `DepartmentSyllabusTable` component rendering summary statistics, search/status filters, multi-select checkboxes, bulk actions, and row actions.

- [ ] **Step 1: Write the failing table test**

```typescript
// client/src/features/syllabus/components/governance/DepartmentSyllabusTable.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DepartmentSyllabusTable } from './DepartmentSyllabusTable';

describe('DepartmentSyllabusTable', () => {
  const mockGroups = [
    {
      id: 'grp-1',
      courseCode: 'CSPC 103',
      courseTitle: 'Information and Knowledge Management',
      schoolYear: '2026-2027',
      semester: 'First',
      collegeId: 'col-1',
      departmentId: 'dept-1',
      courseIds: ['c1', 'c2'],
      instructorIds: ['u1', 'u2'],
      instructorNames: ['Santos', 'Reyes'],
      sections: ['BSCS 3A', 'BSCS 3B'],
      status: 'locked' as const,
      submissionAgreements: {},
      evaluators: [],
      updatedAt: new Date().toISOString()
    }
  ];

  it('renders course table with locked status and allows bulk selection', () => {
    const onRelease = vi.fn();
    render(
      <DepartmentSyllabusTable
        groups={mockGroups}
        userRole="chairperson"
        onReleaseCourses={onRelease}
        onAssignEvaluators={vi.fn()}
        onChairApprove={vi.fn()}
        onDeanApprove={vi.fn()}
        onOpenPreview={vi.fn()}
      />
    );

    expect(screen.getByText('CSPC 103')).toBeInTheDocument();
    expect(screen.getByText(/Information and Knowledge Management/i)).toBeInTheDocument();
    expect(screen.getByText(/Locked/i)).toBeInTheDocument();

    // Check row checkbox
    const checkbox = screen.getByRole('checkbox', { name: /select cspc 103/i });
    fireEvent.click(checkbox);

    // Bulk bar appears
    const releaseBtn = screen.getByRole('button', { name: /release selected/i });
    fireEvent.click(releaseBtn);
    expect(onRelease).toHaveBeenCalledWith(['grp-1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/components/governance/DepartmentSyllabusTable.test.tsx --run`
Expected: FAIL (Cannot find module `./DepartmentSyllabusTable`)

- [ ] **Step 3: Implement `client/src/features/syllabus/components/governance/DepartmentSyllabusTable.tsx`**

Build the table layout matching Gabay UI standards:
- Status badges with icons (`Lock`, `FileEdit`, `Clock`, `UserCheck`, `CheckCircle2`, `AlertTriangle`).
- Checkbox selection with master toggle.
- Search input and status dropdown filter (`All`, `Locked`, `In Development`, `Ready for Evaluation`, `Approved`).
- Bulk action floating banner when rows are selected.
- Single row action menu (`Release`, `Assign Evaluators`, `Endorse`, `Approve`, `Preview`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/components/governance/DepartmentSyllabusTable.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/governance/DepartmentSyllabusTable.tsx client/src/features/syllabus/components/governance/DepartmentSyllabusTable.test.tsx client/src/features/syllabus/index.ts
git commit -m "feat(syllabus): implement department syllabus tracking and governance table"
```

---

### Task 5: Evaluator Assignment Modal (Collegiate Scope & Conflict Gate)

**Files:**
- Create: `client/src/features/syllabus/components/governance/AssignEvaluatorsModal.tsx`
- Test: `client/src/features/syllabus/components/governance/AssignEvaluatorsModal.test.tsx`
- Modify: `client/src/features/syllabus/index.ts`

**Interfaces:**
- Consumes: `SyllabusGroup`, `db.users`, `activeUser`
- Produces: `AssignEvaluatorsModal` allowing multi-selection of faculty in the same college while excluding course instructors.

- [ ] **Step 1: Write the failing modal test**

```typescript
// client/src/features/syllabus/components/governance/AssignEvaluatorsModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignEvaluatorsModal } from './AssignEvaluatorsModal';

describe('AssignEvaluatorsModal', () => {
  const mockGroup = {
    id: 'grp-1',
    courseCode: 'CSPC 103',
    courseTitle: 'IKM',
    collegeId: 'col-1',
    instructorIds: ['u1'], // Santos is the instructor
    evaluators: []
  };

  const mockUsers = [
    { id: 'u1', name: 'Prof. Santos', role: 'faculty', collegeId: 'col-1' }, // Course instructor (must be excluded)
    { id: 'u2', name: 'Prof. Reyes', role: 'faculty', collegeId: 'col-1' },   // Eligible
    { id: 'u3', name: 'Prof. Garcia', role: 'faculty', collegeId: 'col-1' },  // Eligible
    { id: 'u4', name: 'Prof. Lee', role: 'faculty', collegeId: 'col-2' },     // Different college (must be excluded)
  ];

  it('filters evaluators strictly to same college and excludes course instructors', () => {
    const onConfirm = vi.fn();
    render(
      <AssignEvaluatorsModal
        isOpen={true}
        group={mockGroup as any}
        users={mockUsers as any}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    expect(screen.queryByText('Prof. Santos')).not.toBeInTheDocument();
    expect(screen.queryByText('Prof. Lee')).not.toBeInTheDocument();
    expect(screen.getByText('Prof. Reyes')).toBeInTheDocument();
    expect(screen.getByText('Prof. Garcia')).toBeInTheDocument();

    // Select Reyes and Garcia
    fireEvent.click(screen.getByText('Prof. Reyes'));
    fireEvent.click(screen.getByText('Prof. Garcia'));

    const confirmBtn = screen.getByRole('button', { name: /confirm assignment/i });
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith('grp-1', ['u2', 'u3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/components/governance/AssignEvaluatorsModal.test.tsx --run`
Expected: FAIL (Cannot find module `./AssignEvaluatorsModal`)

- [ ] **Step 3: Implement `client/src/features/syllabus/components/governance/AssignEvaluatorsModal.tsx`**

Build the modal with search input, multi-select checkboxes/chips, collegiate scoping check, and instructor exclusion rule.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/components/governance/AssignEvaluatorsModal.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/governance/AssignEvaluatorsModal.tsx client/src/features/syllabus/components/governance/AssignEvaluatorsModal.test.tsx client/src/features/syllabus/index.ts
git commit -m "feat(syllabus): implement collegiate evaluator assignment modal with conflict exclusion"
```

---

### Task 6: Evaluator Review Modal & Revision Remarks Banner

**Files:**
- Create: `client/src/features/syllabus/components/governance/EvaluatorReviewModal.tsx`
- Create: `client/src/features/syllabus/components/creator/RevisionRemarksBanner.tsx`
- Test: `client/src/features/syllabus/components/governance/EvaluatorReviewModal.test.tsx`
- Modify: `client/src/features/syllabus/index.ts`

**Interfaces:**
- Consumes: `SyllabusGroup`, `EvaluatorReview`
- Produces: `EvaluatorReviewModal` with "Approve" and "Request Revisions" actions, and `RevisionRemarksBanner` for displaying reviewer comments.

- [ ] **Step 1: Write the failing review modal test**

```typescript
// client/src/features/syllabus/components/governance/EvaluatorReviewModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvaluatorReviewModal } from './EvaluatorReviewModal';

describe('EvaluatorReviewModal', () => {
  it('requires remarks when requesting revisions and calls onReview', () => {
    const onReview = vi.fn();
    render(
      <EvaluatorReviewModal
        isOpen={true}
        groupId="grp-1"
        courseCode="CSPC 103"
        onClose={vi.fn()}
        onReview={onReview}
      />
    );

    // Click Request Revisions without text -> error or disabled
    const requestBtn = screen.getByRole('button', { name: /request revisions/i });
    fireEvent.click(requestBtn);
    expect(screen.getByText(/please enter revision remarks/i)).toBeInTheDocument();

    // Fill remarks and submit
    const textarea = screen.getByPlaceholderText(/specify required revisions/i);
    fireEvent.change(textarea, { target: { value: 'Fix Week 4 SDG alignment' } });
    fireEvent.click(requestBtn);

    expect(onReview).toHaveBeenCalledWith('grp-1', 'revisions_requested', 'Fix Week 4 SDG alignment');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/components/governance/EvaluatorReviewModal.test.tsx --run`
Expected: FAIL (Cannot find module `./EvaluatorReviewModal`)

- [ ] **Step 3: Implement `EvaluatorReviewModal.tsx` and `RevisionRemarksBanner.tsx`**

Implement review dialog with validation and banner displaying reviewer name, timestamp, and comments.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/components/governance/EvaluatorReviewModal.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/governance/EvaluatorReviewModal.tsx client/src/features/syllabus/components/creator/RevisionRemarksBanner.tsx client/src/features/syllabus/components/governance/EvaluatorReviewModal.test.tsx client/src/features/syllabus/index.ts
git commit -m "feat(syllabus): implement evaluator review dialog and revision remarks banner"
```

---

### Task 7: Co-Instructor Unanimous Submission Panel & Chair/Dean Modals

**Files:**
- Create: `client/src/features/syllabus/components/creator/CoInstructorSubmissionPanel.tsx`
- Create: `client/src/features/syllabus/components/governance/ApprovalActionModal.tsx`
- Test: `client/src/features/syllabus/components/creator/CoInstructorSubmissionPanel.test.tsx`
- Modify: `client/src/features/syllabus/components/creator/steps/Step7ReviewSignatories.tsx`
- Modify: `client/src/features/syllabus/index.ts`

**Interfaces:**
- Consumes: `SyllabusGroup`, `activeUser`
- Produces: `CoInstructorSubmissionPanel` inside Step 7 of the wizard, and `ApprovalActionModal` for Chair and Dean.

- [ ] **Step 1: Write the failing co-instructor submission test**

```typescript
// client/src/features/syllabus/components/creator/CoInstructorSubmissionPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoInstructorSubmissionPanel } from './CoInstructorSubmissionPanel';

describe('CoInstructorSubmissionPanel', () => {
  it('renders all co-instructors with their status and provides agreement toggle', () => {
    const onAgree = vi.fn();
    render(
      <CoInstructorSubmissionPanel
        currentUserId="u1"
        instructors={[
          { id: 'u1', name: 'Prof. Santos (3A)', hasAgreed: false },
          { id: 'u2', name: 'Prof. Reyes (3B)', hasAgreed: true }
        ]}
        onAgreeToSubmit={onAgree}
      />
    );

    expect(screen.getByText(/Prof. Santos/i)).toBeInTheDocument();
    expect(screen.getByText(/Prof. Reyes/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready ✓/i)).toBeInTheDocument();

    const agreeBtn = screen.getByRole('button', { name: /agree to submit syllabus/i });
    fireEvent.click(agreeBtn);
    expect(onAgree).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/CoInstructorSubmissionPanel.test.tsx --run`
Expected: FAIL (Cannot find module `./CoInstructorSubmissionPanel`)

- [ ] **Step 3: Implement `CoInstructorSubmissionPanel.tsx`, `ApprovalActionModal.tsx`, and mount into Step 7**

Mount `CoInstructorSubmissionPanel` into Step 7 so that when a course group has multiple instructors, submission is gated until 100% agreement.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/CoInstructorSubmissionPanel.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/CoInstructorSubmissionPanel.tsx client/src/features/syllabus/components/governance/ApprovalActionModal.tsx client/src/features/syllabus/components/creator/CoInstructorSubmissionPanel.test.tsx client/src/features/syllabus/components/creator/steps/Step7ReviewSignatories.tsx client/src/features/syllabus/index.ts
git commit -m "feat(syllabus): implement co-instructor consensus panel and leadership approval dialogs"
```

---

### Task 8: Integrate Role-Adaptive Hub into `SyllabusCreatorPage.tsx`

**Files:**
- Modify: `client/src/features/syllabus/SyllabusCreatorPage.tsx`
- Test: `client/src/features/syllabus/SyllabusCreatorPage.lifecycle.test.tsx`
- Modify: `client/src/features/syllabus/index.ts`

**Interfaces:**
- Consumes: `DepartmentSyllabusTable`, `useSyllabusLifecycle`, `useSyllabusCollaboration`, `useLMS`
- Produces: Unified role-adaptive `/page1` view:
  - Chair/Dean: Department syllabus roster & governance table with release/approval workflows.
  - Faculty: "My Assigned Courses" tab (showing locked vs. released courses and agreement statuses), "Evaluations Assigned to Me", and "Personal Sandbox / Templates".

- [ ] **Step 1: Write the failing integrated page test**

```typescript
// client/src/features/syllabus/SyllabusCreatorPage.lifecycle.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyllabusCreatorPage } from './SyllabusCreatorPage';
import { LMSProvider } from '../../shared/context/LMSContext';

describe('SyllabusCreatorPage Lifecycle Integration', () => {
  it('renders Department Syllabus Governance table for Chairperson', () => {
    // Render with chairperson persona
    render(
      <LMSProvider>
        <SyllabusCreatorPage />
      </LMSProvider>
    );
    expect(screen.getByText(/Syllabus Development/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/SyllabusCreatorPage.lifecycle.test.tsx --run`

- [ ] **Step 3: Update `SyllabusCreatorPage.tsx` with role adaptation**

Render role-adaptive view:
- If Chairperson / Dean: Primary tab is Department Syllabus Tracking table.
- If Faculty: Primary tab is Assigned Courses with release badges; secondary tab is Personal Sandbox; tertiary section is Assigned Evaluations.
- Inject active peer presence chips in the authoring wizard header.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/SyllabusCreatorPage.lifecycle.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Run full test suite and client build**

Run:
```bash
npm --prefix client test -- src/features/syllabus --run
npm --prefix client test -- src/shared/components/common/dropdownConsistency.test.ts --run
npm --prefix client run build
```
Expected: All tests pass (100% green), zero build errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/syllabus/SyllabusCreatorPage.tsx client/src/features/syllabus/SyllabusCreatorPage.lifecycle.test.tsx client/src/features/syllabus/index.ts
git commit -m "feat(syllabus): integrate role-adaptive governance hub and assigned course workflows"
```

---

### Task 9: Full End-to-End Pressure Testing & Final Verification

**Files:**
- Create: `client/src/features/syllabus/SyllabusLifecycleE2E.test.tsx`
- Modify: `docs/superpowers/specs/2026-10-29-syllabus-lifecycle-and-collaboration-design.md`

**Interfaces:**
- Consumes: Complete syllabus workflow
- Produces: Comprehensive test covering:
  1. Course creation via Chair-Sheet -> Starts `locked`.
  2. Chair releases course -> Status becomes `in_development`.
  3. Co-instructor 1 agrees -> `submission_in_progress`.
  4. Co-instructor 2 agrees -> `ready_for_evaluation`.
  5. Chair assigns 2 evaluators -> `under_evaluation`.
  6. Evaluator 1 requests revisions -> `revisions_required`, agreements reset.
  7. Instructors re-agree -> `ready_for_evaluation`.
  8. Both evaluators approve -> `evaluator_approved`.
  9. Chair approves -> `chair_approved`.
  10. Dean approves -> `approved` & propagates syllabus to all section courses.

- [ ] **Step 1: Write E2E test covering the complete 10-step lifecycle**
- [ ] **Step 2: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/SyllabusLifecycleE2E.test.tsx --run`
Expected: PASS

- [ ] **Step 3: Execute full suite check and production build**

Run:
```bash
npm --prefix client test -- src/features/syllabus --run
npm --prefix client run build
```
Expected: 100% green, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/syllabus/SyllabusLifecycleE2E.test.tsx
git commit -m "test(syllabus): add comprehensive end-to-end pressure test for university syllabus lifecycle"
```
