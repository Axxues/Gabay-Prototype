import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvaluatorReviewModal } from './EvaluatorReviewModal';
import type { EvaluationMatrix } from '../../types/lifecycle';

const snapshot: EvaluationMatrix = {
  version: 3,
  updatedAt: '2026-10-31T00:00:00.000Z',
  sections: [
    {
      id: 'format',
      title: 'FORMAT',
      criteria: [
        { id: 'fmt-1', text: 'Margins (1" on all sides)' },
        { id: 'fmt-2', text: 'Font size (Trebuchet, 11)' }
      ]
    },
    {
      id: 'part-1',
      title: 'Part I: Course Information',
      criteria: [{ id: 'p1-1', text: 'PVMG aligned with the University' }]
    }
  ]
};

const renderModal = (overrides: Partial<React.ComponentProps<typeof EvaluatorReviewModal>> = {}) => {
  const onReview = vi.fn();
  const onClose = vi.fn();
  render(
    <EvaluatorReviewModal
      isOpen={true}
      groupId="grp-1"
      courseCode="CSPC 103"
      snapshot={snapshot}
      onClose={onClose}
      onReview={onReview}
      {...overrides}
    />
  );
  return { onReview, onClose };
};

const markAllY = () => {
  screen.getAllByRole('button', { name: 'Y' }).forEach(btn => fireEvent.click(btn));
};

describe('EvaluatorReviewModal', () => {
  it('renders all snapshot criteria', () => {
    renderModal();
    expect(screen.getByText('Margins (1" on all sides)')).toBeInTheDocument();
    expect(screen.getByText('Font size (Trebuchet, 11)')).toBeInTheDocument();
    expect(screen.getByText('PVMG aligned with the University')).toBeInTheDocument();
  });

  it('blocks submit when an N criterion lacks a comment', () => {
    const { onReview } = renderModal();
    markAllY();
    fireEvent.click(screen.getAllByRole('button', { name: 'N' })[0]);
    fireEvent.change(screen.getByPlaceholderText(/specify required revisions/i), {
      target: { value: 'Needs fixes' }
    });

    fireEvent.click(screen.getByRole('button', { name: /request revisions/i }));

    expect(screen.getByText(/comment to every non-compliant criterion/i)).toBeInTheDocument();
    expect(onReview).not.toHaveBeenCalled();
  });

  it('Approve is disabled while any criterion is N or commented', () => {
    renderModal();
    const approve = screen.getByRole('button', { name: /approve syllabus/i });
    expect(approve).toBeDisabled();

    markAllY();
    expect(approve).not.toBeDisabled();

    fireEvent.click(screen.getAllByRole('button', { name: 'N' })[0]);
    expect(approve).toBeDisabled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Y' })[0]);
    expect(approve).not.toBeDisabled();

    fireEvent.change(screen.getAllByPlaceholderText(/required for n/i)[0], {
      target: { value: 'Margin is 0.5"' }
    });
    expect(approve).toBeDisabled();
  });

  it('Approve with all Y emits compliant responses', () => {
    const { onReview, onClose } = renderModal();
    markAllY();
    fireEvent.click(screen.getByRole('button', { name: /approve syllabus/i }));

    expect(onReview).toHaveBeenCalledTimes(1);
    const [groupId, status, remarks, matrix] = onReview.mock.calls[0];
    expect(groupId).toBe('grp-1');
    expect(status).toBe('approved');
    expect(remarks).toBeUndefined();
    expect(matrix.matrixVersion).toBe(snapshot.version);
    expect(matrix.matrixResponses).toHaveLength(3);
    expect(matrix.matrixResponses.map((r: any) => r.criterionId)).toEqual(['fmt-1', 'fmt-2', 'p1-1']);
    expect(matrix.matrixResponses.every((r: any) => r.compliant === true)).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('emits revisions with per-criterion comments, remarks and overall comments', () => {
    const { onReview } = renderModal();
    markAllY();
    fireEvent.change(screen.getAllByPlaceholderText(/required for n/i)[0], { target: { value: 'Margin is 0.5"' } });
    fireEvent.change(screen.getByPlaceholderText(/specify required revisions/i), {
      target: { value: '  Fix margins  ' }
    });
    fireEvent.change(screen.getByPlaceholderText(/overall evaluator comments/i), {
      target: { value: 'Otherwise good.' }
    });

    fireEvent.click(screen.getByRole('button', { name: /request revisions/i }));

    expect(onReview).toHaveBeenCalledTimes(1);
    const [, status, remarks, matrix] = onReview.mock.calls[0];
    expect(status).toBe('revisions_requested');
    expect(remarks).toBe('Fix margins');
    expect(matrix.overallComments).toBe('Otherwise good.');
    expect(matrix.matrixResponses[0]).toEqual({ criterionId: 'fmt-1', compliant: false, comment: 'Margin is 0.5"' });
    expect(matrix.matrixResponses[1].compliant).toBe(true);
  });

  it('requires remarks when requesting revisions', () => {
    const { onReview } = renderModal();
    markAllY();
    fireEvent.click(screen.getByRole('button', { name: /request revisions/i }));
    expect(screen.getByText(/please enter revision remarks/i)).toBeInTheDocument();
    expect(onReview).not.toHaveBeenCalled();
  });

  it('guards double submit', () => {
    const { onReview } = renderModal();
    markAllY();
    const approve = screen.getByRole('button', { name: /approve syllabus/i });
    fireEvent.click(approve);
    fireEvent.click(approve);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  describe('legacy (snapshot: null)', () => {
    it('requires remarks when requesting revisions and calls onReview', () => {
      const { onReview } = renderModal({ snapshot: null });
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      const requestBtn = screen.getByRole('button', { name: /request revisions/i });
      fireEvent.click(requestBtn);
      expect(screen.getByText(/please enter revision remarks/i)).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText(/specify required revisions/i), {
        target: { value: 'Fix Week 4 SDG alignment' }
      });
      fireEvent.click(requestBtn);

      expect(onReview).toHaveBeenCalledWith('grp-1', 'revisions_requested', 'Fix Week 4 SDG alignment', {
        matrixResponses: []
      });
    });

    it('submits approval directly when approve button is clicked', () => {
      const { onReview } = renderModal({ snapshot: null });
      fireEvent.click(screen.getByRole('button', { name: /approve syllabus/i }));
      expect(onReview).toHaveBeenCalledWith('grp-1', 'approved', undefined, { matrixResponses: [] });
    });
  });
});
