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

  it('Step 1 allows adding and updating consultation hour slots and days', () => {
    const onChange = vi.fn();
    render(<Step1CourseInfo data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    // Add consultation slot
    const addSlotBtn = screen.getAllByRole('button', { name: /Add slot/i })[0];
    fireEvent.click(addSlotBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      facultyMembers: expect.arrayContaining([
        expect.objectContaining({
          consultationSlots: expect.any(Array)
        })
      ])
    }));

    // Toggle a day button (e.g. 'M')
    const dayBtn = screen.getAllByRole('button', { name: 'M' })[0];
    fireEvent.click(dayBtn);
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
    fireEvent.click(screen.getByText(/Institutional Framework/i));

    const philInput = screen.getByLabelText(/Philosophy/i) as HTMLTextAreaElement;
    const missionInput = screen.getByLabelText(/Mission/i) as HTMLTextAreaElement;
    const visionInput = screen.getByLabelText(/Vision/i) as HTMLTextAreaElement;
    const goalInput = screen.getByLabelText(/Goals/i) as HTMLTextAreaElement;

    expect(philInput.value).toBe('Total human development with appropriate competencies.');
    expect(missionInput.value).toContain('Excellence in instruction, research and extension.');
    expect(visionInput.value).toContain('By 2030, DMMMSU IS A globally ranked university.');
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
    fireEvent.click(screen.getByText(/Institutional Framework/i));

    const philInput = screen.getByLabelText(/Philosophy/i);
    const missionInput = screen.getByLabelText(/Mission/i);
    const visionInput = screen.getByLabelText(/Vision/i);
    const goalInput = screen.getByLabelText(/Goals/i);

    expect(philInput).toBeDisabled();
    expect(missionInput).toBeDisabled();
    expect(visionInput).toBeDisabled();
    expect(goalInput).toBeDisabled();
    expect(screen.queryByText(/DMMMSU Standard/i)).not.toBeInTheDocument();
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

    // Enable rubric button - shows only one row with four placeholder levels
    const enableBtn = screen.getByRole('button', { name: /\+ Enable Project Rubric/i });
    fireEvent.click(enableBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      projectRubrics: [{
        category: '',
        levels: [
          { title: 'Level 1 (Beginning)', description: '' },
          { title: 'Level 2 (Developing)', description: '' },
          { title: 'Level 3 (Proficient)', description: '' },
          { title: 'Level 4 (Exemplary)', description: '' }
        ]
      }]
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

  it('Step 2 applies one performance-level count to every rubric criterion', () => {
    const onChange = vi.fn();
    const data = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      projectRubrics: [
        { category: 'Design', levels: [{ title: 'L1', description: '' }, { title: 'L2', description: '' }] },
        { category: 'Delivery', levels: [
          { title: 'L1', description: '' },
          { title: 'L2', description: '' },
          { title: 'L3', description: '' }
        ] }
      ]
    } as any;

    render(<Step2InstitutionalOutcomes data={data} onChange={onChange} />);

    // Per-row level controls are gone; the single count drives every criterion.
    expect(screen.queryByRole('button', { name: /Add Level/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Last/i })).not.toBeInTheDocument();

    // The count is stepper-driven, not typed: two rows of 2/3 levels align to 2.
    const countInput = screen.getByLabelText(/Performance levels per criterion/i);
    expect(countInput).toHaveAttribute('readonly');
    expect(countInput).toHaveValue(2);
    fireEvent.click(screen.getByRole('button', { name: /Increase performance levels/i }));

    const last = () => onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last().projectRubrics.map((r: any) => r.levels.length)).toEqual([3, 3]);
    // Existing titles survive the resize; the new slot gets a default title.
    expect(last().projectRubrics[0].levels.map((l: any) => l.title)).toEqual([
      'L1', 'L2', 'Level 3 (Proficient)'
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Add Rubric Criterion/i }));
    expect(last().projectRubrics).toHaveLength(3);
    expect(last().projectRubrics[2].levels).toHaveLength(3);
  });

  const mismatchedSchedules = {
    ...OFFICIAL_SYLLABUS_CSPC112,
    courseInfo: { ...OFFICIAL_SYLLABUS_CSPC112.courseInfo, type: 'Lecture' },
    facultyMembers: [
      {
        name: 'Raymund Dilan',
        sections: [{
          section: '4-A',
          lectureSchedule: '07:00 AM – 08:00 AM MWF',
          lectureRoom: 'LR1',
          labSchedule: '',
          labRoom: ''
        }],
        consultationSlots: []
      },
      {
        name: 'Elena Santos',
        sections: [{
          section: '4-B',
          lectureSchedule: '07:00 AM – 08:00 AM TTh',
          lectureRoom: 'LR2',
          labSchedule: '',
          labRoom: ''
        }],
        consultationSlots: []
      }
    ]
  } as any;

  it('Step 1 flags a section that has no schedule while another section does', () => {
    const partialLabSchedules = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      courseInfo: { ...OFFICIAL_SYLLABUS_CSPC112.courseInfo, type: 'Laboratory' },
      facultyMembers: [
        {
          name: 'Raymund Dilan',
          sections: [{ section: '4-E', lectureSchedule: '', lectureRoom: '', labSchedule: '09:00 AM – 10:30 AM MF', labRoom: '' }],
          consultationSlots: []
        },
        {
          name: 'Elena Santos',
          sections: [{ section: '4-A', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' }],
          consultationSlots: []
        }
      ]
    } as any;

    render(<Step1CourseInfo data={partialLabSchedules} onChange={vi.fn()} />);

    // The header chip is lecture-only; lab mismatches surface in the short alert.
    expect(screen.queryByText(/Lab Hours Mismatch/i)).not.toBeInTheDocument();
    expect(screen.getByText('Schedule Mismatch Detected')).toBeInTheDocument();
    expect(screen.queryByText(/Lab hours differ across sections/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No lab schedule \(expected 3 hrs\/wk\)/i)).toBeInTheDocument();
  });

  it('Step 1 flags mismatched weekly hours across sections', () => {
    render(<Step1CourseInfo data={mismatchedSchedules} onChange={vi.fn()} />);

    expect(screen.getByText(/Lecture Hours Mismatch/i)).toBeInTheDocument();
    // The shorter section shows its own deviation from the expected baseline.
    expect(screen.getByText(/2h \(expected 3h\)/i)).toBeInTheDocument();
    // Warnings use the alert icon now, not the ⚠️ emoji.
    expect(screen.queryByText(/⚠️/)).not.toBeInTheDocument();
  });

  it('Step 2 names the mismatched schedule on the Contact Hours field', () => {
    render(<Step2InstitutionalOutcomes data={mismatchedSchedules} onChange={vi.fn()} />);

    const lectureHours = screen.getByLabelText(/Contact Hours: Lecture Hours/i);
    expect(lectureHours).toHaveAttribute('placeholder', expect.stringMatching(/lecture schedules are mismatched/i));
    expect(screen.getByText(/Lecture Hours Mismatched across Sections/i)).toBeInTheDocument();
  });

  it('Step 2 steps the level count with the up/down buttons and arrow keys', () => {
    const onChange = vi.fn();
    const data = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      projectRubrics: [
        { category: 'Design', levels: [{ title: 'L1', description: '' }, { title: 'L2', description: '' }] }
      ]
    } as any;

    render(<Step2InstitutionalOutcomes data={data} onChange={onChange} />);

    const countInput = () => screen.getByLabelText(/Performance levels per criterion/i);
    expect(countInput()).toHaveValue(2);

    fireEvent.click(screen.getByRole('button', { name: /Increase performance levels/i }));
    expect(countInput()).toHaveValue(3);

    fireEvent.keyDown(countInput(), { key: 'ArrowUp' });
    expect(countInput()).toHaveValue(4);

    fireEvent.keyDown(countInput(), { key: 'ArrowDown' });
    expect(countInput()).toHaveValue(3);

    fireEvent.click(screen.getByRole('button', { name: /Decrease performance levels/i }));
    expect(countInput()).toHaveValue(2);

    // Every criterion follows the stepper.
    const last = () => onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last().projectRubrics[0].levels).toHaveLength(2);
  });

  it('Step 2 renders legacy keyed rubric levels without crashing', () => {
    const onChange = vi.fn();
    // Older drafts/rows stored levels as `{1: "...", 2: "..."}`; the first paint
    // must read through the normalizer instead of calling .map on the object.
    const legacyData = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      projectRubrics: [
        { category: 'Design', levels: { 1: 'Beginning work', 2: 'Advanced work' } }
      ]
    } as any;

    expect(() => render(<Step2InstitutionalOutcomes data={legacyData} onChange={onChange} />)).not.toThrow();
    expect(screen.getByDisplayValue('Beginning work')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Advanced work')).toBeInTheDocument();
  });

  it('Step 3 renders week ranges and time frames', () => {
    render(<Step3CourseOutline data={OFFICIAL_SYLLABUS_CSPC112} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue(/Weeks 1-7/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/MIDTERM EXAMINATION/i)).toBeInTheDocument();
  });
});

describe('Step 1 schedule mismatch badges', () => {
  const section = (name: string, lectureSchedule: string) => ({
    name,
    sections: [
      { section: name, lectureSchedule, lectureRoom: 'LR1', labSchedule: '', labRoom: '' }
    ],
    consultationSlots: [{ days: ['M'], time: '09:00 AM – 10:00 AM' }]
  });

  const withType = (facultyMembers: any[]) =>
    ({
      ...OFFICIAL_SYLLABUS_CSPC112,
      courseInfo: { ...OFFICIAL_SYLLABUS_CSPC112.courseInfo, type: 'Lecture' },
      facultyMembers
    }) as any;

  it('warns BOTH sections when two schedules do not match, with no expected figure', () => {
    render(
      <Step1CourseInfo
        data={withType([
          section('4-E', '07:00 AM – 08:30 AM MF'),
          section('4-A', '')
        ])}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('3 hrs/wk · Mismatched')).toBeInTheDocument();
    expect(screen.getByText('No lecture schedule · Mismatched')).toBeInTheDocument();
    expect(screen.queryByText(/expected/)).not.toBeInTheDocument();
    expect(screen.queryByText(/✓/)).not.toBeInTheDocument();
  });

  it('quotes the expected hours only on the odd one out of three', () => {
    render(
      <Step1CourseInfo
        data={withType([
          section('4-E', '07:00 AM – 08:30 AM MF'),
          section('4-B', '09:00 AM – 10:30 AM MF'),
          section('4-A', '')
        ])}
        onChange={vi.fn()}
      />
    );

    expect(screen.getAllByText('✓ 3 hrs/wk')).toHaveLength(2);
    expect(screen.getByText('No lecture schedule (expected 3 hrs/wk)')).toBeInTheDocument();
    expect(screen.queryByText(/Mismatched/)).not.toBeInTheDocument();
  });

  it('shows a plain check when every section agrees', () => {
    render(
      <Step1CourseInfo
        data={withType([
          section('4-E', '07:00 AM – 08:30 AM MF'),
          section('4-A', '09:00 AM – 10:30 AM MF')
        ])}
        onChange={vi.fn()}
      />
    );

    expect(screen.getAllByText('✓ 3 hrs/wk')).toHaveLength(2);
    expect(screen.queryByText(/Mismatched/)).not.toBeInTheDocument();
    expect(screen.queryByText(/expected/)).not.toBeInTheDocument();
  });
});
