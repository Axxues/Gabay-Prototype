// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  createAnnouncement: vi.fn(),
  showAlert: vi.fn(),
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
  }),
}));

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
});
