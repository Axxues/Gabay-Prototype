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
    label: 'Course Identification & Schedule',
    shortTitle: 'Course Info',
    description: 'Institutional header, basic course identification, and individual faculty schedules.'
  },
  {
    id: 'outcomes',
    label: 'Institutional Statements & Course Specifications',
    shortTitle: 'Outcomes & Specs',
    description: 'PVMGO statements, Program Outcomes, Course Outcomes, course catalog specifications, grading formulas, and classroom policies.'
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
    label: 'References',
    shortTitle: 'References',
    description: 'APA academic references, textbooks, online resources, and reading materials.'
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
