import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { SyllabusDocumentPreview } from './SyllabusDocumentPreview';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../shared/data/syllabusData';
import { createBaselineSyllabus } from '../../hooks/useSyllabusDraftsStorage';

describe('SyllabusDocumentPreview', () => {
  afterEach(cleanup);

  it('renders stacked 13x8.5 landscape sheets with repeating header and running footers', () => {
    const { container } = render(<SyllabusDocumentPreview syllabus={OFFICIAL_SYLLABUS_CSPC112} />);
    const sheets = container.querySelectorAll('.syllabus-page-sheet');
    expect(sheets.length).toBeGreaterThanOrEqual(10);

    // Every sheet must have the official header box and Course Syllabus title
    const titles = screen.getAllByRole('heading', { level: 1, name: /Course Syllabus/i });
    expect(titles.length).toBe(sheets.length);

    // First sheet must have Page 1 of N
    expect(screen.getByText(new RegExp(`Page 1 of ${sheets.length}`, 'i'))).toBeInTheDocument();

    // Schedule and Room Assignment must be present without a bordered table wrapper
    expect(screen.getByText(/Schedule and Room Assignment/i)).toBeInTheDocument();
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
    expect(screen.getByText(/CSPC 112 \u2013 Software Engineering 2/i)).toBeInTheDocument();
    // 2. Name of Faculty Member/s
    expect(screen.getAllByText('Dr. Santos').length).toBeGreaterThanOrEqual(1);
    // 3. Philosophy
    expect(screen.getByText(/Total human development/i)).toBeInTheDocument();
    // 4. Mission
    expect(screen.getByText(/Excellence in instruction, research and extension/i)).toBeInTheDocument();
    // 5. Vision
    expect(screen.getByText(/By 2030, DMMMSU IS A globally ranked university/i)).toBeInTheDocument();
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

  const structuredRefs = [
    { citation: 'Laplante, P. (2023). What Every Engineer Should Know About Software Engineering. CRC Press.', authors: 'Laplante, P.', year: '2023', title: 'What Every Engineer Should Know About Software Engineering', publisher: 'CRC Press' },
    { citation: 'Alonzo, A. (2022). Alpha Design. MIT Press.', authors: 'Alonzo, A.', year: '2022', title: 'Alpha Design', publisher: 'MIT Press' },
    { type: 'journal' as const, citation: 'Dalkir, K. (2019). Knowledge management in practice. Journal of Knowledge Management, 85(7/8), 162-171.', authors: 'Dalkir, K.', year: '2019', title: 'Knowledge management in practice', journal: 'Journal of Knowledge Management', volume: '85', issue: '7/8', pages: '162-171' },
    { citation: 'Legacy plain citation. (2020).', year: '2020' },
  ];

  it('renders the real references in Part V, alphabetized, with APA italics; sample text removed', () => {
    const { container } = render(<SyllabusDocumentPreview syllabus={{ ...OFFICIAL_SYLLABUS_CSPC112, references: [...structuredRefs].reverse() }} />);
    expect(screen.queryByText(/Dilan, R\./)).not.toBeInTheDocument();
    const emTexts = Array.from(container.querySelectorAll('em')).map(e => e.textContent);
    expect(emTexts).toContain('What Every Engineer Should Know About Software Engineering');
    expect(emTexts).toContain('Journal of Knowledge Management');
    // Legacy citation-only ref renders plain, no crash.
    expect(screen.getByText('Legacy plain citation. (2020).')).toBeInTheDocument();
    // Alphabetical: Alonzo citation appears before Laplante citation in document order.
    const text = container.textContent || '';
    expect(text.indexOf('Alonzo, A.')).toBeLessThan(text.indexOf('Laplante, P.'));
  });

  it('chunks references: 13 refs render one more sheet than 12 refs (12 per sheet)', () => {
    const mkMany = (n: number) => Array.from({ length: n }, (_, i) => ({ citation: `Author ${String.fromCharCode(65 + i)}. (${2020 + (i % 5)}). Book ${i + 1}. Press.`, authors: `Author ${String.fromCharCode(65 + i)}.`, year: String(2020 + (i % 5)), title: `Book ${i + 1}`, publisher: 'Press' }));
    const { container: with12 } = render(<SyllabusDocumentPreview syllabus={{ ...OFFICIAL_SYLLABUS_CSPC112, references: mkMany(12) }} />);
    const sheets12 = with12.querySelectorAll('.syllabus-page-sheet').length;
    cleanup();
    const { container: with13 } = render(<SyllabusDocumentPreview syllabus={{ ...OFFICIAL_SYLLABUS_CSPC112, references: mkMany(13) }} />);
    expect(with13.querySelectorAll('.syllabus-page-sheet').length).toBe(sheets12 + 1);
  });

  it('zero references: no Part V sheet, no crash', () => {
    const { container } = render(<SyllabusDocumentPreview syllabus={{ ...OFFICIAL_SYLLABUS_CSPC112, references: [] }} />);
    expect(screen.queryByText(/Part V: References/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('.syllabus-page-sheet').length).toBeGreaterThan(0);
  });
});