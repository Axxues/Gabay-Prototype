import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrossSectionPromptModal } from './CrossSectionPromptModal';
import type { Course } from '../../types/lms';

describe('CrossSectionPromptModal', () => {
  const siblings: Course[] = [
    {
      id: 'c2',
      code: 'CS 101',
      title: 'Data Structures and Algorithms',
      section: 'BSCS 3-2',
      term: '1st Semester',
      schoolYear: '2026-2027',
      instructorId: 'inst-1',
      instructorName: 'Dr. Santos',
      published: true,
      enrolledCount: 25,
    },
    {
      id: 'c3',
      code: 'CS 101',
      title: 'Data Structures and Algorithms',
      section: 'BSCS 3-3',
      term: '1st Semester',
      schoolYear: '2026-2027',
      instructorId: 'inst-1',
      instructorName: 'Dr. Santos',
      published: true,
      enrolledCount: 30,
    },
  ];

  it('renders section options with select-all and calls onConfirm with selected course IDs', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSkip = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CrossSectionPromptModal
        isOpen={true}
        onClose={onClose}
        itemType="announcement"
        itemTitle="Midterm Exam Guidelines"
        siblingCourses={siblings}
        onConfirm={onConfirm}
        onSkipToCurrentOnly={onSkip}
      />
    );

    expect(screen.getByText(/BSCS 3-2/)).toBeInTheDocument();
    expect(screen.getByText(/BSCS 3-3/)).toBeInTheDocument();

    // Sibling sections are pre-selected by default
    const confirmButton = screen.getByRole('button', { name: /Publish to Selected Sections/i });
    expect(confirmButton).toBeInTheDocument();
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith(['c2', 'c3']);
  });

  it('allows unchecking a section before confirming', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSkip = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CrossSectionPromptModal
        isOpen={true}
        onClose={onClose}
        itemType="module"
        itemTitle="Module 1"
        siblingCourses={siblings}
        onConfirm={onConfirm}
        onSkipToCurrentOnly={onSkip}
      />
    );

    const checkbox32 = screen.getByLabelText(/BSCS 3-2/i);
    fireEvent.click(checkbox32); // uncheck c2

    const confirmButton = screen.getByRole('button', { name: /Publish to Selected Sections/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith(['c3']);
  });

  it('calls onSkipToCurrentOnly when clicking post to this course only', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSkip = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CrossSectionPromptModal
        isOpen={true}
        onClose={onClose}
        itemType="assessment"
        itemTitle="Quiz 1"
        siblingCourses={siblings}
        onConfirm={onConfirm}
        onSkipToCurrentOnly={onSkip}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Publish to Current Section Only/i }));
    expect(onSkip).toHaveBeenCalled();
  });

  it('calls onClose when dismissed', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSkip = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <CrossSectionPromptModal
        isOpen={true}
        onClose={onClose}
        itemType="file"
        itemTitle="Syllabus.pdf"
        siblingCourses={siblings}
        onConfirm={onConfirm}
        onSkipToCurrentOnly={onSkip}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
