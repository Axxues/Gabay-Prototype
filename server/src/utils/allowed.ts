export const USER_ROLES = ['admin', 'faculty', 'staff', 'student'] as const;
export const REQUEST_TYPES = ['self_join', 'faculty_enroll', 'section_switch'] as const;
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const VISIBILITIES = ['published', 'unpublished', 'restricted'] as const;

export function isOneOf<T extends readonly string[]>(value: unknown, list: T): value is T[number] {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}
