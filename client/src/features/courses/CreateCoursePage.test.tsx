// @vitest-environment jsdom
import { describe, expect, test, vi, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

afterEach(() => {
  cleanup();
});

const createCourseMock = vi.fn().mockImplementation(async (data: any) => ({
  id: 'crs-math101',
  code: data.code,
  section: data.section,
}));
const uploadFileToPublicMock = vi.fn().mockResolvedValue({
  name: 'custom_banner.png',
  size: '1.2 MB',
  url: '/uploads/custom_banner.png',
  isImage: true,
});

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    activeUser: { id: 'u1', name: 'Eleanor', email: 'eleanor@example.com', department: 'Computer Science' },
    db: { courses: [] },
    createCourse: createCourseMock,
    showAlert: vi.fn(),
  }),
  generateCourseJoinCode: (_courses: any[], prefix?: string) => `${prefix || 'GBY'}-TEST`,
}));

vi.mock('../../shared/utils/fileUploader', () => ({
  uploadFileToPublic: (...args: any[]) => (uploadFileToPublicMock as any)(...args),
  isImageFile: () => true,
  formatFileSize: (b: number) => `${(b / 1024).toFixed(1)} KB`,
}));

import { CreateCoursePage } from './CreateCoursePage';

describe('CreateCoursePage', () => {
  test('renders with empty input fields instead of preplaced mock data', () => {
    render(
      <CreateCoursePage
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    // Course code input should be empty
    const codeInput = screen.getByPlaceholderText(/CMSC 180/i) as HTMLInputElement;
    expect(codeInput.value).toBe('');

    // Section input should be empty
    const sectionInput = screen.getByPlaceholderText(/4-E/i) as HTMLInputElement;
    expect(sectionInput.value).toBe('');

    // Course title input should be empty
    const titleInput = screen.getByPlaceholderText(/Artificial Intelligence/i) as HTMLInputElement;
    expect(titleInput.value).toBe('');

    // Description textarea should be empty
    const descTextarea = screen.getByPlaceholderText(/Provide an overview of the course syllabus/i) as HTMLTextAreaElement;
    expect(descTextarea.value).toBe('');

    // Join code input should be empty (auto-generated on submission) and readOnly
    const joinCodeInput = screen.getByPlaceholderText(/Auto-generated/i) as HTMLInputElement;
    expect(joinCodeInput.value).toBe('');
    expect(joinCodeInput.readOnly).toBe(true);

    // Accent color text input should be empty
    const colorInput = screen.getByPlaceholderText(/No color selected/i) as HTMLInputElement;
    expect(colorInput.value).toBe('');
  });

  test('regenerate button generates a join code based on entered course code', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <CreateCoursePage
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    const codeInput = screen.getByPlaceholderText(/CMSC 180/i);
    const joinCodeInput = screen.getByPlaceholderText(/Auto-generated/i) as HTMLInputElement;

    expect(joinCodeInput.value).toBe('');

    // Enter a course code
    fireEvent.change(codeInput, { target: { value: 'MATH 101' } });

    // Click Regenerate
    const regenBtn = screen.getByRole('button', { name: /Regenerate/i });
    fireEvent.click(regenBtn);

    expect(joinCodeInput.value).toBe('MATH 101-TEST');
  });

  test('submitting with valid inputs calls createCourse and generates join code if empty', async () => {
    const { fireEvent, act } = await import('@testing-library/react');
    const onNavigateCourse = vi.fn();

    render(
      <CreateCoursePage
        onNavigateCourse={onNavigateCourse}
        onNavigateTab={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/CMSC 180/i), { target: { value: 'MATH 101' } });
    fireEvent.change(screen.getByPlaceholderText(/4-E/i), { target: { value: 'M1' } });
    fireEvent.change(screen.getByPlaceholderText(/Artificial Intelligence/i), { target: { value: 'Calculus I' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create course shell/i }));
    });

    expect(createCourseMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MATH 101',
      section: 'M1',
      title: 'Calculus I',
      joinCode: 'MATH 101-TEST',
      schoolYear: '2025-2026',
    }));
  });

  test('renders School Year selector with active default and allows changing school year', async () => {
    const { fireEvent, act } = await import('@testing-library/react');
    const onNavigateCourse = vi.fn();

    render(
      <CreateCoursePage
        onNavigateCourse={onNavigateCourse}
        onNavigateTab={vi.fn()}
      />
    );

    const syBtn = screen.getByTestId('create-course-school-year');
    expect(syBtn).toHaveTextContent(/2025-2026/);

    fireEvent.change(screen.getByPlaceholderText(/CMSC 180/i), { target: { value: 'CS 201' } });
    fireEvent.change(screen.getByPlaceholderText(/4-E/i), { target: { value: '2-A' } });
    fireEvent.change(screen.getByPlaceholderText(/Artificial Intelligence/i), { target: { value: 'Data Structures' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create course shell/i }));
    });

    expect(createCourseMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'CS 201',
      section: '2-A',
      title: 'Data Structures',
      schoolYear: '2025-2026',
    }));
  });

  test('switching to Upload File tab stages image locally and only uploads when course is created', async () => {
    const { fireEvent, act, waitFor } = await import('@testing-library/react');

    render(
      <CreateCoursePage
        onNavigateCourse={vi.fn()}
        onNavigateTab={vi.fn()}
      />
    );

    // Switch to Upload File tab
    const uploadTabBtn = screen.getByRole('button', { name: /upload file/i });
    fireEvent.click(uploadTabBtn);

    // Initially shows dropzone
    expect(screen.getByText(/click to browse or drag & drop/i)).toBeInTheDocument();

    // Find the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const fakeFile = new File(['dummy-content'], 'banner.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    });

    // Preview should now be shown locally
    await waitFor(() => {
      expect(screen.getByAltText('Uploaded course cover')).toBeInTheDocument();
    });

    // File is staged: uploadFileToPublic should NOT be called yet!
    expect(uploadFileToPublicMock).not.toHaveBeenCalled();

    // Filename and indicator should be visible
    expect(screen.getByText('banner.png')).toBeInTheDocument();
    expect(screen.getByText(/uploaded & ready/i)).toBeInTheDocument();

    // Clicking remove clears the image and returns to dropzone
    const removeBtns = screen.getAllByRole('button', { name: /^remove$/i });
    expect(removeBtns.length).toBeGreaterThan(0);
    fireEvent.click(removeBtns[0]);

    expect(screen.getByText(/click to browse or drag & drop/i)).toBeInTheDocument();
    expect(screen.queryByAltText('Uploaded course cover')).not.toBeInTheDocument();

    // Stage file again and submit course creation to verify upload is deferred until submit
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    });

    await waitFor(() => {
      expect(screen.getByAltText('Uploaded course cover')).toBeInTheDocument();
    });

    // Not uploaded yet
    expect(uploadFileToPublicMock).not.toHaveBeenCalled();

    // Fill required course inputs
    fireEvent.change(screen.getByPlaceholderText(/CMSC 180/i), { target: { value: 'CMSC 101' } });
    fireEvent.change(screen.getByPlaceholderText(/4-E/i), { target: { value: '1-A' } });
    fireEvent.change(screen.getByPlaceholderText(/Artificial Intelligence/i), { target: { value: 'Intro to CS' } });

    // Submit course creation
    const submitBtn = screen.getByRole('button', { name: /create course shell/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Now upload should have occurred upon saving
    await waitFor(() => {
      expect(uploadFileToPublicMock).toHaveBeenCalledTimes(1);
      expect(uploadFileToPublicMock).toHaveBeenCalledWith(fakeFile);
      expect(createCourseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CMSC 101',
          section: '1-A',
          image: '/uploads/custom_banner.png'
        })
      );
    });
  });
});

