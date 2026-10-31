# 1-to-1 Official Syllabus Document Preview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `SyllabusDocumentPreview.tsx` to render an authentic 1:1 replica of the official university syllabus (`CMSC131_Course_Orientation.pdf` / Image 2) as stacked 13" × 8.5" landscape sheets on screen and print.

**Architecture:** Decompose the syllabus data into discrete 13" × 8.5" landscape sheet containers (`.syllabus-page-sheet`). Each sheet features the authentic 2-cell header box (university seal + `"Course Syllabus"`), 10pt `Trebuchet MS` typography, clean 1px borders on Parts I–IV, borderless course metadata and signatories, and running footers (`DMMMSU-INS-F003`, `REV. 02`, `Page X of Y`).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide icons, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-31-syllabus-document-preview-design.md`

## Global Constraints
- Standard Philippine Long Folio Landscape dimensions: 13.0in × 8.5in (936pt × 612pt).
- Exact font family: `Trebuchet MS`, Arial, sans-serif. Title 14pt Bold, body/table 10pt Regular/Bold, running footers 10pt Regular.
- Borderless layout for Course Metadata (Page 1) and Signatories (Page 17) with zero artificial table borders.
- Clean 1px solid black borders (`#000000`) for institutional tables (Parts I–IV).
- Authentic running footers on every sheet: left `DMMMSU-INS-F003` & `REV. 02 (06.23.2025)`, right `Page X of Y`.

## Review Focus
1. Missing or undefined optional fields (empty faculty list, empty lab hours, empty consultation) must render cleanly without layout breaks.
2. Custom institutional codes or titles (custom form codes or college names) must be supported.
3. Variable PO counts (e.g., 5 to 12 POs) must align cleanly in the Course Map matrix.
4. Print stylesheets must isolate each sheet to a single 13" × 8.5" page (`page-break-after: always`).
5. Screen preview wrapper must enable smooth panning/scrolling while keeping the physical 13" × 8.5" paper scale intact.

---

### Task 1: Update Tests for 1-to-1 Sheet Architecture & Typography

**Files:**
- Modify: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`

**Interfaces:**
- Consumes: `SyllabusDocumentPreview` component from `./SyllabusDocumentPreview`
- Produces: Strict test suite validating stacked sheets (`.syllabus-page-sheet`), 1-to-1 header box, borderless metadata, running footers (`Page X of 17`), and signatories.

- [ ] **Step 1: Write the updated test suite asserting stacked sheets and 1-to-1 layout**

```typescript
// Assert multiple .syllabus-page-sheet elements exist
// Assert header box has seal and 'Course Syllabus' title case
// Assert Schedule and Room Assignment is rendered borderless
// Assert footer contains Page 1 of 17
```

- [ ] **Step 2: Run test to verify it fails against current single-canvas preview**

Run: `pnpm --dir client vitest run src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`  
Expected: FAIL (missing `.syllabus-page-sheet`, wrong header text, single continuous document)

- [ ] **Step 3: Commit test updates**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx
git commit -m "test: add assertions for 1-to-1 stacked sheet syllabus preview"
```

---

### Task 2: Implement 1-to-1 Stacked Sheet Document Engine

**Files:**
- Modify: `client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx`

**Interfaces:**
- Consumes: `OfficialSyllabusData` from `client/src/shared/data/syllabusData.ts`
- Produces: `SyllabusDocumentPreview` React component exporting stacked 13" × 8.5" landscape sheets with authentic headers, footers, tables, and borderless metadata.

- [ ] **Step 1: Refactor `SyllabusDocumentPreview.tsx` with sheet partitioning and exact PDF styling**
  - Implement `.syllabus-page-sheet` with exact 13in × 8.5in dimensions, 45pt margins, and card shadow.
  - Render authentic header box (left cell: seal only, right cell: `"Course Syllabus"` 14pt bold).
  - Render borderless course metadata on Page 1 (Course No & Title, Faculty on left; Schedule and Room Assignment on right).
  - Render Part I table (Philosophy, Vision, Mission, Goal, Graduate Attributes 1-6 with bold titles and indented descriptions).
  - Render subsequent sheets according to the 17-page standard (Core Values, POs, Course Info, Rubrics, Policies, Course Outline, Learning Plan, Course Map, References, borderless Signatories).
  - Add running footers on every sheet: `DMMMSU-INS-F003` & `REV. 02 (06.23.2025)` on left, `Page X of Y` on right.
  - Implement print stylesheet for `@page { size: 13in 8.5in; margin: 0; }` and `.syllabus-page-sheet { page-break-after: always; break-after: page; }`.

- [ ] **Step 2: Run test suite to verify all tests pass**

Run: `pnpm --dir client vitest run src/features/syllabus/components/creator/SyllabusDocumentPreview.test.tsx`  
Expected: PASS (all tests green)

- [ ] **Step 3: Commit component implementation**

```bash
git add client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx
git commit -m "feat: implement 1-to-1 stacked sheet official syllabus document preview"
```

---

### Task 3: Visual & Pressure Verification via Browser Subagent

**Files:**
- Test / Verify: Live application preview at `http://localhost:5173`

- [ ] **Step 1: Dispatch browser subagent or inspect rendered preview against `CMSC131_Course_Orientation.pdf` and Image 2**
  - Verify Page 1 header box, borderless metadata, font weights, and sizes.
  - Verify stacked sheets layout and spacing.
  - Verify footers and pagination (`Page 1 of 17`, etc.).
  - Verify print preview styles.

- [ ] **Step 2: Run complete client test suite to ensure zero regression across courses and syllabus**

Run: `pnpm --dir client vitest run src/features/syllabus/`  
Expected: PASS

- [ ] **Step 3: Final commit and clean up**

```bash
git add docs/ docs/superpowers/
git commit -m "docs: finalize 1-to-1 syllabus redesign specification and implementation"
```
