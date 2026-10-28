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
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';

interface SyllabusWizardProps {
  syllabusData: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
  onAttachCourse: () => void;
}

export const SyllabusWizard: React.FC<SyllabusWizardProps> = ({
  syllabusData,
  onChange,
  onAttachCourse
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

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
        return <Step1CourseInfo data={syllabusData} onChange={onChange} />;
      case 'outcomes':
        return <Step2InstitutionalOutcomes data={syllabusData} onChange={onChange} />;
      case 'outline':
        return <Step3CourseOutline data={syllabusData} onChange={onChange} />;
      case 'learning-plan':
        return <Step4LearningPlan data={syllabusData} onChange={onChange} />;
      case 'course-map':
        return <Step5CourseMap data={syllabusData} onChange={onChange} />;
      case 'grading':
        return <Step6GradingPolicies data={syllabusData} onChange={onChange} />;
      case 'review':
        return (
          <Step7ReviewSignatories
            data={syllabusData}
            onChange={onChange}
            onPrint={() => window.print()}
            onAttachCourse={onAttachCourse}
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
        <div className={showPreview ? 'lg:col-span-6 space-y-6' : 'lg:col-span-12 space-y-6'}>
          {/* Active Step Container */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            {renderActiveStep()}
          </div>

          {/* Stepper Navigation Actions */}
          <div className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl shadow-xs">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={goPrev}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-muted/60 hover:bg-muted text-foreground transition-all cursor-pointer"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>{showPreview ? 'Hide Preview' : 'Document Preview'}</span>
            </button>

            {currentStepIndex < WIZARD_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <span>Next Step</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onAttachCourse}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Finish & Attach to Course</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Document Preview Panel */}
        {showPreview && (
          <div className="lg:col-span-6 sticky top-6">
            <SyllabusDocumentPreview syllabus={syllabusData} />
          </div>
        )}
      </div>
    </div>
  );
};
