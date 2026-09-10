import React from 'react';
import { LayoutDashboard, BookOpen, Calendar, Inbox, History, HelpCircle, Layers, FileText, Megaphone, FileCheck2, HelpCircle as QuizIcon, Folder, Award, Users, ArrowLeft, Copy, Check } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { LMS_CHILDREN, COURSE_CHILDREN, isVisible } from '../../config/navigation';
const LMS_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-4 w-4" />, courses: <BookOpen className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />, inbox: <Inbox className="h-4 w-4" />,
  history: <History className="h-4 w-4" />, help: <HelpCircle className="h-4 w-4" />,
};
const COURSE_ICONS: Record<string, React.ReactNode> = {
  modules: <Layers className="h-4 w-4" />, syllabus: <FileText className="h-4 w-4" />,
  announcements: <Megaphone className="h-4 w-4" />, assignments: <FileCheck2 className="h-4 w-4" />,
  quizzes: <QuizIcon className="h-4 w-4" />, files: <Folder className="h-4 w-4" />,
  grades: <Award className="h-4 w-4" />, people: <Users className="h-4 w-4" />,
};
export const LMSContextPanel: React.FC<{ currentTab: string; courseSubTab: string; onNavigateTab: (t: string) => void; onSelectCourseTab: (t: string) => void; onNavigateCourse: (id: string, sub?: string) => void }> = (p) => {
  const { db, activeCourseId, activeRole, activeUser } = useLMS();
  const [copied, setCopied] = React.useState(false);
  const unread = db.messages.filter(m => m.recipientId === activeUser.id && !m.read).length;
  if (p.currentTab === 'courses') {
    const course = db.courses.find(c => c.id === activeCourseId) ?? db.courses[0];
    return (
      <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3">
        <button type="button" onClick={() => p.onNavigateTab('dashboard')} className="mb-2 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" /> All courses</button>
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
          <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: course?.color ?? '#64748b' }} />
          <div className="min-w-0"><div className="truncate text-xs font-extrabold">{course?.code}</div><div className="truncate text-[11px] text-muted-foreground">{course?.title}</div></div>
        </div>
        {course?.joinCode && <button type="button" onClick={() => { try { navigator.clipboard.writeText(course.joinCode ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} className="mb-2 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 font-mono text-[11px] font-bold cursor-pointer">{course.joinCode}{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}</button>}
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Course Navigation</div>
        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
          {COURSE_CHILDREN.filter(i => isVisible(i, activeRole)).map(item => (
            <button key={item.id} type="button" onClick={() => p.onSelectCourseTab(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer ${p.courseSubTab === item.id ? 'bg-primary text-primary-foreground shadow-primary-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'}`}>{COURSE_ICONS[item.id]}<span>{item.label}</span></button>
          ))}
        </nav>
      </aside>
    );
  }
  return (
    <aside className="flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3">
      <div className="mb-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Learning Management</div>
      <nav className="space-y-1">
        {LMS_CHILDREN.filter(i => isVisible(i, activeRole)).map(item => (
          <button key={item.id} type="button" onClick={() => p.onNavigateTab(item.id)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer ${p.currentTab === item.id ? 'bg-primary text-primary-foreground shadow-primary-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground font-medium'}`}>
            <span className="flex items-center gap-2.5">{LMS_ICONS[item.id]}<span>{item.label}</span></span>
            {item.id === 'inbox' && unread > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{unread}</span>}
          </button>
        ))}
      </nav>
      <div className="mt-auto px-2 pt-3 text-[10px] text-muted-foreground">Trail: LMS &gt; {p.currentTab}</div>
    </aside>
  );
};
