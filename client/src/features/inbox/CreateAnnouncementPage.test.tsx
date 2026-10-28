// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  createAnnouncement: vi.fn(),
  showAlert: vi.fn(),
  uploadCourseFile: vi.fn(),
  mockCourses: [
    {
      id: 'c1',
      code: 'CS 101',
      title: 'Data Structures',
      section: 'BSCS 3-1',
      schoolYear: '2026-2027',
      term: '1st Semester',
      instructorId: 'inst-1',
    },
    {
      id: 'c2',
      code: 'CS 101',
      title: 'Data Structures',
      section: 'BSCS 3-2',
      schoolYear: '2026-2027',
      term: '1st Semester',
      instructorId: 'inst-1',
    },
  ],
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: { courses: mocks.mockCourses },
    activeUser: { id: 'inst-1', name: 'Dr. Santos', role: 'faculty' },
    createAnnouncement: mocks.createAnnouncement,
    showAlert: mocks.showAlert,
    uploadCourseFile: mocks.uploadCourseFile,
  }),
}));

vi.mock('../../shared/utils/fileUploader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/utils/fileUploader')>();
  return {
    ...actual,
    uploadFileToPublic: vi.fn(async (file: File) => ({
      name: file.name,
      size: `${file.size} B`,
      url: `/uploads/${file.name}`,
    })),
  };
});

import { CreateAnnouncementPage } from './CreateAnnouncementPage';

function renderPage(courseId = 'c1') {
  return render(
    <CreateAnnouncementPage courseId={courseId} onBack={() => {}} onAnnouncementCreated={() => {}} />
  );
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText(/Schedule for Midterm/i), {
    target: { value: 'Midterm schedule' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Draft your announcement/i), {
    target: { value: 'Midterms move to Friday.' },
  });
}

describe('CreateAnnouncementPage cross-section sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test('prompts with CrossSectionPromptModal when sibling section exists and replicates to selected', async () => {
    mocks.createAnnouncement.mockResolvedValue({ id: 'an1' });
    renderPage();
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Publish announcement' }));

    // Interstitial modal should appear
    expect(await screen.findByText(/Replicate Announcement Across Sections/i)).toBeInTheDocument();
    expect(screen.getByText(/BSCS 3-2/)).toBeInTheDocument();

    // Confirm replication
    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(mocks.createAnnouncement).toHaveBeenCalledTimes(2);
      expect(mocks.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c1', title: 'Midterm schedule' })
      );
      expect(mocks.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c2', title: 'Midterm schedule' })
      );
    });
  });

  test('allows publishing only to current section from interstitial modal', async () => {
    mocks.createAnnouncement.mockResolvedValue({ id: 'an1' });
    renderPage();
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: 'Publish announcement' }));

    expect(await screen.findByText(/Replicate Announcement Across Sections/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Publish to Current Section Only/i }));

    await waitFor(() => {
      expect(mocks.createAnnouncement).toHaveBeenCalledTimes(1);
      expect(mocks.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c1', title: 'Midterm schedule' })
      );
    });
  });

  test('allows uploading multiple files and submitting them as attachments', async () => {
    mocks.createAnnouncement.mockResolvedValue({ id: 'an1' });
    const { container } = renderPage('c1');
    fillRequiredFields();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toHaveAttribute('multiple');

    const file1 = new File(['content1'], 'handout1.pdf', { type: 'application/pdf' });
    const file2 = new File(['content2'], 'handout2.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    expect(await screen.findByText('handout1.pdf')).toBeInTheDocument();
    expect(await screen.findByText('handout2.docx')).toBeInTheDocument();
    expect(screen.getByText(/Attach file \/ handout \(2\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publish announcement' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish to Current Section Only/i }));

    await waitFor(() => {
      expect(mocks.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            expect.objectContaining({ name: 'handout1.pdf' }),
            expect.objectContaining({ name: 'handout2.docx' }),
          ],
        })
      );
    });
  });

  test('stages files locally and only uploads to Likha ERP when the post is published', async () => {
    mocks.createAnnouncement.mockResolvedValue({ id: 'an1' });
    mocks.uploadCourseFile.mockImplementation(async (params: any) => ({
      id: 'file-101',
      name: params.name,
      fileUrl: `https://gabay.zyberlab.com/assets/${params.name}`,
      size: params.size,
      formattedSize: params.formattedSize || '15 KB',
    }));

    const { container } = renderPage('c1');
    fillRequiredFields();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const content = new Uint8Array(15360); // 15 KB
    const file = new File([content], 'Questionnaire.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Staged in UI immediately without uploading
    expect(await screen.findByText('Questionnaire.pdf')).toBeInTheDocument();
    expect(screen.getByText('15 KB')).toBeInTheDocument();
    expect(screen.queryByText('0 B')).not.toBeInTheDocument();

    // Verify Likha ERP was NOT called yet while drafting
    expect(mocks.uploadCourseFile).not.toHaveBeenCalled();

    // Now publish the announcement
    fireEvent.click(screen.getByRole('button', { name: 'Publish announcement' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish to Current Section Only/i }));

    // Verify Likha ERP upload was executed when post was saved
    await waitFor(() => {
      expect(mocks.uploadCourseFile).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          name: 'Questionnaire.pdf',
          size: 15360,
          formattedSize: '15 KB',
        })
      );
      expect(mocks.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            expect.objectContaining({
              name: 'Questionnaire.pdf',
              size: '15 KB',
            }),
          ],
        })
      );
    });
  });

  test('includes directus_files_id in attachments payload when file upload resolves asset URL', async () => {
    mocks.createAnnouncement.mockResolvedValue({ id: 'an1' });
    mocks.uploadCourseFile.mockResolvedValue({
      fileUrl: 'https://gabay.zyberlab.com/assets/a0a300fe-03b9-47c2-9021-108cded9d9fa',
      fileId: 'a0a300fe-03b9-47c2-9021-108cded9d9fa',
      formattedSize: '176.9 KB',
    });

    const { container } = renderPage();
    fillRequiredFields();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(181120)], 'Diagram.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByText('Diagram.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publish announcement' }));
    fireEvent.click(await screen.findByRole('button', { name: /Publish to Current Section Only/i }));

    await waitFor(() => {
      expect(mocks.createAnnouncement).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            expect.objectContaining({
              name: 'Diagram.png',
              directus_files_id: 'a0a300fe-03b9-47c2-9021-108cded9d9fa',
            }),
          ],
        })
      );
    });
  });
});
