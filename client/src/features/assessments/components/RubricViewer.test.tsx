// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RubricViewer } from './RubricViewer';
import type { RubricCriterion } from '../../../shared/types/lms';

describe('RubricViewer Component', () => {
  test('renders nothing when rubric is null, undefined, or empty', () => {
    const { container: c1 } = render(<RubricViewer rubric={null} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<RubricViewer rubric={undefined} />);
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(<RubricViewer rubric={[]} />);
    expect(c3.firstChild).toBeNull();
  });

  test('renders criterion title, description, points, and all rating levels', () => {
    const mockRubric: RubricCriterion[] = [
      {
        id: 'crit-1',
        title: 'Delivery & Communication',
        description: 'Demonstrates clear articulation, pacing, and engaging presentation style.',
        points: 40,
        ratings: [
          { points: 40, description: 'Exemplary Delivery' },
          { points: 30, description: 'Proficient Delivery' },
          { points: 20, description: 'Developing Delivery' },
          { points: 0, description: 'Needs Significant Improvement' },
        ],
      },
      {
        id: 'crit-2',
        title: 'Technical Depth',
        description: 'Covers core architectural principles in comprehensive detail.',
        points: 60,
        ratings: [
          { points: 60, description: 'Exceptional Technical Accuracy' },
          { points: 40, description: 'Satisfactory Depth' },
          { points: 0, description: 'Superficial or Inaccurate' },
        ],
      },
    ];

    render(<RubricViewer rubric={mockRubric} title="Presentation Rubrics" />);

    // Header & summary
    expect(screen.getByText('Presentation Rubrics')).toBeInTheDocument();
    expect(screen.getByText(/2 criteria/i)).toBeInTheDocument();
    expect(screen.getByText(/100 total pts/i)).toBeInTheDocument();

    // Criterion 1
    expect(screen.getByText('Delivery & Communication')).toBeInTheDocument();
    expect(screen.getByText('Demonstrates clear articulation, pacing, and engaging presentation style.')).toBeInTheDocument();
    expect(screen.getAllByText('40 pts').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Exemplary Delivery')).toBeInTheDocument();
    expect(screen.getByText('Needs Significant Improvement')).toBeInTheDocument();

    // Criterion 2
    expect(screen.getByText('Technical Depth')).toBeInTheDocument();
    expect(screen.getByText('Covers core architectural principles in comprehensive detail.')).toBeInTheDocument();
    expect(screen.getAllByText('60 pts').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Exceptional Technical Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Superficial or Inaccurate')).toBeInTheDocument();
  });

  test('falls back to default rating levels when criterion ratings array is empty', () => {
    const mockRubric: RubricCriterion[] = [
      {
        id: 'crit-bare',
        title: 'Slide Deck Quality',
        description: 'Legible slides and clean visual hierarchy.',
        points: 25,
        ratings: [],
      },
    ];

    render(<RubricViewer rubric={mockRubric} />);

    expect(screen.getByText('Slide Deck Quality')).toBeInTheDocument();
    expect(screen.getAllByText('25 pts').length).toBeGreaterThanOrEqual(1);
    // Default levels should show up
    expect(screen.getByText('Exemplary Mastery')).toBeInTheDocument();
    expect(screen.getByText('Needs Revision')).toBeInTheDocument();
  });
});
