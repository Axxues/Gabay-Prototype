import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Course } from '../../../shared/types/lms';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import { normalizeAcademicSemester } from '../../../shared/utils/academicSemester';
import { createBaselineSyllabus } from './useSyllabusDraftsStorage';
import type {
  SyllabusGroup,
  SyllabusDevelopmentRecord,
  EvaluatorReview
} from '../types/lifecycle';

const STORAGE_KEY = 'gabay_syllabus_lifecycle_records';

export function normalizeCourseCode(raw?: string | null): string {
  if (!raw) return 'UNKNOWN';
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '');
}

export function makeSyllabusGroupId(course: Pick<Course, 'code' | 'title' | 'schoolYear' | 'semester'> & { term?: string }): string {
  const code = normalizeCourseCode(course.code || course.title);
  const sem = normalizeAcademicSemester(course.semester || (course as any)?.term).toUpperCase();
  return `SYL-${code}-${sem}`;
}

function findMatchingRecord(
  records: Record<string, SyllabusDevelopmentRecord>,
  groupId: string,
  courseCode?: string,
  semester?: string
): SyllabusDevelopmentRecord | undefined {
  if (records[groupId]) return records[groupId];

  const targetCode = normalizeCourseCode(courseCode || groupId.replace(/^SYL-/, '').replace(/-[^-]+$/, ''));
  const targetSem = normalizeAcademicSemester(semester || groupId.split('-').pop());

  const directMatch = Object.values(records).find(r => r.id === groupId);
  if (directMatch) return directMatch;

  for (const [key, rec] of Object.entries(records)) {
    const rCode = normalizeCourseCode(rec.courseCode || key.replace(/^SYL-/, '').replace(/-[^-]+$/, ''));
    const rSem = normalizeAcademicSemester(rec.semester || key.split('-').pop());

    if (rCode === targetCode && rSem === targetSem) {
      return rec;
    }
  }

  return undefined;
}

export function useSyllabusLifecycle(courses: Course[] = [], userCollegeId?: string) {
  // 1. Load persisted records from localStorage
  const [records, setRecords] = useState<Record<string, SyllabusDevelopmentRecord>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Atomic state updater that synchronously writes to localStorage and state
  const updateRecords = useCallback((
    fn: (prev: Record<string, SyllabusDevelopmentRecord>) => Record<string, SyllabusDevelopmentRecord>
  ) => {
    setRecords(prev => {
      const next = fn(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist syllabus lifecycle records:', e);
      }
      return next;
    });
  }, []);

  // 2. Aggregate courses into groups
  const groups: SyllabusGroup[] = useMemo(() => {
    const relevantCourses = userCollegeId
      ? courses.filter(c => !c.collegeId || c.collegeId === userCollegeId)
      : courses;

    const groupMap = new Map<string, {
      id: string;
      courseCode: string;
      courseTitle: string;
      schoolYear: string;
      semester: string;
      collegeId: string;
      departmentId?: string;
      courseIds: string[];
      instructorIds: string[];
      instructorNames: string[];
      sections: string[];
    }>();

    for (const c of relevantCourses) {
      const gId = makeSyllabusGroupId(c);
      let g = groupMap.get(gId);

      // Check if any existing group matches this course by code & semester or title & semester
      if (!g) {
        for (const existing of groupMap.values()) {
          const codesMatch =
            Boolean(c.code && existing.courseCode &&
            normalizeCourseCode(c.code) === normalizeCourseCode(existing.courseCode));
          const titlesMatch =
            Boolean(c.title && existing.courseTitle &&
            c.title.trim().toLowerCase() === existing.courseTitle.trim().toLowerCase());
          const semsMatch =
            normalizeAcademicSemester(c.semester || c.term) === normalizeAcademicSemester(existing.semester);

          if ((codesMatch || titlesMatch) && semsMatch) {
            g = existing;
            break;
          }
        }
      }

      if (!g) {
        const canonicalCode = (c.code || '').trim() || (c.title || '').trim();
        const cleanSem = normalizeAcademicSemester(c.semester || c.term);
        const sy = c.schoolYear || c.term?.match(/\b\d{4}[-–]\d{4}\b/)?.[0] || '2026-2027';

        g = {
          id: gId,
          courseCode: canonicalCode,
          courseTitle: (c.title || '').trim() || canonicalCode,
          schoolYear: sy,
          semester: cleanSem,
          collegeId: c.collegeId || userCollegeId || '',
          departmentId: c.departmentId,
          courseIds: [],
          instructorIds: [],
          instructorNames: [],
          sections: []
        };
        groupMap.set(g.id, g);
      } else {
        // Upgrade group fields if this course has better/more specific information
        const incomingSy = c.schoolYear || c.term?.match(/\b\d{4}[-–]\d{4}\b/)?.[0];
        if (incomingSy && (!g.schoolYear || g.schoolYear === 'CURRENT' || incomingSy > g.schoolYear)) {
          g.schoolYear = incomingSy;
        }
        if (c.title && (!g.courseTitle || g.courseTitle.length < c.title.trim().length)) {
          g.courseTitle = c.title.trim();
        }
        if (c.departmentId && !g.departmentId) {
          g.departmentId = c.departmentId;
        }
        if (c.collegeId && !g.collegeId) {
          g.collegeId = c.collegeId;
        }
      }

      if (c.id && !g.courseIds.includes(c.id)) {
        g.courseIds.push(c.id);
      }
      if (c.instructorId && !g.instructorIds.includes(c.instructorId)) {
        g.instructorIds.push(c.instructorId);
      }
      if (c.instructorName && !g.instructorNames.includes(c.instructorName)) {
        g.instructorNames.push(c.instructorName);
      }
      if (c.section && !g.sections.includes(c.section)) {
        g.sections.push(c.section);
      }
    }

    // Natural sort sections for each group (e.g. 4-A, 4-B, 4-E, 4-F)
    for (const g of groupMap.values()) {
      g.sections.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }

    return Array.from(groupMap.values()).map(g => {
      const existingRecord = findMatchingRecord(records, g.id, g.courseCode, g.semester);
      const initialAgreements: Record<string, boolean> = {};
      for (const instId of g.instructorIds) {
        initialAgreements[instId] = false;
      }

      return {
        id: g.id,
        courseCode: g.courseCode,
        courseTitle: g.courseTitle,
        schoolYear: g.schoolYear,
        semester: g.semester,
        collegeId: g.collegeId,
        departmentId: g.departmentId,
        courseIds: g.courseIds,
        instructorIds: g.instructorIds,
        instructorNames: g.instructorNames,
        sections: g.sections,
        status: existingRecord?.status || 'locked',
        submissionAgreements: existingRecord?.submissionAgreements || initialAgreements,
        evaluators: existingRecord?.evaluators || [],
        syllabusData: existingRecord?.syllabusData || null,
        updatedAt: existingRecord?.updatedAt || new Date().toISOString()
      };
    });
  }, [courses, userCollegeId, records]);

  // Sync missing records into storage
  useEffect(() => {
    updateRecords(prev => {
      let changed = false;
      const next = { ...prev };

      for (const g of groups) {
        let existing = next[g.id];
        if (!existing) {
          // Check for legacy record to migrate forward
          const legacy = findMatchingRecord(next, g.id, g.courseCode, g.semester);
          if (legacy) {
            existing = {
              ...legacy,
              id: g.id,
              courseCode: g.courseCode,
              courseTitle: g.courseTitle,
              schoolYear: g.schoolYear,
              semester: g.semester,
              courseIds: g.courseIds,
              instructorIds: g.instructorIds,
              sections: g.sections
            };
            next[g.id] = existing;
            changed = true;
          }
        }

        if (!next[g.id]) {
          const initialAgreements: Record<string, boolean> = {};
          for (const instId of g.instructorIds) {
            initialAgreements[instId] = false;
          }

          next[g.id] = {
            id: g.id,
            courseCode: g.courseCode,
            courseTitle: g.courseTitle,
            schoolYear: g.schoolYear,
            semester: g.semester,
            collegeId: g.collegeId,
            departmentId: g.departmentId,
            courseIds: g.courseIds,
            instructorIds: g.instructorIds,
            sections: g.sections,
            status: 'locked',
            submissionAgreements: initialAgreements,
            evaluators: [],
            updatedAt: new Date().toISOString()
          };
          changed = true;
        } else {
          // Merge newly added course sections / instructors into the existing record
          const record = next[g.id];
          const hasNewSections = g.sections.some(s => !record.sections?.includes(s));
          const hasNewInstructors = g.instructorIds.some(i => !record.instructorIds?.includes(i));
          const hasNewCourseIds = g.courseIds.some(cId => !record.courseIds?.includes(cId));

          if (hasNewSections || hasNewInstructors || hasNewCourseIds) {
            const updatedAgreements = { ...(record.submissionAgreements || {}) };
            for (const instId of g.instructorIds) {
              if (updatedAgreements[instId] === undefined) {
                updatedAgreements[instId] = false;
              }
            }
            next[g.id] = {
              ...record,
              courseIds: Array.from(new Set([...(record.courseIds || []), ...g.courseIds])),
              instructorIds: Array.from(new Set([...(record.instructorIds || []), ...g.instructorIds])),
              sections: Array.from(new Set([...(record.sections || []), ...g.sections])),
              submissionAgreements: updatedAgreements
            };
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [groups, updateRecords]);

  const getRecord = useCallback((groupId: string): SyllabusDevelopmentRecord | undefined => {
    return findMatchingRecord(records, groupId);
  }, [records]);

  // Chair releases courses for development
  const releaseCourses = useCallback((groupIds: string[], chairId: string) => {
    updateRecords(prev => {
      const next = { ...prev };
      const now = new Date().toISOString();

      for (const id of groupIds) {
        const existing = next[id];
        if (existing) {
          next[id] = {
            ...existing,
            status: 'in_development',
            releasedAt: now,
            releasedBy: chairId,
            updatedAt: now
          };
        } else {
          const targetGroup = groups.find(g => g.id === id);
          if (targetGroup) {
            next[id] = {
              id,
              courseCode: targetGroup.courseCode,
              courseTitle: targetGroup.courseTitle,
              schoolYear: targetGroup.schoolYear,
              semester: targetGroup.semester,
              collegeId: targetGroup.collegeId,
              departmentId: targetGroup.departmentId,
              courseIds: targetGroup.courseIds,
              instructorIds: targetGroup.instructorIds,
              sections: targetGroup.sections,
              status: 'in_development',
              releasedAt: now,
              releasedBy: chairId,
              submissionAgreements: { ...targetGroup.submissionAgreements },
              evaluators: [],
              updatedAt: now
            };
          }
        }
      }
      return next;
    });
  }, [groups, updateRecords]);

  // Instructor confirms agreement to submit
  const confirmAgreement = useCallback((groupId: string, instructorId: string) => {
    updateRecords(prev => {
      const existing = prev[groupId];
      const targetGroup = groups.find(g => g.id === groupId);
      const instructors = existing?.instructorIds || targetGroup?.instructorIds || [instructorId];

      const agreements: Record<string, boolean> = {
        ...(existing?.submissionAgreements || {}),
        [instructorId]: true
      };

      const allAgreed = instructors.length > 0 && instructors.every(id => Boolean(agreements[id]));
      const nextStatus = allAgreed ? 'ready_for_evaluation' : 'submission_in_progress';
      const now = new Date().toISOString();

      const updated: SyllabusDevelopmentRecord = {
        ...(existing || {
          id: groupId,
          courseCode: targetGroup?.courseCode || '',
          courseTitle: targetGroup?.courseTitle || '',
          schoolYear: targetGroup?.schoolYear || '',
          semester: targetGroup?.semester || '',
          collegeId: targetGroup?.collegeId || '',
          departmentId: targetGroup?.departmentId,
          courseIds: targetGroup?.courseIds || [],
          instructorIds: instructors,
          sections: targetGroup?.sections || [],
          evaluators: []
        }),
        status: nextStatus,
        submissionAgreements: agreements,
        updatedAt: now
      };

      return {
        ...prev,
        [groupId]: updated
      };
    });
  }, [groups, updateRecords]);

  // Chair assigns one or more evaluators
  const assignEvaluators = useCallback((groupId: string, evaluators: Array<{ id: string; name: string }>) => {
    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;

      const evaluatorReviews: EvaluatorReview[] = evaluators.map(e => ({
        evaluatorId: e.id,
        evaluatorName: e.name,
        status: 'pending'
      }));

      const now = new Date().toISOString();
      return {
        ...prev,
        [groupId]: {
          ...existing,
          status: 'under_evaluation',
          evaluators: evaluatorReviews,
          updatedAt: now
        }
      };
    });
  }, [updateRecords]);

  // Evaluator submits review (approve or request revisions)
  const submitEvaluatorReview = useCallback((
    groupId: string,
    evaluatorId: string,
    status: 'approved' | 'revisions_requested',
    remarks?: string
  ) => {
    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;

      const now = new Date().toISOString();
      const nextReviews = existing.evaluators.map(r => {
        if (r.evaluatorId === evaluatorId) {
          return {
            ...r,
            status,
            remarks: remarks || r.remarks,
            reviewedAt: now
          };
        }
        return r;
      });

      let nextStatus = existing.status;
      let nextAgreements = { ...existing.submissionAgreements };

      if (status === 'revisions_requested') {
        nextStatus = 'revisions_required';
        for (const instId of existing.instructorIds) {
          nextAgreements[instId] = false;
        }
      } else if (status === 'approved') {
        const allApproved = nextReviews.length > 0 && nextReviews.every(r => r.status === 'approved');
        if (allApproved) {
          nextStatus = 'evaluator_approved';
        } else {
          nextStatus = 'under_evaluation';
        }
      }

      return {
        ...prev,
        [groupId]: {
          ...existing,
          status: nextStatus,
          evaluators: nextReviews,
          submissionAgreements: nextAgreements,
          updatedAt: now
        }
      };
    });
  }, [updateRecords]);

  // Chair approval
  const chairApprove = useCallback((groupId: string, chairId: string) => {
    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;

      const now = new Date().toISOString();
      return {
        ...prev,
        [groupId]: {
          ...existing,
          status: 'chair_approved',
          chairApprovedAt: now,
          chairApprovedBy: chairId,
          updatedAt: now
        }
      };
    });
  }, [updateRecords]);

  // Dean final approval with propagation callback
  const deanApprove = useCallback((
    groupId: string,
    deanId: string,
    onPropagate?: (courseIds: string[], syllabus: OfficialSyllabusData) => void
  ) => {
    let targetRecord: SyllabusDevelopmentRecord | undefined;

    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;

      const now = new Date().toISOString();
      const syllabus = existing.syllabusData || createBaselineSyllabus();

      targetRecord = {
        ...existing,
        status: 'approved',
        deanApprovedAt: now,
        deanApprovedBy: deanId,
        syllabusData: syllabus,
        updatedAt: now
      };

      return {
        ...prev,
        [groupId]: targetRecord
      };
    });

    if (onPropagate && targetRecord && targetRecord.courseIds.length > 0) {
      onPropagate(targetRecord.courseIds, targetRecord.syllabusData || createBaselineSyllabus());
    }
  }, [updateRecords]);

  // Update syllabus draft content for this group
  const updateSyllabusData = useCallback((groupId: string, syllabusData: OfficialSyllabusData) => {
    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;

      const now = new Date().toISOString();
      return {
        ...prev,
        [groupId]: {
          ...existing,
          syllabusData,
          updatedAt: now
        }
      };
    });
  }, [updateRecords]);

  return {
    groups,
    records,
    getRecord,
    releaseCourses,
    confirmAgreement,
    assignEvaluators,
    submitEvaluatorReview,
    chairApprove,
    deanApprove,
    updateSyllabusData
  };
}
