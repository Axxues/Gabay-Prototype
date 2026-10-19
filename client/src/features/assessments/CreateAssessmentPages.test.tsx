// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const createActivityMock = vi.fn().mockResolvedValue({ id: 'act-new-99' });
const createQuizMock = vi.fn().mockResolvedValue({ id: 'quiz-new-99' });
const createExamMock = vi.fn().mockResolvedValue({ id: 'exam-new-99' });

const mockCourses = [
  {
    id: 'c1',
    code: 'CS101',
    title: 'Computer Science 1',
    section: 'BSCS 3-1',
    schoolYear: '2026-2027',
    term: '1st Semester',
    instructorId: 'inst-1',
  },
  {
    id: 'c2',
    code: 'CS101',
    title: 'Computer Science 1',
    section: 'BSCS 3-2',
    schoolYear: '2026-2027',
    term: '1st Semester',
    instructorId: 'inst-1',
  },
];

vi.mock('../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: {
      courses: mockCourses,
    },
    currentUser: { id: 'inst-1', name: 'Dr. Santos', role: 'faculty' },
    createActivity: createActivityMock,
    createQuiz: createQuizMock,
    createExam: createExamMock,
    showAlert: vi.fn(),
    effectiveTermsForCourse: () => ['midterm', 'finals'],
  }),
}));

import { CreateAssignmentPage } from './CreateAssignmentPage';
import { CreateProjectPage } from './CreateProjectPage';
import { CreatePresentationPage } from './CreatePresentationPage';
import { CreateQuizPage } from './CreateQuizPage';
import { CreateExamPage } from './CreateExamPage';

describe('CreateAssessmentPages forms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('CreateAssignmentPage prompts with CrossSectionPromptModal and replicates across sections', async () => {
    const onCreated = vi.fn();
    render(<CreateAssignmentPage courseId="c1" onBack={() => {}} onCreated={onCreated} />);

    expect(screen.getByText('Create Assignment')).toBeDefined();
    const titleInput = screen.getByPlaceholderText(/e.g. Assignment 1/i);
    fireEvent.change(titleInput, { target: { value: 'Homework 1' } });

    const instructionsInput = screen.getByPlaceholderText(/Enter assignment instructions/i);
    fireEvent.change(instructionsInput, { target: { value: 'Read chapter 1 and answer questions.' } });

    const publishBtn = screen.getByRole('button', { name: /Publish Assignment/i });
    fireEvent.click(publishBtn);

    // Modal appears
    expect(await screen.findByText(/Replicate Assessment Across Sections/i)).toBeInTheDocument();
    expect(screen.getByText(/BSCS 3-2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(createActivityMock).toHaveBeenCalledTimes(2);
      expect(createActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          title: 'Homework 1',
          assessmentType: 'assignment',
          published: true,
        })
      );
      expect(createActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c2',
          title: 'Homework 1',
          assessmentType: 'assignment',
          published: true,
        })
      );
    });
  });

  test('CreateQuizPage prompts and replicates quiz across selected sections', async () => {
    const onCreated = vi.fn();
    render(<CreateQuizPage courseId="c1" onBack={() => {}} onQuizCreated={onCreated} />);

    const titleInput = screen.getByPlaceholderText(/Untitled Quiz/i);
    fireEvent.change(titleInput, { target: { value: 'Quiz 1' } });

    const questionInput = screen.getByPlaceholderText(/Question 1/i);
    fireEvent.change(questionInput, { target: { value: 'What is the capital of France?' } });

    const publishBtn = screen.getAllByRole('button', { name: /Publish Quiz/i })[0];
    fireEvent.click(publishBtn);

    expect(await screen.findByText(/Replicate Assessment Across Sections/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(createQuizMock).toHaveBeenCalledTimes(2);
      expect(createQuizMock).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c1', title: 'Quiz 1' })
      );
      expect(createQuizMock).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c2', title: 'Quiz 1' })
      );
    });
  });

  test('CreateExamPage prompts and replicates exam across selected sections', async () => {
    const onCreated = vi.fn();
    render(<CreateExamPage courseId="c1" onBack={() => {}} onExamCreated={onCreated} />);

    const titleInput = screen.getByPlaceholderText(/Untitled Exam/i);
    fireEvent.change(titleInput, { target: { value: 'Midterm Exam' } });

    const questionInput = screen.getByPlaceholderText(/Question 1/i);
    fireEvent.change(questionInput, { target: { value: 'What is Big O notation?' } });

    const publishBtn = screen.getAllByRole('button', { name: /Publish Exam/i })[0];
    fireEvent.click(publishBtn);

    expect(await screen.findByText(/Replicate Assessment Across Sections/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(createExamMock).toHaveBeenCalledTimes(2);
      expect(createExamMock).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c1', title: 'Midterm Exam' })
      );
      expect(createExamMock).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'c2', title: 'Midterm Exam' })
      );
    });
  });
});
