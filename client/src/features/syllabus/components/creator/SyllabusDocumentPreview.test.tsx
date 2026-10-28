import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SyllabusDocumentPreview } from './SyllabusDocumentPreview';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../shared/data/syllabusData';

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
});
