import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionExpiredModal } from './SessionExpiredModal';

describe('SessionExpiredModal', () => {
  it('renders nothing when isOpen is false', () => {
    const onBackToLogin = vi.fn();
    const { container } = render(
      <SessionExpiredModal isOpen={false} onBackToLogin={onBackToLogin} />
    );
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('renders session expired modal with default title, message, and button when isOpen is true', () => {
    const onBackToLogin = vi.fn();
    render(<SessionExpiredModal isOpen={true} onBackToLogin={onBackToLogin} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'session-expired-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'session-expired-desc');

    expect(screen.getByText('Session Expired')).toBeInTheDocument();
    expect(
      screen.getByText('Your session has ended. Please sign in again to continue using Gabay LMS.')
    ).toBeInTheDocument();

    const button = screen.getByRole('button', { name: /back to login/i });
    expect(button).toBeInTheDocument();
  });

  it('renders custom title, message, and buttonText when provided', () => {
    const onBackToLogin = vi.fn();
    render(
      <SessionExpiredModal
        isOpen={true}
        onBackToLogin={onBackToLogin}
        title="Custom Session Ended"
        message="Your credentials timed out. Log in to continue."
        buttonText="Return to Portal"
      />
    );

    expect(screen.getByText('Custom Session Ended')).toBeInTheDocument();
    expect(screen.getByText('Your credentials timed out. Log in to continue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to portal/i })).toBeInTheDocument();
  });

  it('triggers onBackToLogin when the action button is clicked', () => {
    const onBackToLogin = vi.fn();
    render(<SessionExpiredModal isOpen={true} onBackToLogin={onBackToLogin} />);

    const button = screen.getByRole('button', { name: /back to login/i });
    fireEvent.click(button);

    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });
});
