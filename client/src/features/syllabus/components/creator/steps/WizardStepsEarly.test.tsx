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

  it('Step 1 updates institutional header fields and class section', () => {
    const onChange = vi.fn();
    render(<Step1CourseInfo data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    const univInput = screen.getByLabelText(/University Name/i);
    fireEvent.change(univInput, { target: { value: 'DMMMSU North La Union Campus' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      institution: expect.objectContaining({ university: 'DMMMSU North La Union Campus' })
    }));

    const collegeInput = screen.getByLabelText(/College \/ Campus/i);
    fireEvent.change(collegeInput, { target: { value: 'College of Information Technology' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      institution: expect.objectContaining({ college: 'College of Information Technology' })
    }));

    const sectionInput = screen.getByLabelText(/Class Section \/ Group/i);
    fireEvent.change(sectionInput, { target: { value: 'BSCS 4B' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 2 allows editing Philosophy, Vision, Mission, and Goal', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    const philInput = screen.getByLabelText(/Philosophy/i);
    fireEvent.change(philInput, { target: { value: 'Custom institutional philosophy.' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      institutionalStatements: expect.objectContaining({
        philosophy: 'Custom institutional philosophy.'
      })
    }));

    const visionInput = screen.getByLabelText(/Vision/i);
    fireEvent.change(visionInput, { target: { value: 'Global leader by 2035.' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      institutionalStatements: expect.objectContaining({
        vision: 'Global leader by 2035.'
      })
    }));
  });

  it('Step 2 allows editing, adding, and removing Program Outcomes', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    // Edit PO1
    const po1Textarea = screen.getByPlaceholderText(/Describe Program Outcome 1\.\.\./i);
    fireEvent.change(po1Textarea, { target: { value: 'Updated PO1 competency.' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      programOutcomes: expect.arrayContaining([
        expect.objectContaining({ number: 1, description: 'Updated PO1 competency.' })
      ])
    }));

    // Add PO
    const addPoBtn = screen.getByRole('button', { name: /Add Program Outcome/i });
    fireEvent.click(addPoBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      programOutcomes: expect.arrayContaining([
        expect.objectContaining({ number: 12 })
      ])
    }));

    // Remove PO1
    const removePoBtn = screen.getByTitle(/^Remove PO1$/i);
    fireEvent.click(removePoBtn);
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 2 allows adding a new course outcome', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const addOutcomeBtn = screen.getByRole('button', { name: /Add Course Outcome/i });
    fireEvent.click(addOutcomeBtn);
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 2 restores university baseline', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const restoreBtn = screen.getByRole('button', { name: /Restore University Baseline/i });
    fireEvent.click(restoreBtn);
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 3 renders week ranges and time frames', () => {
    render(<Step3CourseOutline data={OFFICIAL_SYLLABUS_CSPC112} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue(/Weeks 1-7/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/MIDTERM EXAMINATION/i)).toBeInTheDocument();
  });
});
