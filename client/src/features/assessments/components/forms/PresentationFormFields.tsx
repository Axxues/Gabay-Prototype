import React from 'react';
import type { Activity, RubricCriterion, TermId } from '../../../../shared/types/lms';
import { TermSelect } from '../../../../shared/components/common/TermSelect';
import { NumericInput } from '../../../../shared/components/common/NumericInput';
import {
  GradingRubricSection,
  blankRubricCriterion,
  validateRubric,
} from './ActivityFormFields';
import { Presentation, Video, FileText, Clock, Calendar } from 'lucide-react';
import { useLMS } from '../../../../shared/context/LMSContext';

export interface PresentationFormValue {
  title: string;
  instructions: string;
  term?: TermId;
  pointsPossible: number;
  dueDate: string;
  availableFrom: string;
  availableUntil: string;
  presentationMode: 'in_person' | 'recorded' | 'slide_only';
  durationMinutes: number;
  slideDeckRequired: boolean;
  includeRubric: boolean;
  rubric: RubricCriterion[];
}

export function emptyPresentationFormValue(defaultTerm?: TermId): PresentationFormValue {
  const d = new Date(Date.now() + 10 * 86400000);
  d.setHours(23, 59, 0, 0);
  return {
    title: '',
    instructions: 'Prepare your presentation slides and delivery notes. Present your topic during the allocated session time.',
    term: defaultTerm || 'midterm',
    pointsPossible: 100,
    dueDate: d.toISOString().slice(0, 16),
    availableFrom: new Date().toISOString().slice(0, 16),
    availableUntil: '',
    presentationMode: 'in_person',
    durationMinutes: 15,
    slideDeckRequired: true,
    includeRubric: false,
    rubric: []
  };
}

export function presentationToForm(
  a: Activity,
  fallbackTitle: string = '',
  fallbackInstructions: string = ''
): PresentationFormValue {
  const meta = a.metadata || {};
  const hasRubric = Array.isArray(a.rubric) && a.rubric.length > 0;
  return {
    title: a.title || fallbackTitle,
    instructions: a.instructions || fallbackInstructions,
    term: a.term,
    pointsPossible: Number(a.pointsPossible) || 100,
    dueDate: a.dueDate ? a.dueDate.slice(0, 16) : new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 16),
    availableFrom: a.availableFrom ? a.availableFrom.slice(0, 16) : '',
    availableUntil: a.availableUntil ? a.availableUntil.slice(0, 16) : '',
    presentationMode: meta.presentationMode || 'in_person',
    durationMinutes: Number(meta.durationMinutes) || 15,
    slideDeckRequired: meta.slideDeckRequired !== false,
    includeRubric: hasRubric,
    rubric: hasRubric ? a.rubric! : []
  };
}

export function validatePresentationForm(v: PresentationFormValue): { title: string; message: string } | null {
  if (!v.title.trim()) {
    return { title: 'Missing Title', message: 'Please enter a presentation title before saving.' };
  }
  if (!v.instructions.trim()) {
    return { title: 'Guidelines Required', message: 'Please enter presentation guidelines and instructions.' };
  }
  if (v.includeRubric) {
    const rubricErr = validateRubric(v.rubric, v.pointsPossible);
    if (rubricErr) return rubricErr;
  }
  return null;
}

export function buildPresentationPayload(courseId: string, v: PresentationFormValue, published: boolean = true): Partial<Activity> {
  return {
    courseId,
    title: v.title.trim(),
    instructions: v.instructions.trim(),
    term: v.term,
    pointsPossible: Number(v.pointsPossible) || 100,
    dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : new Date().toISOString(),
    availableFrom: v.availableFrom ? new Date(v.availableFrom).toISOString() : undefined,
    availableUntil: v.availableUntil ? new Date(v.availableUntil).toISOString() : undefined,
    published,
    format: 'classic',
    assessmentType: 'presentation',
    category: 'Presentations',
    metadata: {
      presentationMode: v.presentationMode,
      durationMinutes: Number(v.durationMinutes) || 15,
      slideDeckRequired: v.slideDeckRequired,
    },
    submissionTypes: ['online_url', 'file'],
    rubric: v.includeRubric ? v.rubric : [],
  };
}

export const PresentationFormFields: React.FC<{
  courseId: string;
  value: PresentationFormValue;
  onChange: (v: PresentationFormValue) => void;
  titlePlaceholder?: string;
}> = ({
  courseId,
  value,
  onChange,
  titlePlaceholder = 'e.g. Oral Defense or Group Research Presentation'
}) => {
  const { effectiveTermsForCourse } = useLMS();
  const effectiveTerms: TermId[] =
    typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const safeTerm = value.term && effectiveTerms.includes(value.term) ? value.term : (effectiveTerms[0] ?? 'midterm');

  return (
    <div className="space-y-6 text-xs">
      {/* Section 1: Presentation Information */}
      <div className="p-5 sm:p-6 bg-card border border-border rounded-2xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border/70">
          <div className="w-6 h-6 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-[11px] tabular-nums">
            1
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold tracking-tight text-foreground">Presentation details & schedule</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Title, grading term, and evaluation guidelines</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Presentation title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={value.title}
              onChange={e => onChange({ ...value, title: e.target.value })}
              placeholder={titlePlaceholder}
              className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-[13px] outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Grading term
              </label>
              <TermSelect
                terms={effectiveTerms}
                value={safeTerm}
                onChange={t => onChange({ ...value, term: t })}
                id="presentation-term-select"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Total points
              </label>
              <div className="relative">
                <NumericInput
                  min={1}
                  value={value.pointsPossible}
                  onChange={num => onChange({ ...value, pointsPossible: num })}
                  className="w-full pl-3.5 pr-11 py-2 bg-background border border-border rounded-xl text-foreground text-[13px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground font-medium">
                  pts
                </span>
              </div>
            </div>
          </div>

          {/* Schedule Deadlines */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="min-w-0">
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Due date</span> <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={value.dueDate}
                onChange={e => onChange({ ...value, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-[12.5px] tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer transition-all"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Available from</span>
              </label>
              <input
                type="datetime-local"
                value={value.availableFrom}
                onChange={e => onChange({ ...value, availableFrom: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-[12.5px] tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer transition-all"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Until</span>
              </label>
              <input
                type="datetime-local"
                value={value.availableUntil}
                onChange={e => onChange({ ...value, availableUntil: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-foreground text-[12.5px] tabular-nums outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 cursor-pointer transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Instructions & presentation guidelines <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={6}
              required
              value={value.instructions}
              onChange={e => onChange({ ...value, instructions: e.target.value })}
              placeholder="Enter presentation guidelines, speaking schedule, required sections, and rubric criteria..."
              className="w-full p-3.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-[13px] leading-relaxed outline-none resize-y transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Format & Duration */}
      <div className="p-5 sm:p-6 bg-card border border-border rounded-2xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border/70">
          <div className="w-6 h-6 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-[11px] tabular-nums">
            2
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold tracking-tight text-foreground">Presentation format & delivery</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Configure how students deliver and submit this presentation</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-2">
              Delivery mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, presentationMode: 'in_person' })}
                className={`p-3.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  value.presentationMode === 'in_person'
                    ? 'bg-primary/[0.04] text-foreground border-primary/30 ring-1 ring-primary/15'
                    : 'text-muted-foreground border-border/70 hover:bg-muted/40'
                }`}
              >
                <Presentation className="w-5 h-5 mb-1.5 text-primary" />
                <span className="text-xs font-bold text-foreground">In-Person Oral</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Live classroom or defense</span>
              </button>

              <button
                type="button"
                onClick={() => onChange({ ...value, presentationMode: 'recorded' })}
                className={`p-3.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  value.presentationMode === 'recorded'
                    ? 'bg-primary/[0.04] text-foreground border-primary/30 ring-1 ring-primary/15'
                    : 'text-muted-foreground border-border/70 hover:bg-muted/40'
                }`}
              >
                <Video className="w-5 h-5 mb-1.5 text-indigo-500" />
                <span className="text-xs font-bold text-foreground">Recorded Video</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Async Loom, YouTube, drive</span>
              </button>

              <button
                type="button"
                onClick={() => onChange({ ...value, presentationMode: 'slide_only' })}
                className={`p-3.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                  value.presentationMode === 'slide_only'
                    ? 'bg-primary/[0.04] text-foreground border-primary/30 ring-1 ring-primary/15'
                    : 'text-muted-foreground border-border/70 hover:bg-muted/40'
                }`}
              >
                <FileText className="w-5 h-5 mb-1.5 text-amber-500" />
                <span className="text-xs font-bold text-foreground">Slide Deck Only</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">Presentation slides file or link</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/70">
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Allocated duration (minutes)</span>
              </label>
              <NumericInput
                min={1}
                max={180}
                value={value.durationMinutes}
                onChange={num => onChange({ ...value, durationMinutes: num })}
                className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-[13px] outline-none transition-all"
              />
            </div>

            <div className="flex items-center pt-5 sm:pt-6">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={value.slideDeckRequired}
                  onChange={e => onChange({ ...value, slideDeckRequired: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                />
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Require slide deck submission
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Students must attach slide link (Google Slides/Canva) or PPTX/PDF file
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Evaluation Rubrics */}
      <GradingRubricSection
        stepNumber={3}
        includeRubric={value.includeRubric}
        onToggleIncludeRubric={checked => {
          onChange({
            ...value,
            includeRubric: checked,
            rubric: checked && value.rubric.length === 0 ? [blankRubricCriterion()] : value.rubric
          });
        }}
        rubric={value.rubric}
        onChangeRubric={nextRubric => onChange({ ...value, rubric: nextRubric })}
        pointsPossible={value.pointsPossible}
        entityLabel="Presentation"
      />
    </div>
  );
};
