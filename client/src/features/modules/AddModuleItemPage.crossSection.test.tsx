// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  createModule: vi.fn(),
  addModuleItem: vi.fn(),
  createActivity: vi.fn(),
  createQuiz: vi.fn(),
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
      syllabus: {} as any,
    },
    {
      id: 'c2',
      code: 'CS 101',
      title: 'Data Structures',
      section: 'BSCS 3-2',
      schoolYear: '2026-2027',
      term: '1st Semester',
      instructorId: 'inst-1',
      syllabus: {} as any,
    },
  ],
  mockModules: [
    {
      id: 'm1',
      courseId: 'c1',
      title: 'Week 1: Introduction',
      order: 1,
      published: true,
      items: [],
    },
    {
      id: 'm2',
      courseId: 'c2',
      title: 'Week 1: Introduction',
      order: 1,
      published: true,
      items: [],
    },
  ],
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: {
      courses: mocks.mockCourses,
      modules: mocks.mockModules,
    },
    activeUser: { id: 'inst-1', name: 'Dr. Santos', role: 'faculty' },
    activeRole: 'faculty',
    createModule: mocks.createModule,
    addModuleItem: mocks.addModuleItem,
    createActivity: mocks.createActivity,
    createQuiz: mocks.createQuiz,
    showAlert: mocks.showAlert,
    effectiveTermsForCourse: () => ['midterm'],
  }),
}));

import { AddModuleItemPage } from './AddModuleItemPage';

function renderPage(initialType: 'page' | 'activity' | 'quiz' = 'page') {
  return render(
    <AddModuleItemPage
      courseId="c1"
      moduleId="m1"
      initialType={initialType}
      onBack={() => {}}
    />
  );
}

describe('AddModuleItemPage cross-section sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('prompts with CrossSectionPromptModal and replicates page item to matching module in sibling section', async () => {
    mocks.addModuleItem.mockResolvedValue(undefined);
    renderPage('page');

    const titleInput = screen.getByPlaceholderText(/Chapter 4/i);
    fireEvent.change(titleInput, { target: { value: 'Introduction Lecture' } });

    fireEvent.click(screen.getByRole('button', { name: /Save & add to module/i }));

    expect(await screen.findByText(/Replicate Module Item Across Sections/i)).toBeInTheDocument();
    expect(screen.getByText(/BSCS 3-2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(mocks.addModuleItem).toHaveBeenCalledTimes(2);
      expect(mocks.addModuleItem).toHaveBeenCalledWith('m1', expect.objectContaining({ title: 'Introduction Lecture' }));
      expect(mocks.addModuleItem).toHaveBeenCalledWith('m2', expect.objectContaining({ title: 'Introduction Lecture' }));
    });
  });

  test('automatically creates parent module in target section if missing before adding item', async () => {
    mocks.addModuleItem.mockResolvedValue(undefined);
    mocks.createModule.mockResolvedValue({ id: 'm-new-2', title: 'Week 1: Introduction' });

    // Temporarily clear modules in c2
    const originalModules = [...mocks.mockModules];
    mocks.mockModules.length = 1; // only m1 in c1

    renderPage('page');

    const titleInput = screen.getByPlaceholderText(/Chapter 4/i);
    fireEvent.change(titleInput, { target: { value: 'Reading Assignment' } });

    fireEvent.click(screen.getByRole('button', { name: /Save & add to module/i }));

    expect(await screen.findByText(/Replicate Module Item Across Sections/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(mocks.createModule).toHaveBeenCalledWith('c2', 'Week 1: Introduction');
      expect(mocks.addModuleItem).toHaveBeenCalledWith('m-new-2', expect.objectContaining({ title: 'Reading Assignment' }));
    });

    mocks.mockModules.push(originalModules[1]);
  });
});
