// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

// Task 7: grades + SPR read/write through Likha ERP, never Express.
// Directus-shaped rows, exactly like the live Likha ERP stores them
// (snake_case; course_grades rows carry the expanded spr_cells relation,
// spr_configs rows carry snake_case columns).

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

const gradeRow = {
  id: 'cg-c1-u-stud-1',
  course_id: 'c1',
  student_id: 'u-stud-1',
  midterm_grade: 88.5,
  final_grade: null,
  updated_at: '2026-10-15T00:00:00.000Z',
  spr_cells: [
    {
      id: 'spr-cg-c1-u-stud-1-col-mt-1',
      course_grade_id: 'cg-c1-u-stud-1',
      student_id: 'u-stud-1',
      task_id: 'col-mt-1',
      score: 45,
    },
    {
      id: 'spr-cg-c1-u-stud-1-__mtExam',
      course_grade_id: 'cg-c1-u-stud-1',
      student_id: 'u-stud-1',
      task_id: '__mtExam',
      score: 88,
    },
  ],
};

const sprConfigRow = {
  id: 'sprcfg-c1',
  course_id: 'c1',
  midterm_columns: [{ id: 'col-mt-1', title: 'Quiz 1', perfectScore: 50 }],
  final_columns: [],
  mt_exam_perfect: 100,
  ft_exam_perfect: 100,
};

// Task-owned Express paths throw: any surviving /api/courses/*/grades or
// /api/courses/*/spr call fails loudly (RED while the impl still uses
// apiFetch, GREEN proof once migrated). Other tasks' Express paths return
// empties (announcements/discussions belong to Task 8, folders/files to
// Task 9 and still read Express here).
const apiFetchMock = vi.fn(async (path: string, _options?: any) => {
  if (/\/api\/courses\/.+\/(grades|spr)/.test(path)) throw new Error(`unmocked-grades-spr-express: ${path}`);
  if (path.includes('/announcements')) return { announcements: [] };
  if (path.includes('/discussions')) return { discussions: [] };
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
const getModulesWithItemsMock = vi.fn(async () => []);
const getQuizzesMock = vi.fn(async () => []);
const getExamsMock = vi.fn(async () => []);
const getActivitiesMock = vi.fn(async () => []);
const getSubmissionsMock = vi.fn(async () => []);
const invalidateCacheMock = vi.fn();
const getCourseGradesMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? [{ ...gradeRow, spr_cells: gradeRow.spr_cells.map(c => ({ ...c })) }] : []
);
const getSPRConfigMock = vi.fn(async (courseId: string) =>
  courseId === 'c1'
    ? { ...sprConfigRow, midterm_columns: sprConfigRow.midterm_columns.map(c => ({ ...c })), final_columns: [] }
    : null
);
const saveGradeWithCellsMock = vi.fn(async () => ({ id: 'cg-c1-u-stud-1' }));
const saveSPRConfigMock = vi.fn(async (courseId: string, config: any) => ({
  id: 'sprcfg-c1',
  course_id: courseId,
  midterm_columns: config.midtermColumns ?? [],
  final_columns: config.finalColumns ?? [],
  mt_exam_perfect: config.mtExamPerfect ?? 100,
  ft_exam_perfect: config.ftExamPerfect ?? 100,
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
    },
    assessments: {
      getQuizzes: (...args: any[]) => (getQuizzesMock as any)(...args),
      getExams: (...args: any[]) => (getExamsMock as any)(...args),
      getActivities: (...args: any[]) => (getActivitiesMock as any)(...args),
    },
    submissions: {
      getSubmissions: (...args: any[]) => (getSubmissionsMock as any)(...args),
    },
    grades: {
      getCourseGrades: (...args: any[]) => (getCourseGradesMock as any)(...args),
      saveGradeWithCells: (...args: any[]) => (saveGradeWithCellsMock as any)(...args),
      getSPRConfig: (...args: any[]) => (getSPRConfigMock as any)(...args),
      saveSPRConfig: (...args: any[]) => (saveSPRConfigMock as any)(...args),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let ctx: any = null;
let seenDb: any = null;
let doLogin: (() => Promise<any>) | null = null;

const Probe: React.FC = () => {
  const v = useLMS();
  ctx = v as any;
  seenDb = v.db as any;
  doLogin = () => (v as any).login('faculty1@dmmmsu.edu.ph', 'pw');
  return null;
};

async function renderLoggedIn() {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await doLogin!();
  });
  await waitFor(() => {
    expect((seenDb.courses || []).some((c: any) => c.id === 'c1')).toBe(true);
  });
  await waitFor(() => {
    expect((seenDb.courseGrades || []).some((g: any) => g.courseId === 'c1' && g.studentId === 'u-stud-1')).toBe(true);
  });
  // Action-focused tests clear the login/bootstrap history so the "never
  // Express" assertions pin only the action under test.
  apiFetchMock.mockClear();
  saveGradeWithCellsMock.mockClear();
  saveSPRConfigMock.mockClear();
}

// Task-7-owned Express paths (grades-release excluded: Task 6 pins it on
// Express with a likha-gap mark, and no test here drives it).
const gradesSprExpressCalls = () =>
  (apiFetchMock.mock.calls as any[][]).filter(([p]) => /\/api\/courses\/.+\/(grades|spr)/.test(String(p)));

describe('grades and SPR via Likha (Task 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx = null;
    seenDb = null;
    doLogin = null;
    loginRoleName = 'Faculty';
    loginUserId = 'u-fac-1';
    loginEmail = 'faculty1@dmmmsu.edu.ph';
    try {
      localStorage.clear();
    } catch {}
  });

  test('gradebook bootstrap reads through Likha, never Express', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      await doLogin!();
    });
    await waitFor(() => {
      expect(getCourseGradesMock).toHaveBeenCalled();
    });
    const expressCalls = (apiFetchMock.mock.calls as any[][]).filter(([p]) => /\/api\/courses\/.+\/(grades|spr)/.test(String(p)));
    expect(expressCalls).toEqual([]);
  });

  test('bootstrap hydrates grades, SPR cells, and config into the cache', async () => {
    await renderLoggedIn();
    expect(getCourseGradesMock).toHaveBeenCalledWith('c1');
    expect(getSPRConfigMock).toHaveBeenCalledWith('c1');
    expect(gradesSprExpressCalls()).toEqual([]);
    const grade = (seenDb.courseGrades || []).find((g: any) => g.courseId === 'c1' && g.studentId === 'u-stud-1');
    expect(grade?.midtermGrade).toBe(88.5);
    const cells = seenDb.sprScores?.c1?.['u-stud-1'];
    expect(cells?.midterm?.['col-mt-1']).toBe(45);
    expect(cells?.mtExam).toBe(88);
    const config = seenDb.sprConfigs?.c1;
    expect(config?.midtermColumns?.some((c: any) => c.id === 'col-mt-1' && c.title === 'Quiz 1')).toBe(true);
    expect(config?.mtExamPerfect).toBe(100);
  });

  test('saveSPRConfig persists via Likha, never Express', async () => {
    await renderLoggedIn();
    const next = {
      midtermColumns: [{ id: 'col-mt-2', title: 'Activity 1', perfectScore: 100 }],
      finalColumns: [],
      mtExamPerfect: 100,
      ftExamPerfect: 100,
    };
    await act(async () => {
      await ctx.saveSPRConfig('c1', next);
    });
    expect(saveSPRConfigMock).toHaveBeenCalledWith('c1', next);
    expect(gradesSprExpressCalls()).toEqual([]);
    const config = seenDb.sprConfigs?.c1;
    expect(config?.midtermColumns?.some((c: any) => c.id === 'col-mt-2')).toBe(true);
  });

  test('setSPRCell persists the cell via saveGradeWithCells, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.setSPRCell('c1', 'u-stud-1', 'midterm', 'col-mt-1', 47);
    });
    expect(saveGradeWithCellsMock).toHaveBeenCalledWith('c1', 'u-stud-1', [{ task_id: 'col-mt-1', score: 47 }]);
    expect(gradesSprExpressCalls()).toEqual([]);
    expect(seenDb.sprScores?.c1?.['u-stud-1']?.midterm?.['col-mt-1']).toBe(47);
    const grade = (seenDb.courseGrades || []).find((g: any) => g.courseId === 'c1' && g.studentId === 'u-stud-1');
    expect(typeof grade?.midtermGrade).toBe('number');
  });

  test('resetSPRCell drops the cell locally with no Express call', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.setSPRCell('c1', 'u-stud-1', 'midterm', 'col-mt-1', null);
    });
    // A reset has no Likha delete path in grades.* — no cell payload goes
    // out; the cache drops the entry. The only Likha calls are the two
    // recomputeAndSyncSPR row-ensures (midterm + final via
    // setCourseStudentGrade), pinning the staleness contract: the stale
    // spr_cells row persists server-side and reappears on reload.
    expect(saveGradeWithCellsMock.mock.calls).toEqual([
      ['c1', 'u-stud-1', []],
      ['c1', 'u-stud-1', []],
    ]);
    expect(gradesSprExpressCalls()).toEqual([]);
    expect(seenDb.sprScores?.c1?.['u-stud-1']?.midterm?.['col-mt-1']).toBeUndefined();
  });

  test('setCourseStudentGrade ensures the Likha grade row, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.setCourseStudentGrade('c1', 'u-stud-9', 'midterm', 91);
    });
    expect(saveGradeWithCellsMock).toHaveBeenCalledWith('c1', 'u-stud-9', []);
    expect(gradesSprExpressCalls()).toEqual([]);
    const grade = (seenDb.courseGrades || []).find((g: any) => g.courseId === 'c1' && g.studentId === 'u-stud-9');
    expect(grade?.midtermGrade).toBe(91);
  });
});
