import React from 'react';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';
import { BookOpen, User, Calendar, MapPin, Clock } from 'lucide-react';

interface Step1CourseInfoProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step1CourseInfo: React.FC<Step1CourseInfoProps> = ({ data, onChange }) => {
  const { courseInfo, facultyMembers = [] } = data;
  const faculty = facultyMembers[0] || { name: '', sections: [{ section: '', schedule: '', room: '' }], consultation: '' };
  const section = faculty.sections[0] || { section: '', schedule: '', room: '' };

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
          Specify core academic identification, unit allocations, lecture/lab contact hours, prerequisites, and faculty assignments.
        </p>
      </div>

      {/* Course Core Details */}
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
          <select
            id="course-semester"
            value={courseInfo.semester}
            onChange={e => updateCourseInfo('semester', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          >
            <option value="First Semester">First Semester</option>
            <option value="Second Semester">Second Semester</option>
            <option value="Midyear">Midyear</option>
          </select>
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
          <select
            id="course-type"
            value={courseInfo.type}
            onChange={e => updateCourseInfo('type', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          >
            <option value="Lecture">Lecture</option>
            <option value="Lecture and Laboratory">Lecture and Laboratory</option>
            <option value="Laboratory">Laboratory</option>
          </select>
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

      <div className="space-y-1.5">
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

      {/* Faculty Assignment & Section */}
      <div className="pt-4 border-t border-border/70 space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
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
