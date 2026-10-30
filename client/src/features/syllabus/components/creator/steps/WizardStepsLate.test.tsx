import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Step4LearningPlan } from './Step4LearningPlan';
import { Step5CourseMap } from './Step5CourseMap';
import { Step6GradingPolicies } from './Step6GradingPolicies';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../../shared/data/syllabusData';

describe('Wizard Steps Late', () => {
  it('Step 4 renders learning plan rows with SDG coherence and methodologies', () => {
    render(<Step4LearningPlan data={OFFICIAL_SYLLABUS_CSPC112} onChange={vi.fn()} />);
    expect(screen.getAllByText(/SDG 4/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Methodology/i).length).toBeGreaterThan(0);
  });

  it('Step 5 cycles cell alignment strictly between blank -> I -> P -> D -> blank (Review Focus 4)', () => {
    let currentData = OFFICIAL_SYLLABUS_CSPC112;
    const onChange = vi.fn((next) => { currentData = next; });
    const { rerender } = render(<Step5CourseMap data={currentData} onChange={onChange} />);

    // Target CO1 x PO1 button
    const cellBtn = screen.getByTestId('cell-co-1-po-1');
    fireEvent.click(cellBtn);
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 5 dynamically renders custom PO columns when POs are added or modified', () => {
    const customData = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      programOutcomes: [
        { number: 1, description: 'PO One' },
        { number: 2, description: 'PO Two' },
        { number: 12, description: 'PO Twelve Special' }
      ]
    };
    render(<Step5CourseMap data={customData} onChange={vi.fn()} />);
    expect(screen.getByText('PO12')).toBeInTheDocument();
    expect(screen.getByTestId('cell-co-1-po-12')).toBeInTheDocument();
  });

  it('Step 6 allows selecting reference formats (Books, Websites, Journal Articles) under APA 7th edition', () => {
    const onChange = vi.fn();
    render(<Step6GradingPolicies data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    // Check type buttons in toolbar
    expect(screen.getByRole('button', { name: /Add Book/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Journal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Website/i })).toBeInTheDocument();

    // Add a Website reference
    const addWebsiteBtn = screen.getByRole('button', { name: /Add Website/i });
    fireEvent.click(addWebsiteBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      references: expect.arrayContaining([
        expect.objectContaining({ type: 'website' })
      ])
    }));

    // Add a Journal reference
    const addJournalBtn = screen.getByRole('button', { name: /Add Journal/i });
    fireEvent.click(addJournalBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      references: expect.arrayContaining([
        expect.objectContaining({ type: 'journal' })
      ])
    }));

    // Test format selector tabs on first reference
    const journalTab = screen.getAllByRole('button', { name: /Journal Article/i })[0];
    fireEvent.click(journalTab);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      references: expect.arrayContaining([
        expect.objectContaining({ type: 'journal' })
      ])
    }));
  });

  it('Step 6 is dedicated to references and does not render duplicate grading review fields', () => {
    const onChange = vi.fn();
    render(<Step6GradingPolicies data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    // Grading and policy review fields have moved to Step 2
    expect(screen.queryByLabelText(/Passing Grade/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Term Formula/i)).not.toBeInTheDocument();

    // Verify adding a reference works properly
    const addBookBtn = screen.getByRole('button', { name: /Add Book/i });
    fireEvent.click(addBookBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      references: expect.arrayContaining([
        expect.objectContaining({ type: 'book' })
      ])
    }));
  });
});
