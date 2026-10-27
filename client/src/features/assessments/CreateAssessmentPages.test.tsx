// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const createActivityMock = vi.fn().mockResolvedValue({ id: 'act-new-99' });
const createQuizMock = vi.fn().mockResolvedValue({ id: 'quiz-new-99' });

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
    showAlert: vi.fn(),
    effectiveTermsForCourse: () => ['midterm', 'finals'],
  }),
}));

import { CreateAssignmentPage } from './CreateAssignmentPage';
import { CreateProjectPage } from './CreateProjectPage';
import { CreatePresentationPage } from './CreatePresentationPage';
import { CreateQuizPage } from './CreateQuizPage';

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

  test('CreateAssignmentPage allows switching to New question set mode', async () => {
    const onCreated = vi.fn();
    render(<CreateAssignmentPage courseId="c1" onBack={() => {}} onCreated={onCreated} />);

    // Switch to question set
    fireEvent.click(screen.getByRole('button', { name: /New question set/i }));

    expect(screen.getByText(/Quiz-style question set/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Discard & return to assignments/i })).toBeInTheDocument();
  });

  test('CreateProjectPage renders structured design and replicates across sections', async () => {
    const onCreated = vi.fn();
    render(<CreateProjectPage courseId="c1" onBack={() => {}} onCreated={onCreated} />);

    expect(screen.getByText('Create Project')).toBeDefined();
    const titleInput = screen.getByPlaceholderText(/Capstone Phase 1/i);
    fireEvent.change(titleInput, { target: { value: 'Final Capstone' } });

    const instructionsInput = screen.getByPlaceholderText(/Enter project instructions/i);
    fireEvent.change(instructionsInput, { target: { value: 'Build a production microservice.' } });

    const publishBtn = screen.getAllByRole('button', { name: /Publish Project/i })[0];
    fireEvent.click(publishBtn);

    expect(await screen.findByText(/Replicate Assessment Across Sections/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(createActivityMock).toHaveBeenCalledTimes(2);
      expect(createActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          title: 'Final Capstone',
          assessmentType: 'project',
          published: true,
        })
      );
    });
  });

  test('CreatePresentationPage renders structured design and replicates across sections', async () => {
    const onCreated = vi.fn();
    render(<CreatePresentationPage courseId="c1" onBack={() => {}} onCreated={onCreated} />);

    expect(screen.getByText('Create Presentation')).toBeDefined();
    const titleInput = screen.getByPlaceholderText(/Oral Defense or Group/i);
    fireEvent.change(titleInput, { target: { value: 'Thesis Defense' } });

    const instructionsInput = screen.getByPlaceholderText(/Enter presentation guidelines/i);
    fireEvent.change(instructionsInput, { target: { value: 'Present findings within 15 minutes.' } });

    const publishBtn = screen.getAllByRole('button', { name: /Publish Presentation/i })[0];
    fireEvent.click(publishBtn);

    expect(await screen.findByText(/Replicate Assessment Across Sections/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish to Selected Sections/i }));

    await waitFor(() => {
      expect(createActivityMock).toHaveBeenCalledTimes(2);
      expect(createActivityMock).toHaveBeenCalledWith(
        expect.objectContaining({
          courseId: 'c1',
          title: 'Thesis Defense',
          assessmentType: 'presentation',
          published: true,
        })
      );
    });
  });

  test('CreateProjectPage and CreatePresentationPage support grading rubric toggle and criteria', () => {
    const { unmount } = render(<CreateProjectPage courseId="c1" onBack={() => {}} onCreated={() => {}} />);
    const rubricCheckbox = screen.getByRole('checkbox', { name: /Include a grading rubric/i });
    expect(rubricCheckbox).not.toBeChecked();

    fireEvent.click(rubricCheckbox);
    expect(rubricCheckbox).toBeChecked();
    expect(screen.getByText('1 criterion')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Criterion title \(e\.g\. Code Quality & Technical Execution\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Project total: 100 pts/i)).toBeInTheDocument();
    unmount();

    render(<CreatePresentationPage courseId="c1" onBack={() => {}} onCreated={() => {}} />);
    const presRubricCheckbox = screen.getByRole('checkbox', { name: /Include a grading rubric/i });
    expect(presRubricCheckbox).not.toBeChecked();

    fireEvent.click(presRubricCheckbox);
    expect(presRubricCheckbox).toBeChecked();
    expect(screen.getByText('1 criterion')).toBeInTheDocument();
    expect(screen.getByText(/Presentation total: 100 pts/i)).toBeInTheDocument();
  });

  test('all assessment forms render Due date, Available from, and Until date fields', () => {
    // 1. Assignment
    const { unmount: unmountAsg } = render(<CreateAssignmentPage courseId="c1" onBack={() => {}} onCreated={() => {}} />);
    expect(screen.getByText(/^Due date/i)).toBeInTheDocument();
    expect(screen.getByText(/^Available from/i)).toBeInTheDocument();
    expect(screen.getByText(/^Until/i)).toBeInTheDocument();
    unmountAsg();

    // 2. Project
    const { unmount: unmountProj } = render(<CreateProjectPage courseId="c1" onBack={() => {}} onCreated={() => {}} />);
    expect(screen.getByText(/^Due date/i)).toBeInTheDocument();
    expect(screen.getByText(/^Available from/i)).toBeInTheDocument();
    expect(screen.getByText(/^Until/i)).toBeInTheDocument();
    unmountProj();

    // 3. Presentation
    const { unmount: unmountPres } = render(<CreatePresentationPage courseId="c1" onBack={() => {}} onCreated={() => {}} />);
    expect(screen.getByText(/^Due date/i)).toBeInTheDocument();
    expect(screen.getByText(/^Available from/i)).toBeInTheDocument();
    expect(screen.getByText(/^Until/i)).toBeInTheDocument();
    unmountPres();

    // 4. Quiz
    const { unmount: unmountQuiz } = render(<CreateQuizPage courseId="c1" onBack={() => {}} onQuizCreated={() => {}} />);
    expect(screen.getByText(/^Due date/i)).toBeInTheDocument();
    expect(screen.getByText(/^Available from/i)).toBeInTheDocument();
    expect(screen.getByText(/^Until/i)).toBeInTheDocument();
    unmountQuiz();
  });
});
