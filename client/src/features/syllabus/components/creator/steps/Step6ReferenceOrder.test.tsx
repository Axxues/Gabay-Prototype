// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Step6GradingPolicies } from './Step6GradingPolicies';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';

const base = { facultyMembers: [], institutionalStatements: {}, programOutcomes: [], courseOutcomes: [], courseRequirements: { major: [], other: [] }, gradingSystem: {}, projectRubrics: [], classroomPolicies: [], courseOutline: [], learningPlan: [], courseMap: [], signatories: { preparedBy: [], recommendingApproval: { name: '', title: '' }, approved: { name: '', title: '' } } } as unknown as OfficialSyllabusData;

const zed = { citation: 'Zulueta, Z. (2020). Zed Systems. Zed Press.', authors: 'Zulueta, Z.', year: '2020', title: 'Zed Systems', publisher: 'Zed Press' };

describe('Step 6 reference ordering and italics', () => {
  // CollapsibleCard's header is a div[role=button] whose accessible name
  // contains all card text, so scope queries to real <button> elements.
  const realButton = (name: RegExp) =>
    screen.getAllByRole('button', { name }).find(el => el.tagName === 'BUTTON') as HTMLElement;

  it('stores newly added references alphabetically (APA key)', () => {
    const onChange = vi.fn();
    render(<Step6GradingPolicies data={{ ...base, references: [zed] } as OfficialSyllabusData} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Laplante, P\. or Dalkir, K\./i), { target: { value: 'Alonzo, A.' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 2023'), { target: { value: '2023' } });
    fireEvent.change(screen.getByPlaceholderText(/What Every Engineer/i), { target: { value: 'Alpha Systems' } });
    fireEvent.click(realButton(/Add Reference/i));
    expect(onChange).toHaveBeenCalledTimes(1);
    const refs = onChange.mock.calls[0][0].references;
    expect(refs[0].authors).toBe('Alonzo, A.');
    expect(refs[1].authors).toBe('Zulueta, Z.');
  });

  it('renders saved references with APA italics (book title inside <em>)', () => {
    render(<Step6GradingPolicies data={{ ...base, references: [zed] } as OfficialSyllabusData} onChange={vi.fn()} />);
    expect(screen.getByText('Zed Systems').closest('em')).not.toBeNull();
  });

  it('legacy citation-only refs render as plain text', () => {
    render(<Step6GradingPolicies data={{ ...base, references: [{ citation: 'Legacy plain citation.', year: '2020' }] } as OfficialSyllabusData} onChange={vi.fn()} />);
    expect(screen.getByText('Legacy plain citation.')).toBeInTheDocument();
  });
});
