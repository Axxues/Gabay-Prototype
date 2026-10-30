import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Step3CourseOutline, normalizeOutline } from './Step3CourseOutline';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../../shared/data/syllabusData';

const blank = { timeFrame: '', title: '', topics: [] };
const legacySeeded = { timeFrame: 'Weeks', title: 'New Module Title', topics: [] };

const withOutline = (courseOutline: any[]) => ({
  ...OFFICIAL_SYLLABUS_CSPC112,
  courseOutline
} as any);

describe('normalizeOutline', () => {
  it('always leaves exactly one entry when nothing is filled in', () => {
    expect(normalizeOutline([])).toEqual([blank]);
    expect(normalizeOutline([blank, { ...blank }])).toEqual([blank]);
  });

  it('drops the legacy seeded row so only one default entry remains', () => {
    expect(normalizeOutline([legacySeeded, blank])).toEqual([blank]);
    expect(normalizeOutline([legacySeeded, { ...legacySeeded }])).toEqual([blank]);
  });

  it('keeps real entries and at most one blank row after them', () => {
    const filled = { timeFrame: 'Week 9', title: 'Midterm Examination Period', topics: ['Midterm'] };
    expect(normalizeOutline([filled, blank, { ...blank }])).toEqual([filled, blank]);
  });

  it('keeps an entry that only shares the old time frame but has a real title', () => {
    const row = { timeFrame: 'Weeks', title: 'Group Project', topics: ['Demo'] };
    expect(normalizeOutline([row])).toEqual([row]);
  });

  it('is idempotent', () => {
    const once = normalizeOutline([legacySeeded, blank]);
    expect(normalizeOutline(once)).toEqual(once);
  });
});

describe('Step3CourseOutline', () => {
  it('uses entry wording instead of module', () => {
    render(<Step3CourseOutline data={withOutline([blank])} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Add Entry/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Module/i })).not.toBeInTheDocument();
    expect(screen.getByText('Entry / Subject Matter Title')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('e.g. Entry 1: Overview of Knowledge Management')
    ).toBeInTheDocument();
    expect(screen.getByText(/Organize entries, subject matter/i)).toBeInTheDocument();
  });

  it('starts a blank syllabus with a single default entry', () => {
    const onChange = vi.fn();
    render(<Step3CourseOutline data={withOutline([])} onChange={onChange} />);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ courseOutline: [blank] })
    );
  });

  it('collapses two default entries down to one', () => {
    const onChange = vi.fn();
    render(
      <Step3CourseOutline data={withOutline([legacySeeded, blank])} onChange={onChange} />
    );

    expect(onChange.mock.calls[0][0].courseOutline).toEqual([blank]);
  });

  it('leaves a populated outline untouched', () => {
    const onChange = vi.fn();
    render(<Step3CourseOutline data={OFFICIAL_SYLLABUS_CSPC112} onChange={onChange} />);

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getAllByPlaceholderText('e.g. Entry 1: Overview of Knowledge Management')
    ).toHaveLength(OFFICIAL_SYLLABUS_CSPC112.courseOutline.length);
  });

  it('only offers removal once there is more than one entry', () => {
    const { rerender } = render(<Step3CourseOutline data={withOutline([blank])} onChange={vi.fn()} />);
    expect(screen.queryByTitle('Remove item')).not.toBeInTheDocument();

    rerender(<Step3CourseOutline data={withOutline([blank, { ...blank }])} onChange={vi.fn()} />);
    expect(screen.getAllByTitle('Remove item').length).toBeGreaterThan(0);
  });
});
