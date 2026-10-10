import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import type { TermId } from '../types/lms';
import { normalizeTermId } from '../utils/gradingTerms';
import { TERM_LABELS, TermFilterSelect } from '../components/common/TermSelect';
import {
  FileText,
  Clock,
  CheckCircle2,
  Upload,
  Award,
  Send,
  Plus,
  Trash2,
  ArrowLeft,
  Calendar,
  Users
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { CreateAssignmentPage } from './CreateAssignmentPage';

interface AssignmentsViewProps {
  courseId: string;
  selectedAssignmentId: string | null;
  onSelectAssignment: (id: string | null) => void;
  onBackToModules?: () => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  courseId,
  selectedAssignmentId,
  onSelectAssignment,
  onBackToModules,
}) => {
  const {
    activeRole,
    activeUser,
    db,
    submitActivity,
    deleteActivity,
    openSpeedGrader,
    showAlert,
    showConfirm,
    effectiveTermsForCourse,
  } = useLMS();

  const [termFilter, setTermFilter] = useState<'all' | TermId>('all');
  const [submissionType, setSubmissionType] = useState<'file' | 'online_text'>('online_text');
  const [textContent, setTextContent] = useState('');
  const [simulatedFileName, setSimulatedFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const effectiveTerms: TermId[] =
    courseId && typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const courseAssignments = (db.activities || []).filter(
    a => a.courseId === courseId && a.assessmentType === 'assignment'
  );

  const visibleAssignments = courseAssignments.filter(a => {
    if (activeRole === 'student' && !a.published) return false;
    if (termFilter !== 'all' && (normalizeTermId(a.term) ?? 'midterm') !== termFilter) return false;
    return true;
  });

  const selectedAssignment = selectedAssignmentId
    ? courseAssignments.find(a => a.id === selectedAssignmentId)
    : null;

  const currentSubmission = selectedAssignment
    ? (db.submissions || []).find(
        s => (s.activityId === selectedAssignment.id || s.activityKey === selectedAssignment.id) && s.studentId === activeUser.id
      )
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    if (submissionType === 'online_text' && !textContent.trim()) {
      showAlert('Please enter your assignment response text.');
      return;
    }
    if (submissionType === 'file' && !simulatedFileName) {
      showAlert('Please choose or upload a file.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitActivity(
        selectedAssignment.id,
        submissionType,
        textContent,
        simulatedFileName || 'Assignment_Submission.pdf'
      );
      showAlert({
        title: 'Assignment Submitted',
        message: 'Your assignment has been submitted successfully.',
        type: 'success',
      });
    } catch {
      // Handled in submitActivity
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm(
      'Are you sure you want to delete this assignment and all associated student submissions?',
      () => {
        deleteActivity(id)
          .then(() => onSelectAssignment(null))
          .catch(() => {});
      },
      'Delete Assignment'
    );
  };

  if (isCreating) {
    return (
      <CreateAssignmentPage
        courseId={courseId}
        onBack={() => setIsCreating(false)}
        onCreated={id => {
          setIsCreating(false);
          onSelectAssignment(id);
        }}
      />
    );
  }

  // List view
  if (!selectedAssignment) {
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
          icon={<FileText className="h-5 w-5 text-amber-500" />}
          title="Assignments"
          subtitle="Course assignments, homework, and formal submissions"
          primaryAction={
            activeRole !== 'student'
              ? {
                  label: 'Create Assignment',
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => setIsCreating(true),
                }
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            <TermFilterSelect
              terms={effectiveTerms}
              value={termFilter}
              onChange={setTermFilter}
              includeAll
            />
          </div>
        </PageHeader>

        {visibleAssignments.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8 text-muted-foreground" />}
            title="No assignments found"
            body={
              activeRole === 'student'
                ? 'No assignments have been published yet.'
                : 'Click "Create Assignment" to add the first assignment for this course.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {visibleAssignments.map(assignment => {
              const mySub = (db.submissions || []).find(
                s => (s.activityId === assignment.id || s.activityKey === assignment.id) && s.studentId === activeUser.id
              );
              const subs = (db.submissions || []).filter(
                s => s.activityId === assignment.id || s.activityKey === assignment.id
              );
              const pendingGradeCount = subs.filter(s => s.status === 'submitted').length;

              return (
                <div
                  key={assignment.id}
                  onClick={() => onSelectAssignment(assignment.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-xl border border-border bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                          {TERM_LABELS[normalizeTermId(assignment.term)] ?? assignment.term}
                        </span>
                        {!assignment.published && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                            Draft
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold truncate">{assignment.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          {assignment.pointsPossible} pts
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {assignment.dueDate
                            ? `Due ${new Date(assignment.dueDate).toLocaleDateString()}`
                            : 'No due date'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeRole === 'student' ? (
                      mySub ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {mySub.status === 'graded' ? `Graded: ${mySub.grade ?? 0}/${assignment.pointsPossible}` : 'Submitted'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full">
                          <Clock className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground bg-accent px-2.5 py-1 rounded-full font-medium">
                        {subs.length} submissions {pendingGradeCount > 0 && `(${pendingGradeCount} to grade)`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Detail & Submission View
  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <button
        type="button"
        onClick={() => onSelectAssignment(null)}
        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Assignments</span>
      </button>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                {TERM_LABELS[normalizeTermId(selectedAssignment.term)] ?? selectedAssignment.term}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">
                {selectedAssignment.pointsPossible} Points
              </span>
            </div>
            <h1 className="text-xl font-extrabold">{selectedAssignment.title}</h1>
          </div>

          {activeRole !== 'student' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const subs = (db.submissions || []).filter(
                    s => s.activityId === selectedAssignment.id || s.activityKey === selectedAssignment.id
                  );
                  if (subs.length > 0) openSpeedGrader(subs[0].id);
                  else showAlert('No student submissions to grade yet.');
                }}
                className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold hover:bg-accent/80 cursor-pointer"
              >
                <Users className="h-3.5 w-3.5" />
                <span>SpeedGrader</span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selectedAssignment.id)}
                className="p-1.5 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none pt-2 border-t border-border">
          <p className="whitespace-pre-line text-sm text-foreground/90">{selectedAssignment.instructions}</p>
        </div>

        {/* Rubric section */}
        {selectedAssignment.rubric && selectedAssignment.rubric.length > 0 && (
          <div className="pt-4 border-t border-border space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rubric Criteria</h3>
            <div className="space-y-2">
              {selectedAssignment.rubric.map(r => (
                <div key={r.id} className="rounded-xl border border-border p-3 text-xs bg-accent/30 flex justify-between items-start">
                  <div>
                    <div className="font-bold">{r.title}</div>
                    <div className="text-muted-foreground mt-0.5">{r.description}</div>
                  </div>
                  <div className="font-bold text-primary shrink-0 ml-4">{r.points} pts</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Student Submission Card */}
      {activeRole === 'student' && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            {currentSubmission ? 'Your Submission' : 'Submit Assignment'}
          </h2>

          {currentSubmission ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Submitted on {new Date(currentSubmission.submittedAt).toLocaleString()}
                </span>
                {currentSubmission.grade !== undefined && currentSubmission.grade !== null && (
                  <span className="text-xs font-black text-primary">
                    Grade: {currentSubmission.grade}/{selectedAssignment.pointsPossible}
                  </span>
                )}
              </div>
              {currentSubmission.content && (
                <div className="text-xs text-foreground/90 whitespace-pre-wrap p-3 rounded-lg bg-background border border-border">
                  {currentSubmission.content}
                </div>
              )}
              {currentSubmission.fileName && (
                <div className="text-xs font-mono text-muted-foreground">
                  File: {currentSubmission.fileName}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSubmissionType('online_text')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    submissionType === 'online_text' ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
                  }`}
                >
                  Text Entry
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionType('file')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    submissionType === 'file' ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
                  }`}
                >
                  File Upload
                </button>
              </div>

              {submissionType === 'online_text' ? (
                <textarea
                  rows={5}
                  value={textContent}
                  onChange={e => setTextContent(e.target.value)}
                  placeholder="Type or paste your assignment answer here..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">Drag and drop or select file to attach</div>
                  <input
                    type="text"
                    placeholder="Enter file name (e.g. essay.pdf)"
                    value={simulatedFileName}
                    onChange={e => setSimulatedFileName(e.target.value)}
                    className="w-64 mx-auto rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-center"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Assignment'}</span>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
