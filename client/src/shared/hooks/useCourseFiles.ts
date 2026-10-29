import { useMemo } from 'react';
import { useLMS } from '../context/LMSContext';
import type { CourseFile, CourseFolder, TermId } from '../types/lms';
import {
  areaFolderAutoKey,
  findFolderByAutoKey,
  moduleFolderAutoKey,
  resolveFiledSourceLabel,
} from '../utils/autoFolder';
import { normalizeTermId } from '../utils/gradingTerms';
import { TERM_LABELS } from '../components/common/TermSelect';
import { formatFileSize, parseFormattedSize } from '../utils/fileUploader';

export const ANNOUNCEMENTS_ROOT_FOLDER_ID = 'vf-announcements';
export const SYLLABUS_ROOT_FOLDER_ID = 'vf-syllabus';
export const MODULES_ROOT_FOLDER_ID = 'vf-modules';
export const ACTIVITIES_ROOT_FOLDER_ID = 'vf-activities';
export const ASSIGNMENTS_ROOT_FOLDER_ID = 'vf-assignments';
export const QUIZZES_ROOT_FOLDER_ID = 'vf-quizzes';
export const PROJECTS_ROOT_FOLDER_ID = 'vf-projects';
export const PRESENTATIONS_ROOT_FOLDER_ID = 'vf-presentations';
export const activitiesTermFolderId = (term: TermId): string => `vf-activities-${term}`;
const TERM_ORDER: TermId[] = ['prelim', 'midterm', 'finals'];

export type AggregatedCourseFile = CourseFile & {
  source: string;
  sourceLabel: string;
};

export const detectFileType = (nameOrUrl: string): CourseFile['type'] => {
  const lower = (nameOrUrl || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.svg')
  )
    return 'image';
  if (
    lower.endsWith('.zip') ||
    lower.endsWith('.tar') ||
    lower.endsWith('.gz') ||
    lower.endsWith('.rar') ||
    lower.endsWith('.7z')
  )
    return 'archive';
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.py') ||
    lower.endsWith('.json') ||
    lower.endsWith('.html') ||
    lower.endsWith('.css')
  )
    return 'code';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'slide';
  return 'document';
};

export const useCourseFiles = (courseId?: string) => {
  const { db, activeUser } = useLMS();

  const isPersonal = !courseId || courseId === 'personal';
  const effectiveScopeId = isPersonal ? `user-${activeUser.id}` : courseId;

  const { allFiles, virtualFolders } = useMemo<{
    allFiles: AggregatedCourseFile[];
    virtualFolders: CourseFolder[];
  }>(() => {
    if (!db) return { allFiles: [], virtualFolders: [] };

    const folders = db.courseFolders || [];
    const course = !isPersonal && courseId ? (db.courses || []).find((c: any) => c.id === courseId) : null;

    // Real folder lookups hoisted to the top to prevent TDZ ReferenceErrors
    const realAnnouncementsFolder =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('announcements')) ||
      folders.find((f: any) => f.courseId === effectiveScopeId && f.name.toLowerCase() === 'announcements' && !f.parentId);
    const announcementsFolderId = realAnnouncementsFolder?.id ?? ANNOUNCEMENTS_ROOT_FOLDER_ID;

    const realSyllabusFolder =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('syllabus')) ||
      folders.find((f: any) => f.courseId === effectiveScopeId && f.name.toLowerCase() === 'syllabus' && !f.parentId);
    const syllabusFolderId = realSyllabusFolder?.id ?? SYLLABUS_ROOT_FOLDER_ID;

    const realModulesFolder =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('modules')) ||
      folders.find((f: any) => f.courseId === effectiveScopeId && f.name.toLowerCase() === 'modules' && !f.parentId);
    const modulesFolderId = realModulesFolder?.id ?? MODULES_ROOT_FOLDER_ID;

    const realActivitiesFolder =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('activities')) ||
      folders.find((f: any) => f.courseId === effectiveScopeId && f.name.toLowerCase() === 'activities' && !f.parentId);
    const activitiesFolderId = realActivitiesFolder?.id ?? ACTIVITIES_ROOT_FOLDER_ID;

    const realAssignmentsFolder =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('assignments')) ||
      folders.find((f: any) => f.courseId === effectiveScopeId && f.name.toLowerCase() === 'assignments' && !f.parentId);
    const assignmentsFolderId = realAssignmentsFolder?.id ?? ASSIGNMENTS_ROOT_FOLDER_ID;

    const realQuizzesFolder =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('quizzes')) ||
      folders.find((f: any) => f.courseId === effectiveScopeId && f.name.toLowerCase() === 'quizzes' && !f.parentId);
    const quizzesFolderId = realQuizzesFolder?.id ?? QUIZZES_ROOT_FOLDER_ID;

    const realProjectsFolder =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('projects')) ||
      folders.find((f: any) => f.courseId === effectiveScopeId && f.name.toLowerCase() === 'projects' && !f.parentId);
    const projectsFolderId = realProjectsFolder?.id ?? PROJECTS_ROOT_FOLDER_ID;

    const realPresentationsFolder =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('presentations')) ||
      folders.find((f: any) => f.courseId === effectiveScopeId && f.name.toLowerCase() === 'presentations' && !f.parentId);
    const presentationsFolderId = realPresentationsFolder?.id ?? PRESENTATIONS_ROOT_FOLDER_ID;

    const folderIdForModule = (moduleId: string | null): string | null => {
      if (!moduleId) return null;
      const scopeId = effectiveScopeId as string;
      const child = findFolderByAutoKey(folders, scopeId, moduleFolderAutoKey(moduleId));
      if (child) return (child as any).id;
      const area = findFolderByAutoKey(folders, scopeId, areaFolderAutoKey('modules'));
      return area ? (area as any).id : modulesFolderId;
    };

    const unlinkedTerms = new Set<TermId>();
    const activityFolderId = (term: TermId | null | undefined): string => {
      if (realActivitiesFolder) return realActivitiesFolder.id;
      const resolved = term ?? 'midterm';
      unlinkedTerms.add(resolved);
      return activitiesTermFolderId(resolved);
    };

    // 1. Direct course files
    const directFiles: AggregatedCourseFile[] = (db.courseFiles || [])
      .filter(f =>
        isPersonal ? f.courseId === effectiveScopeId : f.courseId === courseId || f.courseId === effectiveScopeId
      )
      .map(f => {
        const area = (f as CourseFile).sourceArea;
        const fileUrl = f.url || f.fileUrl;

        const matchedAnnouncement = (db.announcements || []).find(a =>
          (a.courseId === courseId || a.courseId === 'all') &&
          (a.attachments || []).some(att => att.name === f.name || (fileUrl && att.url === fileUrl))
        );

        let matchedModule: any = null;
        let matchedItem: any = null;
        for (const m of (db.modules || [])) {
          if (m.courseId !== courseId) continue;
          for (const item of (m.items || [])) {
            const atts = Array.isArray(item.attachments)
              ? item.attachments
              : (typeof item.attachments === 'string' ? (() => { try { return JSON.parse(item.attachments); } catch { return []; } })() : []);
            const match =
              (item.fileName && item.fileName === f.name) ||
              (fileUrl && item.fileUrl && item.fileUrl === fileUrl) ||
              atts.some((att: any) => att && (att.name === f.name || (fileUrl && att.url === fileUrl)));
            if (match) {
              matchedModule = m;
              matchedItem = item;
              break;
            }
          }
          if (matchedModule) break;
        }

        const isSyllabus = area === 'syllabus'
          || Boolean(course?.syllabus?.sourceDocument && (course.syllabus.sourceDocument.fileName === f.name || (course.syllabus.sourceDocument as any).courseFileId === f.id))
          || Boolean(/course[\s_-]*orientation|[\s_-]syllabus/i.test(f.name) && !area);

        // Resolve source: assessment types take precedence over module membership
        let resolvedSource: string;
        if (area === 'announcements' || (!area && matchedAnnouncement)) {
          resolvedSource = 'announcements';
        } else if (isSyllabus) {
          resolvedSource = 'syllabus';
        } else if (area === 'activities' || (!area && matchedItem?.type === 'activity')) {
          resolvedSource = 'activities';
        } else if (area === 'assignments' || (!area && matchedItem?.type === 'assignment')) {
          resolvedSource = 'assignments';
        } else if (area === 'quizzes' || (!area && matchedItem?.type === 'quiz')) {
          resolvedSource = 'quizzes';
        } else if (area === 'projects' || (!area && matchedItem?.type === 'project')) {
          resolvedSource = 'projects';
        } else if (area === 'presentations' || (!area && matchedItem?.type === 'presentation')) {
          resolvedSource = 'presentations';
        } else if (area === 'modules' || (!area && matchedModule)) {
          resolvedSource = 'modules';
        } else {
          resolvedSource = 'uploads';
        }

        const resolvedSourceId = f.sourceId || (
          resolvedSource === 'announcements' ? matchedAnnouncement?.id :
          resolvedSource === 'modules' ? matchedModule?.id : undefined
        );

        let resolvedFolderId = f.folderId;
        if (!resolvedFolderId && !isPersonal) {
          if (resolvedSource === 'announcements') resolvedFolderId = announcementsFolderId;
          else if (resolvedSource === 'syllabus') resolvedFolderId = syllabusFolderId;
          else if (resolvedSource === 'modules') resolvedFolderId = (resolvedSourceId ? folderIdForModule(resolvedSourceId) : null) ?? modulesFolderId;
          else if (resolvedSource === 'activities') resolvedFolderId = activitiesFolderId;
          else if (resolvedSource === 'assignments') resolvedFolderId = assignmentsFolderId;
          else if (resolvedSource === 'quizzes') resolvedFolderId = quizzesFolderId;
          else if (resolvedSource === 'projects') resolvedFolderId = projectsFolderId;
          else if (resolvedSource === 'presentations') resolvedFolderId = presentationsFolderId;
        }

        let effectiveFormattedSize = f.formattedSize;
        let effectiveSize = f.size;

        if (isSyllabus) {
          const sylDoc = course?.syllabus?.sourceDocument;
          const candidateSize = (sylDoc?.fileSize && sylDoc.fileSize !== '0 B') ? sylDoc.fileSize : undefined;
          if (!effectiveFormattedSize || effectiveFormattedSize === '0 B') {
            effectiveFormattedSize = candidateSize || (effectiveSize > 0 ? formatFileSize(effectiveSize) : '1.0 MB');
          }
          if (!effectiveSize || effectiveSize === 0) {
            effectiveSize = parseFormattedSize(effectiveFormattedSize) || 1024 * 1024;
          }
        } else if (!effectiveFormattedSize || effectiveFormattedSize === '0 B') {
          if (effectiveSize > 0) {
            effectiveFormattedSize = formatFileSize(effectiveSize);
          } else {
            effectiveFormattedSize = f.type === 'pdf' ? '1.0 MB' : (f.type === 'image' ? '450 KB' : '500 KB');
            effectiveSize = parseFormattedSize(effectiveFormattedSize);
          }
        }

        const effectiveFile = {
          ...f,
          size: effectiveSize,
          formattedSize: effectiveFormattedSize,
          sourceArea: f.sourceArea || (resolvedSource !== 'uploads' ? (resolvedSource as any) : undefined),
          sourceId: resolvedSourceId
        };

        return {
          ...f,
          size: effectiveSize,
          formattedSize: effectiveFormattedSize,
          sourceArea: effectiveFile.sourceArea,
          sourceId: effectiveFile.sourceId,
          folderId: resolvedFolderId,
          source: resolvedSource,
          sourceLabel: isSyllabus ? 'Syllabus' : resolveFiledSourceLabel(effectiveFile, db.announcements || [], db.modules || [])
        };
      });

    // 1b. Syllabus document fallback if not already in directFiles
    const syllabusFiles: AggregatedCourseFile[] = [];
    if (!isPersonal && course?.syllabus) {
      const srcDoc = course.syllabus.sourceDocument;
      const sName = srcDoc?.fileName || null;
      if (sName) {
        const sUrl = (srcDoc as any)?.fileUrl || (srcDoc?.fileName ? `/public/uploads/${srcDoc.fileName}` : undefined);
        const alreadyInDirect = directFiles.some(f => f.name === sName || (f.id && f.id === (srcDoc as any)?.courseFileId));
        if (!alreadyInDirect) {
          syllabusFiles.push({
            id: `syl-file-${course.id}`,
            courseId: course.id,
            folderId: syllabusFolderId,
            name: sName,
            size: 1024 * 1024,
            formattedSize: srcDoc?.fileSize || '1.0 MB',
            type: detectFileType(sName),
            visibility: 'published',
            updatedAt: (course.syllabus as any).updatedAt || new Date().toISOString(),
            uploadedBy: 'faculty',
            uploadedByName: 'Course Faculty',
            url: sUrl,
            fileUrl: sUrl,
            source: 'syllabus',
            sourceLabel: 'Syllabus'
          });
        }
      }
    }

    // 2. Module uploaded files and images (Lecture Notes / Reading Pages)
    const moduleFiles: AggregatedCourseFile[] = [];
    const relevantModules = isPersonal ? db.modules : (db.modules || []).filter(m => m.courseId === courseId);
    relevantModules.forEach(mod => {
      (mod.items || []).forEach(item => {
        // Skip assessment items: activities, assignments, quizzes, projects, presentations.
        // Their files belong to their respective assessment folders, not Modules folder.
        const isAssessmentItem =
          item.type === 'activity' ||
          item.type === 'assignment' ||
          item.type === 'quiz' ||
          item.type === 'project' ||
          item.type === 'presentation' ||
          Boolean(item.activityId) ||
          Boolean(item.quizId);
        if (isAssessmentItem) return;

        const itemAttachments: Array<{ name: string; url?: string; size?: string; type?: string }> = [];
        let rawAttachments = item.attachments;
        if (typeof rawAttachments === 'string') {
          try {
            rawAttachments = JSON.parse(rawAttachments);
          } catch {
            rawAttachments = [];
          }
        }
        if (Array.isArray(rawAttachments) && rawAttachments.length > 0) {
          rawAttachments.forEach((att: any) => {
            if (att && (att.name || att.url)) {
              itemAttachments.push({
                name: att.name,
                url: att.url,
                size: att.size,
                type: att.type,
              });
            }
          });
        }
        if (item.fileName || item.fileUrl) {
          const fName = item.fileName || item.title || 'Module_Asset.pdf';
          const already = itemAttachments.some(att => att.name.trim().toLowerCase() === fName.trim().toLowerCase() || (item.fileUrl && att.url === item.fileUrl));
          if (!already) {
            itemAttachments.push({
              name: fName,
              url: item.fileUrl,
              size: item.fileSize,
              type: item.fileType,
            });
          }
        }

        itemAttachments.forEach((att, idx) => {
          const fName = att.name;
          const fNameNorm = fName.trim().toLowerCase();
          const alreadyInDirect = directFiles.some(df =>
            df.name.trim().toLowerCase() === fNameNorm &&
            (df.source === 'modules' || df.sourceArea === 'modules' || !df.sourceArea)
          );
          if (alreadyInDirect) return;

          const fUrl = att.url || `/public/uploads/${fName}`;
          moduleFiles.push({
            id: `mod-file-${item.id}-${idx}`,
            courseId: mod.courseId,
            folderId: isPersonal ? null : (folderIdForModule(mod.id) ?? modulesFolderId),
            name: fName,
            size: att.size ? parseFormattedSize(att.size) || 1024 * 1024 : 1024 * 1024,
            formattedSize: att.size || '1.2 MB',
            type: detectFileType(fName || fUrl),
            visibility: item.published ? 'published' : 'unpublished',
            updatedAt: new Date().toISOString(),
            uploadedBy: 'faculty',
            uploadedByName: 'Course Faculty',
            url: fUrl,
            fileUrl: fUrl,
            content: item.content,
            source: 'modules',
            sourceLabel: `Module: ${mod.title}`
          });
        });
      });
    });

    // 3. Announcements attached files and images
    const announcementFiles: AggregatedCourseFile[] = [];
    const relevantAnnouncements = isPersonal
      ? db.announcements || []
      : (db.announcements || []).filter(a => a.courseId === courseId || a.courseId === 'all');
    relevantAnnouncements.forEach(ann => {
      let rawAttachments = ann.attachments;
      if (typeof rawAttachments === 'string') {
        try { rawAttachments = JSON.parse(rawAttachments); } catch { rawAttachments = []; }
      }
      if (Array.isArray(rawAttachments) && rawAttachments.length > 0) {
        rawAttachments.forEach((att: any, idx: number) => {
          if (!att || (!att.name && !att.url)) return;
          const attNameNorm = (att.name || '').trim().toLowerCase();
          const alreadyInDirect = directFiles.some(df =>
            df.name.trim().toLowerCase() === attNameNorm &&
            (df.source === 'announcements' || df.sourceArea === 'announcements' || !df.sourceArea)
          );
          if (alreadyInDirect) return;

          const aUrl = att.url || `/public/uploads/${att.name}`;
          announcementFiles.push({
            id: `ann-file-${ann.id}-${idx}`,
            courseId: ann.courseId,
            folderId: isPersonal ? null : announcementsFolderId,
            name: att.name,
            size: 1024 * 1024,
            formattedSize: att.size || '850 KB',
            type: detectFileType(att.name || aUrl),
            visibility: 'published',
            updatedAt: ann.createdAt || new Date().toISOString(),
            uploadedBy: ann.authorId,
            uploadedByName: ann.authorName || 'Instructor',
            url: aUrl,
            fileUrl: aUrl,
            content: ann.content,
            source: 'announcements',
            sourceLabel: `Announcement: ${ann.title}`
          });
        });
      }
    });

    // 4. Activities / Assignments / Projects / Presentations starter files and submissions
    const activityFiles: AggregatedCourseFile[] = [];
    const relevantActivities = (
      isPersonal ? db.activities || [] : (db.activities || []).filter(a => a.courseId === courseId)
    );

    const relevantClassicActivities = relevantActivities.filter(a => a.format === 'classic');

    relevantClassicActivities.forEach(act => {
      const actTerm: TermId = normalizeTermId(act.term) ?? 'midterm';
      const rawType = act.assessmentType || (
        act.category?.toLowerCase() === 'assignments' ? 'assignment' :
        act.category?.toLowerCase() === 'projects' ? 'project' :
        act.category?.toLowerCase() === 'presentations' ? 'presentation' :
        'activity'
      );

      let targetFolderId: string;
      let targetSource: string;
      let targetLabelPrefix: string;

      if (rawType === 'assignment') {
        targetFolderId = assignmentsFolderId;
        targetSource = 'assignments';
        targetLabelPrefix = 'Assignment';
      } else if (rawType === 'project') {
        targetFolderId = projectsFolderId;
        targetSource = 'projects';
        targetLabelPrefix = 'Project';
      } else if (rawType === 'presentation') {
        targetFolderId = presentationsFolderId;
        targetSource = 'presentations';
        targetLabelPrefix = 'Presentation';
      } else {
        targetFolderId = activityFolderId(actTerm);
        targetSource = 'activities';
        targetLabelPrefix = 'Activity';
      }

      const actAttachments: Array<{ name: string; url?: string; size?: string }> = [];
      let rawAttachments = act.attachments;
      if (typeof rawAttachments === 'string') {
        try { rawAttachments = JSON.parse(rawAttachments); } catch { rawAttachments = []; }
      }
      if (Array.isArray(rawAttachments) && rawAttachments.length > 0) {
        rawAttachments.forEach((att: any) => {
          if (att && (att.name || att.url)) {
            actAttachments.push({ name: att.name, url: att.url, size: att.size });
          }
        });
      }
      if (act.fileName || act.fileUrl) {
        const name = act.fileName || `${act.title}_Handout.pdf`;
        const already = actAttachments.some(a => a.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (!already) {
          actAttachments.push({ name, url: act.fileUrl, size: act.fileSize });
        }
      }

      actAttachments.forEach((att, idx) => {
        const actUrl = att.url || `/public/uploads/${att.name}`;
        const attNameNorm = att.name.trim().toLowerCase();
        const alreadyInDirect = directFiles.some(df =>
          df.name.trim().toLowerCase() === attNameNorm &&
          (df.source === targetSource || df.sourceArea === targetSource || !df.sourceArea)
        );
        if (alreadyInDirect) return;

        activityFiles.push({
          id: `act-file-${act.id}-${idx}`,
          courseId: act.courseId,
          folderId: targetFolderId,
          name: att.name,
          size: att.size ? parseFormattedSize(att.size) || 1024 * 1024 : 1024 * 1024,
          formattedSize: att.size || '1.5 MB',
          type: detectFileType(att.name || actUrl),
          visibility: act.published ? 'published' : 'unpublished',
          updatedAt: act.dueDate || new Date().toISOString(),
          uploadedBy: 'faculty',
          uploadedByName: 'Course Faculty',
          url: actUrl,
          fileUrl: actUrl,
          content: act.instructions,
          source: targetSource,
          sourceLabel: `${targetLabelPrefix}: ${act.title}`
        });
      });

      // Virtual entry so every classic activity counts in Files even with
      // no starter file attached.
      if (actAttachments.length === 0) {
        activityFiles.push({
          id: `asg-virtual-${act.id}`,
          courseId: act.courseId,
          folderId: targetFolderId,
          name: (act.title || `Untitled ${targetSource}`).trim() || `Untitled ${targetSource}`,
          size: 0,
          formattedSize: 'Assessment',
          type: 'document',
          visibility: act.published ? 'published' : 'unpublished',
          updatedAt: act.dueDate || new Date().toISOString(),
          uploadedBy: 'faculty',
          uploadedByName: 'Course Faculty',
          url: undefined,
          fileUrl: undefined,
          content: act.instructions,
          source: targetSource,
          sourceLabel: `${targetLabelPrefix}: ${act.title}`
        });
      }

      const relevantSubs = (db.submissions || []).filter(
        s => s.activityKey === act.id && (s.fileName || s.fileUrl)
      );
      relevantSubs.forEach(sub => {
        const subUrl = sub.fileUrl || (sub.fileName ? `/public/uploads/${sub.fileName}` : undefined);
        activityFiles.push({
          id: `sub-file-${sub.id}`,
          courseId: act.courseId,
          folderId: targetFolderId,
          name: sub.fileName || `${sub.studentName}_Submission.pdf`,
          size: 1024 * 1024,
          formattedSize: '1.8 MB',
          type: detectFileType(sub.fileName || subUrl || 'file.pdf'),
          visibility: 'published',
          updatedAt: sub.submittedAt || new Date().toISOString(),
          uploadedBy: sub.studentId,
          uploadedByName: sub.studentName,
          url: subUrl,
          fileUrl: subUrl,
          content: sub.content,
          source: targetSource,
          sourceLabel: `Student Submission (${sub.studentName})`
        });
      });
    });

    // 4b. Question-set activities (non-classic db.activities rows)
    const relevantQuestionSets = relevantActivities.filter((a: any) => a.format !== 'classic');
    relevantQuestionSets.forEach((act: any) => {
      const actTerm: TermId = normalizeTermId(act.term) ?? 'midterm';
      const rawType = act.assessmentType || (
        act.category?.toLowerCase() === 'assignments' ? 'assignment' :
        act.category?.toLowerCase() === 'projects' ? 'project' :
        act.category?.toLowerCase() === 'presentations' ? 'presentation' :
        'activity'
      );
      const targetFolderId = rawType === 'assignment' ? assignmentsFolderId :
        rawType === 'project' ? projectsFolderId :
        rawType === 'presentation' ? presentationsFolderId :
        activityFolderId(actTerm);
      const targetSource = rawType === 'assignment' ? 'assignments' :
        rawType === 'project' ? 'projects' :
        rawType === 'presentation' ? 'presentations' :
        'activities';
      const targetLabelPrefix = rawType === 'assignment' ? 'Assignment' :
        rawType === 'project' ? 'Project' :
        rawType === 'presentation' ? 'Presentation' :
        'Activity';

      activityFiles.push({
        id: `act-virtual-${act.id}`,
        courseId: act.courseId,
        folderId: targetFolderId,
        name: (act.title || 'Untitled question set').trim() || 'Untitled question set',
        size: 0,
        formattedSize: 'Assessment',
        type: 'document',
        visibility: act.published ? 'published' : 'unpublished',
        updatedAt: act.dueDate || new Date().toISOString(),
        uploadedBy: 'faculty',
        uploadedByName: 'Course Faculty',
        url: undefined,
        fileUrl: undefined,
        content: act.instructions,
        source: targetSource,
        sourceLabel: `${targetLabelPrefix}: ${act.title} (Question set)`
      });
    });

    const nowIso = new Date().toISOString();
    const scopeId = (effectiveScopeId as string) ?? (courseId as string);
    const virtualFolders: CourseFolder[] = [];

    if (!isPersonal) {
      const hasAnnouncementFiles = announcementFiles.length > 0 || directFiles.some(f => f.source === 'announcements');
      if (!realAnnouncementsFolder && hasAnnouncementFiles) {
        virtualFolders.push({
          id: ANNOUNCEMENTS_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Announcements',
          updatedAt: nowIso,
          autoKey: 'area:announcements',
        });
      }

      const hasSyllabusFiles = syllabusFiles.length > 0 || directFiles.some(f => f.source === 'syllabus');
      if (!realSyllabusFolder && hasSyllabusFiles) {
        virtualFolders.push({
          id: SYLLABUS_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Syllabus',
          updatedAt: nowIso,
          autoKey: 'area:syllabus',
        });
      }

      const hasModuleFiles = moduleFiles.length > 0 || directFiles.some(f => f.source === 'modules');
      if (!realModulesFolder && hasModuleFiles) {
        virtualFolders.push({
          id: MODULES_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Modules',
          updatedAt: nowIso,
          autoKey: 'area:modules',
        });
      }

      const hasActivityFiles = activityFiles.some(f => f.source === 'activities') || directFiles.some(f => f.source === 'activities');
      if (!realActivitiesFolder && hasActivityFiles) {
        virtualFolders.push({
          id: ACTIVITIES_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Activities',
          updatedAt: nowIso,
          autoKey: 'area:activities',
        });
        if (unlinkedTerms.size > 0) {
          virtualFolders.push(
            ...TERM_ORDER.filter(t => unlinkedTerms.has(t)).map(
              (t): CourseFolder => ({
                id: activitiesTermFolderId(t),
                courseId: scopeId,
                parentId: ACTIVITIES_ROOT_FOLDER_ID,
                name: TERM_LABELS[t],
                updatedAt: nowIso,
                autoKey: `activities-term:${t}`,
              })
            )
          );
        }
      }

      const hasAssignmentFiles = activityFiles.some(f => f.source === 'assignments') || directFiles.some(f => f.source === 'assignments');
      if (!realAssignmentsFolder && hasAssignmentFiles) {
        virtualFolders.push({
          id: ASSIGNMENTS_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Assignments',
          updatedAt: nowIso,
          autoKey: 'area:assignments',
        });
      }

      const hasQuizFiles = directFiles.some(f => f.source === 'quizzes');
      if (!realQuizzesFolder && hasQuizFiles) {
        virtualFolders.push({
          id: QUIZZES_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Quizzes',
          updatedAt: nowIso,
          autoKey: 'area:quizzes',
        });
      }

      const hasProjectFiles = activityFiles.some(f => f.source === 'projects') || directFiles.some(f => f.source === 'projects');
      if (!realProjectsFolder && hasProjectFiles) {
        virtualFolders.push({
          id: PROJECTS_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Projects',
          updatedAt: nowIso,
          autoKey: 'area:projects',
        });
      }

      const hasPresentationFiles = activityFiles.some(f => f.source === 'presentations') || directFiles.some(f => f.source === 'presentations');
      if (!realPresentationsFolder && hasPresentationFiles) {
        virtualFolders.push({
          id: PRESENTATIONS_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Presentations',
          updatedAt: nowIso,
          autoKey: 'area:presentations',
        });
      }
    }

    const combinedRawFiles = [
      ...directFiles,
      ...syllabusFiles,
      ...moduleFiles,
      ...announcementFiles,
      ...activityFiles
    ];

    const seenFileKeys = new Set<string>();
    const deduped = combinedRawFiles.filter(item => {
      const normName = (item.name || '').trim().toLowerCase();
      const folderKey = item.folderId || 'root';
      const nameKey = `${folderKey}::${normName}`;
      if (seenFileKeys.has(nameKey)) return false;
      if (item.url && item.url !== `/public/uploads/${item.name}`) {
        const urlKey = `url::${item.url}`;
        if (seenFileKeys.has(urlKey)) return false;
        seenFileKeys.add(urlKey);
      }
      seenFileKeys.add(nameKey);
      return true;
    });
    return { allFiles: deduped, virtualFolders };
  }, [db, isPersonal, effectiveScopeId, courseId]);

  const sourceCounts = useMemo(
    () => ({
      all: allFiles.length,
      modules: allFiles.filter(f => f.source === 'modules').length,
      announcements: allFiles.filter(f => f.source === 'announcements').length,
      activities: allFiles.filter(f => f.source === 'activities').length,
      assignments: allFiles.filter(f => f.source === 'assignments').length,
      projects: allFiles.filter(f => f.source === 'projects').length,
      presentations: allFiles.filter(f => f.source === 'presentations').length,
      syllabus: allFiles.filter(f => f.source === 'syllabus').length,
      uploads: allFiles.filter(f => f.source === 'uploads').length
    }),
    [allFiles]
  );

  return { isPersonal, effectiveScopeId, allFiles, virtualFolders, sourceCounts, detectFileType };
};
