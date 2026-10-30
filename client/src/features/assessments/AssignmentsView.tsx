import React, { useState, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { TermId, SubmissionAttachment } from '../../shared/types/lms';
import { normalizeTermId } from '../../shared/utils/gradingTerms';
import { TERM_LABELS, TermFilterSelect } from '../../shared/components/common/TermSelect';
import { buildAssessmentSourceIndex } from '../../shared/utils/assessmentSource';
import { sortAssessmentsLatestFirst } from './utils/assessmentSorting';
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
  Users,
  Paperclip,
  Download,
  Eye,
  Image as ImageIcon,
  X,
  Loader2
} from 'lucide-react';
import { uploadFileToPublic, formatFileSize } from '../../shared/utils/fileUploader';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { EmptyState } from '../../shared/components/common/EmptyState';
import { CreateAssignmentPage } from './CreateAssignmentPage';
import { ActivityRunnerView } from './ActivityRunnerView';
import { canManageCourseContent } from '../../shared/utils/roles';
import { AssessmentFilePreviewModal, type AssessmentPreviewAttachment } from './components/AssessmentFilePreviewModal';

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
  const [isCreating, setIsCreating] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AssessmentPreviewAttachment | null>(null);

  const currentCourse = (db.courses || []).find(c => c.id === courseId);
  const isAssignedInstructor = canManageCourseContent(currentCourse, activeUser);

  const effectiveTerms: TermId[] =
    courseId && typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const courseAssignments = (db.activities || []).filter(
    a => a.courseId === courseId && a.assessmentType === 'assignment'
  );

  const sourceIndex = useMemo(
    () => buildAssessmentSourceIndex((db as any).modules, courseId),
    [(db as any).modules, courseId]
  );

  const visibleAssignments = useMemo(() => {
    return sortAssessmentsLatestFirst(
      courseAssignments.filter(a => {
        if (activeRole === 'student' && !a.published) return false;
        if (termFilter !== 'all' && (normalizeTermId(a.term) ?? 'midterm') !== termFilter) return false;
        return true;
      }),
      sourceIndex
    );
  }, [courseAssignments, activeRole, termFilter, sourceIndex]);

  const selectedAssignment = selectedAssignmentId
    ? courseAssignments.find(a => a.id === selectedAssignmentId)
    : null;

  const currentSubmission = selectedAssignment
    ? (db.submissions || []).find(
        s => (s.activityId === selectedAssignment.id || s.activityKey === selectedAssignment.id) && s.studentId === activeUser.id
      )
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
    if (!selectedAssignment) return;

    if (submissionType === 'online_text' && !textContent.trim()) {
      showAlert('Please enter your assignment response text.');
      return;
    }
    if (submissionType === 'file' && selectedFiles.length === 0) {
      showAlert('Please choose at least one file to attach.');
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
        selectedAssignment.id,
        submissionType,
        textContent,
        primary?.name ?? 'Assignment_Submission.pdf',
        undefined,
        primary?.url,
        primary?.id,
        primary?.size,
        attachments.length > 0 ? attachments : undefined
      );
      showAlert({
        title: 'Assignment Submitted',
        message: 'Your assignment has been submitted successfully.',
        type: 'success',
      });
      setSelectedFiles([]);
    } catch {
      // Handled in submitActivity
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!isAssignedInstructor) return;
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

  if (isCreating && isAssignedInstructor) {
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
          eyebrow="COURSE ASSESSMENTS"
          title="Assignments"
          description="Course assignments, homework, and formal submissions"
          actions={
            <div className="flex items-center gap-2">
              <TermFilterSelect
                terms={effectiveTerms}
                value={termFilter}
                onChange={v => setTermFilter(v as 'all' | TermId)}
              />
              {isAssignedInstructor && (
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-xl shadow-sm hover:opacity-95 transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Assignment</span>
                </button>
              )}
            </div>
          }
        />

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
              const normTerm = normalizeTermId(assignment.term);

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
                          {normTerm ? TERM_LABELS[normTerm] : (assignment.term || 'Midterm')}
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

  if (selectedAssignment && selectedAssignment.format !== 'classic') {
    return (
      <ActivityRunnerView
        courseId={courseId}
        activityId={selectedAssignment.id}
        onSelectActivity={onSelectAssignment}
        onBackToModules={onBackToModules}
      />
    );
  }

  // Detail & Submission View
  return (
    <div className="space-y-6 w-full animate-fade-in">
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
                {normalizeTermId(selectedAssignment.term) ? TERM_LABELS[normalizeTermId(selectedAssignment.term)!] : (selectedAssignment.term || 'Midterm')}
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
              {isAssignedInstructor && (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedAssignment.id)}
                  className="p-1.5 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none pt-2 border-t border-border">
          <p className="whitespace-pre-line text-sm text-foreground/90">{selectedAssignment.instructions}</p>
        </div>

        {/* Attached Starter Handouts / Reference Files */}
        {(() => {
          const attachments = (selectedAssignment.attachments && selectedAssignment.attachments.length > 0)
            ? selectedAssignment.attachments
            : selectedAssignment.fileName
              ? [{ name: selectedAssignment.fileName, size: selectedAssignment.fileSize || '', url: selectedAssignment.fileUrl, type: 'file' }]
              : [];
          if (attachments.length === 0) return null;

          return (
            <div className="pt-3 border-t border-border space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                <span>Reference & Starter Files ({attachments.length})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((att, idx) => {
                  const isImg = att.name ? /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(att.name) : false;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-muted/20 hover:bg-muted/30 border border-border/70 rounded-xl flex items-center justify-between gap-3 transition-colors"
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
                        <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
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
                          className="px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted/70 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 border border-border"
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
                            className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 border border-primary/20"
                            title={`Download ${att.name}`}
                          >
                            <Download className="w-3 h-3" />
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
              {submissionFiles.length > 0 && (
                <div className="space-y-1.5">
                  {submissionFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="text-xs font-mono text-muted-foreground flex items-center justify-between"
                    >
                      <span className="truncate">File: {file.name}</span>
                      {file.url && (
                        <div className="flex items-center space-x-1.5 shrink-0">
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
                        </div>
                      )}
                    </div>
                  ))}
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
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    const dropped = Array.from(e.dataTransfer.files || []);
                    if (dropped.length) addFiles(dropped);
                  }}
                  className={`rounded-xl border border-dashed p-6 text-center space-y-3 transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  {selectedFiles.length > 0 ? (
                    <div className="mx-auto max-w-md space-y-2">
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
                      <label className="block text-center text-[11px] font-semibold text-primary hover:underline cursor-pointer">
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
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <div className="text-xs text-muted-foreground">
                        <label className="font-semibold text-primary hover:underline cursor-pointer">
                          <span>Browse files to attach</span>
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
                        <span> or drag and drop here</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>{isSubmitting ? 'Uploading & Submitting...' : 'Submit Assignment'}</span>
              </button>
            </form>
          )}
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
