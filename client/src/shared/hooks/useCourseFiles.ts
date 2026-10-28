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
    const scopeModules = isPersonal
      ? db.modules || []
      : (db.modules || []).filter((m: any) => m.courseId === courseId);

    // Module item linkage (same conventions as AddModuleItemPage):
    // classic activity -> item.activityId, question set -> the synthetic
    // `asg-activity-<id>`, quiz -> item.quizId.
    const findLinkedModuleId = (pred: (item: any) => boolean): string | null => {
      for (const mod of scopeModules) {
        for (const item of (mod as any).items || []) {
          if (pred(item)) return (mod as any).id;
        }
      }
      return null;
    };

    const course = !isPersonal && courseId ? (db.courses || []).find((c: any) => c.id === courseId) : null;

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

    // Module-linked assessment entries live inside their source module's
    // folder (module:<id>), falling back to the Modules area folder when
    // the child folder isn't cached yet.
    const folderIdForModule = (moduleId: string | null): string | null => {
      if (!moduleId) return null;
      const scopeId = effectiveScopeId as string;
      const child = findFolderByAutoKey(folders, scopeId, moduleFolderAutoKey(moduleId));
      if (child) return (child as any).id;
      const area = findFolderByAutoKey(folders, scopeId, areaFolderAutoKey('modules'));
      return area ? (area as any).id : modulesFolderId;
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
        const isAnnouncement = area === 'announcements' || Boolean(matchedAnnouncement);

        const matchedModule = (db.modules || []).find(m =>
          (m.courseId === courseId) &&
          (m.items || []).some(item =>
            (item.fileName && item.fileName === f.name) ||
            (fileUrl && item.fileUrl && (item.fileUrl === fileUrl))
          )
        );
        const isModule = area === 'modules' || Boolean(matchedModule);

        const isSyllabus = area === 'syllabus'
          || Boolean(course?.syllabus?.sourceDocument && (course.syllabus.sourceDocument.fileName === f.name || (course.syllabus.sourceDocument as any).courseFileId === f.id))
          || Boolean(/course[\s_-]*orientation|[\s_-]syllabus/i.test(f.name) && !area);

        const resolvedSource = isAnnouncement
          ? 'announcements'
          : isModule
          ? 'modules'
          : area === 'activities'
          ? 'activities'
          : (isSyllabus ? 'syllabus' : 'uploads');

        const resolvedSourceId = f.sourceId || (isAnnouncement ? matchedAnnouncement?.id : (isModule ? matchedModule?.id : undefined));

        let resolvedFolderId = f.folderId;
        if (!resolvedFolderId && !isPersonal) {
          if (resolvedSource === 'announcements') resolvedFolderId = announcementsFolderId;
          else if (resolvedSource === 'syllabus') resolvedFolderId = syllabusFolderId;
          else if (resolvedSource === 'modules') resolvedFolderId = (resolvedSourceId ? folderIdForModule(resolvedSourceId) : null) ?? modulesFolderId;
          else if (resolvedSource === 'activities') resolvedFolderId = realActivitiesRootId ?? ACTIVITIES_ROOT_FOLDER_ID;
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
          sourceArea: f.sourceArea || (isAnnouncement ? 'announcements' : (isModule ? 'modules' : (isSyllabus ? 'syllabus' : undefined))),
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

    // 2. Module uploaded files and images
    const moduleFiles: AggregatedCourseFile[] = [];
    const relevantModules = isPersonal ? db.modules : (db.modules || []).filter(m => m.courseId === courseId);
    relevantModules.forEach(mod => {
      (mod.items || []).forEach(item => {
        if (item.fileName || item.fileUrl) {
          const fName = item.fileName || item.title || 'Module_Asset.pdf';
          const fNameNorm = fName.trim().toLowerCase();
          const alreadyInDirect = directFiles.some(df =>
            df.name.trim().toLowerCase() === fNameNorm &&
            (df.source === 'modules' || df.sourceArea === 'modules' || !df.sourceArea)
          );
          if (alreadyInDirect) return;

          const fUrl = item.fileUrl || `/public/uploads/${fName}`;
          moduleFiles.push({
            id: `mod-file-${item.id}`,
            courseId: mod.courseId,
            folderId: isPersonal ? null : (folderIdForModule(mod.id) ?? modulesFolderId),
            name: fName,
            size: 1024 * 1024,
            formattedSize: item.fileSize || '1.2 MB',
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
        }
      });
    });

    // 3. Announcements attached files and images
    const announcementFiles: AggregatedCourseFile[] = [];
    const relevantAnnouncements = isPersonal
      ? db.announcements || []
      : (db.announcements || []).filter(a => a.courseId === courseId || a.courseId === 'all');
    relevantAnnouncements.forEach(ann => {
      if (ann.attachments && ann.attachments.length > 0) {
        ann.attachments.forEach((att, idx) => {
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

    // 4. Activities attached starter files and student file submissions
    // (classic format rows live in db.activities after the merge).
    const activityFiles: AggregatedCourseFile[] = [];
    const relevantClassicActivities = (
      isPersonal ? db.activities || [] : (db.activities || []).filter(a => a.courseId === courseId)
    ).filter(a => a.format === 'classic');
    // Page-created (unlinked) activities file under Activities/{Term}.
    // Module-linked ones keep their module-folder placement above.
    // Once the server files real activity uploads, a real `area:activities`
    // root exists: unlinked entries file flat under it instead of the
    // virtual term folders (which then stay unsynthesized).
    const unlinkedTerms = new Set<TermId>();
    const realActivitiesRootId =
      findFolderByAutoKey(folders, effectiveScopeId as string, areaFolderAutoKey('activities'))?.id ?? null;
    const activityFolderId = (term: TermId | null | undefined, moduleId: string | null): string => {
      if (moduleId) return folderIdForModule(moduleId) ?? realActivitiesRootId ?? activitiesTermFolderId(term ?? 'midterm');
      if (realActivitiesRootId) return realActivitiesRootId;
      const resolved = term ?? 'midterm';
      unlinkedTerms.add(resolved);
      return activitiesTermFolderId(resolved);
    };

    relevantClassicActivities.forEach(act => {
      const actTerm: TermId = normalizeTermId(act.term) ?? 'midterm';
      const actFolderId = activityFolderId(
        actTerm,
        findLinkedModuleId(item => item.activityId === act.id)
      );
      if (act.fileName || act.fileUrl) {
        const actUrl = act.fileUrl || `/public/uploads/${act.fileName}`;
        activityFiles.push({
          id: `act-file-${act.id}`,
          courseId: act.courseId,
          folderId: actFolderId,
          name: act.fileName || `${act.title}_Handout.pdf`,
          size: 1024 * 1024,
          formattedSize: act.fileSize || '1.5 MB',
          type: detectFileType(act.fileName || actUrl),
          visibility: act.published ? 'published' : 'unpublished',
          updatedAt: act.dueDate || new Date().toISOString(),
          uploadedBy: 'faculty',
          uploadedByName: 'Course Faculty',
          url: actUrl,
          fileUrl: actUrl,
          content: act.instructions,
          source: 'activities',
          sourceLabel: `Activity: ${act.title}`
        });
      }

      // Virtual entry so every classic activity counts in Files even with
      // no starter file attached (e.g. created via Add module item).
      if (!act.fileName && !act.fileUrl) {
        activityFiles.push({
          id: `asg-virtual-${act.id}`,
          courseId: act.courseId,
          folderId: actFolderId,
          name: (act.title || 'Untitled activity').trim() || 'Untitled activity',
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
          source: 'activities',
          sourceLabel: `Activity: ${act.title}`
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
          folderId: null,
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
          source: 'activities',
          sourceLabel: `Student Submission (${sub.studentName})`
        });
      });
    });

    // 4b. Question-set activities (non-classic db.activities rows) aggregate
    // as virtual entries so the Files Activities tab counts quiz-style sets
    // made via Add module item.
    const relevantQuestionSets = (
      isPersonal ? db.activities || [] : (db.activities || []).filter((a: any) => a.courseId === courseId)
    ).filter((a: any) => a.format !== 'classic');
    relevantQuestionSets.forEach((act: any) => {
      const actTerm: TermId = normalizeTermId(act.term) ?? 'midterm';
      activityFiles.push({
        id: `act-virtual-${act.id}`,
        courseId: act.courseId,
        folderId: activityFolderId(
          actTerm,
          findLinkedModuleId(item => item.activityId === `asg-activity-${act.id}`)
        ),
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
        source: 'activities',
        sourceLabel: `Activity: ${act.title} (Question set)`
      });
    });

    // Quizzes save no files on the system, so nothing quiz-sourced is
    // aggregated here (no Quizzes tab on the Files page).

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
    }

    if (unlinkedTerms.size > 0 && !realActivitiesRootId) {
      virtualFolders.push(
        {
          id: ACTIVITIES_ROOT_FOLDER_ID,
          courseId: scopeId,
          parentId: null,
          name: 'Activities',
          updatedAt: nowIso,
          autoKey: 'area:activities',
        },
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
      syllabus: allFiles.filter(f => f.source === 'syllabus').length,
      uploads: allFiles.filter(f => f.source === 'uploads').length
    }),
    [allFiles]
  );

  return { isPersonal, effectiveScopeId, allFiles, virtualFolders, sourceCounts, detectFileType };
};