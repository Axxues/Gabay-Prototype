import { getToken, setToken, getRefreshToken, setRefreshToken, clearToken, ApiError, notifySessionExpired } from './client';
import type {
  SyllabusRevisionResponse,
  SyllabusRevisionHeader,
  SyllabusSectionKey,
} from '../types/syllabusApi';
import type { OfficialSyllabusData } from '../data/syllabusData';

export const LIKHA_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LIKHA_URL) ||
  (typeof window !== 'undefined' &&
  window.location?.hostname === 'localhost' &&
  !((globalThis as any).process?.env?.VITEST)
    ? '/likha'
    : 'https://gabay.zyberlab.com');

export interface LikhaUploadedFile {
  id: string;
  filename_download: string;
  url: string;
}

import { generateUuid } from '../utils/cryptoToken';
import { likhaCache } from './likhaCache';

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${LIKHA_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
      });
      if (!res.ok) {
        clearToken();
        notifySessionExpired();
        return null;
      }
      const json = await res.json();
      const newAccessToken = json.data?.access_token;
      const newRefreshToken = json.data?.refresh_token;
      if (newAccessToken) {
        setToken(newAccessToken);
      }
      if (newRefreshToken) {
        setRefreshToken(newRefreshToken);
      }
      return newAccessToken || null;
    } catch {
      clearToken();
      notifySessionExpired();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (typeof parsed.exp === 'number') {
      return Date.now() >= (parsed.exp - 30) * 1000;
    }
    return false;
  } catch {
    return false;
  }
}

// Hardcoded superadmin credentials and client-side elevation have been removed per AGENTS.md.
// All operations authenticate strictly with the active user's session JWT.
const getLikhaServiceToken = async (): Promise<string | null> => null;
const getLikhaUploadServiceToken = getLikhaServiceToken;

export const UUID_ITEM_COLLECTIONS = new Set([
  'modules',
  'module_items',
  'module_comments',
  'announcements',
  'announcement_replies',
  'discussions',
  'discussion_replies',
  'messages',
  'chat_groups',
  'calendar_events',
  'advising_slots',
  'course_files',
  'course_folders',
  'quizzes',
  'exams',
  'activities',
  'assessment_questions',
  'rubric_criteria',
  'activities_files',
  'submissions',
  'submission_answers',
  'submission_rubric_scores',
  'submission_comments',
  'course_sections',
  'sections',
  'enrollment_requests',
  'syllabus_signatories',
  'syllabus_references',
  'syllabus_policies',
  'syllabus_rubrics',
  'syllabus_learning_plans',
  'syllabus_course_maps',
  'spr_cells',
  'spr_configs',
  'course_grades',
]);

/**
 * Robust fetch wrapper that applies Directus JWT auth, transparent in-memory TTL
 * caching for GET requests, request deduplication, silent token refresh, and auto-invalidation on mutations.
 */
async function rawLikhaFetch<T = any>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  const url = path.startsWith('http') ? path : `${LIKHA_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if ((res.status === 502 || res.status === 503 || res.status === 504) && allowRetry) {
    // Transient backend gateway restart (e.g. nodemon restart on shared live system)
    await new Promise(r => setTimeout(r, 800));
    const retryRes = await fetch(url, { ...options, headers });
    if (retryRes.ok) {
      const retryJson = await retryRes.json().catch(() => ({}));
      return retryJson.data !== undefined ? retryJson.data : retryJson;
    }
  }

  if (res.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh') && allowRetry) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const retryHeaders = new Headers(options.headers || {});
        if (!retryHeaders.has('Content-Type') && !(options.body instanceof FormData)) {
          retryHeaders.set('Content-Type', 'application/json');
        }
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        const retriedRes = await fetch(url, { ...options, headers: retryHeaders });
        if (retriedRes.ok) {
          const retriedJson = await retriedRes.json().catch(() => ({}));
          return retriedJson.data !== undefined ? retriedJson.data : retriedJson;
        }
      }
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
      clearToken();
      notifySessionExpired();
    }
    const errorText = await res.text().catch(() => '');
    let parsedCode = 'request_failed';
    try {
      const parsed = JSON.parse(errorText);
      parsedCode = parsed.errors?.[0]?.extensions?.code || parsed.error?.code || parsedCode;
    } catch {}
    if (parsedCode === 'request_failed') {
      parsedCode = res.status === 401 ? 'unauthorized' : res.status === 403 ? 'forbidden' : res.status === 404 ? 'not_found' : res.status === 409 ? 'revision_conflict' : 'request_failed';
    }
    throw new ApiError(res.status, parsedCode.toLowerCase(), `Likha request failed (${res.status}): ${errorText}`);
  }

  const json = await res.json().catch(() => ({}));
  return json.data !== undefined ? json.data : json;
}

function getPathTtl(path: string): number {
  if (path.includes('/items/courses')) return 60000;
  if (path.includes('/items/syllabi')) return 120000;
  if (path.includes('/users')) return 300000;
  if (path.includes('/items/calendar_events')) return 60000;
  if (path.includes('/notifications')) return 15000;
  if (path.includes('/items/colleges') || path.includes('/items/departments') || path.includes('/items/school_years')) return 120000;
  return 30000;
}

async function likhaRequest<T = any>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  let effectiveOptions = options;
  const method = (effectiveOptions.method || 'GET').toUpperCase();

  // If creating an item in a UUID-keyed collection and no id is provided, generate a UUID
  if (method === 'POST') {
    const match = path.match(/\/items\/([a-zA-Z0-9_-]+)/);
    if (match && UUID_ITEM_COLLECTIONS.has(match[1])) {
      if (effectiveOptions.body && typeof effectiveOptions.body === 'string') {
        try {
          const parsed = JSON.parse(effectiveOptions.body);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.id === undefined) {
            parsed.id = generateUuid();
            effectiveOptions = {
              ...effectiveOptions,
              body: JSON.stringify(parsed),
            };
          }
        } catch {}
      }
    }
  }

  if (method === 'GET') {
    const token = getToken() || 'anon';
    const cacheKey = `${token}:${path}`;
    const ttl = getPathTtl(path);
    return likhaCache.getOrFetch<T>(cacheKey, () => rawLikhaFetch<T>(path, effectiveOptions, allowRetry), ttl);
  }

  // Mutation: execute and invalidate affected collection cache
  const result = await rawLikhaFetch<T>(path, effectiveOptions, allowRetry);
  const resourceBase = path.split('?')[0];
  likhaCache.invalidate(resourceBase);
  if (resourceBase.startsWith('/users')) {
    likhaCache.invalidate('/users');
  }
  return result;
}

/**
 * Directus helper: per AGENTS.md, elevation in frontend is prohibited.
 * All mutations execute with the active user session JWT without elevation.
 */
const likhaElevatedRequest = likhaRequest;


// In-module name→UUID map so one /roles lookup serves the session
// (likhaRequest GET caching also applies, but this avoids repeat lookups
// entirely, including cache misses keyed by token).
// NOTE: this map lives outside likhaCache, so only invalidateCache() below
// clears it — direct likhaCache.invalidate() calls (e.g. the post-mutation
// hook in likhaRequest) do not. Safe because role id↔name mappings are
// effectively static for a session.
const roleIdByName = new Map<string, string | null>();

function indexRole(roleObj: any): void {
  if (!roleObj || typeof roleObj !== 'object') return;
  const id = roleObj.id != null ? String(roleObj.id) : null;
  const name = roleObj.name != null ? String(roleObj.name).trim() : null;
  if (!id || !name) return;

  roleIdByName.set(name, id);
  roleIdByName.set(name.toLowerCase(), id);
  const lower = name.toLowerCase();
  if (lower.includes('student')) {
    roleIdByName.set('student', id);
    roleIdByName.set('Student', id);
    roleIdByName.set('students', id);
    roleIdByName.set('Students', id);
  } else if (lower.includes('faculty') || lower.includes('instructor')) {
    roleIdByName.set('faculty', id);
    roleIdByName.set('Faculty', id);
    roleIdByName.set('instructor', id);
    roleIdByName.set('Instructor', id);
  } else if (lower.includes('admin')) {
    roleIdByName.set('admin', id);
    roleIdByName.set('Admin', id);
    roleIdByName.set('Administrator', id);
    roleIdByName.set('administrator', id);
  } else if (lower.includes('staff')) {
    roleIdByName.set('staff', id);
    roleIdByName.set('Staff', id);
  }
}

export const mapLikhaSyllabusHeader = (row: any, fallbackCourseId = ''): SyllabusRevisionHeader => ({
  id: String(row.id),
  courseId: String(row.course_id || fallbackCourseId),
  revisionNo: Number(row.version ?? 1),
  status: (row.status as SyllabusRevisionHeader['status']) || 'draft',
  schemaVersion: '1',
  rowVersion: Number(row.version ?? 1),
  createdAt: row.created_at || new Date().toISOString(),
  updatedAt: row.published_at || row.created_at || new Date().toISOString(),
  publishedAt: row.published_at || null,
});

export const mapLikhaSyllabusRow = (row: any, fallbackCourseId = ''): SyllabusRevisionResponse => {
  let parsedContent: any = {};
  if (row.content) {
    try {
      parsedContent = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
    } catch {
      parsedContent = {};
    }
  }
  return {
    revision: mapLikhaSyllabusHeader(row, fallbackCourseId),
    syllabus: {
      ...parsedContent,
      courseId: String(row.course_id || fallbackCourseId),
    },
  };
};

export const createBlankSyllabus = (courseId: string): OfficialSyllabusData => ({
  courseId,
  institution: { university: 'Don Mariano Marcos Memorial State University', college: '', formCode: '', revision: '' },
  courseInfo: {
    code: '', title: '', semester: '', academicYear: '', type: 'Lec',
    credit: '3', lectureHours: '3', labHours: '0', prerequisite: '', description: '',
  },
  facultyMembers: [],
  institutionalStatements: {
    philosophy: '', vision: '', mission: '', goal: '', coreValues: [], graduateAttributes: [],
  },
  programOutcomes: [],
  courseOutcomes: [],
  courseRequirements: { major: [], other: [] },
  gradingSystem: { termFormula: '', finalFormula: '', classStandingComponents: [], passingGrade: '3.0' },
  projectRubrics: [],
  classroomPolicies: [],
  courseOutline: [],
  learningPlan: [],
  courseMap: [],
  references: [],
  signatories: {
    preparedBy: [],
    recommendingApproval: { name: '', title: '' },
    approved: { name: '', title: '' },
  },
});

export const likhaLmsApi = {
  cache: likhaCache,
  invalidateCache(pattern?: string): void {
    if (!pattern || pattern.includes('role')) {
      roleIdByName.clear();
    }
    if (pattern) {
      likhaCache.invalidate(pattern);
    } else {
      likhaCache.clear();
    }
  },
  getServiceToken: getLikhaServiceToken,
  elevatedRequest: likhaElevatedRequest,

  // =========================================================================
  // 1. AUTHENTICATION & DIRECTORY
  // =========================================================================
  auth: {
    async login(email: string, password: string): Promise<{ token: string; user: any }> {
      const res = await fetch(`${LIKHA_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, mode: 'json' }),
      });
      if (!res.ok) {
        throw new Error(`Likha authentication failed: ${res.status}`);
      }
      const json = await res.json();
      const token = json.data?.access_token;
      const refreshToken = json.data?.refresh_token;
      if (token) setToken(token);
      if (refreshToken) setRefreshToken(refreshToken);

      const me = await likhaRequest('/users/me?fields=*,role.*');
      if (me?.role) indexRole(me.role);
      return { token, user: me };
    },

    async refresh(): Promise<string | null> {
      return refreshAccessToken();
    },

    async getMe(): Promise<any> {
      const me = await likhaRequest('/users/me?fields=*,role.*');
      if (me?.role) indexRole(me.role);
      return me;
    },

    logout(): void {
      clearToken();
      likhaCache.clear();
    },
  },

  users: {
    async getUsers(): Promise<any[]> {
      const users = await likhaRequest<any[]>('/users?fields=*,role.*&limit=250&sort=first_name');
      if (Array.isArray(users)) {
        for (const u of users) {
          if (u?.role) indexRole(u.role);
        }
      }
      return users || [];
    },

    async createUser(payload: any): Promise<any> {
      return likhaRequest('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateUser(id: string, updates: any): Promise<any> {
      try {
        return await likhaRequest(`/users/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (
          err?.status === 403 ||
          err?.status === 400 ||
          err?.status === 404 ||
          msg.includes('403') ||
          msg.includes('400') ||
          msg.includes('404')
        ) {
          return await likhaRequest('/users/me', {
            method: 'PATCH',
            body: JSON.stringify(updates),
          });
        }
        throw err;
      }
    },

    async deleteUser(id: string): Promise<void> {
      await likhaRequest(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async resolveRoleId(name: string): Promise<string | null> {
      const key = String(name).trim();
      if (roleIdByName.has(key)) return roleIdByName.get(key) ?? null;
      const lowerKey = key.toLowerCase();
      for (const [k, v] of roleIdByName.entries()) {
        if (k.toLowerCase() === lowerKey && v) {
          roleIdByName.set(key, v);
          return v;
        }
      }

      // Best-effort lookup: query /roles?filter[name][_eq]=${key}
      let rows: any[] = [];
      let fetchFailed = false;
      try {
        rows = await rawLikhaFetch<any[]>(
          `/roles?filter[name][_eq]=${encodeURIComponent(key)}&fields=id,name`
        );
      } catch {
        fetchFailed = true;
      }

      let list = Array.isArray(rows) ? rows : rows ? [rows] : [];
      let found = list[0];

      // Known aliases for standard LMS roles
      const aliases: string[] = [];
      if (lowerKey === 'student') aliases.push('Student', 'Students');
      else if (lowerKey === 'faculty') aliases.push('Instructor', 'Faculty');
      else if (lowerKey === 'admin') aliases.push('Administrator', 'Admin');
      else if (lowerKey === 'staff') aliases.push('Staff');

      // If not found and key has known aliases (e.g. 'student' -> 'Student'), try them
      if (!found?.id && !fetchFailed && aliases.length > 0) {
        for (const alias of aliases) {
          if (roleIdByName.has(alias) && roleIdByName.get(alias)) {
            const id = roleIdByName.get(alias)!;
            roleIdByName.set(key, id);
            return id;
          }
          try {
            const aliasRows = await rawLikhaFetch<any[]>(
              `/roles?filter[name][_eq]=${encodeURIComponent(alias)}&fields=id,name`
            );
            const aList = Array.isArray(aliasRows) ? aliasRows : aliasRows ? [aliasRows] : [];
            if (aList[0]?.id) {
              found = aList[0];
              indexRole(found);
              break;
            }
          } catch {
            fetchFailed = true;
          }
        }
      }

      // Fallback: If role not found (or /roles was 403/unreachable) for a standard LMS role, discover from existing users
      if (!found?.id && aliases.length > 0) {
        try {
          const userRows = await rawLikhaFetch<any[]>(
            `/users?fields=role.id,role.name&limit=100`
          );
          if (Array.isArray(userRows)) {
            for (const u of userRows) {
              if (u?.role) indexRole(u.role);
            }
          }
          const harvestedId =
            (roleIdByName.has(key) ? roleIdByName.get(key) : null) ||
            (() => {
              for (const [k, v] of roleIdByName.entries()) {
                if (k.toLowerCase() === lowerKey && v) return v;
              }
              return null;
            })();
          if (harvestedId) {
            roleIdByName.set(key, harvestedId);
            return harvestedId;
          }
        } catch {}
      }

      if (fetchFailed && !found?.id) {
        // Failures are NOT cached so transient errors can retry
        return null;
      }

      const id = found?.id != null ? String(found.id) : null;
      if (found) indexRole(found);
      roleIdByName.set(key, id);
      return id;
    },
  },

  // =========================================================================
  // 2. COURSES, SECTIONS & ENROLLMENT REQUESTS
  // =========================================================================
  courses: {
    async getCourses(studentId?: string): Promise<any[]> {
      const query = 'fields=*,cover_image.*,instructor.*,sections.*';
      const all = await likhaRequest<any[]>(`/items/courses?${query}`);
      if (!studentId) return all || [];

      // Filter by approved enrollment requests
      const requests = await likhaRequest<any[]>(
        `/items/enrollment_requests?filter[student_id][_eq]=${encodeURIComponent(studentId)}&filter[status][_eq]=approved&limit=100`
      );
      const approvedCourseIds = new Set((requests || []).map((r: any) => r.course_id));
      if (approvedCourseIds.size === 0) {
        return (all || []).filter((c: any) => c.published);
      }
      return (all || []).filter((c: any) => approvedCourseIds.has(c.id));
    },

    async getCourse(id: string): Promise<any> {
      return likhaRequest(`/items/courses/${encodeURIComponent(id)}?fields=*,cover_image.*,instructor.*,sections.*`);
    },

    async getCourseEnrollments(courseId?: string): Promise<any[]> {
      const query = courseId
        ? `filter[course][_eq]=${encodeURIComponent(courseId)}&fields=*,user.*,course.*`
        : 'fields=*,user.*,course.*';
      return likhaRequest<any[]>(`/items/Course_Enrollments?${query}`).catch(() => []);
    },

    async createCourse(course: any): Promise<any> {
      const payload = {
        id: course.id || generateUuid(),
        ...course,
      };
      return likhaRequest('/items/courses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateCourse(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/courses/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteCourse(id: string): Promise<void> {
      await likhaRequest(`/items/courses/${encodeURIComponent(id)}`, { method: 'DELETE' });
      likhaCache.invalidate('/items/courses');
    },

    // Backward-compatible alias: relational cascade is enforced server-side via Directus FK ON DELETE CASCADE
    async deleteCourseCascade(id: string): Promise<void> {
      return likhaLmsApi.courses.deleteCourse(id);
    },
  },

  sections: {
    async getSections(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/course_sections?filter[course_id][_eq]=${encodeURIComponent(courseId)}`).catch(() => []);
    },

    async createSection(section: any): Promise<any> {
      const payload = { id: section.id || generateUuid(), ...section };
      return likhaRequest('/items/course_sections', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateSection(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/course_sections/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteSection(id: string): Promise<void> {
      await likhaRequest(`/items/course_sections/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  requests: {
    async getRequests(courseId?: string, status?: string): Promise<any[]> {
      let q = `/items/enrollment_requests?limit=200`;
      if (courseId) q += `&filter[course_id][_eq]=${encodeURIComponent(courseId)}`;
      if (status) q += `&filter[status][_eq]=${encodeURIComponent(status)}`;
      return likhaRequest(q).catch(() => []);
    },

    async createRequest(request: any): Promise<any> {
      return likhaRequest('/items/enrollment_requests', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    async updateRequest(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/enrollment_requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteRequest(id: string): Promise<void> {
      await likhaRequest(`/items/enrollment_requests/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  // =========================================================================
  // 3. MODULES & MODULE ITEMS
  // =========================================================================
  modules: {
    async getModulesWithItems(courseId: string): Promise<any[]> {
      const modules = await likhaRequest<any[]>(
        `/items/modules?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*&sort=order`
      );
      if (!Array.isArray(modules) || modules.length === 0) return [];
      const moduleIds = modules.map((m: any) => m.id).filter(Boolean);
      if (moduleIds.length === 0) return modules.map((m: any) => ({ ...m, items: [] }));
      const items = await likhaRequest<any[]>(
        `/items/module_items?filter[module_id][_in]=${moduleIds.join(',')}&sort=order`
      ).catch(() => []);
      const itemMap = new Map<string, any[]>();
      for (const item of (items || [])) {
        const list = itemMap.get(item.module_id) || [];
        list.push(item);
        itemMap.set(item.module_id, list);
      }
      return modules.map((m: any) => ({ ...m, items: itemMap.get(m.id) || [] }));
    },

    async createModule(module: any): Promise<any> {
      const payload = { id: module.id || generateUuid(), ...module };
      return likhaRequest('/items/modules', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateModule(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/modules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteModule(id: string): Promise<void> {
      await likhaRequest(`/items/modules/${encodeURIComponent(id)}`, { method: 'DELETE' });
      likhaCache.invalidate('/items/modules');
      likhaCache.invalidate('/items/module_items');
      likhaCache.invalidate('/items/module_comments');
    },

    async createModuleItem(item: any): Promise<any> {
      const payload = { id: item.id || generateUuid(), ...item };
      return likhaRequest('/items/module_items', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateModuleItem(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/module_items/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteModuleItem(id: string): Promise<void> {
      await likhaRequest(`/items/module_items/${encodeURIComponent(id)}`, { method: 'DELETE' });
      likhaCache.invalidate('/items/module_items');
    },

    async getComments(moduleId: string): Promise<any[]> {
      return likhaRequest(`/items/module_comments?filter[module_id][_eq]=${encodeURIComponent(moduleId)}&sort=created_at`);
    },

    async addComment(comment: any): Promise<any> {
      const payload = { id: comment.id || generateUuid(), ...comment };
      return likhaRequest('/items/module_comments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateComment(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/module_comments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteComment(id: string): Promise<void> {
      await likhaRequest(`/items/module_comments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  // =========================================================================
  // 4. ASSESSMENTS (ACTIVITIES, QUIZZES, EXAMS) & 3NF CHILD RELATIONS
  // =========================================================================
  assessments: {
    async getActivities(courseId: string): Promise<any[]> {
      const query = `filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,attachments.directus_files_id.*,questions.*`;
      return likhaRequest(`/items/activities?${query}`);
    },

    async saveActivity(activity: any): Promise<any> {
      return likhaLmsApi.saveActivity(activity);
    },

    async deleteActivity(id: string): Promise<void> {
      await likhaRequest(`/items/activities/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getQuizzes(courseId: string): Promise<any[]> {
      const query = `filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,questions.*`;
      return likhaRequest(`/items/quizzes?${query}`);
    },

    async saveQuiz(quiz: any): Promise<any> {
      const { questions, ...rootPayload } = quiz;
      const isUpdate = Boolean(rootPayload.id);
      const quizId = rootPayload.id || generateUuid();
      const url = isUpdate ? `/items/quizzes/${encodeURIComponent(quizId)}` : '/items/quizzes';
      const saved = await likhaRequest(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...rootPayload, id: quizId }),
      });

      if (Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await likhaRequest('/items/assessment_questions', {
            method: 'POST',
            body: JSON.stringify({
              id: q.id || `q-quiz-${quizId}-${i}`,
              quiz_id: quizId,
              question_text: q.question_text || q.text || q.prompt || '',
              question_type: q.question_type || q.type || 'multiple_choice',
              points: Number(q.points) || 1,
              correct_answer: q.correct_answer || q.correctAnswer || null,
              options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
              order: i + 1,
            }),
          }).catch(() => {});
        }
      }
      return { ...saved, questions: questions || [] };
    },

    async deleteQuiz(id: string): Promise<void> {
      await likhaRequest(`/items/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getExams(courseId: string): Promise<any[]> {
      const query = `filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,questions.*`;
      return likhaRequest(`/items/exams?${query}`);
    },

    async saveExam(exam: any): Promise<any> {
      const { questions, ...rootPayload } = exam;
      const isUpdate = Boolean(rootPayload.id);
      const examId = rootPayload.id || generateUuid();
      const url = isUpdate ? `/items/exams/${encodeURIComponent(examId)}` : '/items/exams';
      const saved = await likhaRequest(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...rootPayload, id: examId }),
      });

      if (Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await likhaRequest('/items/assessment_questions', {
            method: 'POST',
            body: JSON.stringify({
              id: q.id || `q-exam-${examId}-${i}`,
              exam_id: examId,
              question_text: q.question_text || q.text || q.prompt || '',
              question_type: q.question_type || q.type || 'multiple_choice',
              points: Number(q.points) || 1,
              correct_answer: q.correct_answer || q.correctAnswer || null,
              options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
              order: i + 1,
            }),
          }).catch(() => {});
        }
      }
      return { ...saved, questions: questions || [] };
    },

    async deleteExam(id: string): Promise<void> {
      await likhaRequest(`/items/exams/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  // =========================================================================
  // 5. SUBMISSIONS & SPEEDGRADER
  // =========================================================================
  submissions: {
    async getSubmissions(assessmentId: string, type: 'activity' | 'quiz' | 'exam' = 'activity'): Promise<any[]> {
      const field = type === 'quiz' ? 'quiz_id' : type === 'exam' ? 'exam_id' : 'activity_id';
      const q = `/items/submissions?filter[${field}][_eq]=${encodeURIComponent(assessmentId)}&fields=*,answers.*`;
      return likhaRequest(q);
    },

    async submitAssessment(submission: any): Promise<any> {
      return likhaLmsApi.submitActivity(submission);
    },

    async gradeSubmission(id: string, score: number, feedback?: string): Promise<any> {
      return likhaLmsApi.gradeSubmission(id, score, feedback);
    },

    async addRubricScore(submissionId: string, criterionId: string, points: number, feedback?: string): Promise<any> {
      return likhaRequest('/items/submission_rubric_scores', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: submissionId,
          criterion_id: criterionId,
          points_awarded: points,
          feedback: feedback || '',
        }),
      });
    },

    async addSubmissionComment(submissionId: string, authorId: string, content: string): Promise<any> {
      return likhaRequest('/items/submission_comments', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: submissionId,
          author_id: authorId,
          content,
          created_at: new Date().toISOString(),
        }),
      });
    },
  },

  // =========================================================================
  // 6. GRADES & SPR
  // =========================================================================
  grades: {
    async getCourseGrades(courseId: string): Promise<any[]> {
      return likhaLmsApi.getCourseGrades(courseId);
    },

    async saveGradeWithCells(courseId: string, studentId: string, cells: Array<{ task_id: string; score: number }>): Promise<any> {
      // Find or create course_grades entry
      const existing = await likhaRequest<any[]>(
        `/items/course_grades?filter[course_id][_eq]=${encodeURIComponent(courseId)}&filter[student_id][_eq]=${encodeURIComponent(studentId)}&limit=1`
      );
      let gradeRecord = existing && existing[0];
      if (!gradeRecord) {
        gradeRecord = await likhaRequest('/items/course_grades', {
          method: 'POST',
          body: JSON.stringify({
            id: `cg-${courseId}-${studentId}`,
            course_id: courseId,
            student_id: studentId,
          }),
        });
      }

      // Upsert spr_cells child rows
      for (const cell of cells) {
        await likhaRequest('/items/spr_cells', {
          method: 'POST',
          body: JSON.stringify({
            id: `spr-${gradeRecord.id}-${cell.task_id}`,
            course_grade_id: gradeRecord.id,
            student_id: studentId,
            task_id: cell.task_id,
            score: cell.score,
          }),
        }).catch(() => {});
      }
      return gradeRecord;
    },

    async getSPRConfig(courseId: string): Promise<any> {
      const res = await likhaRequest<any[]>(`/items/spr_configs?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=1`);
      return res && res[0] ? res[0] : null;
    },

    async saveSPRConfig(courseId: string, config: any): Promise<any> {
      const existing = await likhaLmsApi.grades.getSPRConfig(courseId);
      if (existing) {
        return likhaRequest(`/items/spr_configs/${encodeURIComponent(existing.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(config),
        });
      }
      return likhaRequest('/items/spr_configs', {
        method: 'POST',
        body: JSON.stringify({ course_id: courseId, ...config }),
      });
    },
  },

  // =========================================================================
  // 7. COMMUNICATIONS (ANNOUNCEMENTS, DISCUSSIONS, MESSAGES, NOTIFICATIONS)
  // =========================================================================
  communications: {
    async getAnnouncements(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/announcements?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-created_at`);
    },

    async createAnnouncement(data: any): Promise<any> {
      const payload = { id: data.id || generateUuid(), ...data };
      return likhaRequest('/items/announcements', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateAnnouncement(id: string, patch: any): Promise<any> {
      return likhaRequest(`/items/announcements/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },

    async deleteAnnouncement(id: string): Promise<void> {
      await likhaRequest(`/items/announcements/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },

    async addAnnouncementReply(announcementId: string, reply: any): Promise<any> {
      const payload = { id: reply.id || generateUuid(), announcement_id: announcementId, ...reply };
      return likhaRequest('/items/announcement_replies', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async getDiscussions(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/discussions?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-created_at`);
    },

    async createDiscussion(data: any): Promise<any> {
      const payload = { id: data.id || generateUuid(), ...data };
      return likhaRequest('/items/discussions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateDiscussion(id: string, patch: any): Promise<any> {
      return likhaRequest(`/items/discussions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },

    async deleteDiscussion(id: string): Promise<void> {
      await likhaRequest(`/items/discussions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },

    async addDiscussionReply(discussionId: string, reply: any): Promise<any> {
      const payload = { id: reply.id || generateUuid(), discussion_id: discussionId, ...reply };
      return likhaRequest('/items/discussion_replies', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateDiscussionReply(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/discussion_replies/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async getNotifications(_userId?: string): Promise<any[]> {
      return likhaRequest('/notifications?limit=50').catch(() => []);
    },

    async markNotificationRead(id: string): Promise<void> {
      try {
        await likhaRequest(`/notifications/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'read' }),
        });
      } catch {
        /* ignore */
      }
    },

    async markAllNotificationsRead(ids: string[]): Promise<void> {
      await Promise.allSettled(ids.map(id => likhaLmsApi.communications.markNotificationRead(id)));
    },

    async markThreadRead(messageIds: string[]): Promise<void> {
      await Promise.allSettled(
        messageIds.map(id =>
          likhaRequest(`/items/messages/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_read: true }),
          })
        )
      );
    },

    async getMessages(): Promise<any[]> {
      return likhaRequest('/items/messages?sort=created_at&limit=200');
    },

    async sendMessage(data: any): Promise<any> {
      const payload = { id: data.id || generateUuid(), ...data };
      return likhaRequest('/items/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateMessageReaction(id: string, reaction: string | null): Promise<any> {
      return likhaRequest(`/items/messages/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ reaction }),
      });
    },

    async getChatGroups(): Promise<any[]> {
      return likhaRequest('/items/chat_groups?limit=50').catch(() => []);
    },

    async createChatGroup(data: any): Promise<any> {
      const payload = { id: data.id || generateUuid(), ...data };
      return likhaRequest('/items/chat_groups', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async getCalendarEvents(): Promise<any[]> {
      return likhaRequest('/items/calendar_events?limit=200&sort=date');
    },

    async createCalendarEvent(data: any): Promise<any> {
      const payload = { id: data.id || generateUuid(), ...data };
      return likhaRequest('/items/calendar_events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateCalendarEvent(id: string, patch: any): Promise<any> {
      return likhaRequest(`/items/calendar_events/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },

    async deleteCalendarEvent(id: string): Promise<void> {
      await likhaRequest(`/items/calendar_events/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },

    async getAdvisingSlots(): Promise<any[]> {
      return likhaRequest('/items/advising_slots?limit=100&sort=date').catch(() => []);
    },

    async bookAdvisingSlot(id: string, studentId: string): Promise<any> {
      return likhaRequest(`/items/advising_slots/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ student_id: studentId, status: 'booked' }),
      });
    },

    async createAdvisingSlot(data: any): Promise<any> {
      const payload = { id: data.id || generateUuid(), ...data };
      return likhaRequest('/items/advising_slots', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  // =========================================================================
  // 8. FILE STORAGE
  // =========================================================================
  files: {
    async uploadFile(file: File): Promise<LikhaUploadedFile> {
      return likhaLmsApi.uploadFile(file);
    },

    async getCourseFiles(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/course_files?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,file.*`);
    },

    async createCourseFile(data: any): Promise<any> {
      const payload = { id: data.id || generateUuid(), ...data };
      return likhaRequest('/items/course_files', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateCourseFile(id: string, patch: any): Promise<any> {
      return likhaRequest(`/items/course_files/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },

    async deleteFile(fileId: string): Promise<void> {
      await likhaRequest(`/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
      });
    },

    async deleteCourseFile(id: string): Promise<void> {
      const item = await likhaRequest<any>(`/items/course_files/${encodeURIComponent(id)}?fields=*,file.*`).catch(() => null);
      const fileAssetId = item?.file?.id || (typeof item?.file === 'string' ? item.file : null);
      await likhaRequest(`/items/course_files/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (fileAssetId) {
        await likhaRequest(`/files/${encodeURIComponent(fileAssetId)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }
    },

    async getCourseFolders(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/course_folders?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=name`);
    },

    async createCourseFolder(data: any): Promise<any> {
      const payload = { id: data.id || generateUuid(), ...data };
      return likhaRequest('/items/course_folders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateCourseFolder(id: string, patch: any): Promise<any> {
      return likhaRequest(`/items/course_folders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },

    async deleteCourseFolder(id: string): Promise<void> {
      await likhaRequest(`/items/course_folders/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  },

  // =========================================================================
  // 9. SYLLABUS REVISION PROTOCOL & MANAGEMENT
  // =========================================================================
  syllabus: {
    async getSyllabus(courseId: string): Promise<any> {
      const items = await likhaRequest<any[]>(
        `/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,course_info.*,course_outcomes.*,learning_plans.*,policies.*,institution.*&limit=1`
      );
      return items?.[0] || null;
    },

    async createSyllabus(data: any): Promise<any> {
      return likhaRequest('/items/syllabi', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateSyllabus(syllabusId: string, data: any): Promise<any> {
      return likhaRequest(`/items/syllabi/${encodeURIComponent(syllabusId)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async getPublished(courseId: string): Promise<SyllabusRevisionResponse | null> {
      const items = await likhaRequest<any[]>(
        `/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}&filter[status][_eq]=published&sort=-version&limit=1`
      );
      if (!items || items.length === 0) return null;
      return mapLikhaSyllabusRow(items[0], courseId);
    },

    async listRevisions(courseId: string): Promise<SyllabusRevisionHeader[]> {
      const items = await likhaRequest<any[]>(
        `/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-version`
      );
      return (items || []).map(row => mapLikhaSyllabusHeader(row, courseId));
    },

    async createDraft(courseId: string, sourceRevisionId?: string): Promise<SyllabusRevisionResponse> {
      let initialSyllabus: OfficialSyllabusData | null = null;
      if (sourceRevisionId) {
        try {
          const source = await likhaRequest<any>(`/items/syllabi/${encodeURIComponent(sourceRevisionId)}`);
          if (source?.content) {
            initialSyllabus = typeof source.content === 'string' ? JSON.parse(source.content) : source.content;
          }
        } catch {}
      }
      if (!initialSyllabus) {
        const pub = await likhaLmsApi.syllabus.getPublished(courseId);
        if (pub) initialSyllabus = pub.syllabus;
      }
      if (!initialSyllabus) {
        initialSyllabus = createBlankSyllabus(courseId);
      }

      // Determine next version
      const existing = await likhaRequest<any[]>(
        `/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-version&limit=1`
      );
      const nextVersion = (existing?.[0]?.version ?? 0) + 1;
      const draftId = `syl-${courseId}-${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      const newRow = await likhaRequest('/items/syllabi', {
        method: 'POST',
        body: JSON.stringify({
          id: draftId,
          course_id: courseId,
          version: nextVersion,
          status: 'draft',
          content: JSON.stringify(initialSyllabus),
          created_at: now,
          published_at: null,
        }),
      });

      return mapLikhaSyllabusRow(newRow, courseId);
    },

    async updateSection(
      courseId: string,
      revisionId: string,
      rowVersion: number,
      section: SyllabusSectionKey,
      value: unknown
    ): Promise<SyllabusRevisionResponse> {
      const current = await likhaRequest<any>(`/items/syllabi/${encodeURIComponent(revisionId)}`);
      if (!current) {
        throw new ApiError(404, 'syllabus_not_found', 'Syllabus revision not found.');
      }
      if (current.version !== undefined && current.version !== rowVersion) {
        throw new ApiError(409, 'revision_conflict', 'Revision conflict: rowVersion mismatch.');
      }

      let parsedContent: any = {};
      if (current.content) {
        parsedContent = typeof current.content === 'string' ? JSON.parse(current.content) : current.content;
      }
      parsedContent[section] = value;

      const updated = await likhaRequest(`/items/syllabi/${encodeURIComponent(revisionId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          content: JSON.stringify(parsedContent),
        }),
      });

      return mapLikhaSyllabusRow(updated, courseId);
    },

    async publish(
      courseId: string,
      revisionId: string,
      rowVersion: number
    ): Promise<SyllabusRevisionResponse> {
      const current = await likhaRequest<any>(`/items/syllabi/${encodeURIComponent(revisionId)}`);
      if (!current) {
        throw new ApiError(404, 'syllabus_not_found', 'Syllabus revision not found.');
      }
      if (current.version !== undefined && current.version !== rowVersion) {
        throw new ApiError(409, 'revision_conflict', 'Revision conflict: rowVersion mismatch.');
      }

      // Archive other published syllabi for this course
      try {
        const others = await likhaRequest<any[]>(
          `/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}&filter[status][_eq]=published`
        );
        for (const o of others || []) {
          if (o.id !== revisionId) {
            await likhaRequest(`/items/syllabi/${encodeURIComponent(o.id)}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'archived' }),
            }).catch(() => undefined);
          }
        }
      } catch {}

      const published = await likhaRequest(`/items/syllabi/${encodeURIComponent(revisionId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'published',
          published_at: new Date().toISOString(),
        }),
      });

      return mapLikhaSyllabusRow(published, courseId);
    },

    async deleteDraft(_courseId: string, revisionId: string): Promise<void> {
      await likhaRequest(`/items/syllabi/${encodeURIComponent(revisionId)}`, {
        method: 'DELETE',
      });
    },

    async withdrawSyllabus(courseId: string): Promise<void> {
      const allForCourse = await likhaRequest<any[]>(
        `/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}`
      ).catch(() => []);
      if (allForCourse && allForCourse.length > 0) {
        for (const p of allForCourse) {
          await likhaRequest(`/items/syllabi/${encodeURIComponent(p.id)}`, {
            method: 'DELETE',
          }).catch(() => undefined);
        }
      } else {
        await likhaRequest(`/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(courseId)}`, {
          method: 'DELETE',
        }).catch(() => undefined);
      }
    },
  },

  // =========================================================================
  // BACKWARD COMPATIBILITY TOP-LEVEL METHODS
  // =========================================================================
  async getCoursesWithRelations(): Promise<any[]> {
    const fields = 'fields=*,cover_image.*,instructor.*,sections.*';
    return likhaRequest(`/items/courses?${fields}`);
  },

  async getActivitiesWithRelations(courseId: string): Promise<any[]> {
    const query = `filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,attachments.directus_files_id.*,questions.*`;
    return likhaRequest(`/items/activities?${query}`);
  },

  async uploadFile(file: File): Promise<LikhaUploadedFile> {
    let token = getToken();
    const refreshToken = getRefreshToken();
    if (refreshToken && isTokenExpired(token)) {
      token = await refreshAccessToken();
    }

    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let res = await fetch(`${LIKHA_URL}/files`, { method: 'POST', headers, body: formData });

    if (res.status === 502 || res.status === 503 || res.status === 504) {
      await new Promise(r => setTimeout(r, 800));
      const retryFormData = new FormData();
      retryFormData.append('file', file);
      res = await fetch(`${LIKHA_URL}/files`, { method: 'POST', headers, body: retryFormData });
    }

    if (res.status === 403 || res.status === 401) {
      if (res.status === 401 && refreshToken) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const retryFormData = new FormData();
          retryFormData.append('file', file);
          res = await fetch(`${LIKHA_URL}/files`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${refreshed}` },
            body: retryFormData,
          });
        }
      }

    }

    if (!res.ok) throw new Error(`File upload to Likha failed: ${res.status}`);
    const json = await res.json();
    const fileData = json.data;
    return {
      id: fileData.id,
      filename_download: fileData.filename_download || file.name,
      url: `https://gabay.zyberlab.com/assets/${fileData.id}`,
    };
  },

  async loginLikhaUser(email: string, password: string): Promise<{ token: string; user: any }> {
    return likhaLmsApi.auth.login(email, password);
  },

  async getNotifications(userId: string): Promise<any[]> {
    return likhaLmsApi.communications.getNotifications(userId);
  },

  async saveActivity(activity: any): Promise<any> {
    const { questions, rubric, ...rootPayload } = activity;
    const isUpdate = Boolean(rootPayload.id);
    const actId = rootPayload.id || generateUuid();
    const url = isUpdate
      ? `/items/activities/${encodeURIComponent(actId)}`
      : `/items/activities`;
    const saved = await likhaRequest(url, {
      method: isUpdate ? 'PATCH' : 'POST',
      body: JSON.stringify({ ...rootPayload, id: actId }),
    });

    if (Array.isArray(questions) && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await likhaRequest('/items/assessment_questions', {
          method: 'POST',
          body: JSON.stringify({
            id: q.id || `q-${actId}-${i}`,
            activity_id: actId,
            question_text: q.question_text || q.text || q.prompt || '',
            question_type: q.question_type || q.type || 'essay',
            points: Number(q.points) || 10,
            correct_answer: q.correct_answer || q.correctAnswer || null,
            options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
            order: i + 1,
          }),
        }).catch(() => {});
      }
    }

    if (Array.isArray(rubric) && rubric.length > 0) {
      for (let i = 0; i < rubric.length; i++) {
        const r = rubric[i];
        await likhaRequest('/items/rubric_criteria', {
          method: 'POST',
          body: JSON.stringify({
            id: r.id || `rub-${actId}-${i}`,
            activity_id: actId,
            title: r.title || r.criterion || '',
            description: r.description || '',
            max_points: Number(r.max_points ?? r.points) || 10,
            order: i + 1,
          }),
        }).catch(() => {});
      }
    }

    return { ...saved, questions: questions || [], rubric: rubric || [] };
  },

  async submitActivity(submission: any): Promise<any> {
    const { answers, ...rootPayload } = submission;
    const subId = rootPayload.id || `sub-${Date.now().toString(36)}`;
    const saved = await likhaRequest('/items/submissions', {
      method: 'POST',
      body: JSON.stringify({ id: subId, ...rootPayload }),
    });

    const answersList = Array.isArray(answers)
      ? answers
      : typeof answers === 'object' && answers !== null
        ? Object.entries(answers).map(([qid, val]) => ({ questionId: qid, answer: String(val) }))
        : [];

    for (let i = 0; i < answersList.length; i++) {
      const a = answersList[i];
      await likhaRequest('/items/submission_answers', {
        method: 'POST',
        body: JSON.stringify({
          id: `sa-${subId}-${i}`,
          submission_id: subId,
          question_id: a.questionId || a.question_id || `q-${i}`,
          student_answer: a.answer || a.studentAnswer || String(a),
          awarded_points: a.points ?? null,
          feedback: a.feedback || null,
        }),
      }).catch(() => {});
    }

    return { ...saved, answers: answersList };
  },

  async gradeSubmission(submissionId: string, score: number, feedback?: string): Promise<any> {
    return likhaRequest(`/items/submissions/${encodeURIComponent(submissionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        score,
        feedback,
        status: 'graded',
        graded_at: new Date().toISOString(),
      }),
    });
  },

  async getCourseGrades(courseId: string): Promise<any[]> {
    try {
      return await likhaRequest(
        `/items/course_grades?filter[course_id][_eq]=${encodeURIComponent(courseId)}&fields=*,spr_cells.*`
      );
    } catch {
      // Graceful fallback to unexpanded query if relation expansion encounters transient issues
      return await likhaRequest(
        `/items/course_grades?filter[course_id][_eq]=${encodeURIComponent(courseId)}`
      ).catch(() => []);
    }
  },

  // =========================================================================
  // 10. ACADEMIC STRUCTURE (COLLEGES & DEPARTMENTS)
  // =========================================================================
  academicStructure: {
    async getColleges(): Promise<any[]> {
      const colleges = await likhaRequest<any[]>('/items/colleges?fields=*,dean_id.*&limit=100&sort=name');
      return colleges || [];
    },

    async createCollege(payload: any): Promise<any> {
      const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
      const body = { ...payload };
      if ('id' in body && !isUuid(body.id)) {
        delete body.id;
      }
      return likhaRequest('/items/colleges', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    async updateCollege(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/colleges/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteCollege(id: string): Promise<void> {
      await likhaRequest(`/items/colleges/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getDepartments(): Promise<any[]> {
      const departments = await likhaRequest<any[]>('/items/departments?fields=*,college_id.*,chairperson_id.*&limit=250&sort=name');
      return departments || [];
    },

    async createDepartment(payload: any): Promise<any> {
      const isUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
      const body = { ...payload };
      if ('id' in body && !isUuid(body.id)) {
        delete body.id;
      }
      return likhaRequest('/items/departments', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    async updateDepartment(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/departments/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteDepartment(id: string): Promise<void> {
      await likhaRequest(`/items/departments/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async getSchoolYears(): Promise<any[]> {
      const years = await likhaRequest<any[]>('/items/school_years?fields=*&limit=100&sort=year').catch(() => []);
      return years || [];
    },

    async createSchoolYear(payload: any): Promise<any> {
      return likhaRequest('/items/school_years', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateSchoolYear(id: string, updates: any): Promise<any> {
      return likhaRequest(`/items/school_years/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async updateSchoolYearSemester(id: string, semester: string): Promise<any> {
      return likhaRequest(`/items/school_years/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ semester }),
      });
    },
  },
};

export { SESSION_EXPIRED_EVENT, notifySessionExpired } from './client';
export { getLikhaServiceToken, getLikhaUploadServiceToken, likhaElevatedRequest };
