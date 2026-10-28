import type { UserRole } from '../types/lms';
export type NavIcon = 'dashboard'|'courses'|'calendar'|'inbox'|'history'|'help'|'modules'|'syllabus'|'announcements'|'assessments'|'activities'|'quizzes'|'assignments'|'projects'|'presentations'|'exams'|'files'|'grades'|'people'|'accounts'|'governance'|'page1'|'page2'|'page3'|'pending-requests'|'gabay-rag';
export interface NavItem { id: string; label: string; icon: NavIcon; roles: UserRole[] }
export const ALL: UserRole[] = ['superadmin', 'admin', 'faculty', 'student', 'staff'];
export const NO_STAFF: UserRole[] = ['superadmin', 'admin', 'faculty', 'student'];
export const MAIN_NAV: NavItem[] = [
  { id: 'lms', label: 'Learning Management', icon: 'courses', roles: ALL },
  { id: 'gabay-rag', label: 'Gabay RAG', icon: 'gabay-rag', roles: ALL },
  { id: 'page1', label: 'Syllabus Creator', icon: 'page1', roles: ['superadmin', 'admin', 'faculty'] },
  { id: 'page2', label: 'Page 2', icon: 'page2', roles: NO_STAFF },
  { id: 'page3', label: 'Page 3', icon: 'page3', roles: NO_STAFF },
  { id: 'governance', label: 'Academic Governance', icon: 'governance', roles: ['superadmin', 'admin'] },
  { id: 'accounts', label: 'Manage College Accounts', icon: 'accounts', roles: ['superadmin', 'admin'] },
];

export function canAccessAccountManagement(role?: UserRole | string | null, _adminSubrole?: string | null): boolean {
  return role === 'superadmin' || role === 'admin';
}
export const LMS_CHILDREN: NavItem[] = [
  { id: 'dashboard', label: 'Courses', icon: 'dashboard', roles: NO_STAFF },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', roles: ALL },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', roles: ALL },
];
export const COURSE_CHILDREN: NavItem[] = [
  { id: 'modules', label: 'Modules', icon: 'modules', roles: ALL },
  { id: 'syllabus', label: 'Syllabus', icon: 'syllabus', roles: ALL },
  { id: 'announcements', label: 'Announcements', icon: 'announcements', roles: ALL },
  { id: 'assessments', label: 'Assessments', icon: 'assessments', roles: ALL },
  { id: 'files', label: 'Files', icon: 'files', roles: ALL },
  { id: 'grades', label: 'Grades', icon: 'grades', roles: ALL },
  { id: 'people', label: 'People', icon: 'people', roles: NO_STAFF },
];

export const ASSESSMENT_SUB_ITEMS: { id: string; label: string; icon: NavIcon }[] = [
  { id: 'assessments', label: 'Overview', icon: 'assessments' },
  { id: 'activities', label: 'Activities', icon: 'activities' },
  { id: 'quizzes', label: 'Quizzes', icon: 'quizzes' },
  { id: 'assignments', label: 'Assignments', icon: 'assignments' },
  { id: 'projects', label: 'Projects', icon: 'projects' },
  { id: 'presentations', label: 'Presentations', icon: 'presentations' },
];

export const ASSESSMENT_TAB_IDS = ['assessments', 'activities', 'quizzes', 'assignments', 'projects', 'presentations'] as const;
export function isAssessmentTab(tab: string): boolean {
  return (ASSESSMENT_TAB_IDS as readonly string[]).includes(tab);
}
export function isVisible(item: NavItem, role: UserRole): boolean { return item.roles.includes(role); }

// Top-level tabs that live outside the Learning Management section
// (derived from MAIN_NAV so new top-level pages are excluded automatically).
const NON_LMS_TOP_LEVEL_TABS: string[] = MAIN_NAV.filter(i => i.id !== 'lms').map(i => i.id);
// Standalone authoring pages that should render full-width without the LMS context panel.
const FULL_WIDTH_TABS: string[] = ['create-account', 'create-leadership', 'edit-account', 'account-profile'];
// Self-contained utility pages reached from the topbar. They live outside the
// Learning Management section, so the LMS navigation panel is hidden on them too.
const STANDALONE_TABS: string[] = ['profile', 'history', 'help'];
export function isLmsSectionTab(tab: string): boolean {
  return (
    !NON_LMS_TOP_LEVEL_TABS.includes(tab) &&
    !FULL_WIDTH_TABS.includes(tab) &&
    !STANDALONE_TABS.includes(tab)
  );
}
