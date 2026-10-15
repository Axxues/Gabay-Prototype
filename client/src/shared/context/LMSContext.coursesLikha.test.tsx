// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

// Task 4: courses, sections, enrollment requests write through Likha ERP,
// never Express. Directus-shaped rows, exactly like the live Likha ERP
// stores them (snake_case; cached courses keep join_code only).

const courseRow = {
  id: 'c1',
  code: 'CMSC 180',
  title: 'Data Structures',
  instructor_id: 'u-fac-1',
  published: true,
  join_code: 'CMSC-AB12',
  enrolledCount: 0,
};

const sectionRow = {
  id: 'sec-1',
  course_id: 'c1',
  name: 'Section A',
  capacity: 30,
  enrolled_count: 0,
  schedule: 'MWF',
  room: 'Room 101',
};

const pendingRow = {
  id: 'req-pending-1',
  course_id: 'c1',
  student_id: 'u-stud-1',
  student_name: 'Stud One',
  type: 'self_join',
  status: 'pending',
  requested_at: '2026-10-01T00:00:00.000Z',
};

const inviteRow = {
  id: 'req-invite-1',
  course_id: 'c1',
  student_id: 'u-stud-1',
  student_name: 'Stud One',
  type: 'faculty_enroll',
  status: 'pending',
  requested_at: '2026-10-02T00:00:00.000Z',
};

const approvedRow = {
  id: 'req-approved-1',
  course_id: 'c1',
  student_id: 'u-stud-1',
  student_name: 'Stud One',
  type: 'self_join',
  status: 'approved',
  requested_at: '2026-10-01T00:00:00.000Z',
};

// Deferred content/assessment/files fills belong to later migration tasks
// and still read Express — return empties for those shapes here.
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  if (path.includes('/submissions')) return { submissions: [] };
  if (path.includes('/modules')) return { modules: [] };
  if (path.includes('/announcements')) return { announcements: [] };
  if (path.includes('/discussions')) return { discussions: [] };
  if (path.includes('/quizzes')) return { quizzes: [] };
  if (path.includes('/exams')) return { exams: [] };
  if (path.includes('/activities')) return { activities: [] };
  if (path.includes('/grades')) return { grades: [] };
  if (path.includes('/spr')) return { config: null };
  if (path.includes('/folders')) return { folders: [] };
  if (path.includes('/files')) return { files: [] };
  throw new Error(`unmocked: ${path}`);
});

let loginRoleName = 'Faculty';
let loginUserId = 'u-fac-1';
let loginEmail = 'faculty1@dmmmsu.edu.ph';

const loginLikhaMock = vi.fn(async () => ({
  token: 't-likha',
  user: {
    id: loginUserId,
    first_name: loginRoleName === 'Faculty' ? 'Faculty' : 'Stud',
    last_name: 'One',
    email: loginEmail,
    role: { name: loginRoleName },
  },
}));
const getCoursesWithRelationsMock = vi.fn(async () => [{ ...courseRow }]);
const getCoursesMock = vi.fn(async () => [{ ...courseRow }]);
const getCourseMock = vi.fn(async (id: string) => ({ ...courseRow, id }));
const createCourseMock = vi.fn(async (payload: any) => ({ id: 'c-new', ...payload }));
const updateCourseMock = vi.fn(async (id: string, updates: any) => ({ id, ...updates }));
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => [
  { id: 'u-fac-1', first_name: 'Faculty', last_name: 'One', email: 'faculty1@dmmmsu.edu.ph', role: { name: 'Faculty' } },
]);
const getMessagesMock = vi.fn(async () => []);
const getCalendarMock = vi.fn(async () => []);
const getGroupsMock = vi.fn(async () => []);
const getSlotsMock = vi.fn(async () => []);
const getSectionsMock = vi.fn(async () => [{ ...sectionRow }]);
const createSectionMock = vi.fn(async (payload: any) => ({ id: 'sec-new', enrolled_count: 0, ...payload }));
const updateSectionMock = vi.fn(async (id: string, updates: any) => ({ id, ...updates }));
const deleteSectionMock = vi.fn(async () => ({}));
const getRequestsMock = vi.fn(async (courseId?: string, status?: string) => {
  if (courseId === 'c1' && status === 'pending') return [{ ...pendingRow }, { ...inviteRow }];
  if (courseId === 'c1' && status === 'approved') return [{ ...approvedRow }];
  return [];
});
const createRequestMock = vi.fn(async (payload: any) => ({
  id: 'req-new-1',
  requested_at: '2026-10-15T00:00:00.000Z',
  ...payload,
}));
const knownRequestRows = [pendingRow, inviteRow, approvedRow];
const updateRequestMock = vi.fn(async (id: string, updates: any) => ({
  ...(knownRequestRows.find(r => r.id === id) ?? {}),
  ...updates,
  id,
}));
const deleteRequestMock = vi.fn(async () => ({}));
const invalidateCacheMock = vi.fn();

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  getToken: () => null,
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: (...args: any[]) => (apiFetchMock as any)(...args),
  likhaLmsApi: {
    loginLikhaUser: (...args: any[]) => (loginLikhaMock as any)(...args),
    getCoursesWithRelations: (...args: any[]) => (getCoursesWithRelationsMock as any)(...args),
    getNotifications: (...args: any[]) => (getNotifsMock as any)(...args),
    invalidateCache: (...args: any[]) => (invalidateCacheMock as any)(...args),
    users: {
      getUsers: (...args: any[]) => (getUsersMock as any)(...args),
    },
    communications: {
      getMessages: (...args: any[]) => (getMessagesMock as any)(...args),
      getCalendarEvents: (...args: any[]) => (getCalendarMock as any)(...args),
      getChatGroups: (...args: any[]) => (getGroupsMock as any)(...args),
      getAdvisingSlots: (...args: any[]) => (getSlotsMock as any)(...args),
    },
    courses: {
      getCourses: (...args: any[]) => (getCoursesMock as any)(...args),
      getCourse: (...args: any[]) => (getCourseMock as any)(...args),
      createCourse: (...args: any[]) => (createCourseMock as any)(...args),
      updateCourse: (...args: any[]) => (updateCourseMock as any)(...args),
    },
    requests: {
      getRequests: (...args: any[]) => (getRequestsMock as any)(...args),
      createRequest: (...args: any[]) => (createRequestMock as any)(...args),
      updateRequest: (...args: any[]) => (updateRequestMock as any)(...args),
      deleteRequest: (...args: any[]) => (deleteRequestMock as any)(...args),
    },
    sections: {
      getSections: (...args: any[]) => (getSectionsMock as any)(...args),
      createSection: (...args: any[]) => (createSectionMock as any)(...args),
      updateSection: (...args: any[]) => (updateSectionMock as any)(...args),
      deleteSection: (...args: any[]) => (deleteSectionMock as any)(...args),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let ctx: any = null;
let seenDb: any = null;

const Probe: React.FC = () => {
  const v = useLMS();
  ctx = v as any;
  seenDb = v.db as any;
  return null;
};

async function renderLoggedInAs(role: string, id: string, email: string) {
  loginRoleName = role;
  loginUserId = id;
  loginEmail = email;
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await ctx.login(email, 'pw');
  });
  await waitFor(() => {
    expect((seenDb.courses || []).some((c: any) => c.id === 'c1')).toBe(true);
  });
  await waitFor(() => {
    expect((seenDb.enrollmentRequests || []).some((r: any) => r.id === 'req-pending-1')).toBe(true);
  });
}

// Task-4-owned Express paths. Later-task subpaths (modules, assessments,
// grades/SPR, files, comms) still read Express and are excluded here.
const task4ExpressCalls = () =>
  (apiFetchMock.mock.calls as any[][])
    .map(([p]) => String(p))
    .filter(p => /\/api\/(courses|sections|requests)/.test(p))
    .filter(
      p =>
        !/\/(modules|announcements|discussions|quizzes|exams|activities|submissions|grades|spr|folders|files|upload|comments)/.test(
          p
        )
    );

describe('courses, sections, requests via Likha (Task 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx = null;
    seenDb = null;
    loginRoleName = 'Faculty';
    loginUserId = 'u-fac-1';
    loginEmail = 'faculty1@dmmmsu.edu.ph';
    try {
      localStorage.clear();
    } catch {}
  });

  test('createCourse writes through Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let created: any = null;
    await act(async () => {
      created = await ctx.createCourse({ code: 'CS 101', title: 'Intro' });
    });
    expect(createCourseMock).toHaveBeenCalledTimes(1);
    expect(createCourseMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CS 101', title: 'Intro', join_code: expect.any(String) })
    );
    expect(task4ExpressCalls()).toEqual([]);
    expect(created.id).toBe('c-new');
    expect((seenDb.courses || []).some((c: any) => c.id === 'c-new')).toBe(true);
  });

  test('regenerateCourseJoinCode persists via courses.updateCourse, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let code = '';
    await act(async () => {
      code = await ctx.regenerateCourseJoinCode('c1');
    });
    expect(updateCourseMock).toHaveBeenCalledWith('c1', { join_code: code });
    expect(task4ExpressCalls()).toEqual([]);
    expect((seenDb.courses || []).find((c: any) => c.id === 'c1')?.joinCode).toBe(code);
  });

  test('updateCourseGradingTerms persists via courses.updateCourse, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.updateCourseGradingTerms('c1', ['midterm', 'finals']);
    });
    expect(updateCourseMock).toHaveBeenCalledWith('c1', { gradingTerms: ['midterm', 'finals'] });
    expect(task4ExpressCalls()).toEqual([]);
    expect((seenDb.courses || []).find((c: any) => c.id === 'c1')?.gradingTerms).toEqual([
      'midterm',
      'finals',
    ]);
  });

  test('createSection writes through Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let section: any = null;
    await act(async () => {
      section = await ctx.createSection('c1', { name: 'Section B', capacity: 25 });
    });
    expect(createSectionMock).toHaveBeenCalledTimes(1);
    expect(createSectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: 'c1', name: 'Section B' })
    );
    expect(task4ExpressCalls()).toEqual([]);
    expect(section.id).toBe('sec-new');
    expect((seenDb.courseSections || []).some((s: any) => s.id === 'sec-new')).toBe(true);
  });

  test('updateSection patches via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let ok = false;
    await act(async () => {
      ok = await ctx.updateSection('sec-1', { name: 'Section A1' });
    });
    expect(updateSectionMock).toHaveBeenCalledWith('sec-1', expect.objectContaining({ name: 'Section A1' }));
    expect(task4ExpressCalls()).toEqual([]);
    expect(ok).toBe(true);
    expect((seenDb.courseSections || []).find((s: any) => s.id === 'sec-1')?.name).toBe('Section A1');
  });

  test('deleteSection deletes via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    // The delete guard blocks sections while pendings exist for the course —
    // clear them first so the remote delete path is exercised.
    await act(async () => {
      await ctx.rejectEnrollmentRequests(['req-pending-1', 'req-invite-1']);
    });
    let ok = false;
    await act(async () => {
      ok = await ctx.deleteSection('sec-1');
    });
    expect(deleteSectionMock).toHaveBeenCalledWith('sec-1');
    expect(task4ExpressCalls()).toEqual([]);
    expect(ok).toBe(true);
    expect((seenDb.courseSections || []).some((s: any) => s.id === 'sec-1')).toBe(false);
  });

  test('joinCourseByCode falls back to Likha lookup when the cache has no join code', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let result: any = null;
    await act(async () => {
      result = await ctx.joinCourseByCode('cmsc-ab12');
    });
    expect(result.success).toBe(true);
    // Bootstrap rows carry no join code, so the code resolves via getCourses.
    expect(getCoursesMock).toHaveBeenCalled();
    expect(createRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: 'c1', student_id: 'u-fac-1', status: 'pending' })
    );
    expect(task4ExpressCalls()).toEqual([]);
  });

  test('createEnrollmentRequest (self_join) writes via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    // Created courses carry their join code, so the self-join path proceeds.
    let created: any = null;
    await act(async () => {
      created = await ctx.createCourse({ code: 'CS 102', title: 'Advanced' });
    });
    let request: any = null;
    await act(async () => {
      request = await ctx.createEnrollmentRequest(created.id, 'self_join');
    });
    expect(createRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: created.id, student_id: 'u-fac-1', type: 'self_join' })
    );
    expect(task4ExpressCalls()).toEqual([]);
    expect((seenDb.enrollmentRequests || []).some((r: any) => r.id === request.id)).toBe(true);
  });

  test('approveEnrollmentRequests flips status via updateRequest, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let ok = false;
    await act(async () => {
      ok = await ctx.approveEnrollmentRequests(['req-pending-1']);
    });
    expect(ok).toBe(true);
    expect(updateRequestMock).toHaveBeenCalledWith('req-pending-1', { status: 'approved' });
    expect(task4ExpressCalls()).toEqual([]);
    await waitFor(() => {
      expect(
        (seenDb.enrollmentRequests || []).find((r: any) => r.id === 'req-pending-1')?.status
      ).toBe('approved');
    });
  });

  test('rejectEnrollmentRequests flips status via updateRequest, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let ok = false;
    await act(async () => {
      ok = await ctx.rejectEnrollmentRequests(['req-pending-1']);
    });
    expect(ok).toBe(true);
    expect(updateRequestMock).toHaveBeenCalledWith('req-pending-1', { status: 'rejected' });
    expect(task4ExpressCalls()).toEqual([]);
  });

  test('getPendingRequestsForCourse reads via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let requests: any[] = [];
    await act(async () => {
      requests = await ctx.getPendingRequestsForCourse('c1');
    });
    expect(getRequestsMock).toHaveBeenCalledWith('c1', 'pending');
    expect(task4ExpressCalls()).toEqual([]);
    expect(requests.some((r: any) => r.id === 'req-pending-1')).toBe(true);
  });

  test('removeStudentFromCourse deletes the approved request via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let ok = false;
    await act(async () => {
      ok = await ctx.removeStudentFromCourse('c1', 'u-stud-1');
    });
    expect(ok).toBe(true);
    expect(deleteRequestMock).toHaveBeenCalledWith('req-approved-1');
    expect(task4ExpressCalls()).toEqual([]);
    expect((seenDb.enrollmentRequests || []).some((r: any) => r.id === 'req-approved-1')).toBe(false);
  });

  test('student accepts an invite via updateRequest and loads the course via Likha', async () => {
    await renderLoggedInAs('Student', 'u-stud-1', 'stud1@dmmmsu.edu.ph');
    let ok = false;
    await act(async () => {
      ok = await ctx.studentApproveInvitation('req-invite-1');
    });
    expect(ok).toBe(true);
    expect(updateRequestMock).toHaveBeenCalledWith('req-invite-1', { status: 'approved' });
    expect(getCourseMock).toHaveBeenCalledWith('c1');
    expect(task4ExpressCalls()).toEqual([]);
  });

  test('student declines an invite via deleteRequest, never Express', async () => {
    await renderLoggedInAs('Student', 'u-stud-1', 'stud1@dmmmsu.edu.ph');
    let ok = false;
    await act(async () => {
      ok = await ctx.studentDeclineInvitation('req-invite-1');
    });
    expect(ok).toBe(true);
    expect(deleteRequestMock).toHaveBeenCalledWith('req-invite-1');
    expect(task4ExpressCalls()).toEqual([]);
    expect((seenDb.enrollmentRequests || []).some((r: any) => r.id === 'req-invite-1')).toBe(false);
  });

  test('student picks a section via createRequest and refreshes sections via Likha', async () => {
    await renderLoggedInAs('Student', 'u-stud-1', 'stud1@dmmmsu.edu.ph');
    const sectionsBefore = getSectionsMock.mock.calls.length;
    let ok = false;
    await act(async () => {
      ok = await ctx.selectSection('c1', 'sec-1');
    });
    expect(ok).toBe(true);
    expect(createRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: 'c1', student_id: 'u-stud-1', target_section_id: 'sec-1' })
    );
    expect(getSectionsMock.mock.calls.length).toBeGreaterThan(sectionsBefore);
    expect(task4ExpressCalls()).toEqual([]);
  });

  test('student requests a section switch via createRequest, never Express', async () => {
    await renderLoggedInAs('Student', 'u-stud-1', 'stud1@dmmmsu.edu.ph');
    let ok = false;
    await act(async () => {
      ok = await ctx.requestSectionSwitch('c1', 'sec-1');
    });
    expect(ok).toBe(true);
    expect(createRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        course_id: 'c1',
        student_id: 'u-stud-1',
        type: 'section_switch',
        target_section_id: 'sec-1',
        status: 'pending',
      })
    );
    expect(task4ExpressCalls()).toEqual([]);
  });
});
