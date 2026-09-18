# Sibling approvedIds fragment (from stash sdd-task4-sibling, dropped after Task 4 resolution)

Orthogonal enrollment widening to re-apply to FacultyGradebook in Task 8.
Verbatim sibling code (was inside the conflict region, stash side):

```tsx
const course = db.courses.find(c => c.id === courseId);
const approvedIds = new Set(
  (db.enrollmentRequests || [])
    .filter(r => r.courseId === courseId && r.status === 'approved')
    .map(r => r.studentId)
);
const students = db.users.filter(
  u => u.role === 'student' && (!u.enrolledCourseIds || u.enrolledCourseIds.includes(courseId) || approvedIds.has(u.id))
);
```

Current Task-4 committed version uses (narrower):
```tsx
const course = db.courses.find(c => c.id === courseId);
const students = db.users.filter(
  u => u.role === 'student' && (!u.enrolledCourseIds || u.enrolledCourseIds.includes(courseId))
);
```

Task 8 step: replace the narrower block with the sibling verbatim block + keep everything else; verify `npx vitest run` unaffected (no unit test — manual roster check) and `tsc -b` clean. Note: `db.enrollmentRequests` is an optional field — sibling code uses `(db.enrollmentRequests || [])`, safe.
