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
    ((role === 'admin' || role === 'superadmin') && (subrole === 'chairperson' || subrole === 'chair' || title.includes('chair')))
  );
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
 * Course creation is strictly limited to Program Chairpersons via the Chair-Sheet upload workflow.
 * Faculty cannot manually create course shells; Dean and Admin act in a monitoring/audit capacity.
 */
export function canCreateCourse(user?: RoleResolvableUser | null, activeRole?: string): boolean {
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
