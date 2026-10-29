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
    expect(screen.queryByText(/Course document \/ handout file/i)).toBeNull();
  });

  test('renders red asterisk on required Resource title for reading page', () => {
    render(<AddModuleItemPage courseId="c1" moduleId="m1" onBack={() => {}} />);
    const titleLabel = screen.getByText(/Resource title/i);
    expect(titleLabel).toBeInTheDocument();
    expect(titleLabel.querySelector('span.text-red-500')).toHaveTextContent('*');
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

  test('allows attaching multiple files to a direct module item and saves attachments', async () => {
    mocks.uploadCourseFile
      .mockResolvedValueOnce({
        id: 'f1',
        name: 'lecture1.pdf',
        formattedSize: '2.5 MB',
        fileUrl: '/uploads/lecture1.pdf',
        type: 'pdf'
      })
      .mockResolvedValueOnce({
        id: 'f2',
        name: 'diagram.png',
        formattedSize: '500 KB',
        fileUrl: '/uploads/diagram.png',
        type: 'image'
      });

    const { container } = render(<AddModuleItemPage courseId="c1" moduleId="m1" onBack={() => {}} />);

    const titleInput = screen.getByPlaceholderText(/Chapter 4: Neural Architectures/i);
    fireEvent.change(titleInput, { target: { value: 'Intro to Trees' } });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.multiple).toBe(true);

    const file1 = new File(['pdf data'], 'lecture1.pdf', { type: 'application/pdf' });
    const file2 = new File(['png data'], 'diagram.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    expect(screen.getByText('lecture1.pdf')).toBeInTheDocument();
    expect(screen.getByText('diagram.png')).toBeInTheDocument();
    expect(screen.getByText(/File attachments \(2\)/i)).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save & add to module/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mocks.uploadCourseFile).toHaveBeenCalledTimes(2);
      expect(mocks.addModuleItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({
          title: 'Intro to Trees',
          type: 'page',
          fileName: 'lecture1.pdf',
          fileUrl: '/uploads/lecture1.pdf',
          attachments: expect.arrayContaining([
            expect.objectContaining({ name: 'lecture1.pdf', url: '/uploads/lecture1.pdf' }),
            expect.objectContaining({ name: 'diagram.png', url: '/uploads/diagram.png' }),
          ])
        })
      );
    });
  });

  test('allows attaching multiple starter files to classic activity and saves attachments', async () => {
    mocks.createActivity.mockResolvedValueOnce({ id: 'act-multi-1' });
    mocks.uploadCourseFile
      .mockResolvedValueOnce({
        id: 'f1',
        name: 'handout.pdf',
        formattedSize: '1.2 MB',
        fileUrl: '/uploads/handout.pdf',
      })
      .mockResolvedValueOnce({
        id: 'f2',
        name: 'dataset.csv',
        formattedSize: '300 KB',
        fileUrl: '/uploads/dataset.csv',
      });

    const { container } = render(<AddModuleItemPage courseId="c1" moduleId="m1" onBack={() => {}} />);

    // Select Activity
    const openBtn = screen.getByRole('button', { name: /Lecture note \/ reading page/i });
    fireEvent.click(openBtn);
    const activityOpt = screen.getByRole('button', { name: /^Activity/i });
    fireEvent.click(activityOpt);

    const titleInput = screen.getByPlaceholderText(/SpeedGrader/i);
    fireEvent.change(titleInput, { target: { value: 'Lab 1 Pathfinding' } });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.multiple).toBe(true);

    const file1 = new File(['handout content'], 'handout.pdf', { type: 'application/pdf' });
    const file2 = new File(['dataset content'], 'dataset.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    expect(screen.getByText('handout.pdf')).toBeInTheDocument();
    expect(screen.getByText('dataset.csv')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save & add to module/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mocks.uploadCourseFile).toHaveBeenCalledTimes(2);
      expect(mocks.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          title: 'Lab 1 Pathfinding',
          fileName: 'handout.pdf',
          fileUrl: '/uploads/handout.pdf',
          attachments: expect.arrayContaining([
            expect.objectContaining({ name: 'handout.pdf', url: '/uploads/handout.pdf' }),
            expect.objectContaining({ name: 'dataset.csv', url: '/uploads/dataset.csv' }),
          ])
        })
      );
      expect(mocks.addModuleItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({
          title: 'Lab 1 Pathfinding',
          type: 'activity',
          activityId: 'act-multi-1',
          fileName: 'handout.pdf',
          fileUrl: '/uploads/handout.pdf',
          attachments: expect.arrayContaining([
            expect.objectContaining({ name: 'handout.pdf', url: '/uploads/handout.pdf' }),
            expect.objectContaining({ name: 'dataset.csv', url: '/uploads/dataset.csv' }),
          ])
        })
      );
    });
  });
});
