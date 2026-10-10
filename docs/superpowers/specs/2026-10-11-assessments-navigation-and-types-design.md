# Design Specification: Assessments Navigation & New Assessment Types

- **Date:** 2026-10-11
- **Status:** Approved
- **Author:** Antigravity & User

---

## 1. Executive Summary

This feature modernizes course assessment management in Gabay by:
1. Reorganizing Course Navigation so that assessment pages are consolidated under a clean, collapsible **Assessments** navigation group with an **Assessments Overview** hub.
2. Introducing three new assessment types—**Assignments**, **Projects**, and **Presentations**—alongside existing **Activities**, **Quizzes**, and **Exams**.
3. Providing dedicated list and creation interfaces for all six assessment types while seamlessly integrating with SpeedGrader, Rubrics, and Gradebook calculations.

---

## 2. Architecture & Data Model

### 2.1 Discriminator & Metadata Schema
To ensure 100% backward compatibility and eliminate schema duplication, all task-based assessments leverage the `Activity` engine with an `assessmentType` discriminator and a flexible `metadata` payload.

```ts
export type AssessmentType = 'activity' | 'assignment' | 'project' | 'presentation';

export interface AssessmentMetadata {
  // Project-specific attributes
  groupMode?: 'individual' | 'group';
  maxGroupSize?: number;
  repositoryUrlRequired?: boolean;
  liveDemoUrlRequired?: boolean;

  // Presentation-specific attributes
  presentationMode?: 'in_person' | 'recorded' | 'slide_only';
  durationMinutes?: number;
  slideDeckRequired?: boolean;
  rubricFocus?: 'delivery' | 'content' | 'qa' | 'visuals';
}
```

### 2.2 Database Changes (`server/prisma/schema.prisma`)
The `Activity` model in Prisma is updated:
* `assessmentType`: `String? @default("activity") @db.NVarChar(32)`
* `metadata`: `String? @db.NVarChar(Max)` (JSON serialized `AssessmentMetadata`)

All existing rows remain fully functional and default to `"activity"`.

### 2.3 API Endpoints (`server/src/routes/assessments.ts`)
* `GET /api/activities?courseId=:cid&assessmentType=:type`: Supports optional filtering by `assessmentType` (`activity`, `assignment`, `project`, `presentation`), or returns all activities if omitted.
* `POST /api/activities`: Accepts `assessmentType` and validates type-specific `metadata`.
* `PATCH /api/activities/:id`: Updates assessment fields including type-specific `metadata`.
* `GET /api/activities/:id/submissions` & `POST /api/activities/:id/submit`: Preserved without breaking changes, saving submissions linked to `activityId`.

---

## 3. Navigation & UI Structure

### 3.1 Course Sidebar Hierarchy (`config/navigation.ts` & `LMSContextPanel.tsx`)
In the course navigation panel, assessment links are grouped into an expandable accordion:

```
Course Navigation:
├── Modules
├── Syllabus
├── Announcements
├── ▾ Assessments [Total Badge]
│   ├── Overview (Assessments Hub)
│   ├── Activities
│   ├── Quizzes
│   ├── Assignments
│   ├── Projects
│   ├── Presentations
│   └── Exams
├── Files
├── Grades
└── People
```

* **Toggle Behavior:** Clicking the main "Assessments" navigation item toggles the sub-menu and opens the **Assessments Overview** hub.
* **Auto-Expansion:** The sub-menu automatically opens whenever any assessment sub-tab (`assessments`, `activities`, `quizzes`, `assignments`, `projects`, `presentations`, `exams`) is active.
* **Badge Aggregation:**
  * Collapsed state: Displays the aggregated sum of unread / pending items across all 6 assessment types.
  * Expanded state: Displays individual badges on the corresponding sub-items.

### 3.2 Mobile Responsive Navigation (`CoursesPage.tsx`)
In mobile viewports (`md:hidden`), the horizontal sub-tab bar displays an "Assessments" chip with a clear category picker dropdown or segmented tab pills to switch smoothly between the 6 assessment types.

---

## 4. Assessment Views & Pages

### 4.1 Assessments Overview Hub (`AssessmentsOverviewView.tsx`)
A unified dashboard for the course displaying:
1. **Summary Metrics:**
   * Total Assessments
   * Due Soon (Upcoming in 7 days)
   * Completed / Graded count
   * Total Points available
2. **Category & Term Filters:**
   * Filter pills: `All`, `Activities`, `Quizzes`, `Assignments`, `Projects`, `Presentations`, `Exams`
   * Term filter: `All Terms`, `Prelim`, `Midterm`, `Finals`
   * Keyword search input
3. **Faculty "+ Create Assessment" Dropdown:**
   * Quick-launch creation modal/route for Activity, Quiz, Assignment, Project, Presentation, or Exam.
4. **Assessment Card / Table List:**
   * Visual icon, title, category badge, points, due date, submission status, and direct action link.

### 4.2 Dedicated Assessment Views
Alongside existing `ActivitiesView.tsx`, `QuizzesView.tsx`, and `ExamsView.tsx`:
1. **`AssignmentsView.tsx`**: Filtered list of assignments, student file/online text submission interface, and faculty assignment creation trigger.
2. **`ProjectsView.tsx`**: Filtered list of projects, displaying group mode badges, repository/demo URL submission fields, and milestone details.
3. **`PresentationsView.tsx`**: Filtered list of presentations, displaying format badges (In-Person / Recorded / Slide Only), duration, slide deck submission/link field, and presentation notes.

### 4.3 Creation Pages
1. **`CreateAssignmentPage.tsx`**: Authoring form for assignments with title, instructions, term, points, due date, submission types, and rubric.
2. **`CreateProjectPage.tsx`**: Authoring form adding group settings (individual vs group, max group size) and repository/demo link requirements.
3. **`CreatePresentationPage.tsx`**: Authoring form adding presentation mode, duration, slide requirements, and presentation rubric templates.

---

## 5. SpeedGrader & Gradebook Integration

1. **SpeedGrader (`SpeedGraderModal.tsx`)**:
   * Evaluates submissions for Assignments, Projects, and Presentations.
   * Renders submitted files, online text, repository/demo URLs, slide deck links, rubric scoring cards, and feedback comments.
2. **Gradebooks (`FacultyGradebook.tsx` & `StudentGradebook.tsx`)**:
   * Lists all 6 assessment types under their respective grading terms.
   * Contributes to student class standing and term grade calculations.

---

## 6. Testing & Quality Assurance

1. **Vitest Unit & Integration Tests**:
   * Sidebar navigation tests verifying expand/collapse and active tab selection.
   * API tests verifying `/api/activities` persistence and `assessmentType` filtering.
   * Submission tests verifying assignment, project, and presentation workflows.
2. **UI & Accessibility**:
   * Dark and light theme verification.
   * Keyboard accessibility for collapsible navigation and dropdowns.
