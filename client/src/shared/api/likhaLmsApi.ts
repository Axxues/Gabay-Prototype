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
  if (path.includes('/items/colleges') || path.includes('/items/departments')) return 120000;
  return 30000;
}

async function likhaRequest<T = any>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const token = getToken() || 'anon';
    const cacheKey = `${token}:${path}`;
    const ttl = getPathTtl(path);
    return likhaCache.getOrFetch<T>(cacheKey, () => rawLikhaFetch<T>(path, options, allowRetry), ttl);
  }

  // Mutation: execute and invalidate affected collection cache
  const result = await rawLikhaFetch<T>(path, options, allowRetry);
  const resourceBase = path.split('?')[0];
  likhaCache.invalidate(resourceBase);
  return result;
}

// In-module name→UUID map so one /roles lookup serves the session
// (likhaRequest GET caching also applies, but this avoids repeat lookups
// entirely, including cache misses keyed by token).
// NOTE: this map lives outside likhaCache, so only invalidateCache() below
// clears it — direct likhaCache.invalidate() calls (e.g. the post-mutation
// hook in likhaRequest) do not. Safe because role id↔name mappings are
// effectively static for a session.
const roleIdByName = new Map<string, string | null>();

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
      return { token, user: me };
    },

    async refresh(): Promise<string | null> {
      return refreshAccessToken();
    },

    async getMe(): Promise<any> {
      return likhaRequest('/users/me?fields=*,role.*');
    },

    logout(): void {
      clearToken();
      likhaCache.clear();
    },
  },

  users: {
    async getUsers(): Promise<any[]> {
      const users = await likhaRequest<any[]>('/users?fields=*,role.*&limit=250&sort=first_name');
      return users || [];
    },

    async createUser(payload: any): Promise<any> {
      return likhaRequest('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async updateUser(id: string, updates: any): Promise<any> {
      return likhaRequest(`/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteUser(id: string): Promise<void> {
      await likhaRequest(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async resolveRoleId(name: string): Promise<string | null> {
      const key = String(name);
      if (roleIdByName.has(key)) return roleIdByName.get(key) ?? null;
      // Best-effort lookup: a /roles outage rejects, but callers treat a
      // missing role as local-only, so degrade to null here. Failures are
      // NOT cached, so a transient outage can recover on the next call.
      let rows: any[];
      try {
        rows = await rawLikhaFetch<any[]>(
          `/roles?filter[name][_eq]=${encodeURIComponent(key)}&fields=id,name`
        );
      } catch {
        return null;
      }
      const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
      const found = list[0];
      const id = found?.id != null ? String(found.id) : null;
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
      return likhaRequest('/items/courses', {
        method: 'POST',
        body: JSON.stringify(course),
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
    },

    // Robust children-first relational cascade: Directus does not apply server-side
    // CASCADE ON DELETE, so parent deletes are blocked by foreign key constraints.
    // We discover existing records from Directus and delete them bottom-up:
    // Level 1: Leaf children (submission answers/comments/rubric scores, questions, criteria, syllabus parts, module items/comments, spr cells)
    // Level 2: Submissions
    // Level 3: Assessments, modules, syllabi, spr configs
    // Level 4: Enrollments, grades, files, folders, sections, requests, announcements, discussions, events
    // Level 5: Course itself
    async deleteCourseCascade(id: string): Promise<void> {
      const del = (p: Promise<unknown>) => p.catch(() => {});
      const list = async (p: Promise<unknown>): Promise<any[]> => {
        try {
          const r = await p;
          return Array.isArray(r) ? r : [];
        } catch {
          return [];
        }
      };

      const fetchItems = async (collection: string, filterQuery: string): Promise<any[]> => {
        try {
          const res = await likhaRequest(`/items/${collection}?${filterQuery}&limit=-1`);
          return Array.isArray(res) ? res : [];
        } catch {
          return [];
        }
      };

      const deleteItems = async (collection: string, items: Array<{ id?: string; revisionId?: string }>): Promise<void> => {
        const validIds = items.map(it => it.id ?? it.revisionId).filter(Boolean) as string[];
        if (validIds.length === 0) return;
        await Promise.allSettled(
          validIds.map(itemId => del(likhaRequest(`/items/${collection}/${encodeURIComponent(itemId)}`, { method: 'DELETE' })))
        );
      };

      // 1. Discover all course children
      const [
        mods, acts, quizzes, exams, anns, discs, files, folders,
        sections, reqs, enrolls, grades, events, syllabi, sprConfig
      ] = await Promise.all([
        list(likhaLmsApi.modules.getModulesWithItems(id)),
        list(likhaLmsApi.assessments.getActivities(id)),
        list(likhaLmsApi.assessments.getQuizzes(id)),
        list(likhaLmsApi.assessments.getExams(id)),
        list(likhaLmsApi.communications.getAnnouncements(id)),
        list(likhaLmsApi.communications.getDiscussions(id)),
        list(likhaLmsApi.files.getCourseFiles(id)),
        list(likhaLmsApi.files.getCourseFolders(id)),
        list(likhaLmsApi.sections.getSections(id)),
        list(likhaLmsApi.requests.getRequests(id)),
        list(likhaLmsApi.courses.getCourseEnrollments(id)),
        list(likhaLmsApi.grades.getCourseGrades(id)),
        list(likhaLmsApi.communications.getCalendarEvents()),
        list(likhaLmsApi.syllabus.listRevisions(id)),
        likhaLmsApi.grades.getSPRConfig(id).catch(() => null),
      ]);

      const allAssessments = [...acts, ...quizzes, ...exams];
      const subLists = await Promise.all([
        ...acts.map(a => list(likhaLmsApi.submissions.getSubmissions(a.id, 'activity'))),
        ...quizzes.map(q => list(likhaLmsApi.submissions.getSubmissions(q.id, 'quiz'))),
        ...exams.map(e => list(likhaLmsApi.submissions.getSubmissions(e.id, 'exam'))),
      ]);
      const allSubmissions = subLists.flat();

      // Discover leaf items for submissions, assessments, syllabi, modules
      const [
        subAnswers, subComments, subRubricScores,
        questions, rubrics, actFiles,
        sylSignatories, sylReferences, sylPolicies, sylRubrics, sylPlans, sylMaps,
        modComments, sprCells
      ] = await Promise.all([
        allSubmissions.length > 0 ? fetchItems('submission_answers', `filter[submission_id][_in]=${allSubmissions.map(s => s.id).join(',')}`) : [],
        allSubmissions.length > 0 ? fetchItems('submission_comments', `filter[submission_id][_in]=${allSubmissions.map(s => s.id).join(',')}`) : [],
        allSubmissions.length > 0 ? fetchItems('submission_rubric_scores', `filter[submission_id][_in]=${allSubmissions.map(s => s.id).join(',')}`) : [],
        allAssessments.length > 0 ? fetchItems('assessment_questions', `filter[activity_id][_in]=${allAssessments.map(a => a.id).join(',')}`) : [],
        allAssessments.length > 0 ? fetchItems('rubric_criteria', `filter[activity_id][_in]=${allAssessments.map(a => a.id).join(',')}`) : [],
        allAssessments.length > 0 ? fetchItems('activities_files', `filter[activities_id][_in]=${allAssessments.map(a => a.id).join(',')}`) : [],
        syllabi.length > 0 ? fetchItems('syllabus_signatories', `filter[syllabus_id][_in]=${syllabi.map(s => s.id ?? s.revisionId).join(',')}`) : [],
        syllabi.length > 0 ? fetchItems('syllabus_references', `filter[syllabus_id][_in]=${syllabi.map(s => s.id ?? s.revisionId).join(',')}`) : [],
        syllabi.length > 0 ? fetchItems('syllabus_policies', `filter[syllabus_id][_in]=${syllabi.map(s => s.id ?? s.revisionId).join(',')}`) : [],
        syllabi.length > 0 ? fetchItems('syllabus_rubrics', `filter[syllabus_id][_in]=${syllabi.map(s => s.id ?? s.revisionId).join(',')}`) : [],
        syllabi.length > 0 ? fetchItems('syllabus_learning_plans', `filter[syllabus_id][_in]=${syllabi.map(s => s.id ?? s.revisionId).join(',')}`) : [],
        syllabi.length > 0 ? fetchItems('syllabus_course_maps', `filter[syllabus_id][_in]=${syllabi.map(s => s.id ?? s.revisionId).join(',')}`) : [],
        mods.length > 0 ? fetchItems('module_comments', `filter[module_id][_in]=${mods.map(m => m.id).join(',')}`) : [],
        sprConfig?.id ? fetchItems('spr_cells', `filter[config_id][_eq]=${encodeURIComponent(sprConfig.id)}`) : [],
      ]);

      const modItems = mods.flatMap(m => m.items || []);

      // Stage 1: Delete all Leaf records (Foreign key dependants)
      await Promise.allSettled([
        deleteItems('submission_answers', subAnswers),
        deleteItems('submission_comments', subComments),
        deleteItems('submission_rubric_scores', subRubricScores),
        deleteItems('assessment_questions', questions),
        deleteItems('rubric_criteria', rubrics),
        deleteItems('activities_files', actFiles),
        deleteItems('syllabus_signatories', sylSignatories),
        deleteItems('syllabus_references', sylReferences),
        deleteItems('syllabus_policies', sylPolicies),
        deleteItems('syllabus_rubrics', sylRubrics),
        deleteItems('syllabus_learning_plans', sylPlans),
        deleteItems('syllabus_course_maps', sylMaps),
        deleteItems('module_items', modItems),
        deleteItems('module_comments', modComments),
        deleteItems('spr_cells', sprCells),
      ]);

      // Stage 2: Delete Submissions
      await Promise.allSettled([
        deleteItems('submissions', allSubmissions),
      ]);

      // Stage 3: Delete Assessments, Modules, Syllabi, SPR Configs
      await Promise.allSettled([
        deleteItems('activities', acts),
        deleteItems('activities', quizzes),
        deleteItems('activities', exams),
        deleteItems('modules', mods),
        deleteItems('syllabi', syllabi),
        sprConfig?.id ? del(likhaRequest(`/items/spr_configs/${encodeURIComponent(sprConfig.id)}`, { method: 'DELETE' })) : Promise.resolve(),
      ]);

      // Stage 4: Delete Course-level records
      await Promise.allSettled([
        deleteItems('Course_Enrollments', enrolls),
        deleteItems('course_grades', grades),
        deleteItems('course_files', files),
        deleteItems('course_folders', folders),
        deleteItems('course_sections', sections),
        deleteItems('enrollment_requests', reqs),
        deleteItems('announcements', anns),
        deleteItems('discussions', discs),
        deleteItems('calendar_events', events.filter(ev => String(ev.course_id ?? ev.courseId ?? '') === String(id))),
      ]);

      // Stage 5: Delete Course itself
      await likhaLmsApi.courses.deleteCourse(id);
    },
  },

  sections: {
    async getSections(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/course_sections?filter[course_id][_eq]=${encodeURIComponent(courseId)}`).catch(() => []);
    },

    async createSection(section: any): Promise<any> {
      return likhaRequest('/items/course_sections', {
        method: 'POST',
        body: JSON.stringify(section),
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
      return likhaRequest('/items/modules', {
        method: 'POST',
        body: JSON.stringify(module),
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
    },

    async createModuleItem(item: any): Promise<any> {
      return likhaRequest('/items/module_items', {
        method: 'POST',
        body: JSON.stringify(item),
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
    },

    async getComments(itemId: string): Promise<any[]> {
      return likhaRequest(`/items/module_comments?filter[item_id][_eq]=${encodeURIComponent(itemId)}&sort=created_at`);
    },

    async addComment(comment: any): Promise<any> {
      return likhaRequest('/items/module_comments', {
        method: 'POST',
        body: JSON.stringify(comment),
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
      const url = isUpdate ? `/items/quizzes/${encodeURIComponent(rootPayload.id)}` : '/items/quizzes';
      const saved = await likhaRequest(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        body: JSON.stringify(rootPayload),
      });
      const quizId = saved.id || rootPayload.id;

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
      const url = isUpdate ? `/items/exams/${encodeURIComponent(rootPayload.id)}` : '/items/exams';
      const saved = await likhaRequest(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        body: JSON.stringify(rootPayload),
      });
      const examId = saved.id || rootPayload.id;

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
      return likhaRequest('/items/announcements', {
        method: 'POST',
        body: JSON.stringify(data),
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
      return likhaRequest('/items/announcement_replies', {
        method: 'POST',
        body: JSON.stringify({ announcement_id: announcementId, ...reply }),
      });
    },

    async getDiscussions(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/discussions?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=-created_at`);
    },

    async createDiscussion(data: any): Promise<any> {
      return likhaRequest('/items/discussions', {
        method: 'POST',
        body: JSON.stringify(data),
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
      return likhaRequest('/items/discussion_replies', {
        method: 'POST',
        body: JSON.stringify({ discussion_id: discussionId, ...reply }),
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
      return likhaRequest('/items/messages', {
        method: 'POST',
        body: JSON.stringify(data),
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
      return likhaRequest('/items/chat_groups', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getCalendarEvents(): Promise<any[]> {
      return likhaRequest('/items/calendar_events?limit=200&sort=date');
    },

    async createCalendarEvent(data: any): Promise<any> {
      return likhaRequest('/items/calendar_events', {
        method: 'POST',
        body: JSON.stringify(data),
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
      return likhaRequest('/items/advising_slots', {
        method: 'POST',
        body: JSON.stringify(data),
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
      return likhaRequest('/items/course_files', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async updateCourseFile(id: string, patch: any): Promise<any> {
      return likhaRequest(`/items/course_files/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },

    async deleteCourseFile(id: string): Promise<void> {
      await likhaRequest(`/items/course_files/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },

    async getCourseFolders(courseId: string): Promise<any[]> {
      return likhaRequest(`/items/course_folders?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=name`);
    },

    async createCourseFolder(data: any): Promise<any> {
      return likhaRequest('/items/course_folders', {
        method: 'POST',
        body: JSON.stringify(data),
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
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${LIKHA_URL}/files`, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error(`File upload to Likha failed: ${res.status}`);
    const json = await res.json();
    const fileData = json.data;
    return {
      id: fileData.id,
      filename_download: fileData.filename_download || file.name,
      url: `${LIKHA_URL}/assets/${fileData.id}`,
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
    const url = isUpdate
      ? `/items/activities/${encodeURIComponent(rootPayload.id)}`
      : `/items/activities`;
    const saved = await likhaRequest(url, {
      method: isUpdate ? 'PATCH' : 'POST',
      body: JSON.stringify(rootPayload),
    });
    const actId = saved.id || rootPayload.id;

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
      return likhaRequest('/items/colleges', {
        method: 'POST',
        body: JSON.stringify(payload),
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
      return likhaRequest('/items/departments', {
        method: 'POST',
        body: JSON.stringify(payload),
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
  },
};

export { SESSION_EXPIRED_EVENT, notifySessionExpired } from './client';
