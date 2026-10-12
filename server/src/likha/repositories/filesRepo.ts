import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';

export function formatLikhaFile(f: any): any {
  return {
    id: f.id,
    courseId: f.course_id,
    name: f.name,
    size: f.size ?? 0,
    type: f.type || 'document',
    url: f.url || '',
    visibility: f.visibility || 'published',
    parentId: f.parent_id || null,
    autoKey: f.auto_key || null,
    uploadedBy: f.uploaded_by || '',
    uploadedAt: f.uploaded_at || new Date().toISOString(),
  };
}

export function formatLikhaFolder(f: any): any {
  return {
    id: f.id,
    courseId: f.course_id,
    name: f.name,
    parentId: f.parent_id || null,
    autoKey: f.auto_key || null,
  };
}

export async function getCourseFiles(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/course_files?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=250`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaFile);
}

export async function getCourseFolders(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/course_folders?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json.data || []).map(formatLikhaFolder);
}

export async function createCourseFile(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `file-${Date.now().toString(36)}`,
    course_id: data.courseId,
    name: data.name,
    size: data.size || 0,
    type: data.type || 'document',
    url: data.url || '',
    visibility: data.visibility || 'published',
    parent_id: data.parentId || null,
    auto_key: data.autoKey || null,
    uploaded_by: data.uploadedBy || null,
    uploaded_at: data.uploadedAt || new Date().toISOString(),
  };

  const res = await fetch(`${LIKHA_URL}/items/course_files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaFile(json.data);
}

export async function createCourseFolder(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `fld-${Date.now().toString(36)}`,
    course_id: data.courseId,
    name: data.name,
    parent_id: data.parentId || null,
    auto_key: data.autoKey || null,
  };

  const res = await fetch(`${LIKHA_URL}/items/course_folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaFolder(json.data);
}
