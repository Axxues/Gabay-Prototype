import React, { useState } from 'react';
import { useLMS } from '../../../shared/context/LMSContext';
import { ModalPortal } from '../../../shared/components/common/ModalPortal';
import { DialogFrame } from '../../../shared/components/common/DialogFrame';
import { BookOpen, Check, X, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';

export interface CourseInvitationAcceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  requestId?: string;
  targetStudentId?: string;
  onNavigateCourse: (courseId: string, subView?: string) => void;
  onSwitchAccount?: () => void;
}

export const CourseInvitationAcceptModal: React.FC<CourseInvitationAcceptModalProps> = ({
  isOpen,
  onClose,
  courseId,
  requestId,
  targetStudentId,
  onNavigateCourse,
  onSwitchAccount,
}) => {
  const { db, activeUser, studentApproveInvitation, studentDeclineInvitation } = useLMS();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  if (!isOpen) return null;

  const course = (db.courses || []).find(c => c.id === courseId);
  const matchedRequest = (db.enrollmentRequests || []).find(
    r =>
      (requestId && r.id === requestId) ||
      (r.courseId === courseId && r.studentId === activeUser.id && r.type === 'faculty_enroll')
  );

  const effectiveRequestId = requestId || matchedRequest?.id;

  // 1. Account Mismatch State
  const isAccountMismatch = Boolean(targetStudentId && activeUser?.id && targetStudentId !== activeUser.id);
  if (isAccountMismatch) {
    return (
      <ModalPortal>
        <DialogFrame
          title="Account Mismatch"
          subtitle="This invitation was addressed to a different account."
          onClose={onClose}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">Signed in as {activeUser.name} ({activeUser.email})</p>
                <p>This course invitation was issued for another student account. Please sign in with the designated student account to accept.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Dismiss
              </button>
              {onSwitchAccount && (
                <button
                  type="button"
                  onClick={onSwitchAccount}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Switch Account
                </button>
              )}
            </div>
          </div>
        </DialogFrame>
      </ModalPortal>
    );
  }

  // 2. Already Enrolled State
  const isAlreadyEnrolled = Boolean(activeUser?.enrolledCourseIds?.includes(courseId));
  if (isAlreadyEnrolled) {
    return (
      <ModalPortal>
        <DialogFrame
          title="Already Enrolled"
          subtitle="You already have active access to this course."
          onClose={onClose}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-start gap-3">
              <Check className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">Active Enrollment</p>
                <p>You are already enrolled in <strong>{course?.code || 'this course'}</strong>.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateCourse(courseId);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Enter Course</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </DialogFrame>
      </ModalPortal>
    );
  }

  // 3. Stale / Resolved Invitation State
  if (matchedRequest && matchedRequest.status !== 'pending') {
    return (
      <ModalPortal>
        <DialogFrame
          title="Invitation Not Available"
          subtitle="This invitation is no longer active."
          onClose={onClose}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-muted border border-border text-muted-foreground text-xs">
              This course invitation is no longer active or has already been processed.
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </DialogFrame>
      </ModalPortal>
    );
  }

  // 4. Active Pending Invitation Acceptance State
  const handleAccept = async () => {
    if (!effectiveRequestId || isAccepting || isDeclining) return;
    setIsAccepting(true);
    try {
      const ok = await studentApproveInvitation(effectiveRequestId);
      if (ok) {
        onClose();
        onNavigateCourse(courseId, 'section-selection');
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!effectiveRequestId || isAccepting || isDeclining) return;
    setIsDeclining(true);
    try {
      const ok = await studentDeclineInvitation(effectiveRequestId);
      if (ok) {
        onClose();
      }
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <ModalPortal>
      <DialogFrame
        title="Class Invitation"
        subtitle="You have been invited by your instructor to join this course."
        onClose={onClose}
      >
        <div className="space-y-5">
          {/* Course Details Card */}
          <div className="p-4 rounded-2xl bg-muted/60 border border-border space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground leading-tight">
                  {course?.code || 'Course Code'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {course?.title || 'Course Title'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
              {course?.section && (
                <span className="px-2 py-0.5 rounded-md bg-background border border-border font-medium">
                  Section {course.section}
                </span>
              )}
              {course?.instructorName && (
                <span className="px-2 py-0.5 rounded-md bg-background border border-border">
                  Instructor: <strong>{course.instructorName}</strong>
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            By accepting, you will be enrolled in the course and will have access to learning materials, activities, and grade tracking.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isAccepting || isDeclining}
              onClick={handleDecline}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeclining ? 'Declining...' : 'Decline'}
            </button>
            <button
              type="button"
              disabled={isAccepting || isDeclining}
              onClick={handleAccept}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer shadow-primary-sm disabled:opacity-50"
            >
              {isAccepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isAccepting ? 'Enrolling...' : 'Accept & Enter Course'}</span>
            </button>
          </div>
        </div>
      </DialogFrame>
    </ModalPortal>
  );
};
