import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Course } from '../../../shared/types/lms';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import { normalizeAcademicSemester } from '../../../shared/utils/academicSemester';
import { createBaselineSyllabus } from './useSyllabusDraftsStorage';
import type {
  SyllabusGroup,
  SyllabusDevelopmentRecord,
  EvaluatorReview,
  SyllabusLifecycleStatus
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

export function useSyllabusLifecycle(
  courses: Course[] = [],
  userCollegeId?: string,
  users: Array<{ id: string; name: string }> = []
) {
  // 1. Load persisted records from localStorage
  const [records, setRecords] = useState<Record<string, SyllabusDevelopmentRecord>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const recordsRef = useRef(records);
  recordsRef.current = records;

  // Atomic state updater that synchronously writes to localStorage and state
  const updateRecords = useCallback((
    fn: (prev: Record<string, SyllabusDevelopmentRecord>) => Record<string, SyllabusDevelopmentRecord>
  ) => {
    const next = fn(recordsRef.current);
    recordsRef.current = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to persist syllabus lifecycle records:', e);
    }
    setRecords(next);
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

      const matchedUser = users.find(u => u.id === c.instructorId);
      const effectiveName = matchedUser?.name || c.instructorName || 'Faculty Member';

      if (c.instructorId) {
        if (!g.instructorIds.includes(c.instructorId)) {
          g.instructorIds.push(c.instructorId);
          g.instructorNames.push(effectiveName);
        } else if (matchedUser?.name) {
          const idx = g.instructorIds.indexOf(c.instructorId);
          if (idx !== -1 && g.instructorNames[idx] !== matchedUser.name) {
            g.instructorNames[idx] = matchedUser.name;
          }
        }
      } else if (effectiveName && !g.instructorNames.includes(effectiveName)) {
        g.instructorNames.push(effectiveName);
      }

      if (c.section && !g.sections.includes(c.section)) {
        g.sections.push(c.section);
      }
    }

    // Natural sort sections for each group (e.g. 4-A, 4-B, 4-E, 4-F)
    for (const g of groupMap.values()) {
      g.sections.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }

    const STATUS_WEIGHT: Record<string, number> = {
      locked: 0,
      in_development: 1,
      submission_in_progress: 2,
      ready_for_evaluation: 3,
      under_evaluation: 4,
      revisions_required: 5,
      evaluator_approved: 6,
      chair_approved: 7,
      approved: 8
    };

    return Array.from(groupMap.values()).map(g => {
      const existingRecord = findMatchingRecord(records, g.id, g.courseCode, g.semester);
      const initialAgreements: Record<string, boolean> = {};
      for (const instId of g.instructorIds) {
        initialAgreements[instId] = false;
      }

      // Build instructorSections mapping from course data
      const instructorSections: Record<string, string[]> = {};
      
      const groupCourses = relevantCourses.filter(
        c =>
          g.courseIds.some(id => String(id).trim() === String(c.id).trim()) ||
          (Boolean(c.code && g.courseCode) &&
            normalizeCourseCode(c.code) === normalizeCourseCode(g.courseCode) &&
            normalizeAcademicSemester(c.semester || c.term) === normalizeAcademicSemester(g.semester))
      );
      
      // Map instructors to their sections
      for (const c of groupCourses) {
        if (c.instructorId && c.section) {
          if (!instructorSections[c.instructorId]) {
            instructorSections[c.instructorId] = [];
          }
          if (!instructorSections[c.instructorId].includes(c.section)) {
            instructorSections[c.instructorId].push(c.section);
          }
        }
      }

      const hasBackendCourses = groupCourses.length > 0;
      const anyBackendLocked = hasBackendCourses && groupCourses.some(c => c.syllabusStatus === 'locked');
      const allBackendLocked = hasBackendCourses && groupCourses.every(c => c.syllabusStatus === 'locked');

      let maxBackendStatus: string | undefined;
      let maxBackendWeight = 0;
      for (const c of groupCourses) {
        if (c.syllabusStatus && c.syllabusStatus !== 'locked') {
          const w = STATUS_WEIGHT[c.syllabusStatus] ?? 0;
          if (w > maxBackendWeight) {
            maxBackendWeight = w;
            maxBackendStatus = c.syllabusStatus;
          }
        }
      }

      const wasExplicitlyLocked = existingRecord?.status === 'locked' && Boolean(existingRecord.lockedAt);
      const isNewerBackendRelease = groupCourses.some(
        c =>
          c.syllabusStatus === 'in_development' &&
          c.syllabusReleasedAt &&
          existingRecord?.lockedAt &&
          new Date(c.syllabusReleasedAt) > new Date(existingRecord.lockedAt)
      );

      let effectiveStatus = existingRecord?.status || 'locked';

      if (allBackendLocked || (anyBackendLocked && !maxBackendStatus)) {
        effectiveStatus = 'locked';
      } else if (wasExplicitlyLocked && !isNewerBackendRelease) {
        effectiveStatus = 'locked';
      } else if (maxBackendStatus) {
        effectiveStatus = maxBackendStatus as any;
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
        instructorSections,
        sections: g.sections,
        status: effectiveStatus,
        submissionAgreements: existingRecord?.submissionAgreements || initialAgreements,
        evaluators: existingRecord?.evaluators || [],
        syllabusData: existingRecord?.syllabusData || null,
        updatedAt: existingRecord?.updatedAt || new Date().toISOString()
      };
    });
  }, [courses, userCollegeId, records, users]);

  // Sync missing records into storage
  useEffect(() => {
    const groupsNeedingSync = groups.filter(g => {
      const rec = records[g.id];
      if (!rec) return true;
      if (rec.status !== g.status) return true;
      if (g.sections.some(s => !rec.sections?.includes(s))) return true;
      if (g.instructorIds.some(i => !rec.instructorIds?.includes(i))) return true;
      if (g.courseIds.some(cId => !rec.courseIds?.includes(cId))) return true;
      return false;
    });
    if (groupsNeedingSync.length === 0) return;

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
              status: g.status,
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
            status: g.status,
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
          const shouldSyncStatus = record.status !== g.status;

          if (hasNewSections || hasNewInstructors || hasNewCourseIds || shouldSyncStatus) {
            const updatedAgreements = { ...(record.submissionAgreements || {}) };
            for (const instId of g.instructorIds) {
              if (updatedAgreements[instId] === undefined) {
                updatedAgreements[instId] = false;
              }
            }
            next[g.id] = {
              ...record,
              status: g.status,
              courseIds: Array.from(new Set([...(record.courseIds || []), ...g.courseIds])),
              instructorIds: Array.from(new Set([...(record.instructorIds || []), ...g.instructorIds])),
              sections: Array.from(new Set([...(record.sections || []), ...g.sections])),
              submissionAgreements: updatedAgreements,
              updatedAt: shouldSyncStatus ? new Date().toISOString() : record.updatedAt
            };
            changed = true;
          }
        }
      }

      return changed ? next : prev;
    });
  }, [groups.map(g => g.id).join(','), updateRecords]);

  const getRecord = useCallback((groupId: string): SyllabusDevelopmentRecord | undefined => {
    return findMatchingRecord(records, groupId);
  }, [records]);

  // Chair releases courses for development
  const releaseCourses = useCallback((
    groupIds: string[],
    chairId: string,
    onPersist?: (courseIds: string[], status: string) => void
  ) => {
    const affectedCourseIds: string[] = [];
    for (const id of groupIds) {
      const existing = records[id];
      const targetGroup = groups.find(g => g.id === id);
      const cIds = existing?.courseIds || targetGroup?.courseIds || [];
      affectedCourseIds.push(...cIds);
    }

    updateRecords(prev => {
      const next = { ...prev };
      const now = new Date().toISOString();

      for (const id of groupIds) {
        const existing = next[id];
        const targetGroup = groups.find(g => g.id === id);

        if (existing) {
          next[id] = {
            ...existing,
            status: 'in_development',
            releasedAt: now,
            releasedBy: chairId,
            updatedAt: now
          };
        } else {
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

    if (onPersist && affectedCourseIds.length > 0) {
      onPersist(Array.from(new Set(affectedCourseIds)), 'in_development');
    }
  }, [groups, records, updateRecords]);

  // Chair locks courses to halt syllabus development
  const lockCourses = useCallback((
    groupIds: string[],
    chairId: string,
    onPersist?: (courseIds: string[], status: string) => void
  ) => {
    const affectedCourseIds: string[] = [];
    for (const id of groupIds) {
      const existing = records[id];
      const targetGroup = groups.find(g => g.id === id);
      const cIds = existing?.courseIds || targetGroup?.courseIds || [];
      affectedCourseIds.push(...cIds);
    }

    updateRecords(prev => {
      const next = { ...prev };
      const now = new Date().toISOString();

      for (const id of groupIds) {
        const existing = next[id];
        const targetGroup = groups.find(g => g.id === id);

        if (existing) {
          next[id] = {
            ...existing,
            status: 'locked',
            lockedAt: now,
            lockedBy: chairId,
            updatedAt: now
          };
        } else if (targetGroup) {
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
            status: 'locked',
            lockedAt: now,
            lockedBy: chairId,
            submissionAgreements: { ...targetGroup.submissionAgreements },
            evaluators: [],
            updatedAt: now
          };
        }
      }
      return next;
    });

    if (onPersist && affectedCourseIds.length > 0) {
      onPersist(Array.from(new Set(affectedCourseIds)), 'locked');
    }
  }, [groups, records, updateRecords]);

  // Instructor confirms agreement to submit
  const confirmAgreement = useCallback((
    groupId: string,
    instructorId: string,
    onPersist?: (courseIds: string[], status: string) => void
  ) => {
    const targetGroup = groups.find(g => g.id === groupId);
    let resolvedStatus: SyllabusLifecycleStatus = 'submission_in_progress';
    let affectedCourseIds: string[] = targetGroup?.courseIds || [];

    updateRecords(prev => {
      const existing = prev[groupId];
      const instructors = existing?.instructorIds || targetGroup?.instructorIds || [instructorId];
      affectedCourseIds = existing?.courseIds || targetGroup?.courseIds || [];

      const agreements: Record<string, boolean> = {
        ...(existing?.submissionAgreements || {}),
        [instructorId]: true
      };

      const allAgreed = instructors.length > 0 && instructors.every(id => Boolean(agreements[id]));
      resolvedStatus = allAgreed ? 'ready_for_evaluation' : 'submission_in_progress';
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
        status: resolvedStatus,
        submissionAgreements: agreements,
        updatedAt: now
      };

      return {
        ...prev,
        [groupId]: updated
      };
    });

    if (onPersist && affectedCourseIds.length > 0) {
      onPersist(Array.from(new Set(affectedCourseIds)), resolvedStatus);
    }
  }, [groups, updateRecords]);

  // Instructor retracts agreement to edit syllabus (as long as consensus was not yet complete)
  const retractAgreement = useCallback((
    groupId: string,
    instructorId: string,
    onPersist?: (courseIds: string[], status: string) => void
  ) => {
    let affectedCourseIds: string[] = [];
    let resolvedStatus: SyllabusLifecycleStatus | null = null;

    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;
      if (existing.status === 'under_evaluation' || existing.status === 'chair_approved' || existing.status === 'approved') {
        return prev;
      }

      affectedCourseIds = existing.courseIds || [];
      const agreements: Record<string, boolean> = {
        ...(existing.submissionAgreements || {}),
        [instructorId]: false
      };

      const anyAgreed = Object.values(agreements).some(Boolean);
      const nextStatus: SyllabusLifecycleStatus = anyAgreed ? 'submission_in_progress' : 'in_development';
      resolvedStatus = nextStatus;
      const now = new Date().toISOString();

      return {
        ...prev,
        [groupId]: {
          ...existing,
          status: nextStatus,
          submissionAgreements: agreements,
          updatedAt: now
        }
      };
    });

    if (onPersist && resolvedStatus && affectedCourseIds.length > 0) {
      onPersist(Array.from(new Set(affectedCourseIds)), resolvedStatus);
    }
  }, [updateRecords]);

  // Chair assigns one or more evaluators
  const assignEvaluators = useCallback((
    groupId: string,
    evaluators: Array<{ id: string; name: string }>,
    onPersist?: (courseIds: string[], status: string) => void
  ) => {
    let affectedCourseIds: string[] = [];
    const evaluatorReviews: EvaluatorReview[] = evaluators.map(e => ({
      evaluatorId: e.id,
      evaluatorName: e.name,
      status: 'pending'
    }));
    const now = new Date().toISOString();

    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;
      affectedCourseIds = existing.courseIds || [];

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

    if (onPersist && affectedCourseIds.length > 0) {
      onPersist(Array.from(new Set(affectedCourseIds)), 'under_evaluation');
    }
  }, [updateRecords]);

  // Evaluator submits review (approve or request revisions)
  const submitEvaluatorReview = useCallback((
    groupId: string,
    evaluatorId: string,
    status: 'approved' | 'revisions_requested',
    remarks?: string,
    onPersist?: (courseIds: string[], status: string) => void
  ) => {
    let affectedCourseIds: string[] = [];
    let resolvedStatus: SyllabusLifecycleStatus = 'under_evaluation';

    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;
      affectedCourseIds = existing.courseIds || [];
      const now = new Date().toISOString();

      const nextReviews = (existing.evaluators || []).map(r => {
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

      let nextStatus = existing.status || 'under_evaluation';
      let nextAgreements = { ...(existing.submissionAgreements || {}) };

      if (status === 'revisions_requested') {
        nextStatus = 'revisions_required';
        for (const instId of (existing.instructorIds || [])) {
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

      resolvedStatus = nextStatus;

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

    if (onPersist && affectedCourseIds.length > 0) {
      onPersist(Array.from(new Set(affectedCourseIds)), resolvedStatus);
    }
  }, [updateRecords]);

  // Synchronize remote agreements, status and evaluators from Likha ERP draft / WebSocket / peers
  const syncRemoteAgreements = useCallback((
    groupId: string,
    agreements: Record<string, boolean>,
    status?: SyllabusLifecycleStatus,
    evaluators?: EvaluatorReview[]
  ) => {
    updateRecords(prev => {
      const existing = prev[groupId];
      const targetGroup = groups.find(g => g.id === groupId);
      const instructors = existing?.instructorIds || targetGroup?.instructorIds || [];
      const mergedAgreements = {
        ...(existing?.submissionAgreements || {}),
        ...agreements
      };
      const allAgreed = instructors.length > 0 && instructors.every(id => Boolean(mergedAgreements[id]));
      const anyAgreed = Object.values(mergedAgreements).some(Boolean);
      const calculatedStatus: SyllabusLifecycleStatus = allAgreed
        ? 'ready_for_evaluation'
        : anyAgreed
        ? 'submission_in_progress'
        : (existing?.status || 'in_development');

      const nextStatus = status || calculatedStatus;
      const nextEvaluators = evaluators || existing?.evaluators || [];

      // NO-OP guard: avoid loop / redundant state write if state hasn't changed
      if (existing) {
        const statusSame = existing.status === nextStatus;
        const agreementsSame = JSON.stringify(existing.submissionAgreements || {}) === JSON.stringify(mergedAgreements);
        const evaluatorsSame = JSON.stringify(existing.evaluators || []) === JSON.stringify(nextEvaluators);
        if (statusSame && agreementsSame && evaluatorsSame) {
          return prev;
        }
      }

      const now = new Date().toISOString();

      return {
        ...prev,
        [groupId]: {
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
          submissionAgreements: mergedAgreements,
          status: nextStatus,
          evaluators: nextEvaluators,
          updatedAt: now
        }
      };
    });
  }, [groups, updateRecords]);

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
    const existingRec = records[groupId];
    const targetGroup = groups.find(g => g.id === groupId);
    const affectedCourseIds = existingRec?.courseIds || targetGroup?.courseIds || [];
    const syllabus = existingRec?.syllabusData || createBaselineSyllabus();

    updateRecords(prev => {
      const existing = prev[groupId];
      if (!existing) return prev;

      const now = new Date().toISOString();

      return {
        ...prev,
        [groupId]: {
          ...existing,
          status: 'approved',
          deanApprovedAt: now,
          deanApprovedBy: deanId,
          syllabusData: syllabus,
          updatedAt: now
        }
      };
    });

    if (onPropagate && affectedCourseIds.length > 0) {
      onPropagate(affectedCourseIds, syllabus);
    }
  }, [groups, records, updateRecords]);

  // Update syllabus draft content for this group
  const updateSyllabusData = useCallback((groupId: string, syllabusData: OfficialSyllabusData) => {
    updateRecords(prev => {
      const existing = prev[groupId] || findMatchingRecord(prev, groupId);
      if (existing?.status === 'locked') {
        return prev;
      }
      const now = new Date().toISOString();
      return {
        ...prev,
        [groupId]: {
          ...(existing || {
            id: groupId,
            courseCode: '',
            courseTitle: '',
            schoolYear: '',
            semester: '',
            courseIds: [],
            instructorIds: [],
            sections: [],
            status: 'in_development',
            submissionAgreements: {},
            evaluators: []
          }),
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
    lockCourses,
    confirmAgreement,
    retractAgreement,
    syncRemoteAgreements,
    assignEvaluators,
    submitEvaluatorReview,
    chairApprove,
    deanApprove,
    updateSyllabusData
  };
}
