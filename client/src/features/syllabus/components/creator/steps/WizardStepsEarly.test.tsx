import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Step1CourseInfo } from './Step1CourseInfo';
import { Step2InstitutionalOutcomes } from './Step2InstitutionalOutcomes';
import { Step3CourseOutline } from './Step3CourseOutline';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../../shared/data/syllabusData';

describe('Wizard Steps Early', () => {
  it('Step 1 updates course code and descriptive title', () => {
    const onChange = vi.fn();
    render(<Step1CourseInfo data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const codeInput = screen.getByLabelText(/Course Code/i);
    fireEvent.change(codeInput, { target: { value: 'CS 201' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 2 allows adding a new course outcome', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const addOutcomeBtn = screen.getByRole('button', { name: /Add Course Outcome/i });
    fireEvent.click(addOutcomeBtn);
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 3 renders week ranges and time frames', () => {
    render(<Step3CourseOutline data={OFFICIAL_SYLLABUS_CSPC112} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue(/Weeks 1-7/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/MIDTERM EXAMINATION/i)).toBeInTheDocument();
  });
});
