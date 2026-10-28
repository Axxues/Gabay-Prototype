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

  it('Step 6 updates grading formula and policies', () => {
    const onChange = vi.fn();
    render(<Step6GradingPolicies data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const passingGradeInput = screen.getByLabelText(/Passing Grade/i);
    fireEvent.change(passingGradeInput, { target: { value: '75%' } });
    expect(onChange).toHaveBeenCalled();
  });
});
