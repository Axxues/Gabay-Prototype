// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  db: null as any,
}));

vi.mock('../context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: { id: 'u-fac-1', name: 'Faculty', role: 'faculty' },
    db: mocks.db,
  }),
}));

import { useCourseFiles } from './useCourseFiles';

beforeEach(() => {
  mocks.db = {
    courseFiles: [],
    courseFolders: [],
    modules: [],
    announcements: [],
    activities: [],
    quizzes: [],
    submissions: [],
  };
});

describe('useCourseFiles assessment-backed entries', () => {
  test('emits no quiz-sourced entries (quizzes save no files)', () => {
    mocks.db.quizzes = [
      {
        id: 'quiz-1',
        courseId: 'c1',
        title: 'Quiz 1 Midterm',
        instructions: 'Answer all.',
        published: true,
        questions: [{ id: 'q1', text: 'Q?', type: 'multiple_choice', options: ['A'], points: 1 }],
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    expect(result.current.allFiles.filter(f => (f as any).source === 'quizzes')).toHaveLength(0);
    expect((result.current.sourceCounts as any).quizzes).toBeUndefined();
  });

  test('lists a question-set activity created via Add module item even with no file attachment', () => {
    mocks.db.activities = [
      {
        id: 'act-1',
        format: 'questionset',
        courseId: 'c1',
        title: 'Activity 1 Midterm',
        instructions: 'Do it.',
        questions: [],
        pointsPossible: 8,
        published: true,
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    const activities = result.current.allFiles.filter(f => f.source === 'activities');
    expect(activities.length).toBeGreaterThan(0);
    expect(result.current.sourceCounts.activities).toBeGreaterThan(0);
  });
});

describe('useCourseFiles module-folder placement', () => {
  beforeEach(() => {
    mocks.db.courseFolders = [
      { id: 'fld-area', courseId: 'c1', parentId: null, name: 'Modules', autoKey: 'area:modules' },
      { id: 'fld-mod-1', courseId: 'c1', parentId: 'fld-area', name: 'Week 1', autoKey: 'module:mod-1' },
    ];
    mocks.db.modules = [
      {
        id: 'mod-1',
        courseId: 'c1',
        title: 'Week 1',
        items: [
          { id: 'item-a', type: 'activity', title: 'Activity 1', activityId: 'asg-activity-act-1', published: true },
        ],
      },
    ];
  });

  test('question-set activity linked via asg-activity-<id> resolves into that module folder', () => {
    mocks.db.activities = [
      {
        id: 'act-1',
        format: 'questionset',
        courseId: 'c1',
        title: 'Activity 1',
        instructions: 'Do it.',
        questions: [],
        pointsPossible: 8,
        published: true,
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    const entry = result.current.allFiles.find(f => f.id === 'act-virtual-act-1');
    expect(entry).toBeDefined();
    expect(entry?.folderId).toBe('fld-mod-1');
  });

  test('classic activity linked from a module item resolves into that module folder', () => {
    mocks.db.modules = [
      {
        id: 'mod-1',
        courseId: 'c1',
        title: 'Week 1',
        items: [{ id: 'item-c', type: 'activity', title: 'Lab 1', activityId: 'asg-1', published: true }],
      },
    ];
    mocks.db.activities = [
      {
        id: 'asg-1',
        format: 'classic',
        courseId: 'c1',
        title: 'Lab 1',
        instructions: 'Do the lab.',
        pointsPossible: 100,
        dueDate: new Date().toISOString(),
        submissionTypes: ['online_text'],
        published: true,
        category: 'Activities',
        weight: 20,
        rubric: [],
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    const entry = result.current.allFiles.find(f => f.id === 'asg-virtual-asg-1');
    expect(entry).toBeDefined();
    expect(entry?.folderId).toBe('fld-mod-1');
  });

  test('classic activity with no linked module files under its term folder, not root', () => {
    mocks.db.modules = [];
    mocks.db.activities = [
      {
        id: 'asg-9',
        format: 'classic',
        courseId: 'c1',
        title: 'Direct Lab',
        instructions: 'Do the lab.',
        term: 'finals',
        pointsPossible: 100,
        dueDate: new Date().toISOString(),
        submissionTypes: ['online_text'],
        published: true,
        category: 'Activities',
        weight: 20,
        rubric: [],
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    const entry = result.current.allFiles.find(f => f.id === 'asg-virtual-asg-9');
    expect(entry).toBeDefined();
    expect(entry?.folderId).toBe('vf-activities-finals');
  });
});

describe('useCourseFiles Activities term folders', () => {
  test('synthesizes an Activities root with a child per term of page-created activities', () => {
    mocks.db.activities = [
      {
        id: 'asg-m',
        courseId: 'c1',
        title: 'Midterm Lab',
        instructions: '',
        term: 'midterm',
        format: 'classic',
        pointsPossible: 100,
        dueDate: new Date().toISOString(),
        submissionTypes: ['online_text'],
        published: true,
        category: 'Activities',
        weight: 20,
        rubric: [],
      },
      {
        id: 'act-f',
        courseId: 'c1',
        title: 'Finals Set',
        instructions: '',
        term: 'finals',
        format: 'questionset',
        questions: [],
        pointsPossible: 8,
        published: true,
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    const folders = result.current.virtualFolders;
    const root = folders.find(f => f.id === 'vf-activities');
    expect(root).toMatchObject({ name: 'Activities', parentId: null });
    const mid = folders.find(f => f.id === 'vf-activities-midterm');
    const fin = folders.find(f => f.id === 'vf-activities-finals');
    expect(mid).toMatchObject({ name: 'Midterm', parentId: 'vf-activities' });
    expect(fin).toMatchObject({ name: 'Finals', parentId: 'vf-activities' });
    expect(folders.find(f => f.id === 'vf-activities-prelim')).toBeUndefined();
    expect(result.current.allFiles.find(f => f.id === 'asg-virtual-asg-m')?.folderId).toBe(
      'vf-activities-midterm'
    );
    expect(result.current.allFiles.find(f => f.id === 'act-virtual-act-f')?.folderId).toBe(
      'vf-activities-finals'
    );
  });

  test('legacy untagged activities file under a Midterm folder', () => {
    mocks.db.activities = [
      {
        id: 'asg-old',
        format: 'classic',
        courseId: 'c1',
        title: 'Old Lab',
        instructions: '',
        pointsPossible: 50,
        dueDate: new Date().toISOString(),
        submissionTypes: ['online_text'],
        published: true,
        category: 'Activities',
        weight: 20,
        rubric: [],
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    expect(result.current.allFiles.find(f => f.id === 'asg-virtual-asg-old')?.folderId).toBe(
      'vf-activities-midterm'
    );
    expect(
      result.current.virtualFolders.find(f => f.id === 'vf-activities-midterm')
    ).toBeDefined();
  });

  test('no virtual folders when every activity is module-linked', () => {
    mocks.db.courseFolders = [
      { id: 'fld-area', courseId: 'c1', parentId: null, name: 'Modules', autoKey: 'area:modules' },
      { id: 'fld-mod-1', courseId: 'c1', parentId: 'fld-area', name: 'Week 1', autoKey: 'module:mod-1' },
    ];
    mocks.db.modules = [
      {
        id: 'mod-1',
        courseId: 'c1',
        title: 'Week 1',
        items: [
          { id: 'item-a', type: 'activity', title: 'Activity 1', activityId: 'asg-activity-act-1', published: true },
        ],
      },
    ];
    mocks.db.activities = [
      {
        id: 'act-1',
        format: 'questionset',
        courseId: 'c1',
        title: 'Activity 1',
        instructions: '',
        term: 'midterm',
        questions: [],
        pointsPossible: 8,
        published: true,
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    expect(result.current.virtualFolders).toHaveLength(0);
    expect(result.current.allFiles.find(f => f.id === 'act-virtual-act-1')?.folderId).toBe(
      'fld-mod-1'
    );
  });
});

describe('useCourseFiles real Activities root', () => {
  test('unlinked activities file flat under the real root, no virtual folders', () => {
    mocks.db.courseFolders = [
      { id: 'fld-act', courseId: 'c1', parentId: null, name: 'Activities', autoKey: 'area:activities' },
    ];
    mocks.db.activities = [
      {
        id: 'asg-9',
        format: 'classic',
        courseId: 'c1',
        title: 'Direct Lab',
        instructions: 'Do the lab.',
        term: 'finals',
        pointsPossible: 100,
        dueDate: new Date().toISOString(),
        submissionTypes: ['online_text'],
        published: true,
        category: 'Activities',
        weight: 20,
        rubric: [],
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    expect(result.current.virtualFolders).toHaveLength(0);
    expect(result.current.allFiles.find(f => f.id === 'asg-virtual-asg-9')?.folderId).toBe(
      'fld-act'
    );
  });

  test('direct CourseFile rows with sourceArea activities aggregate as activities', () => {
    mocks.db.courseFiles = [
      {
        id: 'file-act-1',
        courseId: 'c1',
        folderId: 'fld-act',
        name: 'handout.pdf',
        sourceArea: 'activities',
      },
    ];
    const { result } = renderHook(() => useCourseFiles('c1'));
    const entry = result.current.allFiles.find(f => f.id === 'file-act-1');
    expect(entry).toBeDefined();
    expect(entry?.source).toBe('activities');
    expect(result.current.sourceCounts.activities).toBeGreaterThan(0);
  });
});

describe('useCourseFiles area-specific auto-foldering', () => {
  beforeEach(() => {
    mocks.db.courseFolders = [];
    mocks.db.courseFiles = [];
    mocks.db.announcements = [];
    mocks.db.modules = [];
    mocks.db.activities = [];
    mocks.db.courses = [{ id: 'c1', code: 'CSPC 112', title: 'Data Structures' }];
  });

  test('announcement attachments resolve into the announcements folder', () => {
    mocks.db.announcements = [
      {
        id: 'ann-1',
        courseId: 'c1',
        title: 'Welcome Announcement',
        content: 'Check the attached doc',
        attachments: [{ name: 'welcome_guide.pdf', size: '500 KB', url: '/uploads/welcome.pdf' }],
      },
    ];

    const { result } = renderHook(() => useCourseFiles('c1'));
    const entry = result.current.allFiles.find(f => f.name === 'welcome_guide.pdf');
    expect(entry).toBeDefined();
    expect(entry?.folderId).toBe('vf-announcements');
    expect(entry?.source).toBe('announcements');
    expect(result.current.virtualFolders.some(f => f.id === 'vf-announcements' && f.name === 'Announcements')).toBe(true);
  });

  test('uploaded course file attached to announcement resolves into announcements folder even if sourceArea is undefined', () => {
    mocks.db.courseFiles = [
      {
        id: 'cf-quest-1',
        courseId: 'c1',
        folderId: null,
        name: 'Questionnaire.pdf',
        url: 'https://gabay.zyberlab.com/assets/quest-1.pdf',
      },
    ];
    mocks.db.announcements = [
      {
        id: 'ann-2',
        courseId: 'c1',
        title: 'Exam Guidelines',
        attachments: [
          { name: 'Questionnaire.pdf', size: '611 KB', url: 'https://gabay.zyberlab.com/assets/quest-1.pdf' },
        ],
      },
    ];

    const { result } = renderHook(() => useCourseFiles('c1'));
    const entry = result.current.allFiles.find(f => f.name === 'Questionnaire.pdf');
    expect(entry).toBeDefined();
    expect(entry?.folderId).toBe('vf-announcements');
    expect(entry?.source).toBe('announcements');
    expect(entry?.sourceLabel).toBe('Announcement: Exam Guidelines');
    expect(result.current.sourceCounts.announcements).toBe(1);
    expect(result.current.sourceCounts.uploads).toBe(0);
    expect(result.current.virtualFolders.some(f => f.id === 'vf-announcements' && f.name === 'Announcements')).toBe(true);
  });

  test('does not fabricate phantom syllabus file when course syllabus has no sourceDocument', () => {
    mocks.db.courseFiles = [];
    mocks.db.courses = [
      {
        id: 'c1',
        code: 'CSPC 112',
        title: 'Software Engineering 2',
        syllabus: {
          courseInfo: { code: 'CSPC 112', title: 'Software Engineering 2' },
          courseOutcomes: [],
        },
      },
    ];

    const { result } = renderHook(() => useCourseFiles('c1'));
    const sylFiles = result.current.allFiles.filter(f => f.source === 'syllabus');
    expect(sylFiles).toHaveLength(0);
    expect(result.current.sourceCounts.syllabus).toBe(0);
  });

  test('syllabus upload and course orientation PDF resolve into the syllabus folder', () => {
    mocks.db.courseFiles = [
      {
        id: 'file-syl-1',
        courseId: 'c1',
        folderId: null,
        name: 'CMSC131_Course_Orientation.pdf',
        sourceArea: 'syllabus',
      },
    ];

    const { result } = renderHook(() => useCourseFiles('c1'));
    const entry = result.current.allFiles.find(f => f.name === 'CMSC131_Course_Orientation.pdf');
    expect(entry).toBeDefined();
    expect(entry?.folderId).toBe('vf-syllabus');
    expect(entry?.source).toBe('syllabus');
    expect(entry?.sourceLabel).toBe('Syllabus');
    expect(entry?.formattedSize).not.toBe('0 B');
    expect(entry?.formattedSize).toBe('1.0 MB');
    expect(result.current.virtualFolders.some(f => f.id === 'vf-syllabus' && f.name === 'Syllabus')).toBe(true);
  });

  test('module uploaded assets resolve into the modules folder or module subfolder', () => {
    mocks.db.modules = [
      {
        id: 'mod-x',
        courseId: 'c1',
        title: 'Module 1 - Introduction',
        items: [
          { id: 'item-1', title: 'Lecture 1 Slides', fileName: 'lecture1_slides.pdf', fileUrl: '/uploads/l1.pdf' },
        ],
      },
    ];

    const { result } = renderHook(() => useCourseFiles('c1'));
    const entry = result.current.allFiles.find(f => f.name === 'lecture1_slides.pdf');
    expect(entry).toBeDefined();
    expect(entry?.folderId).toBe('vf-modules');
    expect(entry?.source).toBe('modules');
    expect(result.current.virtualFolders.some(f => f.id === 'vf-modules' && f.name === 'Modules')).toBe(true);
  });

  test('does not duplicate announcement files uploaded to courseFiles and attached to announcements', () => {
    mocks.db.courseFiles = [
      {
        id: 'cfile-1',
        courseId: 'c1',
        name: 'Compliance-Matrix.docx',
        formattedSize: '413.9 KB',
        uploadedByName: 'User',
        updatedAt: '2026-10-27T00:00:00.000Z',
        sourceArea: 'announcements',
      },
    ];
    mocks.db.announcements = [
      {
        id: 'ann-1',
        courseId: 'c1',
        title: 'Test Announcement 2',
        authorName: 'Raymund Dilan',
        createdAt: '2025-01-01T00:00:00.000Z',
        attachments: [
          {
            name: 'Compliance-Matrix.docx',
            size: '413.9 KB',
            url: '/public/uploads/Compliance-Matrix.docx',
          },
        ],
      },
    ];

    const { result } = renderHook(() => useCourseFiles('c1'));
    const matches = result.current.allFiles.filter(f => f.name === 'Compliance-Matrix.docx');
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('cfile-1');
    expect(matches[0].uploadedByName).toBe('User');
    expect(result.current.sourceCounts.announcements).toBe(1);
  });
});
