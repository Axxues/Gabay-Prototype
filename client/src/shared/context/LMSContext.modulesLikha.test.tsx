// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

// Task 5: modules, items, comments write through Likha ERP, never Express.
// Directus-shaped rows, exactly like the live Likha ERP stores them
// (snake_case; write responses echo the stored row).

const moduleRow = {
  id: 'm1',
  course_id: 'c1',
  title: 'Week 1',
  order: 1,
  published: true,
};

const itemRow = {
  id: 'it-1',
  module_id: 'm1',
  title: 'Reading',
  type: 'page',
  content: 'Hello',
  published: true,
  required: false,
};

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

// Module Express paths throw: any surviving /api/*modules* call fails loudly
// (RED when the impl still uses apiFetch, GREEN proof once migrated).
// Deferred content/assessment/files fills belong to other migration tasks
// and still read Express — return empties for those shapes here.
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  if (path.includes('/modules')) throw new Error(`unmocked-module-express: ${path}`);
  if (path.includes('/submissions')) return { submissions: [] };
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
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => [
  { id: 'u-fac-1', first_name: 'Faculty', last_name: 'One', email: 'faculty1@dmmmsu.edu.ph', role: { name: 'Faculty' } },
]);
const getMessagesMock = vi.fn(async () => []);
const getCalendarMock = vi.fn(async () => []);
const getGroupsMock = vi.fn(async () => []);
const getSlotsMock = vi.fn(async () => []);
const getSectionsMock = vi.fn(async () => [{ ...sectionRow }]);
const getRequestsMock = vi.fn(async () => []);
const invalidateCacheMock = vi.fn();
const getModulesWithItemsMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? [{ ...moduleRow, items: [{ ...itemRow }] }] : []
);
const createModuleMock = vi.fn(async (payload: any) => ({ id: 'm-new', order: 2, published: true, ...payload }));
const updateModuleMock = vi.fn(async (id: string, updates: any) => ({ id, ...updates }));
const deleteModuleMock = vi.fn(async () => ({}));
const createModuleItemMock = vi.fn(async (payload: any) => ({
  id: 'it-new',
  published: true,
  required: false,
  ...payload,
}));
const updateModuleItemMock = vi.fn(async (id: string, updates: any) => ({ id, ...updates }));
const deleteModuleItemMock = vi.fn(async () => ({}));
const getCommentsMock = vi.fn(async () => []);
const addCommentMock = vi.fn(async (payload: any) => ({
  id: 'mc-new',
  created_at: '2026-10-15T00:00:00.000Z',
  likes: 0,
  liked_by: [],
  ...payload,
}));

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
    },
    requests: {
      getRequests: (...args: any[]) => (getRequestsMock as any)(...args),
    },
    sections: {
      getSections: (...args: any[]) => (getSectionsMock as any)(...args),
    },
    modules: {
      getModulesWithItems: (...args: any[]) => (getModulesWithItemsMock as any)(...args),
      createModule: (...args: any[]) => (createModuleMock as any)(...args),
      updateModule: (...args: any[]) => (updateModuleMock as any)(...args),
      deleteModule: (...args: any[]) => (deleteModuleMock as any)(...args),
      createModuleItem: (...args: any[]) => (createModuleItemMock as any)(...args),
      updateModuleItem: (...args: any[]) => (updateModuleItemMock as any)(...args),
      deleteModuleItem: (...args: any[]) => (deleteModuleItemMock as any)(...args),
      getComments: (...args: any[]) => (getCommentsMock as any)(...args),
      addComment: (...args: any[]) => (addCommentMock as any)(...args),
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
    expect((seenDb.modules || []).some((m: any) => m.id === 'm1')).toBe(true);
  });
  // Action-focused tests clear the login/bootstrap history so the "never
  // Express" assertions pin only the action under test.
  apiFetchMock.mockClear();
}

// Task-5-owned Express paths: bootstrap + CRUD + comments under /modules.
const moduleExpressCalls = () =>
  (apiFetchMock.mock.calls as any[][])
    .map(([p]) => String(p))
    .filter(p => p.includes('/modules'));

describe('modules, items, comments via Likha (Task 5)', () => {
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

  test('createModule writes through Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let created: any = null;
    await act(async () => {
      created = await ctx.createModule('c1', 'Week 1');
    });
    expect(createModuleMock).toHaveBeenCalledTimes(1);
    expect(createModuleMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: 'c1', title: 'Week 1' })
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/'), expect.anything());
    expect(moduleExpressCalls()).toEqual([]);
    expect(created.id).toBe('m-new');
    expect((seenDb.modules || []).some((m: any) => m.id === 'm-new' && m.title === 'Week 1')).toBe(true);
  });

  test('bootstrap hydrates modules with items via Likha, never Express', async () => {
    loginRoleName = 'Faculty';
    loginUserId = 'u-fac-1';
    loginEmail = 'faculty1@dmmmsu.edu.ph';
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      await ctx.login('faculty1@dmmmsu.edu.ph', 'pw');
    });
    await waitFor(() => {
      expect((seenDb.modules || []).some((m: any) => m.id === 'm1')).toBe(true);
    });
    expect(getModulesWithItemsMock).toHaveBeenCalledWith('c1');
    expect(moduleExpressCalls()).toEqual([]);
    const mod = (seenDb.modules || []).find((m: any) => m.id === 'm1');
    expect(mod.courseId).toBe('c1');
    expect(mod.title).toBe('Week 1');
    expect((mod.items || []).some((it: any) => it.id === 'it-1' && it.title === 'Reading')).toBe(true);
  });

  test('updateModule patches via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.updateModule('m1', { title: 'Week 1 revised' });
    });
    expect(updateModuleMock).toHaveBeenCalledWith('m1', expect.objectContaining({ title: 'Week 1 revised' }));
    expect(moduleExpressCalls()).toEqual([]);
    expect((seenDb.modules || []).find((m: any) => m.id === 'm1')?.title).toBe('Week 1 revised');
  });

  test('deleteModule deletes via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.deleteModule('m1');
    });
    expect(deleteModuleMock).toHaveBeenCalledWith('m1');
    expect(moduleExpressCalls()).toEqual([]);
    expect((seenDb.modules || []).some((m: any) => m.id === 'm1')).toBe(false);
  });

  test('addModuleItem writes through Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.addModuleItem('m1', {
        title: 'Lecture video',
        type: 'file',
        fileUrl: 'https://cdn.example/v.mp4',
        activityId: 'a1',
      });
    });
    expect(createModuleItemMock).toHaveBeenCalledTimes(1);
    expect(createModuleItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        module_id: 'm1',
        title: 'Lecture video',
        type: 'file',
        file_url: 'https://cdn.example/v.mp4',
        activity_id: 'a1',
      })
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/'), expect.anything());
    expect(moduleExpressCalls()).toEqual([]);
    const mod = (seenDb.modules || []).find((m: any) => m.id === 'm1');
    expect((mod.items || []).some((it: any) => it.id === 'it-new' && it.title === 'Lecture video')).toBe(true);
  });

  test('updateModuleItem patches via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.updateModuleItem('m1', 'it-1', { title: 'Reading v2' });
    });
    expect(updateModuleItemMock).toHaveBeenCalledWith('it-1', expect.objectContaining({ title: 'Reading v2' }));
    expect(moduleExpressCalls()).toEqual([]);
    const mod = (seenDb.modules || []).find((m: any) => m.id === 'm1');
    expect((mod.items || []).find((it: any) => it.id === 'it-1')?.title).toBe('Reading v2');
  });

  test('updateModuleItem moves across modules via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    let second: any = null;
    await act(async () => {
      second = await ctx.createModule('c1', 'Week 2');
    });
    await act(async () => {
      await ctx.updateModuleItem('m1', 'it-1', { title: 'Reading' }, second.id);
    });
    expect(updateModuleItemMock).toHaveBeenCalledWith('it-1', expect.objectContaining({ module_id: second.id }));
    expect(moduleExpressCalls()).toEqual([]);
    const src = (seenDb.modules || []).find((m: any) => m.id === 'm1');
    const dest = (seenDb.modules || []).find((m: any) => m.id === second.id);
    expect((src.items || []).some((it: any) => it.id === 'it-1')).toBe(false);
    expect((dest.items || []).some((it: any) => it.id === 'it-1')).toBe(true);
  });

  test('deleteModuleItem deletes via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.deleteModuleItem('m1', 'it-1');
    });
    expect(deleteModuleItemMock).toHaveBeenCalledWith('it-1');
    expect(moduleExpressCalls()).toEqual([]);
    const mod = (seenDb.modules || []).find((m: any) => m.id === 'm1');
    expect((mod.items || []).some((it: any) => it.id === 'it-1')).toBe(false);
  });

  test('toggleModulePublish flips via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.toggleModulePublish('m1');
    });
    expect(updateModuleMock).toHaveBeenCalledWith('m1', { published: false });
    expect(moduleExpressCalls()).toEqual([]);
    expect((seenDb.modules || []).find((m: any) => m.id === 'm1')?.published).toBe(false);
  });

  test('toggleItemCompletion flips via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.toggleItemCompletion('m1', 'it-1');
    });
    expect(updateModuleItemMock).toHaveBeenCalledWith('it-1', expect.objectContaining({ completed: true }));
    expect(moduleExpressCalls()).toEqual([]);
    const mod = (seenDb.modules || []).find((m: any) => m.id === 'm1');
    expect((mod.items || []).find((it: any) => it.id === 'it-1')?.completed).toBe(true);
  });

  test('addModuleComment posts via Likha, never Express', async () => {
    await renderLoggedInAs('Faculty', 'u-fac-1', 'faculty1@dmmmsu.edu.ph');
    await act(async () => {
      await ctx.addModuleComment('m1', 'Great week!');
    });
    expect(addCommentMock).toHaveBeenCalledTimes(1);
    expect(addCommentMock).toHaveBeenCalledWith(
      expect.objectContaining({ module_id: 'm1', content: 'Great week!' })
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/'), expect.anything());
    expect(moduleExpressCalls()).toEqual([]);
    const mod = (seenDb.modules || []).find((m: any) => m.id === 'm1');
    expect((mod.comments || []).some((c: any) => c.id === 'mc-new' && c.content === 'Great week!')).toBe(true);
  });
});
