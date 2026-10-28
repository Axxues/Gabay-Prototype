import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';

export type WizardStepId =
  | 'course-info'
  | 'outcomes'
  | 'outline'
  | 'learning-plan'
  | 'course-map'
  | 'grading'
  | 'review';

export interface WizardStepDefinition {
  id: WizardStepId;
  label: string;
  shortTitle: string;
  description: string;
}

export const WIZARD_STEPS: WizardStepDefinition[] = [
  {
    id: 'course-info',
    label: 'Course Information',
    shortTitle: 'Course Info',
    description: 'Course identifiers, schedule, credits, prerequisites, and faculty details.'
  },
  {
    id: 'outcomes',
    label: 'Institutional Statements & Outcomes',
    shortTitle: 'Outcomes',
    description: 'PVMGO statements, Program Outcomes (PO), and Course Outcomes (CO).'
  },
  {
    id: 'outline',
    label: 'Course Outline & Time Frame',
    shortTitle: 'Outline',
    description: 'Chronological modules, timeframe, and major examinations (Midterms / Finals).'
  },
  {
    id: 'learning-plan',
    label: 'Learning Plan & SDG Alignment',
    shortTitle: 'Learning Plan',
    description: 'Weekly topics, outcomes, SDG coherence, methodologies, and assessment tasks.'
  },
  {
    id: 'course-map',
    label: 'Curriculum Course Map Matrix',
    shortTitle: 'Course Map',
    description: 'Direct mapping of Course Outcomes against Program Outcomes (I, P, D).'
  },
  {
    id: 'grading',
    label: 'Grading System & Policies',
    shortTitle: 'Grading & Policies',
    description: 'Computation formulas, class standing weights, classroom code, and APA references.'
  },
  {
    id: 'review',
    label: 'Signatories, Review & Finalize',
    shortTitle: 'Review & Sign',
    description: 'Official signatories, preview, print export, and LMS course attachment.'
  }
];

export interface SyllabusDraftItem {
  id: string;
  title: string;
  courseCode: string;
  updatedAt: string;
  data: OfficialSyllabusData;
}

export type SyllabusStarterMode = 'blank' | 'clone' | 'import';
