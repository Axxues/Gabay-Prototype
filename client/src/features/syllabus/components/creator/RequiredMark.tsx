import React from 'react';

/**
 * Red asterisk for a required input. Kept as a component so every step marks
 * required fields identically, and so tests can count them by aria-label.
 */
export const RequiredMark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-label="required"
    title="Required field"
    className={`text-destructive font-bold select-none ${className}`}
  >
    *
  </span>
);
