# Section Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add section management, approval-based enrollment, and section-specific announcements to courses.

**Architecture:** Introduce `CourseSection` and `EnrollmentRequest` as new entities in localStorage. Modify enrollment flows (self-join and faculty-enroll) to create pending requests requiring instructor approval. After approval, students select a section. Announcements gain section-level targeting.

**Tech Stack:** React 19, TypeScript, TailwindCSS, localStorage-backed MockDatabase, lucide-react icons

**Spec:** `docs/superpowers/specs/2026-09-11-section-feature-design.md`

## Global Constraints

- Frontend-only prototype — all data in localStorage under `gabay_lms_db_v5`
- No new dependencies — use existing React, TailwindCSS, lucide-react
- Follow existing code patterns: functional components, `useLMS()` context hooks, state-based routing
- Bump localStorage key to `gabay_lms_db_v6` for migration
- Existing courses must auto-migrate with a default "Section A"

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types/lms.ts` | Modify | Add `CourseSection`, `EnrollmentRequest` types; update `Course`, `User`, `MockDatabase` |
| `src/context/LMSContext.tsx` | Modify | Section CRUD, enrollment request CRUD, approval logic, update join/enroll, bump storage key |
| `src/data/mockData.json` | Modify | Add seed sections for 5 courses, add sample pending requests, assign students to sections |
| `src/pages/CreateCoursePage.tsx` | Modify | Add section creation UI (add/remove sections with name, capacity, schedule, location) |
| `src/pages/PeopleView.tsx` | Modify | Add pending requests panel, per-section roster breakdown |
| `src/pages/AnnouncementsView.tsx` | Modify | Filter announcements by student's section |
| `src/pages/CreateAnnouncementPage.tsx` | Modify | Add "Post to Section" dropdown |
| `src/components/common/JoinCourseModal.tsx` | Modify | Create pending request instead of instant enrollment |
| `src/pages/SectionSelectionPage.tsx` | Create | Student section picker after approval |
| `src/pages/PendingRequestsPage.tsx` | Create | Faculty approval dashboard |
| `src/pages/DashboardPage.tsx` | Modify | Show pending requests/invitations for students |
| `src/components/layout/LMSContextPanel.tsx` | Modify | Show student's current section in course nav |
| `src/App.tsx` | Modify | Add routes for new pages |
| `src/config/navigation.ts` | Modify | Add `pending-requests` to COURSE_CHILDREN for faculty |

---

### Task 1: Add Types and Update MockDatabase

**Files:**
- Modify: `src/types/lms.ts:21-37,375-393`
- Modify: `src/data/mockData.json`

**Interfaces:**
- Produces: `CourseSection`, `EnrollmentRequest` types; `Course.sectionIds`, `User.courseSections`, `MockDatabase.courseSections`, `MockDatabase.enrollmentRequests`

- [ ] **Step 1: Add new types to `src/types/lms.ts`**

After the `Course` interface (line 37), add:

```typescript
export interface CourseSection {
  id: string;
  courseId: string;
  name: string;
  capacity: number;
  enrolledCount: number;
  schedule?: string;
  location?: string;
}
```

After `Course` export stub (line 39), add:

```typescript
export interface EnrollmentRequest {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  type: 'self_join' | 'faculty_enroll';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  sectionId?: string;
}
```

- [ ] **Step 2: Update `Course` interface**

Add `sectionIds?: string[]` to the `Course` interface (after `joinCode`):

```typescript
export interface Course {
  // ... existing fields ...
  joinCode?: string;
  sectionIds?: string[];
}
```

- [ ] **Step 3: Update `User` interface**

Add `courseSections?: Record<string, string>` after `enrolledCourseIds`:

```typescript
export interface User {
  // ... existing fields ...
  enrolledCourseIds?: string[];
  courseSections?: Record<string, string>; // courseId → sectionId
}
```

- [ ] **Step 4: Update `MockDatabase` interface**

Add two new arrays at the end of `MockDatabase`:

```typescript
export interface MockDatabase {
  // ... existing fields ...
  courseSections: CourseSection[];
  enrollmentRequests: EnrollmentRequest[];
}
```

- [ ] **Step 5: Add seed sections to `src/data/mockData.json`**

For each of the 5 courses in the JSON, add a `sectionIds` array and corresponding entries in a new `courseSections` array. Example for first course:

```json
{
  "id": "crs-cmsc131",
  "sectionIds": ["sec-cmsc131-a", "sec-cmsc131-b"],
  ...
}
```

Add `courseSections` array:

```json
"courseSections": [
  {
    "id": "sec-cmsc131-a",
    "courseId": "crs-cmsc131",
    "name": "Section A",
    "capacity": 40,
    "enrolledCount": 2,
    "schedule": "MWF 10:00-11:30",
    "location": "Room 301"
  },
  {
    "id": "sec-cmsc131-b",
    "courseId": "crs-cmsc131",
    "name": "Section B",
    "capacity": 40,
    "enrolledCount": 0,
    "schedule": "TTh 1:00-2:30",
    "location": "Room 205"
  }
]
```

Add `enrollmentRequests` array (empty initially, or one sample):

```json
"enrollmentRequests": []
```

- [ ] **Step 6: Commit**

```bash
git add src/types/lms.ts src/data/mockData.json
git commit -m "feat(sections): add CourseSection and EnrollmentRequest types with seed data"
```

---

### Task 2: Update LMSContext — Storage Migration and Section CRUD

**Files:**
- Modify: `src/context/LMSContext.tsx:30-159,161-200,380-600,743-772`

**Interfaces:**
- Consumes: `CourseSection`, `EnrollmentRequest` from Task 1
- Produces: `createSection()`, `updateSection()`, `deleteSection()`, `getCourseSections()`, `getStudentSection()`

- [ ] **Step 1: Bump storage key**

Change line 161:
```typescript
const STORAGE_KEY_DB = 'gabay_lms_db_v6';
```

- [ ] **Step 2: Add section and enrollment request defaults to initial state**

In the `initialDb` or default state, ensure `courseSections` and `enrollmentRequests` default to empty arrays if not present in loaded data. Find where `db` is initialized from localStorage and add fallback:

```typescript
courseSections: loadedDb.courseSections || [],
enrollmentRequests: loadedDb.enrollmentRequests || []
```

- [ ] **Step 3: Add migration logic**

After loading from localStorage, check if `courseSections` is missing (old data). If so, auto-migrate existing courses:

```typescript
// Migration: if courseSections missing, create from existing courses
if (!loadedDb.courseSections || loadedDb.courseSections.length === 0) {
  const migratedSections: CourseSection[] = [];
  const migratedCourses = loadedDb.courses.map(c => {
    const sectionId = `sec-${c.id}-a`;
    migratedSections.push({
      id: sectionId,
      courseId: c.id,
      name: c.section || 'Section A',
      capacity: 60,
      enrolledCount: c.enrolledCount || 0,
      schedule: 'TBD',
      location: 'TBD'
    });
    return { ...c, sectionIds: [sectionId] };
  });
  loadedDb.courses = migratedCourses;
  loadedDb.courseSections = migratedSections;
}
if (!loadedDb.enrollmentRequests) {
  loadedDb.enrollmentRequests = [];
}
```

- [ ] **Step 4: Add section CRUD to LMSContextType interface**

Add to the interface (around line 30-159):

```typescript
// Sections CRUD
createSection: (courseId: string, data: Partial<CourseSection>) => CourseSection;
updateSection: (sectionId: string, updates: Partial<CourseSection>) => void;
deleteSection: (sectionId: string) => void;
getCourseSections: (courseId: string) => CourseSection[];
getStudentSection: (courseId: string) => CourseSection | null;
```

- [ ] **Step 5: Implement section CRUD functions**

After the existing CRUD section (around line 772), add:

```typescript
const createSection = (courseId: string, data: Partial<CourseSection>): CourseSection => {
  const newSection: CourseSection = {
    id: `sec-${Date.now().toString(36)}`,
    courseId,
    name: data.name || 'New Section',
    capacity: data.capacity || 40,
    enrolledCount: 0,
    schedule: data.schedule || '',
    location: data.location || ''
  };

  setDb(prev => ({
    ...prev,
    courseSections: [...prev.courseSections, newSection],
    courses: prev.courses.map(c =>
      c.id === courseId
        ? { ...c, sectionIds: [...(c.sectionIds || []), newSection.id] }
        : c
    )
  }));

  return newSection;
};

const updateSection = (sectionId: string, updates: Partial<CourseSection>) => {
  setDb(prev => ({
    ...prev,
    courseSections: prev.courseSections.map(s =>
      s.id === sectionId ? { ...s, ...updates } : s
    )
  }));
};

const deleteSection = (sectionId: string) => {
  setDb(prev => ({
    ...prev,
    courseSections: prev.courseSections.filter(s => s.id !== sectionId),
    courses: prev.courses.map(c => ({
      ...c,
      sectionIds: (c.sectionIds || []).filter(id => id !== sectionId)
    }))
  }));
};

const getCourseSections = (courseId: string): CourseSection[] => {
  return db.courseSections.filter(s => s.courseId === courseId);
};

const getStudentSection = (courseId: string): CourseSection | null => {
  const sectionId = activeUser.courseSections?.[courseId];
  if (!sectionId) return null;
  return db.courseSections.find(s => s.id === sectionId) || null;
};
```

- [ ] **Step 6: Expose new functions in context value**

Add the new functions to the return object of `LMSProvider`.

- [ ] **Step 7: Commit**

```bash
git add src/context/LMSContext.tsx
git commit -m "feat(sections): add section CRUD, storage migration, and bump to v6"
```

---

### Task 3: Update LMSContext — Enrollment Request Workflow

**Files:**
- Modify: `src/context/LMSContext.tsx:84-90,1094-1130,1200-1244`

**Interfaces:**
- Consumes: `CourseSection`, `EnrollmentRequest` from Task 1, section CRUD from Task 2
- Produces: `createEnrollmentRequest()`, `approveEnrollmentRequests()`, `rejectEnrollmentRequests()`, `studentApproveInvitation()`, `selectSection()`, updated `joinCourseByCode()`, updated `enrollStudentsInCourse()`

- [ ] **Step 1: Add enrollment request functions to LMSContextType**

Add to the interface:

```typescript
// Enrollment Requests
createEnrollmentRequest: (courseId: string, type: 'self_join' | 'faculty_enroll') => EnrollmentRequest;
approveEnrollmentRequests: (requestIds: string[]) => void;
rejectEnrollmentRequests: (requestIds: string[]) => void;
studentApproveInvitation: (requestId: string) => void;
selectSection: (courseId: string, sectionId: string) => void;
getPendingRequestsForCourse: (courseId: string) => EnrollmentRequest[];
getPendingRequestsForStudent: () => EnrollmentRequest[];
```

- [ ] **Step 2: Implement `createEnrollmentRequest`**

```typescript
const createEnrollmentRequest = (courseId: string, type: 'self_join' | 'faculty_enroll'): EnrollmentRequest => {
  const newRequest: EnrollmentRequest = {
    id: `req-${Date.now().toString(36)}`,
    courseId,
    studentId: activeUser.id,
    studentName: activeUser.name,
    type,
    status: 'pending',
    requestedAt: new Date().toISOString()
  };

  setDb(prev => ({
    ...prev,
    enrollmentRequests: [...prev.enrollmentRequests, newRequest]
  }));

  return newRequest;
};
```

- [ ] **Step 3: Implement `approveEnrollmentRequests`**

```typescript
const approveEnrollmentRequests = (requestIds: string[]) => {
  setDb(prev => {
    const now = new Date().toISOString();
    const requestsToApprove = prev.enrollmentRequests.filter(
      r => requestIds.includes(r.id) && r.status === 'pending'
    );

    // Enroll students in the course
    const studentIds = requestsToApprove.map(r => r.studentId);
    const courseIds = [...new Set(requestsToApprove.map(r => r.courseId))];

    let updatedUsers = prev.users;
    let updatedCourses = prev.courses;

    for (const courseId of courseIds) {
      const courseStudents = studentIds.filter(sid =>
        requestsToApprove.find(r => r.studentId === sid && r.courseId === courseId)
      );

      updatedUsers = updatedUsers.map(u => {
        if (courseStudents.includes(u.id)) {
          const currentCourses = u.enrolledCourseIds || [];
          if (!currentCourses.includes(courseId)) {
            return { ...u, enrolledCourseIds: [...currentCourses, courseId] };
          }
        }
        return u;
      });

      updatedCourses = updatedCourses.map(c => {
        if (c.id === courseId) {
          return { ...c, enrolledCount: (c.enrolledCount || 0) + courseStudents.length };
        }
        return c;
      });
    }

    return {
      ...prev,
      users: updatedUsers,
      courses: updatedCourses,
      enrollmentRequests: prev.enrollmentRequests.map(r =>
        requestIds.includes(r.id) && r.status === 'pending'
          ? { ...r, status: 'approved' as const, resolvedAt: now, resolvedBy: activeUser.id }
          : r
      )
    };
  });
};
```

- [ ] **Step 4: Implement `rejectEnrollmentRequests`**

```typescript
const rejectEnrollmentRequests = (requestIds: string[]) => {
  setDb(prev => ({
    ...prev,
    enrollmentRequests: prev.enrollmentRequests.map(r =>
      requestIds.includes(r.id) && r.status === 'pending'
        ? { ...r, status: 'rejected' as const, resolvedAt: new Date().toISOString(), resolvedBy: activeUser.id }
        : r
    )
  }));
};
```

- [ ] **Step 5: Implement `studentApproveInvitation`**

```typescript
const studentApproveInvitation = (requestId: string) => {
  setDb(prev => {
    const request = prev.enrollmentRequests.find(r => r.id === requestId);
    if (!request || request.studentId !== activeUser.id) return prev;

    // Enroll student
    const updatedUser = {
      ...activeUser,
      enrolledCourseIds: [...(activeUser.enrolledCourseIds || []), request.courseId]
    };
    setCurrentUser(updatedUser);
    safeSetLocalStorage(STORAGE_KEY_SESSION, JSON.stringify(updatedUser));

    return {
      ...prev,
      users: prev.users.map(u => u.id === activeUser.id ? updatedUser : u),
      courses: prev.courses.map(c =>
        c.id === request.courseId
          ? { ...c, enrolledCount: (c.enrolledCount || 0) + 1 }
          : c
      ),
      enrollmentRequests: prev.enrollmentRequests.map(r =>
        r.id === requestId ? { ...r, status: 'approved' as const, resolvedAt: new Date().toISOString() } : r
      )
    };
  });
};
```

- [ ] **Step 6: Implement `selectSection`**

```typescript
const selectSection = (courseId: string, sectionId: string) => {
  const section = db.courseSections.find(s => s.id === sectionId);
  if (!section || section.enrolledCount >= section.capacity) return;

  // Remove from old section if any
  const oldSectionId = activeUser.courseSections?.[courseId];

  setDb(prev => {
    let updatedSections = prev.courseSections;

    // Decrement old section count
    if (oldSectionId) {
      updatedSections = updatedSections.map(s =>
        s.id === oldSectionId ? { ...s, enrolledCount: Math.max(0, s.enrolledCount - 1) } : s
      );
    }

    // Increment new section count
    updatedSections = updatedSections.map(s =>
      s.id === sectionId ? { ...s, enrolledCount: s.enrolledCount + 1 } : s
    );

    return {
      ...prev,
      courseSections: updatedSections
    };
  });

  // Update user's section assignment
  const updatedSections = { ...(activeUser.courseSections || {}), [courseId]: sectionId };
  const updatedUser = { ...activeUser, courseSections: updatedSections };
  setCurrentUser(updatedUser);
  safeSetLocalStorage(STORAGE_KEY_SESSION, JSON.stringify(updatedUser));

  setDb(prev => ({
    ...prev,
    users: prev.users.map(u => u.id === activeUser.id ? updatedUser : u)
  }));
};
```

- [ ] **Step 7: Implement query helpers**

```typescript
const getPendingRequestsForCourse = (courseId: string): EnrollmentRequest[] => {
  return db.enrollmentRequests.filter(r => r.courseId === courseId && r.status === 'pending');
};

const getPendingRequestsForStudent = (): EnrollmentRequest[] => {
  return db.enrollmentRequests.filter(
    r => r.studentId === activeUser.id && r.status === 'pending' && r.type === 'faculty_enroll'
  );
};
```

- [ ] **Step 8: Update `joinCourseByCode` to create pending request**

Replace the body of `joinCourseByCode` (lines 1200-1244) to create a pending request instead of instant enrollment:

```typescript
const joinCourseByCode = (code: string): { success: boolean; message: string; course?: Course } => {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: 'Please enter a valid course join code.' };
  }

  const targetCourse = db.courses.find(c => c.joinCode?.toUpperCase() === cleanCode);
  if (!targetCourse) {
    return { success: false, message: `No course found matching code "${cleanCode}". Please verify with your instructor.` };
  }

  const currentEnrolled = activeUser.enrolledCourseIds || [];
  if (currentEnrolled.includes(targetCourse.id)) {
    return {
      success: false,
      message: `You are already enrolled in ${targetCourse.code} (${targetCourse.title}).`,
      course: targetCourse
    };
  }

  // Check if there's already a pending request
  const existingPending = db.enrollmentRequests.find(
    r => r.studentId === activeUser.id && r.courseId === targetCourse.id && r.status === 'pending'
  );
  if (existingPending) {
    return {
      success: false,
      message: `You already have a pending join request for ${targetCourse.code}.`,
      course: targetCourse
    };
  }

  // Create pending request instead of instant enrollment
  createEnrollmentRequest(targetCourse.id, 'self_join');

  return {
    success: true,
    message: `Join request sent for ${targetCourse.code} - ${targetCourse.title}. Waiting for instructor approval.`,
    course: targetCourse
  };
};
```

- [ ] **Step 9: Update `enrollStudentsInCourse` to create pending requests**

Replace the body of `enrollStudentsInCourse` (lines 1094-1130):

```typescript
const enrollStudentsInCourse = (studentIds: string[], courseId: string) => {
  const targetCourseId = courseId || activeCourseId;
  if (!targetCourseId || studentIds.length === 0) return;

  // Create pending requests for each student
  for (const studentId of studentIds) {
    const student = db.users.find(u => u.id === studentId);
    if (!student) continue;

    // Skip if already enrolled or already has pending request
    const alreadyEnrolled = (student.enrolledCourseIds || []).includes(targetCourseId);
    const alreadyPending = db.enrollmentRequests.find(
      r => r.studentId === studentId && r.courseId === targetCourseId && r.status === 'pending'
    );

    if (!alreadyEnrolled && !alreadyPending) {
      const newRequest: EnrollmentRequest = {
        id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        courseId: targetCourseId,
        studentId: student.id,
        studentName: student.name,
        type: 'faculty_enroll',
        status: 'pending',
        requestedAt: new Date().toISOString()
      };

      setDb(prev => ({
        ...prev,
        enrollmentRequests: [...prev.enrollmentRequests, newRequest]
      }));
    }
  }
};
```

- [ ] **Step 10: Expose all new functions in context value**

Add all new functions to the return object of `LMSProvider`.

- [ ] **Step 11: Commit**

```bash
git add src/context/LMSContext.tsx
git commit -m "feat(sections): add enrollment request workflow and approval logic"
```

---

### Task 4: Create Section Selection Page

**Files:**
- Create: `src/pages/SectionSelectionPage.tsx`

**Interfaces:**
- Consumes: `getCourseSections()`, `selectSection()` from LMSContext
- Produces: `<SectionSelectionPage courseId onSectionSelected />`

- [ ] **Step 1: Create `src/pages/SectionSelectionPage.tsx`**

```typescript
import React from 'react';
import { useLMS } from '../context/LMSContext';
import { BookOpen, MapPin, Clock, Users, Check, ArrowLeft } from 'lucide-react';

interface SectionSelectionPageProps {
  courseId: string;
  onSectionSelected: () => void;
}

export const SectionSelectionPage: React.FC<SectionSelectionPageProps> = ({
  courseId,
  onSectionSelected
}) => {
  const { db, activeUser, selectSection, showAlert } = useLMS();
  const course = db.courses.find(c => c.id === courseId);
  const sections = db.courseSections.filter(s => s.courseId === courseId);

  const currentSectionId = activeUser.courseSections?.[courseId];

  const handleSelectSection = (sectionId: string) => {
    const section = db.courseSections.find(s => s.id === sectionId);
    if (!section) return;

    if (section.enrolledCount >= section.capacity) {
      showAlert({ title: 'Section Full', message: 'This section has reached its maximum capacity.', type: 'warning' });
      return;
    }

    selectSection(courseId, sectionId);
    showAlert({ title: 'Section Selected', message: `You have been assigned to ${section.name}.`, type: 'success' });
    onSectionSelected();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onSectionSelected} className="p-2 hover:bg-muted rounded-xl cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold">Select Your Section</h1>
          <p className="text-sm text-muted-foreground">
            {course?.code} — {course?.title}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {sections.map(section => {
          const isFull = section.enrolledCount >= section.capacity;
          const isSelected = currentSectionId === section.id;
          const slotsLeft = section.capacity - section.enrolledCount;

          return (
            <button
              key={section.id}
              onClick={() => !isFull && !isSelected && handleSelectSection(section.id)}
              disabled={isFull || isSelected}
              className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : isFull
                  ? 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="font-extrabold">{section.name}</span>
                </div>
                {isSelected && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <Check className="w-4 h-4" /> Selected
                  </span>
                )}
                {isFull && !isSelected && (
                  <span className="text-xs font-bold text-red-500">Full</span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {section.schedule && (
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {section.schedule}</span>
                )}
                {section.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {section.location}</span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {section.enrolledCount}/{section.capacity} enrolled
                  {!isFull && <span className="text-emerald-600">({slotsLeft} slots left)</span>}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/SectionSelectionPage.tsx
git commit -m "feat(sections): create SectionSelectionPage for student section picker"
```

---

### Task 5: Create Pending Requests Page (Faculty)

**Files:**
- Create: `src/pages/PendingRequestsPage.tsx`

**Interfaces:**
- Consumes: `getPendingRequestsForCourse()`, `approveEnrollmentRequests()`, `rejectEnrollmentRequests()` from LMSContext
- Produces: `<PendingRequestsPage courseId />`

- [ ] **Step 1: Create `src/pages/PendingRequestsPage.tsx`**

```typescript
import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { PageHeader } from '../components/common/PageHeader';
import { CheckCircle, XCircle, Clock, UserPlus, Search } from 'lucide-react';

interface PendingRequestsPageProps {
  courseId: string;
}

export const PendingRequestsPage: React.FC<PendingRequestsPageProps> = ({ courseId }) => {
  const { db, activeRole, approveEnrollmentRequests, rejectEnrollmentRequests, showAlert, showConfirm } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const allRequests = db.enrollmentRequests.filter(r => r.courseId === courseId);
  const pendingRequests = allRequests.filter(r => r.status === 'pending');

  const filteredRequests = pendingRequests.filter(r => {
    const q = searchQuery.toLowerCase();
    return r.studentName.toLowerCase().includes(q) || r.type.toLowerCase().includes(q);
  });

  const handleToggle = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleApproveSelected = () => {
    if (selectedIds.length === 0) return;
    approveEnrollmentRequests(selectedIds);
    showAlert({
      title: 'Requests Approved',
      message: `${selectedIds.length} student(s) approved. They can now select their section.`,
      type: 'success'
    });
    setSelectedIds([]);
  };

  const handleApproveAll = () => {
    const allIds = filteredRequests.map(r => r.id);
    approveEnrollmentRequests(allIds);
    showAlert({
      title: 'All Requests Approved',
      message: `${allIds.length} student(s) approved.`,
      type: 'success'
    });
  };

  const handleReject = (ids: string[]) => {
    rejectEnrollmentRequests(ids);
    showAlert({ title: 'Requests Rejected', message: `${ids.length} request(s) rejected.`, type: 'warning' });
    setSelectedIds(prev => prev.filter(i => !ids.includes(i)));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Pending Enrollment Requests"
        description={`${pendingRequests.length} pending request(s) for ${course?.code || 'course'}`}
        actions={
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <>
                <button onClick={handleApproveSelected} className="px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl cursor-pointer">
                  Approve Selected ({selectedIds.length})
                </button>
                <button onClick={() => handleReject(selectedIds)} className="px-3 py-2 text-xs font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-xl cursor-pointer">
                  Reject Selected
                </button>
              </>
            )}
            {filteredRequests.length > 0 && (
              <button onClick={handleApproveAll} className="px-3 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl cursor-pointer">
                Approve All
              </button>
            )}
          </div>
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search students..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No pending requests</p>
          <p className="text-xs mt-1">All enrollment requests have been processed.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredRequests.length && filteredRequests.length > 0}
                    onChange={() => {
                      if (selectedIds.length === filteredRequests.length) setSelectedIds([]);
                      else setSelectedIds(filteredRequests.map(r => r.id));
                    }}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="p-3 text-left font-bold text-xs">Student</th>
                <th className="p-3 text-left font-bold text-xs">Type</th>
                <th className="p-3 text-left font-bold text-xs">Requested</th>
                <th className="p-3 text-right font-bold text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => (
                <tr key={req.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(req.id)}
                      onChange={() => handleToggle(req.id)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-semibold text-xs">{req.studentName}</div>
                    <div className="text-[11px] text-muted-foreground">{req.studentId}</div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      req.type === 'self_join' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'
                    }`}>
                      {req.type === 'self_join' ? 'Self-Join' : 'Faculty Enroll'}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(req.requestedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => approveEnrollmentRequests([req.id])}
                        className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-600 cursor-pointer"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReject([req.id])}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-500 cursor-pointer"
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/PendingRequestsPage.tsx
git commit -m "feat(sections): create PendingRequestsPage for faculty approval dashboard"
```

---

### Task 6: Update CreateCoursePage — Section Creation

**Files:**
- Modify: `src/pages/CreateCoursePage.tsx:1-100,150-300`

**Interfaces:**
- Consumes: `createSection()` from LMSContext
- Produces: Section list in course creation form

- [ ] **Step 1: Add section state**

After existing state variables (around line 80), add:

```typescript
const [sections, setSections] = useState<Array<{ name: string; capacity: number; schedule: string; location: string }>>([
  { name: 'Section A', capacity: 40, schedule: '', location: '' }
]);
```

- [ ] **Step 2: Add section UI to the form**

After the join code section in the form (find the `courseJoinCode` section), add:

```tsx
{/* Sections */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <label className="text-xs font-bold text-foreground">Sections</label>
    <button
      type="button"
      onClick={() => setSections(prev => [
        ...prev,
        { name: `Section ${String.fromCharCode(65 + prev.length)}`, capacity: 40, schedule: '', location: '' }
      ])}
      className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" /> Add Section
    </button>
  </div>

  {sections.map((section, idx) => (
    <div key={idx} className="p-3 bg-muted/50 rounded-xl border border-border space-y-2">
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={section.name}
          onChange={e => {
            const updated = [...sections];
            updated[idx].name = e.target.value;
            setSections(updated);
          }}
          className="text-sm font-bold bg-transparent border-none outline-none flex-1"
          placeholder="Section name"
        />
        {sections.length > 1 && (
          <button
            type="button"
            onClick={() => setSections(prev => prev.filter((_, i) => i !== idx))}
            className="p-1 hover:bg-red-500/10 rounded-lg text-red-500 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          value={section.capacity}
          onChange={e => {
            const updated = [...sections];
            updated[idx].capacity = parseInt(e.target.value) || 40;
            setSections(updated);
          }}
          className="text-xs p-2 bg-background border border-border rounded-lg"
          placeholder="Capacity"
          min="1"
        />
        <input
          type="text"
          value={section.schedule}
          onChange={e => {
            const updated = [...sections];
            updated[idx].schedule = e.target.value;
            setSections(updated);
          }}
          className="text-xs p-2 bg-background border border-border rounded-lg"
          placeholder="Schedule"
        />
        <input
          type="text"
          value={section.location}
          onChange={e => {
            const updated = [...sections];
            updated[idx].location = e.target.value;
            setSections(updated);
          }}
          className="text-xs p-2 bg-background border border-border rounded-lg"
          placeholder="Location"
        />
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Update `handleSubmit` to create sections**

In the `handleSubmit` function, after `createCourse(...)` is called, loop through sections and call `createSection()`:

```typescript
const newCourse = createCourse({...});
sections.forEach(s => {
  createSection(newCourse.id, { name: s.name, capacity: s.capacity, schedule: s.schedule, location: s.location });
});
```

- [ ] **Step 4: Import `createSection` from useLMS**

Update the destructuring at the top of the component:

```typescript
const { activeUser, db, createCourse, createSection, showAlert } = useLMS();
```

Also import `X` from lucide-react if not already imported.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CreateCoursePage.tsx
git commit -m "feat(sections): add section creation UI to CreateCoursePage"
```

---

### Task 7: Update JoinCourseModal — Show Pending Status

**Files:**
- Modify: `src/components/common/JoinCourseModal.tsx:40-66,100-160`

**Interfaces:**
- Consumes: `createEnrollmentRequest` (indirectly via updated `joinCourseByCode`)
- Produces: Updated modal showing pending status

- [ ] **Step 1: Update success feedback**

After the successful `joinCourseByCode` call (line 57-61), update the success message and navigation:

```typescript
onClose();
showAlert({
  title: 'Join Request Sent',
  message: res.message,
  type: 'success'
});

// Don't navigate to course yet — student needs approval first
```

- [ ] **Step 2: Update already-enrolled check to also check pending**

The `isAlreadyEnrolled` memo (line 33-36) should also check for pending requests:

```typescript
const isAlreadyPending = useMemo(() => {
  if (!matchedCourse) return false;
  return db.enrollmentRequests.some(
    r => r.studentId === activeUser.id && r.courseId === matchedCourse.id && r.status === 'pending'
  );
}, [matchedCourse, activeUser.id, db.enrollmentRequests]);

const isAlreadyEnrolled = useMemo(() => {
  if (!matchedCourse) return false;
  return (activeUser.enrolledCourseIds || []).includes(matchedCourse.id);
}, [matchedCourse, activeUser.enrolledCourseIds]);
```

- [ ] **Step 3: Update button disabled state**

Update the submit button to also disable when `isAlreadyPending`:

```typescript
disabled={!code.trim() || isAlreadyEnrolled || isAlreadyPending}
```

And add a "Request Pending" status in the match preview:

```typescript
{isAlreadyPending ? (
  <span className="font-bold text-amber-600 dark:text-amber-400">Request Pending</span>
) : isAlreadyEnrolled ? (
  <span className="font-bold text-amber-600 dark:text-amber-400">Already Joined</span>
) : (
  <span className="font-bold text-emerald-600 dark:text-emerald-400">Ready to Request</span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/common/JoinCourseModal.tsx
git commit -m "feat(sections): update JoinCourseModal for pending request flow"
```

---

### Task 8: Update PeopleView — Pending Requests Panel and Section Breakdown

**Files:**
- Modify: `src/pages/PeopleView.tsx:1-100,100-429`

**Interfaces:**
- Consumes: `getPendingRequestsForCourse()`, `approveEnrollmentRequests()`, `getCourseSections()`
- Produces: Updated PeopleView with section tabs and inline pending requests

- [ ] **Step 1: Add pending requests state and section filter**

After existing state variables (around line 31), add:

```typescript
const [activeTab, setActiveTab] = useState<'roster' | 'pending'>('roster');
const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
```

- [ ] **Step 2: Add tab toggle and section filter UI**

Before the search bar (around line 87), add a tab toggle:

```tsx
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setActiveTab('roster')}
    className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer ${
      activeTab === 'roster' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
    }`}
  >
    Roster
  </button>
  <button
    onClick={() => setActiveTab('pending')}
    className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer relative ${
      activeTab === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
    }`}
  >
    Pending Requests
    {pendingCount > 0 && (
      <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
    )}
  </button>
</div>
```

- [ ] **Step 3: Add section filter dropdown for roster tab**

When `activeTab === 'roster'`, show section filter:

```tsx
{activeTab === 'roster' && (
  <div className="flex gap-2 mb-4">
    <button
      onClick={() => setSelectedSectionFilter('all')}
      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer ${
        selectedSectionFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}
    >
      All Sections
    </button>
    {courseSections.map(s => (
      <button
        key={s.id}
        onClick={() => setSelectedSectionFilter(s.id)}
        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer ${
          selectedSectionFilter === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {s.name} ({s.enrolledCount}/{s.capacity})
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 4: Filter students by section**

Update the students filter to respect section filter:

```typescript
const students = db.users.filter(u => {
  if (u.role !== 'student') return false;
  if (!u.enrolledCourseIds || !u.enrolledCourseIds.includes(courseId)) return false;
  if (selectedSectionFilter !== 'all') {
    const studentSection = u.courseSections?.[courseId];
    if (studentSection !== selectedSectionFilter) return false;
  }
  return true;
});
```

- [ ] **Step 5: Show section badge in student row**

In the student table row, after the student name, add section badge:

```tsx
<span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
  {db.courseSections.find(s => s.id === u.courseSections?.[courseId])?.name || 'No Section'}
</span>
```

- [ ] **Step 6: Show pending requests when tab is 'pending'**

When `activeTab === 'pending'`, render pending requests list (inline version of PendingRequestsPage, or navigate to it). For simplicity, show inline:

```tsx
{activeTab === 'pending' && (
  <PendingRequestsInline courseId={courseId} />
)}
```

Or keep it simple and show a button to navigate to the pending requests page.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PeopleView.tsx
git commit -m "feat(sections): add pending requests panel and section filter to PeopleView"
```

---

### Task 9: Update Announcement Pages — Section Targeting

**Files:**
- Modify: `src/pages/CreateAnnouncementPage.tsx:81-100`
- Modify: `src/pages/AnnouncementsView.tsx:63-79`

**Interfaces:**
- Consumes: `getCourseSections()`, `activeUser.courseSections`
- Produces: Section-restricted announcement creation and filtered viewing

- [ ] **Step 1: Add section dropdown to CreateAnnouncementPage**

In `CreateAnnouncementPage`, add state for section restriction:

```typescript
const [sectionRestriction, setSectionRestriction] = useState('all');
```

And get sections:

```typescript
const courseSections = db.courseSections.filter(s => s.courseId === courseId);
```

Add a dropdown in the form (after the content textarea, before the options):

```tsx
{courseSections.length > 0 && (
  <div>
    <label className="block text-xs font-bold text-foreground mb-1.5">Post to Section</label>
    <select
      value={sectionRestriction}
      onChange={e => setSectionRestriction(e.target.value)}
      className="w-full p-2.5 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
    >
      <option value="all">All Sections</option>
      {courseSections.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  </div>
)}
```

Update `createAnnouncement` call to use the section:

```typescript
createAnnouncement({
  courseId,
  title: title.trim(),
  content: content.trim(),
  sectionRestriction: sectionRestriction === 'all' ? 'All Sections' : sectionRestriction,
  // ... rest of fields
});
```

- [ ] **Step 2: Filter announcements in AnnouncementsView by student's section**

In `AnnouncementsView`, after getting announcements (line 64-66), filter by section:

```typescript
const courseSections = db.courseSections.filter(c => c.id === courseId);
const studentSectionId = activeUser.courseSections?.[courseId];

const announcements = (db.announcements || []).filter(a => {
  if (a.courseId !== courseId && a.courseId !== 'all') return false;

  // Faculty sees all announcements
  if (activeRole === 'faculty') return true;

  // Student filtering: show "All Sections" or matching their section
  if (!a.sectionRestriction || a.sectionRestriction === 'All Sections') return true;
  return a.sectionRestriction === studentSectionId;
});
```

- [ ] **Step 3: Show section badge on announcements**

In the announcement list item, add a section badge when it's section-restricted:

```tsx
{a.sectionRestriction && a.sectionRestriction !== 'All Sections' && (
  <span className="text-[10px] font-bold bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded-full">
    {db.courseSections.find(s => s.id === a.sectionRestriction)?.name || a.sectionRestriction}
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/CreateAnnouncementPage.tsx src/pages/AnnouncementsView.tsx
git commit -m "feat(sections): add section targeting to announcements"
```

---

### Task 10: Update Dashboard — Show Pending Invitations for Students

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `getPendingRequestsForStudent()`, `studentApproveInvitation()`
- Produces: Pending invitation cards on student dashboard

- [ ] **Step 1: Add pending invitations section to student dashboard**

In `DashboardPage`, in the student dashboard section, add a pending invitations card:

```tsx
{activeRole === 'student' && pendingInvitations.length > 0 && (
  <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
    <h3 className="text-sm font-extrabold flex items-center gap-2">
      <Clock className="w-4 h-4 text-amber-500" /> Pending Invitations
    </h3>
    {pendingInvitations.map(req => {
      const course = db.courses.find(c => c.id === req.courseId);
      return (
        <div key={req.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
          <div>
            <div className="text-xs font-bold">{course?.code} — {course?.title}</div>
            <div className="text-[11px] text-muted-foreground">Invited by {course?.instructorName}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => studentApproveInvitation(req.id)}
              className="px-3 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
            >
              Accept
            </button>
            <button
              onClick={() => { /* reject */ }}
              className="px-3 py-1.5 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 2: Import Clock icon from lucide-react**

Add `Clock` to the lucide-react imports in DashboardPage.

- [ ] **Step 3: Add redirect to section selection after accept**

When a student accepts an invitation, redirect to section selection:

```typescript
const handleAcceptInvitation = (reqId: string, courseId: string) => {
  studentApproveInvitation(reqId);
  // Navigate to section selection
  onNavigateCourse(courseId, 'section-selection');
};
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat(sections): show pending invitations on student dashboard"
```

---

### Task 11: Update Routing and Navigation

**Files:**
- Modify: `src/App.tsx:98-153`
- Modify: `src/config/navigation.ts:21-30`
- Modify: `src/components/layout/LMSContextPanel.tsx:10-15`
- Modify: `src/pages/CoursesPage.tsx:20-30,54-118`

**Interfaces:**
- Consumes: `SectionSelectionPage`, `PendingRequestsPage`
- Produces: Routes for new pages, navigation entries

- [ ] **Step 1: Add `pending-requests` to COURSE_CHILDREN**

In `src/config/navigation.ts`, add to `COURSE_CHILDREN`:

```typescript
{ id: 'pending-requests', label: 'Pending Requests', icon: 'people', roles: ['faculty'] },
```

- [ ] **Step 2: Add COURSE_ICONS entry for pending-requests**

In `src/components/layout/LMSContextPanel.tsx`, add:

```typescript
'pending-requests': <Users className="h-4 w-4" />,
```

- [ ] **Step 3: Add section-selection and pending-requests sub-tabs to CoursesPage**

In `CoursesPage.tsx`, add imports:

```typescript
import { SectionSelectionPage } from './SectionSelectionPage';
import { PendingRequestsPage } from './PendingRequestsPage';
```

Add routing cases in the sub-tab switch:

```tsx
{subTab === 'section-selection' && activeRole === 'student' && (
  <SectionSelectionPage
    courseId={activeCourse.id}
    onSectionSelected={() => setSubTab('modules')}
  />
)}

{subTab === 'pending-requests' && activeRole === 'faculty' && (
  <PendingRequestsPage courseId={activeCourse.id} />
)}
```

- [ ] **Step 4: Block students from accessing pending-requests**

Add guard (like the existing people guard):

```typescript
useEffect(() => {
  if (activeRole === 'student' && subTab === 'people') {
    setSubTab('modules');
  }
  if (activeRole === 'student' && subTab === 'pending-requests') {
    setSubTab('modules');
  }
}, [activeRole, subTab]);
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/config/navigation.ts src/components/layout/LMSContextPanel.tsx src/pages/CoursesPage.tsx
git commit -m "feat(sections): add routing for SectionSelection and PendingRequests pages"
```

---

### Task 12: Update LMSContextPanel — Show Student Section

**Files:**
- Modify: `src/components/layout/LMSContextPanel.tsx:42-46`

**Interfaces:**
- Consumes: `getStudentSection()`
- Produces: Section info display in course nav

- [ ] **Step 1: Show student's section in course card**

In the course card in `LMSContextPanel` (around line 42-46), add section info for students:

```tsx
{activeRole === 'student' && studentSection && (
  <div className="text-[10px] text-primary font-bold mt-0.5">
    {studentSection.name}
  </div>
)}
```

Compute `studentSection` from context:

```typescript
const studentSection = activeRole === 'student'
  ? db.courseSections.find(s => s.id === activeUser.courseSections?.[activeCourseId || ''])
  : null;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/LMSContextPanel.tsx
git commit -m "feat(sections): show student section in course navigation panel"
```

---

### Task 13: End-to-End Testing and Polish

**Files:**
- All modified files

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working feature

- [ ] **Step 1: Test course creation with sections**

1. Log in as faculty
2. Create a new course with 2 sections
3. Verify sections appear in PeopleView

- [ ] **Step 2: Test self-join flow**

1. Log in as student
2. Use JoinCourseModal with course code
3. Verify pending request is created (not instant enrollment)
4. Switch to faculty → approve in PeopleView
5. Switch to student → verify section selection page appears
6. Select a section → verify enrollment

- [ ] **Step 3: Test faculty enroll flow**

1. Log in as faculty
2. Go to PeopleView → Enroll Person
3. Select students → verify pending requests created
4. Switch to student → verify invitation appears on dashboard
5. Accept → verify section selection
6. Select section → verify enrollment

- [ ] **Step 4: Test section-specific announcements**

1. Create announcement targeting specific section
2. Log in as student in that section → verify visible
3. Log in as student in different section → verify not visible
4. Create "All Sections" announcement → verify visible to all

- [ ] **Step 5: Test section capacity**

1. Try enrolling more students than section capacity
2. Verify capacity enforcement

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(sections): complete section feature with approval workflow"
```
