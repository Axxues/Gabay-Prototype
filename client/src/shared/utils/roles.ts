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

  if (role === 'admin' || role === 'superadmin' || subrole === 'chancellor' || title.includes('chancellor')) {
    if (subrole === 'dean' || title.includes('dean')) {
      return 'Dean';
    }
    if (subrole === 'chairperson' || subrole === 'chair' || title.includes('chair')) {
      return 'Chair';
    }
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
  return (role === 'admin' && (subrole === 'dean' || title.includes('dean')));
}

export function isChairRole(user?: RoleResolvableUser | null, activeRole?: string): boolean {
  const role = (user?.role || activeRole || '').toLowerCase();
  const subrole = (user?.adminSubrole || '').toLowerCase();
  const title = (user?.title || '').toLowerCase();
  return (role === 'admin' && (subrole === 'chairperson' || subrole === 'chair' || title.includes('chair')));
}
