import { describe, it, expect, vi, beforeEach } from 'vitest';
import { likhaLmsApi } from './likhaLmsApi';

describe('Likha LMS Direct API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    likhaLmsApi.invalidateCache();
  });

  it('requests courses with deep nested relations via Directus fields parameter', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'c-1', title: 'Test Course', cover_image: { id: 'img-1' }, instructor: { id: 'u-1' } }],
      }),
    } as any);

    const courses = await likhaLmsApi.getCoursesWithRelations();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/courses?fields=*,cover_image.*,instructor.*,sections.*'),
      expect.any(Object)
    );
    expect(courses[0].id).toBe('c-1');
  });

  it('fetches activities with nested questions, rubrics, and file attachments', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'act-1', title: 'Quiz 1', attachments: [], questions: [], rubrics: [] }],
      }),
    } as any);

    const activities = await likhaLmsApi.getActivitiesWithRelations('c-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/activities?filter[course_id][_eq]=c-1&fields=*,attachments.directus_files_id.*,questions.*'),
      expect.any(Object)
    );
    expect(activities[0].id).toBe('act-1');
  });

  it('fetches course enrollments from Course_Enrollments junction collection', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 1, course: 'c-1', user: { id: 'u-student1', first_name: 'Juan' } }],
      }),
    } as any);

    const enrollments = await likhaLmsApi.courses.getCourseEnrollments('c-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/Course_Enrollments?filter[course][_eq]=c-1&fields=*,user.*,course.*'),
      expect.any(Object)
    );
    expect(enrollments[0].id).toBe(1);
  });

  it('submits a file directly to Likha /files endpoint with multipart form data', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { id: 'file-uuid-123', filename_download: 'doc.pdf' },
      }),
    } as any);

    const dummyFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const uploaded = await likhaLmsApi.uploadFile(dummyFile);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/files'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(uploaded.id).toBe('file-uuid-123');
    expect(uploaded.url).toContain('/assets/file-uuid-123');
  });

  it('retries upload on transient 502 gateway error and succeeds', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'file-retry-502', filename_download: 'avatar.jpg' },
        }),
      } as any);

    const dummyFile = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    const uploaded = await likhaLmsApi.uploadFile(dummyFile);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(uploaded.id).toBe('file-retry-502');
  });

  it('throws on 403 Forbidden without elevating credentials on uploadFile', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ errors: [{ message: 'Forbidden' }] }),
    } as any);

    const dummyFile = new File(['content'], 'avatar.jpg', { type: 'image/jpeg' });
    await expect(likhaLmsApi.uploadFile(dummyFile)).rejects.toThrow();
  });

  it('silently refreshes expired user token before uploadFile to avoid 401 Unauthorized', async () => {
    // Generate a valid base64url payload with exp in the past
    const expiredExp = Math.floor(Date.now() / 1000) - 300;
    const payload = Buffer.from(JSON.stringify({ exp: expiredExp })).toString('base64');
    const expiredJwt = `header.${payload}.signature`;
    localStorage.setItem('gabay_token', expiredJwt);
    localStorage.setItem('gabay_refresh_token', 'valid-refresh-token');

    const fetchSpy = vi.spyOn(global, 'fetch')
      // 1. Silent refresh request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { access_token: 'freshly-refreshed-jwt', refresh_token: 'fresh-refresh' },
        }),
      } as any)
      // 2. Upload request with fresh token
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'file-refreshed-upload', filename_download: 'cover.jpg' },
        }),
      } as any);

    const dummyFile = new File(['content'], 'cover.jpg', { type: 'image/jpeg' });
    const uploaded = await likhaLmsApi.uploadFile(dummyFile);
    expect(uploaded.id).toBe('file-refreshed-upload');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.any(Object)
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/files'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer freshly-refreshed-jwt',
        }),
      })
    );
  });

  it('authenticates user and returns profile and token', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { access_token: 'test-user-token' } }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'u-faculty1', email: 'faculty1@dmmmsu.edu.ph', role: 'faculty' } }),
      } as any);

    const auth = await likhaLmsApi.auth.login('faculty1@dmmmsu.edu.ph', 'gabay2026');
    expect(auth.token).toBe('test-user-token');
    expect(auth.user.email).toBe('faculty1@dmmmsu.edu.ph');
  });

  it('immediately throws on HTTP 403 Forbidden without service credential elevation', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }),
        json: async () => ({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
      } as any);

    await expect(likhaLmsApi.users.getUsers()).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('gracefully returns empty arrays on 403 Forbidden for optional and role-scoped endpoints', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }),
      json: async () => ({ error: { code: 'FORBIDDEN', message: 'Forbidden' } })
    } as any);

    const sections = await likhaLmsApi.sections.getSections('c-1');
    const requests = await likhaLmsApi.requests.getRequests('c-1', 'pending');
    const chatGroups = await likhaLmsApi.communications.getChatGroups();
    const advisingSlots = await likhaLmsApi.communications.getAdvisingSlots();

    expect(sections).toEqual([]);
    expect(requests).toEqual([]);
    expect(chatGroups).toEqual([]);
    expect(advisingSlots).toEqual([]);
  });

  it('returns valid data for sections, requests, chatGroups, and advisingSlots on 200 OK', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'sec-1', name: 'Section A' }] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'req-1', status: 'pending' }] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'cg-1', name: 'Study Group' }] }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'slot-1', status: 'available' }] }),
      } as any);

    const sections = await likhaLmsApi.sections.getSections('c-1');
    const requests = await likhaLmsApi.requests.getRequests('c-1', 'pending');
    const chatGroups = await likhaLmsApi.communications.getChatGroups();
    const advisingSlots = await likhaLmsApi.communications.getAdvisingSlots();

    expect(sections).toEqual([{ id: 'sec-1', name: 'Section A' }]);
    expect(requests).toEqual([{ id: 'req-1', status: 'pending' }]);
    expect(chatGroups).toEqual([{ id: 'cg-1', name: 'Study Group' }]);
    expect(advisingSlots).toEqual([{ id: 'slot-1', status: 'available' }]);
  });

  it('queries normalized relational syllabus with child tables', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{
          id: 'syl-1',
          course_id: 'c-101',
          course_info: [{ course_code: 'CS 101', course_title: 'Intro' }],
          course_outcomes: [{ code: 'CO1', statement: 'Learn algorithms' }],
        }],
      }),
    } as any);

    const syl = await likhaLmsApi.syllabus.getSyllabus('c-101');
    expect(syl).not.toBeNull();
    expect(syl.id).toBe('syl-1');
    expect(syl.course_outcomes[0].code).toBe('CO1');
  });

  it('posts replies to normalized announcement_replies and discussion_replies', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 'ar-1' } }) } as any)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 'dr-1' } }) } as any);

    const annReply = await likhaLmsApi.communications.addAnnouncementReply('ann-1', { content: 'test reply' });
    const discReply = await likhaLmsApi.communications.addDiscussionReply('disc-1', { content: 'test discussion' });

    expect(annReply.id).toBe('ar-1');
    expect(discReply.id).toBe('dr-1');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('posts rubric scores and comments to normalized assessment tables', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 'srs-1' } }) } as any)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { id: 'sc-1' } }) } as any);

    const rubricScore = await likhaLmsApi.submissions.addRubricScore('sub-1', 'crit-1', 25, 'Great work');
    const comment = await likhaLmsApi.submissions.addSubmissionComment('sub-1', 'u-fac', 'Good effort');

    expect(rubricScore.id).toBe('srs-1');
    expect(comment.id).toBe('sc-1');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('fetches the user directory with expanded role relations', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: 'u-fac', email: 'faculty1@dmmmsu.edu.ph', role: { name: 'Instructor' } }],
      }),
    } as any);

    const users = await likhaLmsApi.users.getUsers();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('role.*'),
      expect.any(Object)
    );
    expect(users[0].role).toEqual({ name: 'Instructor' });
  });

  it('deletes a user via Directus users endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);
    await likhaLmsApi.users.deleteUser('u-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/users/u-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('resolves a role name to its Directus UUID via /roles', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'role-uuid-admin', name: 'Administrator' }] }),
    } as any);
    const id = await likhaLmsApi.users.resolveRoleId('Administrator');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/roles?filter[name][_eq]=Administrator'),
      expect.any(Object)
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('fields=id,name'),
      expect.any(Object)
    );
    expect(id).toBe('role-uuid-admin');
  });

  it('returns null for unknown role names and caches the miss', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as any);
    const first = await likhaLmsApi.users.resolveRoleId('NoSuchRole');
    const second = await likhaLmsApi.users.resolveRoleId('NoSuchRole');
    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('caches a known role id and issues no second fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'role-uuid-faculty', name: 'Faculty' }] }),
    } as any);
    const first = await likhaLmsApi.users.resolveRoleId('Faculty');
    const second = await likhaLmsApi.users.resolveRoleId('Faculty');
    expect(first).toBe('role-uuid-faculty');
    expect(second).toBe('role-uuid-faculty');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves null when the /roles lookup rejects, without caching the failure', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('roles unreachable'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'role-uuid-flaky', name: 'FlakyRole' }] }),
      } as any);
    const failed = await likhaLmsApi.users.resolveRoleId('FlakyRole');
    expect(failed).toBeNull();
    // Failure is not cached: the next call retries and succeeds.
    const retried = await likhaLmsApi.users.resolveRoleId('FlakyRole');
    expect(retried).toBe('role-uuid-flaky');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('resolves student role with alias and user harvesting fallback when /roles is forbidden', async () => {
    vi.spyOn(global, 'fetch')
      // 1. /roles?filter[name][_eq]=student fails with 403
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ errors: [{ message: 'Forbidden' }] }),
      } as any)
      // 2. /users?fields=role.id,role.name succeeds and returns user with Student role
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'u-1', role: { id: 'role-uuid-student', name: 'Student' } }
          ],
        }),
      } as any);

    const studentRoleId = await likhaLmsApi.users.resolveRoleId('student');
    expect(studentRoleId).toBe('role-uuid-student');

    // Subsequent resolution for 'Student' or 'student' uses cached ID
    const cachedId = await likhaLmsApi.users.resolveRoleId('Student');
    expect(cachedId).toBe('role-uuid-student');
  });

  it('indexes roles returned by getUsers and resolves them synchronously without network fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: 'u-stud', first_name: 'Juan', role: { id: 'uuid-student-indexed', name: 'Student' } },
          { id: 'u-fac', first_name: 'Prof', role: { id: 'uuid-faculty-indexed', name: 'Instructor' } },
        ],
      }),
    } as any);

    const users = await likhaLmsApi.users.getUsers();
    expect(users).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // resolveRoleId for 'student' or 'faculty' now resolves immediately from cache
    const studentId = await likhaLmsApi.users.resolveRoleId('student');
    const facultyId = await likhaLmsApi.users.resolveRoleId('faculty');
    expect(studentId).toBe('uuid-student-indexed');
    expect(facultyId).toBe('uuid-faculty-indexed');
    // No new network calls were made to /roles
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('deleteCourse issues DELETE /items/courses/:id directly and relies on backend cascade', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as any);

    await likhaLmsApi.courses.deleteCourse('c-1');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/courses/c-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('deleteCourseCascade delegates to deleteCourse for backward compatibility', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    } as any);

    await likhaLmsApi.courses.deleteCourseCascade('c-1');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/courses/c-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('modules.deleteModule issues single DELETE request relying on backend cascade', async () => {
    const urls: string[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, init: any) => {
      const u = String(url);
      urls.push(`${init?.method || 'GET'} ${u}`);
      return { ok: true, json: async () => ({ data: {} }) } as any;
    });

    await likhaLmsApi.modules.deleteModule('mod-1');

    expect(urls).toEqual(['DELETE https://gabay.zyberlab.com/items/modules/mod-1']);
  });

  it('modules.deleteModuleItem deletes the module item', async () => {
    const urls: string[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, init: any) => {
      const u = String(url);
      urls.push(`${init?.method || 'GET'} ${u}`);
      return { ok: true, json: async () => ({ data: {} }) } as any;
    });

    await likhaLmsApi.modules.deleteModuleItem('mi-1');

    const itemIdx = urls.findIndex(u => u === 'DELETE https://gabay.zyberlab.com/items/module_items/mi-1');
    expect(itemIdx).toBeGreaterThan(-1);
  });

  describe('academicStructure controller', () => {
    it('fetches colleges with dean relations', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'col-1', name: 'College of Computer Studies', code: 'CCS', dean_id: { id: 'u-dean1' } }],
        }),
      } as any);

      const colleges = await likhaLmsApi.academicStructure.getColleges();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/colleges?fields=*,dean_id.*'),
        expect.any(Object)
      );
      expect(colleges[0].id).toBe('col-1');
      expect(colleges[0].code).toBe('CCS');
    });

    it('creates a college and invalidates colleges cache', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'col-2', name: 'College of Arts and Sciences', code: 'CAS', dean_id: null },
        }),
      } as any);

      const result = await likhaLmsApi.academicStructure.createCollege({
        name: 'College of Arts and Sciences',
        code: 'CAS',
        dean_id: null,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/colleges'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'College of Arts and Sciences', code: 'CAS', dean_id: null }),
        })
      );
      expect(result.id).toBe('col-2');
    });

    it('fetches departments with college and chairperson relations', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'dept-1', name: 'Computer Science', code: 'CS', college_id: { id: 'col-1' } }],
        }),
      } as any);

      const depts = await likhaLmsApi.academicStructure.getDepartments();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/departments?fields=*,college_id.*,chairperson_id.*'),
        expect.any(Object)
      );
      expect(depts[0].id).toBe('dept-1');
    });

    it('creates a department with college relation', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'dept-2', name: 'Information Technology', code: 'IT', college_id: 'col-1' },
        }),
      } as any);

      const result = await likhaLmsApi.academicStructure.createDepartment({
        college_id: 'col-1',
        name: 'Information Technology',
        code: 'IT',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/departments'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ college_id: 'col-1', name: 'Information Technology', code: 'IT' }),
        })
      );
      expect(result.id).toBe('dept-2');
    });

    it('updates a college and handles leadership assignment', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'col-1', name: 'Updated College', code: 'CCS', dean_id: 'u-dean2' },
        }),
      } as any);

      const result = await likhaLmsApi.academicStructure.updateCollege('col-1', {
        dean_id: 'u-dean2',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/colleges/col-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ dean_id: 'u-dean2' }),
        })
      );
      expect(result.dean_id).toBe('u-dean2');
    });

    it('deletes a college via DELETE endpoint', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      await likhaLmsApi.academicStructure.deleteCollege('col-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/colleges/col-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('updates a department and chairperson assignment', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { id: 'dept-1', chairperson_id: 'u-chair2' },
        }),
      } as any);

      const result = await likhaLmsApi.academicStructure.updateDepartment('dept-1', {
        chairperson_id: 'u-chair2',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/departments/dept-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ chairperson_id: 'u-chair2' }),
        })
      );
      expect(result.chairperson_id).toBe('u-chair2');
    });

    it('deletes a department via DELETE endpoint', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as any);

      await likhaLmsApi.academicStructure.deleteDepartment('dept-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/departments/dept-1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('updates a module comment via Directus items endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'mc-1', content: 'Edited comment' } }),
    } as any);
    const result = await likhaLmsApi.modules.updateComment('mc-1', { content: 'Edited comment' });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/module_comments/mc-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'Edited comment' }),
      })
    );
    expect(result.content).toBe('Edited comment');
  });

  it('deletes a module comment via Directus items endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as any);
    await likhaLmsApi.modules.deleteComment('mc-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/module_comments/mc-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('updates a message reaction via Directus items endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'msg-1', reaction: '👍' } }),
    } as any);
    const result = await likhaLmsApi.communications.updateMessageReaction('msg-1', '👍');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/messages/msg-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ reaction: '👍' }),
      })
    );
    expect(result.reaction).toBe('👍');
  });

  it('updates an announcement via Directus items endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'ann-1', pinned: true } }),
    } as any);
    const result = await likhaLmsApi.communications.updateAnnouncement('ann-1', { pinned: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/announcements/ann-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ pinned: true }),
      })
    );
    expect(result.pinned).toBe(true);
  });

  it('updates a discussion reply via Directus items endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 'dr-1', likes: 5 } }),
    } as any);
    const result = await likhaLmsApi.communications.updateDiscussionReply('dr-1', { likes: 5 });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/discussion_replies/dr-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ likes: 5 }),
      })
    );
    expect(result.likes).toBe(5);
  });

  describe('Session Expiration Detection on 401', () => {
    it('dispatches gabay:session-expired and clears token on 401 when token exists', async () => {
      localStorage.setItem('gabay_token', 'valid-looking-token');
      const listener = vi.fn();
      window.addEventListener('gabay:session-expired', listener);

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ errors: [{ message: 'Token expired', extensions: { code: 'TOKEN_EXPIRED' } }] }),
      } as any);

      await expect(likhaLmsApi.academicStructure.getColleges()).rejects.toThrow();

      expect(listener).toHaveBeenCalled();
      expect(localStorage.getItem('gabay_token')).toBeNull();
      window.removeEventListener('gabay:session-expired', listener);
    });

    it('does not dispatch gabay:session-expired on 401 when no token is present', async () => {
      localStorage.removeItem('gabay_token');
      const listener = vi.fn();
      window.addEventListener('gabay:session-expired', listener);

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ errors: [{ message: 'Unauthorized' }] }),
      } as any);

      await expect(likhaLmsApi.academicStructure.getColleges()).rejects.toThrow();

      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener('gabay:session-expired', listener);
    });

    it('does not dispatch gabay:session-expired on 401 for /auth/login credentials failure', async () => {
      localStorage.setItem('gabay_token', 'stale-token');
      const listener = vi.fn();
      window.addEventListener('gabay:session-expired', listener);

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ errors: [{ message: 'Invalid user credentials', extensions: { code: 'INVALID_CREDENTIALS' } }] }),
      } as any);

      await expect(likhaLmsApi.auth.login('user@example.com', 'wrongpassword')).rejects.toThrow();

      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener('gabay:session-expired', listener);
    });

    it('silently refreshes access token and retries request on 401 when refresh token exists', async () => {
      localStorage.setItem('gabay_token', 'expired-access-token');
      localStorage.setItem('gabay_refresh_token', 'valid-refresh-token');

      const fetchSpy = vi.spyOn(global, 'fetch')
        // 1. Initial request fails with 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ errors: [{ message: 'Token expired' }] }),
        } as any)
        // 2. /auth/refresh returns new access token and new refresh token
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              access_token: 'fresh-new-token',
              refresh_token: 'fresh-new-refresh-token',
            },
          }),
        } as any)
        // 3. Retried request succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'col-1', name: 'College of CS', code: 'CCS' }],
          }),
        } as any);

      const colleges = await likhaLmsApi.academicStructure.getColleges();

      expect(colleges).toHaveLength(1);
      expect(colleges[0].id).toBe('col-1');
      expect(localStorage.getItem('gabay_token')).toBe('fresh-new-token');
      expect(localStorage.getItem('gabay_refresh_token')).toBe('fresh-new-refresh-token');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refresh_token: 'valid-refresh-token', mode: 'json' }),
        })
      );
    });

    it('clears tokens and dispatches session expired when silent refresh fails', async () => {
      localStorage.setItem('gabay_token', 'expired-access-token');
      localStorage.setItem('gabay_refresh_token', 'revoked-refresh-token');

      const listener = vi.fn();
      window.addEventListener('gabay:session-expired', listener);

      vi.spyOn(global, 'fetch')
        // 1. Initial request fails with 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ errors: [{ message: 'Token expired' }] }),
        } as any)
        // 2. /auth/refresh also fails with 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ errors: [{ message: 'Refresh token expired' }] }),
        } as any);

      await expect(likhaLmsApi.academicStructure.getColleges()).rejects.toThrow();

      expect(listener).toHaveBeenCalled();
      expect(localStorage.getItem('gabay_token')).toBeNull();
      expect(localStorage.getItem('gabay_refresh_token')).toBeNull();
      window.removeEventListener('gabay:session-expired', listener);
    });

    it('throws 403 Forbidden on deleteCourse when user lacks permission instead of elevating with service token', async () => {
      localStorage.setItem('gabay_token', 'unauthorized-user-token');

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({
          errors: [{
            message: 'You don\'t have permission to access collection "courses" or it does not exist.',
            extensions: { code: 'FORBIDDEN' },
          }],
        }),
      } as any);

      await expect(likhaLmsApi.courses.deleteCourse('c-403')).rejects.toThrow();
    });

    it('deleteCourseCascade delegates to deleteCourse and issues single DELETE endpoint', async () => {
      localStorage.setItem('gabay_token', 'test-token');
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as any);

      await likhaLmsApi.courses.deleteCourseCascade('c-full');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/items/courses/c-full'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});





