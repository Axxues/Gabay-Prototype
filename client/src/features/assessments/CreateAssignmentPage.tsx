import React, { useState, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { TermId } from '../../shared/types/lms';
import {
  ArrowLeft,
  FileText,
  Check,
  FileCheck2,
  Loader2
} from 'lucide-react';
import {
  ActivityFormFields,
  buildActivityPayload,
  emptyActivityFormValue,
  validateActivityForm,
  type ActivityFormValue,
  type ActivityAttachment
} from './components/forms/ActivityFormFields';
import {
  QuestionSetFields,
  emptyQuestionSetValue,
  questionSetTotals,
  validateQuestionSet,
  buildActivityPayload as buildQuestionSetPayload,
  type QuestionSetValue
} from './components/forms/QuestionSetFields';
import { uploadFileToPublic, extractDirectusFileId } from '../../shared/utils/fileUploader';
import { findMatchingSiblingCourses } from '../../shared/utils/crossSectionSync';
import { CrossSectionPromptModal } from '../../shared/components/common/CrossSectionPromptModal';

interface CreateAssignmentPageProps {
  courseId: string;
  onBack: () => void;
  onCreated: (newAssignmentId: string) => void;
}

export const CreateAssignmentPage: React.FC<CreateAssignmentPageProps> = ({
  courseId,
  onBack,
  onCreated
}) => {
  const { db, currentUser, activeUser, createActivity, showAlert, effectiveTermsForCourse, uploadCourseFile } = useLMS();
  const course = db.courses.find(c => c.id === courseId);
  const user = currentUser || activeUser;

  const siblingCourses = useMemo(() => {
    if (!course) return [];
    return findMatchingSiblingCourses(course, db.courses, user?.id);
  }, [course, db.courses, user?.id]);

  const [showCrossSectionModal, setShowCrossSectionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ kind: 'classic'; publish: boolean } | { kind: 'question_set' } | null>(null);

  const [assignmentType, setAssignmentType] = useState<'classic' | 'question_set'>('classic');
  const [form, setForm] = useState<ActivityFormValue>(() => emptyActivityFormValue());

  const assignmentTerms: TermId[] =
    typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const [builder, setBuilder] = useState<QuestionSetValue>(() => ({
    ...emptyQuestionSetValue(),
    term: assignmentTerms[0] ?? 'midterm'
  }));

  const [savingAction, setSavingAction] = useState<'publish' | 'draft' | null>(null);

  const executeSaveClassic = async (targetCourseIds: string[], publish: boolean) => {
    setSavingAction(publish ? 'publish' : 'draft');
    try {
      let formToSave = form;
      const rawFilesToProcess = (form.attachedFiles && form.attachedFiles.length > 0)
        ? form.attachedFiles
        : form.attachedFile
          ? [form.attachedFile]
          : [];

      if (rawFilesToProcess.length > 0) {
        const processedAttachments: ActivityAttachment[] = [];
        for (const att of rawFilesToProcess) {
          if (att.rawFile) {
            let url = '';
            let name = att.name;
            let size = att.size;
            let fileId = att.fileId;
            let directus_files_id = att.directus_files_id;
            try {
              const saved = await uploadCourseFile({
                courseId,
                name: att.name,
                rawFile: att.rawFile,
                size: att.rawFile.size,
                formattedSize: size,
                area: 'assignments',
                visibility: 'published',
                silent: true
              });
              url = saved.fileUrl || saved.url || '';
              name = saved.name || name;
              if (saved.formattedSize && saved.formattedSize !== '0 B') {
                size = saved.formattedSize;
              }
              directus_files_id = (saved as any).directus_files_id || (saved as any).file || extractDirectusFileId(url) || undefined;
              fileId = directus_files_id || (saved as any).fileId || saved.id;

              if (targetCourseIds.length > 1) {
                for (const siblingId of targetCourseIds) {
                  if (siblingId !== courseId) {
                    try {
                      await uploadCourseFile({
                        courseId: siblingId,
                        name: saved.name || att.name,
                        fileUrl: saved.fileUrl || saved.url,
                        url: saved.url || saved.fileUrl,
                        formattedSize: size,
                        type: saved.type || 'document',
                        area: 'assignments',
                        visibility: 'published',
                        silent: true
                      });
                    } catch {}
                  }
                }
              }
            } catch {
              url = '';
            }
            if (!url || url.startsWith('data:')) {
              const viaVite = await uploadFileToPublic(att.rawFile);
              if (!viaVite.url.startsWith('data:')) {
                url = viaVite.url;
                name = viaVite.name;
                size = viaVite.size;
              }
            }
            processedAttachments.push({
              id: att.id,
              name,
              size,
              url,
              type: att.type,
              fileId,
              directus_files_id
            });
          } else {
            const resolvedDirectusId = att.directus_files_id || extractDirectusFileId(att.url) || undefined;
            processedAttachments.push({
              ...att,
              directus_files_id: resolvedDirectusId,
            });
          }
        }
        formToSave = {
          ...form,
          attachedFile: processedAttachments[0] || null,
          attachedFiles: processedAttachments
        };
      }

      let firstCreatedId = '';
      for (let i = 0; i < targetCourseIds.length; i++) {
        const targetId = targetCourseIds[i];
        const basePayload = buildActivityPayload(targetId, formToSave, publish);
        const payload = {
          ...basePayload,
          assessmentType: 'assignment' as const,
          category: 'Assignments',
        };
        const created = await createActivity(payload);
        if (i === 0) {
          firstCreatedId = created.id;
        }
      }

      showAlert({
        title: publish ? 'Assignment Published' : 'Assignment Draft Saved',
        message: `"${form.title.trim()}" has been created successfully for ${course?.code || 'this course'}.` +
          (targetCourseIds.length > 1 ? ` (Replicated to ${targetCourseIds.length} sections)` : ''),
        type: 'success'
      });

      if (firstCreatedId) {
        onCreated(firstCreatedId);
      }
    } finally {
      setSavingAction(null);
    }
  };

  const handleSaveClassic = async (publish: boolean) => {
    if (savingAction) return;
    const validationError = validateActivityForm(form, 'assignment');
    if (validationError) {
      showAlert({
        title: validationError.title,
        message: validationError.message,
        type: 'warning'
      });
      return;
    }

    if (siblingCourses.length > 0) {
      setPendingAction({ kind: 'classic', publish });
      setShowCrossSectionModal(true);
      return;
    }

    await executeSaveClassic([courseId], publish);
  };

  const executeSaveQuestionSet = async (targetCourseIds: string[]) => {
    const { totalPoints, gradableCount } = questionSetTotals(builder);

    setSavingAction('publish');
    try {
      let firstCreatedId = '';
      for (let i = 0; i < targetCourseIds.length; i++) {
        const targetId = targetCourseIds[i];
        const basePayload = buildQuestionSetPayload(targetId, builder);
        const payload = {
          ...basePayload,
          assessmentType: 'assignment' as const,
          category: 'Assignments',
        };
        const created = await createActivity(payload);
        if (i === 0) {
          firstCreatedId = created.id;
        }
      }

      showAlert({
        title: 'Assignment Published',
        message: `"${builder.title.trim()}" created with ${gradableCount} question(s), totaling ${totalPoints} pts.` +
          (targetCourseIds.length > 1 ? ` (Replicated to ${targetCourseIds.length} sections)` : ''),
        type: 'success'
      });

      if (firstCreatedId) {
        onCreated(firstCreatedId);
      }
    } finally {
      setSavingAction(null);
    }
  };

  const handleSaveQuestionSet = async () => {
    if (savingAction) return;
    const error = validateQuestionSet(builder);
    if (error) {
      showAlert({
        title: error.title,
        message: error.message,
        type: 'warning'
      });
      return;
    }

    if (siblingCourses.length > 0) {
      setPendingAction({ kind: 'question_set' });
      setShowCrossSectionModal(true);
      return;
    }

    await executeSaveQuestionSet([courseId]);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pt-4 sm:pt-6 pb-20 px-1 font-sans">
      {/* Top Breadcrumb & Navigation */}
      <div className="pb-6 border-b border-border/70">
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground font-sans">
            <button
              type="button"
              onClick={onBack}
              className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1.5 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Assignments</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold truncate max-w-[240px]">
              {course?.code || 'Course'}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-muted-foreground font-semibold px-2.5 py-0.5 rounded-full bg-muted border border-border text-[11px]">
              New assignment
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <span>Create Assignment</span>
              </h1>
              <p className="text-[13px] text-muted-foreground pl-0.5">
                Define homework milestones, problem sets, or written essays for {course?.code || 'this course'}.
              </p>
            </div>

            {/* Quick action buttons on top (classic mode only) */}
            {assignmentType === 'classic' && (
              <div className="flex items-center space-x-2.5 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveClassic(false)}
                  disabled={savingAction !== null}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center space-x-1.5"
                >
                  {savingAction === 'draft' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingAction === 'draft' ? 'Saving…' : 'Save draft'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveClassic(true)}
                  disabled={savingAction !== null}
                  className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-98 flex items-center space-x-1.5 disabled:opacity-60 disabled:cursor-wait"
                >
                  {savingAction === 'publish'
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Check className="w-3.5 h-3.5" />}
                  <span>{savingAction === 'publish' ? 'Publishing…' : 'Publish'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assignment type chooser: Classic vs Question Set */}
      <div className="p-1 w-full bg-muted/60 border border-border rounded-2xl grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setAssignmentType('classic')}
          className={`p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-2 ${
            assignmentType === 'classic'
              ? 'bg-primary/[0.04] text-foreground border border-primary/30 ring-1 ring-primary/15'
              : 'text-muted-foreground border border-border/70 hover:bg-muted/40'
          }`}
        >
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span>Classic assignment</span>
        </button>
        <button
          type="button"
          onClick={() => setAssignmentType('question_set')}
          className={`p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center space-x-2 ${
            assignmentType === 'question_set'
              ? 'bg-primary/[0.04] text-foreground border border-primary/30 ring-1 ring-primary/15'
              : 'text-muted-foreground border border-border/70 hover:bg-muted/40'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-muted-foreground" />
          <span>New question set</span>
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground font-medium -mt-4">
        {assignmentType === 'classic'
          ? 'File upload / text entry assignment with rubric and deadlines.'
          : 'Quiz-style question set (Multiple Choice, Identification, True/False, Essay) auto-scored on submit.'}
      </p>

      {assignmentType === 'question_set' ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSaveQuestionSet();
          }}
          className="space-y-6 text-xs"
        >
          <QuestionSetFields value={builder} onChange={setBuilder} courseId={courseId} />

          {/* Bottom Submission Bar */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/70">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer w-full sm:w-auto"
            >
              Discard & return to assignments
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="submit"
                disabled={savingAction !== null}
                className="flex-1 sm:flex-initial px-6 py-2.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-98 flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-wait"
              >
                {savingAction === 'publish'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Check className="w-4 h-4" />}
                <span>{savingAction === 'publish' ? 'Publishing…' : 'Publish Assignment'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSaveClassic(true);
          }}
          className="space-y-6 text-xs"
        >
          <ActivityFormFields
            courseId={courseId}
            value={form}
            onChange={setForm}
            titlePlaceholder="e.g. Assignment 1: Distributed Systems Analysis"
            instructionsPlaceholder="Enter assignment instructions, guidelines, and submission requirements..."
            titleLabel="Assignment title"
            sectionTitle="Assignment information"
          />

          {/* Bottom Submission Bar */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/70">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer w-full sm:w-auto"
            >
              Discard & return to assignments
            </button>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleSaveClassic(false)}
                disabled={savingAction !== null}
                className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer active:scale-98 disabled:opacity-60 disabled:cursor-wait flex items-center justify-center space-x-2"
              >
                {savingAction === 'draft' && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{savingAction === 'draft' ? 'Saving…' : 'Save as unpublished draft'}</span>
              </button>
              <button
                type="submit"
                disabled={savingAction !== null}
                className="flex-1 sm:flex-initial px-6 py-2.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-98 flex items-center justify-center space-x-2 disabled:opacity-60 disabled:cursor-wait"
              >
                {savingAction === 'publish'
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Check className="w-4 h-4" />}
                <span>{savingAction === 'publish' ? 'Publishing…' : 'Publish Assignment'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      <CrossSectionPromptModal
        isOpen={showCrossSectionModal}
        onClose={() => {
          setShowCrossSectionModal(false);
          setPendingAction(null);
        }}
        itemType="assessment"
        itemTitle={form.title.trim() || builder.title.trim() || 'Assignment'}
        siblingCourses={siblingCourses}
        onConfirm={async (selectedIds) => {
          setShowCrossSectionModal(false);
          const targets = [courseId, ...selectedIds];
          if (pendingAction?.kind === 'classic') {
            await executeSaveClassic(targets, pendingAction.publish);
          } else if (pendingAction?.kind === 'question_set') {
            await executeSaveQuestionSet(targets);
          }
        }}
        onSkipToCurrentOnly={async () => {
          setShowCrossSectionModal(false);
          const targets = [courseId];
          if (pendingAction?.kind === 'classic') {
            await executeSaveClassic(targets, pendingAction.publish);
          } else if (pendingAction?.kind === 'question_set') {
            await executeSaveQuestionSet(targets);
          }
        }}
        isSubmitting={savingAction !== null}
      />
    </div>
  );
};
