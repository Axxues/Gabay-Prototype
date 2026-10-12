import { LIKHA_URL } from '../../env.js';
import { likhaFetch } from '../client.js';
import { ApiError } from '../../utils/errors.js';
import { signToken } from '../../middleware/auth.js';

export interface GabayPublicUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'faculty' | 'student' | 'staff';
  avatar: string;
  banner?: string | null;
  department: string;
  title: string;
  studentId?: string | null;
}

const LIKHA_ROLE_MAP: Record<string, 'admin' | 'faculty' | 'student' | 'staff'> = {
  'f927940e-7f3f-49d4-8c80-a6ccd2167e18': 'admin',
  '2e1047c9-1f10-4ae2-b131-6345c7814a6b': 'faculty',
  '98a212b2-9482-4ca5-8f67-825699575f3c': 'student',
  'c7d14be0-4259-46d7-b4b6-37db1221a0e9': 'staff',
};

const GABAY_ROLE_TO_LIKHA: Record<'admin' | 'faculty' | 'student' | 'staff', string> = {
  admin: 'f927940e-7f3f-49d4-8c80-a6ccd2167e18',
  faculty: '2e1047c9-1f10-4ae2-b131-6345c7814a6b',
  student: '98a212b2-9482-4ca5-8f67-825699575f3c',
  staff: 'c7d14be0-4259-46d7-b4b6-37db1221a0e9',
};

export function mapLikhaRole(roleIdOrName?: string | null, userRoleField?: string | null): 'admin' | 'faculty' | 'student' | 'staff' {
  if (roleIdOrName && LIKHA_ROLE_MAP[roleIdOrName]) {
    return LIKHA_ROLE_MAP[roleIdOrName];
  }
  if (userRoleField) {
    const norm = userRoleField.toLowerCase();
    if (norm === 'admin' || norm === 'faculty' || norm === 'student' || norm === 'staff') {
      return norm;
    }
  }
  return 'student';
}

export function formatLikhaUser(raw: any): GabayPublicUser {
  const role = mapLikhaRole(raw.role, raw.user_role);
  const fullName = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() || raw.email || 'User';

  const defaultAvatar = role === 'faculty'
    ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    : role === 'admin'
    ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80';

  return {
    id: raw.id,
    name: fullName,
    email: raw.email,
    role,
    avatar: raw.avatar || defaultAvatar,
    banner: raw.banner ?? null,
    department: raw.department || 'College of Computer Science',
    title: raw.title || (role === 'faculty' ? 'Faculty Instructor' : role === 'admin' ? 'Administrator' : 'Student'),
    studentId: raw.student_id ?? null,
  };
}

export async function authenticateUser(email: string, password: string): Promise<{ user: GabayPublicUser; token: string }> {
  const loginRes = await fetch(`${LIKHA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    throw new ApiError(401, 'invalid_credentials', 'Invalid email or password.');
  }

  const { data: { access_token } } = (await loginRes.json()) as any;

  // Retrieve user details with access_token
  const meRes = await fetch(`${LIKHA_URL}/users/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!meRes.ok) {
    throw new ApiError(401, 'invalid_credentials', 'Failed to retrieve authenticated user profile.');
  }

  const meData = (await meRes.json()) as any;
  const user = formatLikhaUser(meData.data);
  // Sign application session token with Gabay secret to preserve middleware compatibility
  const token = signToken(user.id, user.role);

  return { user, token };
}

export async function getUserById(id: string): Promise<GabayPublicUser | null> {
  try {
    const res = await likhaFetch(`/users/${encodeURIComponent(id)}`);
    if (!res.ok) return null;

    const json = (await res.json()) as any;
    if (!json.data) return null;
    return formatLikhaUser(json.data);
  } catch {
    return null;
  }
}

export async function getUserByEmail(email: string): Promise<GabayPublicUser | null> {
  try {
    const res = await likhaFetch(`/users?filter[email][_eq]=${encodeURIComponent(email)}&limit=1`);
    if (!res.ok) return null;

    const json = (await res.json()) as any;
    if (!json.data || json.data.length === 0) return null;
    return formatLikhaUser(json.data[0]);
  } catch {
    return null;
  }
}

export async function getAllUsers(): Promise<GabayPublicUser[]> {
  try {
    const res = await likhaFetch('/users?limit=250&sort=first_name');
    if (!res.ok) return [];

    const json = (await res.json()) as any;
    const list = (json.data || []) as any[];
    return list.map(formatLikhaUser);
  } catch {
    return [];
  }
}

export async function createLikhaUser(data: {
  email: string;
  name: string;
  role: 'admin' | 'faculty' | 'student' | 'staff';
  password?: string;
  department?: string;
  title?: string;
  studentId?: string;
  avatar?: string;
  banner?: string;
}): Promise<GabayPublicUser> {
  const [firstName, ...lastParts] = data.name.trim().split(' ');
  const lastName = lastParts.join(' ') || '';

  const body: any = {
    email: data.email,
    first_name: firstName,
    last_name: lastName,
    role: GABAY_ROLE_TO_LIKHA[data.role],
    user_role: data.role,
    department: data.department || 'College of Computer Science',
    title: data.title || '',
    student_id: data.studentId || null,
    status: 'active',
  };
  if (data.password) body.password = data.password;

  const res = await likhaFetch('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(400, 'create_user_failed', `Failed to create user in Likha: ${errText}`);
  }

  const json = (await res.json()) as any;
  return formatLikhaUser(json.data);
}

export async function updateLikhaUser(
  id: string,
  updates: Partial<GabayPublicUser> & { password?: string }
): Promise<GabayPublicUser> {
  const body: any = {};

  if (updates.name !== undefined) {
    const [firstName, ...lastParts] = updates.name.trim().split(' ');
    body.first_name = firstName;
    body.last_name = lastParts.join(' ');
  }
  if (updates.email !== undefined) body.email = updates.email;
  if (updates.department !== undefined) body.department = updates.department;
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.studentId !== undefined) body.student_id = updates.studentId;
  if (updates.banner !== undefined) body.banner = updates.banner;
  if (updates.role !== undefined) {
    body.role = GABAY_ROLE_TO_LIKHA[updates.role];
    body.user_role = updates.role;
  }
  if (updates.password) body.password = updates.password;

  const res = await likhaFetch(`/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(400, 'update_user_failed', `Failed to update user in Likha: ${errText}`);
  }

  const json = (await res.json()) as any;
  return formatLikhaUser(json.data);
}

export async function deleteLikhaUser(id: string): Promise<boolean> {
  try {
    const res = await likhaFetch(`/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}
