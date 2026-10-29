// src/utils/autoFolder.ts
export type FileSourceArea = 'announcements' | 'modules' | 'syllabus' | 'activities' | 'assignments' | 'quizzes' | 'projects' | 'presentations';

export function areaFolderName(area: FileSourceArea): string {
  if (area === 'announcements') return 'Announcements';
  if (area === 'modules') return 'Modules';
  if (area === 'activities') return 'Activities';
  if (area === 'assignments') return 'Assignments';
  if (area === 'quizzes') return 'Quizzes';
  if (area === 'projects') return 'Projects';
  if (area === 'presentations') return 'Presentations';
  return 'Syllabus';
}

export function areaFolderAutoKey(area: FileSourceArea): string {
  return `area:${area}`;
}

export function moduleFolderAutoKey(moduleId: string): string {
  return `module:${moduleId}`;
}

export function findFolderByAutoKey<T extends { courseId: string; autoKey?: string }>(
  folders: T[],
  courseId: string,
  autoKey: string
): T | undefined {
  return folders.find(f => f.courseId === courseId && f.autoKey === autoKey);
}

export function dedupeFileName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) return name;
  const dot = name.lastIndexOf('.');
  const hasExt = dot > 0;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';
  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  while (existingNames.includes(candidate)) {
    n += 1;
    candidate = `${base} (${n})${ext}`;
  }
  return candidate;
}

export function resolveFiledSourceLabel(
  file: { sourceArea?: string; sourceId?: string; name?: string; url?: string; fileUrl?: string },
  announcements: { id: string; title: string; attachments?: { name: string; url?: string }[] }[],
  modules: { id?: string; title: string; items?: { id: string; fileName?: string; fileUrl?: string }[] }[]
): string {
  const fileUrl = file.url || file.fileUrl;
  const annByAttachment = announcements.find(a =>
    (file.sourceId && a.id === file.sourceId) ||
    (a.attachments || []).some(att => (file.name && att.name === file.name) || (fileUrl && att.url === fileUrl))
  );
  if (file.sourceArea === 'announcements' || (!file.sourceArea && annByAttachment)) {
    if (file.sourceId) {
      const ann = announcements.find(a => a.id === file.sourceId);
      if (ann) return `Announcement: ${ann.title}`;
    }
    if (annByAttachment) return `Announcement: ${annByAttachment.title}`;
    return file.sourceId ? 'Source deleted' : 'Announcements';
  }
  const modByItem = modules.find(m =>
    (file.sourceId && ((m.items || []).some(i => i.id === file.sourceId) || m.id === file.sourceId)) ||
    (m.items || []).some(i => (file.name && (i as any).fileName === file.name) || (fileUrl && (i as any).fileUrl === fileUrl))
  );
  if (file.sourceArea === 'modules' || (!file.sourceArea && modByItem)) {
    if (file.sourceId) {
      const mod = modules.find(m => (m.items || []).some(i => i.id === file.sourceId) || m.id === file.sourceId);
      if (mod) return `Module: ${mod.title}`;
    }
    if (modByItem) return `Module: ${modByItem.title}`;
    return file.sourceId ? 'Source deleted' : 'Modules';
  }
  if (file.sourceArea === 'syllabus') return 'Syllabus';
  if (file.sourceArea === 'activities') return 'Activities';
  if (file.sourceArea === 'assignments') return 'Assignments';
  if (file.sourceArea === 'quizzes') return 'Quizzes';
  if (file.sourceArea === 'projects') return 'Projects';
  if (file.sourceArea === 'presentations') return 'Presentations';
  return 'Direct Upload';
}

export function isFolderEmptyRecursive(
  folders: { id: string; parentId?: string | null }[],
  files: { folderId?: string | null }[],
  folderId: string
): boolean {
  const descendantIds = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && descendantIds.has(f.parentId) && !descendantIds.has(f.id)) {
        descendantIds.add(f.id);
        grew = true;
      }
    }
  }
  return !files.some(f => f.folderId && descendantIds.has(f.folderId));
}
