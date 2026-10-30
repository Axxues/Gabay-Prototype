import React, { useEffect, useMemo, useState } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { TermId, Activity, SubmissionAttachment } from '../../shared/types/lms';
import { normalizeTermId } from '../../shared/utils/gradingTerms';
import { TERM_LABELS, TermFilterSelect } from '../../shared/components/common/TermSelect';
import { canManageCourseContent } from '../../shared/utils/roles';
import { SourceFilterSelect } from '../../shared/components/common/SourceFilterSelect';
import {
  buildAssessmentSourceIndex,
  matchesSourceFilter,
  type AssessmentSourceFilter,
} from '../../shared/utils/assessmentSource';
import { sortAssessmentsLatestFirst } from './utils/assessmentSorting';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  Upload,
  Award,
  Send,
  ChevronRight,
  Plus,
  Trash2,
  ArrowLeft,
  Calendar,
  Paperclip,
  Download,
  Eye,
  Image as ImageIcon,
  FileText,
  X,
  Loader2
} from 'lucide-react';
import { uploadFileToPublic, formatFileSize } from '../../shared/utils/fileUploader';
import { CreateActivityPage } from './CreateActivityPage';
import { ActivityRunnerView } from './ActivityRunnerView';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { AssessmentFilePreviewModal, type AssessmentPreviewAttachment } from './components/AssessmentFilePreviewModal';
import { EmptyState } from '../../shared/components/common/EmptyState';

interface ActivitiesViewProps {
  courseId: string;
  selectedActivityId: string | null;
  onSelectActivity: (actId: string | null) => void;
  onBackToModules?: () => void;
}

const questionSetKeyOf = (activityId: string) => `asg-activity-${activityId}`;

const formatSubmissionTypes = (types?: string[]) => {
  if (!types || types.length === 0) return 'File upload, text entry';
  const labels: string[] = [];
  if (types.includes('file')) labels.push('File upload');
  if (types.includes('online_text')) labels.push('Text entry');
  if (types.includes('online_url')) labels.push('Website URL');
  return labels.length > 0 ? labels.join(', ') : types.join(', ');
};

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({
  courseId,
  selectedActivityId,
  onSelectActivity,
  onBackToModules
}) => {
  const {
    activeRole,
    activeUser,
    db,
    isLoading,
    isSyncing,
    submitActivity,
    deleteActivity,
    openSpeedGrader,
    showAlert,
    showConfirm,
    effectiveTermsForCourse
  } = useLMS() as ReturnType<typeof useLMS> & {
    effectiveTermsForCourse?: (courseId: string) => TermId[];
    // Sibling-WIP refresh flag: read when the provider supplies it.
    isSyncing?: boolean;
  };

  const course = (db.courses || []).find(c => c.id === courseId);
  const isAssignedInstructor = canManageCourseContent(course, activeUser);

  const courseActivities = (db.activities || []).filter(
    a => a.courseId === courseId && (!a.assessmentType || a.assessmentType === 'activity')
  );

  // Syllabus-driven terms (Prelim/Midterm/Finals depending on scanned syllabus).
  const effectiveTerms: TermId[] =
    courseId && typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  // Grading-term filter for the list (legacy rows without a term read as 'midterm').
  const [termFilter, setTermFilter] = useState<'all' | TermId>('all');
  useEffect(() => {
    if (termFilter !== 'all' && !effectiveTerms.includes(termFilter)) setTermFilter('all');
  }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Source filter: From Module (linked via module items) vs Direct (created on this page).
  const [sourceFilter, setSourceFilter] = useState<AssessmentSourceFilter>('all');
  const sourceIndex = useMemo(
    () => buildAssessmentSourceIndex((db as any).modules, courseId),
    [(db as any).modules, courseId]
  );
  const matchesTerm = (term?: TermId) =>
    termFilter === 'all' || (normalizeTermId(term) ?? 'midterm') === termFilter;
  const isFromModule = (act: Activity) =>
    act.format === 'classic'
      ? sourceIndex.classicActivityIds.has(act.id)
      : sourceIndex.activityIds.has(act.id);
  const visibleActivities = useMemo(() => {
    const filtered = courseActivities.filter(
      a => matchesTerm(a.term) && matchesSourceFilter(isFromModule(a), sourceFilter)
    );
    return sortAssessmentsLatestFirst(filtered, sourceIndex);
  }, [courseActivities, termFilter, sourceFilter, sourceIndex]);
  const selectedActivity = (db.activities || []).find(a => a.id === selectedActivityId);

  // Synthetic link convention (`asg-activity-<id>`, shared with submissions /
  // badges / module items): selecting one opens the question-set runner
  // directly instead of dead-ending on the list.
  const syntheticActivityId =
    selectedActivityId && selectedActivityId.startsWith('asg-activity-')
      ? selectedActivityId.slice('asg-activity-'.length)
      : null;

  // Submission type constraints from activity definition
  const rawTypes = selectedActivity?.submissionTypes;
  const allowFileUpload = !rawTypes || rawTypes.length === 0 || rawTypes.includes('file');
  const allowOnlineText = !rawTypes || rawTypes.length === 0 || rawTypes.includes('online_text');

  // Student submission form state
  const [submissionType, setSubmissionType] = useState<'file' | 'online_text'>(
    allowFileUpload && !allowOnlineText ? 'file' : 'online_text'
  );

  useEffect(() => {
    if (allowFileUpload && !allowOnlineText) {
      setSubmissionType('file');
    } else if (allowOnlineText && !allowFileUpload) {
      setSubmissionType('online_text');
    }
  }, [allowFileUpload, allowOnlineText]);
  const [textContent, setTextContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const addFiles = (files: File[]) => {
    setSelectedFiles(prev => {
      const next = [...prev];
      for (const f of files) {
        if (!next.some(existing => existing.name === f.name && existing.size === f.size)) next.push(f);
      }
      return next;
    });
  };
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AssessmentPreviewAttachment | null>(null);

  // Full Page Create Activity State
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);

  const currentSubmission = selectedActivity
    ? db.submissions.find(s => (s.activityKey === selectedActivity.id || s.activityId === selectedActivity.id) && s.studentId === activeUser.id)
    : undefined;

  // All files attached to the submission (legacy rows store a single file).
  const submissionFiles: SubmissionAttachment[] =
    currentSubmission?.attachments && currentSubmission.attachments.length > 0
      ? currentSubmission.attachments
      : currentSubmission?.fileName
        ? [{ name: currentSubmission.fileName, url: currentSubmission.fileUrl }]
        : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;

    if (submissionType === 'online_text' && !textContent.trim()) {
      showAlert("Please enter submission text content.");
      return;
    }
    if (submissionType === 'file' && selectedFiles.length === 0) {
      showAlert("Please choose at least one file to attach.");
      return;
    }

    setIsSubmitting(true);
    try {
      const attachments: SubmissionAttachment[] = [];

      if (submissionType === 'file') {
        for (const file of selectedFiles) {
          try {
            const res = await uploadFileToPublic(file);
            attachments.push({
              name: res.name || file.name,
              url: res.url,
              size: res.size,
              id: (res as any).id || (res as any).fileId,
            });
          } catch {
            attachments.push({
              name: file.name,
              url: `/likha/assets/mock-${encodeURIComponent(file.name)}`,
              size: formatFileSize(file.size),
            });
          }
        }
      }

      const primary = attachments[0];
      await submitActivity(
        selectedActivity.id,
        submissionType,
        textContent,
        primary?.name ?? 'CMSC131_Lab_Submission.pdf',
        undefined,
        primary?.url,
        primary?.id,
        primary?.size,
        attachments.length > 0 ? attachments : undefined
      );
      showAlert({
        title: "Activity Submitted",
        message: "Your submission has been recorded successfully.",
        type: "success"
      });
      setSelectedFiles([]);
    } catch {
      // submitActivity already surfaced the alert.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (actId: string) => {
    showConfirm(
      "Are you sure you want to delete this activity and all associated student submissions?",
      () => {
        deleteActivity(actId)
          .then(() => onSelectActivity(null))
          .catch(() => {});
      },
      "Delete Activity"
    );
  };

  const handleDeleteQuestionSet = (id: string) => {
    showConfirm(
      'Are you sure you want to delete this question set and all associated student submissions?',
      () => {
        deleteActivity(id)
          .then(() => onSelectActivity(null))
          .catch(() => {});
      },
      'Delete Question Set'
    );
  };

  // If user clicked create activity, render unified creation page (classic + question set)
  if (isCreatingActivity) {
    return (
      <CreateActivityPage
        courseId={courseId}
        onBack={() => setIsCreatingActivity(false)}
        onActivityCreated={actId => {
          setIsCreatingActivity(false);
          onSelectActivity(actId);
        }}
      />
    );
  }

  // A selected question-set activity (raw id) renders its runner. A synthetic
  // `asg-activity-*` link (e.g. from a module item) resolves to the same
  // runner; exiting it clears the selection so the list shows on return.
  const runnerActivityId =
    selectedActivity && selectedActivity.format !== 'classic'
      ? selectedActivity.id
      : syntheticActivityId;
  if (runnerActivityId) {
    return (
      <ActivityRunnerView
        courseId={courseId}
        activityId={runnerActivityId}
        onSelectActivity={onSelectActivity}
        onBackToModules={onBackToModules}
      />
    );
  }

  // If no activity selected, render unified activities list
  if (!selectedActivity) {
    return (
      <div className="space-y-6 animate-fade-in">
        {onBackToModules && (
          <button
            type="button"
            onClick={onBackToModules}
            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1.5 cursor-pointer -mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Modules</span>
          </button>
        )}
        <PageHeader
          title="Activities"
          description="Course activities and laboratory tasks."
          actions={
            isAssignedInstructor && (
              <button
                onClick={() => setIsCreatingActivity(true)}
                className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Activity</span>
              </button>
            )
          }
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          <SourceFilterSelect
            id="activities-source-filter"
            value={sourceFilter}
            onChange={setSourceFilter}
            prefixLabel="Filter by source:"
          />
          <TermFilterSelect
            id="activities-term-filter"
            value={termFilter}
            onChange={setTermFilter}
            prefixLabel="Filter by term:"
            terms={effectiveTerms}
          />
        </div>

        <div className="space-y-3">
          {(isLoading || isSyncing) && courseActivities.length === 0 ? (
            <div data-testid="activities-loading" className="space-y-3" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`activities-skeleton-${i}`} className="p-4 bg-card border border-border rounded-2xl flex items-center gap-3.5 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-1/2 rounded bg-muted" />
                    <div className="h-3 w-1/3 rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : courseActivities.length === 0 ? (
            <EmptyState
              title="No activities published for this course yet."
            />
          ) : visibleActivities.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground text-center py-6">
              No activities match the selected filters yet.
            </p>
          ) : (
            visibleActivities.map(act => {
              if (act.format === 'classic') {
              // Submissions come back keyed either by the raw activity id (written
              // in-session) or the synthetic `asg-activity-<id>` key (from Likha ERP).
              const studentSub = db.submissions.find(
                s =>
                  (s.activityKey === act.id ||
                    s.activityKey === questionSetKeyOf(act.id) ||
                    s.activityId === act.id) &&
                  s.studentId === activeUser.id
              );
              const actTermId: TermId = normalizeTermId(act.term) ?? 'midterm';
              const actFromModule = sourceIndex.classicActivityIds.has(act.id);
              const actModuleTitle = sourceIndex.moduleTitleByClassicActivity.get(act.id);

              return (
                <div
                  key={act.id}
                  onClick={() => onSelectActivity(act.id)}
                  className="group p-4 bg-card border border-border rounded-2xl hover:border-muted-foreground/25 hover:shadow-card cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <h3 className="font-bold text-[14px] tracking-tight truncate text-foreground group-hover:text-primary transition-colors">
                          {act.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border shrink-0">
                          {TERM_LABELS[actTermId]}
                        </span>
                        <span
                          title={actFromModule && actModuleTitle ? `From module: ${actModuleTitle}` : 'Created directly on the Activities page'}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${
                            actFromModule
                              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20'
                              : 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20'
                          }`}
                        >
                          {actFromModule ? 'Module' : 'Direct'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground mt-1 font-sans">
                        <span className="font-medium">
                          {act.category || 'Activity'}
                        </span>
                        <span>·</span>
                        <span>Due {act.dueDate ? new Date(act.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No due date'}</span>
                        <span>·</span>
                        <span className="font-semibold text-foreground">{act.pointsPossible} pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    {studentSub ? (
                      studentSub.status === 'graded' ? (
                        <span className="px-2.5 py-1 text-xs font-sans font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-500/20 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Scored {studentSub.grade}/{act.pointsPossible}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-sans font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-full border border-blue-500/20 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Submitted</span>
                        </span>
                      )
                    ) : (
                      activeRole === 'student' && (
                      <span className="px-2.5 py-1 text-xs font-sans font-medium bg-muted text-muted-foreground rounded-full border border-border">
                        Not submitted
                      </span>
                      )
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            }

            const studentSub =
              activeRole === 'student'
                ? db.submissions.find(
                    s =>
                      (s.activityKey === questionSetKeyOf(act.id) ||
                        s.activityKey === act.id ||
                        s.activityId === act.id) &&
                      s.studentId === activeUser.id
                  )
                : undefined;
              const hasEssay = act.questions.some(q => q.type === 'essay');
              const actTermId: TermId = normalizeTermId(act.term) ?? 'midterm';
              const actFromModule = sourceIndex.activityIds.has(act.id);
              const actModuleTitle = sourceIndex.moduleTitleByActivity.get(act.id);

              return (
                <div
                  key={act.id}
                  onClick={() => onSelectActivity(act.id)}
                  className="group p-4 bg-card border border-border rounded-2xl hover:border-muted-foreground/25 hover:shadow-card cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <h3 className="font-bold text-[14px] tracking-tight truncate text-foreground group-hover:text-primary transition-colors">
                          {(act.title || '').trim() || 'Untitled question set'}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground border border-border shrink-0">
                          {TERM_LABELS[actTermId]}
                        </span>
                        <span
                          title={actFromModule && actModuleTitle ? `From module: ${actModuleTitle}` : 'Created directly on the Activities page'}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${
                            actFromModule
                              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20'
                              : 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20'
                          }`}
                        >
                          {actFromModule ? 'Module' : 'Direct'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground mt-1 font-sans">
                        <span className="font-medium">
                          Question set
                        </span>
                        <span>·</span>
                        <span>{act.questions.length} questions</span>
                        <span>·</span>
                        <span className="font-semibold text-foreground">{act.pointsPossible} pts</span>
                        {act.dueDate && (
                          <>
                            <span>·</span>
                            <span>
                              Due{' '}
                              {new Date(act.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    {studentSub ? (
                      studentSub.status === 'graded' ? (
                        <span className="px-2.5 py-1 text-xs font-sans font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-500/20 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Scored {studentSub.grade}%</span>
                        </span>
                      ) : hasEssay ? (
                        <span className="px-2.5 py-1 text-xs font-sans font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full border border-amber-500/20 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending review</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-sans font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-full border border-blue-500/20 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Submitted</span>
                        </span>
                      )
                    ) : (
                      activeRole === 'student' && (
                        <span className="px-2.5 py-1 text-xs font-sans font-medium bg-muted text-muted-foreground rounded-full border border-border">
                          Not submitted
                        </span>
                      )
                    )}
                    {isAssignedInstructor && (
                      <button
                        type="button"
                        title="Delete Question Set"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteQuestionSet(act.id);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-500/10 rounded-xl border border-red-500/20 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    );
  }

  // Render Detailed Activity & Submission Workspace (classic format)
  return (
    <div className="space-y-5 w-full animate-fade-in pb-16">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (onBackToModules) {
              onBackToModules();
            } else {
              onSelectActivity(null);
            }
          }}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{onBackToModules ? 'Back to modules' : 'Back to activities'}</span>
        </button>

        {activeRole !== 'student' && isAssignedInstructor && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDelete(selectedActivity.id)}
              className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              title="Delete activity"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Activity Header Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="text-[12px] font-semibold text-muted-foreground">
              {selectedActivity.category || 'Activity'}
            </div>
            <h1 className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-foreground break-words">
              {selectedActivity.title}
            </h1>
          </div>

          <div className="shrink-0 sm:text-right">
            <div className="text-[28px] leading-none font-extrabold tabular-nums tracking-tight text-foreground">
              {selectedActivity.pointsPossible}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">points</div>
          </div>
        </div>

        {/* Due Date & Submission Type */}
        <div className="grid sm:grid-cols-2 gap-3 py-4 border-y border-border/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground">Due</div>
              <div className="text-[12.5px] font-semibold text-foreground truncate">{selectedActivity.dueDate ? new Date(selectedActivity.dueDate).toLocaleString() : 'No due date'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground">Submissions</div>
              <div className="text-[12.5px] font-semibold text-foreground truncate">{formatSubmissionTypes(selectedActivity.submissionTypes)}</div>
            </div>
          </div>
        </div>

        {/* Activity Instructions */}
        <div className="space-y-2">
          <h4 className="text-[13px] font-bold text-foreground">
            Guidelines
          </h4>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground whitespace-pre-line">{selectedActivity.instructions}</p>
        </div>

        {/* Attached Starter Handouts / Reference Files */}
        {(() => {
          const attachments = (selectedActivity.attachments && selectedActivity.attachments.length > 0)
            ? selectedActivity.attachments
            : selectedActivity.fileName
              ? [{ name: selectedActivity.fileName, size: selectedActivity.fileSize || '', url: selectedActivity.fileUrl, type: 'file' }]
              : [];
          if (attachments.length === 0) return null;

          return (
            <div className="pt-2 space-y-3">
              <h4 className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span>Reference & Starter Handouts</span>
                <span className="text-[12px] font-semibold text-muted-foreground">· {attachments.length} {attachments.length === 1 ? 'file' : 'files'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((att, idx) => {
                  const isImg = att.name ? /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(att.name) : false;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 bg-muted/20 hover:bg-muted/30 border border-border/70 rounded-xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div
                        className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1 cursor-pointer"
                        onClick={() => setPreviewAttachment(att)}
                        title={`View ${att.name}`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setPreviewAttachment(att);
                          }
                        }}
                      >
                        <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                          {isImg ? (
                            <ImageIcon className="w-4 h-4 text-pink-500" />
                          ) : (
                            <FileText className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="truncate min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate hover:text-primary transition-colors" title={att.name}>
                            {att.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {att.size || 'Resource'} • {isImg ? 'Image' : 'Document'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/70 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 border border-border"
                          title={`View ${att.name}`}
                        >
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>View</span>
                        </button>
                        {att.url && (
                          <a
                            href={att.url}
                            download={att.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 border border-primary/20"
                            title={`Download ${att.name}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Rubric Criteria Summary */}
        <div className="pt-2 space-y-3">
          <h4 className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
            <Award className="w-4 h-4 text-muted-foreground" />
            <span>Rubric</span>
            <span className="text-[12px] font-semibold text-muted-foreground">· {(selectedActivity.rubric || []).length} criteria</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(selectedActivity.rubric || []).map(criterion => (
              <div key={criterion.id} className="p-4 bg-muted/20 rounded-xl border border-border/70 space-y-2.5">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="font-bold text-[13px] tracking-tight text-foreground">{criterion.title}</span>
                  <span className="text-[12px] font-bold tabular-nums text-muted-foreground shrink-0">{criterion.points} pts</span>
                </div>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{criterion.description}</p>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(criterion.ratings || []).map(r => (
                    <div key={r.points} className="px-2 py-2 bg-card border border-border/60 rounded-lg text-center">
                      <div className="text-[12px] font-bold tabular-nums text-foreground">{r.points}</div>
                      <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground truncate">{r.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grading entry point (faculty / staff) */}
        {activeRole !== 'student' && (
          <div>
            <button
              type="button"
              onClick={() => {
                // Classic rows link via the raw activity id; question-set rows
                // link via the synthetic `asg-activity-<id>` key.
                const sub = db.submissions.find(
                  s =>
                    s.activityKey === selectedActivity.id ||
                    s.activityKey === questionSetKeyOf(selectedActivity.id) ||
                    (s as unknown as { activityId?: string }).activityId === selectedActivity.id
                );
                if (sub) openSpeedGrader(sub.id);
                else showAlert('No student submissions yet for this activity.');
              }}
              className="w-full px-4 py-3 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.99] text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>Grade Submissions</span>
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Submission Status Section (For Students) */}
      {activeRole === 'student' && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-4">
          <h3 className="font-bold text-base text-foreground flex items-center justify-between">
            <span>Your Submission Status</span>
            {currentSubmission ? (
              currentSubmission.status === 'graded' ? (
                <span className="px-3 py-1 text-xs font-sans font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-500/20">
                  Evaluated: {currentSubmission.grade} / {selectedActivity.pointsPossible} pts
                </span>
              ) : (
                <span className="px-3 py-1 text-xs font-sans font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-500/20 flex items-center space-x-1">
                  Submitted • Pending Evaluation
                </span>
              )
            ) : (
              <span className="px-3 py-1 text-xs font-sans font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/20">
                Awaiting Submission
              </span>
            )}
          </h3>

          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {currentSubmission && (
              <div className="p-3 bg-muted/30 border border-border/70 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Submitted:</span>
                  <span className="font-semibold text-foreground">
                    {currentSubmission.submittedAt ? new Date(currentSubmission.submittedAt).toLocaleString() : 'Recently'}
                  </span>
                </div>
                {submissionFiles.length > 0 && (
                  <div className="flex items-start justify-between space-x-3">
                    <span className="text-muted-foreground flex items-center space-x-1.5">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{submissionFiles.length > 1 ? 'Attached Files:' : 'Attached File:'}</span>
                    </span>
                    <div className="flex flex-col items-end space-y-1.5">
                      {submissionFiles.map((file, idx) => (
                        <div key={`${file.name}-${idx}`} className="flex items-center space-x-2">
                          <span className="font-semibold text-foreground truncate max-w-[200px]">
                            {file.name}
                          </span>
                          {file.url && (
                            <>
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment({
                                  name: file.name || 'Submission Attachment',
                                  size: file.size,
                                  url: file.url,
                                })}
                                className="px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted/70 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 border border-border"
                                title={`View ${file.name}`}
                              >
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>View</span>
                              </button>
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 border border-primary/20"
                                title={`Download ${file.name}`}
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </a>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {((currentSubmission.comments ?? []).length > 0 || currentSubmission.feedback) && (
                  <div className="pt-1.5 border-t border-border/70 space-y-1.5">
                    <span className="text-muted-foreground">Instructor Feedback:</span>
                    {(currentSubmission.comments ?? []).length > 0 ? (
                      (currentSubmission.comments ?? []).map(comment => (
                        <div key={comment.id} className="p-3 bg-card border border-border rounded-xl space-y-1">
                          <div className="flex justify-between text-[10px] font-sans text-muted-foreground">
                            <span className="font-bold text-foreground">{comment.authorName}</span>
                            <span>{new Date(comment.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-foreground leading-normal italic">{comment.text}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 bg-card border border-border rounded-xl space-y-1">
                        <div className="text-[10px] font-sans font-bold text-foreground">Instructor</div>
                        <p className="text-foreground leading-normal italic">{currentSubmission.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {allowOnlineText && allowFileUpload && (
              <div className="flex space-x-2 border-b border-border pb-2">
                <button
                  type="button"
                  onClick={() => setSubmissionType('online_text')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${submissionType === 'online_text'
                      ? 'bg-primary text-primary-foreground shadow-subtle'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Text Entry / Repository URL
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionType('file')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${submissionType === 'file'
                      ? 'bg-primary text-primary-foreground shadow-subtle'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  File Upload (.PDF / .ZIP)
                </button>
              </div>
            )}

            {submissionType === 'online_text' && allowOnlineText ? (
              <div className="space-y-2">
                <label className="block font-bold text-foreground">
                  Online Text Content & Code Submissions:
                </label>
                <textarea
                  rows={5}
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="Paste your source code, laboratory answers, or Git repository URL here..."
                  className="w-full p-3 rounded-xl border border-border bg-background font-sans text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary text-xs outline-none"
                />
              </div>
            ) : allowFileUpload ? (
              <div className="space-y-2">
                <label className="block font-bold text-foreground">
                  File Attachment:
                </label>
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropped = Array.from(e.dataTransfer.files || []);
                    if (dropped.length) addFiles(dropped);
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center space-y-3 transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'
                  }`}
                >
                  {selectedFiles.length > 0 ? (
                    <div className="max-w-md mx-auto space-y-2">
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className="p-3 bg-card border border-border rounded-xl flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3 truncate">
                            <FileText className="w-6 h-6 text-primary shrink-0" />
                            <div className="text-left truncate">
                              <div className="font-bold text-foreground truncate text-xs">{file.name}</div>
                              <div className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const url = URL.createObjectURL(file);
                                setPreviewAttachment({ name: file.name, size: formatFileSize(file.size), url });
                              }}
                              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                              title="Preview selected file"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                              title="Remove file"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <label className="block text-[11px] font-semibold text-primary hover:underline cursor-pointer">
                        + Add more files
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={e => {
                            const list = Array.from(e.target.files || []);
                            if (list.length) addFiles(list);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                      <div>
                        <label className="font-semibold text-primary hover:underline cursor-pointer">
                          <span>Browse files to upload</span>
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={e => {
                              const list = Array.from(e.target.files || []);
                              if (list.length) addFiles(list);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <span className="text-muted-foreground"> or drag and drop here</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Supported: PDF, DOCX, ZIP, images (up to 25MB each)
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isSubmitting ? 'Uploading & Submitting...' : currentSubmission ? 'Resubmit Activity' : 'Submit Activity to GABAY'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Assessment Attachment Preview Modal */}
      <AssessmentFilePreviewModal
        file={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </div>
  );
};
