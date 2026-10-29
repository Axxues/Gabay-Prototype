import React, { useState, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { createBaselineSyllabus } from './hooks/useSyllabusDraftsStorage';
import { useSyllabusLifecycle } from './hooks/useSyllabusLifecycle';
import { useSyllabusCollaboration } from './hooks/useSyllabusCollaboration';
import { SyllabusWizard } from './components/creator/SyllabusWizard';
import { AttachToCourseModal } from './components/creator/AttachToCourseModal';
import { DepartmentSyllabusTable, STATUS_CONFIG } from './components/governance/DepartmentSyllabusTable';
import { AssignEvaluatorsModal } from './components/governance/AssignEvaluatorsModal';
import { EvaluatorReviewModal } from './components/governance/EvaluatorReviewModal';
import { ApprovalActionModal } from './components/governance/ApprovalActionModal';
import { RevisionRemarksBanner } from './components/creator/RevisionRemarksBanner';
import { SyllabusDocumentPreview } from './components/creator/SyllabusDocumentPreview';
import type { SyllabusGroup } from './types/lifecycle';
import { isChairRole, isDeanRole } from '../../shared/utils/roles';
import {
  ShieldAlert,
  Sparkles,
  BookOpen,
  TableProperties,
  ClipboardCheck,
  Lock,
  ArrowRight,
  Eye,
  Radio
} from 'lucide-react';

interface SyllabusCreatorPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const SyllabusCreatorPage: React.FC<SyllabusCreatorPageProps> = ({ onNavigateTab: _onNavigateTab }) => {
  const lms = useLMS();
  const { activeUser, activeRole, db, showAlert, updateCourseSyllabus } = lms;
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
    getRecord,
    releaseCourses,
    confirmAgreement,
    assignEvaluators,
    submitEvaluatorReview,
    chairApprove,
    deanApprove,
    updateSyllabusData
  } = useSyllabusLifecycle(coursesList, activeUser?.collegeId, db?.users);

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
  const [activeTab, setActiveTab] = useState<'governance' | 'my-courses' | 'evaluations'>(() => {
    if (isLeadership) return 'governance';
    return 'my-courses';
  });

  // Active course group opened in Syllabus Studio
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Modals state
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [evaluatorAssignGroup, setEvaluatorAssignGroup] = useState<SyllabusGroup | null>(null);
  const [evaluatorReviewGroup, setEvaluatorReviewGroup] = useState<SyllabusGroup | null>(null);
  const [approvalModalConfig, setApprovalModalConfig] = useState<{
    type: 'chair' | 'dean';
    group: SyllabusGroup;
  } | null>(null);
  const [previewingGroup, setPreviewingGroup] = useState<SyllabusGroup | null>(null);

  // Real-time Collaboration Hook for the actively opened group
  const { activePresenceNotice, broadcastSectionUpdate } = useSyllabusCollaboration(
    activeGroupId || undefined,
    activeUser
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

  // Active Group Details
  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeRecord = activeGroupId ? getRecord(activeGroupId) : undefined;

  // Baseline syllabus generator tailored to a specific course group
  const getBaselineForGroup = (grp: SyllabusGroup) => {
    const matchedCourse = coursesList.find(c => grp.courseIds.includes(c.id));
    return createBaselineSyllabus({
      courseInfo: {
        code: grp.courseCode,
        title: grp.courseTitle,
        semester: grp.semester,
        academicYear: grp.schoolYear,
        type: '',
        credit: '',
        lectureHours: '',
        labHours: '',
        prerequisite: '',
        description: (matchedCourse as any)?.description || (matchedCourse as any)?.syllabus?.courseInfo?.description || `${grp.courseCode} – ${grp.courseTitle}`
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
              room: instCourses.find(c => c.section === sec)?.room || ''
            }))
          : grp.sections.length > 0
            ? [{ section: grp.sections.join(', '), schedule: '', room: '' }]
            : [{ section: '', schedule: '', room: '' }];

        return {
          name,
          sections: sectionsData,
          consultation: ''
        };
      })
    });
  };

  // Active syllabus data for the open group (or baseline fallback)
  const currentSyllabusData = activeRecord?.syllabusData || (activeGroup ? getBaselineForGroup(activeGroup) : createBaselineSyllabus());

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
    // If course is under evaluation or already approved, open in read-only document preview
    if (group.status !== 'in_development' && group.status !== 'revisions_required') {
      setPreviewingGroup(group);
      return;
    }
    setActiveGroupId(group.id);
  };

  // Close Studio back to list
  const handleCloseStudio = () => {
    setActiveGroupId(null);
  };

  // If a group's syllabus document preview is active
  if (previewingGroup) {
    const record = getRecord(previewingGroup.id);
    const previewData = record?.syllabusData || getBaselineForGroup(previewingGroup);
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

          {/* Real-Time Collaborator Presence Chip */}
          {activePresenceNotice && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              <span>{activePresenceNotice}</span>
            </div>
          )}
        </div>

        {/* Revision Remarks Banner if Revisions are Required */}
        {activeRecord?.status === 'revisions_required' && activeRecord.evaluators && (
          <RevisionRemarksBanner evaluators={activeRecord.evaluators} />
        )}

        {/* Wizard Editor */}
        <SyllabusWizard
          data={currentSyllabusData}
          onChange={updated => {
            updateSyllabusData(activeGroup.id, updated);
            broadcastSectionUpdate('course-info', 'Syllabus Updated');
          }}
          onSave={() => {
            updateSyllabusData(activeGroup.id, currentSyllabusData);
            showAlert({
              title: 'Syllabus Saved',
              message: 'Your changes have been saved to the course draft.',
              type: 'success'
            });
          }}
          onAttachToCourse={() => setIsAttachOpen(true)}
          coInstructors={coInstructorAgreements}
          currentUserId={activeUser?.id}
          allAgreed={allCoInstructorsAgreed}
          onAgreeToSubmit={() => {
            if (activeUser?.id) {
              confirmAgreement(activeGroup.id, activeUser.id);
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
            onReleaseCourses={ids => {
              if (!isChair) {
                showAlert({
                  title: 'Unauthorized Action',
                  message: 'Only the Department Chairperson has the authority to release courses for syllabus development.',
                  type: 'error'
                });
                return;
              }
              releaseCourses(ids, activeUser?.id || 'chair');
              showAlert({
                title: 'Courses Released',
                message: `${ids.length} course(s) unlocked for syllabus development. Instructors can now begin authoring.`,
                type: 'success'
              });
            }}
            onAssignEvaluators={group => setEvaluatorAssignGroup(group)}
            onChairApprove={group => setApprovalModalConfig({ type: 'chair', group })}
            onDeanApprove={group => setApprovalModalConfig({ type: 'dean', group })}
            onOpenPreview={group => setPreviewingGroup(group)}
          />
        </div>
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
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {group.status.replace(/_/g, ' ').toUpperCase()}
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
                      ) : group.status === 'in_development' || group.status === 'revisions_required' ? (
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
                        Your Evaluation Status: {myReview.status === 'approved' ? 'Approved ✓' : myReview.status === 'revisions_requested' ? 'Revisions Requested ⚠️' : 'Pending Review ⏳'}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    {canEvaluate ? (
                      <button
                        onClick={() => setEvaluatorReviewGroup(group)}
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
          onConfirm={(groupId, evaluators) => {
            assignEvaluators(groupId, evaluators);
            showAlert({
              title: 'Evaluators Assigned',
              message: `${evaluators.length} evaluator(s) assigned to ${evaluatorAssignGroup.courseCode}.`,
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
          onClose={() => setEvaluatorReviewGroup(null)}
          onReview={(groupId, status, remarks) => {
            if (activeUser?.id) {
              submitEvaluatorReview(groupId, activeUser.id, status, remarks);
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
