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
    expect(screen.getByText(/Ready ✓/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending ⏳/i)).toBeInTheDocument();

    const agreeBtn = screen.getByRole('button', { name: /agree to submit syllabus/i });
    fireEvent.click(agreeBtn);
    expect(onAgree).toHaveBeenCalled();
  });

  it('shows unanimous consensus banner when all instructors have agreed', () => {
    render(
      <CoInstructorSubmissionPanel
        currentUserId="u1"
        instructors={[
          { id: 'u1', name: 'Dr. Santos (3A)', hasAgreed: true },
          { id: 'u2', name: 'Prof. Reyes (3B)', hasAgreed: true }
        ]}
        allAgreed={true}
        onAgreeToSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/Unanimous Instructor Consensus Achieved/i)).toBeInTheDocument();
  });
});
