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
        data: [{ id: 'c-1', title: 'Test Course', activities: [], modules: [], course_files: [] }],
      }),
    } as any);

    const courses = await likhaLmsApi.getCoursesWithRelations();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/courses?fields=*,activities.*,modules.*,modules.items.*,course_files.*'),
      expect.any(Object)
    );
    expect(courses[0].id).toBe('c-1');
  });

  it('fetches activities with nested questions and rubrics', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: 'act-1', title: 'Quiz 1', questions: [], rubrics: [] }],
      }),
    } as any);

    const activities = await likhaLmsApi.getActivitiesWithRelations('c-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/items/activities?filter[course_id][_eq]=c-1&fields=*,questions.*,rubrics.*'),
      expect.any(Object)
    );
    expect(activities[0].id).toBe('act-1');
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
});
