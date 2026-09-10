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
