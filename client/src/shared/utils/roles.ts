import type { UserRole, AdminSubrole } from '../types/lms';

export interface RoleResolvableUser {
  role?: UserRole | string | null;
  adminSubrole?: AdminSubrole | string | null;
  title?: string | null;
}

/**
 * Returns the human-readable display role for a user or role/subrole combo.
 * If user is an admin or superadmin/chancellor:
 *   - 'dean' subrole or title containing 'dean' -> 'Dean'
 *   - 'chairperson' subrole or title containing 'chair' -> 'Chair'
 *   - otherwise -> 'Admin'
 * If faculty -> 'Faculty'
 * If staff -> 'Staff'
 * If student -> 'Student'
 */
export function getDisplayRoleLabel(user?: RoleResolvableUser | null, fallbackRole?: string): string {
  if (!user && !fallbackRole) return 'User';

  const role = (user?.role || fallbackRole || '').toLowerCase();
  const subrole = (user?.adminSubrole || '').toLowerCase();
  const title = (user?.title || '').toLowerCase();

  if (role === 'dean' || subrole === 'dean' || title.includes('dean')) {
    return 'Dean';
  }

  if (role === 'chairperson' || role === 'chair' || subrole === 'chairperson' || subrole === 'chair' || title.includes('chair')) {
    return 'Chair';
  }

  if (role === 'admin' || role === 'superadmin' || subrole === 'chancellor' || title.includes('chancellor')) {
    return 'Admin';
  }

  if (role === 'faculty' || role === 'instructor') {
    return 'Faculty';
  }

  if (role === 'staff') {
    return 'Staff';
  }

  if (role === 'student') {
    return 'Student';
  }

  return user?.role ? capitalizeFirst(String(user.role)) : (fallbackRole ? capitalizeFirst(fallbackRole) : 'User');
}

function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function isDeanRole(user?: RoleResolvableUser | null, activeRole?: string): boolean {
  const role = (user?.role || activeRole || '').toLowerCase();
  const subrole = (user?.adminSubrole || '').toLowerCase();
  const title = (user?.title || '').toLowerCase();
  return (
    role === 'dean' ||
    ((role === 'admin' || role === 'superadmin') && (subrole === 'dean' || title.includes('dean')))
  );
}

export function isChairRole(user?: RoleResolvableUser | null, activeRole?: string): boolean {
  const role = (user?.role || activeRole || '').toLowerCase();
  const subrole = (user?.adminSubrole || '').toLowerCase();
  const title = (user?.title || '').toLowerCase();
  return (
    role === 'chairperson' ||
    role === 'chair' ||
    subrole === 'chairperson' ||
    subrole === 'chair' ||
    title.includes('chair')
  );
}

/**
 * Checks if the user is strictly in a faculty/teaching role (instructor/faculty).
 * Deans, Program Chairs, and Admins are administrative monitors and do NOT hold faculty roles.
 */
export function isFacultyRole(user?: RoleResolvableUser | null, activeRole?: string): boolean {
  if (!user && !activeRole) return false;
  if (isAdministrativeMonitor(user, activeRole)) return false;
  const role = (user?.role || activeRole || '').toLowerCase();
  const subrole = (user?.adminSubrole || '').toLowerCase();
  const title = (user?.title || '').toLowerCase();
  if (subrole === 'dean' || subrole === 'chairperson' || subrole === 'chair' || subrole === 'chancellor') return false;
  if (title.includes('dean') || title.includes('chair') || title.includes('chancellor') || title.includes('administrator')) return false;
  return role === 'faculty' || role === 'instructor';
}

/**
 * Checks if the user is in an administrative monitoring persona (Chancellor/Admin, Dean, or Chairperson).
 */
export function isAdministrativeMonitor(user?: RoleResolvableUser | null, activeRole?: string): boolean {
  const role = (user?.role || activeRole || '').toLowerCase();
  return (
    role === 'admin' ||
    role === 'superadmin' ||
    isDeanRole(user, activeRole) ||
    isChairRole(user, activeRole)
  );
}

/**
 * Checks if a user is the assigned faculty instructor for a specific course.
 */
export function isCourseAssignedInstructor(
  course?: { instructorId?: string; instructor_id?: string; instructor?: any } | null,
  user?: { id?: string } | null
): boolean {
  if (!course || !user?.id) return false;
  const instructorId =
    course.instructorId ||
    course.instructor_id ||
    (typeof course.instructor === 'object' ? course.instructor?.id : course.instructor);
  return Boolean(instructorId && String(instructorId) === String(user.id));
}

/**
 * Checks if a user has permission to author, edit, or delete content within a course.
 * Strictly limited to the assigned faculty instructor.
 * Administrators, Deans, Program Chairs, and other unassigned users act in an audit/monitoring capacity.
 */
export function canManageCourseContent(
  course?: { instructorId?: string; instructor_id?: string; instructor?: any } | null,
  user?: { id?: string } | null
): boolean {
  return isCourseAssignedInstructor(course, user);
}

export function canCreateCourse(user?: RoleResolvableUser | null, activeRole?: string): boolean {
  return isChairRole(user, activeRole);
}

/**
 * Course deletion is strictly restricted to Program Chairpersons (who manage course offerings).
 * Administrators, Faculty, Deans, and students cannot delete course shells.
 */
export function canDeleteCourse(user?: RoleResolvableUser | null, activeRole?: string): boolean {
  if (!user && !activeRole) return false;
  return isChairRole(user, activeRole);
}

export const AUTHORITY_RANK: Record<string, number> = {
  Admin: 1,
  Dean: 2,
  Chair: 3,
  Faculty: 4,
  Staff: 5,
  Student: 6,
};

export function getAuthorityRank(user?: RoleResolvableUser | null, fallbackRole?: string): number {
  const label = getDisplayRoleLabel(user, fallbackRole);
  return AUTHORITY_RANK[label] ?? 99;
}

export function compareUsersByAuthority(
  a: RoleResolvableUser & { name?: string },
  b: RoleResolvableUser & { name?: string }
): number {
  const rankA = getAuthorityRank(a);
  const rankB = getAuthorityRank(b);
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return (a.name || '').localeCompare(b.name || '');
}
