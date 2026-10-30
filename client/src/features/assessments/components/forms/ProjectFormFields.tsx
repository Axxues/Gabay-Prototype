import React from 'react';
import type { Activity, RubricCriterion, TermId } from '../../../../shared/types/lms';
import { TermSelect } from '../../../../shared/components/common/TermSelect';
import { NumericInput } from '../../../../shared/components/common/NumericInput';
import {
  GradingRubricSection,
  blankRubricCriterion,
  validateRubric,
} from './ActivityFormFields';
import { User, Users, Code, Globe, Clock, Calendar } from 'lucide-react';
import { useLMS } from '../../../../shared/context/LMSContext';

export interface ProjectFormValue {
  title: string;
  instructions: string;
  term?: TermId;
  pointsPossible: number;
  dueDate: string;
  availableFrom: string;
  availableUntil: string;
  groupMode: 'individual' | 'group';
  maxGroupSize: number;
  repoRequired: boolean;
  demoRequired: boolean;
  includeRubric: boolean;
  rubric: RubricCriterion[];
}

export function emptyProjectFormValue(defaultTerm?: TermId): ProjectFormValue {
  const d = new Date(Date.now() + 14 * 86400000);
  d.setHours(23, 59, 0, 0);
  return {
    title: '',
    instructions: 'Review the project brief, collaborate with your team if applicable, and submit your project deliverables before the deadline.',
    term: defaultTerm || 'midterm',
    pointsPossible: 100,
    dueDate: d.toISOString().slice(0, 16),
    availableFrom: new Date().toISOString().slice(0, 16),
    availableUntil: '',
    groupMode: 'individual',
    maxGroupSize: 4,
    repoRequired: true,
    demoRequired: false,
    includeRubric: false,
    rubric: []
  };
}

export function projectToForm(
  a: Activity,
  fallbackTitle: string = '',
  fallbackInstructions: string = ''
): ProjectFormValue {
  const meta = a.metadata || {};
  const hasRubric = Array.isArray(a.rubric) && a.rubric.length > 0;
  return {
    title: a.title || fallbackTitle,
    instructions: a.instructions || fallbackInstructions,
    term: a.term,
    pointsPossible: Number(a.pointsPossible) || 100,
    dueDate: a.dueDate ? a.dueDate.slice(0, 16) : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16),
    availableFrom: a.availableFrom ? a.availableFrom.slice(0, 16) : '',
    availableUntil: a.availableUntil ? a.availableUntil.slice(0, 16) : '',
    groupMode: meta.groupMode === 'group' ? 'group' : 'individual',
    maxGroupSize: Number(meta.maxGroupSize) || 4,
    repoRequired: meta.repositoryUrlRequired !== false,
    demoRequired: Boolean(meta.liveDemoUrlRequired),
    includeRubric: hasRubric,
    rubric: hasRubric ? a.rubric! : []
  };
}

export function validateProjectForm(v: ProjectFormValue): { title: string; message: string } | null {
  if (!v.title.trim()) {
    return { title: 'Missing Title', message: 'Please enter a project title before saving.' };
  }
  if (!v.instructions.trim()) {
    return { title: 'Instructions Required', message: 'Please enter project instructions and milestones.' };
  }
  if (v.includeRubric) {
    const rubricErr = validateRubric(v.rubric, v.pointsPossible);
    if (rubricErr) return rubricErr;
  }
  return null;
}

export function buildProjectPayload(courseId: string, v: ProjectFormValue, published: boolean = true): Partial<Activity> {
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
    assessmentType: 'project',
    category: 'Projects',
    metadata: {
      groupMode: v.groupMode,
      maxGroupSize: v.groupMode === 'group' ? Number(v.maxGroupSize) : 1,
      repositoryUrlRequired: v.repoRequired,
      liveDemoUrlRequired: v.demoRequired,
    },
    submissionTypes: ['online_text', 'file'],
    rubric: v.includeRubric ? v.rubric : [],
  };
}

export const ProjectFormFields: React.FC<{
  courseId: string;
  value: ProjectFormValue;
  onChange: (v: ProjectFormValue) => void;
  titlePlaceholder?: string;
}> = ({
  courseId,
  value,
  onChange,
  titlePlaceholder = 'e.g. Capstone Phase 1: Architecture & API Prototype'
}) => {
  const { effectiveTermsForCourse } = useLMS();
  const effectiveTerms: TermId[] =
    typeof effectiveTermsForCourse === 'function'
      ? effectiveTermsForCourse(courseId)
      : ['prelim', 'midterm', 'finals'];

  const safeTerm = value.term && effectiveTerms.includes(value.term) ? value.term : (effectiveTerms[0] ?? 'midterm');

  return (
    <div className="space-y-6 text-xs">
      {/* Section 1: Project Information */}
      <div className="p-5 sm:p-6 bg-card border border-border rounded-2xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border/70">
          <div className="w-6 h-6 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-[11px] tabular-nums">
            1
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold tracking-tight text-foreground">Project details & schedule</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Title, grading term, and milestones</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Project title <span className="text-red-500">*</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Grading term
              </label>
              <TermSelect
                terms={effectiveTerms}
                value={safeTerm}
                onChange={t => onChange({ ...value, term: t })}
                id="project-term-select"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                Points possible
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
              Project instructions & deliverable milestones <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={6}
              required
              value={value.instructions}
              onChange={e => onChange({ ...value, instructions: e.target.value })}
              placeholder="Enter project instructions, deliverable requirements, and technical specifications..."
              className="w-full p-3.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-[13px] leading-relaxed outline-none resize-y transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Collaboration & Submission Requirements */}
      <div className="p-5 sm:p-6 bg-card border border-border rounded-2xl space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-border/70">
          <div className="w-6 h-6 rounded-lg bg-muted border border-border text-muted-foreground flex items-center justify-center font-bold text-[11px] tabular-nums">
            2
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold tracking-tight text-foreground">Collaboration & submission mode</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Individual vs group settings and required repository/demo links</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-muted-foreground mb-2">
              Project collaboration mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, groupMode: 'individual' })}
                className={`p-3.5 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all cursor-pointer ${
                  value.groupMode === 'individual'
                    ? 'bg-primary/[0.04] text-foreground border-primary/30 ring-1 ring-primary/15'
                    : 'text-muted-foreground border-border/70 hover:bg-muted/40'
                }`}
              >
                <User className="h-4 w-4" />
                <span>Individual Project</span>
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, groupMode: 'group' })}
                className={`p-3.5 rounded-xl border flex items-center justify-center space-x-2 text-xs font-bold transition-all cursor-pointer ${
                  value.groupMode === 'group'
                    ? 'bg-primary/[0.04] text-foreground border-primary/30 ring-1 ring-primary/15'
                    : 'text-muted-foreground border-border/70 hover:bg-muted/40'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Group Project</span>
              </button>
            </div>

            {value.groupMode === 'group' && (
              <div className="mt-3 p-3.5 bg-muted/30 border border-border rounded-xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground">Max Members per Team</span>
                  <p className="text-[11px] text-muted-foreground">Limit the number of student contributors per group submission</p>
                </div>
                <NumericInput
                  min={2}
                  max={15}
                  value={value.maxGroupSize}
                  onChange={num => onChange({ ...value, maxGroupSize: num })}
                  className="w-20 px-2.5 py-1.5 text-center text-xs font-bold bg-background border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border/70 space-y-2">
            <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
              Technical Submission Requirements
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className={`px-3.5 py-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                value.repoRequired
                  ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/15'
                  : 'border-border/70 hover:bg-muted/40'
              }`}>
                <input
                  type="checkbox"
                  checked={value.repoRequired}
                  onChange={e => onChange({ ...value, repoRequired: e.target.checked })}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
                />
                <div>
                  <div className="flex items-center space-x-1.5 font-semibold text-[12px] text-foreground">
                    <Code className="h-3.5 w-3.5 text-primary" />
                    <span>Git Repository URL</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Require GitHub, GitLab, or Bitbucket source URL</p>
                </div>
              </label>

              <label className={`px-3.5 py-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                value.demoRequired
                  ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/15'
                  : 'border-border/70 hover:bg-muted/40'
              }`}>
                <input
                  type="checkbox"
                  checked={value.demoRequired}
                  onChange={e => onChange({ ...value, demoRequired: e.target.checked })}
                  className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
                />
                <div>
                  <div className="flex items-center space-x-1.5 font-semibold text-[12px] text-foreground">
                    <Globe className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Live Demo URL</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Require working web preview or deployed application</p>
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
        entityLabel="Project"
      />
    </div>
  );
};
