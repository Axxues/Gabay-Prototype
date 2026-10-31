// @vitest-environment jsdom
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ courseId: 'c1' }),
  };
});

const mocks = vi.hoisted(() => ({
  db: {} as any,
  showAlert: vi.fn(),
  updateCourse: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../../shared/context/LMSContext', () => ({
  useLMS: () => ({
    db: mocks.db,
    showAlert: mocks.showAlert,
    updateCourse: mocks.updateCourse,
  }),
}));

import { AssessmentWeightsPage } from './AssessmentWeightsPage';

function baseDb() {
  return {
    courses: [
      {
        id: 'c1',
        code: 'CMSC 180',
        title: 'Operating Systems',
        section: 'BSCS 4-1',
        assessmentCategoryWeights: undefined,
      },
    ],
    activities: [],
    quizzes: [],
  } as any;
}

describe('AssessmentWeightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.db = baseDb();
  });

  test('renders all 5 standard categories with default 20% each and no reset button', () => {
    render(<AssessmentWeightsPage />);

    expect(screen.getAllByText('Activities').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quizzes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Assignments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Presentations').length).toBeGreaterThan(0);

    const activitiesInput = screen.getByTestId('category-input-activities') as HTMLInputElement;
    const quizzesInput = screen.getByTestId('category-input-quizzes') as HTMLInputElement;
    const assignmentsInput = screen.getByTestId('category-input-assignments') as HTMLInputElement;
    const projectsInput = screen.getByTestId('category-input-projects') as HTMLInputElement;
    const presentationsInput = screen.getByTestId('category-input-presentations') as HTMLInputElement;

    expect(activitiesInput.value).toBe('20');
    expect(quizzesInput.value).toBe('20');
    expect(assignmentsInput.value).toBe('20');
    expect(projectsInput.value).toBe('20');
    expect(presentationsInput.value).toBe('20');

    expect(screen.getByTestId('weights-total-value')).toHaveTextContent('100.0%');
    expect(screen.getByTestId('weights-save-btn')).not.toBeDisabled();

    // Reset button must not exist
    expect(screen.queryByTestId('weights-reset-defaults-btn')).not.toBeInTheDocument();
  });

  test('disables save button and displays error when total is not 100%', () => {
    render(<AssessmentWeightsPage />);

    const activitiesInput = screen.getByTestId('category-input-activities');
    fireEvent.change(activitiesInput, { target: { value: '30' } });

    // Total is now 110%
    expect(screen.getByTestId('weights-total-value')).toHaveTextContent('110.0%');
    const saveBtn = screen.getByTestId('weights-save-btn');
    expect(saveBtn).toBeDisabled();

    // Change activities to 10% -> total is 90%
    fireEvent.change(activitiesInput, { target: { value: '10' } });
    expect(screen.getByTestId('weights-total-value')).toHaveTextContent('90.0%');
    expect(saveBtn).toBeDisabled();
  });

  test('allows saving when total is adjusted to exactly 100%', async () => {
    render(<AssessmentWeightsPage />);

    const activitiesInput = screen.getByTestId('category-input-activities');
    const quizzesInput = screen.getByTestId('category-input-quizzes');

    // Make activities 30% and quizzes 10% -> sum remains 100%
    fireEvent.change(activitiesInput, { target: { value: '30' } });
    fireEvent.change(quizzesInput, { target: { value: '10' } });

    expect(screen.getByTestId('weights-total-value')).toHaveTextContent('100.0%');
    const saveBtn = screen.getByTestId('weights-save-btn');
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mocks.updateCourse).toHaveBeenCalledWith('c1', {
        assessmentCategoryWeights: {
          Activities: 30,
          Quizzes: 10,
          Assignments: 20,
          Projects: 20,
          Presentations: 20,
        },
      });
      expect(mocks.showAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/courses/c1/gradebook');
    });
  });

  test('back to gradebook and cancel buttons navigate to gradebook', () => {
    render(<AssessmentWeightsPage />);

    const backBtn = screen.getByTestId('weights-back-btn');
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/courses/c1/gradebook');

    const cancelBtn = screen.getByTestId('weights-cancel-btn');
    fireEvent.click(cancelBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/courses/c1/gradebook');
  });
});
