import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import type { TermId, RubricCriterion } from '../types/lms';
import { ArrowLeft, FileText, Check, Plus, Trash2 } from 'lucide-react';
import { TermFilterSelect } from '../components/common/TermSelect';

interface CreateAssignmentPageProps {
  courseId: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}

export const CreateAssignmentPage: React.FC<CreateAssignmentPageProps> = ({
  courseId,
  onBack,
  onCreated,
}) => {
  const { db, createActivity, showAlert, effectiveTermsForCourse } = useLMS();
  const course = db.courses.find(c => c.id === courseId);

  const effectiveTerms: TermId[] =
    typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [term, setTerm] = useState<TermId>(effectiveTerms[0] || 'midterm');
  const [pointsPossible, setPointsPossible] = useState(50);
  const [dueDate, setDueDate] = useState('');
  const [rubrics, setRubrics] = useState<RubricCriterion[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCriterion = () => {
    setRubrics(prev => [
      ...prev,
      {
        id: `rubric-${Date.now()}`,
        title: 'Content Quality',
        description: 'Depth of analysis and thoroughness',
        points: 10,
        ratings: [
          { points: 10, description: 'Excellent' },
          { points: 5, description: 'Adequate' },
        ],
      },
    ]);
  };

  const handleRemoveCriterion = (id: string) => {
    setRubrics(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = async (published: boolean) => {
    if (!title.trim()) {
      showAlert('Please enter an assignment title.');
      return;
    }
    if (!instructions.trim()) {
      showAlert('Please enter assignment instructions.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        courseId,
        title: title.trim(),
        instructions: instructions.trim(),
        term,
        pointsPossible: Number(pointsPossible) || 0,
        dueDate: dueDate ? new Date(dueDate).toISOString() : new Date().toISOString(),
        published,
        format: 'classic',
        assessmentType: 'assignment',
        submissionTypes: ['online_text', 'file'],
        rubric: rubrics,
      };

      const created = await createActivity(payload);
      showAlert({
        title: published ? 'Assignment Published' : 'Draft Saved',
        message: `"${title.trim()}" has been created successfully.`,
        type: 'success',
      });
      onCreated(created?.id || 'new');
    } catch {
      // Handled in context
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Cancel & Back</span>
      </button>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="rounded-xl border border-border bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold">Create Assignment</h1>
            <p className="text-xs text-muted-foreground">
              Define homework, problem sets, or written essays for {course?.code || 'this course'}.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">Assignment Title *</label>
            <input
              type="text"
              placeholder="e.g. Assignment 1: Distributed Systems Analysis"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1.5">Grading Term</label>
              <TermFilterSelect
                terms={effectiveTerms}
                value={term}
                onChange={v => setTerm(v as TermId)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5">Points Possible</label>
              <input
                type="number"
                min={1}
                value={pointsPossible}
                onChange={e => setPointsPossible(Number(e.target.value))}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5">Due Date</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">Instructions & Prompt *</label>
            <textarea
              rows={5}
              placeholder="Enter assignment instructions, guidelines, and submission requirements..."
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Rubrics Builder */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold">Grading Rubric</h3>
                <p className="text-[11px] text-muted-foreground">Add criteria to evaluate submissions in SpeedGrader</p>
              </div>
              <button
                type="button"
                onClick={handleAddCriterion}
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Criterion</span>
              </button>
            </div>

            {rubrics.map(r => (
              <div key={r.id} className="rounded-xl border border-border p-3 space-y-2 bg-accent/20">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={r.title}
                    onChange={e =>
                      setRubrics(prev => prev.map(item => (item.id === r.id ? { ...item, title: e.target.value } : item)))
                    }
                    className="font-bold text-xs bg-transparent border-b border-border/60 focus:outline-none w-1/2"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={r.points}
                      onChange={e =>
                        setRubrics(prev =>
                          prev.map(item => (item.id === r.id ? { ...item, points: Number(e.target.value) } : item))
                        )
                      }
                      className="w-16 rounded border border-border bg-background px-2 py-0.5 text-xs text-right"
                    />
                    <span className="text-xs text-muted-foreground">pts</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCriterion(r.id)}
                      className="text-destructive hover:bg-destructive/10 p-1 rounded cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Criterion description..."
                  value={r.description}
                  onChange={e =>
                    setRubrics(prev =>
                      prev.map(item => (item.id === r.id ? { ...item, description: e.target.value } : item))
                    )
                  }
                  className="w-full text-[11px] text-muted-foreground bg-transparent border-b border-border/40 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-accent cursor-pointer disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-95 cursor-pointer disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Publish Assignment</span>
          </button>
        </div>
      </div>
    </div>
  );
};
