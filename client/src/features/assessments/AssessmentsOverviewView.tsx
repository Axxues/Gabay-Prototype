import React, { useMemo, useState } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { TermId } from '../../shared/types/lms';
import { normalizeTermId } from '../../shared/utils/gradingTerms';
import { TERM_LABELS, TermFilterSelect } from '../../shared/components/common/TermSelect';
import { canManageCourseContent } from '../../shared/utils/roles';
import { EmptyState } from '../../shared/components/common/EmptyState';
import {
  ClipboardList,
  FileCheck2,
  HelpCircle as QuizIcon,
  FileText,
  Briefcase,
  Presentation,
  Search,
  Calendar,
  Award,
  Clock,
  ChevronRight,
  Plus,
  CheckCircle2,
} from 'lucide-react';

interface AssessmentsOverviewViewProps {
  courseId: string;
  onNavigateCategory: (category: string, itemId?: string) => void;
}

type CategoryFilter = 'all' | 'activities' | 'quizzes' | 'assignments' | 'projects' | 'presentations' | 'exams';

interface UnifiedAssessmentItem {
  id: string;
  category: 'activity' | 'quiz' | 'assignment' | 'project' | 'presentation' | 'exam';
  categoryLabel: string;
  title: string;
  term: TermId;
  points: number;
  dueDate?: string;
  published: boolean;
  format?: string;
  targetSubTab: string;
}

const CATEGORY_TABS: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { id: 'activities', label: 'Activities', icon: <FileCheck2 className="h-3.5 w-3.5" /> },
  { id: 'quizzes', label: 'Quizzes', icon: <QuizIcon className="h-3.5 w-3.5" /> },
  { id: 'assignments', label: 'Assignments', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'projects', label: 'Projects', icon: <Briefcase className="h-3.5 w-3.5" /> },
  { id: 'presentations', label: 'Presentations', icon: <Presentation className="h-3.5 w-3.5" /> },
  { id: 'exams', label: 'Exams', icon: <QuizIcon className="h-3.5 w-3.5" /> },
];

export const AssessmentsOverviewView: React.FC<AssessmentsOverviewViewProps> = ({
  courseId,
  onNavigateCategory,
}) => {
  const { db, activeRole, activeUser, effectiveTermsForCourse } = useLMS();
  const course = (db.courses || []).find(c => c.id === courseId);
  const isAssignedInstructor = canManageCourseContent(course, activeUser);

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedTerm, setSelectedTerm] = useState<TermId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

  const effectiveTerms: TermId[] =
    typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  // Normalize all assessment kinds into unified rows
  const allItems: UnifiedAssessmentItem[] = useMemo(() => {
    const list: UnifiedAssessmentItem[] = [];

    // Activities & New task types (from db.activities)
    (db.activities || [])
      .filter(a => a.courseId === courseId)
      .forEach(a => {
        const type = a.assessmentType || 'activity';
        const labelMap: Record<string, string> = {
          activity: 'Activity',
          assignment: 'Assignment',
          project: 'Project',
          presentation: 'Presentation',
        };
        const subTabMap: Record<string, string> = {
          activity: 'activities',
          assignment: 'assignments',
          project: 'projects',
          presentation: 'presentations',
        };

        list.push({
          id: a.id,
          category: type as any,
          categoryLabel: labelMap[type] || 'Activity',
          title: a.title,
          term: normalizeTermId(a.term) || 'midterm',
          points: a.pointsPossible || 0,
          dueDate: a.dueDate,
          published: a.published,
          format: a.format,
          targetSubTab: subTabMap[type] || 'activities',
        });
      });

    // Quizzes
    (db.quizzes || [])
      .filter(q => q.courseId === courseId)
      .forEach(q => {
        const points = (q.questions || []).reduce((sum, item) => sum + (item.points || 0), 0);
        list.push({
          id: q.id,
          category: 'quiz',
          categoryLabel: 'Quiz',
          title: q.title,
          term: normalizeTermId(q.term) || 'midterm',
          points,
          dueDate: q.dueDate,
          published: q.published,
          targetSubTab: 'quizzes',
        });
      });

    // Exams
    (db.exams || [])
      .filter(e => e.courseId === courseId)
      .forEach(e => {
        const points = (e.questions || []).reduce((sum, item) => sum + (item.points || 0), 0);
        list.push({
          id: e.id,
          category: 'exam',
          categoryLabel: 'Exam',
          title: e.title,
          term: normalizeTermId(e.term) || 'finals',
          points,
          dueDate: e.dueDate,
          published: e.published,
          targetSubTab: 'exams',
        });
      });

    return list;
  }, [db.activities, db.quizzes, db.exams, courseId]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // Role visibility: students only see published assessments
      if (activeRole === 'student' && !item.published) return false;

      // Category filter
      if (categoryFilter !== 'all') {
        const matchesCategory =
          (categoryFilter === 'activities' && item.category === 'activity') ||
          (categoryFilter === 'quizzes' && item.category === 'quiz') ||
          (categoryFilter === 'assignments' && item.category === 'assignment') ||
          (categoryFilter === 'projects' && item.category === 'project') ||
          (categoryFilter === 'presentations' && item.category === 'presentation') ||
          (categoryFilter === 'exams' && item.category === 'exam');
        if (!matchesCategory) return false;
      }

      // Term filter
      if (selectedTerm !== 'all' && item.term !== selectedTerm) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.title.toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [allItems, categoryFilter, selectedTerm, searchQuery, activeRole]);

  // Metrics computation
  const metrics = useMemo(() => {
    const visible = allItems.filter(i => activeRole !== 'student' || i.published);
    const totalCount = visible.length;
    const totalPoints = visible.reduce((sum, i) => sum + i.points, 0);

    // Due in next 7 days
    const now = new Date().getTime();
    const next7Days = now + 7 * 24 * 60 * 60 * 1000;
    const dueThisWeek = visible.filter(i => {
      if (!i.dueDate) return false;
      const d = new Date(i.dueDate).getTime();
      return d >= now && d <= next7Days;
    }).length;

    // Completed submissions
    let completedCount = 0;
    if (activeRole === 'student') {
      const mySubmissions = (db.submissions || []).filter(
        s => s.courseId === courseId && s.studentId === activeUser.id && (s.status === 'submitted' || s.status === 'graded')
      );
      completedCount = mySubmissions.length;
    } else {
      const graded = (db.submissions || []).filter(
        s => s.courseId === courseId && s.status === 'graded'
      );
      completedCount = graded.length;
    }

    return { totalCount, totalPoints, dueThisWeek, completedCount };
  }, [allItems, activeRole, db.submissions, courseId, activeUser.id]);

  const getItemSubmissionStatus = (item: UnifiedAssessmentItem) => {
    if (activeRole === 'student') {
      const sub = (db.submissions || []).find(
        s =>
          s.courseId === courseId &&
          s.studentId === activeUser.id &&
          (s.activityId === item.id ||
            s.quizId === item.id ||
            s.examId === item.id ||
            s.activityKey === item.id ||
            s.activityKey === `asg-activity-${item.id}` ||
            s.activityKey === `asg-quiz-${item.id}` ||
            s.activityKey === `asg-exam-${item.id}`)
      );
      if (sub) {
        if (sub.status === 'graded') {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-3 w-3" />
              Graded ({sub.grade ?? 0}/{item.points})
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="h-3 w-3" />
            Submitted
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
    }

    // Faculty view
    const subs = (db.submissions || []).filter(
      s =>
        s.courseId === courseId &&
        (s.activityId === item.id ||
          s.quizId === item.id ||
          s.examId === item.id ||
          s.activityKey === item.id ||
          s.activityKey === `asg-activity-${item.id}` ||
          s.activityKey === `asg-quiz-${item.id}` ||
          s.activityKey === `asg-exam-${item.id}`)
    );
    const toGrade = subs.filter(s => s.status === 'submitted').length;
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground bg-accent px-2 py-0.5 rounded-full">
        {subs.length} submissions {toGrade > 0 && `(${toGrade} to grade)`}
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'activity':
        return <FileCheck2 className="h-4 w-4 text-sky-500" />;
      case 'quiz':
        return <QuizIcon className="h-4 w-4 text-purple-500" />;
      case 'assignment':
        return <FileText className="h-4 w-4 text-amber-500" />;
      case 'project':
        return <Briefcase className="h-4 w-4 text-emerald-500" />;
      case 'presentation':
        return <Presentation className="h-4 w-4 text-rose-500" />;
      case 'exam':
        return <Award className="h-4 w-4 text-indigo-500" />;
      default:
        return <ClipboardList className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Assessments Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track, organize, and complete all course assessments in one place.
          </p>
        </div>

        {isAssignedInstructor && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCreateMenuOpen(prev => !prev)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Assessment</span>
            </button>

            {isCreateMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-popover p-1.5 shadow-xl z-30 space-y-0.5"
                onMouseLeave={() => setIsCreateMenuOpen(false)}
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Select Assessment Type
                </div>
                {[
                  { label: 'Activity', tab: 'activities', icon: <FileCheck2 className="h-4 w-4 text-sky-500" /> },
                  { label: 'Quiz', tab: 'quizzes', icon: <QuizIcon className="h-4 w-4 text-purple-500" /> },
                  { label: 'Assignment', tab: 'assignments', icon: <FileText className="h-4 w-4 text-amber-500" /> },
                  { label: 'Project', tab: 'projects', icon: <Briefcase className="h-4 w-4 text-emerald-500" /> },
                  { label: 'Presentation', tab: 'presentations', icon: <Presentation className="h-4 w-4 text-rose-500" /> },
                  { label: 'Exam', tab: 'exams', icon: <Award className="h-4 w-4 text-indigo-500" /> },
                ].map(item => (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => {
                      setIsCreateMenuOpen(false);
                      onNavigateCategory(item.tab);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium hover:bg-accent cursor-pointer transition-colors"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Total Assessments</div>
            <div className="text-2xl font-black mt-1">{metrics.totalCount}</div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Due This Week</div>
            <div className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400">
              {metrics.dueThisWeek}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">
              {activeRole === 'student' ? 'Completed' : 'Graded Submissions'}
            </div>
            <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
              {metrics.completedCount}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground">Total Points</div>
            <div className="text-2xl font-black mt-1 text-indigo-600 dark:text-indigo-400">
              {metrics.totalPoints}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Award className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap transition-all duration-150 ${
                categoryFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card text-muted-foreground border border-border hover:bg-accent hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Term Filter */}
          <TermFilterSelect
            terms={effectiveTerms}
            value={selectedTerm}
            onChange={v => setSelectedTerm(v as 'all' | TermId)}
          />

          {/* Search box */}
          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search assessment..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-card pl-8 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Assessment List */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-7 w-7 text-muted-foreground" />}
          title="No assessments found"
          body={
            searchQuery || selectedTerm !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your filters or search keywords.'
              : 'There are no assessments created for this course yet.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filteredItems.map(item => (
            <div
              key={`${item.category}-${item.id}`}
              onClick={() => onNavigateCategory(item.targetSubTab, item.id)}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-md transition-all duration-150 cursor-pointer"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="mt-0.5 rounded-xl border border-border bg-background p-2.5 flex-shrink-0 group-hover:scale-105 transition-transform">
                  {getCategoryIcon(item.category)}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent text-muted-foreground">
                      {item.categoryLabel}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      {TERM_LABELS[item.term] ?? item.term}
                    </span>
                    {!item.published && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                        Draft
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1 font-semibold">
                      <Award className="h-3 w-3" />
                      {item.points} pts
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.dueDate
                        ? `Due ${new Date(item.dueDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'No due date'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                {getItemSubmissionStatus(item)}
                <div className="h-7 w-7 rounded-full bg-accent text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
