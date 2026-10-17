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

  it('retries with service token on HTTP 403 Forbidden', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      // 1. Initial user request fails with 403
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) } as any)
      // 2. Service token login succeeds
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { access_token: 'service-token-xyz' } }) } as any)
      // 3. Retry with service token succeeds
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [{ id: 'notif-1' }] }) } as any);

    const notifs = await likhaLmsApi.communications.getNotifications('u-1');
    expect(notifs[0].id).toBe('notif-1');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/notifications'),
      expect.any(Object)
    );
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

  it('deleteCourseCascade removes children before the parent course', async () => {
    const urls: string[] = [];
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, init: any) => {
      const u = String(url);
      urls.push(`${init?.method || 'GET'} ${u}`);
      if ((init?.method || 'GET') === 'GET') {
        if (u.includes('/items/module_items?')) return { ok: true, json: async () => ({ data: [{ id: 'mi-1', module_id: 'm-1' }] }) } as any;
        if (u.includes('/items/modules?')) return { ok: true, json: async () => ({ data: [{ id: 'm-1', items: [] }] }) } as any;
        if (u.includes('/items/activities?')) return { ok: true, json: async () => ({ data: [{ id: 'a-1' }] }) } as any;
        if (u.includes('/items/submissions?')) return { ok: true, json: async () => ({ data: [{ id: 'sub-1', activity_id: 'a-1' }] }) } as any;
        if (u.includes('/items/submission_answers?')) return { ok: true, json: async () => ({ data: [{ id: 'sa-1', submission_id: 'sub-1' }] }) } as any;
        if (u.includes('/items/assessment_questions?')) return { ok: true, json: async () => ({ data: [{ id: 'q-1', activity_id: 'a-1' }] }) } as any;
        if (u.includes('/items/announcements?')) return { ok: true, json: async () => ({ data: [{ id: 'an-1' }] }) } as any;
        if (u.includes('/items/syllabi?')) return { ok: true, json: async () => ({ data: [{ id: 's-1' }] }) } as any;
        return { ok: true, json: async () => ({ data: [] }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });
    await likhaLmsApi.courses.deleteCourseCascade('c-1');
    const parentIdx = urls.findIndex(u => u === 'DELETE https://gabay.zyberlab.com/items/courses/c-1');
    expect(parentIdx).toBeGreaterThan(-1);

    const saIdx = urls.findIndex(u => u === 'DELETE https://gabay.zyberlab.com/items/submission_answers/sa-1');
    const subIdx = urls.findIndex(u => u === 'DELETE https://gabay.zyberlab.com/items/submissions/sub-1');
    const qIdx = urls.findIndex(u => u === 'DELETE https://gabay.zyberlab.com/items/assessment_questions/q-1');
    const actIdx = urls.findIndex(u => u === 'DELETE https://gabay.zyberlab.com/items/activities/a-1');

    // Leaves must be deleted before intermediate parents
    expect(saIdx).toBeGreaterThan(-1);
    expect(subIdx).toBeGreaterThan(-1);
    expect(saIdx).toBeLessThan(subIdx);

    expect(qIdx).toBeGreaterThan(-1);
    expect(actIdx).toBeGreaterThan(-1);
    expect(qIdx).toBeLessThan(actIdx);

    // Everything before the course itself
    expect(subIdx).toBeLessThan(parentIdx);
    expect(actIdx).toBeLessThan(parentIdx);
    expect(urls.slice(0, parentIdx)).toContain('DELETE https://gabay.zyberlab.com/items/module_items/mi-1');
    expect(urls.slice(0, parentIdx)).toContain('DELETE https://gabay.zyberlab.com/items/modules/m-1');
    expect(urls.slice(0, parentIdx)).toContain('DELETE https://gabay.zyberlab.com/items/announcements/an-1');
    expect(urls.slice(0, parentIdx)).toContain('DELETE https://gabay.zyberlab.com/items/syllabi/s-1');
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
});



