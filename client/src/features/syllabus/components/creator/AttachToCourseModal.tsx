import React, { useState } from 'react';
import { useLMS } from '../../../../shared/context/LMSContext';
import type { OfficialSyllabusData } from '../../../../shared/data/syllabusData';
import type { Course } from '../../../../shared/types/lms';
import { X, Check, BookOpen, Loader2 } from 'lucide-react';

interface AttachToCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  syllabusData: OfficialSyllabusData;
}

export const AttachToCourseModal: React.FC<AttachToCourseModalProps> = ({
  isOpen,
  onClose,
  syllabusData
}) => {
  const lms = useLMS();
  const { db, activeUser, updateCourseSyllabus, publishSyllabusDraft, showAlert } = lms;
  const courses: Course[] = (db?.courses as Course[]) || ((lms as any).courses as Course[]) || [];
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Filter courses taught by or accessible to current faculty
  const eligibleCourses = courses.filter((c: Course) => {
    if (!activeUser) return true;
    if (activeUser.role === 'admin' || activeUser.role === 'superadmin') return true;
    return c.instructorId === activeUser.id || c.instructorName?.toLowerCase() === activeUser.name?.toLowerCase();
  });

  const toggleCourse = (id: string) => {
    setSelectedCourseIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleAttach = async () => {
    if (selectedCourseIds.length === 0) return;
    setIsSubmitting(true);

    try {
      for (const courseId of selectedCourseIds) {
        const targetCourse = courses.find((c: Course) => c.id === courseId);

        // Preserve destination course schedule and section (Review Focus 2)
        const preservedSyllabus: OfficialSyllabusData = {
          ...syllabusData,
          courseId,
          courseInfo: {
            ...syllabusData.courseInfo,
            code: targetCourse?.code || syllabusData.courseInfo.code,
            title: targetCourse?.title || syllabusData.courseInfo.title
          },
          facultyMembers: (syllabusData.facultyMembers && syllabusData.facultyMembers.length > 0)
            ? syllabusData.facultyMembers.map((fm, idx) => {
                if (idx === 0) {
                  return {
                    ...fm,
                    sections: [
                      {
                        section: targetCourse?.section || fm.sections?.[0]?.section || 'BSCS',
                        schedule: targetCourse?.schedule || fm.sections?.[0]?.schedule || 'TBA',
                        room: (targetCourse as any)?.room || fm.sections?.[0]?.room || 'TBA'
                      }
                    ]
                  };
                }
                return fm;
              })
            : [
                {
                  name: activeUser?.name || 'Faculty Member',
                  sections: [
                    {
                      section: targetCourse?.section || 'BSCS',
                      schedule: targetCourse?.schedule || 'TBA',
                      room: (targetCourse as any)?.room || 'TBA'
                    }
                  ],
                  consultation: 'MWF 01:00 PM - 03:00 PM'
                }
              ]
        };

        await updateCourseSyllabus(courseId, preservedSyllabus);

        if (publishImmediately && publishSyllabusDraft) {
          try {
            await publishSyllabusDraft(courseId);
          } catch (pubErr) {
            console.warn(`[AttachToCourseModal] Auto-publish draft for ${courseId} skipped or queued:`, pubErr);
          }
        }
      }

      showAlert?.(
        `Successfully attached syllabus to ${selectedCourseIds.length} course${selectedCourseIds.length > 1 ? 's' : ''}!`,
        'Syllabus Attached'
      );
      onClose();
    } catch (err: any) {
      console.error('[AttachToCourseModal] Error attaching syllabus:', err);
      showAlert?.(err?.message || 'Failed to attach syllabus to selected courses.', 'Error Attaching Syllabus');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/80 bg-muted/30">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Attach to LMS Course</h3>
              <p className="text-[11px] text-muted-foreground">
                Push "{syllabusData.courseInfo.code} – {syllabusData.courseInfo.title}" to assigned class sections.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Course Selection List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Select Destination Courses ({eligibleCourses.length} available)
          </div>

          {eligibleCourses.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-border bg-muted/20 text-muted-foreground text-xs">
              No assigned teaching courses found for your account. You can export or print the syllabus as PDF instead.
            </div>
          ) : (
            <div className="space-y-2">
              {eligibleCourses.map((c: Course) => {
                const isSelected = selectedCourseIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-background hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCourse(c.id)}
                        className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                        aria-label={`${c.code} ${c.title}`}
                      />
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {c.code} – {c.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Section: <span className="font-medium text-foreground">{c.section || 'Default'}</span>
                          {c.schedule && ` • ${c.schedule}`}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Publication Options */}
          <div className="pt-3 border-t border-border/70 space-y-2">
            <label className="flex items-center space-x-2.5 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={e => setPublishImmediately(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary w-4 h-4"
              />
              <span className="font-semibold">Publish immediately to students</span>
            </label>
            <p className="text-[11px] text-muted-foreground pl-6">
              If unchecked, saves as an in-course draft so you can perform final section verification inside the LMS course tab before releasing.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/80 bg-muted/20 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedCourseIds.length === 0 || isSubmitting}
            onClick={handleAttach}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Attaching...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Attach & Save ({selectedCourseIds.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
