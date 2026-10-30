import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Step1CourseInfo } from './Step1CourseInfo';
import { Step2InstitutionalOutcomes } from './Step2InstitutionalOutcomes';
import { Step3CourseOutline } from './Step3CourseOutline';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../../shared/data/syllabusData';

describe('Wizard Steps Early', () => {
  it('Step 1 renders institutional header, course identifiers, faculty name, semester, and academic year as disabled', () => {
    const onChange = vi.fn();
    render(<Step1CourseInfo data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    const univInput = screen.getByLabelText(/University Name/i);
    const collegeInput = screen.getByLabelText(/College \/ Campus/i);
    const formCodeInput = screen.getByLabelText(/Document Form Code/i);
    const revisionInput = screen.getByLabelText(/Document Revision/i);
    const codeInput = screen.getByLabelText(/Course No/i);
    const titleInput = screen.getByLabelText(/Descriptive Title/i);
    const semInput = screen.getByLabelText(/Academic Semester/i);
    const ayInput = screen.getByLabelText(/Academic Year/i);
    const facultyInput = screen.getAllByLabelText(/Name of Faculty Member/i)[0];
    const sectionInputs = screen.getAllByRole('textbox', { name: /^Section/i });

    expect(univInput).toBeDisabled();
    expect(collegeInput).toBeDisabled();
    expect(formCodeInput).toBeDisabled();
    expect(revisionInput).toBeDisabled();
    expect(codeInput).toBeDisabled();
    expect(titleInput).toBeDisabled();
    expect(semInput).toBeDisabled();
    expect(ayInput).toBeDisabled();
    expect(facultyInput).toBeDisabled();
    sectionInputs.forEach(input => expect(input).toBeDisabled());
  });

  it('Step 1 allows adding and updating section schedule rows and consultation hours', () => {
    const onChange = vi.fn();
    render(<Step1CourseInfo data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    // Add section row
    const addRowBtn = screen.getAllByRole('button', { name: /\+ Add section row/i })[0];
    fireEvent.click(addRowBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      facultyMembers: expect.arrayContaining([
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ section: '' })
          ])
        })
      ])
    }));

    const scheduleInput = screen.getAllByLabelText(/Schedule/i)[0];
    fireEvent.change(scheduleInput, { target: { value: 'TTh 09:00 AM - 10:30 AM' } });
    expect(onChange).toHaveBeenCalled();

    const consultationInput = screen.getAllByLabelText(/Consultation Hours/i)[0];
    fireEvent.change(consultationInput, { target: { value: 'Daily 03:00 PM - 04:00 PM' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 2 pre-fills institutional framework (Philosophy, Mission, Vision, Goals, Graduate Attributes, Core Values) statically from DMMMSU standard even when input data is empty', () => {
    const emptyDraftData = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      institutionalStatements: {
        philosophy: '',
        vision: '',
        mission: '',
        goal: '',
        coreValues: [],
        graduateAttributes: []
      }
    };
    render(<Step2InstitutionalOutcomes data={emptyDraftData} onChange={vi.fn()} />);

    const philInput = screen.getByLabelText(/Philosophy/i) as HTMLTextAreaElement;
    const missionInput = screen.getByLabelText(/Mission/i) as HTMLTextAreaElement;
    const visionInput = screen.getByLabelText(/Vision/i) as HTMLTextAreaElement;
    const goalInput = screen.getByLabelText(/Goals/i) as HTMLTextAreaElement;

    expect(philInput.value).toBe('Total human development');
    expect(missionInput.value).toContain('Develop human capital for nation building');
    expect(visionInput.value).toContain('A Premier University of the North by 2030');
    expect(goalInput.value).toContain('To lead in transforming human resources');
    expect(philInput).toBeDisabled();
    expect(missionInput).toBeDisabled();
    expect(visionInput).toBeDisabled();
    expect(goalInput).toBeDisabled();

    // Verify Graduate Attributes count and Core Values count are prefilled statically
    expect(screen.getByText(/Graduate Attributes \(6 Defined\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Core Values \(7 Defined\)/i)).toBeInTheDocument();

    // Toggle Graduate Attributes and verify items are displayed
    fireEvent.click(screen.getByText(/Graduate Attributes \(6 Defined\)/i));
    expect(screen.getByDisplayValue(/Professionally competent/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Responsible environment steward/i)).toBeInTheDocument();

    // Toggle Core Values and verify items are displayed
    fireEvent.click(screen.getByText(/Core Values \(7 Defined\)/i));
    expect(screen.getByDisplayValue('SERVICE')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LEADERSHIP')).toBeInTheDocument();
  });

  it('Step 2 renders Philosophy, Mission, Vision, and Goals as disabled inputs', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    const philInput = screen.getByLabelText(/Philosophy/i);
    const missionInput = screen.getByLabelText(/Mission/i);
    const visionInput = screen.getByLabelText(/Vision/i);
    const goalInput = screen.getByLabelText(/Goals/i);

    expect(philInput).toBeDisabled();
    expect(missionInput).toBeDisabled();
    expect(visionInput).toBeDisabled();
    expect(goalInput).toBeDisabled();
  });

  it('Step 2 renders Course Description as editable and updates on change', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    const descInput = screen.getByLabelText(/Course Description/i);
    expect(descInput).not.toBeDisabled();

    fireEvent.change(descInput, { target: { value: 'Updated editable syllabus course description.' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      courseInfo: expect.objectContaining({ description: 'Updated editable syllabus course description.' })
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

    // Remove PO1: former PO2 should become the new PO1
    const removePoBtn = screen.getByTitle(/^Remove PO1$/i);
    fireEvent.click(removePoBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      programOutcomes: expect.arrayContaining([
        expect.objectContaining({
          number: 1,
          description: OFFICIAL_SYLLABUS_CSPC112.programOutcomes[1].description
        })
      ])
    }));
  });

  it('Step 2 allows adding and deleting course outcomes with sequential re-indexing (CO2 becomes new CO1)', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    // Add CO
    const addOutcomeBtn = screen.getByRole('button', { name: /Add Course Outcome/i });
    fireEvent.click(addOutcomeBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      courseOutcomes: expect.arrayContaining([
        expect.objectContaining({ number: OFFICIAL_SYLLABUS_CSPC112.courseOutcomes.length + 1 })
      ])
    }));

    // Remove CO1: former CO2 must become the new CO1
    const removeCo1Btn = screen.getByTitle(/^Remove CO1$/i);
    fireEvent.click(removeCo1Btn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      courseOutcomes: expect.arrayContaining([
        expect.objectContaining({
          number: 1,
          statement: OFFICIAL_SYLLABUS_CSPC112.courseOutcomes[1].statement
        })
      ])
    }));
  });

  it('Step 2 restores university baseline', () => {
    const onChange = vi.fn();
    render(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);
    const restoreBtn = screen.getByRole('button', { name: /Restore University Baseline/i });
    fireEvent.click(restoreBtn);
    expect(onChange).toHaveBeenCalled();
  });

  it('Step 2 allows editing class standing components and classroom policies across separate individual inputs', () => {
    const onChange = vi.fn();
    const testData = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      gradingSystem: {
        ...OFFICIAL_SYLLABUS_CSPC112.gradingSystem,
        classStandingComponents: ['Quizzes (25%)', 'Laboratory (25%)']
      },
      classroomPolicies: ['Attendance policy', 'Dress code']
    };

    render(<Step2InstitutionalOutcomes data={testData} onChange={onChange} />);

    // Class standing components are individual inputs
    expect(screen.getByDisplayValue('Quizzes (25%)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Laboratory (25%)')).toBeInTheDocument();

    // Add component
    const addCompBtn = screen.getByRole('button', { name: /Add Component/i });
    fireEvent.click(addCompBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      gradingSystem: expect.objectContaining({
        classStandingComponents: ['Quizzes (25%)', 'Laboratory (25%)', '']
      })
    }));

    // Remove first component
    const removeComp1 = screen.getByLabelText(/Remove component 1/i);
    fireEvent.click(removeComp1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      gradingSystem: expect.objectContaining({
        classStandingComponents: ['Laboratory (25%)']
      })
    }));

    // Classroom policies are individual inputs
    expect(screen.getByDisplayValue('Attendance policy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dress code')).toBeInTheDocument();

    // Add policy
    const addPolicyBtn = screen.getByRole('button', { name: /Add Policy/i });
    fireEvent.click(addPolicyBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      classroomPolicies: ['Attendance policy', 'Dress code', '']
    }));

    // Remove first policy
    const removePol1 = screen.getByLabelText(/Remove policy 1/i);
    fireEvent.click(removePol1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      classroomPolicies: ['Dress code']
    }));
  });

  it('Step 2 manages optional Rubrics for Group Project Presentation and Documentation', () => {
    const onChange = vi.fn();
    // Initially without rubrics
    const noRubricData = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      projectRubrics: []
    };

    const { rerender } = render(<Step2InstitutionalOutcomes data={noRubricData} onChange={onChange} />);

    expect(screen.getByText(/Rubrics for Group Project Presentation and Documentation/i)).toBeInTheDocument();
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();

    // Enable rubric button - shows only one with placeholders
    const enableBtn = screen.getByRole('button', { name: /\+ Enable Project Rubric/i });
    fireEvent.click(enableBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      projectRubrics: [{ category: '', levels: { 1: '', 2: '', 3: '', 4: '' } }]
    }));

    // Rerender with active project rubrics
    rerender(<Step2InstitutionalOutcomes data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    // Verify checkbox is checked
    const checkbox = screen.getByLabelText(/Include in Syllabus/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    // Add rubric criterion row
    const addCriterionBtn = screen.getByRole('button', { name: /Add Rubric Criterion/i });
    fireEvent.click(addCriterionBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      projectRubrics: expect.arrayContaining([
        expect.objectContaining({ category: '' })
      ])
    }));

    // Uncheck to disable rubrics
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      projectRubrics: []
    }));
  });

  it('Step 3 renders week ranges and time frames', () => {
    render(<Step3CourseOutline data={OFFICIAL_SYLLABUS_CSPC112} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue(/Weeks 1-7/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/MIDTERM EXAMINATION/i)).toBeInTheDocument();
  });
});
