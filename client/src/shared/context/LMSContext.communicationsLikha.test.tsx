// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

// Task 8: communications (announcements, discussions, notifications,
// messages, groups, calendar, advising) read/write through Likha ERP,
// never Express — except the four pinned likha-gaps (announcement like +
// read, discussion-reply like, message reaction) which stay on Express.
// Directus-shaped rows, exactly like the live Likha ERP stores them
// (snake_case; write responses echo the stored row).

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

const messageRow = {
  id: 'msg-1',
  sender_id: 'u-stud-1',
  sender_name: 'Stud One',
  sender_role: 'student',
  receiver_id: 'u-fac-1',
  recipient_name: 'Fac One',
  recipient_role: 'faculty',
  course_id: 'c1',
  subject: 'Hi',
  body: 'Hello',
  created_at: TS,
  is_read: false,
  group_id: null,
};

const announcementRow = {
  id: 'ann-1',
  course_id: 'c1',
  title: 'Welcome',
  content: 'Hello class',
  author_id: 'u-fac-1',
  author_name: 'Fac One',
  pinned: false,
  created_at: TS,
  likes: 0,
  liked_by: [],
  replies: [],
};

const announcementReplyRow = {
  id: 'ar-1',
  announcement_id: 'ann-1',
  author_id: 'u-fac-1',
  author_name: 'Fac One',
  content: 'Thanks!',
  created_at: TS,
};

const discussionRow = {
  id: 'd-1',
  course_id: 'c1',
  title: 'Introductions',
  content: 'Say hi',
  author_id: 'u-fac-1',
  author_name: 'Fac One',
  pinned: false,
  locked: false,
  created_at: TS,
  replies: [
    {
      id: 'dr-1',
      discussion_id: 'd-1',
      author_id: 'u-stud-1',
      author_name: 'Stud One',
      content: 'Hi all',
      created_at: TS,
      likes: 0,
      liked_by: [],
    },
  ],
};

const discussionReplyRow = {
  id: 'dr-new',
  discussion_id: 'd-1',
  author_id: 'u-fac-1',
  author_name: 'Fac One',
  content: 'Welcome!',
  created_at: TS,
};

const eventRow = {
  id: 'ev-1',
  title: 'Midterm',
  date: '2026-10-20',
  time: '09:00',
  course_id: 'c1',
  type: 'exam',
  description: 'Midterm exam',
};

const slotRow = {
  id: 'slot-1',
  instructor_id: 'u-fac-1',
  instructor_name: 'Fac One',
  date: '2026-10-21',
  time_slot: '10:00 AM - 10:30 AM',
  location: 'Room 101',
  status: 'available',
  student_id: null,
};

// Task-8-owned Express paths throw: any surviving call on a migrated path
// fails loudly (RED while the impl still uses apiFetch, GREEN proof once
// migrated). The four pinned likha-gaps (announcement like + read,
// discussion-reply like, message reaction) still read Express and return
// Express-shaped envelopes. Other tasks' paths return empties.
const apiFetchMock = vi.fn(async (path: string, options?: any) => {
  const method = (options as any)?.method ?? 'GET';
  if (path === '/api/messages' && method === 'POST') throw new Error(`unmocked-messages-express: ${path}`);
  if (/\/api\/groups/.test(path)) {
    if (/\/messages$/.test(path) && method === 'POST') throw new Error(`unmocked-group-message-express: ${path}`);
    if (path === '/api/groups' && method === 'POST') throw new Error(`unmocked-groups-express: ${path}`);
  }
  if (path === '/api/messages/thread/read') throw new Error(`unmocked-thread-read-express: ${path}`);
  if (path === '/api/advising' && method === 'POST') throw new Error(`unmocked-advising-express: ${path}`);
  if (/\/api\/advising\/.+\/book/.test(path)) throw new Error(`unmocked-advising-book-express: ${path}`);
  if (path === '/api/calendar' && method === 'POST') throw new Error(`unmocked-calendar-express: ${path}`);
  if (/\/api\/calendar\/.+/.test(path)) throw new Error(`unmocked-calendar-express: ${path}`);
  if (/\/api\/courses\/.+\/announcements/.test(path)) throw new Error(`unmocked-announcements-express: ${path}`);
  if (/\/api\/courses\/.+\/discussions/.test(path)) throw new Error(`unmocked-discussions-express: ${path}`);
  if (/\/api\/announcements\/.+\/replies/.test(path) && method === 'POST') throw new Error(`unmocked-announcement-reply-express: ${path}`);
  if (/\/api\/discussions\/.+\/replies$/.test(path) && method === 'POST') throw new Error(`unmocked-discussion-reply-express: ${path}`);
  if (/\/api\/announcements$|\/api\/announcements\/.+$/.test(path) && (method === 'DELETE' || method === 'PATCH')) {
    if (!/\/like$/.test(path) && !/\/read$/.test(path)) throw new Error(`unmocked-announcement-mutate-express: ${path}`);
  }
  if (/\/api\/discussions\/.+$/.test(path) && (method === 'DELETE' || method === 'PATCH')) {
    if (!/\/like$/.test(path)) throw new Error(`unmocked-discussion-mutate-express: ${path}`);
  }
  if (path === '/api/notifications/read-all') throw new Error(`unmocked-notif-read-all-express: ${path}`);
  if (/\/api\/notifications\/.+\/read/.test(path) && method === 'POST') {
    return { notification: { id: 'n-1', read: true } };
  }
  // Pinned likha-gaps: announcement like + read, discussion-reply like,
  // message reaction stay on Express (verified by the gap tests below).
  if (/\/api\/announcements\/.+\/like$/.test(path)) return { likes: 1, liked: true };
  if (/\/api\/announcements\/.+\/read$/.test(path)) return { ok: true };
  if (/\/like$/.test(path) && method === 'POST') return { likes: 1, liked: true };
  if (/\/api\/messages\/.+\/react$/.test(path)) {
    if (method === 'DELETE') return { message: { id: 'msg-1', reaction: undefined } };
    return { message: { id: 'msg-1', reaction: '👍' } };
  }
  if (path.includes('/announcements')) return { announcements: [] };
  if (path.includes('/discussions')) return { discussions: [] };
  if (path.includes('/folders')) return { folders: [] };
  if (path.includes('/files')) return { files: [] };
  if (path.includes('/grades')) return { grades: [] };
  if (path.includes('/spr')) return { config: null };
  if (path.includes('/submissions')) return { submissions: [] };
  if (path.includes('/quizzes')) return { quizzes: [] };
  if (path.includes('/exams')) return { exams: [] };
  if (path.includes('/activities')) return { activities: [] };
  if (path.includes('/modules')) return { modules: [] };
  throw new Error(`unmocked: ${path} ${method}`);
});

let seedMessages: any[] = [];
let seedNotifs: any[] = [];

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
const getNotifsMock = vi.fn(async () => seedNotifs.map(n => ({ ...n })));
const getUsersMock = vi.fn(async () => [
  { id: 'u-fac-1', first_name: 'Fac', last_name: 'One', email: 'faculty1@dmmmsu.edu.ph', role: { name: 'Faculty' } },
  { id: 'u-stud-1', first_name: 'Stud', last_name: 'One', email: 'stud1@dmmmsu.edu.ph', role: { name: 'Student' } },
]);
const getMessagesMock = vi.fn(async () => seedMessages.map(m => ({ ...m })));
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
const invalidateCacheMock = vi.fn();
const getAnnouncementsMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? [{ ...announcementRow, replies: [] }] : []
);
const getDiscussionsMock = vi.fn(async (courseId: string) =>
  courseId === 'c1' ? [{ ...discussionRow, replies: discussionRow.replies.map(r => ({ ...r })) }] : []
);
const sendMessageMock = vi.fn(async (data: any) => ({
  id: 'msg-1',
  sender_id: 'u-fac-1',
  sender_name: 'Fac One',
  created_at: TS,
  is_read: false,
  ...data,
}));
const createChatGroupMock = vi.fn(async (data: any) => ({
  id: 'g-new',
  created_at: TS,
  ...data,
}));
const markNotificationReadMock = vi.fn(async () => {});
const markAllNotificationsReadMock = vi.fn(async () => {});
const markThreadReadMock = vi.fn(async () => {});
const createAnnouncementMock = vi.fn(async (data: any) => ({
  id: 'ann-new',
  author_id: 'u-fac-1',
  author_name: 'Fac One',
  created_at: TS,
  pinned: false,
  likes: 0,
  liked_by: [],
  ...data,
}));
const addAnnouncementReplyMock = vi.fn(async (announcementId: string, reply: any) => ({
  id: 'ar-1',
  announcement_id: announcementId,
  created_at: TS,
  ...reply,
}));
const updateAnnouncementMock = vi.fn(async (id: string, patch: any) => ({ id, ...patch }));
const deleteAnnouncementMock = vi.fn(async () => ({}));
const createDiscussionMock = vi.fn(async (data: any) => ({
  id: 'd-new',
  author_id: 'u-fac-1',
  author_name: 'Fac One',
  created_at: TS,
  pinned: false,
  locked: false,
  ...data,
}));
const addDiscussionReplyMock = vi.fn(async (discussionId: string, reply: any) => ({
  id: 'dr-new',
  discussion_id: discussionId,
  created_at: TS,
  ...reply,
}));
const updateDiscussionMock = vi.fn(async (id: string, patch: any) => ({ id, ...patch }));
const deleteDiscussionMock = vi.fn(async () => ({}));
const createCalendarEventMock = vi.fn(async (data: any) => ({ id: 'ev-new', ...data }));
const updateCalendarEventMock = vi.fn(async (id: string, patch: any) => ({ id, ...patch }));
const deleteCalendarEventMock = vi.fn(async () => ({}));
const bookAdvisingSlotMock = vi.fn(async (id: string, studentId: string) => ({
  id,
  student_id: studentId,
  status: 'booked',
}));
const createAdvisingSlotMock = vi.fn(async (data: any) => ({ id: 'slot-new', status: 'available', ...data }));
const updateMessageReactionMock = vi.fn(async (id: string, reaction: string | null) => ({ id, reaction }));
const updateDiscussionReplyMock = vi.fn(async (id: string, patch: any) => ({ id, ...patch }));

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
      getAnnouncements: (...args: any[]) => (getAnnouncementsMock as any)(...args),
      getDiscussions: (...args: any[]) => (getDiscussionsMock as any)(...args),
      sendMessage: (...args: any[]) => (sendMessageMock as any)(...args),
      createChatGroup: (...args: any[]) => (createChatGroupMock as any)(...args),
      markNotificationRead: (...args: any[]) => (markNotificationReadMock as any)(...args),
      markAllNotificationsRead: (...args: any[]) => (markAllNotificationsReadMock as any)(...args),
      markThreadRead: (...args: any[]) => (markThreadReadMock as any)(...args),
      createAnnouncement: (...args: any[]) => (createAnnouncementMock as any)(...args),
      addAnnouncementReply: (...args: any[]) => (addAnnouncementReplyMock as any)(...args),
      updateAnnouncement: (...args: any[]) => (updateAnnouncementMock as any)(...args),
      deleteAnnouncement: (...args: any[]) => (deleteAnnouncementMock as any)(...args),
      createDiscussion: (...args: any[]) => (createDiscussionMock as any)(...args),
      addDiscussionReply: (...args: any[]) => (addDiscussionReplyMock as any)(...args),
      updateDiscussion: (...args: any[]) => (updateDiscussionMock as any)(...args),
      deleteDiscussion: (...args: any[]) => (deleteDiscussionMock as any)(...args),
      createCalendarEvent: (...args: any[]) => (createCalendarEventMock as any)(...args),
      updateCalendarEvent: (...args: any[]) => (updateCalendarEventMock as any)(...args),
      deleteCalendarEvent: (...args: any[]) => (deleteCalendarEventMock as any)(...args),
      bookAdvisingSlot: (...args: any[]) => (bookAdvisingSlotMock as any)(...args),
      createAdvisingSlot: (...args: any[]) => (createAdvisingSlotMock as any)(...args),
      updateMessageReaction: (...args: any[]) => (updateMessageReactionMock as any)(...args),
      updateDiscussionReply: (...args: any[]) => (updateDiscussionReplyMock as any)(...args),
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
      getSPRConfig: (...args: any[]) => (getSPRConfigMock as any)(...args),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let ctx: any = null;
let seenDb: any = null;
let doSendMessage: ((recipientId: string, subject: string, body: string, courseId?: string) => Promise<void>) | null = null;

const Probe: React.FC = () => {
  const v = useLMS();
  ctx = v as any;
  seenDb = v.db as any;
  doSendMessage = (recipientId: string, subject: string, body: string, courseId?: string) =>
    (v as any).sendMessage(recipientId, subject, body, courseId);
  return null;
};

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
  await waitFor(() => {
    expect(getAnnouncementsMock).toHaveBeenCalledWith('c1');
  });
  // Action-focused tests clear the login/bootstrap history so the "never
  // Express" assertions pin only the action under test.
  apiFetchMock.mockClear();
}

// Task-8-owned Express paths (announcement/discussion like + read and
// message reaction excluded: pinned likha-gaps, and the sanctioned
// grades-release path which no test here drives).
const commExpressCalls = () =>
  (apiFetchMock.mock.calls as any[][])
    .map(([p]) => String(p))
    .filter(p =>
      p.includes('/announcements') ||
      p.includes('/discussions') ||
      p.includes('/api/messages') ||
      p.includes('/api/groups') ||
      p.includes('/api/calendar') ||
      p.includes('/api/advising') ||
      p.includes('/api/notifications')
    )
    .filter(p => !p.includes('/like') && !p.includes('/read') && !p.includes('/react'));

describe('communications via Likha (Task 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx = null;
    seenDb = null;
    doSendMessage = null;
    seedMessages = [];
    seedNotifs = [];
    try {
      localStorage.clear();
    } catch {}
  });

  test('sendMessage writes through Likha, never Express', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      await doSendMessage!('u-stud-1', 'Hi', 'Hello', 'c1');
    });
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).not.toHaveBeenCalledWith('/api/messages', expect.anything());
  });

  test('sendMessage persists the Likha echo with snake_case mapping', async () => {
    await renderLoggedIn();
    await act(async () => {
      await doSendMessage!('u-stud-1', 'Hi', 'Hello', 'c1');
    });
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ receiver_id: 'u-stud-1', subject: 'Hi', body: 'Hello', course_id: 'c1' })
    );
    expect(commExpressCalls()).toEqual([]);
    const msg = (seenDb.messages || []).find((m: any) => m.id === 'msg-1');
    expect(msg?.recipientId).toBe('u-stud-1');
    expect(msg?.subject).toBe('Hi');
    expect(msg?.body).toBe('Hello');
    expect(msg?.courseId).toBe('c1');
  });

  test('bootstrap hydrates announcements and discussions via Likha, never Express', async () => {
    render(
      <LMSProvider>
        <Probe />
      </LMSProvider>
    );
    await act(async () => {
      await ctx.login('faculty1@dmmmsu.edu.ph', 'pw');
    });
    await waitFor(() => {
      expect((seenDb.announcements || []).some((a: any) => a.id === 'ann-1')).toBe(true);
    });
    await waitFor(() => {
      expect((seenDb.discussions || []).some((d: any) => d.id === 'd-1')).toBe(true);
    });
    expect(getAnnouncementsMock).toHaveBeenCalledWith('c1');
    expect(getDiscussionsMock).toHaveBeenCalledWith('c1');
    expect(commExpressCalls()).toEqual([]);
    const ann = (seenDb.announcements || []).find((a: any) => a.id === 'ann-1');
    expect(ann.courseId).toBe('c1');
    expect(ann.title).toBe('Welcome');
    const disc = (seenDb.discussions || []).find((d: any) => d.id === 'd-1');
    expect(disc.courseId).toBe('c1');
    expect((disc.replies || []).some((r: any) => r.id === 'dr-1' && r.content === 'Hi all')).toBe(true);
  });

  test('createAnnouncement writes through Likha, never Express', async () => {
    await renderLoggedIn();
    let created: any = null;
    await act(async () => {
      created = await ctx.createAnnouncement({ courseId: 'c1', title: 'Welcome', content: 'Hello class' });
    });
    expect(createAnnouncementMock).toHaveBeenCalledTimes(1);
    expect(createAnnouncementMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: 'c1', title: 'Welcome', content: 'Hello class' })
    );
    expect(commExpressCalls()).toEqual([]);
    expect(created.id).toBe('ann-new');
    expect((seenDb.announcements || []).some((a: any) => a.id === 'ann-new' && a.title === 'Welcome')).toBe(true);
  });

  test('addAnnouncementReply writes through Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.addAnnouncementReply('ann-1', 'Thanks!');
    });
    expect(addAnnouncementReplyMock).toHaveBeenCalledTimes(1);
    expect(addAnnouncementReplyMock).toHaveBeenCalledWith(
      'ann-1',
      expect.objectContaining({ content: 'Thanks!' })
    );
    expect(commExpressCalls()).toEqual([]);
    const ann = (seenDb.announcements || []).find((a: any) => a.id === 'ann-1');
    expect((ann.replies || []).some((r: any) => r.id === 'ar-1' && r.content === 'Thanks!')).toBe(true);
  });

  test('addAnnouncementReply rejects replies when course is outside user college/program jurisdiction', async () => {
    await renderLoggedIn();
    const outOfScopeAnn = {
      id: 'ann-out-of-scope',
      course_id: 'c-unaffiliated',
      courseId: 'c-unaffiliated',
      title: 'Secret Announcement',
      content: 'Out of reach',
      author_id: 'u-fac-other',
      author_name: 'Other Faculty',
      created_at: TS,
      replies: [],
    };
    (seenDb.announcements || []).push(outOfScopeAnn);
    (seenDb.courses || []).push({
      id: 'c-unaffiliated',
      code: 'ENGL 999',
      title: 'Foreign Literature',
      instructorId: 'u-fac-other',
      collegeId: 'col-other',
      departmentId: 'dept-other',
      published: true,
      termId: '1st-sem-2025',
    });

    addAnnouncementReplyMock.mockClear();
    await act(async () => {
      ctx.switchRole('student');
    });

    await act(async () => {
      await ctx.addAnnouncementReply('ann-out-of-scope', 'Unauthorized comment');
    });
    expect(addAnnouncementReplyMock).not.toHaveBeenCalled();
  });

  test('deleteAnnouncement deletes via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.deleteAnnouncement('ann-1');
    });
    expect(deleteAnnouncementMock).toHaveBeenCalledWith('ann-1');
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.announcements || []).some((a: any) => a.id === 'ann-1')).toBe(false);
  });

  test('togglePinAnnouncement patches via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.togglePinAnnouncement('ann-1');
    });
    expect(updateAnnouncementMock).toHaveBeenCalledWith('ann-1', { pinned: true });
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.announcements || []).find((a: any) => a.id === 'ann-1')?.pinned).toBe(true);
  });

  test('createDiscussion writes through Likha, never Express', async () => {
    await renderLoggedIn();
    let created: any = null;
    await act(async () => {
      created = await ctx.createDiscussion({ courseId: 'c1', title: 'Introductions', prompt: 'Say hi' });
    });
    expect(createDiscussionMock).toHaveBeenCalledTimes(1);
    expect(createDiscussionMock).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: 'c1', title: 'Introductions' })
    );
    expect(commExpressCalls()).toEqual([]);
    expect(created.id).toBe('d-new');
    expect((seenDb.discussions || []).some((d: any) => d.id === 'd-new')).toBe(true);
  });

  test('addDiscussionReply writes through Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.addDiscussionReply('d-1', 'Welcome!');
    });
    expect(addDiscussionReplyMock).toHaveBeenCalledTimes(1);
    expect(addDiscussionReplyMock).toHaveBeenCalledWith(
      'd-1',
      expect.objectContaining({ content: 'Welcome!' })
    );
    expect(commExpressCalls()).toEqual([]);
    const disc = (seenDb.discussions || []).find((d: any) => d.id === 'd-1');
    expect((disc.replies || []).some((r: any) => r.id === 'dr-new' && r.content === 'Welcome!')).toBe(true);
  });

  test('deleteDiscussion deletes via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.deleteDiscussion('d-1');
    });
    expect(deleteDiscussionMock).toHaveBeenCalledWith('d-1');
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.discussions || []).some((d: any) => d.id === 'd-1')).toBe(false);
  });

  test('togglePinDiscussion patches via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.togglePinDiscussion('d-1');
    });
    expect(updateDiscussionMock).toHaveBeenCalledWith('d-1', { pinned: true });
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.discussions || []).find((d: any) => d.id === 'd-1')?.pinned).toBe(true);
  });

  test('toggleLockDiscussion patches via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.toggleLockDiscussion('d-1');
    });
    expect(updateDiscussionMock).toHaveBeenCalledWith('d-1', { locked: true });
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.discussions || []).find((d: any) => d.id === 'd-1')?.locked).toBe(true);
  });

  test('createChatGroup writes through Likha with the welcome message, never Express', async () => {
    await renderLoggedIn();
    let group: any = null;
    await act(async () => {
      group = await ctx.createChatGroup('Study Group', ['u-stud-1'], 'c1');
    });
    expect(createChatGroupMock).toHaveBeenCalledTimes(1);
    expect(createChatGroupMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Study Group', course_id: 'c1' })
    );
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 'g-new', subject: 'Welcome to Study Group' })
    );
    expect(commExpressCalls()).toEqual([]);
    expect(group.id).toBe('g-new');
    expect((seenDb.chatGroups || []).some((g: any) => g.id === 'g-new')).toBe(true);
    expect((seenDb.messages || []).some((m: any) => m.groupId === 'g-new')).toBe(true);
  });

  test('markThreadAsRead marks via Likha, never Express', async () => {
    seedMessages = [{ ...messageRow }];
    await renderLoggedIn();
    expect((seenDb.messages || []).find((m: any) => m.id === 'msg-1')?.read).toBeFalsy();
    await act(async () => {
      await ctx.markThreadAsRead('u-stud-1');
    });
    expect(markThreadReadMock).toHaveBeenCalledTimes(1);
    expect(markThreadReadMock).toHaveBeenCalledWith(['msg-1']);
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.messages || []).find((m: any) => m.id === 'msg-1')?.read).toBe(true);
  });

  test('markNotificationRead persists via Likha only, never Express', async () => {
    seedNotifs = [{
      id: 'n-1',
      user_id: 'u-fac-1',
      title: 'New reply',
      message: 'Someone replied',
      type: 'announcement_reply',
      is_read: false,
      created_at: TS,
    }];
    await renderLoggedIn();
    await act(async () => {
      await ctx.markNotificationRead('n-1');
    });
    expect(markNotificationReadMock).toHaveBeenCalledWith('n-1');
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.notifications || []).find((n: any) => n.id === 'n-1')?.read).toBe(true);
  });

  test('markAllNotificationsRead marks via Likha, never Express', async () => {
    seedNotifs = [{
      id: 'n-1',
      user_id: 'u-fac-1',
      title: 'New reply',
      message: 'Someone replied',
      type: 'announcement_reply',
      is_read: false,
      created_at: TS,
    }];
    await renderLoggedIn();
    await act(async () => {
      await ctx.markAllNotificationsRead('u-fac-1');
    });
    expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1);
    expect(markAllNotificationsReadMock).toHaveBeenCalledWith(['n-1']);
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.notifications || []).every((n: any) => n.read)).toBe(true);
  });

  test('bookAdvisingSlot books via Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.createAdvisingSlot('2026-10-21', '10:00 AM - 10:30 AM', 'Room 101');
    });
    expect(createAdvisingSlotMock).toHaveBeenCalledTimes(1);
    expect(createAdvisingSlotMock).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-21', time_slot: '10:00 AM - 10:30 AM', location: 'Room 101' })
    );
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.advisingSlots || []).some((s: any) => s.id === 'slot-new')).toBe(true);
    await act(async () => {
      await ctx.bookAdvisingSlot('slot-new');
    });
    expect(bookAdvisingSlotMock).toHaveBeenCalledWith('slot-new', 'u-fac-1');
    expect(commExpressCalls()).toEqual([]);
    const slot = (seenDb.advisingSlots || []).find((s: any) => s.id === 'slot-new');
    expect(slot?.status).toBe('booked');
    expect(slot?.bookedByStudentId).toBe('u-fac-1');
  });

  test('calendar create/update/delete go through Likha, never Express', async () => {
    await renderLoggedIn();
    let created: any = null;
    await act(async () => {
      created = await ctx.addCalendarEvent({
        title: 'Midterm',
        date: '2026-10-20',
        time: '09:00',
        courseId: 'c1',
        type: 'exam',
        description: 'Midterm exam',
      });
    });
    expect(createCalendarEventMock).toHaveBeenCalledTimes(1);
    expect(createCalendarEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Midterm', date: '2026-10-20', course_id: 'c1' })
    );
    expect(commExpressCalls()).toEqual([]);
    expect(created.id).toBe('ev-new');
    await act(async () => {
      await ctx.updateCalendarEvent('ev-new', { title: 'Midterm v2' });
    });
    expect(updateCalendarEventMock).toHaveBeenCalledWith('ev-new', expect.objectContaining({ title: 'Midterm v2' }));
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.calendarEvents || []).find((e: any) => e.id === 'ev-new')?.title).toBe('Midterm v2');
    await act(async () => {
      await ctx.deleteCalendarEvent('ev-new');
    });
    expect(deleteCalendarEventMock).toHaveBeenCalledWith('ev-new');
    expect(commExpressCalls()).toEqual([]);
    expect((seenDb.calendarEvents || []).some((e: any) => e.id === 'ev-new')).toBe(false);
  });

  // Migrated from Express: operations write through Likha ERP directly.
  test('toggleLikeAnnouncement writes through Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.toggleLikeAnnouncement('ann-1');
    });
    expect(updateAnnouncementMock).toHaveBeenCalledWith('ann-1', {
      liked_by: ['u-fac-1'],
      likes: 1,
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect((seenDb.announcements || []).find((a: any) => a.id === 'ann-1')?.likes).toBe(1);
  });

  test('markAnnouncementRead writes through Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.markAnnouncementRead('ann-1');
    });
    expect(updateAnnouncementMock).toHaveBeenCalledWith('ann-1', {
      read_by: ['u-fac-1'],
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect((seenDb.announcements || []).find((a: any) => a.id === 'ann-1')?.readBy).toContain('u-fac-1');
  });

  test('toggleLikeDiscussionReply writes through Likha, never Express', async () => {
    await renderLoggedIn();
    await act(async () => {
      await ctx.toggleLikeDiscussionReply('d-1', 'dr-1');
    });
    expect(updateDiscussionReplyMock).toHaveBeenCalledWith('dr-1', {
      liked_by: ['u-fac-1'],
      likes: 1,
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    const disc = (seenDb.discussions || []).find((d: any) => d.id === 'd-1');
    expect((disc.replies || []).find((r: any) => r.id === 'dr-1')?.likes).toBe(1);
  });

  test('toggleMessageReaction writes through Likha, never Express', async () => {
    seedMessages = [{ ...messageRow }];
    await renderLoggedIn();
    await act(async () => {
      await ctx.toggleMessageReaction('msg-1', '👍');
    });
    expect(updateMessageReactionMock).toHaveBeenCalledWith('msg-1', '👍');
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect((seenDb.messages || []).find((m: any) => m.id === 'msg-1')?.reaction).toBe('👍');
  });
});
