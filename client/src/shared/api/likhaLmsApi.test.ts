import { describe, it, expect, vi, beforeEach } from 'vitest';
import { likhaLmsApi } from './likhaLmsApi';

describe('Likha LMS Direct API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
      expect.stringContaining('/items/courses?fields=*,cover_image.*,instructor.*,activities.*,modules.*,modules.items.*,course_files.*'),
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
      expect.stringContaining('/items/activities?filter[course_id][_eq]=c-1&fields=*,attachments.directus_files_id.*,questions.*,rubrics.*'),
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
});

