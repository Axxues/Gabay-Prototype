import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
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
  ArrowLeft
} from 'lucide-react';
import { CreateAssignmentPage } from './CreateAssignmentPage';
import { ActivitiesView } from './ActivitiesView';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';

interface AssignmentsViewProps {
  courseId: string;
  selectedAssignmentId: string | null;
  onSelectAssignment: (asgId: string | null) => void;
  onBackToModules?: () => void;
}

export const AssignmentsView: React.FC<AssignmentsViewProps> = ({
  courseId,
  selectedAssignmentId,
  onSelectAssignment,
  onBackToModules
}) => {
  const {
    activeRole,
    activeUser,
    db,
    submitAssignment,
    deleteAssignment,
    openSpeedGrader,
    showAlert,
    showConfirm
  } = useLMS();

  const courseAssignments = db.assignments.filter(a => a.courseId === courseId);
  const selectedAssignment = db.assignments.find(a => a.id === selectedAssignmentId);

  // Student submission form state
  const [submissionType, setSubmissionType] = useState<'file' | 'online_text'>('online_text');
  const [textContent, setTextContent] = useState('');
  const [simulatedFileName, setSimulatedFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Full Page Create Assignment State
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);

  // Selected question-set activity (null = list mode embedded below)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const currentSubmission = selectedAssignment
    ? db.submissions.find(s => s.assignmentId === selectedAssignment.id && s.studentId === activeUser.id)
    : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    if (submissionType === 'online_text' && !textContent.trim()) {
      showAlert("Please enter submission text content.");
      return;
    }
    if (submissionType === 'file' && !simulatedFileName) {
      showAlert("Please choose a file or use the simulated file dropzone.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      submitAssignment(
        selectedAssignment.id,
        submissionType,
        textContent,
        simulatedFileName || 'CMSC131_Lab_Submission.pdf'
      );
      setIsSubmitting(false);
      showAlert({
        title: "Activity Submitted",
        message: "Your submission has been recorded successfully.",
        type: "success"
      });
    }, 600);
  };

  const handleDelete = (asgId: string) => {
    showConfirm(
      "Are you sure you want to delete this activity and all associated student submissions?",
      () => {
        deleteAssignment(asgId);
        onSelectAssignment(null);
      },
      "Delete Activity"
    );
  };

  // If user clicked create assignment, render dedicated full page
  if (isCreatingAssignment) {
    return (
      <CreateAssignmentPage
        courseId={courseId}
        onBack={() => setIsCreatingAssignment(false)}
        onAssignmentCreated={asgId => {
          setIsCreatingAssignment(false);
          onSelectAssignment(asgId);
        }}
      />
    );
  }

  // If a question-set activity is selected, render its runner instead of the assignment list
  if (selectedActivityId && !selectedAssignment) {
    return (
      <ActivitiesView
        courseId={courseId}
        activityId={selectedActivityId}
        onSelectActivity={setSelectedActivityId}
        onBackToModules={onBackToModules}
      />
    );
  }

  // If no assignment selected, render assignment list
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
          title="Activities"
          description="Course activities and laboratory tasks."
          actions={
            activeRole === 'faculty' && (
              <button
                onClick={() => setIsCreatingAssignment(true)}
                className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Activity</span>
              </button>
            )
          }
        />

        <div className="space-y-3">
          {courseAssignments.length === 0 ? (
            <EmptyState
              title="No activities published for this course yet."
            />
          ) : (
            courseAssignments.map(asg => {
              const studentSub = db.submissions.find(
                s => s.assignmentId === asg.id && s.studentId === activeUser.id
              );

              return (
                <div
                  key={asg.id}
                  onClick={() => onSelectAssignment(asg.id)}
                  className="group p-4 bg-card border border-border rounded-xl hover:border-primary/40 cursor-pointer card-hover shadow-soft transition-all flex items-center justify-between"
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="p-2.5 bg-muted rounded-xl text-primary shrink-0 mt-0.5 border border-border">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                        {asg.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1 font-sans">
                        <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold text-foreground">
                          {asg.category}
                        </span>
                        <span>•</span>
                        <span>Due: {new Date(asg.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span className="font-bold text-foreground">{asg.pointsPossible} pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    {studentSub ? (
                      studentSub.status === 'graded' ? (
                        <span className="px-2.5 py-1 text-xs font-sans font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-500/20 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Graded: {studentSub.grade}/{asg.pointsPossible}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-sans font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-500/20 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Submitted</span>
                        </span>
                      )
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-sans font-bold bg-muted text-muted-foreground rounded-lg border border-border">
                        Not Submitted
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Question Sets section (Task 5) — classic assignment rendering above is untouched */}
        <ActivitiesView
          courseId={courseId}
          activityId={null}
          onSelectActivity={setSelectedActivityId}
          onBackToModules={onBackToModules}
        />
      </div>
    );
  }

  // Render Detailed Assignment & Submission Workspace
  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (onBackToModules) {
              onBackToModules();
            } else {
              onSelectAssignment(null);
            }
          }}
          className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{onBackToModules ? 'Back to Modules' : 'Back to Activities List'}</span>
        </button>

        {activeRole === 'faculty' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                const sub = db.submissions.find(s => s.assignmentId === selectedAssignment.id);
                if (sub) openSpeedGrader(sub.id);
                else showAlert("No student submissions yet for this activity.");
              }}
              className="px-3 py-1.5 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-colors cursor-pointer"
            >
              Inspect in SpeedGrader
            </button>
            <button
              onClick={() => handleDelete(selectedAssignment.id)}
              className="p-1.5 text-red-600 hover:bg-red-500/10 rounded-xl border border-red-500/20 transition-colors cursor-pointer"
              title="Delete Activity"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Assignment Header Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-subtle space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-[10px] font-sans font-bold uppercase bg-primary/10 text-primary rounded-md border border-primary/20">
                {selectedAssignment.category}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground mt-2">
              {selectedAssignment.title}
            </h1>
          </div>

          <div className="text-right">
            <div className="text-2xl font-extrabold font-sans text-foreground">
              {selectedAssignment.pointsPossible}
            </div>
            <div className="text-[10px] font-sans text-muted-foreground uppercase">Points Possible</div>
          </div>
        </div>

        {/* Due Date & Submission Type */}
        <div className="flex flex-wrap gap-4 py-3 border-y border-border text-xs font-sans text-muted-foreground">
          <div>
            <span className="font-bold text-foreground">Due Date: </span>
            <span>{new Date(selectedAssignment.dueDate).toLocaleString()}</span>
          </div>
          <div>
            <span className="font-bold text-foreground">Submissions Allowed: </span>
            <span>File Upload, Text Entry</span>
          </div>
          <div>
            <span className="font-bold text-foreground">Available to: </span>
            <span>All Enrolled Students</span>
          </div>
        </div>

        {/* Assignment Instructions */}
        <div className="text-xs text-foreground/90 leading-relaxed space-y-3">
          <h4 className="font-bold uppercase tracking-wider text-[11px] text-foreground">
            Assessment Guidelines & Objectives
          </h4>
          <p className="whitespace-pre-line">{selectedAssignment.instructions}</p>
        </div>

        {/* Rubric Criteria Summary */}
        <div className="pt-4 border-t border-border space-y-3">
          <h4 className="font-bold uppercase tracking-wider text-[11px] text-foreground flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            <span>CHED OBE Evaluation Rubric Matrix</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedAssignment.rubric.map(criterion => (
              <div key={criterion.id} className="p-3.5 bg-muted/40 rounded-xl border border-border space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-foreground text-xs">{criterion.title}</span>
                  <span className="font-sans text-primary font-bold text-xs">{criterion.points} pts</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{criterion.description}</p>
                <div className="flex gap-1.5 pt-1">
                  {criterion.ratings.map(r => (
                    <div key={r.points} className="p-1.5 bg-card border border-border rounded-lg text-[10px] font-sans flex-1 text-center">
                      <div className="font-bold text-foreground">{r.points} pts</div>
                      <div className="text-muted-foreground truncate">{r.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
                  Evaluated: {currentSubmission.grade} / {selectedAssignment.pointsPossible} pts
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

            {submissionType === 'online_text' ? (
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
            ) : (
              <div className="space-y-2">
                <label className="block font-bold text-foreground">
                  File Attachment Dropzone:
                </label>
                <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center space-y-2 bg-muted/20">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-foreground font-semibold">
                    Simulate file upload for GABAY evaluation
                  </p>
                  <input
                    type="text"
                    value={simulatedFileName}
                    onChange={e => setSimulatedFileName(e.target.value)}
                    placeholder="e.g. CMSC131_Lab4_JayveeReyes_2021-SLUC-0492.pdf"
                    className="max-w-md mx-auto p-2.5 border border-border rounded-xl font-sans text-center w-full bg-background text-xs outline-none"
                  />
                  <div className="text-[10px] text-muted-foreground font-sans">
                    Allowed types: PDF, DOCX, ZIP (Max 25MB)
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{currentSubmission ? 'Resubmit Activity' : 'Submit Activity to GABAY'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
