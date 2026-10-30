import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SyllabusWizard } from './SyllabusWizard';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../shared/data/syllabusData';

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

describe('SyllabusWizard schedule mismatch', () => {
  it('shows the mismatch chip on Section 1 only', () => {
    render(<SyllabusWizard data={mismatchedSchedules} onChange={vi.fn()} />);

    expect(screen.getByText('Schedule Mismatch')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Next Section/i }));

    // Section 2 flags the affected Contact Hours itself, but no header chip.
    expect(screen.queryByText('Schedule Mismatch')).not.toBeInTheDocument();
    expect(screen.getByText(/Lecture Hours Mismatched across Sections/i)).toBeInTheDocument();
  });

  it('shows no chip when every section shares the same hours', () => {
    const aligned = {
      ...mismatchedSchedules,
      facultyMembers: [
        { ...mismatchedSchedules.facultyMembers[0], sections: [{ ...mismatchedSchedules.facultyMembers[0].sections[0], lectureSchedule: '07:00 AM – 08:00 AM TTh' }] },
        mismatchedSchedules.facultyMembers[1]
      ]
    };

    render(<SyllabusWizard data={aligned} onChange={vi.fn()} />);
    expect(screen.queryByText('Schedule Mismatch')).not.toBeInTheDocument();
  });
});

describe('SyllabusWizard required-input tab badges', () => {
  // Course Type is empty, so Section 1 is incomplete; the signatories are
  // filled, so Section 7 is complete.
  const fixture = {
    ...OFFICIAL_SYLLABUS_CSPC112,
    courseInfo: { ...OFFICIAL_SYLLABUS_CSPC112.courseInfo, type: '' },
    signatories: {
      preparedBy: [{ name: 'RAYMUND DILAN', title: 'Faculty Member' }],
      recommendingApproval: { name: 'MARIA SANTOS', title: 'Department Chairperson' },
      approved: { name: 'CHARLIE MARZAN', title: 'Dean' }
    }
  } as any;

  const badgeOf = (name: RegExp) => screen.getByRole('button', { name });
  const statusOf = (name: RegExp) => badgeOf(name).querySelector('[data-status]')?.getAttribute('data-status');
  const iconOf = (name: RegExp) => badgeOf(name).querySelector('[data-icon]')?.getAttribute('data-icon');

  it('marks an incomplete section with a warning icon instead of a check', () => {
    render(<SyllabusWizard data={fixture} onChange={vi.fn()} />);

    // The active tab shows its position number, so leave Section 1 first.
    fireEvent.click(screen.getByRole('button', { name: /Next Section/i }));

    expect(statusOf(/Course Info/)).toBe('incomplete');
    expect(iconOf(/Course Info/)).toBe('warning');
  });

  it('marks a section whose required inputs are all filled with a check', () => {
    render(<SyllabusWizard data={fixture} onChange={vi.fn()} />);

    expect(statusOf(/Submit/)).toBe('complete');
    expect(iconOf(/Submit/)).toBe('check');
  });

  it('does not turn a section into a check just because you visited it', () => {
    render(<SyllabusWizard data={fixture} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Next Section/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next Section/i }));

    // Scrolled past Section 1 twice: it must still warn, never check.
    expect(statusOf(/Course Info/)).toBe('incomplete');
    expect(iconOf(/Course Info/)).toBe('warning');
    expect(statusOf(/Outline/)).toBe('current');
    expect(iconOf(/Outline/)).toBe('number');
  });

  it('marks every required input of each section with a red asterisk', () => {
    // Minimum required marks per section; repeated rows can only add more.
    const minimumMarks = [4, 5, 3, 5, 0, 3, 3];

    // Official data has a course type, so both lecture and lab rows render.
    render(<SyllabusWizard data={OFFICIAL_SYLLABUS_CSPC112} onChange={vi.fn()} />);

    minimumMarks.forEach(min => {
      expect(document.querySelectorAll('[aria-label="required"]').length).toBeGreaterThanOrEqual(min);
      fireEvent.click(screen.getByRole('button', { name: /Next Section/i }));
    });
  });

  it('updates the badge as required inputs are filled in', () => {
    const { rerender } = render(<SyllabusWizard data={fixture} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Next Section/i }));
    expect(statusOf(/Course Info/)).toBe('incomplete');

    rerender(
      <SyllabusWizard
        data={{ ...fixture, courseInfo: { ...fixture.courseInfo, type: 'Lecture' } }}
        onChange={vi.fn()}
      />
    );

    expect(statusOf(/Course Info/)).toBe('complete');
    expect(iconOf(/Course Info/)).toBe('check');
  });
});
