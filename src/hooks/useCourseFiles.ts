import { useMemo } from 'react';
import { useLMS } from '../context/LMSContext';
import type { CourseFile } from '../types/lms';
import { resolveFiledSourceLabel } from '../utils/autoFolder';

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

  const allFiles = useMemo<AggregatedCourseFile[]>(() => {
    if (!db) return [];

    // 1. Direct course files
    const directFiles: AggregatedCourseFile[] = (db.courseFiles || [])
      .filter(f =>
        isPersonal ? f.courseId === effectiveScopeId : f.courseId === courseId || f.courseId === effectiveScopeId
      )
      .map(f => {
        const area = (f as CourseFile).sourceArea;
        return {
          ...f,
          source: area === 'announcements' ? 'announcements' : area === 'modules' ? 'modules' : 'uploads',
          sourceLabel: resolveFiledSourceLabel(f, db.announcements || [], db.modules || [])
        };
      });

    // 2. Module uploaded files and images
    const moduleFiles: AggregatedCourseFile[] = [];
    const relevantModules = isPersonal ? db.modules : (db.modules || []).filter(m => m.courseId === courseId);
    relevantModules.forEach(mod => {
      (mod.items || []).forEach(item => {
        if (item.fileName || item.fileUrl) {
          const fName = item.fileName || item.title || 'Module_Asset.pdf';
          const fUrl = item.fileUrl || `/public/uploads/${fName}`;
          moduleFiles.push({
            id: `mod-file-${item.id}`,
            courseId: mod.courseId,
            folderId: null,
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
          const aUrl = att.url || `/public/uploads/${att.name}`;
          announcementFiles.push({
            id: `ann-file-${ann.id}-${idx}`,
            courseId: ann.courseId,
            folderId: null,
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
    const activityFiles: AggregatedCourseFile[] = [];
    const relevantAssignments = isPersonal
      ? db.assignments || []
      : (db.assignments || []).filter(a => a.courseId === courseId);
    relevantAssignments.forEach(asg => {
      if (asg.fileName || asg.fileUrl) {
        const asgUrl = asg.fileUrl || `/public/uploads/${asg.fileName}`;
        activityFiles.push({
          id: `asg-file-${asg.id}`,
          courseId: asg.courseId,
          folderId: null,
          name: asg.fileName || `${asg.title}_Handout.pdf`,
          size: 1024 * 1024,
          formattedSize: asg.fileSize || '1.5 MB',
          type: detectFileType(asg.fileName || asgUrl),
          visibility: asg.published ? 'published' : 'unpublished',
          updatedAt: asg.dueDate || new Date().toISOString(),
          uploadedBy: 'faculty',
          uploadedByName: 'Course Faculty',
          url: asgUrl,
          fileUrl: asgUrl,
          content: asg.instructions,
          source: 'activities',
          sourceLabel: `Activity: ${asg.title}`
        });
      }

      const relevantSubs = (db.submissions || []).filter(
        s => s.assignmentId === asg.id && (s.fileName || s.fileUrl)
      );
      relevantSubs.forEach(sub => {
        const subUrl = sub.fileUrl || (sub.fileName ? `/public/uploads/${sub.fileName}` : undefined);
        activityFiles.push({
          id: `sub-file-${sub.id}`,
          courseId: asg.courseId,
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

    // 5. Quizzes attached starter files / images / question assets
    const quizFiles: AggregatedCourseFile[] = [];
    const relevantQuizzes = isPersonal
      ? db.quizzes || []
      : (db.quizzes || []).filter(q => q.courseId === courseId);
    relevantQuizzes.forEach(quiz => {
      if ((quiz as any).fileName || (quiz as any).fileUrl) {
        const qUrl = (quiz as any).fileUrl || `/public/uploads/${(quiz as any).fileName}`;
        quizFiles.push({
          id: `quiz-file-${quiz.id}`,
          courseId: quiz.courseId,
          folderId: null,
          name: (quiz as any).fileName || `${quiz.title}_Quiz_Reference.pdf`,
          size: 1024 * 1024,
          formattedSize: (quiz as any).fileSize || '950 KB',
          type: detectFileType((quiz as any).fileName || qUrl),
          visibility: quiz.published ? 'published' : 'unpublished',
          updatedAt: new Date().toISOString(),
          uploadedBy: 'faculty',
          uploadedByName: 'Course Faculty',
          url: qUrl,
          fileUrl: qUrl,
          content: quiz.instructions,
          source: 'quizzes',
          sourceLabel: `Quiz: ${quiz.title}`
        });
      }

      (quiz.questions || []).forEach((q: any, qIdx: number) => {
        if (q.imageUrl || q.imageName || q.fileUrl || q.fileName) {
          const qName = q.fileName || q.imageName || `${quiz.title}_Q${qIdx + 1}_Diagram.png`;
          const qUrl = q.fileUrl || q.imageUrl || `/public/uploads/${qName}`;
          quizFiles.push({
            id: `quiz-q-file-${quiz.id}-${q.id || qIdx}`,
            courseId: quiz.courseId,
            folderId: null,
            name: qName,
            size: 512 * 1024,
            formattedSize: '512 KB',
            type: detectFileType(qName || qUrl),
            visibility: quiz.published ? 'published' : 'unpublished',
            updatedAt: new Date().toISOString(),
            uploadedBy: 'faculty',
            uploadedByName: 'Course Faculty',
            url: qUrl,
            fileUrl: qUrl,
            content: q.text,
            source: 'quizzes',
            sourceLabel: `Quiz Question: ${quiz.title} (Q${qIdx + 1})`
          });
        }
      });
    });

    const combinedRawFiles = [
      ...directFiles,
      ...moduleFiles,
      ...announcementFiles,
      ...activityFiles,
      ...quizFiles
    ];

    const seenFileKeys = new Set<string>();
    return combinedRawFiles.filter(item => {
      const key = `${item.name}-${item.url || item.fileUrl || item.id}`;
      if (seenFileKeys.has(key)) return false;
      seenFileKeys.add(key);
      return true;
    });
  }, [db, isPersonal, effectiveScopeId, courseId]);

  const sourceCounts = useMemo(
    () => ({
      all: allFiles.length,
      modules: allFiles.filter(f => f.source === 'modules').length,
      announcements: allFiles.filter(f => f.source === 'announcements').length,
      activities: allFiles.filter(f => f.source === 'activities').length,
      quizzes: allFiles.filter(f => f.source === 'quizzes').length,
      uploads: allFiles.filter(f => f.source === 'uploads').length
    }),
    [allFiles]
  );

  return { isPersonal, effectiveScopeId, allFiles, sourceCounts, detectFileType };
};