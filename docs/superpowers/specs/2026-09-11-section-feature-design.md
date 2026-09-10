# Section Feature Design Spec

## Overview

Add section management to courses, approval workflows for enrollment, and section-specific announcements. This enables instructors to organize students into sections within a single course, control enrollment via approval, and target announcements to specific sections.

## Data Model

### New Types

```typescript
interface CourseSection {
  id: string;
  courseId: string;
  name: string;           // e.g. "Section A", "Section B"
  capacity: number;       // max students allowed
  enrolledCount: number;  // current enrolled count (denormalized)
  schedule?: string;      // e.g. "MWF 10:00-11:30"
  location?: string;      // e.g. "Room 301"
}

interface EnrollmentRequest {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  type: 'self_join' | 'faculty_enroll';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  sectionId?: string;     // set after approval, during section selection
}
```

### Modified Types

| Type | Change |
|------|--------|
| `Course` | Add `sectionIds?: string[]`. Keep `section` for backward compat. |
| `User` | Add `courseSections?: Record<string, string>` mapping courseId → sectionId. |
| `Announcement` | `sectionRestriction` now references `CourseSection.id`. |
| `MockDatabase` | Add `courseSections: CourseSection[]` and `enrollmentRequests: EnrollmentRequest[]`. |

### Migration

Existing courses get a single auto-migrated section ("Section A") from their current `section` field. Capacity defaults to 60. Existing enrolled students get assigned to that section.

## UI Flows

### Flow A: Student Self-Join via Code

1. Student enters course code in `JoinCourseModal` (existing UI).
2. Instead of instant enrollment, an `EnrollmentRequest` is created with `type: 'self_join'`, `status: 'pending'`.
3. Student sees toast: "Join request sent. Waiting for instructor approval."
4. After faculty approves → student is redirected to `SectionSelectionPage`.
5. Student picks a section → enrollment complete.

### Flow B: Faculty Enrolls Students

1. Faculty selects students in `PeopleView` (existing UI).
2. Instead of instant enrollment, `EnrollmentRequest`s are created with `type: 'faculty_enroll'`, `status: 'pending'`.
3. Students see pending enrollment on their dashboard.
4. Student approves → redirected to `SectionSelectionPage`.
5. Student picks a section → enrollment complete.

### Flow C: Faculty Approval Dashboard

- New "Pending Requests" panel in `PeopleView` or separate page.
- Table: student name, request type, date, status.
- Batch actions: Approve All, Approve Selected, Reject.
- On approve → student gets notified and can select section.

### Flow D: Section Management (Faculty)

- `CreateCoursePage`: faculty adds sections with name, capacity, schedule, location.
- `PeopleView`: per-section breakdown (enrolled vs capacity).
- Faculty can edit/delete sections.

### Flow E: Section Selection Page (Student)

- New `SectionSelectionPage.tsx`.
- Cards showing section name, schedule, location, available slots.
- Student picks one → updates `User.courseSections[courseId]`.
- Section switch requests create a new `EnrollmentRequest`.

### Flow F: Section-Specific Announcements

- `CreateAnnouncementPage`: "Post to Section" dropdown (All Sections / specific section).
- `AnnouncementsView`: students see only announcements matching their section or "All Sections".
- Faculty sees all with section badges.

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/SectionSelectionPage.tsx` | Student section picker after approval |
| `src/pages/PendingRequestsPage.tsx` | Faculty approval dashboard |

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/lms.ts` | Add `CourseSection`, `EnrollmentRequest`; update `Course`, `User`, `MockDatabase` |
| `src/context/LMSContext.tsx` | Add section CRUD, approval workflow, update join/enroll logic |
| `src/data/mockData.json` | Add seed sections, update enrolled students' section assignments |
| `src/pages/CreateCoursePage.tsx` | Add section creation UI |
| `src/pages/PeopleView.tsx` | Add pending requests panel, per-section breakdown |
| `src/pages/AnnouncementsView.tsx` | Filter by student's section |
| `src/pages/CreateAnnouncementPage.tsx` | Add section restriction dropdown |
| `src/components/common/JoinCourseModal.tsx` | Create pending request instead of instant enrollment |
| `src/components/layout/LMSContextPanel.tsx` | Add section info display |
| `src/pages/DashboardPage.tsx` | Show pending requests/invitations for students |
| `src/App.tsx` | Add routes for new pages |

## Testing

- Create a course with multiple sections
- Self-join flow: code entry → pending → approval → section selection
- Faculty enroll flow: select students → pending → student approval → section selection
- Section-specific announcement creation and filtering
- Section capacity enforcement
- Section switch request flow
