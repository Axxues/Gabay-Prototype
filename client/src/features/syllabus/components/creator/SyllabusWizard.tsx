import React, { useState, useRef } from 'react';
import type { OfficialSyllabusData } from '../../../../shared/data/syllabusData';
import { WIZARD_STEPS } from '../../types/creator';
import { Step1CourseInfo } from './steps/Step1CourseInfo';
import { Step2InstitutionalOutcomes } from './steps/Step2InstitutionalOutcomes';
import { Step3CourseOutline } from './steps/Step3CourseOutline';
import { Step4LearningPlan } from './steps/Step4LearningPlan';
import { Step5CourseMap } from './steps/Step5CourseMap';
import { Step6GradingPolicies } from './steps/Step6GradingPolicies';
import { Step7ReviewSignatories } from './steps/Step7ReviewSignatories';
import { SyllabusDocumentPreview } from './SyllabusDocumentPreview';
import type { CoInstructorAgreementItem } from './CoInstructorSubmissionPanel';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  Radio,
  AlertTriangle
} from 'lucide-react';
import type { CollaboratorInfo } from '../../hooks/useSyllabusCollaboration';
import { analyzeSectionSchedules } from '../../utils/scheduleHours';
import { getMissingStepFields } from '../../utils/stepCompletion';

interface SyllabusWizardProps {
  data?: OfficialSyllabusData;
  syllabusData?: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
  onSave?: () => void;
  onAttachCourse?: () => void;
  onAttachToCourse?: () => void;
  coInstructors?: CoInstructorAgreementItem[];
  currentUserId?: string;
  allAgreed?: boolean;
  onAgreeToSubmit?: () => void;
  onRetractAgreement?: () => void;
  isEvaluationStarted?: boolean;
  onStepChange?: (stepId: string) => void;
  presenceNotice?: string;
  collaborators?: CollaboratorInfo[];
}

export const SyllabusWizard: React.FC<SyllabusWizardProps> = ({
  data,
  syllabusData: legacySyllabusData,
  onChange,
  onAttachCourse,
  onAttachToCourse,
  coInstructors,
  currentUserId,
  allAgreed,
  onAgreeToSubmit,
  onRetractAgreement,
  isEvaluationStarted = false,
  onStepChange,
  presenceNotice,
  collaborators: _collaborators
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const footerNavRef = useRef<HTMLDivElement>(null);

  const activeData = data || legacySyllabusData!;
  const handleAttach = onAttachCourse || onAttachToCourse || (() => { });

  const currentStep = WIZARD_STEPS[currentStepIndex];

  const keepFooterInPlace = () => {
    // When the user clicks navigation at the bottom of the card, we want the footer
    // button they just clicked to remain exactly under their cursor without any jitter,
    // even if the incoming section's card height is larger or smaller.
    if (!footerNavRef.current) return;
    const initialBottom = footerNavRef.current.getBoundingClientRect().bottom;

    requestAnimationFrame(() => {
      if (!footerNavRef.current) return;
      const newBottom = footerNavRef.current.getBoundingClientRect().bottom;
      const delta = newBottom - initialBottom;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta, behavior: 'instant' });
      }
    });
  };

  const setStep = (idx: number, scrollTarget: 'top' | 'footer' | 'none' = 'top') => {
    setCurrentStepIndex(idx);
    if (onStepChange && WIZARD_STEPS[idx]) {
      onStepChange(WIZARD_STEPS[idx].id);
    }
    if (scrollTarget === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (scrollTarget === 'footer') {
      keepFooterInPlace();
    }
  };

  const setStepAtFooter = (idx: number) => {
    setStep(idx, 'footer');
  };

  const goNext = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setStep(currentStepIndex + 1, 'footer');
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setStep(currentStepIndex - 1, 'footer');
    }
  };

  const renderActiveStep = () => {
    switch (currentStep.id) {
      case 'course-info':
        return (
          <Step1CourseInfo
            data={activeData}
            onChange={onChange}
            courseCode={activeData?.courseInfo?.code}
            courseTitle={activeData?.courseInfo?.title}
          />
        );
      case 'outcomes':
        return <Step2InstitutionalOutcomes data={activeData} onChange={onChange} />;
      case 'outline':
        return <Step3CourseOutline data={activeData} onChange={onChange} />;
      case 'learning-plan':
        return <Step4LearningPlan data={activeData} onChange={onChange} />;
      case 'course-map':
        return <Step5CourseMap data={activeData} onChange={onChange} />;
      case 'grading':
        return <Step6GradingPolicies data={activeData} onChange={onChange} />;
      case 'review':
        return (
          <Step7ReviewSignatories
            data={activeData}
            onChange={onChange}
            onPrint={() => window.print()}
            onAttachCourse={handleAttach}
            coInstructors={coInstructors}
            currentUserId={currentUserId}
            allAgreed={allAgreed}
            onAgreeToSubmit={onAgreeToSubmit}
            onRetractAgreement={onRetractAgreement}
            isEvaluationStarted={isEvaluationStarted}
          />
        );
      default:
        return null;
    }
  };

  // ─── Schedule mismatch detection (shown as a warning badge on the tabs) ──
  const scheduleAnalysis = analyzeSectionSchedules(activeData?.facultyMembers, activeData?.courseInfo?.type);
  const scheduleMismatch = scheduleAnalysis.hasMismatch;

  return (
    <div className="space-y-6">
      {/* Wizard Stepper Progress Bar */}
      <div className="bg-card border border-border rounded-2xl p-3 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WIZARD_STEPS.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            // Completeness comes from the step's required inputs, never from
            // merely having scrolled past the tab.
            const missing = getMissingStepFields(step.id, activeData);
            const isComplete = missing.length === 0;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setStep(idx)}
                title={
                  isComplete
                    ? `${step.label} — all required inputs filled`
                    : `${step.label} — missing: ${missing.join(', ')}`
                }
                className={`flex items-center space-x-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${isActive
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : isComplete
                    ? 'bg-primary/10 text-primary hover:bg-primary/15'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  }`}
              >
                <div
                  data-status={isActive ? 'current' : isComplete ? 'complete' : 'incomplete'}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isActive
                    ? 'bg-white/20 text-white'
                    : isComplete
                      ? 'bg-primary text-white'
                      : step.id === 'course-info' && scheduleMismatch
                        ? 'bg-destructive/15 text-destructive border border-destructive/40'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                    }`}
                >
                  {isActive ? (
                    <span data-icon="number">{idx + 1}</span>
                  ) : isComplete ? (
                    <Check className="w-3.5 h-3.5" data-icon="check" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" data-icon="warning" />
                  )}
                </div>
                <div className="min-w-0 flex items-center gap-1.5">
                  <div className="text-[11px] truncate leading-tight">
                    {step.shortTitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area (Form on Left, Optional Live Preview on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Active Step Form Panel */}
        <div className={showPreview ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border/70">
              <div>
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                  Section {currentStepIndex + 1} of {WIZARD_STEPS.length}
                </span>
                <h3 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                  {currentStep.label}
                  {/* The warning belongs to the schedules, i.e. Section 1 only. */}
                  {currentStep.id === 'course-info' && scheduleMismatch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30 text-[11px] font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      Schedule Mismatch
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentStep.description}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {presenceNotice && (
                  <div
                    data-testid="wizard-peer-presence-chip"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold animate-pulse shadow-xs"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse text-blue-500" />
                    <span>{presenceNotice}</span>
                  </div>
                )}

                {/* Live Preview Toggle Pill */}
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${showPreview
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-background border-border text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide Document</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Document Preview</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Current Step Component */}
            <div>{renderActiveStep()}</div>

            {/* Step Navigation Controls */}
            <div ref={footerNavRef} className="flex items-center justify-between pt-6 border-t border-border/70 scroll-mt-6">
              <button
                type="button"
                onClick={goPrev}
                disabled={currentStepIndex === 0}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-border bg-card text-foreground text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-all cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Section</span>
              </button>

              {/* Footer Stepper */}
              <div className="hidden md:flex items-center gap-2 flex-1 justify-center px-4">
                {WIZARD_STEPS.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const missing = getMissingStepFields(step.id, activeData);
                  const isComplete = missing.length === 0;
                  const hasError = missing.length > 0;
                  const hasMismatch = step.id === 'course-info' && scheduleMismatch;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setStepAtFooter(idx)}
                      title={
                        isComplete
                          ? `${step.label} — all required inputs filled`
                          : hasMismatch
                            ? `${step.label} — schedule mismatch error`
                            : `${step.label} — missing: ${missing.join(', ')}`
                      }
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${isActive
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : hasMismatch
                          ? 'bg-destructive/20 text-destructive border border-destructive/40 hover:bg-destructive/30'
                          : isComplete
                            ? 'bg-primary/10 text-primary hover:bg-primary/15'
                            : hasError
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                              : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                        }`}
                    >
                      {isActive ? (
                        <span>{idx + 1}</span>
                      ) : isComplete ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={goNext}
                disabled={currentStepIndex === WIZARD_STEPS.length - 1}
                className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span>Next Section</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Live DMMMSU Official Document Preview Panel */}
        {showPreview && (
          <div className="lg:col-span-5 sticky top-6">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground">
                  Official Institutional Paper Preview
                </span>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[75vh] overflow-y-auto pr-1">
                <SyllabusDocumentPreview data={activeData} onBack={() => setShowPreview(false)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
