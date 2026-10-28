// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  isSyncing: false,
  announcements: [] as any[],
  courseFiles: [] as any[],
  activeRole: 'student',
  activeUser: { id: 'u-stud-1', name: 'Student', role: 'student' },
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: mocks.activeUser,
    activeRole: mocks.activeRole,
    db: { courses: [{ id: 'c1', code: 'CS 101' }], announcements: mocks.announcements, courseFiles: mocks.courseFiles },
    isLoading: mocks.isLoading,
    isSyncing: mocks.isSyncing,
    deleteAnnouncement: vi.fn(),
    togglePinAnnouncement: vi.fn(),
    toggleLikeAnnouncement: vi.fn(),
    addAnnouncementReply: vi.fn(),
    markAnnouncementRead: vi.fn().mockResolvedValue(undefined),
    showConfirm: vi.fn(),
  }),
  loadStoredAnnouncementAttachments: () => [],
  getCleanStoredAvatar: () => '',
}));

import { AnnouncementsView } from './AnnouncementsView';

function renderPage() {
  return render(<AnnouncementsView courseId="c1" />);
}

describe('AnnouncementsView refresh loading', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
  });

  test('shows loading skeleton (not empty text) while bootstrapping', () => {
    mocks.isLoading = true;
    renderPage();
    expect(screen.getByTestId('announcements-loading')).toBeInTheDocument();
    expect(screen.queryByText(/no announcements found/i)).not.toBeInTheDocument();
  });

  test('shows loading skeleton while background sync fills announcements', () => {
    mocks.isSyncing = true;
    renderPage();
    expect(screen.getByTestId('announcements-loading')).toBeInTheDocument();
  });

  test('shows empty state only once loading settles', () => {
    renderPage();
    expect(screen.getByText(/no announcements found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('announcements-loading')).not.toBeInTheDocument();
  });
});

describe('AnnouncementsView attachments visibility for students', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.activeRole = 'student';
    mocks.activeUser = { id: 'u-stud-1', name: 'Student 1', role: 'student' };
    mocks.announcements = [];
    mocks.courseFiles = [];
  });

  test('student sees both attached image and attached documents loaded from announcement.attachments', () => {
    mocks.announcements = [
      {
        id: 'ann-1',
        courseId: 'c1',
        title: 'Test Announcement 1',
        content: 'Heyy there',
        authorId: 'u-fac-1',
        authorName: 'Raymund Dilan',
        createdAt: '2025-01-01T00:00:00.000Z',
        pinned: false,
        replies: [],
        attachments: [
          {
            name: 'Diagram.png',
            size: '176.9 KB',
            url: 'https://gabay.zyberlab.com/assets/a0a300fe-03b9-47c2-9021-108cded9d9fa',
          },
          {
            name: 'ThesisManuscript-AntiCheating.docx',
            size: '3.8 MB',
            url: 'https://gabay.zyberlab.com/assets/cef73bc5-d004-44cc-bcaf-8bcaa24e07d6',
          },
          {
            name: 'Application for Ethics Review.pdf',
            size: '1.4 MB',
            url: 'https://gabay.zyberlab.com/assets/ca6f1fff-f684-4260-ac76-e4e838a21eb2',
          },
        ],
      },
    ];

    renderPage();

    expect(screen.getByText('Test Announcement 1')).toBeInTheDocument();
    expect(screen.getAllByText('Heyy there').length).toBeGreaterThan(0);
    expect(screen.getByText(/Attached Image \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Diagram.png')).toBeInTheDocument();
    expect(screen.getByText(/Attached Documents & Handouts \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('ThesisManuscript-AntiCheating.docx')).toBeInTheDocument();
    expect(screen.getByText('Application for Ethics Review.pdf')).toBeInTheDocument();
  });

  test('student sees attachments resolved from courseFiles matching sourceId when attachments array is absent', () => {
    mocks.announcements = [
      {
        id: 'ann-2',
        courseId: 'c1',
        title: 'Announcement With Course Files',
        content: 'Course files fallback test',
        authorId: 'u-fac-1',
        authorName: 'Raymund Dilan',
        createdAt: '2025-01-01T00:00:00.000Z',
        pinned: false,
        replies: [],
        attachments: [],
      },
    ];
    mocks.courseFiles = [
      {
        id: 'cf-1',
        courseId: 'c1',
        name: 'Handout.pdf',
        formattedSize: '500 KB',
        size: 512000,
        type: 'pdf',
        visibility: 'published',
        sourceArea: 'announcements',
        sourceId: 'ann-2',
        url: 'https://gabay.zyberlab.com/assets/ca6f1fff-f684-4260-ac76-e4e838a21eb2',
      },
    ];

    renderPage();

    expect(screen.getByText('Announcement With Course Files')).toBeInTheDocument();
    expect(screen.getByText(/Attached Documents & Handouts \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Handout.pdf')).toBeInTheDocument();
  });
});
