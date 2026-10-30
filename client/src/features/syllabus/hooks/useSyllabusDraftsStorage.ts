import { useState, useCallback, useMemo } from 'react';
import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../shared/data/syllabusData';
import type { SyllabusDraftItem } from '../types/creator';

export const STORAGE_KEY = 'gabay_syllabus_creator_drafts';

export function createBaselineSyllabus(overrides?: Partial<OfficialSyllabusData>): OfficialSyllabusData {
  return {
    institution: {
      university: 'Don Mariano Marcos Memorial State University',
      college: 'College of Computer Science',
      formCode: 'DMMMSU-INS-F003',
      revision: 'REV. 02 (06.23.2025)'
    },
    courseInfo: {
      code: 'CS 101',
      title: 'Introduction to Computing',
      semester: 'First Semester',
      academicYear: '2026-2027',
      type: '',
      credit: '',
      lectureHours: '',
      labHours: '',
      prerequisite: '',
      description: 'An introductory course covering computing concepts, computational thinking, and software applications.'
    },
    facultyMembers: [
      {
        name: 'Faculty Member',
        sections: [
          {
            section: 'BSCS 1A',
            lectureSchedule: '',
            lectureRoom: '',
            labSchedule: '',
            labRoom: ''
          }
        ],
        consultationSlots: [{ days: [], time: '' }]
      }
    ],
    institutionalStatements: {
      ...OFFICIAL_SYLLABUS_CSPC112.institutionalStatements
    },
    programOutcomes: [{ number: 1, description: '' }],
    courseOutcomes: [{ number: 1, statement: '' }],
    courseRequirements: {
      major: [],
      other: []
    },
    gradingSystem: {
      termFormula: '',
      finalFormula: '',
      classStandingComponents: [],
      passingGrade: ''
    },
    projectRubrics: [],
    classroomPolicies: [],
    courseOutline: [],
    learningPlan: [],
    courseMap: [],
    references: [],
    signatories: {
      preparedBy: [{ name: '', title: '' }],
      recommendingApproval: { name: '', title: '' },
      approved: { name: '', title: '' }
    },
    ...overrides
  };
}

function loadStoredDrafts(): SyllabusDraftItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const valid = parsed.filter(
        d => Boolean(d && typeof d === 'object' && d.id && d.data?.courseInfo && d.data?.institution)
      );
      return valid.length > 0 ? valid : [];
    }
    return [];
  } catch {
    return [];
  }
}

export function useSyllabusDraftsStorage() {
  const [drafts, setDrafts] = useState<SyllabusDraftItem[]>(() => {
    const stored = loadStoredDrafts();
    if (stored.length > 0) return stored;
    const initialDraft: SyllabusDraftItem = {
      id: 'draft-default',
      title: 'CS 101 - Introduction to Computing',
      courseCode: 'CS 101',
      updatedAt: new Date().toISOString(),
      data: createBaselineSyllabus()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([initialDraft]));
    } catch {
      // quota or private mode fallback
    }
    return [initialDraft];
  });

  const [activeDraftId, setActiveDraftId] = useState<string>(() => {
    return drafts[0]?.id || 'draft-default';
  });

  const persistDrafts = useCallback((nextDrafts: SyllabusDraftItem[]) => {
    setDrafts(nextDrafts);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDrafts));
    } catch (e) {
      console.warn('[useSyllabusDraftsStorage] Failed to persist to localStorage:', e);
    }
  }, []);

  const activeDraft = useMemo(() => {
    return drafts.find(d => d.id === activeDraftId) || drafts[0] || null;
  }, [drafts, activeDraftId]);

  const selectDraft = useCallback((id: string) => {
    setActiveDraftId(id);
  }, []);

  const createDraft = useCallback((initialData?: Partial<OfficialSyllabusData>, title?: string): SyllabusDraftItem => {
    const data = createBaselineSyllabus(initialData);
    const resolvedTitle = title || `${data.courseInfo.code || 'New Course'} Syllabus`;
    const newDraft: SyllabusDraftItem = {
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: resolvedTitle,
      courseCode: data.courseInfo.code || 'NEW',
      updatedAt: new Date().toISOString(),
      data
    };
    persistDrafts([newDraft, ...drafts]);
    setActiveDraftId(newDraft.id);
    return newDraft;
  }, [drafts, persistDrafts]);

  const updateActiveDraft = useCallback((nextData: OfficialSyllabusData) => {
    if (!activeDraft) return;
    const updatedDrafts = drafts.map(d => {
      if (d.id === activeDraft.id) {
        return {
          ...d,
          title: `${nextData.courseInfo.code || 'Course'} - ${nextData.courseInfo.title || 'Untitled'}`,
          courseCode: nextData.courseInfo.code || d.courseCode,
          updatedAt: new Date().toISOString(),
          data: nextData
        };
      }
      return d;
    });
    persistDrafts(updatedDrafts);
  }, [activeDraft, drafts, persistDrafts]);

  const cloneDraft = useCallback((sourceId: string): SyllabusDraftItem => {
    const source = drafts.find(d => d.id === sourceId) || activeDraft;
    const clonedData = source ? JSON.parse(JSON.stringify(source.data)) : createBaselineSyllabus();
    const newDraft: SyllabusDraftItem = {
      id: `draft-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: `Copy of ${source ? source.title : 'Syllabus'}`,
      courseCode: clonedData.courseInfo.code || 'COPY',
      updatedAt: new Date().toISOString(),
      data: clonedData
    };
    persistDrafts([newDraft, ...drafts]);
    setActiveDraftId(newDraft.id);
    return newDraft;
  }, [drafts, activeDraft, persistDrafts]);

  const deleteDraft = useCallback((targetId: string) => {
    const remaining = drafts.filter(d => d.id !== targetId);
    if (remaining.length === 0) {
      const freshDraft: SyllabusDraftItem = {
        id: `draft-${Date.now()}`,
        title: 'New Syllabus Draft',
        courseCode: 'CS 101',
        updatedAt: new Date().toISOString(),
        data: createBaselineSyllabus()
      };
      persistDrafts([freshDraft]);
      setActiveDraftId(freshDraft.id);
      return;
    }
    persistDrafts(remaining);
    if (activeDraftId === targetId) {
      setActiveDraftId(remaining[0].id);
    }
  }, [drafts, activeDraftId, persistDrafts]);

  return {
    drafts,
    activeDraft,
    activeDraftId,
    selectDraft,
    createDraft,
    updateActiveDraft,
    cloneDraft,
    deleteDraft
  };
}
