import { describe, it, expect } from 'vitest';
import { getMissingStepFields, isStepComplete } from './stepCompletion';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';

const d = (patch: any = {}) => ({ ...patch }) as OfficialSyllabusData;

const faculty = (patch: any = {}) => ({
  name: 'Raymund Dilan',
  sections: [
    {
      section: '4-A',
      lectureSchedule: '07:00 AM – 08:00 AM MWF',
      lectureRoom: 'LR1',
      labSchedule: '',
      labRoom: ''
    }
  ],
  consultationSlots: [{ days: ['M'], time: '09:00 AM – 10:00 AM' }],
  ...patch
});

describe('stepCompletion', () => {
  describe('course-info', () => {
    const base = d({ courseInfo: { type: 'Lecture' }, facultyMembers: [faculty()] });

    it('is complete when type, lecture time and consultation are set', () => {
      expect(getMissingStepFields('course-info', base)).toEqual([]);
      expect(isStepComplete('course-info', base)).toBe(true);
    });

    it('requires the course type', () => {
      expect(getMissingStepFields('course-info', d({ courseInfo: { type: '' }, facultyMembers: [faculty()] })))
        .toContain('Course Type');
    });

    it('requires a lecture schedule only when the course has lectures', () => {
      const noLecture = d({
        courseInfo: { type: 'Laboratory' },
        facultyMembers: [faculty({
          sections: [{ section: '4-A', lectureSchedule: '', lectureRoom: '', labSchedule: '01:00 PM – 03:00 PM', labRoom: 'CLR1' }]
        })]
      });
      expect(getMissingStepFields('course-info', noLecture)).toEqual([]);

      const labOnly = d({
        courseInfo: { type: 'Laboratory' },
        facultyMembers: [faculty({
          sections: [{ section: '4-A', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' }]
        })]
      });
      expect(getMissingStepFields('course-info', labOnly)).toEqual(['Lab Time']);
    });

    it('requires a lecture schedule when the course has lectures', () => {
      const missing = d({
        courseInfo: { type: 'Lecture' },
        facultyMembers: [faculty({
          sections: [{ section: '4-A', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' }]
        })]
      });
      expect(getMissingStepFields('course-info', missing)).toEqual(['Lecture Time']);
    });

    it('requires a consultation time', () => {
      const missing = d({
        courseInfo: { type: 'Lecture' },
        facultyMembers: [faculty({ consultationSlots: [{ days: [], time: '' }] })]
      });
      expect(getMissingStepFields('course-info', missing)).toEqual(['Consultation Time']);
    });

    it('requires at least one assigned faculty member', () => {
      expect(getMissingStepFields('course-info', d({ courseInfo: { type: 'Lecture' }, facultyMembers: [] })))
        .toEqual(['Assigned Faculty Member(s)']);
    });
  });

  describe('outcomes', () => {
    const base = d({
      courseInfo: { description: 'Official description.' },
      courseOutcomes: [{ number: 1, statement: 'CO1' }],
      gradingSystem: { termFormula: '60% + 40%', finalFormula: '50% + 50%' },
      classroomPolicies: ['Be on time.']
    });

    it('is complete when description, outcomes and formulas are set', () => {
      expect(getMissingStepFields('outcomes', base)).toEqual([]);
    });

    it('lists every missing required field', () => {
      expect(getMissingStepFields('outcomes', d({
        courseInfo: { description: '   ' },
        courseOutcomes: [],
        gradingSystem: { termFormula: '', finalFormula: '' },
        classroomPolicies: []
      }))).toEqual(['Course Description', 'Course Outcomes', 'Classroom Policies']);
    });
  });

  describe('outline', () => {
    it('requires at least one module', () => {
      expect(getMissingStepFields('outline', d({ courseOutline: [] }))).toEqual(['Course Outline Entries']);
    });

    it('requires time frame, title and subtopics', () => {
      expect(getMissingStepFields('outline', d({
        courseOutline: [{ timeFrame: '', title: '', topics: [] }]
      }))).toEqual(['Entry Time Frame', 'Entry Title', 'Entry Subtopics']);
    });

    it('does not require subtopics on examination rows', () => {
      expect(getMissingStepFields('outline', d({
        courseOutline: [{ timeFrame: 'Week 9', title: 'Midterm Examination', topics: [] }]
      }))).toEqual([]);
    });
  });

  describe('learning-plan', () => {
    it('requires a plan block with outcomes, methodology and assessment', () => {
      expect(getMissingStepFields('learning-plan', d({ learningPlan: [] }))).toEqual(['Plan Block']);
      expect(getMissingStepFields('learning-plan', d({
        learningPlan: [{ week: '', hoursLec: 0, hoursLab: 0, learningOutcomes: [], topics: [], methodology: [], assessment: [] }]
      }))).toEqual([
        'Block Time Frame',
        'Block Learning Outcomes',
        'Block Methodology',
        'Block Assessment'
      ]);
    });

    it('does not require topics', () => {
      expect(getMissingStepFields('learning-plan', d({
        learningPlan: [{ week: '1', hoursLec: 3, hoursLab: 0, learningOutcomes: ['LO'], topics: [], methodology: ['Lecture'], assessment: ['Quiz'] }]
      }))).toEqual([]);
    });
  });

  describe('course-map', () => {
    it('requires every course outcome to be mapped to a program outcome', () => {
      const unmapped = d({
        courseOutcomes: [{ number: 1, statement: 'CO1' }],
        courseMap: [{ coNumber: 1, coStatement: 'CO1', poAlignments: {} }]
      });
      expect(getMissingStepFields('course-map', unmapped)).toEqual(['PO Alignment']);

      const mapped = d({
        courseOutcomes: [{ number: 1, statement: 'CO1' }],
        courseMap: [{ coNumber: 1, coStatement: 'CO1', poAlignments: { 1: 'P' } }]
      });
      expect(getMissingStepFields('course-map', mapped)).toEqual([]);
    });

    it('requires course outcomes to exist', () => {
      expect(getMissingStepFields('course-map', d({ courseOutcomes: [], courseMap: [] })))
        .toEqual(['Course Outcomes']);
    });
  });

  describe('grading (references)', () => {
    it('requires at least one complete reference', () => {
      expect(getMissingStepFields('grading', d({ references: [] }))).toEqual(['References']);
      expect(getMissingStepFields('grading', d({
        references: [{ type: 'book', authors: 'Dalkir, K.', year: '', title: '' }]
      }))).toEqual(['Reference Year', 'Reference Title']);
    });
  });

  describe('review', () => {
    const signatories = {
      preparedBy: [{ name: 'RAYMUND DILAN', title: 'Faculty Member' }],
      recommendingApproval: { name: 'MARIA SANTOS', title: 'Department Chairperson' },
      approved: { name: 'CHARLIE MARZAN', title: 'Dean' }
    };

    it('is complete when all three signatories are named', () => {
      expect(getMissingStepFields('review', d({ signatories }))).toEqual([]);
    });

    it('flags each missing signatory', () => {
      expect(getMissingStepFields('review', d({
        signatories: { ...signatories, approved: { name: '', title: '' } }
      }))).toEqual(['College Dean']);
    });
  });
});
