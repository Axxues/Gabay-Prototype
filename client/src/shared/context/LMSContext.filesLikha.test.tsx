// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

// Task 9: files, folders, uploads read/write through Likha ERP, never Express.
// Directus-shaped rows, exactly like the live Likha ERP stores them (snake_case).

const TS = '2026-10-15T00:00:00.000Z';

const courseRow = {
  id: 'c1',
  code: 'CMSC 180',
  title: 'Data Structures',
  instructor_id: 'u-fac-1',
  published: true,
  join_code: 'CMSC-AB12',
  enrolledCount: 0,
};

const folderRow = {
  id: 'fld-1',
  course_id: 'c1',
  parent_id: null,
  name: 'Lectures',
  date_updated: TS,
};

const fileRow = {
  id: 'file-1',
  course_id: 'c1',
  folder_id: 'fld-1',
  name: 'Week1.pdf',
  size: 1048576,
  formatted_size: '1 MB',
  type: 'pdf',
  visibility: 'published',
  date_updated: TS,
  uploaded_by: 'u-fac-1',
  uploaded_by_name: 'Fac One',
  url: 'https://gabay.zyberlab.com/assets/asset-1',
};

// Task-9-owned Express paths throw: any surviving call on a migrated path fails loudly.
const apiFetchMock = vi.fn(async (path: string, options?: any) => {
  const method = (options as any)?.method ?? 'GET';
  if (/\/api\/courses\/.+\/folders/.test(path)) throw new Error(`unmocked-course-folders-express: ${path} ${method}`);
  if (/\/api\/courses\/.+\/files(\/upload)?/.test(path)) throw new Error(`unmocked-course-files-express: ${path} ${method}`);
  if (/\/api\/folders\/.+/.test(path)) throw new Error(`unmocked-folder-express: ${path} ${method}`);
  if (/\/api\/files\/.+/.test(path)) throw new Error(`unmocked-file-express: ${path} ${method}`);
  if (path.includes('/announcements')) return { announcements: [] };
  if (path.includes('/discussions')) return { discussions: [] };
  if (path.includes('/messages')) return { messages: [] };
  if (path.includes('/grades')) return { grades: [] };
  if (path.includes('/spr')) return { config: null };
  if (path.includes('/submissions')) return { submissions: [] };
  if (path.includes('/quizzes')) return { quizzes: [] };
  if (path.includes('/exams')) return { exams: [] };
  if (path.includes('/activities')) return { activities: [] };
  if (path.includes('/modules')) return { modules: [] };
  throw new Error(`unmocked: ${path} ${method}`);
});

let seedFolders: any[] = [];
let seedFiles: any[] = [];

const loginLikhaMock = vi.fn(async () => ({
  token: 't-likha',
  user: {
    id: 'u-fac-1',
    first_name: 'Fac',
    last_name: 'One',
    email: 'faculty1@dmmmsu.edu.ph',
    role: { name: 'Faculty' },
  },
}));
const getCoursesWithRelationsMock = vi.fn(async () => [{ ...courseRow }]);
const getCoursesMock = vi.fn(async () => [{ ...courseRow }]);
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => [
  { id: 'u-fac-1', first_name: 'Fac', last_name: 'One', email: 'faculty1@dmmmsu.edu.ph', role: { name: 'Faculty' } },
]);
const getMessagesMock = vi.fn(async () => []);
const getCalendarMock = vi.fn(async () => []);
const getGroupsMock = vi.fn(async () => []);
const getSlotsMock = vi.fn(async () => []);
const getSectionsMock = vi.fn(async () => []);
const getRequestsMock = vi.fn(async () => []);
const getModulesWithItemsMock = vi.fn(async () => []);
const getQuizzesMock = vi.fn(async () => []);
const getExamsMock = vi.fn(async () => []);
const getActivitiesMock = vi.fn(async () => []);
const getSubmissionsMock = vi.fn(async () => []);
const getCourseGradesMock = vi.fn(async () => []);
const getSPRConfigMock = vi.fn(async () => null);
const getAnnouncementsMock = vi.fn(async () => []);
const getDiscussionsMock = vi.fn(async () => []);

const getCourseFoldersMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? seedFolders.map(f => ({ ...f })) : []
);
const getCourseFilesMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? seedFiles.map(f => ({ ...f })) : []
);
const createCourseFolderMock = vi.fn(async (data: any) => ({
  id: 'fld-new',
  date_updated: TS,
  ...data,
}));
const deleteCourseFolderMock = vi.fn(async () => ({}));
const createCourseFileMock = vi.fn(async (data: any) => ({
  id: 'file-new',
  date_updated: TS,
  ...data,
}));
const updateCourseFileMock = vi.fn(async (id: string, patch: any) => ({
  id,
  ...patch,
}));
const deleteCourseFileMock = vi.fn(async () => ({}));
const clearSourceDocMock = vi.fn(async () => ({}));
const updateModuleItemMock = vi.fn(async () => ({}));
const uploadFileMock = vi.fn(async (file: File) => ({
  id: 'asset-uploaded',
  filename_download: file.name,
  url: `https://gabay.zyberlab.com/assets/asset-uploaded`,
}));

const saveActivityMock = vi.fn(async (act: any) => act);

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status = 500;
    code = 'request_failed';
  },
  getToken: () => 't-mock',
  setToken: vi.fn(),
  clearToken: vi.fn(),
  apiFetch: (...args: any[]) => (apiFetchMock as any)(...args),
  likhaLmsApi: {
    loginLikhaUser: (...args: any[]) => (loginLikhaMock as any)(...args),
    getCoursesWithRelations: (...args: any[]) => (getCoursesWithRelationsMock as any)(...args),
    getNotifications: (...args: any[]) => (getNotifsMock as any)(...args),
    uploadFile: (...args: any[]) => (uploadFileMock as any)(...args),
    saveActivity: (...args: any[]) => (saveActivityMock as any)(...args),
    users: {
      getUsers: (...args: any[]) => (getUsersMock as any)(...args),
    },
    communications: {
      getMessages: (...args: any[]) => (getMessagesMock as any)(...args),
      getCalendarEvents: (...args: any[]) => (getCalendarMock as any)(...args),
      getChatGroups: (...args: any[]) => (getGroupsMock as any)(...args),
      getAdvisingSlots: (...args: any[]) => (getSlotsMock as any)(...args),
      getAnnouncements: (...args: any[]) => (getAnnouncementsMock as any)(...args),
      getDiscussions: (...args: any[]) => (getDiscussionsMock as any)(...args),
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
      updateModuleItem: (...args: any[]) => (updateModuleItemMock as any)(...args),
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
      getSPRConfig: (...args: any[]) => (getSPRConfigMock as any)(...args),
    },
    syllabus: {
      clearSourceDocument: (...args: any[]) => (clearSourceDocMock as any)(...args),
    },
    files: {
      uploadFile: (...args: any[]) => (uploadFileMock as any)(...args),
    saveActivity: (...args: any[]) => (saveActivityMock as any)(...args),
      getCourseFiles: (...args: any[]) => (getCourseFilesMock as any)(...args),
      createCourseFile: (...args: any[]) => (createCourseFileMock as any)(...args),
      updateCourseFile: (...args: any[]) => (updateCourseFileMock as any)(...args),
      deleteCourseFile: (...args: any[]) => (deleteCourseFileMock as any)(...args),
      getCourseFolders: (...args: any[]) => (getCourseFoldersMock as any)(...args),
      createCourseFolder: (...args: any[]) => (createCourseFolderMock as any)(...args),
      deleteCourseFolder: (...args: any[]) => (deleteCourseFolderMock as any)(...args),
    },
  },
}));

import { LMSProvider, useLMS } from './LMSContext';

let ctx: any = null;
let seenDb: any = null;

function Probe() {
  const current = useLMS();
  ctx = current;
  seenDb = current.db;
  return null;
}

async function renderLoggedIn() {
  render(
    <LMSProvider>
      <Probe />
    </LMSProvider>
  );
  await act(async () => {
    await ctx.login('faculty1@dmmmsu.edu.ph', 'pw');
  });
  await waitFor(() => {
    expect((seenDb.courses || []).some((c: any) => c.id === 'c1')).toBe(true);
  });
  apiFetchMock.mockClear();
}

const fileExpressCalls = () =>
  (apiFetchMock.mock.calls as any[][])
    .map(([p]) => String(p))
    .filter(p => /\/api\/(courses\/.+\/(folders|files)|files|folders)/.test(p));

describe('files and folders via Likha (Task 9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx = null;
    seenDb = null;
    seedFolders = [{ ...folderRow }];
    seedFiles = [{ ...fileRow }];
    try {
      localStorage.clear();
    } catch {}
  });

  test('file listing reads through Likha, never Express', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      await ctx.login('faculty1@dmmmsu.edu.ph', 'pw');
    });
    await waitFor(() => {
      expect(getCourseFilesMock).toHaveBeenCalledWith('c1');
    });
    expect(getCourseFoldersMock).toHaveBeenCalledWith('c1');
    expect(fileExpressCalls()).toEqual([]);
    expect((seenDb.courseFolders || []).some((f: any) => f.id === 'fld-1')).toBe(true);
    expect((seenDb.courseFiles || []).some((f: any) => f.id === 'file-1')).toBe(true);
  });

  test('createCourseFolder writes through Likha, never Express', async () => {
    await renderLoggedIn();
    let folder: any = null;
    await act(async () => {
      folder = await ctx.createCourseFolder('c1', 'Assignments', null, 'assignments');
    });
    expect(createCourseFolderMock).toHaveBeenCalledTimes(1);
    expect(createCourseFolderMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: 'c1', name: 'Assignments' })
    );
    expect(fileExpressCalls()).toEqual([]);
    expect(folder.id).toBe('fld-new');
    expect((seenDb.courseFolders || []).some((f: any) => f.id === 'fld-new')).toBe(true);
  });

  test('deleteCourseFolder deletes via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.deleteCourseFolder('fld-1');
    });
    expect(deleteCourseFolderMock).toHaveBeenCalledWith('fld-1');
    expect(fileExpressCalls()).toEqual([]);
    expect((seenDb.courseFolders || []).some((f: any) => f.id === 'fld-1')).toBe(false);
  });

  test('uploadCourseFile metadata-only writes through Likha, never Express', async () => {
    await renderLoggedIn();
    let created: any = null;
    await act(async () => {
      created = await ctx.uploadCourseFile({
        courseId: 'c1',
        name: 'Notes.md',
        content: '# Notes',
        folderId: 'fld-1',
        type: 'document',
      });
    });
    expect(createCourseFileMock).toHaveBeenCalledTimes(1);
    expect(createCourseFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: 'c1', name: 'Notes.md', folder_id: 'fld-1' })
    );
    expect(fileExpressCalls()).toEqual([]);
    expect(created.id).toBe('file-new');
    expect((seenDb.courseFiles || []).some((f: any) => f.id === 'file-new')).toBe(true);
  });

  test('uploadCourseFile with rawFile uploads file to Likha and creates CourseFile, never Express', async () => {
    await renderLoggedIn();
    const fakeBlob = new Blob(['hello world'], { type: 'application/pdf' });
    const fakeFile = new File([fakeBlob], 'Syllabus.pdf', { type: 'application/pdf' });
    let created: any = null;
    await act(async () => {
      created = await ctx.uploadCourseFile({
        courseId: 'c1',
        name: 'Syllabus.pdf',
        rawFile: fakeFile,
        folderId: 'fld-1',
      });
    });
    expect(uploadFileMock).toHaveBeenCalledTimes(1);
    expect(createCourseFileMock).toHaveBeenCalledTimes(1);
    expect(createCourseFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        course_id: 'c1',
        name: 'Syllabus.pdf',
        file: 'asset-uploaded',
        url: 'https://gabay.zyberlab.com/assets/asset-uploaded',
      })
    );
    expect(fileExpressCalls()).toEqual([]);
    expect(created.id).toBe('file-new');
    expect(created.size).toBe(11);
    expect(created.formattedSize).toBe('11 B');
    expect((seenDb.courseFiles || []).some((f: any) => f.id === 'file-new')).toBe(true);
  });

  test('deleteCourseFile deletes via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.deleteCourseFile('file-1');
    });
    expect(deleteCourseFileMock).toHaveBeenCalledWith('file-1');
    expect(fileExpressCalls()).toEqual([]);
    expect((seenDb.courseFiles || []).some((f: any) => f.id === 'file-1')).toBe(false);
  });

  test('updateFileVisibility patches via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.updateFileVisibility('file-1', 'restricted');
    });
    expect(updateCourseFileMock).toHaveBeenCalledWith('file-1', { visibility: 'restricted' });
    expect(fileExpressCalls()).toEqual([]);
    expect((seenDb.courseFiles || []).find((f: any) => f.id === 'file-1')?.visibility).toBe('restricted');
  });

  test('renameCourseFile patches via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.renameCourseFile('file-1', 'Week1_Updated.pdf');
    });
    expect(updateCourseFileMock).toHaveBeenCalledWith('file-1', { name: 'Week1_Updated.pdf' });
    expect(fileExpressCalls()).toEqual([]);
    expect((seenDb.courseFiles || []).find((f: any) => f.id === 'file-1')?.name).toBe('Week1_Updated.pdf');
  });

  test('deleteCourseFile with virtual syllabus file clears course sourceDocument without calling Likha files delete', async () => {
    getCoursesWithRelationsMock.mockResolvedValueOnce([
      {
        ...courseRow,
        syllabus: {
          sourceDocument: { fileName: 'CMSC180_Syllabus.pdf', fileSize: '1.2 MB' },
        },
      },
    ]);
    await renderLoggedIn();
    expect((seenDb.courses || []).find((c: any) => c.id === 'c1')?.syllabus?.sourceDocument).toBeDefined();

    await act(async () => {
      await ctx.deleteCourseFile('syl-file-c1');
    });

    expect(deleteCourseFileMock).not.toHaveBeenCalled();
    expect((seenDb.courses || []).find((c: any) => c.id === 'c1')?.syllabus?.sourceDocument).toBeUndefined();
  });

  test('deleteCourseFile with physical syllabus file clears sourceDocument and calls clearSourceDocument on Likha', async () => {
    clearSourceDocMock.mockClear();

    getCoursesWithRelationsMock.mockResolvedValueOnce([
      {
        ...courseRow,
        syllabus: {
          sourceDocument: { fileName: 'CMSC131_Course_Orientation.pdf', fileSize: '1.0 MB', courseFileId: 'file-syl-1' },
        },
      },
    ]);
    seedFiles = [
      {
        id: 'file-syl-1',
        course_id: 'c1',
        name: 'CMSC131_Course_Orientation.pdf',
        source_area: 'syllabus',
        size: 1048576,
        formatted_size: '1.0 MB',
        type: 'pdf',
        visibility: 'published',
        date_updated: TS,
      },
    ];

    await renderLoggedIn();
    expect((seenDb.courseFiles || []).find((f: any) => f.id === 'file-syl-1')).toBeDefined();
    expect((seenDb.courses || []).find((c: any) => c.id === 'c1')?.syllabus?.sourceDocument).toBeDefined();

    await act(async () => {
      await ctx.deleteCourseFile('file-syl-1');
    });

    expect(deleteCourseFileMock).toHaveBeenCalledWith('file-syl-1');
    expect(clearSourceDocMock).toHaveBeenCalledWith('c1');
    expect((seenDb.courseFiles || []).find((f: any) => f.id === 'file-syl-1')).toBeUndefined();
    expect((seenDb.courses || []).find((c: any) => c.id === 'c1')?.syllabus?.sourceDocument).toBeUndefined();
  });

  test('deleteCourseFile deletes duplicate records with matching name in same course/area and unlinks from activities', async () => {
    deleteCourseFileMock.mockClear();
    saveActivityMock.mockClear();

    seedFiles = [
      {
        id: 'dup-1',
        course_id: 'c1',
        name: 'Diagram.png',
        source_area: 'activities',
        size: 1000,
        formatted_size: '1 KB',
        type: 'image',
        visibility: 'published',
        date_updated: TS,
      },
      {
        id: 'dup-2',
        course_id: 'c1',
        name: 'Diagram.png',
        source_area: 'activities',
        size: 1000,
        formatted_size: '1 KB',
        type: 'image',
        visibility: 'published',
        date_updated: TS,
      },
    ];

    getActivitiesMock.mockResolvedValueOnce([
      {
        id: 'act-1',
        course_id: 'c1',
        title: 'Activity 1',
        term: 'midterm',
        file_name: 'Diagram.png',
        attachments: [{ name: 'Diagram.png', url: '/likha/assets/diagram' }],
      },
    ]);

    await renderLoggedIn();
    expect((seenDb.courseFiles || []).filter((f: any) => f.name === 'Diagram.png')).toHaveLength(2);
    expect((seenDb.activities || []).find((a: any) => a.id === 'act-1')?.attachments).toHaveLength(1);

    await act(async () => {
      await ctx.deleteCourseFile('dup-1');
    });

    expect(deleteCourseFileMock).toHaveBeenCalledWith('dup-1');
    expect(deleteCourseFileMock).toHaveBeenCalledWith('dup-2');
    expect((seenDb.courseFiles || []).filter((f: any) => f.name === 'Diagram.png')).toHaveLength(0);
    const updatedAct = (seenDb.activities || []).find((a: any) => a.id === 'act-1');
    expect(updatedAct?.attachments).toHaveLength(0);
    expect(updatedAct?.fileName).toBeUndefined();
    expect(saveActivityMock).toHaveBeenCalled();
  });

  test('deleteCourseFile with virtual act-file removes attachment from activity and saves', async () => {
    saveActivityMock.mockClear();

    getActivitiesMock.mockResolvedValueOnce([
      {
        id: 'act-2',
        course_id: 'c1',
        title: 'Activity 2',
        term: 'midterm',
        attachments: [
          { name: 'Handout.pdf', url: '/likha/assets/handout' },
          { name: 'Extra.pdf', url: '/likha/assets/extra' },
        ],
      },
    ]);

    await renderLoggedIn();
    expect((seenDb.activities || []).find((a: any) => a.id === 'act-2')?.attachments).toHaveLength(2);

    await act(async () => {
      await ctx.deleteCourseFile('act-file-act-2-0');
    });

    const updatedAct = (seenDb.activities || []).find((a: any) => a.id === 'act-2');
    expect(updatedAct?.attachments).toHaveLength(1);
    expect(updatedAct?.attachments[0].name).toBe('Extra.pdf');
    expect(saveActivityMock).toHaveBeenCalled();
  });

  test('deleteCourseFile for an activity file never deletes or strips attachments from module items', async () => {
    updateModuleItemMock.mockClear();

    seedFiles = [
      {
        id: 'cf-act-1',
        course_id: 'c1',
        name: 'SharedResource.pdf',
        source_area: 'activities',
        source_id: 'act-99',
      },
    ];

    getModulesWithItemsMock.mockResolvedValueOnce([
      {
        id: 'mod-1',
        course_id: 'c1',
        title: 'Module 1',
        items: [
          {
            id: 'item-1',
            title: 'Lecture 1',
            type: 'page',
            file_name: 'SharedResource.pdf',
            attachments: [
              { name: 'SharedResource.pdf', url: '/likha/assets/shared' },
            ],
          },
        ],
      },
    ]);

    await renderLoggedIn();

    const lectureItem = (seenDb.modules || [])[0]?.items?.[0];
    expect(lectureItem?.attachments).toHaveLength(1);

    await act(async () => {
      await ctx.deleteCourseFile('cf-act-1');
    });

    expect(deleteCourseFileMock).toHaveBeenCalledWith('cf-act-1');
    expect(updateModuleItemMock).not.toHaveBeenCalled();
    const lectureItemAfter = (seenDb.modules || [])[0]?.items?.[0];
    expect(lectureItemAfter?.attachments).toHaveLength(1);
    expect(lectureItemAfter?.attachments[0].name).toBe('SharedResource.pdf');
  });

  test('deleteCourseFile for a module file never deletes or strips attachments from activities', async () => {
    saveActivityMock.mockClear();

    seedFiles = [
      {
        id: 'cf-mod-1',
        course_id: 'c1',
        name: 'SharedResource.pdf',
        source_area: 'modules',
        source_id: 'mod-1',
      },
    ];

    getActivitiesMock.mockResolvedValueOnce([
      {
        id: 'act-1',
        course_id: 'c1',
        title: 'Activity 1',
        term: 'midterm',
        attachments: [
          { name: 'SharedResource.pdf', url: '/likha/assets/shared' },
        ],
      },
    ]);

    await renderLoggedIn();

    const activity = (seenDb.activities || []).find((a: any) => a.id === 'act-1');
    expect(activity?.attachments).toHaveLength(1);

    await act(async () => {
      await ctx.deleteCourseFile('cf-mod-1');
    });

    expect(deleteCourseFileMock).toHaveBeenCalledWith('cf-mod-1');
    expect(saveActivityMock).not.toHaveBeenCalled();
    const activityAfter = (seenDb.activities || []).find((a: any) => a.id === 'act-1');
    expect(activityAfter?.attachments).toHaveLength(1);
    expect(activityAfter?.attachments[0].name).toBe('SharedResource.pdf');
  });
});
