# Task 1 brief — Navigation config + tokens

Single source of requirements. Implement exactly this.

**Files:**
- Create: `src/config/navigation.ts`
- Modify: `src/index.css` line 8 (`--background: 220 14% 97.5%;` → `--background: 220 14% 98.5%;`)
- Test: typecheck

**Interfaces:**
- Consumes: `src/types/lms.ts` type `UserRole` (`'admin' | 'faculty' | 'student' | 'staff'`).
- Produces: `export type NavIcon`, `export interface NavItem { id: string; label: string; icon: NavIcon; roles: UserRole[] }`, `export const MAIN_NAV: NavItem[]`, `LMS_CHILDREN: NavItem[]`, `COURSE_CHILDREN: NavItem[]`, `isVisible(item, role)`.

Exact values (copy verbatim):

```ts
import type { UserRole } from '../types/lms';
export type NavIcon = 'dashboard'|'courses'|'calendar'|'inbox'|'history'|'help'|'modules'|'syllabus'|'announcements'|'activities'|'quizzes'|'files'|'grades'|'people'|'accounts'|'page1'|'page2'|'page3';
export interface NavItem { id: string; label: string; icon: NavIcon; roles: UserRole[] }
const ALL: UserRole[] = ['admin','faculty','student','staff'];
const NO_STAFF: UserRole[] = ['admin','faculty','student'];
export const MAIN_NAV: NavItem[] = [
  { id: 'page1', label: 'Page 1', icon: 'page1', roles: NO_STAFF },
  { id: 'page2', label: 'Page 2', icon: 'page2', roles: NO_STAFF },
  { id: 'page3', label: 'Page 3', icon: 'page3', roles: NO_STAFF },
  { id: 'lms', label: 'Learning Management', icon: 'courses', roles: ALL },
  { id: 'accounts', label: 'Manage College Accounts', icon: 'accounts', roles: ['admin'] },
];
export const LMS_CHILDREN: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: NO_STAFF },
  { id: 'courses', label: 'Courses', icon: 'courses', roles: NO_STAFF },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', roles: ALL },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', roles: ALL },
  { id: 'history', label: 'History', icon: 'history', roles: ALL },
  { id: 'help', label: 'Help', icon: 'help', roles: ALL },
];
export const COURSE_CHILDREN: NavItem[] = [
  { id: 'modules', label: 'Modules', icon: 'modules', roles: ALL },
  { id: 'syllabus', label: 'Syllabus', icon: 'syllabus', roles: ALL },
  { id: 'announcements', label: 'Announcements', icon: 'announcements', roles: ALL },
  { id: 'assignments', label: 'Activities', icon: 'activities', roles: ALL },
  { id: 'quizzes', label: 'Quizzes', icon: 'quizzes', roles: ALL },
  { id: 'files', label: 'Files', icon: 'files', roles: ALL },
  { id: 'grades', label: 'Grades', icon: 'grades', roles: ALL },
  { id: 'people', label: 'People', icon: 'people', roles: NO_STAFF },
];
export function isVisible(item: NavItem, role: UserRole): boolean { return item.roles.includes(role); }
```

Steps:
- [ ] Step 1: confirm `src/config/navigation.ts` does not exist yet.
- [ ] Step 2: run `npm run typecheck` (passes on baseline; the "fail" is the missing module once imported — do not break anything to prove it).
- [ ] Step 3: create the file with the code above; edit `src/index.css` line 8 only.
- [ ] Step 4: run `npm run typecheck` → must PASS.
- [ ] Step 5: commit with `git add src/config/navigation.ts src/index.css` + `git commit -m "feat: add navigation config and paper token"`.

Global constraints: no new deps, hierarchy normative, typecheck+build must pass.
