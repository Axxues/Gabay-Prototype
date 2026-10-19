// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  isSyncing: false,
  uploadCourseFile: vi.fn(),
  db: {
    courses: [],
    courseFolders: [],
    courseFiles: [],
    modules: [],
    announcements: [],
    activities: [],
    quizzes: [],
    users: [],
  } as any,
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeRole: 'faculty',
    activeUser: { id: 'u-fac-1', name: 'Faculty', role: 'faculty' },
    db: mocks.db,
    isLoading: mocks.isLoading,
    isSyncing: mocks.isSyncing,
    createCourseFolder: vi.fn(),
    uploadCourseFile: mocks.uploadCourseFile,
    deleteCourseFile: vi.fn(),
    deleteCourseFolder: vi.fn(),
    renameCourseFile: vi.fn(),
    showAlert: vi.fn(),
    showConfirm: vi.fn(),
    markTabVisited: vi.fn(),
  }),
}));

import { FilesView } from './FilesView';

function renderPage() {
  return render(<FilesView />);
}

describe('FilesView refresh loading', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isSyncing = false;
  });

  test('shows loading skeleton (not empty text) while bootstrapping', () => {
    mocks.isLoading = true;
    renderPage();
    expect(screen.getByTestId('files-loading')).toBeInTheDocument();
    expect(screen.queryByText(/this folder is currently empty/i)).not.toBeInTheDocument();
  });

  test('shows loading skeleton while background sync fills files', () => {
    mocks.isSyncing = true;
    renderPage();
    expect(screen.getByTestId('files-loading')).toBeInTheDocument();
  });

  test('shows empty state only once loading settles', () => {
    renderPage();
    expect(screen.getByText(/this folder is currently empty/i)).toBeInTheDocument();
    expect(screen.queryByTestId('files-loading')).not.toBeInTheDocument();
  });
});

describe('FilesView PDF preview', () => {
  test('renders the actual PDF in an iframe, not placeholder text', () => {
    mocks.db.courseFiles = [
      {
        id: 'file-pdf-1',
        courseId: 'user-u-fac-1',
        folderId: null,
        name: 'handout.pdf',
        type: 'pdf',
        formattedSize: '1.0 MB',
        uploadedByName: 'Faculty',
        updatedAt: new Date().toISOString(),
        url: '/uploads/c1/handout.pdf',
        fileUrl: '/uploads/c1/handout.pdf',
        visibility: 'published',
      },
    ];
    renderPage();
    fireEvent.click(screen.getByTitle('Preview File'));
    const frame = screen.getByTitle('handout.pdf');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', '/uploads/c1/handout.pdf');
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    expect(screen.queryByText(/Built-in PDF Reader/)).not.toBeInTheDocument();
    mocks.db.courseFiles = [];
  });
});

describe('FilesView Cross-Section replication', () => {
  test('prompts with CrossSectionPromptModal and uploads file to selected sibling courses', async () => {
    mocks.uploadCourseFile.mockResolvedValue({ id: 'f-new' });
    mocks.db.courses = [
      {
        id: 'c1',
        code: 'CS101',
        title: 'Computer Science 1',
        section: 'BSCS 3-1',
        schoolYear: '2026-2027',
        term: '1st Semester',
        instructorId: 'u-fac-1',
      },
      {
        id: 'c2',
        code: 'CS101',
        title: 'Computer Science 1',
        section: 'BSCS 3-2',
        schoolYear: '2026-2027',
        term: '1st Semester',
        instructorId: 'u-fac-1',
      },
    ];

    render(<FilesView courseId="c1" />);

    // Simulate file input change
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['content'], 'lecture1.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, {
      target: {
        files: [fakeFile],
      },
    });

    expect(await screen.findByText(/Replicate Course File Across Sections/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(mocks.uploadCourseFile).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c1', name: 'lecture1.pdf' })
      );
      expect(mocks.uploadCourseFile).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c2', name: 'lecture1.pdf' })
      );
    });
  });
});
