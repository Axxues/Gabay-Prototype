# Standalone Syllabus Creator (Outside LMS) - Design Document

## Intent & The Why
Faculty members currently interact with syllabi strictly from within individual courses inside the Learning Management System (`/courses/:courseId/syllabus`). However, syllabus authoring, curriculum mapping, and institutional compliance (outcomes-based education, SDG alignment, institutional PVMGO) is a standalone academic authoring task. Faculty frequently need to craft, review, clone, and standardize course syllabi before a course semester starts or outside the context of a live student-enrolled classroom.

This feature introduces a dedicated **Syllabus Creator** on the top-level **Page 1** placeholder (outside Learning Management). It provides faculty with a high-productivity, guided authoring wizard and a high-fidelity document renderer matching the official institutional format demonstrated in `file-samples/syllabus/` (`CSPC103-IKM-SYL-1stSemAY2026-2027.docx` and `CMSC131_Course_Orientation.pdf`).

---

## Decisions Made & Builder Specifications (From Review & Consultation)

1. **Authoring Experience**:
   - A **multi-step guided wizard** with real-time official paper preview, auto-filled institutional defaults (PVMGO, Graduate Attributes, Core Values), and structured interactive tables for the Learning Plan and Course Map matrix.
2. **LMS Integration & Storage**:
   - Syllabi created here are saved as **standalone syllabus documents** (persisted in local storage drafts with auto-save).
   - **Attach to Course Flow**: Faculty can attach a syllabus directly to one or more assigned courses. The `AttachToCourseModal` offers a toggle: "Publish immediately" (executes draft creation + publication) or "Save as draft" for later review in the course tab.
   - **Multi-Course Schedule Preservation**: When attaching a syllabus to a course, existing section/schedule metadata from the target course is preserved while adopting the new educational curriculum, outcomes, and grading policies.
3. **Creation Accelerators & Cloning**:
   - **Start Fresh**: Institutional statements and headers pre-filled; blank course-specific fields.
   - **Clone from Existing**: Supports cloning from either:
     - Previously saved local drafts.
     - Existing assigned courses in the LMS.
     - Standard institutional templates (e.g. `OFFICIAL_SYLLABUS_CSPC112`).
   - **Import Existing (.docx / .pdf)**: Upload a document through the built-in parser to automatically populate the wizard steps. Binary files are parsed ephemerally in-memory to prevent exceeding browser `localStorage` quotas.
4. **Navigation, Route & RBAC**:
   - Replaces the generic "Page 1" placeholder in `MAIN_NAV` (`client/src/shared/config/navigation.ts`) with **"Syllabus Creator"**, using an intuitive document/file icon in `AppRail.tsx`.
   - The route remains `/page1` (with alias support) to preserve existing routing contracts and navigation tests.
   - **Role Whitelist**: Restricted to `['superadmin', 'admin', 'faculty']` (students do not author course syllabi).


---

## Goals & Non-Goals

### Goals
- **Full Fidelity with Sample Syllabi**: Faithfully reproduce the 5-part institutional format:
  - Header & Form Code (e.g., `DMMMSU-INS-F003`, Rev info, course title, schedule, room, faculty).
  - **Part I**: Philosophy, Vision, Mission, Goal, Graduate Attributes, Core Values, Program Outcomes (PO1-PO11), Course Type, Credit, Contact Hours, Prerequisites, Course Outcomes (CO1-COn), Course Requirements, Grading System, Classroom Policies, Consultation Hours.
  - **Part II**: Course Outline & Time Frame (Weeks 1-18, Midterm Exam Week 9, Final Exam Week 18).
  - **Part III**: Learning Plan (Table of Learning Outcomes, Topics, SDG Coherence 1-17, Time Allotment, Methodologies, Learning Resources, Assessment Tasks).
  - **Part IV**: Course Map (Interactive Matrix mapping CO1-COn against PO1-PO11 with `I` - Introduced, `P` - Practiced, `D` - Demonstrated).
  - **Part V**: References (Standard academic citations).
  - **Signatories Block**: Prepared by (Faculty), Recommending Approval (Program Chairperson), Approved (Dean / Institute Director).
- **Interactive Multi-Step Wizard**:
  - Step 1: Course Identification & Schedule (Course code, title, units, lecture/lab hours, prereqs, term, AY, faculty info).
  - Step 2: Institutional Statements & Outcomes (Institutional PVMGO pre-filled with edit toggle; dynamic PO and CO builder).
  - Step 3: Course Outline & Chronology (Timeframes, modules, exam markers).
  - Step 4: Learning Plan (Weekly rows, multi-select teaching methods, SDG alignment tags, resources, assessment tasks).
  - Step 5: Curriculum Course Map (CO x PO grid with 1-click toggle buttons for I, P, D, or blank).
  - Step 6: Grading Scheme, Policies & References (Formula, passing criteria, classroom code, APA references).
  - Step 7: Signatories, Review & Finalization (Signatory names/titles, full live print preview, export actions, LMS course attachment).
- **Direct LMS Course Attachment**:
  - Modal allowing faculty to select from their active assigned courses and push the generated syllabus directly into `updateCourseSyllabus(courseId, syllabusData)`.
- **High-Quality Print & Export**:
  - CSS `@media print` styling specifically designed for multi-page institutional output, repeating headers, clean margins, and page breaks between major sections.
- **Strict Architecture Compliance**:
  - Co-located strictly in `client/src/features/syllabus/` following feature encapsulation and public barrel export rules. Zero forbidden deep imports outside the feature.
  - Role-gated: Accessible only to `faculty`, `admin`, and `superadmin` roles in `MAIN_NAV` and route level.

### Non-Goals
- Replacing the student course syllabus tab in `/courses/:courseId/syllabus` (students continue to see their enrolled course's published syllabus).
- Modifying Likha ERP database relations or introducing backend cascades (uses existing `Course.syllabus` JSON envelope / `updateCourseSyllabus` API contract).

### Anti-Goals
- No monolithic global state pollution in `LMSContext.tsx` — all wizard drafts, active steps, and auto-saves are handled by feature-scoped hooks.
- No unhandled print overflows or broken grid tables in print mode.

---

## Architectural Design

### 1. Folder Structure & Feature Encapsulation
All new components and hooks are encapsulated within `client/src/features/syllabus/`:

```
client/src/features/syllabus/
├── components/
│   ├── SyllabusRevisionBar.tsx
│   ├── SyllabusRevisionBar.test.tsx
│   └── creator/
│       ├── SyllabusWizard.tsx                 # Wizard step container with navigation
│       ├── SyllabusDocumentPreview.tsx        # Official DMMMSU formatted paper preview
│       ├── SyllabusStarterModal.tsx           # Choice: Blank, Clone, or Import
│       ├── AttachToCourseModal.tsx            # Modal to publish syllabus to an assigned LMS course
│       ├── steps/
│       │   ├── Step1CourseInfo.tsx            # Course basic info & schedules
│       │   ├── Step2InstitutionalOutcomes.tsx # PVMGO, POs, COs
│       │   ├── Step3CourseOutline.tsx         # Chronological modules & exams
│       │   ├── Step4LearningPlan.tsx          # Learning outcomes, topics, SDG, methods
│       │   ├── Step5CourseMap.tsx             # Interactive CO x PO matrix
│       │   ├── Step6GradingPolicies.tsx       # Grading system, policies, references
│       │   └── Step7ReviewSignatories.tsx     # Signatories, print, export, attach
├── hooks/
│   ├── useSyllabusCreator.ts                  # State management for drafts, current step, autosave
│   └── useSyllabusDraftsStorage.ts            # Local persistence of standalone drafts
├── types/
│   └── creator.ts                             # Wizard state, step definitions, starter options
├── SyllabusCreatorPage.tsx                    # Top-level standalone page mounted at /page1
├── SyllabusCreatorPage.test.tsx               # Component and integration tests
├── SyllabusView.tsx                           # Existing in-course view
└── index.ts                                   # Barrel export: SyllabusView, SyllabusCreatorPage
```

### 2. State & Draft Management (`useSyllabusCreator`)
- **Autosave**: Every change during wizard editing persists to local storage key `gabay_syllabus_creator_drafts` with timestamp and course code.
- **Drafts Library**: Faculty can switch between multiple drafts or start a new one at any time.
- **Conversion to `OfficialSyllabusData`**: The internal creator state directly conforms to the existing `OfficialSyllabusData` type in `client/src/shared/data/syllabusData.ts`, ensuring zero translation loss when attaching to LMS courses.

### 3. Live Document Preview (`SyllabusDocumentPreview`)
- Formatted with institutional typography, bordered table layouts, centered university headings, and formal sign-off boxes.
- Supports side-by-side split screen on wide displays and a full preview tab on smaller displays.
- Includes a dedicated `window.print()` trigger with print CSS styles ensuring clean table pagination.

---

## What's Left to the Builder
- Detailed UI micro-interactions (e.g. badge colors for SDG goals, quick row reordering in the Learning Plan).
- Default preset selections for common teaching methodologies (Lecture, Demonstration, Collaborative Learning, Reporting) and SDG targets (SDG 4 Quality Education, SDG 9 Industry & Innovation).
- Exact icon choice for the Syllabus Creator in `AppRail.tsx` (e.g., `FileText` or `BookOpen`).

---

## Verification Plan
1. **Unit & Component Testing**:
   - `SyllabusCreatorPage.test.tsx`: Tests route mounting, starter modal actions, step navigation, and data updates.
   - Test Course Map toggle interactions (I -> P -> D -> empty).
   - Test Attach to Course modal against mock assigned courses.
2. **Build & Type Check**:
   - `npm run build` or `npx tsc --noEmit` to ensure strict TypeScript cleanliness and zero missing exports.
3. **End-to-End Visual & Functional Pressure Verification**:
   - Create a syllabus from scratch using sample data (`CSPC103-IKM-SYL-1stSemAY2026-2027.docx`).
   - Clone an existing draft.
   - Upload and parse an existing DOCX/PDF to verify pre-population.
   - Attach a created syllabus to an active LMS course and verify it immediately reflects in the course's Syllabus tab.
