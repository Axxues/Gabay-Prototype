# Design Specification: 1-to-1 Official Syllabus Document Preview (DMMMSU Standard)

**Date**: 2026-10-31  
**Target Component**: [`client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/client/src/features/syllabus/components/creator/SyllabusDocumentPreview.tsx)  
**Reference Document**: [`file-samples/syllabus/CMSC131_Course_Orientation.pdf`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/file-samples/syllabus/CMSC131_Course_Orientation.pdf) & Official University Syllabus (Image 2)

---

## 1. Intent & Problem Statement
The current syllabus preview in the system (Image 1) diverges significantly from the official Don Mariano Marcos Memorial State University (DMMMSU) course syllabus (Image 2):
- It wraps course metadata (`Course No.`, `Schedule & Room Assignment`, `Faculty`) inside a heavy, black-bordered table rather than the borderless two-column layout required by the institutional standard.
- The top header improperly embeds `"DON MARIANO MARCOS MEMORIAL STATE UNIVERSITY"` and `"College of Computer Science"` text below the logo, whereas the official document only contains the university seal.
- Title case `"Course Syllabus"` in 14pt `Trebuchet MS Bold` was replaced with an uppercase heading.
- The document is currently rendered as one continuous unpaginated canvas rather than stacked 13" × 8.5" landscape sheets with authentic per-page headers and running footers (`DMMMSU-INS-F003`, `REV. 02`, `Page X of Y`).
- Signatories are placed in an ugly black-bordered table instead of the clean borderless 3-column layout.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **1-to-1 Visual & Structural Fidelity**: The on-screen and print outputs must be pixel-faithful to [`CMSC131_Course_Orientation.pdf`](file:///d:/4thesis/GabaySystem/Gabay-Prototype/file-samples/syllabus/CMSC131_Course_Orientation.pdf).
2. **Stacked 13" × 8.5" Landscape Sheets**: The preview displays physical-looking paper cards (13in wide × 8.5in high) stacked vertically with subtle page-gap dividers and paper shadows on screen.
3. **Exact Typography**: Strict use of `Trebuchet MS` (Regular, Bold, Italic) with exact sizes (14pt header title, 10pt regular/bold for content and metadata, 10pt for footers).
4. **Authentic Header & Footer on Every Page**: Every sheet features the 2-cell bordered header box (Seal on left cell, Title on right cell) and the official running footer.
5. **Borderless Metadata & Signatories**: Course identification metadata and final signatures use clean borderless multi-column layouts.
6. **Print / PDF Guarantee**: CSS `@media print` rules enforce `@page { size: 13in 8.5in; margin: 0.5in; }` and page-break isolation so that printing or exporting produces identical 13" × 8.5" pages.
7. **Visual Verification**: Verification using the browser subagent to review the rendered sheets against the PDF.

### Non-Goals
- Changing backend schema or storage formats for syllabus data.
- Modifying syllabus editing wizard steps or form fields.

### Anti-Goals
- No artificial borders around course metadata or signatories.
- No continuous single-scroll canvas without page boundary awareness.
- No table rows or rubric levels broken awkwardly across page boundaries.

---

## 3. Approaches Evaluated
- **Approach 1 (Selected)**: Structured Multi-Sheet Page Model with stacked 13" × 8.5" landscape paper cards. Partitions content into logical page frames with repeated headers, authentic typography, and running page footers (`Page X of Y`).
- **Approach 2 (Rejected)**: Continuous single-scroll layout relying solely on CSS print-break rules. Fails to provide the requested on-screen stacked sheets experience and cannot compute per-sheet running footers on screen.

---

## 4. Technical Architecture & Page Partitioning

### 4.1 Page Geometry & Styles
- Sheet Dimensions: `13in` width × `8.5in` height (Folio landscape, 936pt × 612pt).
- Margins: Left `45.5pt`, Right `40.5pt`, Top `40pt`, Bottom `40pt`.
- Base Font: `font-family: 'Trebuchet MS', Arial, sans-serif; font-size: 10pt; line-height: 1.28; color: #000;`.
- Tables: `border: 1px solid #000; border-collapse: collapse; width: 100%;`.
  - Column 1 (labels): width `20.6%` (`175pt`), bold 10pt, vertical-align top, padding `3pt 5pt`.
  - Column 2 (values): width `79.4%` (`675pt`), regular 10pt, vertical-align top, padding `3pt 5pt`.

### 4.2 Page Breakdown
1. **Page 1**: Top Header Box + Centered Semester Text (`First Semester, Academic Year...`) + Borderless Course Meta (`Course No. & Descriptive Title`, `Name of Faculty Member/s` on left; `Schedule and Room Assignment` on right) + `Part I:` Header + Table Rows: Philosophy, Vision, Mission, Goal, Graduate Attributes (1-6) + Footer (`Page 1 of N`).
2. **Page 2**: Top Header Box + Table Rows: Core Values (7 items) + Program Outcomes (PO1–PO11) + Footer (`Page 2 of N`).
3. **Page 3**: Top Header Box + Table Rows: Course Type, Course Credit, Course Description, Contact Hours/Week, Course Prerequisite/s, Course Outcomes (CO1–CO9), Course Requirements (Major & Other), Grading System intro + Footer (`Page 3 of N`).
4. **Pages 4–5**: Top Header Box + Grading System formulas + Rubrics for Group Project Presentation and Documentation (4-column criteria grid) + Footer.
5. **Page 6**: Top Header Box + Rubrics conclusion + Classroom Policies (bullet list) + Consultation Hours + `Part II: Course Outline and Time Frame` start (Weeks 1–7) + Footer.
6. **Page 7**: Top Header Box + Course Outline continuation (Weeks 8–18, Midterm, Final Exam) + `Part III: Learning Plan` Table Header + Footer.
7. **Pages 8–14**: Top Header Box + Learning Plan weekly modules (Learning Outcomes, Topics, SDG Coherence, Time Allotment, Methodology, Resources, Assessment) + Footer.
8. **Page 15**: Top Header Box + Learning Plan (Final Exam) + `Part IV: Course Map` Table Header + CO1–CO5 alignment with PO1–PO11 + Footer.
9. **Page 16**: Top Header Box + Course Map CO6–CO9 alignment + Legend (`I - Introduced, P - Practiced, D – Demonstrate`) + `Part V: References` (APA 7 format) + Footer.
10. **Page 17**: Top Header Box + References continuation + Borderless 3-column Signatories (`Prepared by`, `Recommending Approval`, `Approved`) + Footer.

---

## 5. Verification Plan
1. Unit testing with Vitest (`SyllabusDocumentPreview.test.tsx`) covering rendering of all pages, header structure, borderless metadata, and footer page counts.
2. Visual and browser verification using the browser subagent against the running Vite app at `http://localhost:5173` to compare each sheet against the sample PDF.
