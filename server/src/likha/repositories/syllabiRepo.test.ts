import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCourseSyllabus, saveCourseSyllabus } from './syllabiRepo.js';

describe('Syllabi Repository Relational Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reconstructs normalized syllabus sections into full syllabus structure', async () => {
    const mockSyllabusHeader = {
      data: [{ id: 'syl-1', course_id: 'c-cs101', version: 1, status: 'published' }],
    };
    const mockCourseInfo = {
      data: [{ syllabus_id: 'syl-1', course_code: 'CS101', course_title: 'Intro to AI' }],
    };
    const mockInstitution = {
      data: [{ syllabus_id: 'syl-1', university_name: 'DMMMSU' }],
    };

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const u = String(url);
      if (u.includes('/auth/login')) {
        return {
          ok: true,
          json: async () => ({ data: { access_token: 'fake-token', expires: 900000 } }),
        } as any;
      }
      if (u.includes('/items/syllabi?')) {
        return { ok: true, json: async () => mockSyllabusHeader } as any;
      }
      if (u.includes('/items/syllabus_course_info?')) {
        return { ok: true, json: async () => mockCourseInfo } as any;
      }
      if (u.includes('/items/syllabus_institution?')) {
        return { ok: true, json: async () => mockInstitution } as any;
      }
      return { ok: true, json: async () => ({ data: [] }) } as any;
    });

    const syl = await getCourseSyllabus('c-cs101');
    expect(syl).toBeDefined();
    expect(syl.courseInfo).toBeDefined();
    expect(syl.courseInfo.code).toBe('CS101');
    expect(syl.institution).toBeDefined();
    expect(syl.institution.university).toBe('DMMMSU');
  });

  it('saves syllabus into relational child collections', async () => {
    const postedItems: Record<string, any> = {};

    vi.spyOn(global, 'fetch').mockImplementation(async (url: any, opts: any) => {
      const u = String(url);
      if (u.includes('/auth/login')) {
        return {
          ok: true,
          json: async () => ({ data: { access_token: 'fake-token', expires: 900000 } }),
        } as any;
      }
      if (opts?.method === 'POST') {
        const path = u.split('/items/')[1]?.split('?')[0];
        if (path) {
          postedItems[path] = JSON.parse(opts.body);
        }
        return { ok: true, json: async () => ({ data: { id: 'saved-id' } }) } as any;
      }
      return { ok: true, json: async () => ({ data: [] }) } as any;
    });

    const mockContent = {
      courseInfo: { code: 'CS101', title: 'Intro to AI' },
      institution: { university: 'DMMMSU', campus: 'SLUC' },
      faculty: [{ name: 'Dr. Smith', email: 'smith@dmmmsu.edu.ph' }],
    };

    await saveCourseSyllabus('c-cs101', mockContent);

    expect(postedItems['syllabi']).toBeDefined();
    expect(postedItems['syllabus_course_info']).toBeDefined();
    expect(postedItems['syllabus_course_info'].course_code).toBe('CS101');
    expect(postedItems['syllabus_institution']).toBeDefined();
    expect(postedItems['syllabus_faculty']).toBeDefined();
  });
});
