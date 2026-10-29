import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SyllabusDocumentPreview } from './SyllabusDocumentPreview';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../shared/data/syllabusData';
import { createBaselineSyllabus } from '../../hooks/useSyllabusDraftsStorage';

describe('SyllabusDocumentPreview', () => {
  it('renders institutional header, form code, and course descriptive title', () => {
    render(<SyllabusDocumentPreview syllabus={OFFICIAL_SYLLABUS_CSPC112} />);
    expect(screen.getByText(/Don Mariano Marcos Memorial State University/i)).toBeInTheDocument();
    expect(screen.getAllByText(/DMMMSU-INS-F003/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Software Engineering 2/i).length).toBeGreaterThan(0);
  });

  it('renders all 5 parts and signatories block', () => {
    render(<SyllabusDocumentPreview syllabus={OFFICIAL_SYLLABUS_CSPC112} />);
    expect(screen.getByText(/Part I:/i)).toBeInTheDocument();
    expect(screen.getByText(/Part II: Course Outline and Time Frame/i)).toBeInTheDocument();
    expect(screen.getByText(/Part III: Learning Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Part IV: Course Map/i)).toBeInTheDocument();
    expect(screen.getByText(/Part V: References/i)).toBeInTheDocument();
    expect(screen.getByText(/Prepared by:/i)).toBeInTheDocument();
    expect(screen.getByText(/Approved:/i)).toBeInTheDocument();
  });

  it('renders cleanly without throwing when optional fields are empty (Review Focus 3)', () => {
    const sparseSyllabus = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      courseInfo: { ...OFFICIAL_SYLLABUS_CSPC112.courseInfo, labHours: '', prerequisite: '' },
      facultyMembers: [],
      learningPlan: []
    };
    render(<SyllabusDocumentPreview syllabus={sparseSyllabus} />);
    expect(screen.getAllByText(/Software Engineering 2/i).length).toBeGreaterThan(0);
  });

  it('renders generic role fallbacks when signatories are omitted', () => {
    const withoutSignatories = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      signatories: {
        preparedBy: [],
        recommendingApproval: { name: '', title: '' },
        approved: { name: '', title: '' }
      },
      facultyMembers: []
    };
    render(<SyllabusDocumentPreview syllabus={withoutSignatories} />);
    expect(screen.getAllByText(/Faculty Member/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Program Chairperson/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dean \/ Institute Director/i).length).toBeGreaterThan(0);
  });

  it('renders custom program outcomes and custom institution header dynamically', () => {
    const customSyllabus = {
      ...OFFICIAL_SYLLABUS_CSPC112,
      institution: {
        university: 'Philippine State University',
        college: 'College of Engineering',
        formCode: 'PSU-FORM-001',
        revision: 'REV. 03'
      },
      programOutcomes: [
        { number: 1, description: 'First PO' },
        { number: 12, description: 'Twelfth PO Specialization' }
      ]
    };
    render(<SyllabusDocumentPreview syllabus={customSyllabus} />);
    expect(screen.getByText(/Philippine State University/i)).toBeInTheDocument();
    expect(screen.getByText(/College of Engineering/i)).toBeInTheDocument();
    expect(screen.getAllByText(/PSU-FORM-001/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Twelfth PO Specialization/i)).toBeInTheDocument();
    expect(screen.getByText('PO12')).toBeInTheDocument();
  });

  it('renders only the 9 default items on a baseline syllabus and leaves other parts blank', () => {
    const baseline = createBaselineSyllabus({
      courseInfo: {
        code: 'CSPC 112',
        title: 'Software Engineering 2',
        semester: 'First Semester',
        academicYear: '2026-2027',
        type: '',
        credit: '',
        lectureHours: '',
        labHours: '',
        prerequisite: '',
        description: 'Advanced software engineering methodologies and project development.'
      },
      facultyMembers: [{ name: 'Dr. Santos', sections: [], consultation: '' }]
    });

    render(<SyllabusDocumentPreview syllabus={baseline} />);

    // 1. Course No. & Descriptive Title
    expect(screen.getByText(/CSPC 112 – Software Engineering 2/i)).toBeInTheDocument();
    // 2. Name of Faculty Member/s
    expect(screen.getAllByText('Dr. Santos').length).toBeGreaterThanOrEqual(1);
    // 3. Philosophy
    expect(screen.getByText(/Total human development/i)).toBeInTheDocument();
    // 4. Mission
    expect(screen.getByText(/Excellence in instruction/i)).toBeInTheDocument();
    // 5. Vision
    expect(screen.getByText(/DMMMSU IS A globally ranked university/i)).toBeInTheDocument();
    // 6. Goals
    expect(screen.getByText(/To lead in transforming human resources into productive/i)).toBeInTheDocument();
    // 7. Graduate Attributes
    expect(screen.getByText(/Professionally competent/i)).toBeInTheDocument();
    // 8. Core Values
    expect(screen.getByText(/PRODUCTIVITY:/i)).toBeInTheDocument();
    // 9. Course Description
    expect(screen.getByText(/Advanced software engineering methodologies and project development./i)).toBeInTheDocument();

    // Other non-default parts must be blank / absent
    expect(screen.queryByText(/Upon graduation, successful graduates will attain the following program outcomes:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/By the end of the course, students should be able to:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Major Course Outputs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Class Standing \(Quizzes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Class attendance and punctuality must be observed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Orientation & Foundations of Computing/i)).not.toBeInTheDocument();
  });
});
