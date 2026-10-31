import React, { useState, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { TermId } from '../../shared/types/lms';
import { normalizeTermId } from '../../shared/utils/gradingTerms';
import { TERM_LABELS, TermFilterSelect } from '../../shared/components/common/TermSelect';
import { buildAssessmentSourceIndex } from '../../shared/utils/assessmentSource';
import { sortAssessmentsLatestFirst } from './utils/assessmentSorting';
import {
  Presentation,
  Clock,
  CheckCircle2,
  Upload,
  Award,
  Send,
  Plus,
  Trash2,
  ArrowLeft,
  Calendar,
  Link as LinkIcon,
  Video,
  Monitor,
  Users,
  Paperclip,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { EmptyState } from '../../shared/components/common/EmptyState';
import { CreatePresentationPage } from './CreatePresentationPage';
import { canManageCourseContent } from '../../shared/utils/roles';
import { AssessmentFilePreviewModal, type AssessmentPreviewAttachment } from './components/AssessmentFilePreviewModal';
import { RubricViewer } from './components/RubricViewer';
import { uploadFileToPublic, formatFileSize, isFileTooLarge } from '../../shared/utils/fileUploader';
import type { SubmissionAttachment } from '../../shared/types/lms';
import { emitRealtimeChange } from '../realtime';

export const isSubmissionForPresentation = (s: any, presId: string): boolean => {
  if (!s || !presId) return false;
  return (
    s.activityId === presId ||
    s.activityKey === presId ||
    s.activityKey === `asg-activity-${presId}` ||
    s.presentationId === presId ||
    s.presentation_id === presId
  );
};

interface PresentationsViewProps {
  courseId: string;
  selectedPresentationId: string | null;
  onSelectPresentation: (id: string | null) => void;
  onBackToModules?: () => void;
}

export const PresentationsView: React.FC<PresentationsViewProps> = ({
  courseId,
  selectedPresentationId,
  onSelectPresentation,
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
  const [slideUrl, setSlideUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AssessmentPreviewAttachment | null>(null);

  const addFiles = (files: File[]) => {
    const valid: File[] = [];
    for (const f of files) {
      if (isFileTooLarge(f.size)) {
        showAlert(`File "${f.name}" exceeds the maximum upload limit of 25MB.`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length > 0) {
      setSelectedFiles(prev => [...prev, ...valid]);
    }
  };

  const currentCourse = (db.courses || []).find(c => c.id === courseId);
  const isAssignedInstructor = canManageCourseContent(currentCourse, activeUser);

  const effectiveTerms: TermId[] =
    courseId && typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const coursePresentations = (db.activities || []).filter(
    a => a.courseId === courseId && a.assessmentType === 'presentation'
  );

  const sourceIndex = useMemo(
    () => buildAssessmentSourceIndex((db as any).modules, courseId),
    [(db as any).modules, courseId]
  );

  const visiblePresentations = useMemo(() => {
    return sortAssessmentsLatestFirst(
      coursePresentations.filter(a => {
        if (activeRole === 'student' && !a.published) return false;
        if (termFilter !== 'all' && (normalizeTermId(a.term) ?? 'midterm') !== termFilter) return false;
        return true;
      }),
      sourceIndex
    );
  }, [coursePresentations, activeRole, termFilter, sourceIndex]);

  const selectedPresentation = selectedPresentationId
    ? coursePresentations.find(a => a.id === selectedPresentationId)
    : null;

  const currentSubmission = selectedPresentation
    ? (db.submissions || []).find(
        s => isSubmissionForPresentation(s, selectedPresentation.id) && s.studentId === activeUser.id
      )
    : undefined;

  const submissionFiles: SubmissionAttachment[] =
    currentSubmission?.attachments && currentSubmission.attachments.length > 0
      ? currentSubmission.attachments
      : currentSubmission?.fileName
        ? [{ name: currentSubmission.fileName, url: currentSubmission.fileUrl }]
        : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPresentation) return;

    if (selectedPresentation.metadata?.slideDeckRequired && !slideUrl.trim() && selectedFiles.length === 0) {
      showAlert('Slide deck URL or slide file upload is required.');
      return;
    }

    const compiledContent = [
      slideUrl.trim() ? `Slide Deck URL: ${slideUrl.trim()}` : null,
      textContent.trim() ? `Speaker Notes:\n${textContent.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!compiledContent && selectedFiles.length === 0) {
      showAlert('Please enter slide link, speaker notes, or attach slide deck/handout files.');
      return;
    }

    setIsSubmitting(true);
    try {
      const attachments: SubmissionAttachment[] = [];
      if (selectedFiles.length > 0) {
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
        selectedPresentation.id,
        attachments.length > 0 ? 'file' : 'online_text',
        compiledContent,
        primary?.name ?? 'Presentation_Slides.pdf',
        undefined,
        primary?.url,
        primary?.id,
        primary?.size,
        attachments.length > 0 ? attachments : undefined
      );
      showAlert({
        title: 'Presentation Materials Submitted',
        message: 'Your presentation materials have been submitted successfully.',
        type: 'success',
      });
      setSelectedFiles([]);
      emitRealtimeChange({
        collection: 'submissions',
        path: '/items/submissions',
        courseIds: [courseId],
        parentIds: {
          activity_id: [selectedPresentation.id],
          presentation_id: [selectedPresentation.id],
        },
      });
    } catch {
      // Handled in submitActivity
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!isAssignedInstructor) return;
    showConfirm(
      'Are you sure you want to delete this presentation and all associated student submissions?',
      () => {
        deleteActivity(id)
          .then(() => onSelectPresentation(null))
          .catch(() => {});
      },
      'Delete Presentation'
    );
  };

  const getModeLabel = (mode?: string) => {
    switch (mode) {
      case 'in_person':
        return { label: 'In-Person', icon: <Monitor className="h-3 w-3" /> };
      case 'recorded':
        return { label: 'Video Recording', icon: <Video className="h-3 w-3" /> };
      case 'slide_only':
        return { label: 'Slide Deck', icon: <Presentation className="h-3 w-3" /> };
      default:
        return { label: 'In-Person', icon: <Monitor className="h-3 w-3" /> };
    }
  };

  if (isCreating && isAssignedInstructor) {
    return (
      <CreatePresentationPage
        courseId={courseId}
        onBack={() => setIsCreating(false)}
        onCreated={id => {
          setIsCreating(false);
          onSelectPresentation(id);
        }}
      />
    );
  }

  // List view
  if (!selectedPresentation) {
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
          title="Presentations"
          description="Oral defenses, technical pitches, and seminar slide presentations"
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
                  <span>Create Presentation</span>
                </button>
              )}
            </div>
          }
        />

        {visiblePresentations.length === 0 ? (
          <EmptyState
            icon={<Presentation className="h-8 w-8 text-muted-foreground" />}
            title="No presentations found"
            body={
              activeRole === 'student'
                ? 'No presentations scheduled yet.'
                : 'Click "Create Presentation" to schedule a presentation or defense.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {visiblePresentations.map(pres => {
              const mySub = (db.submissions || []).find(
                s => isSubmissionForPresentation(s, pres.id) && s.studentId === activeUser.id
              );
              const subs = (db.submissions || []).filter(
                s => isSubmissionForPresentation(s, pres.id)
              );
              const pendingGradeCount = subs.filter(s => s.status === 'submitted').length;
              const mode = getModeLabel(pres.metadata?.presentationMode);
              const normTerm = normalizeTermId(pres.term);

              return (
                <div
                  key={pres.id}
                  onClick={() => onSelectPresentation(pres.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-xl border border-border bg-rose-500/10 p-2.5 text-rose-600 dark:text-rose-400 mt-0.5">
                      <Presentation className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                          {normTerm ? TERM_LABELS[normTerm] : (pres.term || 'Midterm')}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 flex items-center gap-1">
                          {mode.icon}
                          {mode.label}
                        </span>
                        {pres.metadata?.durationMinutes && (
                          <span className="text-[10px] font-bold text-muted-foreground px-1.5 py-0.5 rounded bg-accent">
                            {pres.metadata.durationMinutes} min
                          </span>
                        )}
                        {!pres.published && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                            Draft
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold truncate">{pres.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Award className="h-3 w-3" />
                          {pres.pointsPossible} pts
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {pres.dueDate
                            ? `Due ${new Date(pres.dueDate).toLocaleDateString()}`
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
                          {mySub.status === 'graded' ? `Graded: ${mySub.grade ?? 0}/${pres.pointsPossible}` : 'Materials Submitted'}
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

  const mode = getModeLabel(selectedPresentation.metadata?.presentationMode);

  // Detail & Submission View
  return (
    <div className="space-y-6 w-full animate-fade-in">
      <button
        type="button"
        onClick={() => onSelectPresentation(null)}
        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Presentations</span>
      </button>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                {normalizeTermId(selectedPresentation.term) ? TERM_LABELS[normalizeTermId(selectedPresentation.term)!] : (selectedPresentation.term || 'Midterm')}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 flex items-center gap-1">
                {mode.icon}
                {mode.label}
              </span>
              {selectedPresentation.metadata?.durationMinutes && (
                <span className="text-xs text-muted-foreground font-semibold">
                  {selectedPresentation.metadata.durationMinutes} minutes presentation
                </span>
              )}
              <span className="text-xs text-muted-foreground font-semibold">
                • {selectedPresentation.pointsPossible} Points
              </span>
            </div>
            <h1 className="text-xl font-extrabold">{selectedPresentation.title}</h1>
          </div>

          {activeRole !== 'student' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const subs = (db.submissions || []).filter(
                    s => isSubmissionForPresentation(s, selectedPresentation.id)
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
                  onClick={() => handleDelete(selectedPresentation.id)}
                  className="p-1.5 rounded-xl text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none pt-2 border-t border-border">
          <p className="whitespace-pre-line text-sm text-foreground/90">{selectedPresentation.instructions}</p>
        </div>

        {/* Attached Starter Handouts / Reference Files */}
        {(() => {
          const attachments = (selectedPresentation.attachments && selectedPresentation.attachments.length > 0)
            ? selectedPresentation.attachments
            : selectedPresentation.fileName
              ? [{ name: selectedPresentation.fileName, size: selectedPresentation.fileSize || '', url: selectedPresentation.fileUrl, type: 'file' }]
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

        <RubricViewer
          rubric={selectedPresentation.rubric}
          title="Presentation Rubrics"
        />
      </div>

      {/* Student Submission Card */}
      {activeRole === 'student' && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            {currentSubmission ? 'Your Presentation Materials' : 'Submit Presentation Materials'}
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
                    Grade: {currentSubmission.grade}/{selectedPresentation.pointsPossible}
                  </span>
                )}
              </div>
              {currentSubmission.content && (
                <div className="text-xs text-foreground/90 whitespace-pre-wrap p-3 rounded-lg bg-background border border-border">
                  {currentSubmission.content}
                </div>
              )}
              {submissionFiles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Attached Slide & Handout Files ({submissionFiles.length})
                  </div>
                  {submissionFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="text-xs font-mono text-muted-foreground flex items-center justify-between p-2 rounded-lg bg-background border border-border"
                    >
                      <span className="truncate">{file.name}</span>
                      {file.url && (
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewAttachment({
                              name: file.name || 'Presentation Slides',
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
                            download={file.name}
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
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <LinkIcon className="h-3.5 w-3.5" />
                    Slide Deck URL (Google Slides / Canva / Pitch)
                  </label>
                  <input
                    type="url"
                    placeholder="https://docs.google.com/presentation/d/..."
                    value={slideUrl}
                    onChange={e => setSlideUrl(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">
                    Speaker Notes & Outline (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    placeholder="Add presentation notes or talking points for the evaluators..."
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5" />
                    Upload Slide Deck / Handout Files (Optional)
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
                    className={`rounded-xl border border-dashed p-5 text-center space-y-3 transition-colors ${
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
                              <FileText className="w-5 h-5 text-primary shrink-0" />
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
                                onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
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
                        <Upload className="h-7 w-7 mx-auto text-muted-foreground" />
                        <div className="text-xs text-muted-foreground">
                          <label className="font-semibold text-primary hover:underline cursor-pointer">
                            <span>Attach slide deck or handout files</span>
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
                        <div className="text-[11px] text-muted-foreground">
                          Supported: PDF, PPTX, KEY, images, ZIPs (up to 25MB each)
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 cursor-pointer disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Presentation Materials'}</span>
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
