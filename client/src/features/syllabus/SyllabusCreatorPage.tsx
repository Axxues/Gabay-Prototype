import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLMS } from '../../shared/context/LMSContext';
import { createBaselineSyllabus } from './hooks/useSyllabusDraftsStorage';
import { OFFICIAL_SYLLABUS_CSPC112, OFFICIAL_INSTITUTIONAL_STATEMENTS } from '../../shared/data/syllabusData';
import { useSyllabusLifecycle, normalizeCourseCode } from './hooks/useSyllabusLifecycle';
import { useSyllabusCollaboration } from './hooks/useSyllabusCollaboration';
import { useEvaluationMatrix } from './hooks/useEvaluationMatrix';
import { fetchRemoteDraft, saveRemoteDraft } from './api/syllabusCollaborationApi';
import { SyllabusWizard } from './components/creator/SyllabusWizard';
import { AttachToCourseModal } from './components/creator/AttachToCourseModal';
import { DepartmentSyllabusTable, STATUS_CONFIG } from './components/governance/DepartmentSyllabusTable';
import { AssignEvaluatorsModal } from './components/governance/AssignEvaluatorsModal';
import { EvaluatorReviewModal } from './components/governance/EvaluatorReviewModal';
import { ApprovalActionModal } from './components/governance/ApprovalActionModal';
import { RevisionRemarksBanner } from './components/creator/RevisionRemarksBanner';
import { SyllabusDocumentPreview } from './components/creator/SyllabusDocumentPreview';
import type { SyllabusGroup, EvaluationMatrix } from './types/lifecycle';
import { isChairRole, isDeanRole } from '../../shared/utils/roles';
import { formatSemesterLabel } from '../../shared/utils/academicSemester';
import {
  ShieldAlert,
  Sparkles,
  BookOpen,
  TableProperties,
  ClipboardCheck,
  Lock,
  ArrowRight,
  Eye,
  Radio,
  CheckCircle2,
  Loader2,
  CloudOff,
  ListChecks
} from 'lucide-react';
import { MatrixBuilder } from './components/matrix/MatrixBuilder';
import { ConsolidatedMatrixModal } from './components/matrix/ConsolidatedMatrixModal';

interface SyllabusCreatorPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const SyllabusCreatorPage: React.FC<SyllabusCreatorPageProps> = ({ onNavigateTab: _onNavigateTab }) => {
  const lms = useLMS();
  const navigate = useNavigate();
  const { activeUser, activeRole, db, showAlert, updateCourseSyllabus } = lms;
  const { groupId } = useParams<{ groupId?: string }>();
  const coursesList = db?.courses || (lms as any).courses || [];
  const usersList = db?.users || [];

  // Role resolution - Strictly restrict release authority to Department Chairperson (not dean or admin)
  const isChair = isChairRole(activeUser, activeRole);
  const isDean = isDeanRole(activeUser, activeRole);
  const isAdmin = activeRole === 'admin' || activeRole === 'superadmin';
  const isLeadership = isChair || isDean || isAdmin;

  // Lifecycle Governance Hook
  const {
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
    ensureMatrixSnapshot,
    chairApprove,
    deanApprove,
    updateSyllabusData
  } = useSyllabusLifecycle(coursesList, activeUser?.collegeId, db?.users);

  const {
    template: matrixTemplate,
    getSnapshotForAssign,
    saveTemplate: saveMatrixTemplate,
    resetTemplate: resetMatrixTemplate
  } = useEvaluationMatrix(activeUser?.department, activeUser?.collegeId || '', activeUser?.name);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [consolidatedGroup, setConsolidatedGroup] = useState<SyllabusGroup | null>(null);

  // Faculty Assigned Courses (Filtered to current user)
  const myAssignedGroups = useMemo(() => {
    if (!activeUser?.id) return [];
    return groups.filter(
      g =>
        g.instructorIds.includes(activeUser.id!) ||
        (activeUser.name && g.instructorNames.includes(activeUser.name))
    );
  }, [groups, activeUser?.id, activeUser?.name]);

  // Active view tab (Personal Sandbox is removed; authoring is strictly permitted through approved courses)
  const [activeTab, setActiveTab] = useState<'governance' | 'my-courses' | 'evaluations' | 'matrix'>(() => {
    if (isLeadership) return 'governance';
    return 'my-courses';
  });

  // Active course group opened in Syllabus Studio
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string>(() => {
    const saved = localStorage.getItem('syllabus_activeStepId');
    return saved || 'course-info';
  });

  // Modals state
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [evaluatorAssignGroup, setEvaluatorAssignGroup] = useState<SyllabusGroup | null>(null);
  const [evaluatorReviewGroup, setEvaluatorReviewGroup] = useState<SyllabusGroup | null>(null);
  const [evaluatorSnapshot, setEvaluatorSnapshot] = useState<EvaluationMatrix | null>(null);
  const [approvalModalConfig, setApprovalModalConfig] = useState<{
    type: 'chair' | 'dean';
    group: SyllabusGroup;
  } | null>(null);
  const [previewingGroup, setPreviewingGroup] = useState<SyllabusGroup | null>(null);

  const hydratedGroupRef = useRef<string | null>(null);
  const hydratedTabsRef = useRef<Set<string>>(new Set());

  // Sync URL with state: if groupId in URL changes, update activeGroupId
  useEffect(() => {
    if (groupId && groupId !== activeGroupId) {
      setActiveGroupId(groupId);
    } else if (!groupId && activeGroupId) {
      setActiveGroupId(null);
    }
  }, [groupId, activeGroupId]);

  // Hydrate remote draft agreements/evaluators once per opened studio group
  useEffect(() => {
    if (!groupId) {
      hydratedGroupRef.current = null;
      return;
    }
    if (hydratedGroupRef.current === groupId) {
      return;
    }

    const targetGroup = groups.find(g => g.id === groupId);
    const canonicalId = targetGroup?.courseIds[0];
    if (canonicalId) {
      hydratedGroupRef.current = groupId;
      fetchRemoteDraft(canonicalId).then(remote => {
        if (remote?.payload?.submissionAgreements || remote?.payload?.status || remote?.payload?.evaluators) {
          syncRemoteAgreements(
            groupId,
            remote.payload.submissionAgreements || {},
            remote.payload.status as any,
            remote.payload.evaluators,
            remote.payload.matrixSnapshot
          );
        }
      }).catch(() => {});
    }
  }, [groupId, groups, syncRemoteAgreements]);

  // Tab-level hydration: when governance/matrix/evaluations tab is active,
  // fetch and sync remote drafts for visible groups with evaluators
  useEffect(() => {
    if (!['governance', 'matrix', 'evaluations'].includes(activeTab)) return;
    if (!groups.length) return;

    // Determine which groups to hydrate based on active tab
    let groupsToHydrate: SyllabusGroup[] = [];
    if (activeTab === 'governance' || activeTab === 'matrix') {
      // Chair/Dean sees all groups with evaluators
      groupsToHydrate = groups.filter(g => (g.evaluators?.length ?? 0) > 0 && 
        ['under_evaluation', 'revisions_required', 'evaluator_approved'].includes(g.status));
    } else if (activeTab === 'evaluations') {
      // Evaluator sees only their assigned groups
      groupsToHydrate = groups.filter(g => {
        const myReview = g.evaluators.find(e => e.evaluatorId === activeUser?.id);
        return myReview && ['under_evaluation', 'revisions_required', 'evaluator_approved'].includes(g.status);
      });
    }

    for (const group of groupsToHydrate) {
      const hydrateKey = `${group.id}:${activeTab}`;
      if (hydratedTabsRef.current.has(hydrateKey)) continue;
      hydratedTabsRef.current.add(hydrateKey);

      const canonicalId = group.courseIds[0];
      if (!canonicalId) continue;

      fetchRemoteDraft(canonicalId).then(remote => {
        if (remote?.payload?.submissionAgreements || remote?.payload?.status || remote?.payload?.evaluators || remote?.payload?.matrixSnapshot) {
          syncRemoteAgreements(
            group.id,
            remote.payload.submissionAgreements || {},
            remote.payload.status as any,
            remote.payload.evaluators,
            remote.payload.matrixSnapshot
          );
        }
      }).catch(() => {});
    }
  }, [activeTab, groups, activeUser?.id, syncRemoteAgreements]);

  // Persist active studio state to localStorage (only when on studio route)
  useEffect(() => {
    if (activeGroupId && groupId) {
      localStorage.setItem('syllabus_activeGroupId', activeGroupId);
    } else if (!groupId) {
      localStorage.removeItem('syllabus_activeGroupId');
      localStorage.removeItem('syllabus_activeStepId');
    }
  }, [activeGroupId, groupId]);

  useEffect(() => {
    if (groupId) {
      localStorage.setItem('syllabus_activeStepId', activeStepId);
    }
  }, [activeStepId, groupId]);

  // Active Group Details
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeRecord = activeGroupId ? getRecord(activeGroupId) : undefined;
  const canonicalCourseId = activeGroup?.courseIds[0];

  // Read through a ref so the remote-sync callback keeps a stable identity:
  // it is a dependency of the collaboration WebSocket effect.
  const recordsRef = useRef(records);
  recordsRef.current = records;

  // Compare remote timestamps here before trusting them. This keeps the
  // "sometimes it doesn't save" moment from being re-triggered after a refresh.
  const lastLocalTimestampRef = useRef<number>(0);
  const lastLocalConsensusActionRef = useRef<number>(0);

  // Real-time Collaboration Hook for the actively opened group
  const handleRemoteUpdate = useCallback((remoteData: any, remoteUpdatedAt?: number) => {
    if (!activeGroupId) return;

    const localRecord = recordsRef.current[activeGroupId] as any;
    const localUpdatedAt = localRecord?.updatedAt
      ? new Date(localRecord.updatedAt).getTime()
      : 0;

    // Older-than-yours or equal-to-yours server states are ignored entirely:
    // that is the case that made edits vanish after opening a course.
    if (localUpdatedAt && (!remoteUpdatedAt || remoteUpdatedAt <= localUpdatedAt)) return;

    // A co-editor whose payload lands at the exact same timestamp is from across
    // the same button press; do not clobber your local form with it.
    if (remoteData && remoteUpdatedAt === lastLocalTimestampRef.current) return;

    updateSyllabusData(activeGroupId, remoteData);
    lastLocalTimestampRef.current = remoteUpdatedAt ?? Date.now();
  }, [activeGroupId, updateSyllabusData]);

  const handleRemoteConsensusUpdate = useCallback(
    (agreements: Record<string, boolean>, status?: string, evaluators?: any[], remoteUpdatedAt?: number) => {
      if (!activeGroupId) return;
      if (remoteUpdatedAt && remoteUpdatedAt <= lastLocalConsensusActionRef.current) {
        return;
      }
      syncRemoteAgreements(activeGroupId, agreements, status as any, evaluators);
    },
    [activeGroupId, syncRemoteAgreements]
  );

  const {
    activePresenceNotice,
    broadcastSectionUpdate,
    broadcastStepChange,
    broadcastConsensusUpdate,
    collaborators,
    syncStatus,
    retrySave
  } = useSyllabusCollaboration(
    activeGroupId || undefined,
    activeUser,
    activeStepId,
    canonicalCourseId,
    handleRemoteUpdate,
    handleRemoteConsensusUpdate
  );

  // RBAC Access Gate
  if (!['superadmin', 'admin', 'faculty'].includes(activeRole as any)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md w-full p-8 text-center bg-card border border-border rounded-2xl shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Access Restricted</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Syllabus Development is an academic authoring tool restricted to faculty and academic leadership. If you need access, please consult your department chairperson.
          </p>
        </div>
      </div>
    );
  }

  // Baseline syllabus generator tailored to a specific course group
  const getBaselineForGroup = useCallback((grp: SyllabusGroup) => {
    const matchedCourse = coursesList.find(c => grp.courseIds.includes(c.id));
    const targetCollegeId = grp.collegeId || matchedCourse?.collegeId || activeUser?.collegeId;
    const activeSem = typeof lms?.getActiveSemesterForCollege === 'function'
      ? formatSemesterLabel(lms.getActiveSemesterForCollege(targetCollegeId) || lms.baselineSemester || 'First')
      : (grp.semester ? formatSemesterLabel(grp.semester as any) : 'First Semester');
    const activeSY = typeof lms?.getActiveSchoolYearForCollege === 'function'
      ? ((targetCollegeId ? lms.getActiveSchoolYearForCollege(targetCollegeId)?.year : undefined) || (typeof lms?.getBaselineSchoolYear === 'function' ? lms.getBaselineSchoolYear()?.year : undefined) || grp.schoolYear || '2026-2027')
      : (grp.schoolYear || '2026-2027');

    return createBaselineSyllabus({
      courseInfo: {
        code: grp.courseCode,
        title: grp.courseTitle,
        semester: activeSem,
        academicYear: activeSY,
        type: '',
        credit: '',
        lectureHours: '',
        labHours: '',
        prerequisite: '',
        description: (matchedCourse as any)?.description || (matchedCourse as any)?.syllabus?.courseInfo?.description || ''
      },
      facultyMembers: grp.instructorNames.map(name => {
        const instCourses = coursesList.filter(
          c => grp.courseIds.includes(c.id) && (c.instructorName === name || c.instructorId === grp.instructorIds[grp.instructorNames.indexOf(name)])
        );
        const assignedSections = instCourses.map(c => c.section).filter(Boolean);
        const uniqueSections = [...new Set(assignedSections)];
        const sectionsData = uniqueSections.length > 0
          ? uniqueSections.map(sec => ({
              section: sec,
              schedule: instCourses.find(c => c.section === sec)?.schedule || '',
              room: instCourses.find(c => c.section === sec)?.room || '',
              lectureSchedule: '',
              lectureRoom: '',
              labSchedule: '',
              labRoom: ''
            }))
          : grp.sections.length > 0
            ? [{ section: grp.sections.join(', '), lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' }]
            : [{ section: '', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' }];

        return {
          name,
          sections: sectionsData,
          consultationSlots: [{ days: [], time: '' }]
        };
      })
    });
  }, [coursesList, activeUser?.collegeId, lms]);

  // Active syllabus data for the open group (enforcing college active semester & school year setup, course code, title, and all faculty)
  const currentSyllabusData = useMemo(() => {
    const rawData = activeRecord?.syllabusData || (activeGroup ? getBaselineForGroup(activeGroup) : createBaselineSyllabus());
    if (!activeGroup) return rawData;

    const targetCollegeId = activeGroup.collegeId || activeUser?.collegeId;
    const activeSem = typeof lms?.getActiveSemesterForCollege === 'function'
      ? formatSemesterLabel(lms.getActiveSemesterForCollege(targetCollegeId) || lms.baselineSemester || 'First')
      : (activeGroup.semester ? formatSemesterLabel(activeGroup.semester as any) : 'First Semester');
    const activeSY = typeof lms?.getActiveSchoolYearForCollege === 'function'
      ? ((targetCollegeId ? lms.getActiveSchoolYearForCollege(targetCollegeId)?.year : undefined) || (typeof lms?.getBaselineSchoolYear === 'function' ? lms.getBaselineSchoolYear()?.year : undefined) || activeGroup.schoolYear || '2026-2027')
      : (activeGroup.schoolYear || '2026-2027');

    const canonicalCode = activeGroup.courseCode || rawData.courseInfo?.code || '';
    const canonicalTitle = activeGroup.courseTitle || rawData.courseInfo?.title || '';

    // Reconcile faculty members so EVERY assigned instructor in activeGroup is present
    let reconciledFaculty = [...(rawData.facultyMembers || [])];
    if (activeGroup.instructorNames && activeGroup.instructorNames.length > 0) {
      reconciledFaculty = activeGroup.instructorNames.map((name, idx) => {
        const existing = (rawData.facultyMembers || []).find(
          f => f.name && f.name.trim().toLowerCase() === name.trim().toLowerCase()
        ) || (rawData.facultyMembers && rawData.facultyMembers[idx]);

        const instCourses = coursesList.filter(
          c => activeGroup.courseIds.includes(c.id) && (c.instructorName === name || c.instructorId === activeGroup.instructorIds[idx])
        );
        const assignedSections = instCourses.map(c => c.section).filter(Boolean);
        const uniqueSections = [...new Set(assignedSections)];

        if (existing && existing.name && existing.name.trim()) {
          const sections = existing.sections && existing.sections.length > 0
            ? existing.sections
            : uniqueSections.length > 0
              ? uniqueSections.map(sec => ({
                  section: sec,
                  schedule: instCourses.find(c => c.section === sec)?.schedule || '',
                  room: instCourses.find(c => c.section === sec)?.room || '',
                  lectureSchedule: '',
                  lectureRoom: '',
                  labSchedule: '',
                  labRoom: ''
                }))
              : [{ section: activeGroup.sections[idx] || activeGroup.sections[0] || '', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' }];

          return {
            name: existing.name || name,
            sections,
            consultationSlots: existing.consultationSlots || [{ days: [], time: '' }]
          };
        }

        const sectionsData = uniqueSections.length > 0
          ? uniqueSections.map(sec => ({
              section: sec,
              schedule: instCourses.find(c => c.section === sec)?.schedule || '',
              room: instCourses.find(c => c.section === sec)?.room || '',
              lectureSchedule: '',
              lectureRoom: '',
              labSchedule: '',
              labRoom: ''
            }))
          : activeGroup.sections.length > 0
            ? [{ section: activeGroup.sections[idx] || activeGroup.sections[0] || '', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' }]
            : [{ section: '', lectureSchedule: '', lectureRoom: '', labSchedule: '', labRoom: '' }];

        return {
          name,
          sections: sectionsData,
          consultationSlots: [{ days: [], time: '' }]
        };
      });
    }

    const institutionalStatements = {
      philosophy: (rawData.institutionalStatements?.philosophy?.trim() && rawData.institutionalStatements.philosophy.trim() !== 'Total human development')
        ? rawData.institutionalStatements.philosophy.trim()
        : OFFICIAL_INSTITUTIONAL_STATEMENTS.philosophy,
      vision: (rawData.institutionalStatements?.vision?.trim() && !rawData.institutionalStatements.vision.includes('A Premier University of the North'))
        ? rawData.institutionalStatements.vision.trim()
        : OFFICIAL_INSTITUTIONAL_STATEMENTS.vision,
      mission: (rawData.institutionalStatements?.mission?.trim() && !rawData.institutionalStatements.mission.includes('Develop human capital for nation building'))
        ? rawData.institutionalStatements.mission.trim()
        : OFFICIAL_INSTITUTIONAL_STATEMENTS.mission,
      goal: (rawData.institutionalStatements?.goal && rawData.institutionalStatements.goal.trim()) || OFFICIAL_INSTITUTIONAL_STATEMENTS.goal,
      coreValues: (rawData.institutionalStatements?.coreValues && rawData.institutionalStatements.coreValues.length > 0)
        ? rawData.institutionalStatements.coreValues
        : OFFICIAL_INSTITUTIONAL_STATEMENTS.coreValues,
      graduateAttributes: (rawData.institutionalStatements?.graduateAttributes && rawData.institutionalStatements.graduateAttributes.length > 0)
        ? rawData.institutionalStatements.graduateAttributes
        : OFFICIAL_INSTITUTIONAL_STATEMENTS.graduateAttributes
    };

    const institution = {
      university: rawData.institution?.university?.trim() || OFFICIAL_SYLLABUS_CSPC112.institution.university,
      college: rawData.institution?.college?.trim() || OFFICIAL_SYLLABUS_CSPC112.institution.college,
      formCode: rawData.institution?.formCode?.trim() || OFFICIAL_SYLLABUS_CSPC112.institution.formCode,
      revision: rawData.institution?.revision?.trim() || OFFICIAL_SYLLABUS_CSPC112.institution.revision
    };

    // Auto-normalize Program Outcomes and Course Outcomes to strictly sequential 1..N
    const rawPOs = rawData.programOutcomes && rawData.programOutcomes.length > 0
      ? rawData.programOutcomes
      : [{ number: 1, description: '' }];
    const poNumberMap = new Map<number, number>();
    const normalizedPOs = rawPOs.map((po, idx) => {
      const newNum = idx + 1;
      poNumberMap.set(po.number, newNum);
      return {
        ...po,
        number: newNum
      };
    });

    const rawCOs = rawData.courseOutcomes && rawData.courseOutcomes.length > 0
      ? rawData.courseOutcomes
      : [{ number: 1, statement: '' }];
    const coNumberMap = new Map<number, number>();
    const normalizedCOs = rawCOs.map((co, idx) => {
      const newNum = idx + 1;
      coNumberMap.set(co.number, newNum);
      return {
        ...co,
        number: newNum
      };
    });


    const baseCourseMap = (rawData.courseMap && rawData.courseMap.length > 0)
      ? rawData.courseMap
      : normalizedCOs.map(co => ({ coNumber: co.number, coStatement: co.statement || '', poAlignments: {} }));
    const normalizedCourseMap = baseCourseMap.map((cm, idx) => {
      const newCoNum = coNumberMap.get(cm.coNumber) ?? (idx + 1);
      const newAlignments: Record<number, 'I' | 'P' | 'D'> = {};
      Object.entries(cm.poAlignments || {}).forEach(([oldPoKey, val]) => {
        const oldPoNum = Number(oldPoKey);
        const newPoNum = poNumberMap.get(oldPoNum) ?? oldPoNum;
        if (val === 'I' || val === 'P' || val === 'D') {
          newAlignments[newPoNum] = val;
        }
      });
      return {
        ...cm,
        coNumber: newCoNum,
        poAlignments: newAlignments
      };
    });

    return {
      ...rawData,
      institution,
      institutionalStatements,
      programOutcomes: normalizedPOs,
      courseOutcomes: normalizedCOs,
      courseMap: normalizedCourseMap,
      courseInfo: {
        ...(rawData.courseInfo || {}),
        code: canonicalCode,
        title: canonicalTitle,
        semester: activeSem,
        academicYear: activeSY
      },
      facultyMembers: reconciledFaculty
    };
  }, [activeRecord?.syllabusData, activeGroup, activeUser?.collegeId, lms, getBaselineForGroup, coursesList]);

  // Co-instructors status for active group
  const coInstructorAgreements = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.instructorIds.map((id, index) => {
      const name = activeGroup.instructorNames[index] || 'Faculty Member';
      const instCourses = coursesList.filter(
        c => activeGroup.courseIds.includes(c.id) && (c.instructorId === id || c.instructorName === name)
      );
      const sections = [...new Set(instCourses.map(c => c.section).filter(Boolean))].join(', ');
      return {
        id,
        name: sections ? `${name} (${sections})` : name,
        hasAgreed: Boolean(activeRecord?.submissionAgreements?.[id])
      };
    });
  }, [activeGroup, activeRecord, coursesList]);

  const allCoInstructorsAgreed =
    coInstructorAgreements.length > 0 && coInstructorAgreements.every(i => i.hasAgreed);

  // Evaluations assigned to current user
  const myEvaluationGroups = useMemo(() => {
    if (!activeUser?.id) return [];
    return groups.filter(g => g.evaluators.some(e => e.evaluatorId === activeUser.id));
  }, [groups, activeUser?.id]);

  // Open Studio for a course group
  const handleOpenStudio = (group: SyllabusGroup) => {
    if (group.status === 'locked') {
      showAlert({
        title: 'Course Syllabus Locked',
        message: 'This course has not been released by the Department Chairperson for syllabus development.',
        type: 'warning'
      });
      return;
    }
    // If course is under evaluation, ready for evaluation, or already approved, open in read-only document preview
    if (group.status !== 'in_development' && group.status !== 'submission_in_progress' && group.status !== 'revisions_required') {
      setPreviewingGroup(group);
      return;
    }
    setActiveGroupId(group.id);
    navigate(`/syllabus-development/studio/${group.id}`);
    setActiveStepId('course-info');

    // Hydrate remote draft if present on Likha ERP
    const canonicalId = group.courseIds[0];
    if (canonicalId) {
      // A slow fetch must not replace edits made while the studio was opening:
      // only adopt the remote copy when there is no local one or it is newer.
      const localRecord = getRecord(group.id);
      const localUpdatedAt = (localRecord as any)?.updatedAt
        ? new Date((localRecord as any).updatedAt).getTime()
        : 0;
      const localSyllabusData = localRecord?.syllabusData;
      fetchRemoteDraft(canonicalId).then(remote => {
        const remoteData = remote?.payload?.syllabusData;
        const remoteAgreements = remote?.payload?.submissionAgreements;
        const remoteStatus = remote?.payload?.status as any;
        const remoteEvaluators = remote?.payload?.evaluators;
        const remoteUpdatedAt = Number(remote?.payload?.updatedAt) || 0;
        const remoteMissing = !remote || !remoteData;

        if (remoteAgreements || remoteStatus || remoteEvaluators) {
          syncRemoteAgreements(group.id, remoteAgreements || {}, remoteStatus, remoteEvaluators);
        }

        if (localSyllabusData && (remoteMissing || remoteUpdatedAt <= localUpdatedAt)) {
          // Local copy is ahead of the server: an earlier save failed or the tab
          // closed before it flushed. Push it up so the draft self-heals instead
          // of staying stale on every other device.
          saveRemoteDraft(
            canonicalId,
            localSyllabusData,
            activeUser?.id,
            undefined,
            localRecord?.submissionAgreements,
            localRecord?.status,
            localRecord?.evaluators
          ).catch(() => {});
          return;
        }
        if (!remoteData) return;
        updateSyllabusData(group.id, remoteData);
      }).catch(() => {});
    }
  };

  // Close Studio back to list
  const handleCloseStudio = () => {
    navigate('/syllabus-development');
    setActiveGroupId(null);
    setActiveStepId('course-info');
  };

  // If a group's syllabus document preview is active
  if (previewingGroup) {
    const record = getRecord(previewingGroup.id);
    const previewData = record?.syllabusData || getBaselineForGroup(previewingGroup);
    if (!previewData) {
      return (
        <div className="w-full p-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load syllabus preview. Please try again.</p>
          <button
            onClick={() => setPreviewingGroup(null)}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
          >
            ← Return to Syllabus Hub
          </button>
        </div>
      );
    }
    return (
      <div className="w-full space-y-4">
        <button
          onClick={() => setPreviewingGroup(null)}
          className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold"
        >
          ← Return to Syllabus Hub
        </button>
        <SyllabusDocumentPreview
          data={previewData}
          onBack={() => setPreviewingGroup(null)}
        />
      </div>
    );
  }

  // If Studio is actively open for an assigned group
  if (activeGroupId && activeGroup) {
    if (activeGroup.status === 'locked') {
      return (
        <div className="w-full space-y-4 animate-fade-in pb-16">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>This course syllabus development has been locked by the Department Chairperson. Editing is disabled until released.</span>
            </div>
            <button
              onClick={handleCloseStudio}
              className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold cursor-pointer"
            >
              ← Back to Syllabus Hub
            </button>
          </div>
          <SyllabusDocumentPreview
            data={currentSyllabusData}
            onBack={handleCloseStudio}
          />
        </div>
      );
    }

    return (
      <div className="flex-1 w-full space-y-6 animate-fade-in pb-16">
        {/* Studio Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <button
              onClick={handleCloseStudio}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 mb-2 cursor-pointer"
            >
              ← Back to Syllabus Hub
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-foreground">
                {activeGroup.courseCode}: {activeGroup.courseTitle}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                {activeGroup.semester} Semester · AY {activeGroup.schoolYear}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sections: {activeGroup.sections.join(', ')} · Instructors: {activeGroup.instructorNames.join(', ')}
            </p>
          </div>

          {/* Save State + Real-Time Collaborator Presence Chip */}
          <div className="flex flex-wrap items-center gap-2">
          {syncStatus !== 'idle' && (
            syncStatus === 'error' ? (
              <button
                type="button"
                onClick={() => void retrySave()}
                title="The last changes could not be saved to the server. Click to retry."
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold cursor-pointer hover:bg-destructive/20"
              >
                <CloudOff className="w-3.5 h-3.5" />
                <span>Not saved — retry</span>
              </button>
            ) : syncStatus === 'saving' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted border border-border text-muted-foreground text-xs font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving…</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All changes saved</span>
              </span>
            )
          )}
          {activePresenceNotice && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5" />
              <span>{activePresenceNotice}</span>
            </div>
          )}
          </div>
        </div>

        {/* Revision Remarks Banner if Revisions are Required */}
        {activeRecord?.status === 'revisions_required' && activeRecord.evaluators && (
          <RevisionRemarksBanner
            evaluators={activeRecord.evaluators}
            matrixSnapshot={activeRecord.matrixSnapshot}
            courseCode={activeGroup?.courseCode}
            instructorNames={activeGroup?.instructorNames}
          />
        )}

        {/* Wizard Editor */}
        <SyllabusWizard
          data={currentSyllabusData}
          onChange={updated => {
            if (activeGroup.status === 'locked') return;
            updateSyllabusData(activeGroup.id, updated);
            broadcastSectionUpdate(activeStepId, 'Syllabus Updated', updated);
          }}
          onSave={() => {
            if (activeGroup.status === 'locked') {
              showAlert({
                title: 'Syllabus Development Locked',
                message: 'This syllabus cannot be edited or saved because it is locked by the Department Chairperson.',
                type: 'warning'
              });
              return;
            }
            updateSyllabusData(activeGroup.id, currentSyllabusData);
            broadcastSectionUpdate(activeStepId, 'Syllabus Saved', currentSyllabusData);
            showAlert({
              title: 'Syllabus Saved',
              message: 'Your changes have been saved to the course draft.',
              type: 'success'
            });
          }}
          onStepChange={stepId => {
            setActiveStepId(stepId);
            broadcastStepChange(stepId);
          }}
          presenceNotice={activePresenceNotice}
          collaborators={collaborators}
          onAttachToCourse={() => setIsAttachOpen(true)}
          coInstructors={coInstructorAgreements}
          currentUserId={activeUser?.id}
          allAgreed={allCoInstructorsAgreed}
          isEvaluationStarted={['under_evaluation', 'evaluator_approved', 'chair_approved', 'approved'].includes(
            activeGroup?.status || activeRecord?.status || ''
          )}
          onAgreeToSubmit={() => {
            if (activeUser?.id && activeGroup) {
              lastLocalConsensusActionRef.current = Date.now();
              const instructors = activeRecord?.instructorIds || activeGroup.instructorIds || [activeUser.id];
              const newAgreements: Record<string, boolean> = {
                ...(activeRecord?.submissionAgreements || {}),
                [activeUser.id]: true
              };
              const allAgreed = instructors.length > 0 && instructors.every(id => Boolean(newAgreements[id]));
              const nextStatus = allAgreed ? 'ready_for_evaluation' : 'submission_in_progress';

              confirmAgreement(activeGroup.id, activeUser.id, (courseIds, status) => {
                const targetIds = Array.from(new Set([...courseIds, ...(activeGroup.courseIds || [])]));
                if (lms.updateCourseSyllabusStatus && targetIds.length > 0) {
                  void lms.updateCourseSyllabusStatus(targetIds, status, activeUser.id);
                }
              });

              broadcastConsensusUpdate(newAgreements, nextStatus, currentSyllabusData);

              if (canonicalCourseId) {
                void saveRemoteDraft(
                  canonicalCourseId,
                  currentSyllabusData,
                  activeUser.id,
                  undefined,
                  newAgreements,
                  nextStatus,
                  activeRecord?.evaluators
                );
              }

              showAlert({
                title: 'Agreement Confirmed',
                message:
                  coInstructorAgreements.length === 1
                    ? 'Syllabus submitted for evaluation. Your department chairperson will now assign evaluators.'
                    : 'Your submission agreement has been recorded. Once all co-instructors agree, the syllabus will advance to Evaluation.',
                type: 'success'
              });
            }
          }}
          onRetractAgreement={() => {
            if (activeUser?.id && activeGroup) {
              lastLocalConsensusActionRef.current = Date.now();
              const retractedAgreements: Record<string, boolean> = {
                ...(activeRecord?.submissionAgreements || {}),
                [activeUser.id]: false
              };
              const anyAgreed = Object.values(retractedAgreements).some(Boolean);
              const nextStatus = anyAgreed ? 'submission_in_progress' : 'in_development';

              retractAgreement(activeGroup.id, activeUser.id, (courseIds, status) => {
                const targetIds = Array.from(new Set([...courseIds, ...(activeGroup.courseIds || [])]));
                if (lms.updateCourseSyllabusStatus && targetIds.length > 0) {
                  void lms.updateCourseSyllabusStatus(targetIds, status, activeUser.id);
                }
              });

              broadcastConsensusUpdate(retractedAgreements, nextStatus, currentSyllabusData);

              if (canonicalCourseId) {
                void saveRemoteDraft(
                  canonicalCourseId,
                  currentSyllabusData,
                  activeUser.id,
                  undefined,
                  retractedAgreements,
                  nextStatus,
                  activeRecord?.evaluators
                );
              }

              showAlert({
                title: 'Submission Agreement Retracted',
                message: 'Your submission agreement has been retracted. You can continue editing the syllabus.',
                type: 'info'
              });
            }
          }}
        />

        {/* Attach To Course Modal */}
        <AttachToCourseModal
          isOpen={isAttachOpen}
          onClose={() => setIsAttachOpen(false)}
          syllabusData={currentSyllabusData}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full space-y-6 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Academic Authoring Studio</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Syllabus Development
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Institutional curriculum authoring, collaboration, and multi-tier approval governance aligned with DMMMSU-INS-F003.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 border border-border rounded-xl">
          {isLeadership && (
            <button
              onClick={() => setActiveTab('governance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'governance'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Department Governance</span>
            </button>
          )}

          {isChair && (
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Evaluation Matrix</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('my-courses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'my-courses'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>My Assigned Courses</span>
            {myAssignedGroups.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary">
                {myAssignedGroups.length}
              </span>
            )}
          </button>

          {myEvaluationGroups.length > 0 && (
            <button
              onClick={() => setActiveTab('evaluations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'evaluations'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>My Evaluations</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/20 text-purple-600">
                {myEvaluationGroups.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: Department Governance Table (Chair & Dean) */}
      {activeTab === 'governance' && (
        <div className="space-y-4">
          <DepartmentSyllabusTable
            groups={groups}
            userRole={activeRole}
            isChair={isChair}
            canRelease={isChair}
            onOpenMatrix={setConsolidatedGroup}
            onReleaseCourses={async ids => {
              if (!isChair) {
                showAlert({
                  title: 'Unauthorized Action',
                  message: 'Only the Department Chairperson has the authority to release courses for syllabus development.',
                  type: 'error'
                });
                return;
              }
              const chairId = activeUser?.id || 'chair';
              const selectedGroups = groups.filter(g => ids.includes(g.id));
              const targetCourseIds = Array.from(
                new Set([
                  ...selectedGroups.flatMap(g => g.courseIds),
                  ...coursesList
                    .filter(c =>
                      selectedGroups.some(
                        g =>
                          (c.code && g.courseCode && normalizeCourseCode(c.code) === normalizeCourseCode(g.courseCode)) ||
                          (c.title && g.courseTitle && c.title.trim().toLowerCase() === g.courseTitle.trim().toLowerCase())
                      )
                    )
                    .map(c => String(c.id))
                ])
              );

              releaseCourses(ids, chairId);
              if (targetCourseIds.length > 0 && lms.updateCourseSyllabusStatus) {
                await lms.updateCourseSyllabusStatus(targetCourseIds, 'in_development', chairId);
              }
              showAlert({
                title: 'Courses Released',
                message: `${ids.length} course(s) unlocked for syllabus development. Instructors can now begin authoring.`,
                type: 'success'
              });
            }}
            onLockCourses={async ids => {
              if (!isChair) {
                showAlert({
                  title: 'Unauthorized Action',
                  message: 'Only the Department Chairperson has the authority to lock syllabus development.',
                  type: 'error'
                });
                return;
              }
              const chairId = activeUser?.id || 'chair';
              const selectedGroups = groups.filter(g => ids.includes(g.id));
              const targetCourseIds = Array.from(
                new Set([
                  ...selectedGroups.flatMap(g => g.courseIds),
                  ...coursesList
                    .filter(c =>
                      selectedGroups.some(
                        g =>
                          (c.code && g.courseCode && normalizeCourseCode(c.code) === normalizeCourseCode(g.courseCode)) ||
                          (c.title && g.courseTitle && c.title.trim().toLowerCase() === g.courseTitle.trim().toLowerCase())
                      )
                    )
                    .map(c => String(c.id))
                ])
              );

              lockCourses(ids, chairId);
              if (targetCourseIds.length > 0 && lms.updateCourseSyllabusStatus) {
                await lms.updateCourseSyllabusStatus(targetCourseIds, 'locked', chairId);
              }
              if (activeGroupId && ids.includes(activeGroupId)) {
                setActiveGroupId(null);
              }
              showAlert({
                title: 'Syllabus Development Locked',
                message: `${ids.length} course syllabus development locked. Instructors cannot edit until released again.`,
                type: 'info'
              });
            }}
            onAssignEvaluators={group => setEvaluatorAssignGroup(group)}
            onChairApprove={group => setApprovalModalConfig({ type: 'chair', group })}
            onDeanApprove={group => setApprovalModalConfig({ type: 'dean', group })}
            onOpenPreview={group => setPreviewingGroup(group)}
          />
        </div>
      )}

      {/* TAB: Evaluation Matrix (Chair) */}
      {isChair && activeTab === 'matrix' && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Evaluation Checklist Template</h3>
            <MatrixBuilder
              template={matrixTemplate}
              saving={matrixSaving}
              onSave={sections => {
                setMatrixSaving(true);
                void saveMatrixTemplate(sections)
                  .then(ok =>
                    showAlert({
                      title: ok ? 'Template Saved' : 'Save Failed',
                      message: ok
                        ? 'The evaluation matrix template was saved. It applies to evaluators assigned from now on.'
                        : 'The evaluation matrix template could not be saved. Please try again.',
                      type: ok ? 'success' : 'error'
                    })
                  )
                  .finally(() => setMatrixSaving(false));
              }}
              onReset={() => {
                setMatrixSaving(true);
                void resetMatrixTemplate()
                  .then(ok =>
                    showAlert({
                      title: ok ? 'Template Reset' : 'Reset Failed',
                      message: ok
                        ? 'The evaluation matrix template was restored to the institutional default.'
                        : 'The evaluation matrix template could not be reset. Please try again.',
                      type: ok ? 'success' : 'error'
                    })
                  )
                  .finally(() => setMatrixSaving(false));
              }}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Evaluation Progress</h3>
            {groups.filter(g => (g.evaluators?.length ?? 0) > 0).length === 0 ? (
              <p className="text-xs text-muted-foreground">No courses have evaluators assigned yet.</p>
            ) : (
              groups
                .filter(g => (g.evaluators?.length ?? 0) > 0)
                .map(g => (
                  <div
                    key={g.id}
                    className="p-4 bg-card border border-border rounded-2xl flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="text-sm font-bold text-foreground">{g.courseCode}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.evaluators.map(e => {
                          const submitted = e.status !== 'pending';
                          return (
                            <span
                              key={e.evaluatorId}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                submitted ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'
                              }`}
                            >
                              {e.evaluatorName}: {submitted ? 'Submitted' : 'Pending'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConsolidatedGroup(g)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground cursor-pointer"
                    >
                      View Consolidated Matrix
                    </button>
                  </div>
                ))
            )}
          </section>
        </div>
      )}

      {consolidatedGroup && (
        <ConsolidatedMatrixModal
          isOpen
          courseCode={consolidatedGroup.courseCode}
          instructorNames={consolidatedGroup.instructorNames}
          snapshot={getRecord(consolidatedGroup.id)?.matrixSnapshot ?? matrixTemplate}
          evaluators={consolidatedGroup.evaluators}
          onClose={() => setConsolidatedGroup(null)}
        />
      )}

      {/* TAB 2: My Assigned Courses (Faculty) */}
      {activeTab === 'my-courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Courses Assigned to You</h3>
            <span className="text-xs text-muted-foreground">
              {myAssignedGroups.length} course group(s)
            </span>
          </div>

          {myAssignedGroups.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border rounded-2xl space-y-2">
              <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="font-bold text-foreground text-sm">No Assigned Courses Found</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Syllabus development is strictly tied to assigned courses approved and released by your Department Chairperson. No courses are currently assigned to your account.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {myAssignedGroups.map(group => {
                const isLocked = group.status === 'locked';

                return (
                  <div
                    key={group.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                      isLocked
                        ? 'bg-muted/30 border-border opacity-85'
                        : 'bg-card border-border hover:border-primary/50 shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-base font-black text-foreground">
                          {group.courseCode}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isLocked
                              ? 'bg-muted text-muted-foreground'
                              : group.status === 'ready_for_evaluation' || group.status === 'under_evaluation'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {group.status === 'in_development'
                            ? 'DRAFT'
                            : group.status === 'ready_for_evaluation'
                              ? 'SUBMITTED'
                              : group.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-foreground line-clamp-1">
                        {group.courseTitle}
                      </h4>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {group.sections.map((s, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold text-foreground"
                          >
                            Section {s}
                          </span>
                        ))}
                      </div>

                      {group.instructorNames.length > 1 && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Co-Instructors: {group.instructorNames.join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      {isLocked ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Pending Chair Release</span>
                        </div>
                      ) : group.status === 'in_development' || group.status === 'submission_in_progress' || group.status === 'revisions_required' ? (
                        <button
                          onClick={() => handleOpenStudio(group)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-1.5"
                        >
                          <span>Open Syllabus Studio</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setPreviewingGroup(group)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-muted text-foreground hover:bg-muted/80 transition-all flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>
                            {group.status === 'approved' ? 'View Certified Syllabus' : 'View Syllabus Document'}
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => setPreviewingGroup(group)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Preview Document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: My Evaluations (Evaluator Review Roster) */}
      {activeTab === 'evaluations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Syllabi Assigned for Your Evaluation</h3>
            <span className="text-xs text-muted-foreground">
              {myEvaluationGroups.length} course(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {myEvaluationGroups.map(group => {
              const myReview = group.evaluators.find(e => e.evaluatorId === activeUser?.id);
              const canEvaluate = group.status === 'under_evaluation' && myReview?.status === 'pending';
              const cfg = STATUS_CONFIG[group.status] || STATUS_CONFIG.locked;

              return (
                <div
                  key={group.id}
                  className="p-5 rounded-2xl border border-purple-500/20 bg-card hover:border-purple-500/40 shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-black text-foreground">
                        {group.courseCode}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-foreground">
                      {group.courseTitle}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Instructors: {group.instructorNames.join(', ')}
                    </p>
                    {myReview && (
                      <p className="text-[11px] font-medium text-purple-600 dark:text-purple-400 mt-1">
                        Your Evaluation Status: {myReview.status === 'approved' ? 'Approved âœ“' : myReview.status === 'revisions_requested' ? 'Revisions Requested âš ï¸' : 'Pending Review â³'}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    {canEvaluate ? (
                      <button
                        onClick={() => {
                          const record = getRecord(group.id);
                          const snapshot = record?.matrixSnapshot ?? matrixTemplate;
                          if (!record?.matrixSnapshot) ensureMatrixSnapshot(group.id, snapshot);
                          setEvaluatorSnapshot(snapshot);
                          setEvaluatorReviewGroup(group);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center gap-1.5"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>Evaluate Syllabus</span>
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {group.status === 'under_evaluation' ? 'Review submitted' : 'Evaluation not active'}
                      </span>
                    )}

                    <button
                      onClick={() => setPreviewingGroup(group)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Inspect Syllabus Document"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Evaluator Assignment Modal */}
      {evaluatorAssignGroup && (
        <AssignEvaluatorsModal
          isOpen={Boolean(evaluatorAssignGroup)}
          group={evaluatorAssignGroup}
          users={usersList}
          onClose={() => setEvaluatorAssignGroup(null)}
          onConfirm={async (groupId, evaluators) => {
            const group = evaluatorAssignGroup;
            const snapshot = await getSnapshotForAssign().catch(() => matrixTemplate);
            assignEvaluators(groupId, evaluators, (courseIds, status) => {
              if (lms.updateCourseSyllabusStatus && courseIds.length > 0) {
                void lms.updateCourseSyllabusStatus(courseIds, status, activeUser?.id);
              }
            }, snapshot);
            if (group.courseIds[0]) {
              saveRemoteDraft(
                group.courseIds[0],
                group.syllabusData || ({} as any),
                activeUser?.id,
                undefined,
                group.submissionAgreements,
                'under_evaluation',
                evaluators.map(e => ({ evaluatorId: e.id, evaluatorName: e.name, status: 'pending' })),
                snapshot
              ).catch(() => {});
            }
            showAlert({
              title: 'Evaluators Assigned',
              message: `${evaluators.length} evaluator(s) assigned to ${group.courseCode}.`,
              type: 'success'
            });
          }}
        />
      )}

      {/* Evaluator Review Modal */}
      {evaluatorReviewGroup && (
        <EvaluatorReviewModal
          isOpen={Boolean(evaluatorReviewGroup)}
          groupId={evaluatorReviewGroup.id}
          courseCode={evaluatorReviewGroup.courseCode}
          snapshot={evaluatorSnapshot}
          onClose={() => {
            setEvaluatorReviewGroup(null);
            setEvaluatorSnapshot(null);
          }}
          onReview={(groupId, status, remarks, matrix) => {
            if (activeUser?.id) {
              submitEvaluatorReview(groupId, activeUser.id, status, remarks, matrix, (courseIds, nextStatus) => {
                if (lms.updateCourseSyllabusStatus && courseIds.length > 0) {
                  void lms.updateCourseSyllabusStatus(courseIds, nextStatus, activeUser.id);
                }
              });
              const now = new Date().toISOString();
              const nextEvaluators = evaluatorReviewGroup.evaluators.map(e =>
                e.evaluatorId === activeUser.id
                  ? { ...e, status, remarks, reviewedAt: now, ...matrix }
                  : e
              );
              if (evaluatorReviewGroup.courseIds[0]) {
                saveRemoteDraft(
                  evaluatorReviewGroup.courseIds[0],
                  evaluatorReviewGroup.syllabusData || ({} as any),
                  activeUser.id,
                  undefined,
                  evaluatorReviewGroup.submissionAgreements,
                  status === 'approved' ? 'evaluator_approved' : 'revisions_required',
                  nextEvaluators,
                  evaluatorSnapshot ?? undefined
                ).catch(() => {});
              }
              showAlert({
                title: status === 'approved' ? 'Evaluation Approved' : 'Revisions Requested',
                message:
                  status === 'approved'
                    ? 'Your approval has been recorded.'
                    : 'Revision remarks sent back to instructors.',
                type: status === 'approved' ? 'success' : 'info'
              });
            }
          }}
        />
      )}

      {/* Chairperson / Dean Approval Action Modal */}
      {approvalModalConfig && (
        <ApprovalActionModal
          isOpen={Boolean(approvalModalConfig)}
          type={approvalModalConfig.type}
          group={approvalModalConfig.group}
          onClose={() => setApprovalModalConfig(null)}
          onConfirm={() => {
            if (approvalModalConfig.type === 'chair') {
              chairApprove(approvalModalConfig.group.id, activeUser?.id || 'chair');
              if (lms.updateCourseSyllabusStatus) {
                void lms.updateCourseSyllabusStatus(
                  approvalModalConfig.group.courseIds,
                  'chair_approved',
                  activeUser?.id || 'chair'
                );
              }
              showAlert({
                title: 'Chairperson Endorsement Complete',
                message: 'Syllabus endorsed and forwarded to the College Dean for final institutional approval.',
                type: 'success'
              });
            } else {
              deanApprove(approvalModalConfig.group.id, activeUser?.id || 'dean', (courseIds, syllabus) => {
                // Propagate to LMS courses with persistent updateCourseSyllabus
                for (const cId of courseIds) {
                  if (updateCourseSyllabus) {
                    void updateCourseSyllabus(cId, syllabus);
                  }
                  const targetCourse = db?.courses?.find(c => c.id === cId);
                  if (targetCourse) {
                    targetCourse.syllabus = syllabus;
                  }
                }
                if (lms.updateCourseSyllabusStatus) {
                  void lms.updateCourseSyllabusStatus(courseIds, 'approved', activeUser?.id || 'dean');
                }
              });
              showAlert({
                title: 'Dean Approval Granted',
                message: 'Official institutional approval granted! The syllabus is now certified and ready for classroom use.',
                type: 'success'
              });
            }
          }}
        />
      )}

    </div>
  );
};
