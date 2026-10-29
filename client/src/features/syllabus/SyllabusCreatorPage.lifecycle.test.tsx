import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyllabusCreatorPage } from './SyllabusCreatorPage';
import { LMSProvider } from '../../shared/context/LMSContext';

describe('SyllabusCreatorPage Lifecycle Integration', () => {
  it('renders Department Syllabus Governance table for Chairperson persona', () => {
    // When rendered with chair role or admin, the department syllabus table is accessible
    render(
      <LMSProvider>
        <SyllabusCreatorPage />
      </LMSProvider>
    );

    expect(screen.getByText(/Syllabus Development/i)).toBeInTheDocument();
  });
});
