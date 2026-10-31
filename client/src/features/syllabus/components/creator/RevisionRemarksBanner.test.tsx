import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RevisionRemarksBanner } from './RevisionRemarksBanner';
import type { EvaluationMatrix, EvaluatorReview } from '../../types/lifecycle';

const snapshot: EvaluationMatrix = {
  version: 1,
  updatedAt: '2026-10-01T00:00:00.000Z',
  sections: [
    {
      id: 's1',
      title: 'Section One',
      criteria: [{ id: 'c1', text: 'Objectives are measurable' }]
    }
  ]
};

const evaluators: EvaluatorReview[] = [
  {
    evaluatorId: 'e1',
    evaluatorName: 'Dr. Alpha',
    status: 'revisions_requested',
    remarks: 'Fix the objectives',
    reviewedAt: '2026-10-20T08:00:00.000Z',
    matrixResponses: [{ criterionId: 'c1', compliant: false, comment: 'Not measurable' }]
  }
];

describe('RevisionRemarksBanner', () => {
  it('renders no matrix button without matrixSnapshot', () => {
    render(<RevisionRemarksBanner evaluators={evaluators} />);
    expect(screen.getByText('Fix the objectives')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view evaluation matrix/i })).not.toBeInTheDocument();
  });

  it('renders the button with matrixSnapshot and opens the modal with the snapshot criteria', () => {
    render(<RevisionRemarksBanner evaluators={evaluators} matrixSnapshot={snapshot} />);
    expect(screen.queryByText('Objectives are measurable')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view evaluation matrix/i }));
    expect(screen.getByText('Objectives are measurable')).toBeInTheDocument();
  });
});
