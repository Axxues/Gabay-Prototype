import React, { useState, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import type { TermId } from '../../shared/types/lms';
import {
  ArrowLeft,
  Briefcase,
  Check,
  Loader2,
} from 'lucide-react';
import { findMatchingSiblingCourses } from '../../shared/utils/crossSectionSync';
import { CrossSectionPromptModal } from '../../shared/components/common/CrossSectionPromptModal';
import {
  ProjectFormFields,
  emptyProjectFormValue,
  validateProjectForm,
  buildProjectPayload,
  type ProjectFormValue,
} from './components/forms/ProjectFormFields';

interface CreateProjectPageProps {
  courseId: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}

export const CreateProjectPage: React.FC<CreateProjectPageProps> = ({
  courseId,
  onBack,
  onCreated,
}) => {
  const { db, currentUser, activeUser, createActivity, showAlert, effectiveTermsForCourse } = useLMS();
  const course = db.courses.find(c => c.id === courseId);
  const user = currentUser || activeUser;

  const effectiveTerms: TermId[] =
    typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const siblingCourses = useMemo(() => {
    if (!course) return [];
    return findMatchingSiblingCourses(course, db.courses || [], user?.id);
  }, [course, db.courses, user?.id]);

  const [form, setForm] = useState<ProjectFormValue>(() => emptyProjectFormValue(effectiveTerms[0]));
  const [savingAction, setSavingAction] = useState<'publish' | 'draft' | null>(null);
  const [showCrossSectionModal, setShowCrossSectionModal] = useState(false);
  const [pendingPublish, setPendingPublish] = useState(true);

  const executeSave = async (targetCourseIds: string[], published: boolean) => {
    setSavingAction(published ? 'publish' : 'draft');
    try {
      let firstCreatedId = 'new';
      for (const targetId of targetCourseIds) {
        const payload = buildProjectPayload(targetId, form, published);
        const created = await createActivity(payload);
        if (targetId === courseId && created?.id) {
          firstCreatedId = created.id;
        }
      }

      showAlert({
        title: published ? 'Project Published' : 'Project Draft Saved',
        message: targetCourseIds.length > 1
          ? `"${form.title.trim()}" published across ${targetCourseIds.length} sections successfully.`
          : `"${form.title.trim()}" has been created successfully for ${course?.code || 'this course'}.`,
        type: 'success',
      });
      onCreated(firstCreatedId);
    } finally {
      setSavingAction(null);
    }
  };

  const handleSave = async (published: boolean) => {
    if (savingAction) return;
    const err = validateProjectForm(form);
    if (err) {
      showAlert({
        title: err.title,
        message: err.message,
        type: 'warning',
      });
      return;
    }

    if (siblingCourses.length > 0) {
      setPendingPublish(published);
      setShowCrossSectionModal(true);
      return;
    }

    await executeSave([courseId], published);
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
              <span>Projects</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold truncate max-w-[240px]">
              {course?.code || 'Course'}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-muted-foreground font-semibold px-2.5 py-0.5 rounded-full bg-muted border border-border text-[11px]">
              New project
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <span>Create Project</span>
              </h1>
              <p className="text-[13px] text-muted-foreground pl-0.5">
                Configure team capstones, technical deliverables, and software milestones for {course?.code || 'this course'}.
              </p>
            </div>

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
                onClick={() => handleSave(false)}
                disabled={savingAction !== null}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center space-x-1.5"
              >
                {savingAction === 'draft' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingAction === 'draft' ? 'Saving…' : 'Save draft'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={savingAction !== null}
                className="px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-98 flex items-center space-x-1.5 disabled:opacity-60 disabled:cursor-wait"
              >
                {savingAction === 'publish'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Check className="w-3.5 h-3.5" />}
                <span>{savingAction === 'publish' ? 'Publishing…' : 'Publish Project'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          handleSave(true);
        }}
        className="space-y-6 text-xs"
      >
        <ProjectFormFields
          courseId={courseId}
          value={form}
          onChange={setForm}
        />

        {/* Bottom Submission Bar */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/70">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer w-full sm:w-auto"
          >
            Discard & return to projects
          </button>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleSave(false)}
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
              <span>{savingAction === 'publish' ? 'Publishing…' : 'Publish Project'}</span>
            </button>
          </div>
        </div>
      </form>

      <CrossSectionPromptModal
        isOpen={showCrossSectionModal}
        onClose={() => setShowCrossSectionModal(false)}
        itemType="assessment"
        itemTitle={form.title.trim() || 'Project'}
        siblingCourses={siblingCourses}
        onConfirm={async (selectedIds) => {
          setShowCrossSectionModal(false);
          await executeSave([courseId, ...selectedIds], pendingPublish);
        }}
        onSkipToCurrentOnly={async () => {
          setShowCrossSectionModal(false);
          await executeSave([courseId], pendingPublish);
        }}
        isSubmitting={savingAction !== null}
      />
    </div>
  );
};
