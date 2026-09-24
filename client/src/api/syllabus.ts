import { ApiError, apiFetch } from './client';
import type {
  SyllabusApi,
  SyllabusRevisionResponse,
  SyllabusSectionKey,
} from '../types/syllabusApi';

const syllabusBase = (courseId: string): string =>
  `/api/courses/${encodeURIComponent(courseId)}/syllabus`;

export async function getPublished(courseId: string): Promise<SyllabusRevisionResponse | null> {
  try {
    return await apiFetch<SyllabusRevisionResponse>(syllabusBase(courseId));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function listRevisions(courseId: string): Promise<SyllabusRevisionResponse['revision'][]> {
  const { revisions } = await apiFetch<{ revisions: SyllabusRevisionResponse['revision'][] }>(
    `${syllabusBase(courseId)}/revisions`,
  );
  return revisions;
}

export async function createDraft(courseId: string, sourceRevisionId?: string): Promise<SyllabusRevisionResponse> {
  return apiFetch<SyllabusRevisionResponse>(`${syllabusBase(courseId)}/revisions`, {
    method: 'POST',
    body: sourceRevisionId ? { sourceRevisionId } : {},
  });
}

export async function updateSection(
  courseId: string,
  revisionId: string,
  rowVersion: number,
  section: SyllabusSectionKey,
  value: unknown,
): Promise<SyllabusRevisionResponse> {
  return apiFetch<SyllabusRevisionResponse>(
    `${syllabusBase(courseId)}/revisions/${encodeURIComponent(revisionId)}/sections/${section}`,
    {
      method: 'PATCH',
      headers: { 'If-Match': String(rowVersion) },
      body: { value },
    },
  );
}

export async function publish(
  courseId: string,
  revisionId: string,
  rowVersion: number,
): Promise<SyllabusRevisionResponse> {
  return apiFetch<SyllabusRevisionResponse>(
    `${syllabusBase(courseId)}/revisions/${encodeURIComponent(revisionId)}/publish`,
    {
      method: 'POST',
      headers: { 'If-Match': String(rowVersion) },
    },
  );
}

export async function deleteDraft(courseId: string, revisionId: string): Promise<void> {
  await apiFetch<{ ok: true }>(
    `${syllabusBase(courseId)}/revisions/${encodeURIComponent(revisionId)}`,
    { method: 'DELETE' },
  );
}

export const syllabusApi: SyllabusApi = {
  getPublished,
  listRevisions,
  createDraft,
  updateSection,
  publish,
};
