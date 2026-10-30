import React from 'react';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';
import { Calendar, MapPin, Clock, Landmark, Tag, Users, Plus, Trash2 } from 'lucide-react';

interface Step1CourseInfoProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
  courseCode?: string;
  courseTitle?: string;
}

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
  const effectiveFacultyMembers = facultyMembers.length > 0
    ? facultyMembers
    : [{ name: '', sections: [{ section: '', schedule: '', room: '' }], consultation: '' }];

  const addSectionRow = (fIndex: number) => {
    const updated = [...effectiveFacultyMembers];
    if (!updated[fIndex]) {
      updated[fIndex] = { name: '', sections: [], consultation: '' };
    }
    const secList = [...(updated[fIndex].sections || [])];
    secList.push({ section: '', schedule: '', room: '' });
    updated[fIndex] = {
      ...updated[fIndex],
      sections: secList
    };
    onChange({
      ...data,
      facultyMembers: updated
    });
  };

  const removeSectionRow = (fIndex: number, sIndex: number) => {
    const updated = [...effectiveFacultyMembers];
    if (!updated[fIndex]) return;
    const secList = (updated[fIndex].sections || []).filter((_, idx) => idx !== sIndex);
    updated[fIndex] = {
      ...updated[fIndex],
      sections: secList.length > 0 ? secList : [{ section: '', schedule: '', room: '' }]
    };
    onChange({
      ...data,
      facultyMembers: updated
    });
  };

  const updateFacultySection = (
    fIndex: number,
    sIndex: number,
    field: 'section' | 'schedule' | 'room',
    value: string
  ) => {
    const updated = [...effectiveFacultyMembers];
    if (!updated[fIndex]) {
      updated[fIndex] = { name: '', sections: [{ section: '', schedule: '', room: '' }], consultation: '' };
    }
    const secList = [...(updated[fIndex].sections || [{ section: '', schedule: '', room: '' }])];
    if (!secList[sIndex]) {
      secList[sIndex] = { section: '', schedule: '', room: '' };
    }
    secList[sIndex] = {
      ...secList[sIndex],
      [field]: value
    };
    updated[fIndex] = {
      ...updated[fIndex],
      sections: secList
    };
    onChange({
      ...data,
      facultyMembers: updated
    });
  };

  const updateFacultyConsultation = (fIndex: number, value: string) => {
    const updated = [...effectiveFacultyMembers];
    if (!updated[fIndex]) {
      updated[fIndex] = { name: '', sections: [{ section: '', schedule: '', room: '' }], consultation: '' };
    }
    updated[fIndex] = {
      ...updated[fIndex],
      consultation: value
    };
    onChange({
      ...data,
      facultyMembers: updated
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
          <Tag className="w-5 h-5 text-primary" />
          <span>Course Identification &amp; Schedule</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Institutional header, course identifiers, collegiate semester setup, and assigned faculty schedules aligned with DMMMSU-INS-F003 Table 0.
        </p>
      </div>

      {/* Institutional & Document Control Header - Non-Editable */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
            <Landmark className="w-4 h-4 text-primary" />
            <span>Institutional &amp; Document Control Header</span>
          </h3>
          <span className="text-[10px] text-muted-foreground italic">Institutional Standard</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="inst-university" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>University Name</span>
              <span className="text-[10px] font-normal text-muted-foreground">(Fixed Standard)</span>
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
              <span className="text-[10px] font-normal text-muted-foreground">(Fixed Standard)</span>
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
              <span className="text-[10px] font-normal text-muted-foreground">(Form Control)</span>
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
              <span className="text-[10px] font-normal text-muted-foreground">(Form Control)</span>
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
          <span className="text-[10px] text-muted-foreground italic">Table 0 Alignment</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="course-code" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Course No. (Course Code)</span>
              <span className="text-[10px] font-normal text-muted-foreground">(Assigned Course)</span>
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
              <span className="text-[10px] font-normal text-muted-foreground">(Assigned Course)</span>
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
              <span className="text-[10px] font-normal text-muted-foreground">(College Active Setup)</span>
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
              <span className="text-[10px] font-normal text-muted-foreground">(College Active Setup)</span>
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
          <span className="text-[10px] text-muted-foreground italic">Schedule, Room &amp; Consultation per Faculty</span>
        </div>

        <div className="space-y-4">
          {effectiveFacultyMembers.map((fac, facIdx) => {
            const sections = fac.sections && fac.sections.length > 0
              ? fac.sections
              : [{ section: '', schedule: '', room: '' }];

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
                      <p className="text-[10px] text-muted-foreground">Assigned Course Instructor</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                    {sections.map(s => s.section).filter(Boolean).join(', ') || 'Assigned Section(s)'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor={`faculty-name-${facIdx}`} className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Name of Faculty Member</span>
                      <span className="text-[10px] font-normal text-muted-foreground">(Assigned Course Faculty)</span>
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

                  {/* Assigned Class Sections with multiple schedule rows */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Assigned Class Sections &amp; Class Schedules
                      </span>
                    </div>

                    <div className="space-y-2">
                      {sections.map((sec, secIdx) => (
                        <div
                          key={secIdx}
                          className="grid grid-cols-1 sm:grid-cols-[1.2fr_2fr_1.5fr_auto] gap-2 items-end p-2.5 rounded-xl border border-border/70 bg-card/60"
                        >
                          <div className="space-y-1">
                            <label htmlFor={`sec-id-${facIdx}-${secIdx}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                              <span>Section</span>
                              <span className="text-[9px] font-normal text-muted-foreground">(Assigned)</span>
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

                          <div className="space-y-1">
                            <label htmlFor={`sec-sched-${facIdx}-${secIdx}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-muted-foreground" />
                              <span>Schedule</span>
                            </label>
                            <input
                              id={`sec-sched-${facIdx}-${secIdx}`}
                              type="text"
                              value={sec.schedule ?? ''}
                              onChange={e => updateFacultySection(facIdx, secIdx, 'schedule', e.target.value)}
                              placeholder="e.g. 08:00–09:00 MF / 11:00–01:30 W"
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label htmlFor={`sec-room-${facIdx}-${secIdx}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span>Room</span>
                            </label>
                            <input
                              id={`sec-room-${facIdx}-${secIdx}`}
                              type="text"
                              value={sec.room ?? ''}
                              onChange={e => updateFacultySection(facIdx, secIdx, 'room', e.target.value)}
                              placeholder="e.g. LR114 / CLR205"
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            />
                          </div>

                          {sections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSectionRow(facIdx, secIdx)}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer mb-0.5"
                              title="Remove section row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => addSectionRow(facIdx)}
                      aria-label="+ Add section row"
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center space-x-1 pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add section row</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label htmlFor={`faculty-consultation-${facIdx}`} className="text-xs font-semibold text-foreground flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Consultation Hours</span>
                    </label>
                    <input
                      id={`faculty-consultation-${facIdx}`}
                      type="text"
                      value={fac.consultation ?? ''}
                      onChange={e => updateFacultyConsultation(facIdx, e.target.value)}
                      placeholder="e.g. MTWTHF 02:00PM - 03:00PM"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
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
