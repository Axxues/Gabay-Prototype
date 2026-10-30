import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';

export const SYLLABUS_LIFECYCLE_STATUSES = [
  'locked',
  'in_development',
  'submission_in_progress',
  'ready_for_evaluation',
  'under_evaluation',
  'revisions_required',
  'evaluator_approved',
  'chair_approved',
  'approved'
] as const;

export type SyllabusLifecycleStatus = (typeof SYLLABUS_LIFECYCLE_STATUSES)[number];

export interface EvaluatorReview {
  evaluatorId: string;
  evaluatorName: string;
  status: 'pending' | 'approved' | 'revisions_requested';
  remarks?: string;
  reviewedAt?: string;
}

export interface SyllabusDevelopmentRecord {
  id: string; // Group key e.g. `SYL-CSPC103-2026-FIRST`
  courseCode: string;
  courseTitle: string;
  schoolYear: string;
  semester: string;
  collegeId: string;
  departmentId?: string;
  courseIds: string[];
  instructorIds: string[];
  sections: string[];
  status: SyllabusLifecycleStatus;
  releasedAt?: string;
  releasedBy?: string; // Chairperson ID
  lockedAt?: string;
  lockedBy?: string; // Chairperson ID
  submissionAgreements: Record<string, boolean>; // instructorId -> agreed
  evaluators: EvaluatorReview[];
  chairApprovedAt?: string;
  chairApprovedBy?: string;
  deanApprovedAt?: string;
  deanApprovedBy?: string;
  syllabusData?: OfficialSyllabusData | null;
  updatedAt: string;
}

export interface SyllabusGroup {
  id: string;
  courseCode: string;
  courseTitle: string;
  schoolYear: string;
  semester: string;
  collegeId: string;
  departmentId?: string;
  courseIds: string[];
  instructorIds: string[];
  instructorNames: string[];
  instructorSections?: Record<string, string[]>; // instructorId -> sections
  sections: string[];
  status: SyllabusLifecycleStatus;
  submissionAgreements: Record<string, boolean>;
  evaluators: EvaluatorReview[];
  syllabusData?: OfficialSyllabusData | null;
  updatedAt: string;
}
