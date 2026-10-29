import React, { useState, useMemo } from 'react';
import { useLMS } from '../../shared/context/LMSContext';
import { useSyllabusDraftsStorage, createBaselineSyllabus } from './hooks/useSyllabusDraftsStorage';
import { useSyllabusLifecycle } from './hooks/useSyllabusLifecycle';
import { useSyllabusCollaboration } from './hooks/useSyllabusCollaboration';
import { SyllabusWizard } from './components/creator/SyllabusWizard';
import { SyllabusStarterModal } from './components/creator/SyllabusStarterModal';
import { AttachToCourseModal } from './components/creator/AttachToCourseModal';
import { DepartmentSyllabusTable } from './components/governance/DepartmentSyllabusTable';
import { AssignEvaluatorsModal } from './components/governance/AssignEvaluatorsModal';
import { EvaluatorReviewModal } from './components/governance/EvaluatorReviewModal';
import { ApprovalActionModal } from './components/governance/ApprovalActionModal';
import { RevisionRemarksBanner } from './components/creator/RevisionRemarksBanner';
import { SyllabusDocumentPreview } from './components/creator/SyllabusDocumentPreview';
import { scanSyllabusDocument } from '../../shared/utils/syllabusParser';
import type { OfficialSyllabusData } from '../../shared/data/syllabusData';
import type { SyllabusGroup } from './types/lifecycle';
import { CustomDropdown } from '../../shared/components/common/CustomDropdown';
import { isChairRole, isDeanRole } from '../../shared/utils/roles';
import {
  Plus,
  Copy,
  Trash2,
  ShieldAlert,
  Sparkles,
  BookOpen,
  TableProperties,
  ClipboardCheck,
  Lock,
  ArrowRight,
  Eye,
  Radio,
  FileText
} from 'lucide-react';

interface SyllabusCreatorPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const SyllabusCreatorPage: React.FC<SyllabusCreatorPageProps> = ({ onNavigateTab: _onNavigateTab }) => {
  const lms = useLMS();
  const { activeUser, activeRole, db, showAlert } = lms;
  const coursesList = db?.courses || (lms as any).courses || [];
  const usersList = db?.users || [];

  // Role resolution
  const isChair = isChairRole(activeUser, activeRole) || activeRole === 'admin' || activeRole === 'superadmin';
  const isDean = isDeanRole(activeUser, activeRole) || activeRole === 'admin' || activeRole === 'superadmin';
  const isLeadership = isChair || isDean;

  // Standalone Drafts storage
  const {
    drafts,
    activeDraft,
    activeDraftId,
    selectDraft,
    createDraft,
    updateActiveDraft,
    cloneDraft,
    deleteDraft
  } = useSyllabusDraftsStorage();

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
  } = useSyllabusLifecycle(coursesList, activeUser?.collegeId);

  // Faculty Assigned Courses (Filtered to current user)
  const myAssignedGroups = useMemo(() => {
    if (!activeUser?.id) return [];
    return groups.filter(g => g.instructorIds.includes(activeUser.id!));
  }, [groups, activeUser?.id]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'governance' | 'my-courses' | 'evaluations' | 'sandbox'>(() => {
    if (isLeadership) return 'governance';
    if (myAssignedGroups.length > 0) return 'my-courses';
    return 'sandbox';
  });

  // Active course group opened in Syllabus Studio
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Modals state
  const [isStarterOpen, setIsStarterOpen] = useState(false);
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

  // Active syllabus data for the open group (or fallback)
  const currentSyllabusData = activeRecord?.syllabusData || activeDraft?.data || createBaselineSyllabus();

  // Co-instructors status for active group
  const coInstructorAgreements = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.instructorIds.map((id, index) => {
      const name = activeGroup.instructorNames[index] || 'Faculty Member';
      const section = activeGroup.sections[index] || '';
      return {
        id,
        name: section ? `${name} (${section})` : name,
        hasAgreed: Boolean(activeRecord?.submissionAgreements?.[id])
      };
    });
  }, [activeGroup, activeRecord]);

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
    setActiveGroupId(group.id);
  };

  // Close Studio back to list
  const handleCloseStudio = () => {
    setActiveGroupId(null);
  };

  // Import existing file into draft
  const handleImportFile = async (file: File) => {
    const scanResult = await scanSyllabusDocument(file);
    const baseline = createBaselineSyllabus();
    const detectedInstructor = scanResult.detectedFacultyNames?.[0];

    const mergedData: OfficialSyllabusData = {
      ...baseline,
      courseInfo: {
        ...baseline.courseInfo,
        code: scanResult.detectedCourseCode || baseline.courseInfo.code,
        title: scanResult.detectedCourseTitle || baseline.courseInfo.title
      },
      facultyMembers: detectedInstructor
        ? [
            {
              name: detectedInstructor,
              sections: baseline.facultyMembers[0]?.sections || [],
              consultation: baseline.facultyMembers[0]?.consultation || ''
            }
          ]
        : baseline.facultyMembers
    };

    createDraft(mergedData, `${scanResult.detectedCourseCode || 'Imported'} Syllabus`);
  };

  // If a group's syllabus document preview is active
  if (previewingGroup) {
    const record = getRecord(previewingGroup.id);
    const previewData = record?.syllabusData || createBaselineSyllabus();
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
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
      <div className="flex-1 min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
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
                message: 'Your submission agreement has been recorded. Once all co-instructors agree, the syllabus will advance to Evaluation.',
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
    <div className="flex-1 min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
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

          <button
            onClick={() => setActiveTab('sandbox')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sandbox'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Personal Sandbox</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Department Governance Table (Chair & Dean) */}
      {activeTab === 'governance' && (
        <div className="space-y-4">
          <DepartmentSyllabusTable
            groups={groups}
            userRole={activeRole}
            onReleaseCourses={ids => {
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
                Your department chairperson has not assigned any active courses to your faculty account yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      ) : (
                        <button
                          onClick={() => handleOpenStudio(group)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-1.5"
                        >
                          <span>Open Syllabus Studio</span>
                          <ArrowRight className="w-3.5 h-3.5" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myEvaluationGroups.map(group => (
              <div
                key={group.id}
                className="p-5 rounded-2xl border border-purple-500/20 bg-card hover:border-purple-500/40 shadow-sm flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-black text-foreground">
                      {group.courseCode}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                      Under Evaluation
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-foreground">
                    {group.courseTitle}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Instructors: {group.instructorNames.join(', ')}
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => setEvaluatorReviewGroup(group)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all flex items-center gap-1.5"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Evaluate Syllabus</span>
                  </button>

                  <button
                    onClick={() => setPreviewingGroup(group)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Inspect Syllabus Document"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Personal Sandbox / Standalone Drafts */}
      {activeTab === 'sandbox' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border">
            <div>
              <h3 className="text-sm font-bold text-foreground">Personal Sandbox & Template Drafts</h3>
              <p className="text-xs text-muted-foreground">
                Experiment freely or draft standalone syllabi outside live course rosters.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-48">
                <CustomDropdown
                  value={activeDraftId}
                  onChange={val => selectDraft(val)}
                  options={drafts.map(d => ({ value: d.id, label: d.title }))}
                  placeholder="Select Draft"
                  ariaLabel="Select Active Draft"
                  testId="active-draft-select"
                />
              </div>

              {activeDraft && (
                <button
                  type="button"
                  onClick={() => cloneDraft(activeDraft.id)}
                  className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                  title="Clone active draft"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}

              {drafts.length > 1 && activeDraft && (
                <button
                  type="button"
                  onClick={() => deleteDraft(activeDraft.id)}
                  className="p-2 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all cursor-pointer"
                  title="Delete draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsStarterOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>New Syllabus</span>
              </button>
            </div>
          </div>

          {activeDraft && (
            <SyllabusWizard
              data={activeDraft.data}
              onChange={updateActiveDraft}
              onSave={() => {
                showAlert({
                  title: 'Draft Saved',
                  message: 'Your standalone syllabus draft has been saved to local storage.',
                  type: 'success'
                });
              }}
              onAttachToCourse={() => setIsAttachOpen(true)}
            />
          )}
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
                // Propagate to LMS courses
                for (const cId of courseIds) {
                  const targetCourse = db.courses?.find(c => c.id === cId);
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

      {/* Starter Modal for Personal Sandbox */}
      <SyllabusStarterModal
        isOpen={isStarterOpen}
        onClose={() => setIsStarterOpen(false)}
        onSelectBlank={() => createDraft(undefined, 'New Standard Syllabus')}
        onSelectClone={(source, title) => createDraft(source, `Copy of ${title}`)}
        onImportFile={handleImportFile}
        availableDrafts={drafts}
      />
    </div>
  );
};
