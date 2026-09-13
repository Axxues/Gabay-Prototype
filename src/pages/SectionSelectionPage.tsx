import React from 'react';
import { useLMS } from '../context/LMSContext';
import type { CourseSection } from '../types/lms';
import { BookOpen, MapPin, Clock, Users, Check, ArrowLeft } from 'lucide-react';

interface SectionSelectionPageProps {
  courseId: string;
  onSectionSelected: () => void;
}

export const SectionSelectionPage: React.FC<SectionSelectionPageProps> = ({
  courseId,
  onSectionSelected
}) => {
  const { db, activeUser, selectSection, showAlert } = useLMS();
  const course = db.courses.find(c => c.id === courseId);
  const sections: CourseSection[] = (db.courseSections || []).filter((s: CourseSection) => s.courseId === courseId);

  const currentSectionId = activeUser.courseSections?.[courseId];

  const handleSelectSection = (sectionId: string) => {
    const section = (db.courseSections || []).find((s: CourseSection) => s.id === sectionId);
    if (!section) return;

    if (section.capacity !== undefined && section.enrolledCount >= section.capacity) {
      showAlert({ title: 'Section Full', message: 'This section has reached its maximum capacity.', type: 'warning' });
      return;
    }

    selectSection(courseId, sectionId);
    showAlert({ title: 'Section Selected', message: `You have been assigned to ${section.name}.`, type: 'success' });
    onSectionSelected();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onSectionSelected} className="p-2 hover:bg-muted rounded-xl cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-extrabold">Select Your Section</h1>
          <p className="text-sm text-muted-foreground">
            {course?.code} — {course?.title}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {sections.map(section => {
          const isFull = section.capacity !== undefined && section.enrolledCount >= section.capacity;
          const isSelected = currentSectionId === section.id;
          const slotsLeft = section.capacity !== undefined ? section.capacity - section.enrolledCount : 0;

          return (
            <button
              key={section.id}
              onClick={() => !isFull && !isSelected && handleSelectSection(section.id)}
              disabled={isFull || isSelected}
              className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : isFull
                  ? 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="font-extrabold">{section.name}</span>
                </div>
                {isSelected && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                    <Check className="w-4 h-4" /> Selected
                  </span>
                )}
                {isFull && !isSelected && (
                  <span className="text-xs font-bold text-red-500">Full</span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {section.schedule && (
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {section.schedule}</span>
                )}
                {section.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {section.location}</span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {section.enrolledCount}/{section.capacity} enrolled
                  {!isFull && section.capacity !== undefined && <span className="text-emerald-600">({slotsLeft} slots left)</span>}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
