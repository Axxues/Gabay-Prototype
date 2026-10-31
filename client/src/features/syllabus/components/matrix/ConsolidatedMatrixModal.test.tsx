import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ConsolidatedMatrixModal } from './ConsolidatedMatrixModal';
import type { EvaluationMatrix, EvaluatorReview } from '../../types/lifecycle';

const snapshot: EvaluationMatrix = {
  version: 1,
  updatedAt: '2026-10-01T00:00:00.000Z',
  sections: [
    {
      id: 's1',
      title: 'Section One',
      criteria: [
        { id: 'c1', text: 'Criterion 1' },
        { id: 'c2', text: 'Criterion 2' },
        { id: 'c3', text: 'Criterion 3' }
      ]
    }
  ]
};

const evaluators: EvaluatorReview[] = [
  {
    evaluatorId: 'e1',
    evaluatorName: 'Dr. Alpha',
    status: 'approved',
    reviewedAt: '2026-10-20T08:00:00.000Z',
    overallComments: 'Looks solid overall',
    matrixResponses: [
      { criterionId: 'c1', compliant: true },
      { criterionId: 'c2', compliant: true }
    ]
  },
  {
    evaluatorId: 'e2',
    evaluatorName: 'Dr. Beta',
    status: 'revisions_requested',
    reviewedAt: '2026-10-25T08:00:00.000Z',
    overallComments: 'Fix the objectives',
    matrixResponses: [
      { criterionId: 'c1', compliant: true },
      { criterionId: 'c2', compliant: false, comment: 'Missing objectives' }
    ]
  },
  { evaluatorId: 'e3', evaluatorName: 'Dr. Gamma', status: 'pending' }
];

const renderModal = (overrides: Partial<React.ComponentProps<typeof ConsolidatedMatrixModal>> = {}) => {
  const onClose = vi.fn();
  render(
    <ConsolidatedMatrixModal
      isOpen
      courseCode="CSPC103"
      instructorNames={['Prof. One', 'Prof. Two']}
      snapshot={snapshot}
      evaluators={evaluators}
      onClose={onClose}
      {...overrides}
    />
  );
  return { onClose };
};

const rowFor = (text: string) => screen.getByText(text).closest('tr') as HTMLElement;

describe('ConsolidatedMatrixModal', () => {
  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByText(/CSPC103/)).toBeNull();
  });

  it('header shows course code, instructor names and latest reviewedAt date', () => {
    renderModal();
    expect(screen.getByText(/CSPC103/)).toBeTruthy();
    expect(screen.getByText(/Prof\. One, Prof\. Two/)).toBeTruthy();
    expect(screen.getByText(/Oct 25, 2026/)).toBeTruthy();
  });

  it('toggle lists Consolidated plus each submitted evaluator only', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Consolidated' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dr. Alpha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dr. Beta' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dr. Gamma' })).toBeNull();
  });

  it('consolidated view shows N with attributed comment, Y, and — for pending rows', () => {
    renderModal();
    const n = within(rowFor('Criterion 2'));
    expect(n.getByText('N')).toBeTruthy();
    expect(n.getByText(/Dr\. Beta: Missing objectives/)).toBeTruthy();
    expect(within(rowFor('Criterion 1')).getByText('Y')).toBeTruthy();
    expect(within(rowFor('Criterion 3')).getByText('—', { selector: 'span' })).toBeTruthy();
  });

  it('consolidated view merges overall comments with attribution', () => {
    renderModal();
    expect(screen.getByText('Comments and Suggestions')).toBeTruthy();
    expect(screen.getByText(/Dr\. Alpha: Looks solid overall/)).toBeTruthy();
    expect(screen.getByText(/Dr\. Beta: Fix the objectives/)).toBeTruthy();
  });

  it('individual view shows only that evaluator responses', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Dr. Alpha' }));
    expect(within(rowFor('Criterion 2')).getByText('Y')).toBeTruthy();
    expect(screen.queryByText(/Missing objectives/)).toBeNull();
    expect(screen.getByText('Looks solid overall')).toBeTruthy();
    expect(screen.queryByText(/Fix the objectives/)).toBeNull();
    expect(within(rowFor('Criterion 3')).getByText('—', { selector: 'span' })).toBeTruthy();
  });
});
