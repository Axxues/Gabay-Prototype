// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  createActivity: vi.fn(),
  showAlert: vi.fn(),
  uploadCourseFile: vi.fn(),
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: { courses: [{ id: 'c1', code: 'CS 101' }] },
    createActivity: mocks.createActivity,
    showAlert: mocks.showAlert,
    uploadCourseFile: mocks.uploadCourseFile,
  }),
}));

import { CreateActivityPage } from './CreateActivityPage';

function renderPage() {
  return render(
    <CreateActivityPage courseId="c1" onBack={() => {}} onActivityCreated={() => {}} />
  );
}

function fillRequiredTitle() {
  const title = screen.getByPlaceholderText(/Activity 4/i);
  fireEvent.change(title, { target: { value: 'Activity 1: Basics' } });
}

describe('CreateActivityPage publish loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('publish button shows loading while the request is in flight', async () => {
    let resolveSave!: (v: { id: string }) => void;
    mocks.createActivity.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    renderPage();
    fillRequiredTitle();

    fireEvent.click(screen.getByRole('button', { name: 'Publish activity' }));

    // Both publish buttons (top bar + bottom bar) reflect the shared state.
    const loading = await screen.findAllByText(/publishing/i);
    expect(loading.length).toBeGreaterThan(0);

    resolveSave({ id: 'a1' });
    await waitFor(() => {
      expect(mocks.createActivity).toHaveBeenCalledTimes(1);
    });
  });

  test('double-clicking publish submits only once', async () => {
    let resolveSave!: (v: { id: string }) => void;
    mocks.createActivity.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    renderPage();
    fillRequiredTitle();

    const publish = screen.getByRole('button', { name: 'Publish activity' });
    fireEvent.click(publish);
    fireEvent.click(publish);

    resolveSave({ id: 'a1' });
    await waitFor(() => {
      expect(mocks.createActivity).toHaveBeenCalledTimes(1);
    });
  });

  test('stages attached file locally and only uploads when activity is published', async () => {
    mocks.createActivity.mockResolvedValueOnce({ id: 'a1' });
    mocks.uploadCourseFile.mockResolvedValueOnce({
      id: 'f1',
      name: 'lab1.pdf',
      formattedSize: '15.0 KB',
      fileUrl: '/uploads/lab1.pdf'
    });

    const { container } = renderPage();
    fillRequiredTitle();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const fakeFile = new File(['dummy lab content'], 'lab1.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    // File is staged in UI, but uploadCourseFile should NOT be called yet
    expect(screen.getByText('lab1.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Attached/i)).toBeInTheDocument();
    expect(mocks.uploadCourseFile).not.toHaveBeenCalled();

    // Now publish the activity
    const publish = screen.getByRole('button', { name: 'Publish activity' });
    fireEvent.click(publish);

    await waitFor(() => {
      expect(mocks.uploadCourseFile).toHaveBeenCalledTimes(1);
      expect(mocks.uploadCourseFile).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          name: 'lab1.pdf',
          rawFile: fakeFile,
          area: 'activities'
        })
      );
      expect(mocks.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          fileName: 'lab1.pdf',
          fileUrl: '/uploads/lab1.pdf'
        })
      );
    });
  });
});
