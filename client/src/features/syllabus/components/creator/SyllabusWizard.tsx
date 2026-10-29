import React, { useState } from 'react';
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
  Check
} from 'lucide-react';

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
  onAgreeToSubmit
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const activeData = data || legacySyllabusData!;
  const handleAttach = onAttachCourse || onAttachToCourse || (() => {});

  const currentStep = WIZARD_STEPS[currentStepIndex];

  const goNext = () => {
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const renderActiveStep = () => {
    switch (currentStep.id) {
      case 'course-info':
        return <Step1CourseInfo data={activeData} onChange={onChange} />;
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
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Wizard Stepper Progress Bar */}
      <div className="bg-card border border-border rounded-2xl p-3 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WIZARD_STEPS.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            const isCompleted = idx < currentStepIndex;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`flex items-center space-x-2.5 p-2 rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                    : isCompleted
                    ? 'bg-primary/10 text-primary hover:bg-primary/15'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isCompleted
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <div className="min-w-0">
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
                  Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
                </span>
                <h3 className="text-xl font-black text-foreground tracking-tight">
                  {currentStep.label}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentStep.description}
                </p>
              </div>

              {/* Live Preview Toggle Pill */}
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  showPreview
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

            {/* Current Step Component */}
            <div className="min-h-[420px]">{renderActiveStep()}</div>

            {/* Step Navigation Controls */}
            <div className="flex items-center justify-between pt-6 border-t border-border/70">
              <button
                type="button"
                onClick={goPrev}
                disabled={currentStepIndex === 0}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-border bg-card text-foreground text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-all cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>

              <button
                type="button"
                onClick={goNext}
                disabled={currentStepIndex === WIZARD_STEPS.length - 1}
                className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span>Next Step</span>
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
