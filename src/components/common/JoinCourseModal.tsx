import React, { useState, useMemo } from 'react';
import { useLMS } from '../../context/LMSContext';
import { ModalPortal } from './ModalPortal';
import {
  KeyRound,
  X,
  AlertCircle,
  BookOpen,
  ArrowRight
} from 'lucide-react';

interface JoinCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
}

export const JoinCourseModal: React.FC<JoinCourseModalProps> = ({
  isOpen,
  onClose,
  onNavigateCourse
}) => {
  const { db, activeUser, joinCourseByCode, showAlert } = useLMS();
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live match detection
  const matchedCourse = useMemo(() => {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    return db.courses.find(c => c.joinCode?.toUpperCase() === clean) || null;
  }, [code, db.courses]);

  const isAlreadyEnrolled = useMemo(() => {
    if (!matchedCourse) return false;
    return (activeUser.enrolledCourseIds || []).includes(matchedCourse.id);
  }, [matchedCourse, activeUser.enrolledCourseIds]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMessage('Please type in a course join code.');
      return;
    }

    const res = joinCourseByCode(cleanCode);
    if (!res.success) {
      setErrorMessage(res.message);
      return;
    }

    onClose();
    showAlert({
      title: 'Enrolled in Course',
      message: res.message,
      type: 'success'
    });

    if (res.course && onNavigateCourse) {
      onNavigateCourse(res.course.id, 'modules');
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in select-none">
        <div className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 animate-scale-in">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground font-sans">
                  Join a Course
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Enter the unique join code provided by your instructor.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Course Join Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={code}
                  onChange={e => {
                    setCode(e.target.value.toUpperCase());
                    setErrorMessage(null);
                  }}
                  placeholder="e.g. CMSC-170C or GBY-8K21"
                  className="w-full p-3 bg-background border border-border rounded-xl text-foreground font-mono font-bold text-sm tracking-wider uppercase placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 text-center"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 font-sans">
                Join codes are typically 6-9 characters with a dash (e.g. <span className="font-mono font-semibold text-foreground">CMSC-170C</span>).
              </p>
            </div>

            {/* Real-time Match Preview */}
            {matchedCourse && (
              <div className={`p-3 rounded-xl border transition-all text-xs font-sans ${
                isAlreadyEnrolled
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-primary/5 border-primary/20 text-foreground'
              }`}>
                <div className="flex items-center space-x-2 pb-1.5 border-b border-border/40">
                  <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-bold text-foreground truncate">
                    {matchedCourse.code} • {matchedCourse.section}
                  </span>
                </div>
                <div className="mt-1 font-semibold truncate text-foreground">
                  {matchedCourse.title}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-between">
                  <span>Instructor: {matchedCourse.instructorName}</span>
                  {isAlreadyEnrolled ? (
                    <span className="font-bold text-amber-600 dark:text-amber-400">Already Joined</span>
                  ) : (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Ready to Enroll</span>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center space-x-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!code.trim() || isAlreadyEnrolled}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 ${
                  !code.trim() || isAlreadyEnrolled
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary-sm cursor-pointer'
                }`}
              >
                <span>Join Course</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
