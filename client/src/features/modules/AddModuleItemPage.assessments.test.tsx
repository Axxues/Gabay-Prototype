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
  ],
}));

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: {
      courses: mocks.mockCourses,
      modules: mocks.mockModules,
      activities: [],
      quizzes: [],
    },
    activeUser: { id: 'inst-1', name: 'Professor' },
    activeRole: 'faculty',
    createModule: mocks.createModule,
    addModuleItem: mocks.addModuleItem,
    createActivity: mocks.createActivity,
    createQuiz: mocks.createQuiz,
    uploadCourseFile: mocks.uploadCourseFile,
    showAlert: mocks.showAlert,
    effectiveTermsForCourse: () => ['midterm', 'finals'],
  }),
}));

import { AddModuleItemPage } from './AddModuleItemPage';

describe('AddModuleItemPage assessment resource types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createActivity.mockResolvedValue({ id: 'act-new-123' });
    mocks.addModuleItem.mockResolvedValue({ id: 'item-new-123' });
  });

  test('renders all assessments and excludes external reference link in resource type dropdown', () => {
    render(<AddModuleItemPage courseId="c1" moduleId="m1" onBack={() => {}} />);

    // Click resource type dropdown to open options
    const openBtn = screen.getByRole('button', { name: /Lecture note \/ reading page/i });
    fireEvent.click(openBtn);

    // Verify assessments exist
    expect(screen.getByRole('button', { name: /^Activity/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Quiz/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Assignment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Project/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Presentation/i })).toBeInTheDocument();

    // Verify old labels and external link do NOT exist
    expect(screen.queryByText(/Activity milestone/i)).toBeNull();
    expect(screen.queryByText(/Assessment quiz/i)).toBeNull();
    expect(screen.queryByText(/External reference link/i)).toBeNull();
    expect(screen.queryByText(/Web link/i)).toBeNull();
  });

  test('selecting Assignment renders assessment form and saves with assessmentType assignment', async () => {
    render(<AddModuleItemPage courseId="c1" moduleId="m1" onBack={() => {}} />);

    // Open dropdown and select Assignment
    const openBtn = screen.getByRole('button', { name: /Lecture note \/ reading page/i });
    fireEvent.click(openBtn);

    const assignmentOpt = screen.getByRole('button', { name: /^Assignment/i });
    fireEvent.click(assignmentOpt);

    // ActivityFormFields for assignment should now be rendered
    const titleInput = screen.getByPlaceholderText(/Assignment 1/i);
    expect(titleInput).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: 'Homework Assignment 1' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save & add to module/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mocks.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          title: 'Homework Assignment 1',
          assessmentType: 'assignment',
          category: 'Assignments',
        })
      );
      expect(mocks.addModuleItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({
          title: 'Homework Assignment 1',
          type: 'assignment',
          activityId: 'act-new-123',
        })
      );
    });
  });

  test('selecting Project renders assessment form and saves with assessmentType project', async () => {
    render(<AddModuleItemPage courseId="c1" moduleId="m1" onBack={() => {}} />);

    // Open dropdown and select Project
    const openBtn = screen.getByRole('button', { name: /Lecture note \/ reading page/i });
    fireEvent.click(openBtn);

    const projectOpt = screen.getByRole('button', { name: /^Project/i });
    fireEvent.click(projectOpt);

    const titleInput = screen.getByPlaceholderText(/Capstone Phase 1/i);
    fireEvent.change(titleInput, { target: { value: 'Final Capstone Project' } });

    const saveBtn = screen.getByRole('button', { name: /Save & add to module/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mocks.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          title: 'Final Capstone Project',
          assessmentType: 'project',
          category: 'Projects',
        })
      );
      expect(mocks.addModuleItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({
          title: 'Final Capstone Project',
          type: 'project',
          activityId: 'act-new-123',
        })
      );
    });
  });

  test('selecting Presentation renders assessment form and saves with assessmentType presentation', async () => {
    render(<AddModuleItemPage courseId="c1" moduleId="m1" onBack={() => {}} />);

    // Open dropdown and select Presentation
    const openBtn = screen.getByRole('button', { name: /Lecture note \/ reading page/i });
    fireEvent.click(openBtn);

    const presentationOpt = screen.getByRole('button', { name: /^Presentation/i });
    fireEvent.click(presentationOpt);

    const titleInput = screen.getByPlaceholderText(/Oral Defense/i);
    fireEvent.change(titleInput, { target: { value: 'Oral Research Defense' } });

    const saveBtn = screen.getByRole('button', { name: /Save & add to module/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mocks.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          title: 'Oral Research Defense',
          assessmentType: 'presentation',
          category: 'Presentations',
        })
      );
      expect(mocks.addModuleItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({
          title: 'Oral Research Defense',
          type: 'presentation',
          activityId: 'act-new-123',
        })
      );
    });
  });

  test('selecting Assignment supports question set mode toggle', async () => {
    render(<AddModuleItemPage courseId="c1" moduleId="m1" onBack={() => {}} />);

    // Open dropdown and select Assignment
    const openBtn = screen.getByRole('button', { name: /Lecture note \/ reading page/i });
    fireEvent.click(openBtn);

    const assignmentOpt = screen.getByRole('button', { name: /^Assignment/i });
    fireEvent.click(assignmentOpt);

    // Switch to New question set
    const questionSetBtn = screen.getByRole('button', { name: /New question set/i });
    fireEvent.click(questionSetBtn);

    expect(screen.getByText(/Quiz-style question set/i)).toBeInTheDocument();
  });
});
