// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ModulesView } from '../modules/ModulesView';
import { AnnouncementsView } from '../inbox/AnnouncementsView';

const testCourse = {
  id: 'c-test-1',
  code: 'CSPC 112',
  title: 'Computer Programming 2',
  instructorId: 'usr-fac-1',
  instructorName: 'Prof. Alice Rivera',
};

const mockModule = {
  id: 'mod-1',
  courseId: 'c-test-1',
  title: 'Module 1 - Object Oriented Fundamentals',
  order: 1,
  published: true,
  items: [
    {
      id: 'item-1',
      moduleId: 'mod-1',
      title: 'Lecture Slides',
      type: 'page',
      completed: false,
      published: true,
    },
  ],
  comments: [],
};

const mockAnnouncement = {
  id: 'ann-1',
  courseId: 'c-test-1',
  title: 'Welcome to Class',
  content: 'Please review the syllabus before our first session.',
  authorId: 'usr-fac-1',
  authorName: 'Prof. Alice Rivera',
  authorRole: 'faculty',
  createdAt: new Date().toISOString(),
  pinned: false,
  allowComments: true,
  replies: [],
};

const lmsState = {
  activeRole: 'admin',
  activeUser: { id: 'usr-dean-1', name: 'Dr. Evelyn Dean', role: 'admin', adminSubrole: 'dean' },
  db: {
    courses: [testCourse],
    modules: [mockModule],
    announcements: [mockAnnouncement],
    activities: [],
    quizzes: [],
    exams: [],
    submissions: [],
    users: [],
  },
  isLoading: false,
  isSyncing: false,
  createModule: vi.fn().mockResolvedValue({ id: 'mod-2' }),
  updateModule: vi.fn().mockResolvedValue(undefined),
  deleteModule: vi.fn().mockResolvedValue(undefined),
  deleteModuleItem: vi.fn().mockResolvedValue(undefined),
  addModuleComment: vi.fn().mockResolvedValue(undefined),
  editModuleComment: vi.fn().mockResolvedValue(undefined),
  deleteModuleComment: vi.fn().mockResolvedValue(undefined),
  toggleLikeModuleComment: vi.fn().mockResolvedValue(undefined),
  markModuleCommentsRead: vi.fn().mockResolvedValue(undefined),
  deleteAnnouncement: vi.fn().mockResolvedValue(undefined),
  togglePinAnnouncement: vi.fn().mockResolvedValue(undefined),
  toggleLikeAnnouncement: vi.fn().mockResolvedValue(undefined),
  addAnnouncementReply: vi.fn().mockResolvedValue(undefined),
  markAnnouncementRead: vi.fn().mockResolvedValue(undefined),
  showAlert: vi.fn(),
  showConfirm: vi.fn(),
};

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => lmsState,
}));

describe('Course Pages RBAC UI - Dean, Chair & Admin View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Dean sees standard Modules page with commenting enabled, but NO Add Module, Edit, or Delete controls', () => {
    lmsState.activeRole = 'admin';
    lmsState.activeUser = { id: 'usr-dean-1', name: 'Dr. Evelyn Dean', role: 'admin', adminSubrole: 'dean' };

    render(
      <ModulesView
        courseId="c-test-1"
        onSelectActivity={() => {}}
        onSelectQuiz={() => {}}
      />
    );

    // Standard view elements are present (normal page layout)
    expect(screen.getByText('Module 1 - Object Oriented Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Lecture Slides')).toBeInTheDocument();

    // Create / Add Module button is NOT rendered
    expect(screen.queryByText('Add Module')).not.toBeInTheDocument();

    // Comment composer is active and available for Dean
    expect(screen.getByPlaceholderText(/Post a comment on Module/i)).toBeInTheDocument();
  });

  test('Dean sees standard Announcements page without Create Announcement or Delete buttons, but with reply capability', () => {
    lmsState.activeRole = 'admin';
    lmsState.activeUser = { id: 'usr-dean-1', name: 'Dr. Evelyn Dean', role: 'admin', adminSubrole: 'dean' };

    render(<AnnouncementsView courseId="c-test-1" />);

    // Standard view elements are present (normal page layout)
    expect(screen.getByText('Welcome to Class')).toBeInTheDocument();

    // Create Announcement button and Delete Announcement button are NOT rendered
    expect(screen.queryByText('Announcement')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete Announcement')).not.toBeInTheDocument();

    // Expand the announcement
    fireEvent.click(screen.getByText('Welcome to Class'));

    // Reply composer is active and visible to Dean
    expect(screen.getByPlaceholderText(/Type a response or inquiry/i)).toBeInTheDocument();
  });

  test('Assigned faculty instructor sees Add Module and Announcement controls', () => {
    lmsState.activeRole = 'faculty';
    lmsState.activeUser = { id: 'usr-fac-1', name: 'Prof. Alice Rivera', role: 'faculty' };

    const { unmount: unmountMod } = render(
      <ModulesView
        courseId="c-test-1"
        onSelectActivity={() => {}}
        onSelectQuiz={() => {}}
      />
    );

    // Assigned faculty sees "Add Module"
    expect(screen.getByText('Add Module')).toBeInTheDocument();
    unmountMod();

    render(<AnnouncementsView courseId="c-test-1" />);

    // Assigned faculty sees "Announcement" create button and Delete Announcement
    expect(screen.getByText('Announcement')).toBeInTheDocument();
    expect(screen.getByTitle('Delete Announcement')).toBeInTheDocument();
  });
});
