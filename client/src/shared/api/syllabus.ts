import { likhaLmsApi } from './likhaLmsApi';
import type {
  SyllabusApi,
  SyllabusRevisionResponse,
  SyllabusRevisionHeader,
  SyllabusSectionKey,
} from '../types/syllabusApi';

export async function getPublished(courseId: string): Promise<SyllabusRevisionResponse | null> {
  return likhaLmsApi.syllabus.getPublished(courseId);
}

export async function listRevisions(courseId: string): Promise<SyllabusRevisionHeader[]> {
  return likhaLmsApi.syllabus.listRevisions(courseId);
}

export async function createDraft(courseId: string, sourceRevisionId?: string): Promise<SyllabusRevisionResponse> {
  return likhaLmsApi.syllabus.createDraft(courseId, sourceRevisionId);
}

export async function updateSection(
  courseId: string,
  revisionId: string,
  rowVersion: number,
  section: SyllabusSectionKey,
  value: unknown,
): Promise<SyllabusRevisionResponse> {
  return likhaLmsApi.syllabus.updateSection(courseId, revisionId, rowVersion, section, value);
}

export async function publish(
  courseId: string,
  revisionId: string,
  rowVersion: number,
): Promise<SyllabusRevisionResponse> {
  return likhaLmsApi.syllabus.publish(courseId, revisionId, rowVersion);
}

export async function deleteDraft(courseId: string, revisionId: string): Promise<void> {
  return likhaLmsApi.syllabus.deleteDraft(courseId, revisionId);
}

export async function withdrawSyllabus(courseId: string): Promise<void> {
  return likhaLmsApi.syllabus.withdrawSyllabus(courseId);
}

export const syllabusApi: SyllabusApi = {
  getPublished,
  listRevisions,
  createDraft,
  updateSection,
  publish,
};
