import React from 'react';
import type { OfficialSyllabusData, ConsultationSlot } from '../../../../../shared/data/syllabusData';
import { Calendar, MapPin, Clock, Landmark, Tag, Users, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { CustomDropdown } from '../../../../../shared/components/common/CustomDropdown';
import { TimeRangePicker } from '../../../../../shared/components/common';
import { analyzeSectionSchedules, computeWeeklyHours, sectionDeviation } from '../../../utils/scheduleHours';
import { RequiredMark } from '../RequiredMark';

interface Step1CourseInfoProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
  courseCode?: string;
  courseTitle?: string;
}

const DAY_OPTIONS = ['M', 'T', 'W', 'Th', 'F'];

/** Multi-select day pill row (up to 5 choices) */
const DayPicker: React.FC<{
  selected: string[];
  onChange: (days: string[]) => void;
}> = ({ selected, onChange }) => (
  <div className="flex flex-wrap gap-1">
    {DAY_OPTIONS.map(day => {
      const active = selected.includes(day);
      return (
        <button
          key={day}
          type="button"
          onClick={() => {
            if (active) {
              onChange(selected.filter(d => d !== day));
            } else if (selected.length < 5) {
              onChange([...selected, day]);
            }
          }}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
            active
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
          }`}
        >
          {day}
        </button>
      );
    })}
  </div>
);

export const Step1CourseInfo: React.FC<Step1CourseInfoProps> = ({
  data,
  onChange,
  courseCode,
  courseTitle
}) => {
  const institution = {
    university: data?.institution?.university?.trim() || 'Don Mariano Marcos Memorial State University',
    college: data?.institution?.college?.trim() || 'College of Computer Science',
    formCode: data?.institution?.formCode?.trim() || 'DMMMSU-INS-F003',
    revision: data?.institution?.revision?.trim() || 'REV. 02 (06.23.2025)'
  };
  const courseInfo = data?.courseInfo || {
    code: '',
    title: '',
    semester: '',
    academicYear: '',
    type: '',
    credit: '',
    lectureHours: '',
    labHours: '',
    prerequisite: '',
    description: ''
  };
  const facultyMembers = data?.facultyMembers || [];
  const blankSection = { section: '', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' };
  const effectiveFacultyMembers = facultyMembers.length > 0
    ? facultyMembers
    : [{ name: '', sections: [blankSection], consultationSlots: [{ days: [], time: '' }] }];

  const courseType = courseInfo.type || '';
  const showLecture = courseType === 'Lecture' || courseType === 'Lecture and Laboratory';
  const showLab = courseType === 'Laboratory' || courseType === 'Lecture and Laboratory';

  // ─── Contact Hours mismatch detection (Section 1 schedules) ────────────────
  const scheduleAnalysis = analyzeSectionSchedules(data.facultyMembers, courseType);
  const scheduleMismatch = scheduleAnalysis.hasMismatch;

  // ─── Section field helpers ───────────────────────────────────────────────
  const updateFacultySection = (
    fIndex: number,
    sIndex: number,
    field: 'lectureSchedule' | 'lectureRoom' | 'labSchedule' | 'labRoom',
    value: string
  ) => {
    const updated = [...effectiveFacultyMembers];
    if (!updated[fIndex]) {
      updated[fIndex] = { name: '', sections: [blankSection], consultationSlots: [{ days: [], time: '' }] };
    }
    const secList = [...(updated[fIndex].sections?.length ? updated[fIndex].sections : [blankSection])];
    if (!secList[sIndex]) secList[sIndex] = { ...blankSection };
    secList[sIndex] = { ...secList[sIndex], [field]: value };
    updated[fIndex] = { ...updated[fIndex], sections: secList };
    onChange({ ...data, facultyMembers: updated });
  };

  // ─── Consultation slot helpers ────────────────────────────────────────────
  const getSlots = (fIndex: number): ConsultationSlot[] => {
    const slots = effectiveFacultyMembers[fIndex]?.consultationSlots;
    return slots && slots.length > 0 ? slots : [{ days: [], time: '' }];
  };

  const updateConsultationSlot = (
    fIndex: number,
    sIndex: number,
    field: 'days' | 'time',
    value: string | string[]
  ) => {
    const updated = [...effectiveFacultyMembers];
    const slots = [...getSlots(fIndex)];
    slots[sIndex] = { ...slots[sIndex], [field]: value };
    updated[fIndex] = { ...updated[fIndex], consultationSlots: slots };
    onChange({ ...data, facultyMembers: updated });
  };

  const addConsultationSlot = (fIndex: number) => {
    const updated = [...effectiveFacultyMembers];
    const slots = [...getSlots(fIndex), { days: [], time: '' }];
    updated[fIndex] = { ...updated[fIndex], consultationSlots: slots };
    onChange({ ...data, facultyMembers: updated });
  };

  const removeConsultationSlot = (fIndex: number, sIndex: number) => {
    const updated = [...effectiveFacultyMembers];
    const slots = getSlots(fIndex).filter((_, i) => i !== sIndex);
    updated[fIndex] = { ...updated[fIndex], consultationSlots: slots.length > 0 ? slots : [{ days: [], time: '' }] };
    onChange({ ...data, facultyMembers: updated });
  };

  return (
    <div className="space-y-6">
      {/* Institutional & Document Control Header - Non-Editable */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
            <Landmark className="w-4 h-4 text-primary" />
            <span>Institutional &amp; Document Control Header</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="inst-university" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>University Name</span>
            </label>
            <input
              id="inst-university"
              type="text"
              disabled
              value={institution.university ?? ''}
              placeholder="e.g. Don Mariano Marcos Memorial State University"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="inst-college" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>College / Campus / Academic Unit</span>
            </label>
            <input
              id="inst-college"
              type="text"
              disabled
              value={institution.college ?? ''}
              placeholder="e.g. College of Computer Science"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="inst-formcode" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Document Form Code</span>
            </label>
            <input
              id="inst-formcode"
              type="text"
              disabled
              value={institution.formCode ?? ''}
              placeholder="e.g. DMMMSU-INS-F003"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="inst-revision" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Document Revision / Effective Date</span>
            </label>
            <input
              id="inst-revision"
              type="text"
              disabled
              value={institution.revision ?? ''}
              placeholder="e.g. REV. 02 (06.23.2025)"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {/* Basic Course Identification & Schedule (Table 0 in DMMMSU-INS-F003) */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
            <Tag className="w-4 h-4 text-primary" />
            <span>Basic Course Identification</span>
          </h3>
          {scheduleAnalysis.hasLectureMismatch && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30">
              <AlertTriangle className="w-3 h-3" />
              Lecture Hours Mismatch
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="course-code" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Course No. (Course Code)</span>
            </label>
            <input
              id="course-code"
              type="text"
              disabled
              value={courseInfo.code || courseCode || ''}
              placeholder="e.g. CSPC 112 or CS 101"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-title" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Descriptive Title</span>
            </label>
            <input
              id="course-title"
              type="text"
              disabled
              value={courseInfo.title || courseTitle || ''}
              placeholder="e.g. Software Engineering 2"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-semester" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Academic Semester</span>
            </label>
            <input
              id="course-semester"
              type="text"
              disabled
              value={courseInfo.semester ?? ''}
              placeholder="e.g. First Semester"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-ay" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Academic Year</span>
            </label>
            <input
              id="course-ay"
              type="text"
              disabled
              value={courseInfo.academicYear ?? ''}
              placeholder="e.g. 2026-2027"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
            />
          </div>
        </div>
      </div>

      {/* Individual Faculty Member Schedules & Consultation */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-primary" />
            <span>Assigned Faculty Member(s) &amp; Schedules</span>
          </h3>
          <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <RequiredMark />
            <CustomDropdown
              value={courseInfo.type ?? ''}
              onChange={val => onChange({ ...data, courseInfo: { ...courseInfo, type: val } })}
              options={[
                { value: 'Lecture', label: 'Lecture' },
                { value: 'Lecture and Laboratory', label: 'Lecture and Laboratory' },
                { value: 'Laboratory', label: 'Laboratory' }
              ]}
              placeholder="Course Type"
            />
          </div>
          </div>
        </div>

        {scheduleMismatch && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold">Schedule Mismatch Detected</span>
          </div>
        )}

        <div className="space-y-4">
          {effectiveFacultyMembers.map((fac, facIdx) => {
            const sections = fac.sections && fac.sections.length > 0
              ? fac.sections
              : [blankSection];
            const slots = getSlots(facIdx);
            const facLectureTotal = sections.reduce((sum, sec) => sum + computeWeeklyHours((sec as any).lectureSchedule || ''), 0);
            const facLabTotal = sections.reduce((sum, sec) => sum + computeWeeklyHours((sec as any).labSchedule || ''), 0);

            return (
              <div key={facIdx} className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      {facIdx + 1}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {fac.name || `Faculty Member ${facIdx + 1}`}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      {sections.map(s => s.section).filter(Boolean).join(', ') || 'Assigned Section(s)'}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                      Lec {facLectureTotal}h / Lab {facLabTotal}h
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor={`faculty-name-${facIdx}`} className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Name of Faculty Member</span>
                    </label>
                    <input
                      id={`faculty-name-${facIdx}`}
                      type="text"
                      disabled
                      value={fac.name ?? ''}
                      placeholder="e.g. RAYMUND E. DILAN"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all font-medium"
                    />
                  </div>

                  {/* Assigned Class Sections */}
                  {courseType && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Assigned Class Sections &amp; Class Schedules
                      </span>

                      <div className="space-y-2">
                        {sections.map((sec, secIdx) => {
                          const secLectureHours = computeWeeklyHours((sec as any).lectureSchedule || '');
                          const secLabHours = computeWeeklyHours((sec as any).labSchedule || '');
                          // "expected N hrs/wk" is only quoted when a majority of sections agrees on
                          // N; otherwise both sides of the disagreement get a plain Mismatched badge.
                          const lectureDeviation = sectionDeviation(scheduleAnalysis, 'lecture', secLectureHours);
                          const labDeviation = sectionDeviation(scheduleAnalysis, 'lab', secLabHours);
                          const isLectureDeviating = showLecture && lectureDeviation.deviating;
                          const isLabDeviating = showLab && labDeviation.deviating;

                          return (
                          <div
                            key={secIdx}
                            className="p-2.5 rounded-xl border border-border/70 bg-card/60 space-y-2"
                          >
                            {/* Section row header */}
                            <div className="space-y-1">
                              <label htmlFor={`sec-id-${facIdx}-${secIdx}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Section
                              </label>
                              <input
                                id={`sec-id-${facIdx}-${secIdx}`}
                                type="text"
                                disabled
                                value={sec.section ?? ''}
                                placeholder="e.g. 4-A"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none font-medium"
                              />
                            </div>

                            {/* Lecture fields */}
                            {showLecture && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                                      <Calendar className="w-3 h-3" />
                                      <span>Lecture Schedule</span>
                                      <RequiredMark className="text-[12px]" />
                                    </label>
                                    {(secLectureHours > 0 || isLectureDeviating || (showLecture && secLectureHours === 0)) && (
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                        isLectureDeviating || secLectureHours === 0
                                          ? 'bg-destructive/10 text-destructive border border-destructive/30'
                                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      }`}>
                                        {isLectureDeviating && <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />}
                                        <span>
                                          {secLectureHours === 0
                                            ? isLectureDeviating
                                              ? lectureDeviation.expected > 0
                                                ? `No lecture schedule (expected ${lectureDeviation.expected} hrs/wk)`
                                                : 'No lecture schedule · Mismatched'
                                              : 'No lecture schedule'
                                            : isLectureDeviating
                                            ? lectureDeviation.expected > 0
                                              ? `${secLectureHours}h (expected ${lectureDeviation.expected}h)`
                                              : `${secLectureHours} hrs/wk · Mismatched`
                                            : `✓ ${secLectureHours} hrs/wk`}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                  <TimeRangePicker
                                    value={(sec as any).lectureSchedule ?? ''}
                                    onChange={val => updateFacultySection(facIdx, secIdx, 'lectureSchedule', val)}
                                    placeholder="Click to set lecture time (e.g. 08:00 AM – 09:00 AM)"
                                    includeDays={true}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                                    <MapPin className="w-3 h-3" />
                                    <span>Lecture Room</span>
                                    <RequiredMark className="text-[12px]" />
                                  </label>
                                  <input
                                    type="text"
                                    value={(sec as any).lectureRoom ?? ''}
                                    onChange={e => updateFacultySection(facIdx, secIdx, 'lectureRoom', e.target.value)}
                                    placeholder="e.g. LR114"
                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Lab fields */}
                            {showLab && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                                      <Calendar className="w-3 h-3 text-amber-500" />
                                      <span className="text-amber-600 dark:text-amber-400">Lab Schedule</span>
                                      <RequiredMark className="text-[12px]" />
                                    </label>
                                    {(secLabHours > 0 || isLabDeviating || (showLab && secLabHours === 0)) && (
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                        isLabDeviating || secLabHours === 0
                                          ? 'bg-destructive/10 text-destructive border border-destructive/30'
                                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      }`}>
                                        {isLabDeviating && <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />}
                                        <span>
                                          {secLabHours === 0
                                            ? isLabDeviating
                                              ? labDeviation.expected > 0
                                                ? `No lab schedule (expected ${labDeviation.expected} hrs/wk)`
                                                : 'No lab schedule · Mismatched'
                                              : 'No lab schedule'
                                            : isLabDeviating
                                            ? labDeviation.expected > 0
                                              ? `${secLabHours}h (expected ${labDeviation.expected}h)`
                                              : `${secLabHours} hrs/wk · Mismatched`
                                            : `✓ ${secLabHours} hrs/wk`}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                  <TimeRangePicker
                                    value={(sec as any).labSchedule ?? ''}
                                    onChange={val => updateFacultySection(facIdx, secIdx, 'labSchedule', val)}
                                    placeholder="Click to set lab time (e.g. 10:00 AM – 12:00 PM)"
                                    includeDays={true}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                                    <MapPin className="w-3 h-3 text-amber-500" />
                                    <span className="text-amber-600 dark:text-amber-400">Lab Room</span>
                                    <RequiredMark className="text-[12px]" />
                                  </label>
                                  <input
                                    type="text"
                                    value={(sec as any).labRoom ?? ''}
                                    onChange={e => updateFacultySection(facIdx, secIdx, 'labRoom', e.target.value)}
                                    placeholder="e.g. CLR205"
                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Consultation Hours — structured day + time rows */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Consultation Hours</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => addConsultationSlot(facIdx)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Add slot
                      </button>
                    </div>

                    <div className="space-y-2">
                      {slots.map((slot, slotIdx) => (
                        <div key={slotIdx} className="flex items-start gap-2 p-2 rounded-xl border border-border/70 bg-card/60">
                          {/* Day multi-select */}
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                              <span>Day(s)</span>
                              <RequiredMark className="text-[10px]" />
                            </label>
                            <DayPicker
                              selected={slot.days || []}
                              onChange={days => updateConsultationSlot(facIdx, slotIdx, 'days', days)}
                            />
                          </div>

                          {/* Time range */}
                          <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                              <span>Time</span>
                              <RequiredMark className="text-[10px]" />
                            </label>
                            <TimeRangePicker
                              value={slot.time ?? ''}
                              onChange={val => updateConsultationSlot(facIdx, slotIdx, 'time', val)}
                              placeholder="Click to pick time (e.g. 09:00 AM – 10:00 AM)"
                            />
                          </div>

                          {/* Remove slot */}
                          {slots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeConsultationSlot(facIdx, slotIdx)}
                              className="mt-5 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                              title="Remove slot"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
