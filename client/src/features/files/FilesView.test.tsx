// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  isLoading: false,
  isSyncing: false,
  uploadCourseFile: vi.fn(),
  deleteCourseFile: vi.fn(),
  deleteCourseFolder: vi.fn(),
  showConfirm: vi.fn((_msg: string, onConfirm: () => void) => onConfirm()),
  showAlert: vi.fn(),
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
    deleteCourseFile: mocks.deleteCourseFile,
    deleteCourseFolder: mocks.deleteCourseFolder,
    renameCourseFile: vi.fn(),
    showAlert: mocks.showAlert,
    showConfirm: mocks.showConfirm,
    markTabVisited: vi.fn(),
  }),
}));

import { FilesView } from './FilesView';

function renderPage() {
  return render(<FilesView />);
}

describe('FilesView refresh loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLoading = false;
    mocks.isSyncing = false;
    mocks.db.courseFiles = [];
    mocks.db.courseFolders = [];
    mocks.db.courses = [];
  });

  afterEach(() => {
    cleanup();
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test('renders the PDF with a client-side canvas renderer, avoiding bare iframe embedding', async () => {
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
    
    // Verifies client-side canvas viewer is used and no bare iframe or plugin embed exists
    const pdfViewer = screen.getByTestId('pdf-canvas-viewer');
    expect(pdfViewer).toBeInTheDocument();
    expect(screen.getByTestId('pdf-canvas')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('embed')).toBeNull();
    expect(document.querySelector('object')).toBeNull();
    expect(screen.queryByText(/Built-in PDF Reader/)).not.toBeInTheDocument();
    mocks.db.courseFiles = [];
  });
});

describe('FilesView file deletion loading indicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test('displays loading spinner and indicator while deleting a file', async () => {
    let resolveDelete: () => void = () => {};
    const deletePromise = new Promise<void>(resolve => {
      resolveDelete = resolve;
    });
    mocks.deleteCourseFile.mockImplementation(() => deletePromise);
    mocks.showConfirm.mockImplementation((_msg: string, onConfirm: () => void) => onConfirm());

    mocks.db.courseFiles = [
      {
        id: 'file-del-1',
        courseId: 'user-u-fac-1',
        folderId: null,
        name: 'Questionnaire.pdf',
        type: 'pdf',
        formattedSize: '611.2 KB',
        uploadedByName: 'Faculty',
        updatedAt: new Date().toISOString(),
        url: '/uploads/Questionnaire.pdf',
        visibility: 'published',
      },
    ];

    renderPage();
    expect(screen.getByText('Questionnaire.pdf')).toBeInTheDocument();

    const deleteBtn = screen.getByTitle('Delete File');
    fireEvent.click(deleteBtn);

    // Indicator should be visible while deletion is in-flight
    expect(screen.getByTestId('file-deleting-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('file-deleting-spinner')).toBeInTheDocument();
    expect(screen.getByText(/Deleting file.../i)).toBeInTheDocument();

    // Settle deletion
    resolveDelete();
    await waitFor(() => {
      expect(mocks.deleteCourseFile).toHaveBeenCalledWith('file-del-1');
    });
    mocks.db.courseFiles = [];
  });
});

describe('FilesView Cross-Section replication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

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
