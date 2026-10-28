import React from 'react';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';
import { CustomDropdown } from '../../../../../shared/components/common/CustomDropdown';
import { BookOpen, User, Calendar, MapPin, Clock, Landmark, Tag } from 'lucide-react';

const SEMESTER_OPTIONS = [
  { value: 'First Semester', label: 'First Semester' },
  { value: 'Second Semester', label: 'Second Semester' },
  { value: 'Midyear', label: 'Midyear' },
];

const COURSE_TYPE_OPTIONS = [
  { value: 'Lecture', label: 'Lecture' },
  { value: 'Lecture and Laboratory', label: 'Lecture and Laboratory' },
  { value: 'Laboratory', label: 'Laboratory' },
];

interface Step1CourseInfoProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step1CourseInfo: React.FC<Step1CourseInfoProps> = ({ data, onChange }) => {
  const {
    institution = {
      university: 'Don Mariano Marcos Memorial State University',
      college: 'College of Computer Science',
      formCode: 'DMMMSU-INS-F003',
      revision: 'REV. 02 (06.23.2025)'
    },
    courseInfo,
    facultyMembers = []
  } = data;

  const faculty = facultyMembers[0] || { name: '', sections: [{ section: '', schedule: '', room: '' }], consultation: '' };
  const section = faculty.sections[0] || { section: '', schedule: '', room: '' };

  const updateInstitution = (field: keyof typeof institution, value: string) => {
    onChange({
      ...data,
      institution: {
        ...institution,
        [field]: value
      }
    });
  };

  const updateCourseInfo = (field: keyof typeof courseInfo, value: string) => {
    onChange({
      ...data,
      courseInfo: {
        ...courseInfo,
        [field]: value
      }
    });
  };

  const updateFaculty = (field: 'name' | 'consultation', value: string) => {
    const updatedFaculty = { ...faculty, [field]: value };
    onChange({
      ...data,
      facultyMembers: [updatedFaculty, ...facultyMembers.slice(1)]
    });
  };

  const updateSection = (field: 'section' | 'schedule' | 'room', value: string) => {
    const updatedSection = { ...section, [field]: value };
    const updatedFaculty = { ...faculty, sections: [updatedSection] };
    onChange({
      ...data,
      facultyMembers: [updatedFaculty, ...facultyMembers.slice(1)]
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <span>Course Identification & Schedule</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Specify institutional header information, core course catalog details, unit credits, prerequisites, and faculty assignments.
        </p>
      </div>

      {/* Institutional Header & Document Control */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
          <Landmark className="w-4 h-4 text-primary" />
          <span>Institutional & Document Control Header</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="inst-university" className="text-xs font-semibold text-foreground">
              University Name
            </label>
            <input
              id="inst-university"
              type="text"
              value={institution.university}
              onChange={e => updateInstitution('university', e.target.value)}
              placeholder="e.g. Don Mariano Marcos Memorial State University"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="inst-college" className="text-xs font-semibold text-foreground">
              College / Campus / Academic Unit
            </label>
            <input
              id="inst-college"
              type="text"
              value={institution.college}
              onChange={e => updateInstitution('college', e.target.value)}
              placeholder="e.g. College of Computer Science"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="inst-formcode" className="text-xs font-semibold text-foreground">
              Document Form Code
            </label>
            <input
              id="inst-formcode"
              type="text"
              value={institution.formCode}
              onChange={e => updateInstitution('formCode', e.target.value)}
              placeholder="e.g. DMMMSU-INS-F003"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="inst-revision" className="text-xs font-semibold text-foreground">
              Document Revision / Effective Date
            </label>
            <input
              id="inst-revision"
              type="text"
              value={institution.revision}
              onChange={e => updateInstitution('revision', e.target.value)}
              placeholder="e.g. REV. 02 (06.23.2025)"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Course Core Details */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
          <Tag className="w-4 h-4 text-primary" />
          <span>Course Catalog & Unit Allocations</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="course-code" className="text-xs font-semibold text-foreground">
              Course Code
            </label>
            <input
              id="course-code"
              type="text"
              value={courseInfo.code}
              onChange={e => updateCourseInfo('code', e.target.value)}
              placeholder="e.g. CSPC 112 or CS 101"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-title" className="text-xs font-semibold text-foreground">
              Descriptive Title
            </label>
            <input
              id="course-title"
              type="text"
              value={courseInfo.title}
              onChange={e => updateCourseInfo('title', e.target.value)}
              placeholder="e.g. Software Engineering 2"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-semester" className="text-xs font-semibold text-foreground">
              Academic Semester
            </label>
            <CustomDropdown
              id="course-semester"
              value={courseInfo.semester}
              onChange={val => updateCourseInfo('semester', val)}
              options={SEMESTER_OPTIONS}
              placeholder="Select Semester"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-ay" className="text-xs font-semibold text-foreground">
              Academic Year
            </label>
            <input
              id="course-ay"
              type="text"
              value={courseInfo.academicYear}
              onChange={e => updateCourseInfo('academicYear', e.target.value)}
              placeholder="e.g. 2026-2027"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-credit" className="text-xs font-semibold text-foreground">
              Course Credit (Units)
            </label>
            <input
              id="course-credit"
              type="text"
              value={courseInfo.credit}
              onChange={e => updateCourseInfo('credit', e.target.value)}
              placeholder="e.g. 3 units"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-type" className="text-xs font-semibold text-foreground">
              Course Type
            </label>
            <CustomDropdown
              id="course-type"
              value={courseInfo.type}
              onChange={val => updateCourseInfo('type', val)}
              options={COURSE_TYPE_OPTIONS}
              placeholder="Select Course Type"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lecture-hours" className="text-xs font-semibold text-foreground">
              Lecture Hours / Week
            </label>
            <input
              id="lecture-hours"
              type="text"
              value={courseInfo.lectureHours}
              onChange={e => updateCourseInfo('lectureHours', e.target.value)}
              placeholder="e.g. 2 hours/week"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lab-hours" className="text-xs font-semibold text-foreground">
              Laboratory Hours / Week
            </label>
            <input
              id="lab-hours"
              type="text"
              value={courseInfo.labHours}
              onChange={e => updateCourseInfo('labHours', e.target.value)}
              placeholder="e.g. 3 hours/week (or leave empty)"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <label htmlFor="course-prereq" className="text-xs font-semibold text-foreground">
            Course Prerequisite(s)
          </label>
          <input
            id="course-prereq"
            type="text"
            value={courseInfo.prerequisite}
            onChange={e => updateCourseInfo('prerequisite', e.target.value)}
            placeholder="e.g. CSPC 111 or None"
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="course-description" className="text-xs font-semibold text-foreground">
            Course Description
          </label>
          <textarea
            id="course-description"
            rows={3}
            value={courseInfo.description}
            onChange={e => updateCourseInfo('description', e.target.value)}
            placeholder="Enter the official course description as approved in the curriculum..."
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all leading-relaxed"
          />
        </div>
      </div>

      {/* Faculty Assignment & Section */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
          <User className="w-4 h-4 text-primary" />
          <span>Faculty & Schedule Assignment</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="faculty-name" className="text-xs font-semibold text-foreground">
              Faculty Member Name
            </label>
            <input
              id="faculty-name"
              type="text"
              value={faculty.name}
              onChange={e => updateFaculty('name', e.target.value)}
              placeholder="e.g. FLORIBETH P. CUISON"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="faculty-consultation" className="text-xs font-semibold text-foreground flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Consultation Hours</span>
            </label>
            <input
              id="faculty-consultation"
              type="text"
              value={faculty.consultation}
              onChange={e => updateFaculty('consultation', e.target.value)}
              placeholder="e.g. MWF 01:00 PM - 03:00 PM"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="section-identifier" className="text-xs font-semibold text-foreground flex items-center space-x-1">
              <span>Class Section / Group</span>
            </label>
            <input
              id="section-identifier"
              type="text"
              value={section.section}
              onChange={e => updateSection('section', e.target.value)}
              placeholder="e.g. BSCS 3A"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="section-schedule" className="text-xs font-semibold text-foreground flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Class Schedule</span>
            </label>
            <input
              id="section-schedule"
              type="text"
              value={section.schedule}
              onChange={e => updateSection('schedule', e.target.value)}
              placeholder="e.g. MF 01:30 PM - 03:00 PM"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="section-room" className="text-xs font-semibold text-foreground flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Room Assignment</span>
            </label>
            <input
              id="section-room"
              type="text"
              value={section.room}
              onChange={e => updateSection('room', e.target.value)}
              placeholder="e.g. LR 203 or Lab 3"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
