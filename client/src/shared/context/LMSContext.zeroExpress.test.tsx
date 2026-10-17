// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, render, waitFor, screen } from '@testing-library/react';
import React from 'react';

const apiFetchMock = vi.fn(async (path: string) => {
  throw new Error(`apiFetch called unexpectedly on: ${path}`);
});

const updateCourseMock = vi.fn(async (id: string, updates: any) => ({ id, ...updates }));
const updateCommentMock = vi.fn(async (id: string, updates: any) => ({ id, ...updates }));
const deleteCommentMock = vi.fn(async (_id: string) => ({}));
const updateMessageReactionMock = vi.fn(async (id: string, reaction: string | null) => ({ id, reaction }));
const updateAnnouncementMock = vi.fn(async (id: string, updates: any) => ({ id, ...updates }));
const updateDiscussionReplyMock = vi.fn(async (id: string, updates: any) => ({ id, ...updates }));

const courseRow = {
  id: 'c1',
  code: 'CMSC 180',
  title: 'Algorithms',
  instructor_id: 'u-fac-1',
  published: true,
  grades_released: {},
};

const commentRow = {
  id: 'cm-1',
  module_id: 'm1',
  item_id: 'it-1',
  author_id: 'u-fac-1',
  author_name: 'Dr. Santos',
  author_avatar: '',
  author_role: 'faculty',
  content: 'Initial comment content',
  created_at: '2026-10-15T00:00:00.000Z',
  likes: 0,
  liked_by: [],
};

const moduleRow = {
  id: 'm1',
  course_id: 'c1',
  title: 'Module 1',
  order: 1,
  published: true,
  items: [
    {
      id: 'it-1',
      module_id: 'm1',
      title: 'Item 1',
      type: 'page',
      content: 'Content',
    },
  ],
  comments: [{ ...commentRow }],
};

const messageRow = {
  id: 'msg-1',
  sender_id: 'u-stud-1',
  sender_name: 'Student One',
  sender_role: 'student',
  receiver_id: 'u-fac-1',
  recipient_name: 'Dr. Santos',
  recipient_role: 'faculty',
  course_id: 'c1',
  subject: 'Question',
  body: 'Hello',
  created_at: '2026-10-15T00:00:00.000Z',
  is_read: false,
};

const announcementRow = {
  id: 'ann-1',
  course_id: 'c1',
  title: 'Welcome Class',
  content: 'Announcement text',
  author_id: 'u-fac-1',
  author_name: 'Dr. Santos',
  pinned: false,
  created_at: '2026-10-15T00:00:00.000Z',
  likes: 0,
  liked_by: [],
  read_by: [],
  replies: [],
};

const discussionReplyRow = {
  id: 'dr-1',
  discussion_id: 'd-1',
  author_id: 'u-stud-1',
  author_name: 'Student One',
  content: 'Discussion reply text',
  created_at: '2026-10-15T00:00:00.000Z',
  likes: 0,
  liked_by: [],
};

const discussionRow = {
  id: 'd-1',
  course_id: 'c1',
  title: 'Discussion 1',
  content: 'Topic text',
  author_id: 'u-fac-1',
  author_name: 'Dr. Santos',
  pinned: false,
  locked: false,
  created_at: '2026-10-15T00:00:00.000Z',
  replies: [{ ...discussionReplyRow }],
};

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
    loginLikhaUser: vi.fn(async () => ({
      token: 'token-123',
      user: {
        id: 'u-fac-1',
        first_name: 'Faculty',
        last_name: 'Santos',
        email: 'faculty@dmmmsu.edu.ph',
        role: { name: 'Faculty' },
      },
    })),
    getCoursesWithRelations: vi.fn(async () => [{ ...courseRow }]),
    getNotifications: vi.fn(async () => []),
    invalidateCache: vi.fn(),
    users: {
      getUsers: vi.fn(async () => [
        { id: 'u-fac-1', first_name: 'Faculty', last_name: 'Santos', email: 'faculty@dmmmsu.edu.ph', role: { name: 'Faculty' } },
      ]),
    },
    courses: {
      getCourses: vi.fn(async () => [{ ...courseRow }]),
      updateCourse: (...args: any[]) => (updateCourseMock as any)(...args),
    },
    modules: {
      getModulesWithItems: vi.fn(async () => [{ ...moduleRow, comments: [{ ...commentRow }] }]),
      getComments: vi.fn(async () => [{ ...commentRow }]),
      updateComment: (...args: any[]) => (updateCommentMock as any)(...args),
      deleteComment: (...args: any[]) => (deleteCommentMock as any)(...args),
    },
    communications: {
      getMessages: vi.fn(async () => [{ ...messageRow }]),
      getCalendarEvents: vi.fn(async () => []),
      getChatGroups: vi.fn(async () => []),
      getAdvisingSlots: vi.fn(async () => []),
      getAnnouncements: vi.fn(async () => [{ ...announcementRow }]),
      getDiscussions: vi.fn(async () => [{ ...discussionRow, replies: [{ ...discussionReplyRow }] }]),
      updateMessageReaction: (...args: any[]) => (updateMessageReactionMock as any)(...args),
      updateAnnouncement: (...args: any[]) => (updateAnnouncementMock as any)(...args),
      updateDiscussionReply: (...args: any[]) => (updateDiscussionReplyMock as any)(...args),
    },
    assessments: {
      getQuizzes: vi.fn(async () => []),
      getExams: vi.fn(async () => []),
      getActivities: vi.fn(async () => []),
    },
    submissions: {
      getSubmissions: vi.fn(async () => []),
    },
    sections: {
      getSections: vi.fn(async () => []),
    },
    requests: {
      getRequests: vi.fn(async () => []),
    },
    folders: {
      getFolders: vi.fn(async () => []),
    },
    files: {
      getFiles: vi.fn(async () => []),
    },
    grades: {
      getGrades: vi.fn(async () => []),
    },
    spr: {
      getConfig: vi.fn(async () => null),
      getCells: vi.fn(async () => []),
    },
  },
  LIKHA_URL: 'https://gabay.zyberlab.com',
}));

import { LMSProvider, useLMS } from './LMSContext';

let testCtx: any = null;

const TestHarness: React.FC = () => {
  testCtx = useLMS();
  return <div data-testid="ready">Loaded</div>;
};

describe('Zero-Express LMS Operations in LMSContext', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    testCtx = null;
    try {
      localStorage.clear();
    } catch {}

    render(
      <LMSProvider>
        <TestHarness />
      </LMSProvider>
    );

    await act(async () => {
      await testCtx.login('faculty@dmmmsu.edu.ph', 'password');
    });

    await waitFor(() => {
      expect(testCtx.isAuthenticated).toBe(true);
    });
  });

  test('setGradesReleased updates state optimistically, calls likhaLmsApi.courses.updateCourse, never calls apiFetch', async () => {
    await act(async () => {
      await testCtx.setGradesReleased('c1', 'midterm', true);
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updateCourseMock).toHaveBeenCalledWith('c1', {
      grades_released: { midterm: true },
    });

    const updated = testCtx.db.courses.find((c: any) => c.id === 'c1');
    expect(updated?.gradesReleased).toEqual({ midterm: true });
    expect(screen.getByText(/midterm grades are now visible to students/i)).toBeTruthy();
  });

  test('setGradesReleased tolerates Likha rejection silently without rollback', async () => {
    updateCourseMock.mockRejectedValueOnce(new Error('Directus schema absence 403'));

    await act(async () => {
      await testCtx.setGradesReleased('c1', 'final', true);
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    const updated = testCtx.db.courses.find((c: any) => c.id === 'c1');
    expect(updated?.gradesReleased?.final).toBe(true);
  });

  test('editModuleComment updates state optimistically, calls likhaLmsApi.modules.updateComment, never calls apiFetch', async () => {
    await act(async () => {
      await testCtx.editModuleComment('m1', 'cm-1', 'Updated module comment content');
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updateCommentMock).toHaveBeenCalledWith('cm-1', {
      content: 'Updated module comment content',
    });

    const mod = testCtx.db.modules.find((m: any) => m.id === 'm1');
    const comment = mod?.comments?.find((c: any) => c.id === 'cm-1');
    expect(comment?.content).toBe('Updated module comment content');
  });

  test('deleteModuleComment filters comment from state, calls likhaLmsApi.modules.deleteComment, never calls apiFetch', async () => {
    await act(async () => {
      await testCtx.deleteModuleComment('m1', 'cm-1');
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(deleteCommentMock).toHaveBeenCalledWith('cm-1');

    const mod = testCtx.db.modules.find((m: any) => m.id === 'm1');
    const comment = mod?.comments?.find((c: any) => c.id === 'cm-1');
    expect(comment).toBeUndefined();
  });

  test('toggleLikeModuleComment toggles likedBy optimistically, calls likhaLmsApi.modules.updateComment, never calls apiFetch', async () => {
    await act(async () => {
      await testCtx.toggleLikeModuleComment('m1', 'cm-1');
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    const mod = testCtx.db.modules.find((m: any) => m.id === 'm1');
    const comment = mod?.comments?.find((c: any) => c.id === 'cm-1');
    expect(comment?.likedBy).toContain('u-fac-1');
    expect(comment?.likes).toBe(1);

    // Toggle off
    await act(async () => {
      await testCtx.toggleLikeModuleComment('m1', 'cm-1');
    });
    const modAfter = testCtx.db.modules.find((m: any) => m.id === 'm1');
    const commentAfter = modAfter?.comments?.find((c: any) => c.id === 'cm-1');
    expect(commentAfter?.likedBy).not.toContain('u-fac-1');
    expect(commentAfter?.likes).toBe(0);
  });

  test('toggleMessageReaction toggles reaction optimistically, calls likhaLmsApi.communications.updateMessageReaction, never calls apiFetch', async () => {
    await act(async () => {
      await testCtx.toggleMessageReaction('msg-1', '🔥');
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updateMessageReactionMock).toHaveBeenCalledWith('msg-1', '🔥');
    const msg = testCtx.db.messages.find((m: any) => m.id === 'msg-1');
    expect(msg?.reaction).toBe('🔥');

    // Toggle off by setting same reaction
    await act(async () => {
      await testCtx.toggleMessageReaction('msg-1', '🔥');
    });
    expect(updateMessageReactionMock).toHaveBeenCalledWith('msg-1', null);
    const msgAfter = testCtx.db.messages.find((m: any) => m.id === 'msg-1');
    expect(msgAfter?.reaction).toBeFalsy();
  });

  test('toggleLikeAnnouncement toggles likedBy optimistically, calls likhaLmsApi.communications.updateAnnouncement, never calls apiFetch', async () => {
    await act(async () => {
      await testCtx.toggleLikeAnnouncement('ann-1');
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updateAnnouncementMock).toHaveBeenCalledWith('ann-1', {
      liked_by: ['u-fac-1'],
      likes: 1,
    });

    const ann = testCtx.db.announcements.find((a: any) => a.id === 'ann-1');
    expect(ann?.likedBy).toContain('u-fac-1');
    expect(ann?.likes).toBe(1);
  });

  test('markAnnouncementRead marks readBy optimistically, calls likhaLmsApi.communications.updateAnnouncement, never calls apiFetch', async () => {
    await act(async () => {
      await testCtx.markAnnouncementRead('ann-1');
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updateAnnouncementMock).toHaveBeenCalledWith('ann-1', {
      read_by: ['u-fac-1'],
    });

    const ann = testCtx.db.announcements.find((a: any) => a.id === 'ann-1');
    expect(ann?.readBy).toContain('u-fac-1');
  });

  test('toggleLikeDiscussionReply toggles likedBy optimistically, calls likhaLmsApi.communications.updateDiscussionReply, never calls apiFetch', async () => {
    await act(async () => {
      await testCtx.toggleLikeDiscussionReply('d-1', 'dr-1');
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updateDiscussionReplyMock).toHaveBeenCalledWith('dr-1', {
      liked_by: ['u-fac-1'],
      likes: 1,
    });

    const disc = testCtx.db.discussions.find((d: any) => d.id === 'd-1');
    const reply = disc?.replies?.find((r: any) => r.id === 'dr-1');
    expect(reply?.likedBy).toContain('u-fac-1');
    expect(reply?.likes).toBe(1);
  });

  test('survives Likha schema absences and errors silently across all operations without showing error alerts', async () => {
    updateCommentMock.mockRejectedValue(new Error('Directus 404'));
    deleteCommentMock.mockRejectedValue(new Error('Directus 403'));
    updateMessageReactionMock.mockRejectedValue(new Error('Directus 400'));
    updateAnnouncementMock.mockRejectedValue(new Error('Directus 403'));
    updateDiscussionReplyMock.mockRejectedValue(new Error('Directus 404'));

    await act(async () => {
      await testCtx.editModuleComment('m1', 'cm-1', 'Silent fail edit');
      await testCtx.toggleLikeModuleComment('m1', 'cm-1');
      await testCtx.toggleMessageReaction('msg-1', '👍');
      await testCtx.toggleLikeAnnouncement('ann-1');
      await testCtx.markAnnouncementRead('ann-1');
      await testCtx.toggleLikeDiscussionReply('d-1', 'dr-1');
      await testCtx.deleteModuleComment('m1', 'cm-1');
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    // No error alerts thrown or displayed
    expect(testCtx.lastError).toBeNull();
  });
});
