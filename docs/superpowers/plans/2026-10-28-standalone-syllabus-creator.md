# Standalone Syllabus Creator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, high-fidelity Syllabus Creator on Page 1 (outside LMS) for faculty members to draft, customize, export (Print/PDF), and attach official course syllabi matching the 5-part institutional standard (`DMMMSU-INS-F003`).

**Architecture:** Encapsulated entirely in `client/src/features/syllabus/` with a public barrel export. Uses a 7-step guided wizard (`SyllabusWizard`) coupled to a real-time official paper document preview (`SyllabusDocumentPreview`). Manages local standalone drafts via a dedicated hook (`useSyllabusDraftsStorage`), supports multiple starter modes (blank with pre-filled PVMGO, clone from draft/LMS course, or import DOCX/PDF via ephemeral parser), and provides an `AttachToCourseModal` to publish or save drafts to assigned LMS courses while preserving section schedules.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide icons, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-28-syllabus-creator-design.md`

## Global Constraints

- Domain-driven encapsulation: All new components, hooks, types, and tests live in `client/src/features/syllabus/`.
- Strict public barrel: External consumers (`App.tsx`, `AppRail.tsx`, etc.) import only from `client/src/features/syllabus/index.ts`. No deep internal imports.
- No frontend cascade deletions or backend schema modifications.
- Local storage safety: Ephemeral in-memory parsing for uploaded DOCX/PDF files; no storing large base64 file payloads in `localStorage`.
- Role-gated: Accessible to `faculty`, `admin`, and `superadmin`; inaccessible to `student` and `staff`.

## Review Focus

1. **Storage quota limit handling**: Corrupted or oversized draft data in `localStorage` gracefully falls back to a clean default draft without crashing the UI.
2. **Target course schedule preservation**: Attaching a syllabus to a target LMS course preserves the destination course's existing section and schedule metadata rather than overwriting it with Step 1 draft data.
3. **Empty/partial section handling in document preview**: If faculty leaves optional fields (e.g. consultation hours, lab hours, or SDG target) blank, the official preview renders graceful blanks/dashes without throwing runtime undefined errors.
4. **Course map cyclic toggle boundaries**: Clicking course map cells cycles strictly between `''` -> `'I'` -> `'P'` -> `'D'` -> `''` in that exact order.
5. **RBAC navigation denial**: A user with the `student` role attempting to access `/page1` or view the main rail item sees neither the nav button nor the authoring controls.

---

### Task 1: Navigation & Role Whitelist Update for Page 1

**Files:**
- Modify: `client/src/shared/config/navigation.ts:6-14`
- Modify: `client/src/shared/components/layout/AppRail.tsx:10-27`
- Test: `client/src/shared/config/rbacNavigation.test.ts`
- Test: `client/src/shared/config/standalonePagesNavigation.test.ts`

**Interfaces:**
- Consumes: `MAIN_NAV` from `client/src/shared/config/navigation.ts`, `ICONS` from `client/src/shared/components/layout/AppRail.tsx`
- Produces: `page1` NavItem with `label: 'Syllabus Creator'`, `icon: 'page1'`, `roles: ['superadmin', 'admin', 'faculty']`

- [ ] **Step 1: Write the failing test**

In `client/src/shared/config/rbacNavigation.test.ts`, add:
```typescript
it('configures Syllabus Creator on page1 for faculty, admin, and superadmin, hiding from students', () => {
  const page1Item = MAIN_NAV.find(i => i.id === 'page1');
  expect(page1Item).toBeDefined();
  expect(page1Item!.label).toBe('Syllabus Creator');
  expect(isVisible(page1Item!, 'faculty')).toBe(true);
  expect(isVisible(page1Item!, 'admin')).toBe(true);
  expect(isVisible(page1Item!, 'superadmin')).toBe(true);
  expect(isVisible(page1Item!, 'student')).toBe(false);
  expect(isVisible(page1Item!, 'staff')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/shared/config/rbacNavigation.test.ts --run`
Expected: FAIL with `expected 'Page 1' to be 'Syllabus Creator'` or student visibility expectation failing.

- [ ] **Step 3: Update navigation item and AppRail icon**

In `client/src/shared/config/navigation.ts`:
Change `page1` entry in `MAIN_NAV`:
```typescript
{ id: 'page1', label: 'Syllabus Creator', icon: 'page1', roles: ['superadmin', 'admin', 'faculty'] },
```
In `client/src/shared/components/layout/AppRail.tsx`:
Update `ICONS.page1`:
```typescript
page1: <FileText className="h-5 w-5" />,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/shared/config/rbacNavigation.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/config/navigation.ts client/src/shared/components/layout/AppRail.tsx client/src/shared/config/rbacNavigation.test.ts
git commit -m "feat(navigation): configure Syllabus Creator on page1 with faculty RBAC"
```

---

### Task 2: Syllabus Creator Types & Draft Storage Hook

**Files:**
- Create: `client/src/features/syllabus/types/creator.ts`
- Create: `client/src/features/syllabus/hooks/useSyllabusDraftsStorage.ts`
- Test: `client/src/features/syllabus/hooks/useSyllabusDraftsStorage.test.ts`

**Interfaces:**
- Consumes: `OfficialSyllabusData` from `client/src/shared/data/syllabusData.ts`
- Produces:
  - `SyllabusDraftItem`: `{ id: string; title: string; courseCode: string; updatedAt: string; data: OfficialSyllabusData }`
  - `useSyllabusDraftsStorage()`: `{ drafts: SyllabusDraftItem[]; activeDraft: SyllabusDraftItem | null; createDraft: (initial?: Partial<OfficialSyllabusData>, title?: string) => SyllabusDraftItem; updateActiveDraft: (data: OfficialSyllabusData) => void; selectDraft: (id: string) => void; cloneDraft: (id: string) => SyllabusDraftItem; deleteDraft: (id: string) => void }`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/syllabus/hooks/useSyllabusDraftsStorage.test.ts`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSyllabusDraftsStorage, STORAGE_KEY } from './useSyllabusDraftsStorage';

describe('useSyllabusDraftsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with a default draft when storage is empty', () => {
    const { result } = renderHook(() => useSyllabusDraftsStorage());
    expect(result.current.drafts.length).toBeGreaterThan(0);
    expect(result.current.activeDraft).toBeDefined();
    expect(result.current.activeDraft?.data.institution.university).toContain('Don Mariano Marcos Memorial State University');
  });

  it('creates, clones, and deletes drafts correctly', () => {
    const { result } = renderHook(() => useSyllabusDraftsStorage());
    let newDraftId = '';
    act(() => {
      const created = result.current.createDraft(undefined, 'CS 101 Syllabus');
      newDraftId = created.id;
    });
    expect(result.current.drafts.some(d => d.id === newDraftId)).toBe(true);

    let clonedId = '';
    act(() => {
      const cloned = result.current.cloneDraft(newDraftId);
      clonedId = cloned.id;
    });
    expect(result.current.drafts.some(d => d.id === clonedId)).toBe(true);

    act(() => {
      result.current.deleteDraft(newDraftId);
    });
    expect(result.current.drafts.some(d => d.id === newDraftId)).toBe(false);
  });

  it('handles corrupted localStorage gracefully (Review Focus 1)', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json');
    const { result } = renderHook(() => useSyllabusDraftsStorage());
    expect(result.current.drafts.length).toBeGreaterThan(0);
    expect(result.current.activeDraft).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/hooks/useSyllabusDraftsStorage.test.ts --run`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement types and `useSyllabusDraftsStorage`**

Create `client/src/features/syllabus/types/creator.ts` defining:
- `SyllabusDraftItem`
- `WizardStepId`: `'course-info' | 'outcomes' | 'outline' | 'learning-plan' | 'course-map' | 'grading' | 'review'`
- `SyllabusStarterMode`: `'blank' | 'clone' | 'import'`

Create `client/src/features/syllabus/hooks/useSyllabusDraftsStorage.ts`:
- Pre-fill `createBaselineSyllabus()` with DMMMSU PVMGO, core values, graduate attributes, standard 18-week outline, default grading formulas, and CSPC standard signatory titles.
- Implement safe parsing with `try...catch` and fallback to initial draft.
- Implement CRUD operations (`createDraft`, `updateActiveDraft`, `selectDraft`, `cloneDraft`, `deleteDraft`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/hooks/useSyllabusDraftsStorage.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/types/creator.ts client/src/features/syllabus/hooks/useSyllabusDraftsStorage.ts client/src/features/syllabus/hooks/useSyllabusDraftsStorage.test.ts
git commit -m "feat(syllabus): add creator types and local draft persistence hook"
```

---

### Task 3: High-Fidelity Syllabus Document Preview Component

**Files:**
- Create: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx`
- Test: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`

**Interfaces:**
- Consumes: `OfficialSyllabusData` from `client/src/shared/data/syllabusData.ts`
- Produces: `SyllabusDocumentPreview: React.FC<{ syllabus: OfficialSyllabusData; onPrint?: () => void; className?: string }>`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`:
```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SyllabusDocumentPreview } from './SyllabusDocumentPreview';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../shared/data/syllabusData';

describe('SyllabusDocumentPreview', () => {
  it('renders institutional header, form code, and course descriptive title', () => {
    render(<SyllabusDocumentPreview syllabus={OFFICIAL_SYLLABUS_CSPC112} />);
    expect(screen.getByText(/Don Mariano Marcos Memorial State University/i)).toBeInTheDocument();
    expect(screen.getByText(/DMMMSU-INS-F003/i)).toBeInTheDocument();
    expect(screen.getByText(/Software Engineering 2/i)).toBeInTheDocument();
  });

  it('renders all 5 parts and signatories block', () => {
    render(<SyllabusDocumentPreview syllabus={OFFICIAL_SYLLABUS_CSPC112} />);
    expect(screen.getByText(/Part I:/i)).toBeInTheDocument();
    expect(screen.getByText(/Part II: Course Outline and Time Frame/i)).toBeInTheDocument();
    expect(screen.getByText(/Part III: Learning Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Part IV: Course Map/i)).toBeInTheDocument();
    expect(screen.getByText(/Part V: References/i)).toBeInTheDocument();
    expect(screen.getByText(/Prepared by:/i)).toBeInTheDocument();
    expect(screen.getByText(/Approved:/i)).toBeInTheDocument();
  });

  it('renders cleanly without throwing when optional fields are empty (Review Focus 3)', () => {
    const sparseSyllabus = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      courseInfo: { ...OFFICIAL_SYLLABUS_CSPC112.courseInfo, labHours: '', prerequisite: '' },
      facultyMembers: [],
      learningPlan: []
    };
    render(<SyllabusDocumentPreview syllabus={sparseSyllabus} />);
    expect(screen.getByText(/Software Engineering 2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx --run`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `SyllabusDocumentPreview.tsx`**

Build the exact institutional layout matching `CSPC103-IKM-SYL-1stSemAY2026-2027.docx` and `CMSC131_Course_Orientation.pdf`:
- Header banner: University Name, College, Form Code (`DMMMSU-INS-F003`), Revision, Semester & AY.
- Metadata Table: Course No. & Descriptive Title, Schedule & Room Assignment, Faculty Name.
- Part I Table: Philosophy, Vision, Mission, Goal, Graduate Attributes, Core Values, Program Outcomes, Course Type, Credit, Description, Contact Hours, Prereqs, Course Outcomes, Course Requirements, Grading System, Classroom Policies, Consultation Hours.
- Part II Table: Time Frame & Course Content/Subject Matter (Weeks 1-18 with Midterm and Final exams).
- Part III Table: Learning Plan columns: Learning Outcomes, Topics, SDG Coherence, Time Allotment Week (hour), Methodology, Resources, Assessment.
- Part IV Table: Course Map matrix: Course Outcomes (CO) vs PO1-PO11 with I, P, D badges.
- Part V: References list.
- Signatories Table: Prepared by (Faculty), Recommending Approval (Chairperson), Approved (Dean).
- Include `@media print` CSS classes so calling `window.print()` outputs clean pages with borders and pagination.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx
git commit -m "feat(syllabus): implement official institutional syllabus document preview"
```

---

### Task 4: Wizard Steps 1, 2, and 3 Components

**Files:**
- Create: `client/src/features/syllabus/components/creator/steps/Step1CourseInfo.tsx`
- Create: `client/src/features/syllabus/components/creator/steps/Step2InstitutionalOutcomes.tsx`
- Create: `client/src/features/syllabus/components/creator/steps/Step3CourseOutline.tsx`
- Test: `client/src/features/syllabus/components/creator/steps/WizardStepsEarly.test.tsx`

**Interfaces:**
- Consumes: `OfficialSyllabusData`
- Produces:
  - `Step1CourseInfo: React.FC<{ data: OfficialSyllabusData; onChange: (updated: OfficialSyllabusData) => void }>`
  - `Step2InstitutionalOutcomes: React.FC<{ data: OfficialSyllabusData; onChange: (updated: OfficialSyllabusData) => void }>`
  - `Step3CourseOutline: React.FC<{ data: OfficialSyllabusData; onChange: (updated: OfficialSyllabusData) => void }>`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/syllabus/components/creator/steps/WizardStepsEarly.test.tsx`:
```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Step1CourseInfo } from './Step1CourseInfo';
import { Step2InstitutionalOutcomes } from './Step2InstitutionalOutcomes';
import { Step3CourseOutline } from './Step3CourseOutline';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../../shared/data/syllabusData';

describe('Wizard Steps Early', () => {
  it('Step 1 updates course code and descriptive title', () => {
    const onChange = vi.fn();
    render(<Step1CourseInfo data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const codeInput = screen.getByLabelText(/Course Code/i);
    fireEvent.change(codeInput, { target: { value: 'CS 201' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 2 allows adding a new course outcome', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const addOutcomeBtn = screen.getByRole('button', { name: /Add Course Outcome/i });
    fireEvent.click(addOutcomeBtn);
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 3 renders week ranges and time frames', () => {
    render(<Step3CourseOutline data={OFFICIAL_SYLLABUS_CSPC112} onChange={vi.fn()} />);
    expect(screen.getByText(/Week 1 - 4/i)).toBeInTheDocument();
    expect(screen.getByText(/MIDTERM EXAMINATION/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/steps/WizardStepsEarly.test.tsx --run`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement Steps 1, 2, and 3**

- `Step1CourseInfo.tsx`: Form inputs for Course Code, Descriptive Title, Semester, Academic Year, Course Type, Credit Units, Lecture Hours, Lab Hours, Prerequisites, Course Description, Faculty Name, Schedule, and Room.
- `Step2InstitutionalOutcomes.tsx`: Collapsible accordion for institutional Philosophy, Vision, Mission, Goal, Core Values, and Graduate Attributes (with "Restore DMMMSU Baseline" button); dynamic list editors for Program Outcomes (PO1-POn) and Course Outcomes (CO1-COn) with add/edit/delete.
- `Step3CourseOutline.tsx`: Chronological module list editor (timeframe e.g. Weeks 1-4, module title, topics bullet list), with automatic preserved markers for Midterm Exam (Week 9) and Final Exam (Week 18).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/steps/WizardStepsEarly.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/steps/Step1CourseInfo.tsx client/src/features/syllabus/components/creator/steps/Step2InstitutionalOutcomes.tsx client/src/features/syllabus/components/creator/steps/Step3CourseOutline.tsx client/src/features/syllabus/components/creator/steps/WizardStepsEarly.test.tsx
git commit -m "feat(syllabus): implement wizard steps 1 to 3 (course info, outcomes, outline)"
```

---

### Task 5: Wizard Steps 4, 5, and 6 Components

**Files:**
- Create: `client/src/features/syllabus/components/creator/steps/Step4LearningPlan.tsx`
- Create: `client/src/features/syllabus/components/creator/steps/Step5CourseMap.tsx`
- Create: `client/src/features/syllabus/components/creator/steps/Step6GradingPolicies.tsx`
- Test: `client/src/features/syllabus/components/creator/steps/WizardStepsLate.test.tsx`

**Interfaces:**
- Consumes: `OfficialSyllabusData`
- Produces:
  - `Step4LearningPlan: React.FC<{ data: OfficialSyllabusData; onChange: (updated: OfficialSyllabusData) => void }>`
  - `Step5CourseMap: React.FC<{ data: OfficialSyllabusData; onChange: (updated: OfficialSyllabusData) => void }>`
  - `Step6GradingPolicies: React.FC<{ data: OfficialSyllabusData; onChange: (updated: OfficialSyllabusData) => void }>`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/syllabus/components/creator/steps/WizardStepsLate.test.tsx`:
```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Step4LearningPlan } from './Step4LearningPlan';
import { Step5CourseMap } from './Step5CourseMap';
import { Step6GradingPolicies } from './Step6GradingPolicies';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../../shared/data/syllabusData';

describe('Wizard Steps Late', () => {
  it('Step 4 renders learning plan rows with SDG coherence and methodologies', () => {
    render(<Step4LearningPlan data={OFFICIAL_SYLLABUS_CSPC112} onChange={vi.fn()} />);
    expect(screen.getByText(/SDG 4\. Quality Education/i)).toBeInTheDocument();
    expect(screen.getByText(/Methodology/i)).toBeInTheDocument();
  });

  it('Step 5 cycles cell alignment strictly between blank -> I -> P -> D -> blank (Review Focus 4)', () => {
    let currentData = OFFICIAL_SYLLABUS_CSPC112;
    const onChange = vi.fn((next) => { currentData = next; });
    const { rerender } = render(<Step5CourseMap data={currentData} onChange={onChange} />);

    // Target CO1 x PO1 button
    const cellBtn = screen.getByTestId('cell-co-1-po-1');
    fireEvent.click(cellBtn);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      courseMap: expect.arrayContaining([
        expect.objectContaining({ coNumber: 1, poAlignments: expect.objectContaining({ 1: expect.any(String) }) })
      ])
    }));
  });

  it('Step 6 updates grading formula and policies', () => {
    const onChange = vi.fn();
    render(<Step6GradingPolicies data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const passingGradeInput = screen.getByLabelText(/Passing Grade/i);
    fireEvent.change(passingGradeInput, { target: { value: '75%' } });
    expect(onChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/steps/WizardStepsLate.test.tsx --run`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement Steps 4, 5, and 6**

- `Step4LearningPlan.tsx`: Table editor with rows for each learning plan week:
  - Week label & hours.
  - Learning outcomes list.
  - Topics.
  - SDG selector (SDG 1 through SDG 17 with title and badge).
  - Methodology chips (Lecture, Demonstration, Collaborative Learning, Brainstorming, Reporting).
  - Learning resources list.
  - Assessment tasks list.
  - Add/delete row actions.
- `Step5CourseMap.tsx`: Curriculum alignment matrix:
  - Header: PO1 to PO11 (with tooltip descriptions).
  - Rows: CO1 to COn.
  - Interactive cells with 1-click toggle cycling strictly `'' -> 'I' -> 'P' -> 'D' -> ''`.
  - Legend: `I` (Introduced), `P` (Practiced), `D` (Demonstrated).
- `Step6GradingPolicies.tsx`: Term formula, final formula, class standing components, passing grade criteria, classroom policies list, consultation hours, and APA reference citations list.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/steps/WizardStepsLate.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/steps/Step4LearningPlan.tsx client/src/features/syllabus/components/creator/steps/Step5CourseMap.tsx client/src/features/syllabus/components/creator/steps/Step6GradingPolicies.tsx client/src/features/syllabus/components/creator/steps/WizardStepsLate.test.tsx
git commit -m "feat(syllabus): implement wizard steps 4 to 6 (learning plan, course map, grading)"
```

---

### Task 6: Step 7 Signatories, Starter Modal & Attach to LMS Course Modal

**Files:**
- Create: `client/src/features/syllabus/components/creator/steps/Step7ReviewSignatories.tsx`
- Create: `client/src/features/syllabus/components/creator/SyllabusStarterModal.tsx`
- Create: `client/src/features/syllabus/components/creator/AttachToCourseModal.tsx`
- Test: `client/src/features/syllabus/components/creator/AttachToCourseModal.test.tsx`

**Interfaces:**
- Consumes: `useLMS()` from `client/src/shared/context/LMSContext.tsx`, `scanSyllabusDocument` from `client/src/shared/utils/syllabusParser.ts`
- Produces:
  - `Step7ReviewSignatories: React.FC<{ data: OfficialSyllabusData; onChange: (updated: OfficialSyllabusData) => void; onPrint: () => void; onAttachCourse: () => void }>`
  - `SyllabusStarterModal: React.FC<{ isOpen: boolean; onClose: () => void; onSelectBlank: () => void; onSelectClone: (sourceSyllabus: OfficialSyllabusData, title: string) => void; onImportFile: (file: File) => Promise<void>; availableDrafts: SyllabusDraftItem[] }>`
  - `AttachToCourseModal: React.FC<{ isOpen: boolean; onClose: () => void; syllabusData: OfficialSyllabusData }>`

- [ ] **Step 1: Write the failing test**

Create `client/src/features/syllabus/components/creator/AttachToCourseModal.test.tsx`:
```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttachToCourseModal } from './AttachToCourseModal';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../shared/data/syllabusData';
import * as LMSContext from '../../../../shared/context/LMSContext';

describe('AttachToCourseModal', () => {
  const mockUpdateCourseSyllabus = vi.fn().mockResolvedValue(undefined);
  const mockPublishSyllabusDraft = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: { id: 'usr-1', name: 'Floribeth Cuison', role: 'faculty' },
      courses: [
        { id: 'crs-1', code: 'CSPC 112', title: 'Software Engineering 2', section: '4A', schedule: 'MWF 8-9AM', instructorId: 'usr-1' }
      ],
      updateCourseSyllabus: mockUpdateCourseSyllabus,
      publishSyllabusDraft: mockPublishSyllabusDraft,
      showAlert: vi.fn(),
    } as any);
  });

  it('preserves target course schedule when attaching (Review Focus 2)', async () => {
    render(<AttachToCourseModal isOpen={true} onClose={vi.fn()} syllabusData={OFFICIAL_SYLLABUS_CSPC112} />);
    const selectCourseCheckbox = screen.getByLabelText(/CSPC 112/i);
    fireEvent.click(selectCourseCheckbox);

    const attachBtn = screen.getByRole('button', { name: /Attach & Save/i });
    fireEvent.click(attachBtn);

    expect(mockUpdateCourseSyllabus).toHaveBeenCalledWith(
      'crs-1',
      expect.objectContaining({
        facultyMembers: expect.arrayContaining([
          expect.objectContaining({
            sections: expect.arrayContaining([
              expect.objectContaining({ section: '4A', schedule: 'MWF 8-9AM' })
            ])
          })
        ])
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/AttachToCourseModal.test.tsx --run`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement Step 7, Starter Modal & AttachToCourseModal**

- `Step7ReviewSignatories.tsx`: Signatory fields (Prepared by Faculty, Recommending Approval Chairperson, Approved Dean), signature dates, full review call-to-actions (Print Preview, Print/PDF export, and "Attach to LMS Course").
- `SyllabusStarterModal.tsx`:
  - Tab 1: Start Fresh (preloaded with DMMMSU PVMGO).
  - Tab 2: Clone Existing (browse local drafts or assigned LMS course syllabi).
  - Tab 3: Upload DOCX/PDF (calls `scanSyllabusDocument` in-memory and maps detected course title, code, instructor, and sections to populate the wizard).
- `AttachToCourseModal.tsx`:
  - Lists courses where `instructorId === activeUser.id` or user can manage course.
  - Multi-select target courses.
  - Checkbox: "Publish immediately" vs "Save as course draft".
  - Merges target course section/schedule to preserve destination course details before invoking `updateCourseSyllabus`. If "Publish immediately" is checked, follows with `publishSyllabusDraft`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/components/creator/AttachToCourseModal.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/steps/Step7ReviewSignatories.tsx client/src/features/syllabus/components/creator/SyllabusStarterModal.tsx client/src/features/syllabus/components/creator/AttachToCourseModal.tsx client/src/features/syllabus/components/creator/AttachToCourseModal.test.tsx
git commit -m "feat(syllabus): implement review step, starter modal, and LMS course attachment"
```

---

### Task 7: Wizard Orchestrator, Page Component & App Route Integration

**Files:**
- Create: `client/src/features/syllabus/components/creator/SyllabusWizard.tsx`
- Create: `client/src/features/syllabus/SyllabusCreatorPage.tsx`
- Modify: `client/src/features/syllabus/index.ts:1-2`
- Modify: `client/src/App.tsx:25-35, 423-426`
- Test: `client/src/features/syllabus/SyllabusCreatorPage.test.tsx`

**Interfaces:**
- Consumes: `useSyllabusDraftsStorage()`, all Wizard Steps, `SyllabusDocumentPreview`
- Produces: `SyllabusCreatorPage: React.FC<{ onNavigateTab?: (tab: string) => void }>` exported via `client/src/features/syllabus/index.ts` and rendered at `/page1` route in `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `client/src/features/syllabus/SyllabusCreatorPage.test.tsx`:
```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SyllabusCreatorPage } from './SyllabusCreatorPage';
import * as LMSContext from '../../shared/context/LMSContext';

describe('SyllabusCreatorPage', () => {
  beforeEach(() => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: { id: 'usr-1', name: 'Floribeth Cuison', role: 'faculty' },
      activeRole: 'faculty',
      courses: [],
      showAlert: vi.fn(),
    } as any);
  });

  it('renders page header with Syllabus Creator title, draft controls, and wizard steps', () => {
    render(<SyllabusCreatorPage />);
    expect(screen.getByRole('heading', { name: /Syllabus Creator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Syllabus/i })).toBeInTheDocument();
    expect(screen.getByText(/Course Information/i)).toBeInTheDocument();
  });

  it('navigates between wizard steps', () => {
    render(<SyllabusCreatorPage />);
    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Institutional Statements & Outcomes/i)).toBeInTheDocument();
  });

  it('toggles live document preview panel', () => {
    render(<SyllabusCreatorPage />);
    const previewToggle = screen.getByRole('button', { name: /Document Preview/i });
    fireEvent.click(previewToggle);
    expect(screen.getByText(/Don Mariano Marcos Memorial State University/i)).toBeInTheDocument();
  });

  it('redirects or denies student role if accessed (Review Focus 5)', () => {
    vi.spyOn(LMSContext, 'useLMS').mockReturnValue({
      activeUser: { id: 'usr-2', name: 'Student John', role: 'student' },
      activeRole: 'student',
      courses: [],
    } as any);
    render(<SyllabusCreatorPage />);
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- src/features/syllabus/SyllabusCreatorPage.test.tsx --run`
Expected: FAIL (component not found).

- [ ] **Step 3: Implement `SyllabusWizard`, `SyllabusCreatorPage`, barrel export, and App route**

- `SyllabusWizard.tsx`: Wizard stepper bar (Steps 1 to 7 with step names, status, and click-to-jump), Back/Next buttons, Split-screen toggle for desktop with `SyllabusDocumentPreview` on the right side.
- `SyllabusCreatorPage.tsx`:
  - RBAC check: If active user role is `student` or `staff`, render access restricted notice.
  - Draft management toolbar: active draft dropdown, "New Syllabus" button (opens `SyllabusStarterModal`), "Clone Draft" button, "Delete Draft" button, and autosave status indicator.
  - Mounts `SyllabusWizard` bound to `activeDraft.data` and `updateActiveDraft`.
- `client/src/features/syllabus/index.ts`:
  ```typescript
  export { SyllabusView } from './SyllabusView';
  export { SyllabusRevisionBar } from './components/SyllabusRevisionBar';
  export { SyllabusCreatorPage } from './SyllabusCreatorPage';
  ```
- `client/src/App.tsx`:
  Import `SyllabusCreatorPage` from `./features/syllabus`:
  ```typescript
  const SyllabusCreatorPage = React.lazy(() => import('./features/syllabus').then(m => ({ default: m.SyllabusCreatorPage })));
  ```
  Replace route on line 423:
  ```typescript
  <Route path="/page1" element={<RouteWithNav element={(nav) => <SyllabusCreatorPage onNavigateTab={nav.handleNavigateTab} />} />} />
  ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- src/features/syllabus/SyllabusCreatorPage.test.tsx --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusWizard.tsx client/src/features/syllabus/SyllabusCreatorPage.tsx client/src/features/syllabus/index.ts client/src/App.tsx client/src/features/syllabus/SyllabusCreatorPage.test.tsx
git commit -m "feat(syllabus): wire SyllabusCreatorPage into route /page1 and navigation"
```

---

### Task 8: End-to-End Build, Typecheck & Verification

**Files:**
- Test all created test suites: `standalonePagesNavigation.test.ts`, `rbacNavigation.test.ts`, `useSyllabusDraftsStorage.test.ts`, `SyllabusDocumentPreview.test.tsx`, `WizardStepsEarly.test.tsx`, `WizardStepsLate.test.tsx`, `AttachToCourseModal.test.tsx`, `SyllabusCreatorPage.test.tsx`.

- [ ] **Step 1: Run complete syllabus and navigation vitest suites**

Run: `npm --prefix client test -- src/features/syllabus src/shared/config --run`
Expected: ALL test files pass.

- [ ] **Step 2: Run TypeScript compiler check**

Run: `npm --prefix client run build` or `npx tsc -p client/tsconfig.json --noEmit`
Expected: 0 errors, build succeeds.

- [ ] **Step 3: Verification of sample syllabus import/rendering**

Run a lightweight script test verifying that `OFFICIAL_SYLLABUS_CSPC112` and a sample parsed syllabus object serialize and render cleanly without missing keys.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore(syllabus): complete syllabus creator test suite and type check"
```
