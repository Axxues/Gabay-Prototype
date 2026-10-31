import React from 'react';
import type { OfficialSyllabusData } from '../../../../../shared/data/syllabusData';
import { CoInstructorSubmissionPanel, type CoInstructorAgreementItem } from '../CoInstructorSubmissionPanel';

interface Step7ReviewSignatoriesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
  onPrint: () => void;
  onAttachCourse: () => void;
  coInstructors?: CoInstructorAgreementItem[];
  currentUserId?: string;
  allAgreed?: boolean;
  onAgreeToSubmit?: () => void;
  onRetractAgreement?: () => void;
  isEvaluationStarted?: boolean;
}

export const Step7ReviewSignatories: React.FC<Step7ReviewSignatoriesProps> = ({
  coInstructors,
  currentUserId,
  allAgreed = false,
  onAgreeToSubmit,
  onRetractAgreement,
  isEvaluationStarted = false
}) => {
  return (
    <>
      {/* Multi-Instructor Submission Consensus Panel */}
      {coInstructors && coInstructors.length > 0 && onAgreeToSubmit && (
        <CoInstructorSubmissionPanel
          currentUserId={currentUserId}
          instructors={coInstructors}
          allAgreed={allAgreed}
          onAgreeToSubmit={onAgreeToSubmit}
          onRetractAgreement={onRetractAgreement}
          isEvaluationStarted={isEvaluationStarted}
        />
      )}
    </>
  );
};
