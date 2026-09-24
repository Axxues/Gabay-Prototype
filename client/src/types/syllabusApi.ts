import type { OfficialSyllabusData } from '../data/syllabusData';

export type SyllabusSectionKey =
  | 'institution'
  | 'courseInfo'
  | 'faculty'
  | 'institutionalStatements'
  | 'programOutcomes'
  | 'courseOutcomes'
  | 'requirements'
  | 'gradingSystem'
  | 'rubrics'
  | 'policies'
  | 'outline'
  | 'learningPlan'
  | 'courseMap'
  | 'references'
  | 'signatories'
  | 'sourceDocument';

export interface SyllabusRevisionResponse {
  revision: {
    id: string;
    courseId: string;
    revisionNo: number;
    status: 'draft' | 'published' | 'archived';
    schemaVersion: string;
    rowVersion: number;
    createdAt: string;
    updatedAt: string;
    publishedAt: string | null;
  };
  syllabus: OfficialSyllabusData;
}

export type SyllabusRevisionHeader = SyllabusRevisionResponse['revision'];

export interface SyllabusApi {
  getPublished(courseId: string): Promise<SyllabusRevisionResponse | null>;
  listRevisions(courseId: string): Promise<SyllabusRevisionResponse['revision'][]>;
  createDraft(courseId: string, sourceRevisionId?: string): Promise<SyllabusRevisionResponse>;
  updateSection(courseId: string, revisionId: string, rowVersion: number, section: SyllabusSectionKey, value: unknown): Promise<SyllabusRevisionResponse>;
  publish(courseId: string, revisionId: string, rowVersion: number): Promise<SyllabusRevisionResponse>;
}
