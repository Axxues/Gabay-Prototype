import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import type { TermId, RubricCriterion } from '../types/lms';
import { ArrowLeft, MonitorPlay, Check, Plus, Trash2, Clock, Presentation, Video, FileText } from 'lucide-react';
import { TermFilterSelect } from '../components/common/TermSelect';

interface CreatePresentationPageProps {
  courseId: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}

export const CreatePresentationPage: React.FC<CreatePresentationPageProps> = ({
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
  const [pointsPossible, setPointsPossible] = useState(100);
  const [dueDate, setDueDate] = useState('');
  const [presentationMode, setPresentationMode] = useState<'in_person' | 'recorded' | 'slide_only'>('in_person');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [slideDeckRequired, setSlideDeckRequired] = useState(true);
  const [rubrics, setRubrics] = useState<RubricCriterion[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCriterion = () => {
    setRubrics(prev => [
      ...prev,
      {
        id: `rubric-${Date.now()}`,
        title: 'Delivery & Communication',
        description: 'Clarity of speaking, timing, audience engagement, slide quality',
        points: 25,
        ratings: [
          { points: 25, description: 'Outstanding delivery and poise' },
          { points: 15, description: 'Competent delivery with minor pacing issues' },
        ],
      },
    ]);
  };

  const handleRemoveCriterion = (id: string) => {
    setRubrics(prev => prev.filter(r => r.id !== id));
  };

  const handleSave = async (published: boolean) => {
    if (!title.trim()) {
      showAlert('Please enter a presentation title.');
      return;
    }
    if (!instructions.trim()) {
      showAlert('Enter presentation guidelines.');
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
        assessmentType: 'presentation',
        metadata: {
          presentationMode,
          durationMinutes: Number(durationMinutes) || 15,
          slideDeckRequired,
        },
        submissionTypes: ['online_url', 'file'],
        rubric: rubrics,
      };

      const created = await createActivity(payload);
      showAlert({
        title: published ? 'Presentation Published' : 'Draft Saved',
        message: `"${title.trim()}" presentation has been created successfully.`,
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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            title="Back to Presentations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MonitorPlay className="w-6 h-6 text-indigo-500" />
              Create Presentation
            </h1>
            <p className="text-sm text-muted-foreground">
              {course ? `${course.code} - ${course.title}` : 'Course Assessment'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors disabled:opacity-50 font-medium text-sm"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 font-medium text-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Publish Presentation
          </button>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">
            Presentation Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Oral Defense or Group Research Presentation"
            className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-base"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Grading Term
            </label>
            <TermFilterSelect
              value={term}
              onChange={val => setTerm(val as TermId)}
              options={effectiveTerms.map(t => ({
                id: t,
                label: t.charAt(0).toUpperCase() + t.slice(1),
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Total Points
            </label>
            <input
              type="number"
              min={1}
              value={pointsPossible}
              onChange={e => setPointsPossible(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Due Date & Time
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-1.5">
            Instructions & Guidelines <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={5}
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Enter presentation guidelines, speaking schedule, required sections, and rubric criteria..."
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm resize-y"
          />
        </div>
      </div>

      {/* Presentation Format & Settings Card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-foreground mb-1">
            Presentation Format & Delivery
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure how students will deliver and submit this presentation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setPresentationMode('in_person')}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
              presentationMode === 'in_person'
                ? 'border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium'
                : 'border-border hover:border-border/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Presentation className="w-6 h-6 mb-2" />
            <span className="text-sm">In-Person Oral</span>
            <span className="text-[11px] opacity-75 mt-0.5">Live classroom or defense</span>
          </button>

          <button
            type="button"
            onClick={() => setPresentationMode('recorded')}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
              presentationMode === 'recorded'
                ? 'border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium'
                : 'border-border hover:border-border/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            <Video className="w-6 h-6 mb-2" />
            <span className="text-sm">Recorded Video</span>
            <span className="text-[11px] opacity-75 mt-0.5">Async Loom, YouTube, drive</span>
          </button>

          <button
            type="button"
            onClick={() => setPresentationMode('slide_only')}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all ${
              presentationMode === 'slide_only'
                ? 'border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-medium'
                : 'border-border hover:border-border/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-6 h-6 mb-2" />
            <span className="text-sm">Slide Deck Only</span>
            <span className="text-[11px] opacity-75 mt-0.5">Presentation slides file/link</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-500" />
              Allocated Duration (Minutes)
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={durationMinutes}
              onChange={e => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 15))}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div className="flex items-center pt-6">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={slideDeckRequired}
                onChange={e => setSlideDeckRequired(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-border"
              />
              <div>
                <span className="text-sm font-medium text-foreground block">
                  Require Slide Deck Submission
                </span>
                <span className="text-xs text-muted-foreground block">
                  Students must attach slide link (Google Slides/Canva) or file (PPTX/PDF)
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Rubric Card */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Scoring Rubrics</h2>
            <p className="text-xs text-muted-foreground">
              Define evaluation criteria for presentation delivery, content, and visual aids.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddCriterion}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Criterion
          </button>
        </div>

        {rubrics.length === 0 ? (
          <div className="p-4 border border-dashed border-border rounded-lg text-center text-xs text-muted-foreground">
            No rubrics added yet. Click &quot;Add Criterion&quot; to build a custom rubric for this presentation.
          </div>
        ) : (
          <div className="space-y-3">
            {rubrics.map((r, idx) => (
              <div key={r.id || idx} className="p-4 bg-muted/40 rounded-lg border border-border flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{r.title}</span>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{r.points} pts</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCriterion(r.id)}
                  className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-accent transition-colors"
                  title="Remove criterion"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
