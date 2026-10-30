import { describe, it, expect } from 'vitest';
import {
  computeWeeklyHours,
  analyzeSectionSchedules,
  hoursMismatch,
  sectionDeviation,
  formatHours
} from './scheduleHours';
import type { FacultySchedule } from '../../../shared/data/syllabusData';

describe('scheduleHours utility', () => {
  describe('computeWeeklyHours', () => {
    it('computes hours for MWF 1-hour meetings (3 hrs/week)', () => {
      expect(computeWeeklyHours('MWF 08:00 AM – 09:00 AM')).toBe(3);
    });

    it('computes hours for TTh 1.5-hour meetings (3 hrs/week)', () => {
      expect(computeWeeklyHours('TTh 10:00 AM – 11:30 AM')).toBe(3);
    });

    it('computes hours for single day 3-hour meetings (3 hrs/week)', () => {
      expect(computeWeeklyHours('F 01:00 PM – 04:00 PM')).toBe(3);
    });

    it('parses the picker format, where days come after the times', () => {
      expect(computeWeeklyHours('07:00 AM – 08:00 AM M')).toBe(1);
      expect(computeWeeklyHours('07:00 AM – 08:00 AM MWF')).toBe(3);
      expect(computeWeeklyHours('07:00 AM – 08:00 AM TTh')).toBe(2);
      expect(computeWeeklyHours('07:00 AM – 03:30 PM TTh')).toBe(17);
    });

    it('returns 0 for empty or invalid schedules', () => {
      expect(computeWeeklyHours('')).toBe(0);
      expect(computeWeeklyHours('TBA')).toBe(0);
    });
  });

  describe('analyzeSectionSchedules', () => {
    it('does NOT flag a mismatch when Faculty A has 2 sections and Faculty B has 1 section with equal hours', () => {
      const faculty: FacultySchedule[] = [
        {
          name: 'Prof. A',
          sections: [
            { section: 'BSCS 4-A', lectureSchedule: 'MWF 08:00 AM – 09:00 AM', labSchedule: 'TTh 01:00 PM – 02:30 PM' } as any,
            { section: 'BSCS 4-B', lectureSchedule: 'MWF 09:00 AM – 10:00 AM', labSchedule: 'TTh 02:30 PM – 04:00 PM' } as any
          ]
        },
        {
          name: 'Prof. B',
          sections: [
            { section: 'BSCS 4-C', lectureSchedule: 'TTh 10:00 AM – 11:30 AM', labSchedule: 'F 08:00 AM – 11:00 AM' } as any
          ]
        }
      ];

      const analysis = analyzeSectionSchedules(faculty, 'Lecture and Laboratory');
      expect(analysis.hasMismatch).toBe(false);
      expect(analysis.hasLectureMismatch).toBe(false);
      expect(analysis.hasLabMismatch).toBe(false);
      expect(analysis.canonicalLectureHours).toBe(3);
      expect(analysis.canonicalLabHours).toBe(3);
      expect(analysis.allSections).toHaveLength(3);
      expect(analysis.allSections.every(s => !s.hasLectureMismatch && !s.hasLabMismatch)).toBe(true);
    });

    it('detects a mismatch when sections have conflicting hours', () => {
      const faculty: FacultySchedule[] = [
        {
          name: 'Prof. A',
          sections: [
            { section: 'BSCS 4-A', lectureSchedule: 'MWF 08:00 AM – 09:00 AM' } as any // 3 hrs
          ]
        },
        {
          name: 'Prof. B',
          sections: [
            { section: 'BSCS 4-B', lectureSchedule: 'TTh 08:00 AM – 09:00 AM' } as any // 2 hrs
          ]
        }
      ];

      const analysis = analyzeSectionSchedules(faculty, 'Lecture');
      expect(analysis.hasMismatch).toBe(true);
      expect(analysis.hasLectureMismatch).toBe(true);
      // Two sections that disagree name no "expected" figure...
      expect(analysis.baselineLectureHours).toBeNull();
      expect(analysis.canonicalLectureHours).toBe(0);
      expect(analysis.mismatchDetails?.lectureSummary).toContain('Lecture hours differ');
      // ...and BOTH are flagged, not only the one that happens to be lower.
      expect(analysis.allSections.every(s => s.hasLectureMismatch)).toBe(true);
    });

    it('warns both sides when two sections do not match', () => {
      const faculty: FacultySchedule[] = [
        { name: 'Prof. A', sections: [{ section: '4-E', lectureSchedule: '07:00 AM – 08:30 AM MF' } as any] }, // 3 hrs
        { name: 'Prof. B', sections: [{ section: '4-A', lectureSchedule: '' } as any] } // none
      ];

      const analysis = analyzeSectionSchedules(faculty, 'Lecture and Laboratory');
      const lecture = analysis.allSections.find(s => s.section === '4-E')!;
      const missing = analysis.allSections.find(s => s.section === '4-A')!;

      expect(analysis.baselineLectureHours).toBeNull();
      expect(lecture.hasLectureMismatch).toBe(true);
      expect(missing.hasLectureMismatch).toBe(true);
      // No agreed figure, so the badge must say "Mismatched" instead of "expected 3".
      expect(sectionDeviation(analysis, 'lecture', 3).expected).toBe(0);
      expect(sectionDeviation(analysis, 'lecture', 0).expected).toBe(0);
      expect(sectionDeviation(analysis, 'lecture', 3).deviating).toBe(true);
      expect(sectionDeviation(analysis, 'lecture', 0).deviating).toBe(true);
    });

    it('quotes the expected hours when two of three sections agree', () => {
      const faculty: FacultySchedule[] = [
        {
          name: 'Prof. A',
          sections: [
            { section: '4-E', lectureSchedule: '07:00 AM – 08:30 AM MF' } as any, // 3 hrs
            { section: '4-B', lectureSchedule: '09:00 AM – 10:30 AM MF' } as any // 3 hrs
          ]
        },
        { name: 'Prof. B', sections: [{ section: '4-A', lectureSchedule: '' } as any] } // none
      ];

      const analysis = analyzeSectionSchedules(faculty, 'Lecture and Laboratory');

      expect(analysis.baselineLectureHours).toBe(3);
      expect(analysis.canonicalLectureHours).toBe(3);
      expect(analysis.allSections.filter(s => s.hasLectureMismatch)).toHaveLength(1);
      expect(analysis.allSections.find(s => s.section === '4-A')?.hasLectureMismatch).toBe(true);
      expect(sectionDeviation(analysis, 'lecture', 0).deviating).toBe(true);
      expect(sectionDeviation(analysis, 'lecture', 0).expected).toBe(3);
      expect(sectionDeviation(analysis, 'lecture', 3).deviating).toBe(false);
    });

    it('flags sections left without a schedule once another section is filled', () => {
      const faculty: FacultySchedule[] = [
        { name: 'Prof. A', sections: [{ section: '4-E', labSchedule: '09:00 AM – 10:30 AM MF' } as any] }, // 3 hrs
        { name: 'Prof. B', sections: [{ section: '4-A', labSchedule: '' } as any] } // not set yet
      ];

      const analysis = analyzeSectionSchedules(faculty, 'Laboratory');
      expect(analysis.hasLabMismatch).toBe(true);
      expect(analysis.hasMismatch).toBe(true);
      // Only one section is scheduled, so there is no majority to call expected.
      expect(analysis.baselineLabHours).toBeNull();
      expect(analysis.canonicalLabHours).toBe(0);
      expect(analysis.allSections.every(s => s.hasLabMismatch)).toBe(true);
      expect(analysis.mismatchDetails?.labSummary).toContain('no lab schedule');
    });

    it('does not flag anything while no section is scheduled yet', () => {
      const faculty: FacultySchedule[] = [
        { name: 'Prof. A', sections: [{ section: '4-E', labSchedule: '' } as any] },
        { name: 'Prof. B', sections: [{ section: '4-A', labSchedule: '' } as any] }
      ];

      const analysis = analyzeSectionSchedules(faculty, 'Laboratory');
      expect(analysis.hasMismatch).toBe(false);
      expect(analysis.canonicalLabHours).toBe(0);
    });

    it('detects a mismatch between picker-formatted (trailing days) schedules', () => {
      const faculty: FacultySchedule[] = [
        { name: 'Prof. A', sections: [{ section: 'BSCS 4-A', lectureSchedule: '07:00 AM – 08:00 AM MWF' } as any] }, // 3 hrs
        { name: 'Prof. B', sections: [{ section: 'BSCS 4-B', lectureSchedule: '07:00 AM – 08:00 AM TTh' } as any] } // 2 hrs
      ];

      const analysis = analyzeSectionSchedules(faculty, 'Lecture');
      expect(analysis.hasLectureMismatch).toBe(true);
      // Two sections, two different figures: no agreed expectation.
      expect(analysis.canonicalLectureHours).toBe(0);
      expect(analysis.allSections.every(s => s.hasLectureMismatch)).toBe(true);
    });

    it('ignores lab mismatch when courseType is Lecture only', () => {
      const faculty: FacultySchedule[] = [
        {
          name: 'Prof. A',
          sections: [
            { section: 'BSCS 4-A', lectureSchedule: 'MWF 08:00 AM – 09:00 AM', labSchedule: 'F 08:00 AM – 10:00 AM' } as any
          ]
        },
        {
          name: 'Prof. B',
          sections: [
            { section: 'BSCS 4-B', lectureSchedule: 'MWF 09:00 AM – 10:00 AM', labSchedule: 'F 08:00 AM – 11:00 AM' } as any
          ]
        }
      ];

      // Since courseType is 'Lecture', lab difference is ignored
      const analysis = analyzeSectionSchedules(faculty, 'Lecture');
      expect(analysis.hasMismatch).toBe(false);
      expect(analysis.canonicalLectureHours).toBe(3);
    });
  });

  describe('formatHours', () => {
    it('formats numbers into clean strings', () => {
      expect(formatHours(3)).toBe('3');
      expect(formatHours(2.5)).toBe('2.5');
      expect(formatHours(0)).toBe('');
    });
  });
});

