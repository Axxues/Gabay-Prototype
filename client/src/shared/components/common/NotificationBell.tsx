import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserCheck, ArrowRight, ChevronRight } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import type { EnrollmentRequest } from '../../types/lms';
import { isProfileComplete } from '../../utils/profileCompletion';
import { UserAvatar } from './UserAvatar';

interface NotificationBellProps {
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
  onNavigateTab?: (tab: string) => void;
}

const REQUEST_TYPE_LABELS: Record<EnrollmentRequest['type'], string> = {
  self_join: 'Join',
  faculty_enroll: 'Invite',
  section_switch: 'Switch'
};

const NOTIFICATION_GROUP_LABELS: Record<string, string> = {
  module_comment_reply: 'Module replies',
  announcement_reply: 'Announcement replies',
  baseline_changed: 'Academic Year & Semester',
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
    markAllNotificationsRead,
    getPendingRequestsForStudent
  } = useLMS();

  const navigate = useNavigate();
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

  const hasIncompleteProfile = Boolean(activeUser && !isProfileComplete(activeUser));
  const isStaff = activeRole === 'faculty' || activeRole === 'admin' || activeRole === 'superadmin';

  const staffPending: EnrollmentRequest[] = isStaff
    ? (db.enrollmentRequests || []).filter((r: EnrollmentRequest) => r.status === 'pending')
    : [];
  const studentPending: EnrollmentRequest[] = !isStaff ? getPendingRequestsForStudent() : [];
  const notifications = getNotifications(activeUser?.id || '');

  const actionItemsCount = (hasIncompleteProfile ? 1 : 0) + (isStaff ? staffPending.length : studentPending.length);
  const unreadNotificationCount = getUnreadNotificationCount(activeUser?.id || '');
  const unreadCount = unreadNotificationCount + actionItemsCount;

  const sectionName = (sectionId?: string): string | null => {
    if (!sectionId) return null;
    return (db.courseSections || []).find(s => s.id === sectionId)?.name ?? null;
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
        <Bell className={`h-4 w-4 ${open ? 'text-white' : 'text-primary'}`} />
        <span
          className={`absolute -top-0.5 -right-0.5 rounded-full text-xs h-4 w-4 flex items-center justify-center ${unreadCount > 0 ? '' : 'hidden'} ${open ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'}`}
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

          {hasIncompleteProfile && (
            <div className="mx-2 mb-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 animate-fade-in shadow-xs">
              <div className="flex items-start gap-2.5">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <UserCheck className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">
                      Profile Information Required
                    </span>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      Incomplete
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-sans mt-0.5 leading-relaxed">
                    Please fill up your profile information to keep your institutional records up to date.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNavigateTab?.('profile');
                  navigate('/profile');
                }}
                className="w-full py-1.5 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Fill up Profile</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {isStaff && (
            <div className="space-y-1 mb-2">
              {staffPending.length === 0 && !hasIncompleteProfile ? (
                <p className="px-3 py-3 text-xs text-muted-foreground font-sans">
                  No pending enrollment requests.
                </p>
              ) : (
                staffPending.map(req => {
                  const course = db.courses.find(c => c.id === req.courseId);
                  const targetName = req.type === 'section_switch' ? sectionName(req.targetSectionId) : null;
                  const user = (db.users || []).find(u => u.id === req.studentId);
                  const userName = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
                  const isId = req.studentName === req.studentId || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(req.studentName || '');
                  const studentDisplayName = userName || (!isId && req.studentName ? req.studentName : (user?.email || req.studentName || 'Student'));
                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onNavigateCourse?.(req.courseId, 'people?tab=pending');
                        navigate(`/courses/${req.courseId}/people?tab=pending`);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors text-left group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground truncate">
                          {course?.code ? `${course.code} — ` : ''}{studentDisplayName}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-sans">
                          {REQUEST_TYPE_LABELS[req.type]}
                          {targetName ? ` → ${targetName}` : ''}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground shrink-0 transition-colors" />
                    </button>
                  );
                })
              )}
            </div>
          )}

          {!isStaff && (
            <div className="space-y-1 mb-2">
              {studentPending.length === 0 && !hasIncompleteProfile ? (
                <p className="px-3 py-3 text-xs text-muted-foreground font-sans">
                  Nothing needs your action right now.
                </p>
              ) : (
                studentPending.map(req => {
                  const course = db.courses.find(c => c.id === req.courseId);
                  let subtitle = 'Awaiting approval';
                  if (req.type === 'section_switch') {
                    const targetName = sectionName(req.targetSectionId);
                    subtitle = `Switch pending${targetName ? ` → ${targetName}` : ''}`;
                  } else if (req.type === 'faculty_enroll') {
                    subtitle = `Invited by ${course?.instructorName ?? 'your instructor'}`;
                  }

                  const title = req.type === 'faculty_enroll'
                    ? (course?.title ?? 'Course invitation')
                    : (course?.title ?? 'Course request');

                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onNavigateTab?.('dashboard');
                        navigate('/dashboard');
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/60 transition-colors text-left group cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground truncate">
                          {title}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-sans">
                          {subtitle}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground shrink-0 transition-colors" />
                    </button>
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
          {(() => {
            const groups: Record<string, typeof notifications> = {};
            for (const n of notifications) {
              (groups[n.type] = groups[n.type] || []).push(n);
            }
            const groupTypes = Object.keys(groups);
            if (groupTypes.length === 0) {
              return (
                <p className="px-3 py-3 text-xs text-muted-foreground font-sans">
                  No notifications.
                </p>
              );
            }
            return groupTypes.map(groupType => (
              <div key={groupType}>
                <div className="flex items-center justify-between px-3 pt-1 pb-0.5">
                  <p className="text-[10px] font-sans font-bold text-muted-foreground uppercase tracking-widest">
                    {NOTIFICATION_GROUP_LABELS[groupType] ?? groupType}
                  </p>
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead(activeUser.id, groupType).catch(() => {})}
                    className="px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="space-y-1">
                  {groups[groupType].map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        void markNotificationRead(n.id).catch(() => {});
                        setOpen(false);
                      }}
                      className={`flex w-full items-start gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-accent/60 transition-colors cursor-pointer ${n.read ? 'opacity-60' : ''}`}
                    >
                      <UserAvatar
                        name={n.actorName}
                        src={n.actorAvatar}
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
                  ))}
                </div>
              </div>
            ));
          })()}

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
