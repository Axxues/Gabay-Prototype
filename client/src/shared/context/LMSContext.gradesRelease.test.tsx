// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const seededCourse = {
  id: 'c1',
  code: 'C1',
  title: 'T',
  section: 'S',
  term: 'T',
  instructorId: 'u1',
  instructorName: 'N',
  published: true,
  enrolledCount: 0,
};

// Task 6: assessments + submissions bootstrap read through Likha ERP.
// Scoped Express assertion: only assessment/submission paths must be silent
// (grades-release stays on Express per the likha-gap pin below; grades/SPR/
// folders/files/announcements/discussions belong to later tasks and still
// read Express here).
// Login + assessment/submission bootstrap read Likha; grades-release stays on
// Express (likha-gap: no backend field — courses.grades_released was deleted).
// Any other Express call throws loudly.
const apiFetchMock = vi.fn(async (path: string, options?: any) => {
  if (path === '/api/courses/c1/grades-release') {
    const body = (options as any)?.body ?? {};
    return { course: { id: 'c1', gradesReleased: JSON.stringify({ [body.term]: body.released }) } };
  }
  throw new Error(`unmocked: ${path}`);
});

// Directus-shaped rows, exactly like the live Likha ERP stores them.
const quizRow = {
  id: 'q1',
  course_id: 'c1',
  title: 'Quiz 1',
  term: 'midterm',
  instructions: 'Answer all questions.',
  published: true,
  time_limit_minutes: 30,
  questions: [],
};
const examRow = {
  id: 'e1',
  course_id: 'c1',
  title: 'Exam 1',
  term: 'midterm',
  instructions: 'Answer all questions.',
  published: true,
  time_limit_minutes: 60,
  questions: [],
};
const activityRow = {
  id: 'a1',
  course_id: 'c1',
  title: 'Activity 1',
  term: 'midterm',
  instructions: 'Do the work.',
  published: true,
  format: 'questionset',
  points_possible: 100,
  questions: [],
};

const loginLikhaMock = vi.fn(async () => ({
  token: 't-likha',
  user: {
    id: 'u1',
    first_name: 'Test',
    last_name: 'User',
    email: 'test@example.com',
    role: { name: 'Faculty' },
  },
}));
const getCoursesMock = vi.fn(async () => [{ ...seededCourse }]);
const getNotifsMock = vi.fn(async () => []);
const getUsersMock = vi.fn(async () => []);
const getMessagesMock = vi.fn(async () => []);
const getCalendarMock = vi.fn(async () => []);
const getGroupsMock = vi.fn(async () => []);
const getSlotsMock = vi.fn(async () => []);
const getSectionsMock = vi.fn(async () => []);
const getRequestsMock = vi.fn(async () => []);
const getQuizzesMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? [{ ...quizRow }] : []
);
const getExamsMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? [{ ...examRow }] : []
);
const getActivitiesMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? [{ ...activityRow }] : []
);
const getSubmissionsMock = vi.fn(async () => []);
const updateCourseMock = vi.fn(async (id: string, updates: any) => ({
  id,
  ...updates,
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
    getCoursesWithRelations: (...args: any[]) => (getCoursesMock as any)(...args),
    getNotifications: (...args: any[]) => (getNotifsMock as any)(...args),
    users: {
      getUsers: (...args: any[]) => (getUsersMock as any)(...args),
    },
    communications: {
      getMessages: (...args: any[]) => (getMessagesMock as any)(...args),
      getCalendarEvents: (...args: any[]) => (getCalendarMock as any)(...args),
      getChatGroups: (...args: any[]) => (getGroupsMock as any)(...args),
      getAdvisingSlots: (...args: any[]) => (getSlotsMock as any)(...args),
    },
    requests: {
      getRequests: (...args: any[]) => (getRequestsMock as any)(...args),
    },
    sections: {
      getSections: (...args: any[]) => (getSectionsMock as any)(...args),
    },
    assessments: {
      getQuizzes: (...args: any[]) => (getQuizzesMock as any)(...args),
      getExams: (...args: any[]) => (getExamsMock as any)(...args),
      getActivities: (...args: any[]) => (getActivitiesMock as any)(...args),
    },
    submissions: {
      getSubmissions: (...args: any[]) => (getSubmissionsMock as any)(...args),
    },
    courses: {
      updateCourse: (...args: any[]) => (updateCourseMock as any)(...args),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let latestCourses: any[] = [];
let latestQuizzes: any[] = [];
let doLogin: (() => Promise<any>) | null = null;
let doRelease: (() => Promise<void>) | null = null;
let doUnrelease: (() => Promise<void>) | null = null;

const Probe: React.FC = () => {
  const ctx = useLMS() as any;
  latestCourses = ctx.db.courses;
  latestQuizzes = ctx.db.quizzes;
  doLogin = () => ctx.login('test@example.com', 'pw');
  doRelease = () => ctx.setGradesReleased('c1', 'midterm', true);
  doUnrelease = () => ctx.setGradesReleased('c1', 'midterm', false);
  return <div data-testid="probe">{String(latestCourses?.length ?? 0)}</div>;
};

const assessmentExpressCalls = () =>
  (apiFetchMock.mock.calls as any[][]).filter(([p]) =>
    /\/api\/(quizzes|exams|activities)/.test(String(p)) ||
    /\/submissions/.test(String(p)) ||
    /grades-release/.test(String(p)),
  );

describe('assessments via Likha (Task 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestCourses = [];
    latestQuizzes = [];
    doLogin = null;
    doRelease = null;
    doUnrelease = null;
    try {
      localStorage.clear();
    } catch {}
  });

  test('assessment bootstrap reads through Likha, never Express', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      await doLogin!();
    });
    await waitFor(() => {
      expect(getQuizzesMock).toHaveBeenCalled();
    });
    expect(getExamsMock).toHaveBeenCalledWith('c1');
    expect(getActivitiesMock).toHaveBeenCalledWith('c1');
    const expressCalls = assessmentExpressCalls();
    expect(expressCalls).toEqual([]);
    await waitFor(() => {
      expect((latestQuizzes || []).some((q: any) => q.id === 'q1' && q.courseId === 'c1')).toBe(true);
    });
  });

  test('course gradesReleased reflects the release after setGradesReleased', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await act(async () => {
      await doLogin!();
    });
    expect(loginLikhaMock).toHaveBeenCalledWith('test@example.com', 'pw');
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/auth/login', expect.anything());

    await act(async () => {
      await doRelease!();
    });
    // likha-gap pin: release stays on Express, never PATCHes /items/courses.
    expect(apiFetchMock).toHaveBeenCalledWith('/api/courses/c1/grades-release', {
      method: 'PATCH',
      body: { term: 'midterm', released: true },
    });
    expect(updateCourseMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(latestCourses.find(c => c.id === 'c1')?.gradesReleased).toEqual({ midterm: true });
    });
    await screen.findByText('Grades Released');
    await screen.findByText(/visible to students/);
  });

  test('un-release (false) shows the hidden-grades alert', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );

    await act(async () => {
      await doLogin!();
    });

    await act(async () => {
      await doUnrelease!();
    });
    expect(apiFetchMock).toHaveBeenCalledWith('/api/courses/c1/grades-release', {
      method: 'PATCH',
      body: { term: 'midterm', released: false },
    });
    expect(updateCourseMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(latestCourses.find(c => c.id === 'c1')?.gradesReleased).toEqual({ midterm: false });
    });
    await screen.findByText('Grades Un-released');
    await screen.findByText(/hidden from students/);
  });
});
