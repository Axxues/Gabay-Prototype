import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import type { EnrollmentRequest } from '../../types/lms';
import { canPickSection } from '../../utils/sections';

interface NotificationBellProps {
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
  onNavigateTab?: (tab: string) => void;
}

const REQUEST_TYPE_LABELS: Record<EnrollmentRequest['type'], string> = {
  self_join: 'Join',
  faculty_enroll: 'Invite',
  section_switch: 'Switch'
};

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNavigateCourse,
  onNavigateTab
}) => {
  const {
    db,
    activeUser,
    activeRole,
    getUnreadNotificationCount,
    getNotifications,
    markNotificationRead,
    getPendingRequestsForStudent,
    approveEnrollmentRequests,
    rejectEnrollmentRequests,
    studentApproveInvitation,
    studentDeclineInvitation,
    showAlert
  } = useLMS();

  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (bellRef.current && !bellRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = getUnreadNotificationCount(activeUser.id);
  const isStaff = activeRole === 'faculty' || activeRole === 'admin';

  const staffPending: EnrollmentRequest[] = isStaff
    ? (db.enrollmentRequests || []).filter((r: EnrollmentRequest) => r.status === 'pending')
    : [];
  const studentPending: EnrollmentRequest[] = !isStaff ? getPendingRequestsForStudent() : [];
  const notifications = getNotifications(activeUser.id);

  const sectionName = (sectionId?: string): string | null => {
    if (!sectionId) return null;
    return (db.courseSections || []).find(s => s.id === sectionId)?.name ?? null;
  };

  const handleApprove = (req: EnrollmentRequest) => {
    if (req.type === 'section_switch' && req.targetSectionId) {
      const target = (db.courseSections || []).find(s => s.id === req.targetSectionId);
      if (target && !canPickSection(target)) {
        showAlert({
          title: 'Section Full',
          message: `Cannot approve — ${target.name} is full. The request is still pending.`,
          type: 'warning'
        });
        return;
      }
    }
    approveEnrollmentRequests([req.id]);
    setOpen(false);
  };

  const handleReject = (req: EnrollmentRequest) => {
    rejectEnrollmentRequests([req.id]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setOpen(!open)}
        title="Notifications"
        className={`relative hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-subtle ${open
            ? 'bg-primary text-primary-foreground border-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent border-border bg-background'
          }`}
      >
        <Bell className="h-4 w-4 text-primary" />
        <span
          className={`absolute -top-0.5 -right-0.5 rounded-full bg-primary text-xs text-primary-foreground h-4 w-4 flex items-center justify-center ${unreadCount > 0 ? '' : 'hidden'}`}
        >
          {unreadCount}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] dropdown-panel p-2.5 z-50 animate-dropdown max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Actionable group */}
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] font-sans font-bold text-muted-foreground uppercase tracking-widest">
              Needs your action
            </p>
          </div>

          {isStaff && (
            <div className="space-y-1 mb-2">
              {staffPending.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground font-sans">
                  No pending enrollment requests.
                </p>
              ) : (
                staffPending.map(req => {
                  const course = db.courses.find(c => c.id === req.courseId);
                  const targetName = req.type === 'section_switch' ? sectionName(req.targetSectionId) : null;
                  return (
                    <div key={req.id} className="px-3 py-2 rounded-xl hover:bg-accent/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">
                            {course?.code ? `${course.code} — ` : ''}{req.studentName}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-sans">
                            {REQUEST_TYPE_LABELS[req.type]}
                            {targetName ? ` → ${targetName}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleApprove(req)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(req)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {!isStaff && (
            <div className="space-y-1 mb-2">
              {studentPending.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground font-sans">
                  Nothing needs your action right now.
                </p>
              ) : (
                studentPending.map(req => {
                  const course = db.courses.find(c => c.id === req.courseId);
                  if (req.type === 'section_switch') {
                    const targetName = sectionName(req.targetSectionId);
                    return (
                      <div key={req.id} className="px-3 py-2 rounded-xl hover:bg-accent/60 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">
                              {course?.code ? `${course.code} — ` : ''}{course?.title ?? 'Course request'}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-sans">
                              Switch pending{targetName ? ` → ${targetName}` : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              studentDeclineInvitation(req.id);
                              setOpen(false);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            Withdraw
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (req.type === 'faculty_enroll') {
                    return (
                      <div key={req.id} className="px-3 py-2 rounded-xl hover:bg-accent/60 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-foreground truncate">
                              {course?.code ? `${course.code} — ` : ''}{course?.title ?? 'Course invitation'}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-sans">
                              Invited by {course?.instructorName ?? 'your instructor'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                studentApproveInvitation(req.id);
                                setOpen(false);
                                onNavigateCourse?.(req.courseId, 'section-selection');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                studentDeclineInvitation(req.id);
                                setOpen(false);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={req.id} className="px-3 py-2 rounded-xl hover:bg-accent/60 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">
                            {course?.code ? `${course.code} — ` : ''}{course?.title ?? 'Course request'}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-sans">
                            Request sent — awaiting instructor approval
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            studentDeclineInvitation(req.id);
                            setOpen(false);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          Withdraw
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="border-t border-border/60 my-1" />

          {/* Notifications group */}
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] font-sans font-bold text-muted-foreground uppercase tracking-widest">
              Notifications
            </p>
          </div>
          <div className="space-y-1">
            {notifications.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground font-sans">
                No notifications.
              </p>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    markNotificationRead(n.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-accent/60 transition-colors cursor-pointer ${n.read ? 'opacity-60' : ''}`}
                >
                  <img
                    src={n.actorAvatar}
                    alt={n.actorName}
                    className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs text-foreground">
                      <span className="font-bold">{n.actorName}</span>
                      <span className="font-sans"> {n.content}</span>
                    </span>
                    <span className="block text-[10px] text-muted-foreground font-sans truncate">
                      {n.relatedTitle} • {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  {!n.read && (
                    <span className="ml-auto mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              onNavigateTab?.('inbox');
            }}
            className="w-full mt-1 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors cursor-pointer"
          >
            View all in Inbox
          </button>
        </div>
      )}
    </div>
  );
};
