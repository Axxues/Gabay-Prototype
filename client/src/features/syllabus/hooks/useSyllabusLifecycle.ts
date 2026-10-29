import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Course } from '../../../shared/types/lms';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import { createBaselineSyllabus } from './useSyllabusDraftsStorage';
import type {
  SyllabusGroup,
  SyllabusDevelopmentRecord,
  EvaluatorReview
} from '../types/lifecycle';

const STORAGE_KEY = 'gabay_syllabus_lifecycle_records';

export function makeSyllabusGroupId(course: Pick<Course, 'code' | 'title' | 'schoolYear' | 'semester'>): string {
  const code = (course.code || 'UNKNOWN').trim().toUpperCase().replace(/\s+/g, '-');
  const sy = (course.schoolYear || 'CURRENT').trim().replace(/\s+/g, '-');
  const sem = (course.semester || 'TERM').trim().toUpperCase().replace(/\s+/g, '-');
  return `SYL-${code}-${sy}-${sem}`;
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
      if (!g) {
        g = {
          id: gId,
          courseCode: c.code || '',
          courseTitle: c.title || '',
          schoolYear: c.schoolYear || '2026-2027',
          semester: c.semester || 'First',
          collegeId: c.collegeId || userCollegeId || '',
          departmentId: c.departmentId,
          courseIds: [],
          instructorIds: [],
          instructorNames: [],
          sections: []
        };
        groupMap.set(gId, g);
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

    return Array.from(groupMap.values()).map(g => {
      const existingRecord = records[g.id];
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
        }
      }

      return changed ? next : prev;
    });
  }, [groups, updateRecords]);

  const getRecord = useCallback((groupId: string): SyllabusDevelopmentRecord | undefined => {
    return records[groupId];
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
