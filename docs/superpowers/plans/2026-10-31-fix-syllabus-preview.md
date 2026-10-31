# Fix Syllabus Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Official Document Preview (DMMMSU Standard) to render all user-entered syllabus studio content instead of hardcoded CSPC112 sample data, and ensure format matches the CMSC131_Course_Orientation.pdf reference sample.

**Architecture:** The `SyllabusDocumentPreview.tsx` component currently hardcodes CSPC112 content for Part II (Course Outline), Part III (Learning Plan), and Part IV (Course Map). The fix replaces these hardcoded sections with dynamic renderers that consume the actual `courseOutline`, `learningPlan`, `courseMap`, and `references` data from the syllabus studio. The existing sheet-based pagination structure is preserved; only the content generation logic changes.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing `syllabusData.ts` types and utilities (`sortReferences`, `normalizeRubricLevels`)

**Spec:** This plan implements the fix described in the user request and AGENTS.md constraints.

## Global Constraints

- **Feature-based architecture:** All changes within `client/src/features/syllabus/`
- **No frontend cascade deletions or elevated privileges** (AGENTS.md §Backend vs Frontend)
- **Token efficiency:** Minimal, targeted changes only
- **Production readiness:** Must render correctly for all syllabus types (sparse and full)
- **Format fidelity:** Output must match DMMMSU-INS-F003 landscape folio (13" × 8.5") with Trebuchet MS font

## Review Focus

1. **Empty/missing data sections** — Preview should gracefully handle empty arrays (show "None specified" or skip section per DMMMSU standard)
2. **Pagination overflow** — Long learning plan entries must split across sheets correctly (max ~18 weeks)
3. **Rich text rendering** — HTML from RichTextEditor must render safely in print layout
4. **Course map alignment** — PO columns must match actual program outcomes count (not hardcoded 11)
5. **Reference sorting** — APA 7 alphabetical order must be preserved in paginated reference sheets

---

### Task 1: Create dynamic Course Outline renderer (Part II)

**Files:**
- Modify: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx:620-712`

**Interfaces:**
- Consumes: `courseOutline: Array<{timeFrame, title, topics[]}>` from syllabus data
- Produces: React nodes for Sheet 6+ (continuing from rubric/policies sheets)

- [ ] **Step 1: Write failing test for course outline rendering**

```typescript
// In SyllabusDocumentPreview.test.tsx
it('renders user-entered course outline entries in Part II', () => {
  const data = {
    courseOutline: [
      { timeFrame: 'Weeks 1-3', title: 'Orientation & Foundations', topics: ['VGMO', 'Syllabus review'] },
      { timeFrame: 'Week 4', title: 'Design Patterns', topics: ['Creational', 'Structural', 'Behavioral'] }
    ],
    projectRubrics: [], classroomPolicies: [], signatories: {}
  };
  render(<SyllabusDocumentPreview data={data} />);
  expect(screen.getByText('Orientation & Foundations')).toBeInTheDocument();
  expect(screen.getByText('VGMO')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SyllabusDocumentPreview.test.tsx`
Expected: FAIL — hardcoded content doesn't match user data

- [ ] **Step 3: Implement dynamic course outline sheet builder**

Replace hardcoded Sheet 6+ course outline table (lines 620-712) with a function that:
- Takes `courseOutline` array and paginates entries across sheets
- Renders header "Part II: Course Outline and Time Frame"
- Table columns: Time Frame (20.6%) | Course Content/Subject Matter (79.4%)
- Each entry: timeFrame in left cell, title + bullet-list topics in right cell
- Exam weeks (title includes "EXAMINATION") rendered in bold

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SyllabusDocumentPreview.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx
git commit -m "feat(syllabus): dynamic Part II course outline from user data"
```

---

### Task 2: Create dynamic Learning Plan renderer (Part III)

**Files:**
- Modify: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx:714-1316`

**Interfaces:**
- Consumes: `learningPlan: LearningPlanWeek[]` with fields (week, hoursLec, hoursLab, learningOutcomes[], topics[], sdgCoherence[], methodology[], resources[], assessment[])
- Produces: React nodes for Sheets 8-14+ (paginated learning plan table)

- [ ] **Step 1: Write failing test for learning plan rendering**

```typescript
it('renders user-entered learning plan weeks in Part III', () => {
  const data = {
    learningPlan: [
      { week: 'Weeks 1-3', hoursLec: 6, hoursLab: 9, learningOutcomes: ['Understand VMGO'], topics: ['VGMO'], sdgCoherence: [], methodology: ['Discussion'], resources: ['Slides'], assessment: ['Exercises'] }
    ],
    courseMap: [], references: [], signatories: {}
  };
  render(<SyllabusDocumentPreview data={data} />);
  expect(screen.getByText('Understand VMGO')).toBeInTheDocument();
  expect(screen.getByText('Discussion')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SyllabusDocumentPreview.test.tsx`
Expected: FAIL — hardcoded content doesn't match user data

- [ ] **Step 3: Implement dynamic learning plan sheet builder**

Replace hardcoded Sheets 8-14 (lines 734-1316) with a function that:
- Takes `learningPlan` array and builds paginated table rows
- Header: "Part III: Learning Plan" with 7-column table (Learning Outcomes, Topics, SDG Coherence, Time Allotment, Methodology, Resources, Assessment)
- Column widths: 18%, 18%, 16%, 10%, 13%, 13%, 12%
- SDG Coherence: render goal, title, description, explanation for each SDG
- Time Allotment: show "Week X / Y hrs (lab) / Z hrs (lec)" format
- Paginate: max rows per sheet fitting 8.5" height (typically 2-3 rows per sheet)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SyllabusDocumentPreview.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx
git commit -m "feat(syllabus): dynamic Part III learning plan from user data"
```

---

### Task 3: Create dynamic Course Map renderer (Part IV)

**Files:**
- Modify: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx:1318-1440`

**Interfaces:**
- Consumes: `courseMap: CourseMapEntry[]`, `programOutcomes: ProgramOutcome[]`
- Produces: React nodes for Sheets 15-16+ (paginated course map matrix)

- [ ] **Step 1: Write failing test for course map rendering**

```typescript
it('renders user-entered course map with correct PO columns', () => {
  const data = {
    courseMap: [
      { coNumber: 1, coStatement: 'Design web apps', poAlignments: { 1: 'P', 2: 'P' } },
      { coNumber: 2, coStatement: 'Implement APIs', poAlignments: { 3: 'D' } }
    ],
    programOutcomes: [
      { number: 1, description: 'PO1 desc' },
      { number: 2, description: 'PO2 desc' },
      { number: 3, description: 'PO3 desc' }
    ],
    references: [], signatories: {}
  };
  render(<SyllabusDocumentPreview data={data} />);
  expect(screen.getByText('PO1')).toBeInTheDocument();
  expect(screen.getByText('PO2')).toBeInTheDocument();
  expect(screen.getByText('PO3')).toBeInTheDocument();
  expect(screen.getByText('Design web apps')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SyllabusDocumentPreview.test.tsx`
Expected: FAIL — hardcoded 11 POs and CSPC112 CO statements

- [ ] **Step 3: Implement dynamic course map sheet builder**

Replace hardcoded Sheets 15-16 (lines 1318-1440) with a function that:
- Builds matrix from `courseMap` and `programOutcomes` (dynamic column count)
- Header row: "Course Outcomes (CO)" + PO1...POn columns
- Sub-header: "Program Outcomes" + PO numbers
- Each row: CO number + statement in left cell (48% width), alignment badges (I/P/D) in PO columns
- Legend: "I - Introduced, P - Practiced, D – Demonstrate"
- Paginate if >5 COs per sheet

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- SyllabusDocumentPreview.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx
git commit -m "feat(syllabus): dynamic Part IV course map from user data"
```

---

### Task 4: Verify References (Part V) and Signatories work correctly

**Files:**
- Modify: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx:1442-1577`

**Interfaces:**
- Consumes: `references: ReferenceItem[]`, `signatories`
- Produces: Reference sheets (already dynamic) + final signatory sheet

- [ ] **Step 1: Verify existing reference pagination works**

```typescript
it('paginates references at 12 per landscape sheet', () => {
  const data = {
    references: Array.from({length: 15}, (_, i) => ({ citation: `Ref ${i+1}`, year: '2024' })),
    signatories: { preparedBy: [], recommendingApproval: {}, approved: {} }
  };
  render(<SyllabusDocumentPreview data={data} />);
  // Should produce 2 reference sheets
});
```

- [ ] **Step 2: Verify signatories render from data**

```typescript
it('renders custom signatories from data', () => {
  const data = {
    signatories: {
      preparedBy: [{ name: 'JUAN DELA CRUZ', title: 'Faculty' }],
      recommendingApproval: { name: 'MARIA SANTOS', title: 'Chair' },
      approved: { name: 'PEDRO REYES', title: 'Dean' }
    },
    references: [], learningPlan: [], courseMap: [], courseOutline: []
  };
  render(<SyllabusDocumentPreview data={data} />);
  expect(screen.getByText('JUAN DELA CRUZ')).toBeInTheDocument();
  expect(screen.getByText('MARIA SANTOS')).toBeInTheDocument();
  expect(screen.getByText('PEDRO REYES')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests and fix any issues**

Run: `npm test -- SyllabusDocumentPreview.test.tsx`
Expected: PASS (references already dynamic; verify signatories)

- [ ] **Step 4: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx
git commit -m "fix(syllabus): verify Part V references and signatories"
```

---

### Task 5: Integration test and visual verification

**Files:**
- Test: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`

- [ ] **Step 1: Create full syllabus integration test**

```typescript
it('renders complete syllabus with all parts from user data', () => {
  const fullData = { /* complete CMSC131-like syllabus */ };
  render(<SyllabusDocumentPreview data={fullData} />);
  // Verify all 5 parts present
  expect(screen.getByText('Part I:')).toBeInTheDocument();
  expect(screen.getByText('Part II:')).toBeInTheDocument();
  expect(screen.getByText('Part III:')).toBeInTheDocument();
  expect(screen.getByText('Part IV:')).toBeInTheDocument();
  expect(screen.getByText('Part V:')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run full test suite**

Run: `npm test -- SyllabusDocumentPreview.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Manual visual verification**

Open app, navigate to syllabus creator, enter CMSC131-like data, toggle preview, verify:
- All user-entered content appears in preview
- Print layout matches DMMMSU-INS-F003 format
- Page breaks occur at correct boundaries
- Font is Trebuchet MS, sizes correct

- [ ] **Step 4: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx
git commit -m "test(syllabus): integration test for full preview rendering"
```

---

### Task 6: Handle edge cases (empty data, sparse syllabus)

**Files:**
- Modify: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx`

- [ ] **Step 1: Test sparse syllabus (no learning plan, no rubrics, no course map)**

```typescript
it('renders baseline syllabus without learning plan/rubrics/course map', () => {
  const sparseData = { /* minimal syllabus with only courseInfo, POs, COs */ };
  render(<SyllabusDocumentPreview data={sparseData} />);
  expect(screen.getByText('Part I:')).toBeInTheDocument();
  expect(screen.getByText('Part II:')).toBeInTheDocument(); // course outline still shows
  // Should not crash, should show signatories at end
});
```

- [ ] **Step 2: Test empty course outline**

```typescript
it('handles empty course outline gracefully', () => {
  const data = { courseOutline: [], ... };
  render(<SyllabusDocumentPreview data={data} />);
  expect(screen.getByText('Part II:')).toBeInTheDocument();
  // Should show "No course outline entries" or similar
});
```

- [ ] **Step 3: Fix any edge case issues found**

- [ ] **Step 4: Commit**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx
git commit -m "fix(syllabus): handle sparse/empty syllabus edge cases"
```