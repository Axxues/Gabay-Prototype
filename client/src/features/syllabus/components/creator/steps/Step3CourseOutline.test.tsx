import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  Step3CourseOutline,
  normalizeOutline,
  weeksInTimeFrame,
  totalOutlineWeeks,
  MAX_SEMESTER_WEEKS
} from './Step3CourseOutline';
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

describe('weeksInTimeFrame / totalOutlineWeeks', () => {
  it('counts a single week and inclusive ranges', () => {
    expect(weeksInTimeFrame('3')).toBe(1);
    expect(weeksInTimeFrame('1 - 4')).toBe(4);
    expect(weeksInTimeFrame('14-18')).toBe(5);
    expect(weeksInTimeFrame('9 - 6')).toBe(4);
  });

  it('counts non-numeric or partial input as zero', () => {
    expect(weeksInTimeFrame('')).toBe(0);
    expect(weeksInTimeFrame('Week 9')).toBe(0);
    expect(weeksInTimeFrame('1 - ')).toBe(0);
  });

  it('sums the whole outline', () => {
    expect(
      totalOutlineWeeks([{ timeFrame: '1 - 4' }, { timeFrame: '5' }, { timeFrame: '' }])
    ).toBe(5);
  });
});

describe('18-week semester cap', () => {
  const filled = (timeFrame: string) => ({ timeFrame, title: 'Topic', topics: [] });

  it('rejects a time frame that pushes the total past 18 weeks', () => {
    const onChange = vi.fn();
    render(
      <Step3CourseOutline
        data={withOutline([filled('1 - 4'), filled('5 - 8'), blank])}
        onChange={onChange}
      />
    );

    const inputs = screen.getAllByPlaceholderText('e.g. 1 or 1 - 4');
    fireEvent.change(inputs[2], { target: { value: '9 - 20' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(inputs[2], { target: { value: '9 - 18' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].courseOutline[2].timeFrame).toBe('9 - 18');
  });

  it('still allows corrections when a draft already exceeds 18 weeks', () => {
    const onChange = vi.fn();
    render(
      <Step3CourseOutline data={withOutline([filled('1 - 10'), filled('11 - 20')])} onChange={onChange} />
    );

    fireEvent.change(screen.getAllByPlaceholderText('e.g. 1 or 1 - 4')[1], {
      target: { value: '11 - 18' }
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].courseOutline[1].timeFrame).toBe('11 - 18');
  });

  it('shows the running week total against the cap', () => {
    render(<Step3CourseOutline data={withOutline([filled('1 - 4')])} onChange={vi.fn()} />);
    expect(screen.getByText(`Total Weeks: 4 / ${MAX_SEMESTER_WEEKS}`)).toBeInTheDocument();
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
