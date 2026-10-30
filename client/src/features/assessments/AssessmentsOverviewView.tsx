import React, { useMemo, useState } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { TermId } from '../../shared/types/lms';
import { normalizeTermId } from '../../shared/utils/gradingTerms';
import { TERM_LABELS, TermFilterSelect } from '../../shared/components/common/TermSelect';
import { canManageCourseContent } from '../../shared/utils/roles';
import { EmptyState } from '../../shared/components/common/EmptyState';
import { buildAssessmentSourceIndex } from '../../shared/utils/assessmentSource';
import { sortAssessmentsLatestFirst } from './utils/assessmentSorting';
import {
  ClipboardList,
  FileCheck2,
  HelpCircle as QuizIcon,
  FileText,
  Briefcase,
  Presentation,
  Search,
  Hourglass,
  Clock,
  ChevronRight,
  Plus,
  CheckCircle2,
} from 'lucide-react';

interface AssessmentsOverviewViewProps {
  courseId: string;
  onNavigateCategory: (category: string, itemId?: string) => void;
}

type CategoryFilter = 'all' | 'activities' | 'quizzes' | 'assignments' | 'projects' | 'presentations';

interface UnifiedAssessmentItem {
  id: string;
  category: 'activity' | 'quiz' | 'assignment' | 'project' | 'presentation';
  categoryLabel: string;
  title: string;
  term: TermId;
  points: number;
  dueDate?: string;
  published: boolean;
  format?: string;
  targetSubTab: string;
  createdAt?: string;
  metadata?: any;
}

const CATEGORY_TABS: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  { id: 'activities', label: 'Activities', icon: <FileCheck2 className="h-3.5 w-3.5" /> },
  { id: 'quizzes', label: 'Quizzes', icon: <QuizIcon className="h-3.5 w-3.5" /> },
  { id: 'assignments', label: 'Assignments', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'projects', label: 'Projects', icon: <Briefcase className="h-3.5 w-3.5" /> },
  { id: 'presentations', label: 'Presentations', icon: <Presentation className="h-3.5 w-3.5" /> },

];

export const AssessmentsOverviewView: React.FC<AssessmentsOverviewViewProps> = ({
  courseId,
  onNavigateCategory,
}) => {
  const { db, activeRole, activeUser, effectiveTermsForCourse, showAlert } = useLMS();
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
          createdAt: a.createdAt,
          metadata: a.metadata,
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
          createdAt: q.createdAt,
        });
      });

    return list;
  }, [db.activities, db.quizzes, courseId]);

  const sourceIndex = useMemo(
    () => buildAssessmentSourceIndex((db as any).modules, courseId),
    [(db as any).modules, courseId]
  );

  // Filter items
  const filteredItems = useMemo(() => {
    const filtered = allItems.filter(item => {
      // Role visibility: students only see published assessments
      if (activeRole === 'student' && !item.published) return false;

      // Category filter
      if (categoryFilter !== 'all') {
        const matchesCategory =
          (categoryFilter === 'activities' && item.category === 'activity') ||
          (categoryFilter === 'quizzes' && item.category === 'quiz') ||
          (categoryFilter === 'assignments' && item.category === 'assignment') ||
          (categoryFilter === 'projects' && item.category === 'project') ||
          (categoryFilter === 'presentations' && item.category === 'presentation');
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

    return sortAssessmentsLatestFirst(filtered, sourceIndex);
  }, [allItems, categoryFilter, selectedTerm, searchQuery, activeRole, sourceIndex]);

  // Metrics computation
  const metrics = useMemo(() => {
    const visible = allItems.filter(i => activeRole !== 'student' || i.published);
    const totalCount = visible.length;

    // Due in next 7 days
    const now = new Date().getTime();
    const next7Days = now + 7 * 24 * 60 * 60 * 1000;
    const dueThisWeek = visible.filter(i => {
      if (!i.dueDate) return false;
      const d = new Date(i.dueDate).getTime();
      return d >= now && d <= next7Days;
    }).length;

    // Submissions still waiting on the grader (faculty) or on evaluation (student).
    const ungradedCount = (db.submissions || []).filter(
      s =>
        s.courseId === courseId &&
        s.status === 'submitted' &&
        (activeRole !== 'student' || s.studentId === activeUser.id)
    ).length;

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

    return { totalCount, dueThisWeek, completedCount, ungradedCount };
  }, [allItems, activeRole, db.submissions, courseId, activeUser.id]);

  const getItemSubmissionStatus = (item: UnifiedAssessmentItem) => {
    if (activeRole === 'student') {
      const sub = (db.submissions || []).find(
        s =>
          s.courseId === courseId &&
          s.studentId === activeUser.id &&
          (s.activityId === item.id ||
            s.quizId === item.id ||
            s.activityKey === item.id ||
            s.activityKey === `asg-activity-${item.id}` ||
            s.activityKey === `asg-quiz-${item.id}`)
      );
      if (sub) {
        if (sub.status === 'graded') {
          return (
            <span className="px-2.5 py-1 text-xs font-sans font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-500/20 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Scored {sub.grade ?? 0}/{item.points}</span>
            </span>
          );
        }
        return (
          <span className="px-2.5 py-1 text-xs font-sans font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-full border border-blue-500/20 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Submitted</span>
          </span>
        );
      }
      return (
        <span className="px-2.5 py-1 text-xs font-sans font-medium bg-muted text-muted-foreground rounded-full border border-border">
          Not submitted
        </span>
      );
    }

    // Faculty view
    const subs = (db.submissions || []).filter(
      s =>
        s.courseId === courseId &&
        (s.activityId === item.id ||
          s.quizId === item.id ||
          s.activityKey === item.id ||
          s.activityKey === `asg-activity-${item.id}` ||
          s.activityKey === `asg-quiz-${item.id}`)
    );
    const toGrade = subs.filter(s => s.status === 'submitted').length;
    return (
      <span className="px-2.5 py-1 text-xs font-sans font-medium bg-muted text-muted-foreground rounded-full border border-border">
        {subs.length} submissions {toGrade > 0 && `(${toGrade} to grade)`}
      </span>
    );
  };

  // Per-category pill tone, matching the badge palette used elsewhere in the
  // assessments feature (SpeedGrader header badges).
  const getCategoryPillClasses = (category: string) => {
    switch (category) {
      case 'activity':
        return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20';
      case 'quiz':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
      case 'assignment':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
      case 'project':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
      case 'presentation':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
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
              onClick={() => {
                if (course && !course.syllabus) {
                  showAlert('A syllabus must be uploaded before creating assessments.', 'Syllabus Required');
                  return;
                }
                setIsCreateMenuOpen(prev => !prev);
              }}
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
            <div className="text-[11px] font-semibold text-muted-foreground">Ungraded Submissions</div>
            <div className="text-2xl font-black mt-1 text-rose-600 dark:text-rose-400">
              {metrics.ungradedCount}
            </div>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <Hourglass className="h-5 w-5" />
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
              className="group p-4 bg-card border border-border rounded-2xl hover:border-muted-foreground/25 hover:shadow-card cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start space-x-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                  {getCategoryIcon(item.category)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <h3 className="font-bold text-[14px] tracking-tight truncate text-foreground group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border shrink-0">
                      {TERM_LABELS[item.term] ?? item.term}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${getCategoryPillClasses(item.category)}`}>
                      {item.categoryLabel}
                    </span>
                    {!item.published && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                        Draft
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground mt-1 font-sans">
                    <span>
                      {item.dueDate
                        ? `Due ${new Date(item.dueDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'No due date'}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">{item.points} pts</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50">
                {getItemSubmissionStatus(item)}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
