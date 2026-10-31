import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoInstructorSubmissionPanel } from './CoInstructorSubmissionPanel';

describe('CoInstructorSubmissionPanel', () => {
  it('renders all co-instructors with their status and provides agreement toggle', () => {
    const onAgree = vi.fn();
    render(
      <CoInstructorSubmissionPanel
        currentUserId="u1"
        instructors={[
          { id: 'u1', name: 'Dr. Santos (3A)', hasAgreed: false },
          { id: 'u2', name: 'Prof. Reyes (3B)', hasAgreed: true }
        ]}
        allAgreed={false}
        onAgreeToSubmit={onAgree}
      />
    );

    expect(screen.getByText(/Dr. Santos/i)).toBeInTheDocument();
    expect(screen.getByText(/Prof. Reyes/i)).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();

    const agreeBtn = screen.getByRole('button', { name: /agree to submit syllabus/i });
    fireEvent.click(agreeBtn);
    expect(onAgree).toHaveBeenCalled();
  });

  it('shows Edit Syllabus button when user has confirmed agreement so they can retract and edit', () => {
    const onRetract = vi.fn();
    render(
      <CoInstructorSubmissionPanel
        currentUserId="u1"
        instructors={[
          { id: 'u1', name: 'Raymund Dilan (4-E)', hasAgreed: true },
          { id: 'u2', name: 'Elena Santos (4-B)', hasAgreed: false }
        ]}
        allAgreed={false}
        onAgreeToSubmit={vi.fn()}
        onRetractAgreement={onRetract}
      />
    );

    const editBtn = screen.getByRole('button', { name: /edit syllabus/i });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onRetract).toHaveBeenCalledTimes(1);
  });

  it('allows an agreed instructor to edit/retract even when all instructors agreed, as long as evaluation has not started', () => {
    const onRetract = vi.fn();
    render(
      <CoInstructorSubmissionPanel
        currentUserId="u1"
        instructors={[
          { id: 'u1', name: 'Dr. Santos (3A)', hasAgreed: true },
          { id: 'u2', name: 'Prof. Reyes (3B)', hasAgreed: true }
        ]}
        allAgreed={true}
        isEvaluationStarted={false}
        onAgreeToSubmit={vi.fn()}
        onRetractAgreement={onRetract}
      />
    );

    expect(screen.getByText(/Unanimous Instructor Consensus Achieved/i)).toBeInTheDocument();
    const editBtn = screen.getByRole('button', { name: /edit syllabus/i });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onRetract).toHaveBeenCalledTimes(1);
  });

  it('hides the action/edit button once departmental evaluation has actively started', () => {
    render(
      <CoInstructorSubmissionPanel
        currentUserId="u1"
        instructors={[
          { id: 'u1', name: 'Dr. Santos (3A)', hasAgreed: true },
          { id: 'u2', name: 'Prof. Reyes (3B)', hasAgreed: true }
        ]}
        allAgreed={true}
        isEvaluationStarted={true}
        onAgreeToSubmit={vi.fn()}
        onRetractAgreement={vi.fn()}
      />
    );

    expect(screen.getByText(/Unanimous Instructor Consensus Achieved/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit syllabus/i })).not.toBeInTheDocument();
  });

  it('allows a solo instructor to edit/retract before evaluation starts, but hides button when evaluation started', () => {
    const onRetract = vi.fn();
    const { rerender } = render(
      <CoInstructorSubmissionPanel
        currentUserId="u1"
        instructors={[
          { id: 'u1', name: 'Raymund Dilan (1-A)', hasAgreed: true }
        ]}
        allAgreed={true}
        isEvaluationStarted={false}
        onAgreeToSubmit={vi.fn()}
        onRetractAgreement={onRetract}
      />
    );

    expect(screen.getByText(/Submission Confirmed/i)).toBeInTheDocument();
    const editBtn = screen.getByRole('button', { name: /edit syllabus/i });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onRetract).toHaveBeenCalledTimes(1);

    rerender(
      <CoInstructorSubmissionPanel
        currentUserId="u1"
        instructors={[
          { id: 'u1', name: 'Raymund Dilan (1-A)', hasAgreed: true }
        ]}
        allAgreed={true}
        isEvaluationStarted={true}
        onAgreeToSubmit={vi.fn()}
        onRetractAgreement={onRetract}
      />
    );
    expect(screen.queryByRole('button', { name: /edit syllabus/i })).not.toBeInTheDocument();
  });
});
