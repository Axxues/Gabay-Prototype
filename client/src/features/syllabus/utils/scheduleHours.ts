import type { FacultySchedule } from '../../../shared/data/syllabusData';

/**
 * Converts a time string like "08:00 AM", "8:00am", or "13:30" to minutes from midnight.
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridiem = match[3];
  if (meridiem) {
    const isPM = meridiem.toLowerCase() === 'pm';
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
  }
  return h * 60 + m;
}

/**
 * Computes weekly contact hours from a schedule string.
 * Example formats:
 *   "MWF 08:00 AM – 09:00 AM" => 3.0 hrs/week
 *   "TTh 10:00 AM – 11:30 AM" => 3.0 hrs/week
 *   "F 01:00 PM – 04:00 PM"   => 3.0 hrs/week
 */
export function computeWeeklyHours(scheduleStr: string): number {
  if (!scheduleStr) return 0;
  // Days may come before the times ("MWF 08:00 AM – 09:00 AM") or after them
  // ("08:00 AM – 09:00 AM MWF", which is what the schedule picker writes).
  const timeMatch = scheduleStr.match(
    /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[–\-—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i
  );
  if (!timeMatch) return 0;

  const daysStr = scheduleStr.replace(timeMatch[0], ' ').trim();

  // Match distinct days (Th first to avoid matching T inside Th)
  const dayTokens = ['Th', 'M', 'T', 'W', 'F', 'S'];
  let remaining = daysStr;
  let dayCount = 0;
  for (const token of dayTokens) {
    const re = new RegExp(token, 'g');
    const matches = remaining.match(re);
    if (matches) {
      dayCount += matches.length;
      remaining = remaining.replace(re, '');
    }
  }
  if (dayCount === 0) dayCount = 1;

  const startMins = parseTimeToMinutes(timeMatch[1]);
  const endMins = parseTimeToMinutes(timeMatch[2]);
  if (startMins === null || endMins === null || endMins <= startMins) return 0;

  const durationHours = (endMins - startMins) / 60;
  return Math.round(durationHours * dayCount * 10) / 10;
}

export interface SectionAnalysis {
  facultyName: string;
  facIdx: number;
  secIdx: number;
  section: string;
  lectureSchedule: string;
  lectureHours: number;
  lectureRoom?: string;
  labSchedule: string;
  labHours: number;
  labRoom?: string;
  hasLectureMismatch: boolean;
  hasLabMismatch: boolean;
}

export interface CourseScheduleAnalysis {
  allSections: SectionAnalysis[];
  canonicalLectureHours: number;
  canonicalLabHours: number;
  /**
   * Hours a strict majority of the sections actually carries, or null when the
   * sections are too divided for any of them to be called "expected". A blank
   * schedule counts as a vote, so two sections split 3h/0h agree on nothing.
   */
  baselineLectureHours: number | null;
  baselineLabHours: number | null;
  hasLectureMismatch: boolean;
  hasLabMismatch: boolean;
  hasMismatch: boolean;
  mismatchDetails?: {
    lectureSummary?: string;
    labSummary?: string;
  };
}

/**
 * The value held by a simple majority of the given hours, or null when nothing
 * is agreed. If 2 or more sections have the same hours, that becomes the baseline.
 * Zero hours are excluded from baseline determination - only scheduled sections
 * define the expected hours.
 */
function strictMajority(values: number[]): number | null {
  if (values.length === 0) return null;

  // Exclude 0 hours from baseline calculation
  const nonZeroValues = values.filter(v => v > 0);
  if (nonZeroValues.length === 0) return null;

  const counts = new Map<number, number>();
  for (const value of nonZeroValues) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  // Find the value with the highest count
  let bestValue: number | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestCount = count;
      bestValue = value;
    }
  });

  // If at least 2 sections agree, that becomes the baseline
  if (bestValue !== null && bestCount >= 2) {
    return bestValue;
  }

  return null;
}

/**
 * Analyzes assigned class sections across all faculty members to verify that
 * each individual class section has equal weekly lecture hours and equal weekly lab hours.
 *
 * Contact Hours in Section 2 represent the weekly hours per section/student,
 * NOT the cumulative teaching workload of an instructor across multiple sections.
 */
export function analyzeSectionSchedules(
  facultyMembers: FacultySchedule[] | undefined,
  courseType?: string
): CourseScheduleAnalysis {
  const showLecture = courseType !== 'Laboratory';
  const showLab = courseType === 'Laboratory' || courseType === 'Lecture and Laboratory';

  const allSections: SectionAnalysis[] = [];

  (facultyMembers || []).forEach((fac, facIdx) => {
    const sections = fac.sections && fac.sections.length > 0 ? fac.sections : [];
    sections.forEach((sec, secIdx) => {
      const lectureHours = computeWeeklyHours((sec as any).lectureSchedule || '');
      const labHours = computeWeeklyHours((sec as any).labSchedule || '');
      allSections.push({
        facultyName: fac.name || `Faculty ${facIdx + 1}`,
        facIdx,
        secIdx,
        section: sec.section || `Section ${secIdx + 1}`,
        lectureSchedule: (sec as any).lectureSchedule || '',
        lectureHours,
        lectureRoom: (sec as any).lectureRoom || '',
        labSchedule: (sec as any).labSchedule || '',
        labHours,
        labRoom: (sec as any).labRoom || '',
        hasLectureMismatch: false,
        hasLabMismatch: false
      });
    });
  });

  // The baseline is a strict majority, not merely "the first value found":
  // with 3 sections where 2 agree, the odd one out can be told what to expect;
  // with only 2 sections that disagree, neither can.
  const baselineLectureHours = strictMajority(allSections.map(s => s.lectureHours));
  const baselineLabHours = strictMajority(allSections.map(s => s.labHours));

  const usableBaseline = (baseline: number | null): number =>
    baseline !== null && baseline > 0 ? baseline : 0;

  const canonicalLectureHours = usableBaseline(baselineLectureHours);
  const canonicalLabHours = usableBaseline(baselineLabHours);

  // Every section is judged against that baseline: no agreement at all means
  // every section is out of line, while a blank majority only leaves the
  // scheduled sections standing out.
  allSections.forEach(sec => {
    if (showLecture) {
      sec.hasLectureMismatch =
        baselineLectureHours === null || sec.lectureHours !== baselineLectureHours;
    }
    if (showLab) {
      sec.hasLabMismatch = baselineLabHours === null || sec.labHours !== baselineLabHours;
    }
  });

  const hasLectureMismatch = showLecture && allSections.some(s => s.hasLectureMismatch);
  const hasLabMismatch = showLab && allSections.some(s => s.hasLabMismatch);

  let lectureSummary: string | undefined;
  if (hasLectureMismatch) {
    const breakdown = allSections
      .map(s => `${s.section} (${s.lectureHours > 0 ? `${s.lectureHours} hrs/wk` : 'no lecture schedule'})`)
      .join(', ');
    lectureSummary = `Lecture hours differ across sections: ${breakdown}. All sections must have identical lecture hours.`;
  }

  let labSummary: string | undefined;
  if (hasLabMismatch) {
    const breakdown = allSections
      .map(s => `${s.section} (${s.labHours > 0 ? `${s.labHours} hrs/wk` : 'no lab schedule'})`)
      .join(', ');
    labSummary = `Lab hours differ across sections: ${breakdown}. All sections must have identical lab hours.`;
  }

  return {
    allSections,
    // Only quote an "expected" figure when a real majority backs it; otherwise
    // 0, and the badge falls back to a plain Mismatched warning.
    canonicalLectureHours,
    canonicalLabHours,
    baselineLectureHours,
    baselineLabHours,
    hasLectureMismatch,
    hasLabMismatch,
    hasMismatch: hasLectureMismatch || hasLabMismatch,
    mismatchDetails: {
      lectureSummary,
      labSummary
    }
  };
}

/**
 * Whether one section's hours fall outside the agreed baseline, plus the figure
 * to quote as "expected" (0 when the sections never agreed on one, in which
 * case the caller should say "Mismatched" rather than invent an expectation).
 */
export function sectionDeviation(
  analysis: CourseScheduleAnalysis,
  kind: 'lecture' | 'lab',
  hours: number
): { deviating: boolean; expected: number } {
  const baseline = kind === 'lecture' ? analysis.baselineLectureHours : analysis.baselineLabHours;
  const expected = kind === 'lecture' ? analysis.canonicalLectureHours : analysis.canonicalLabHours;
  return {
    deviating: baseline === null || hours !== baseline,
    expected
  };
}

/**
 * Checks whether any assigned section has inconsistent weekly hours.
 * Drop-in replacement for the previous faculty-summed hoursMismatch.
 */
export function hoursMismatch(
  facultyMembers: FacultySchedule[] | undefined,
  field: 'lectureSchedule' | 'labSchedule',
  courseType?: string
): boolean {
  const analysis = analyzeSectionSchedules(facultyMembers, courseType);
  return field === 'lectureSchedule' ? analysis.hasLectureMismatch : analysis.hasLabMismatch;
}

/**
 * Formats numeric contact hours into a clean string (e.g. 3 => "3").
 */
export function formatHours(value: number): string {
  if (!value || value <= 0) return '';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}`;
}

