import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvaluatorReviewModal } from './EvaluatorReviewModal';

describe('EvaluatorReviewModal', () => {
  it('requires remarks when requesting revisions and calls onReview', () => {
    const onReview = vi.fn();
    render(
      <EvaluatorReviewModal
        isOpen={true}
        groupId="grp-1"
        courseCode="CSPC 103"
        onClose={vi.fn()}
        onReview={onReview}
      />
    );

    // Click Request Revisions without text -> shows validation warning
    const requestBtn = screen.getByRole('button', { name: /request revisions/i });
    fireEvent.click(requestBtn);
    expect(screen.getByText(/please enter revision remarks/i)).toBeInTheDocument();

    // Fill remarks and submit
    const textarea = screen.getByPlaceholderText(/specify required revisions/i);
    fireEvent.change(textarea, { target: { value: 'Fix Week 4 SDG alignment' } });
    fireEvent.click(requestBtn);

    expect(onReview).toHaveBeenCalledWith('grp-1', 'revisions_requested', 'Fix Week 4 SDG alignment');
  });

  it('submits approval directly when approve button is clicked', () => {
    const onReview = vi.fn();
    render(
      <EvaluatorReviewModal
        isOpen={true}
        groupId="grp-1"
        courseCode="CSPC 103"
        onClose={vi.fn()}
        onReview={onReview}
      />
    );

    const approveBtn = screen.getByRole('button', { name: /approve syllabus/i });
    fireEvent.click(approveBtn);

    expect(onReview).toHaveBeenCalledWith('grp-1', 'approved', undefined);
  });
});
