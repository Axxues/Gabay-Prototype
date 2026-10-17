import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLMS } from '../../../shared/context/LMSContext';
import type { College, Department, SchoolYear, User } from '../../../shared/types/lms';
import { DialogFrame } from '../../../shared/components/common/DialogFrame';
import { UserAvatar } from '../../../shared/components/common/UserAvatar';
import {
  Building,
  Plus,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  FolderTree,
  AlertCircle,
  Trash2,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { isDeanRole, isChairRole } from '../../../shared/utils/roles';
import { generateUuid } from '../../../shared/utils/cryptoToken';

export const AcademicStructureTab: React.FC = () => {
  const navigate = useNavigate();
  const [collapsedColleges, setCollapsedColleges] = useState<Record<string, boolean>>({});

  const toggleCollegeCollapse = (collegeId: string) => {
    setCollapsedColleges(prev => ({
      ...prev,
      [collegeId]: !prev[collegeId],
    }));
  };

  const {
    colleges,
    departments,
    addCollege,
    addDepartment,
    transferLeadership,
    deleteCollege,
    deleteDepartment,
    getCollegeDeleteBlockers,
    getDepartmentDeleteBlockers,
    db,
    showAlert,
    activeRole,
    activeUser,
    schoolYears = [],
    addSchoolYear,
    setActiveSchoolYear,
    getSchoolYearsByCollege,
  } = useLMS();

  const getColYears = (collegeId: string): SchoolYear[] => {
    if (typeof getSchoolYearsByCollege === 'function') {
      return getSchoolYearsByCollege(collegeId);
    }
    return (schoolYears || []).filter(sy => sy.collegeId === collegeId);
  };

  // Role & scope derivation
  const isSuperadminOrChancellor =
    activeRole === 'superadmin' || activeUser?.adminSubrole === 'chancellor';

  const isDean =
    !isSuperadminOrChancellor &&
    ((activeRole === 'admin' && activeUser?.adminSubrole === 'dean') ||
      isDeanRole(activeUser, activeRole));

  const isChair =
    !isSuperadminOrChancellor &&
    ((activeRole === 'admin' && activeUser?.adminSubrole === 'chairperson') ||
      isChairRole(activeUser, activeRole));

  // Permissions
  const canAddCollege =
    !isDean &&
    !isChair &&
    (isSuperadminOrChancellor || (activeRole === 'admin' && !activeUser?.adminSubrole));

  const canAddDepartment =
    !isChair &&
    (isSuperadminOrChancellor ||
      (activeRole === 'admin' && (isDean || !activeUser?.adminSubrole)));

  const canManageDeans =
    !isDean &&
    !isChair &&
    (isSuperadminOrChancellor || (activeRole === 'admin' && !activeUser?.adminSubrole));

  const canAppointChairs =
    !isChair &&
    (isSuperadminOrChancellor || isDean || (activeRole === 'admin' && !activeUser?.adminSubrole));

  const canDeleteCollege =
    !isDean &&
    !isChair &&
    (isSuperadminOrChancellor || (activeRole === 'admin' && !activeUser?.adminSubrole));

  const canDeleteDepartment =
    !isChair &&
    (isSuperadminOrChancellor ||
      (activeRole === 'admin' && (isDean || !activeUser?.adminSubrole)));

  const viewerCollegeId = activeUser?.collegeId;
  const viewerCollegeName = activeUser?.collegeName?.toLowerCase();

  const deanCollege = (colleges || []).find(
    c => (viewerCollegeId && c.id === viewerCollegeId) ||
         (viewerCollegeName && c.name?.toLowerCase() === viewerCollegeName) ||
         (activeUser?.id && c.deanId === activeUser.id)
  );

  const chairDept = isChair
    ? (departments || []).find(
        d => (activeUser?.id && d.chairpersonId === activeUser.id) ||
             (activeUser?.department &&
               (d.id === activeUser.department ||
                d.name?.toLowerCase() === activeUser.department.toLowerCase() ||
                d.code?.toLowerCase() === activeUser.department.toLowerCase()))
      )
    : undefined;

  const effectiveCollegeId = viewerCollegeId || deanCollege?.id || chairDept?.collegeId;
  const effectiveCollegeName = viewerCollegeName || deanCollege?.name?.toLowerCase();

  const displayedColleges = (isDean || isChair)
    ? (colleges || []).filter(
        c => (effectiveCollegeId && c.id === effectiveCollegeId) ||
             (effectiveCollegeName && c.name?.toLowerCase() === effectiveCollegeName) ||
             (activeUser?.id && c.deanId === activeUser.id) ||
             (chairDept && c.id === chairDept.collegeId)
      )
    : (colleges || []);

  // Modal states
  const [isAddCollegeOpen, setIsAddCollegeOpen] = useState(false);
  const [collegeName, setCollegeName] = useState('');
  const [collegeCode, setCollegeCode] = useState('');
  const [initialDeanId, setInitialDeanId] = useState('');
  const [isSubmittingCollege, setIsSubmittingCollege] = useState(false);

  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [deptCollegeId, setDeptCollegeId] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [initialChairId, setInitialChairId] = useState('');
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);

  // Appointing / Reassigning leader modal state
  const [appointModalData, setAppointModalData] = useState<{
    roleType: 'dean' | 'chairperson';
    unitId: string;
    unitName: string;
    currentLeaderId?: string;
  } | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [isSubmittingLeader, setIsSubmittingLeader] = useState(false);

  // Helper to check if current user can manage school years for a specific college
  const canManageSchoolYearsForCollege = (college: College) => {
    if (isSuperadminOrChancellor) return true;
    if (activeRole === 'admin' && activeUser?.adminSubrole === 'dean') {
      return (
        (activeUser.collegeId && activeUser.collegeId === college.id) ||
        (deanCollege && deanCollege.id === college.id) ||
        (college.deanId && activeUser.id === college.deanId)
      );
    }
    return false;
  };

  // School Year modal states
  const [isAddSchoolYearOpen, setIsAddSchoolYearOpen] = useState(false);
  const [selectedCollegeForSY, setSelectedCollegeForSY] = useState<College | null>(null);
  const [schoolYearInput, setSchoolYearInput] = useState('');
  const [isSubmittingSY, setIsSubmittingSY] = useState(false);
  const [syError, setSyError] = useState<string | null>(null);

  // Submit new school year
  const handleCreateSchoolYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollegeForSY || isSubmittingSY) return;

    const trimmed = schoolYearInput.trim();
    // Validate format YYYY-YYYY, e.g. 2026-2027
    const syRegex = /^\d{4}-\d{4}$/;
    if (!syRegex.test(trimmed)) {
      setSyError('Please enter a valid school year format like YYYY-YYYY (e.g., 2026-2027).');
      return;
    }

    const [startYear, endYear] = trimmed.split('-').map(Number);
    if (endYear !== startYear + 1) {
      setSyError('The end year must be exactly one year after the start year (e.g., 2026-2027).');
      return;
    }

    setIsSubmittingSY(true);
    setSyError(null);
    try {
      const res = await addSchoolYear(selectedCollegeForSY.id, trimmed);
      if (res.success) {
        showAlert({
          title: 'School Year Added',
          message: res.message || `School year ${trimmed} added successfully.`,
          type: 'success',
        });
        setIsAddSchoolYearOpen(false);
        setSchoolYearInput('');
        setSelectedCollegeForSY(null);
      } else {
        setSyError(res.message || 'Failed to add school year.');
      }
    } finally {
      setIsSubmittingSY(false);
    }
  };

  const handleSetActiveSchoolYear = async (collegeId: string, schoolYearId: string) => {
    const res = await setActiveSchoolYear(collegeId, schoolYearId);
    if (res.success) {
      showAlert({
        title: 'Active School Year Updated',
        message: res.message || 'Active school year updated successfully.',
        type: 'success',
      });
    } else {
      showAlert({
        title: 'Update Failed',
        message: res.message || 'Failed to update active school year.',
        type: 'error',
      });
    }
  };

  // Helper to find a user by ID
  const getUserById = (id?: string): User | undefined => {
    if (!id) return undefined;
    return (db?.users || []).find(u => u.id === id);
  };

  const isCandidateInCollege = (u: User, colId?: string, colName?: string) => {
    if (colId && u.collegeId === colId) return true;
    if (colName && u.collegeName?.toLowerCase() === colName.toLowerCase()) return true;
    return false;
  };

  // Submit new college
  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddCollege) {
      showAlert({
        title: 'Permission Denied',
        message: 'Chairpersons and Deans cannot create academic colleges.',
        type: 'error',
      });
      return;
    }
    if (!collegeName.trim() || !collegeCode.trim() || isSubmittingCollege) return;

    setIsSubmittingCollege(true);
    try {
      const newCol: College = {
        id: generateUuid(),
        name: collegeName.trim(),
        code: collegeCode.trim().toUpperCase(),
      };
      await addCollege(newCol, initialDeanId.trim() || undefined);
      showAlert({
        title: 'College Added',
        message: `${newCol.name} (${newCol.code}) was created successfully.`,
        type: 'success',
      });
      setIsAddCollegeOpen(false);
      setCollegeName('');
      setCollegeCode('');
      setInitialDeanId('');
    } finally {
      setIsSubmittingCollege(false);
    }
  };

  // Submit new department
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAddDepartment) {
      showAlert({
        title: 'Permission Denied',
        message: 'Program Chairpersons cannot create academic programs.',
        type: 'error',
      });
      return;
    }
    const targetCollegeId = isDean ? (effectiveCollegeId || deptCollegeId) : deptCollegeId;
    if (!targetCollegeId || !deptName.trim() || !deptCode.trim() || isSubmittingDept) return;

    setIsSubmittingDept(true);
    try {
      const newDept: Department = {
        id: generateUuid(),
        collegeId: targetCollegeId,
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase(),
      };
      await addDepartment(newDept, initialChairId.trim() || undefined);
      showAlert({
        title: 'Program Added',
        message: `${newDept.name} (${newDept.code}) was added to the college.`,
        type: 'success',
      });
      setIsAddDeptOpen(false);
      setDeptName('');
      setDeptCode('');
      setDeptCollegeId('');
      setInitialChairId('');
    } finally {
      setIsSubmittingDept(false);
    }
  };

  // Submit leadership appointment
  const handleAppointLeader = async () => {
    if (!appointModalData || !selectedCandidateId || isSubmittingLeader) return;

    setIsSubmittingLeader(true);
    try {
      const res = await transferLeadership(
        appointModalData.roleType,
        appointModalData.currentLeaderId || 'none',
        selectedCandidateId,
        appointModalData.unitId
      );

      if (res.success) {
        showAlert({
          title: 'Leadership Appointed',
          message: res.message || 'Unit administrative leader appointed successfully.',
          type: 'success',
        });
        setAppointModalData(null);
        setSelectedCandidateId('');
      } else {
        showAlert({
          title: 'Appointment Failed',
          message: res.message || 'Could not appoint leader.',
          type: 'error',
        });
      }
    } finally {
      setIsSubmittingLeader(false);
    }
  };

  // Deletion modal states & handlers
  const [blockerModalData, setBlockerModalData] = useState<{
    title: string;
    unitName: string;
    blockers: string[];
  } | null>(null);

  const [deleteConfirmModalData, setDeleteConfirmModalData] = useState<{
    type: 'college' | 'department';
    id: string;
    name: string;
    code: string;
    childDepartments?: Department[];
  } | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  const handleInitiateDeleteCollege = (college: College) => {
    const blockers = getCollegeDeleteBlockers(college.id);
    if (blockers.length > 0) {
      setBlockerModalData({
        title: 'Cannot Delete College',
        unitName: `${college.name} (${college.code})`,
        blockers,
      });
      return;
    }
    const childDepts = (departments || []).filter(d => d.collegeId === college.id);
    setDeleteConfirmModalData({
      type: 'college',
      id: college.id,
      name: college.name,
      code: college.code,
      childDepartments: childDepts,
    });
  };

  const handleInitiateDeleteDepartment = (dept: Department) => {
    const blockers = getDepartmentDeleteBlockers(dept.id);
    if (blockers.length > 0) {
      setBlockerModalData({
        title: 'Cannot Delete Program',
        unitName: `${dept.name} (${dept.code})`,
        blockers,
      });
      return;
    }
    setDeleteConfirmModalData({
      type: 'department',
      id: dept.id,
      name: dept.name,
      code: dept.code,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmModalData || isDeleting) return;
    setIsDeleting(true);
    try {
      const res =
        deleteConfirmModalData.type === 'college'
          ? await deleteCollege(deleteConfirmModalData.id)
          : await deleteDepartment(deleteConfirmModalData.id);

      if (res.success) {
        showAlert({
          title: `${deleteConfirmModalData.type === 'college' ? 'College' : 'Program'} Deleted`,
          message: res.message,
          type: 'success',
        });
        setDeleteConfirmModalData(null);
      } else {
        showAlert({
          title: 'Deletion Failed',
          message: res.message,
          type: 'error',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Eligible candidates for the open appointment modal
  const eligibleCandidates = (db?.users || []).filter(u => {
    if (!appointModalData) return false;
    // Don't show current leader
    if (appointModalData.currentLeaderId && u.id === appointModalData.currentLeaderId) return false;
    const isRoleEligible = u.role === 'faculty' || u.role === 'admin';
    if (!isRoleEligible) return false;

    if (isDean) {
      return isCandidateInCollege(u, effectiveCollegeId, effectiveCollegeName);
    }
    return true;
  });

  // Eligible candidates for initial leader selection in creation modals
  const eligibleDeanCandidates = (db?.users || []).filter(
    u => u.role === 'faculty' || u.role === 'admin'
  );

  const eligibleChairCandidates = (db?.users || []).filter(u => {
    const isRoleEligible = u.role === 'faculty' || u.role === 'admin';
    if (!isRoleEligible) return false;

    if (isDean) {
      return isCandidateInCollege(u, effectiveCollegeId, effectiveCollegeName);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 bg-card border border-border rounded-2xl shadow-none">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 mt-0.5">
            <FolderTree className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-extrabold text-foreground tracking-tight">
              Academic Structure & Multi-College Governance
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {isDean
                ? 'Dean collegiate console: manage programs and designate program chairpersons within your college.'
                : isChair
                ? 'Chairperson console: view academic structure, faculty, and program operations.'
                : 'Administrator console: dynamically provision colleges, academic programs, and designate unit leadership seats.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
          {canAddCollege && (
            <button
              type="button"
              onClick={() => setIsAddCollegeOpen(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-xs rounded-xl shadow-primary-sm transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add College</span>
            </button>
          )}
          {canAddDepartment && (
            <button
              type="button"
              onClick={() => {
                if (isDean) {
                  setDeptCollegeId(effectiveCollegeId || '');
                } else if (colleges.length > 0) {
                  setDeptCollegeId(colleges[0].id);
                }
                setIsAddDeptOpen(true);
              }}
              className={`px-4 py-2 ${
                isDean
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary-sm'
                  : 'bg-muted hover:bg-muted/80 text-foreground border border-border hover:border-primary/40'
              } active:scale-[0.98] font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer`}
            >
              <Plus className="w-4 h-4" />
              <span>Add Program</span>
            </button>
          )}
        </div>
      </div>

      {/* Colleges & Departments List */}
      <div className="space-y-5">
        {displayedColleges.map(college => {
          const dean = getUserById(college.deanId);
          const collegeDepts = (departments || []).filter(d => d.collegeId === college.id);

          return (
            <div
              key={college.id}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-none"
            >
              {/* College Header */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={!collapsedColleges[college.id]}
                aria-label={`Toggle programs for ${college.name}`}
                onClick={() => toggleCollegeCollapse(college.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCollegeCollapse(college.id);
                  }
                }}
                className="p-4 sm:p-5 bg-muted/40 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span
                    aria-hidden="true"
                    className="p-1 rounded-lg text-muted-foreground transition-colors"
                  >
                    {collapsedColleges[college.id] ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-extrabold text-foreground text-sm">{college.name}</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-md border border-primary/20">
                        {college.code}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {collegeDepts.length} {collegeDepts.length === 1 ? 'Program' : 'Programs'}
                    </div>
                  </div>
                </div>

                {/* Dean Box & Actions */}
                <div className="flex items-center space-x-3 bg-background border border-border p-2.5 rounded-xl shrink-0">
                  {dean ? (
                    <>
                      <UserAvatar
                        name={dean.name}
                        src={dean.avatar}
                        className="w-8 h-8 rounded-full border border-border shrink-0"
                      />
                      <div className="text-left min-w-0 pr-2">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">
                          Dean
                        </div>
                        <div className="text-xs font-bold text-foreground truncate max-w-[140px]">
                          {dean.name}
                        </div>
                      </div>
                      {canManageDeans && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAppointModalData({
                              roleType: 'dean',
                              unitId: college.id,
                              unitName: college.name,
                              currentLeaderId: college.deanId,
                            });
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                        >
                          Reassign
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="text-left min-w-0 pr-2">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">
                          Dean
                        </div>
                        <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          Not Appointed
                        </div>
                      </div>
                      {canManageDeans && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAppointModalData({
                              roleType: 'dean',
                              unitId: college.id,
                              unitName: college.name,
                              currentLeaderId: college.deanId,
                            });
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-primary text-primary-foreground rounded-lg shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
                        >
                          Appoint
                        </button>
                      )}
                    </>
                  )}
                </div>

                {canDeleteCollege && (
                  <button
                    type="button"
                    aria-label={`Delete ${college.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInitiateDeleteCollege(college);
                    }}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer shrink-0 self-center"
                    title="Delete College"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Program Listing Table */}
              {!collapsedColleges[college.id] && (
                <div className="divide-y divide-border/60">
                  {collegeDepts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      No programs added yet for this college.{' '}
                      {canAddDepartment && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeptCollegeId(college.id);
                            setIsAddDeptOpen(true);
                          }}
                          className="text-primary font-bold hover:underline ml-1 cursor-pointer"
                        >
                          Add one now
                        </button>
                      )}
                    </div>
                  ) : (
                    collegeDepts.map(dept => {
                      const chair = getUserById(dept.chairpersonId);

                      return (
                        <div
                          key={dept.id}
                          data-testid={`program-row-${dept.id}`}
                          onClick={() => navigate(`/governance/programs/${encodeURIComponent(dept.id)}`)}
                          className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center space-x-3">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-foreground text-xs group-hover:text-primary transition-colors">
                                  {dept.name}
                                </span>
                                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-muted text-muted-foreground rounded border border-border">
                                  {dept.code}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Chairperson info */}
                          <div className="flex items-center space-x-3">
                            {chair ? (
                              <div className="flex items-center space-x-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border">
                                <UserAvatar
                                  name={chair.name}
                                  src={chair.avatar}
                                  className="w-6 h-6 rounded-full border border-border shrink-0"
                                />
                                <div className="text-left text-xs">
                                  <span className="text-[10px] text-muted-foreground font-semibold mr-1.5">
                                    Chair:
                                  </span>
                                  <span className="font-bold text-foreground">{chair.name}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                                <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                                  No Chair Appointed
                                </span>
                                {canAppointChairs && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAppointModalData({
                                        roleType: 'chairperson',
                                        unitId: dept.id,
                                        unitName: dept.name,
                                        currentLeaderId: dept.chairpersonId,
                                      });
                                    }}
                                    className="text-xs text-primary font-bold hover:underline ml-1 cursor-pointer"
                                  >
                                    Appoint
                                  </button>
                                )}
                              </div>
                            )}

                            {canDeleteDepartment && (!isDean || (effectiveCollegeId && dept.collegeId === effectiveCollegeId)) && (
                              <button
                                type="button"
                                aria-label={`Delete ${dept.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleInitiateDeleteDepartment(dept);
                                }}
                                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Delete Program"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Collegiate School Years & Academic Cycles Section */}
              <div className="p-4 sm:p-5 bg-card/60 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">School Years & Academic Cycles</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Manage active academic governance cycles and course/student scoping.
                      </p>
                    </div>
                  </div>
                  {canManageSchoolYearsForCollege(college) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCollegeForSY(college);
                        setSchoolYearInput('');
                        setSyError(null);
                        setIsAddSchoolYearOpen(true);
                      }}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 active:scale-[0.98] text-primary font-bold text-xs rounded-xl border border-primary/20 transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add School Year</span>
                    </button>
                  )}
                </div>

                {/* School Year pills / list */}
                {(() => {
                  const collegeYears = getColYears(college.id);
                  if (collegeYears.length === 0) {
                    return (
                      <div className="p-3 bg-muted/20 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                        No school years registered for this college.
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {collegeYears.map((sy: SchoolYear) => (
                        <div
                          key={sy.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${
                            sy.isActive
                              ? 'bg-primary/10 border-primary/30 text-primary font-bold shadow-xs'
                              : 'bg-muted/40 border-border text-foreground hover:bg-muted/60'
                          }`}
                        >
                          <span className="font-semibold">{sy.year}</span>
                          {sy.isActive ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary text-primary-foreground">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            canManageSchoolYearsForCollege(college) && (
                              <button
                                type="button"
                                onClick={() => handleSetActiveSchoolYear(college.id, sy.id)}
                                className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer ml-1"
                              >
                                Set as Active
                              </button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD COLLEGE MODAL */}
      {isAddCollegeOpen && (
        <DialogFrame
          title="Add New Academic College"
          subtitle="Provision a collegiate division with its administrative dean seat."
          onClose={() => {
            setIsAddCollegeOpen(false);
            setCollegeName('');
            setCollegeCode('');
            setInitialDeanId('');
          }}
        >
          <form onSubmit={handleCreateCollege} className="space-y-4">
            <div>
              <label htmlFor="new-college-name" className="block text-xs font-bold text-foreground mb-1">
                College Name
              </label>
              <input
                id="new-college-name"
                type="text"
                required
                placeholder="e.g. College of Agriculture"
                value={collegeName}
                onChange={e => setCollegeName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label htmlFor="new-college-code" className="block text-xs font-bold text-foreground mb-1">
                College Code (Acronym)
              </label>
              <input
                id="new-college-code"
                type="text"
                required
                placeholder="e.g. CA"
                value={collegeCode}
                onChange={e => setCollegeCode(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30 uppercase"
              />
            </div>
            <div>
              <label htmlFor="new-college-dean" className="block text-xs font-bold text-foreground mb-1">
                Initial Dean (Optional)
              </label>
              <select
                id="new-college-dean"
                value={initialDeanId}
                onChange={e => setInitialDeanId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Leave Unassigned (Appoint Later)</option>
                {eligibleDeanCandidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}){c.department ? ` - ${c.department}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsAddCollegeOpen(false);
                  setCollegeName('');
                  setCollegeCode('');
                  setInitialDeanId('');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCollege}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmittingCollege ? 'Creating...' : 'Create College'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}

      {/* ADD PROGRAM MODAL */}
      {isAddDeptOpen && (
        <DialogFrame
          title="Add Academic Program"
          subtitle="Attach an academic program under an existing college."
          onClose={() => {
            setIsAddDeptOpen(false);
            setDeptName('');
            setDeptCode('');
            setDeptCollegeId('');
            setInitialChairId('');
          }}
        >
          <form onSubmit={handleCreateDepartment} className="space-y-4">
            <div>
              <label htmlFor="dept-college-select" className="block text-xs font-bold text-foreground mb-1">
                Select Parent College
              </label>
              <select
                id="dept-college-select"
                required
                disabled={isDean}
                value={isDean ? (effectiveCollegeId || deptCollegeId) : deptCollegeId}
                onChange={e => setDeptCollegeId(e.target.value)}
                className={`w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30 ${
                  isDean ? 'opacity-75 cursor-not-allowed bg-muted' : ''
                }`}
              >
                {isDean ? (
                  <option value={effectiveCollegeId || deptCollegeId}>
                    {deanCollege ? `${deanCollege.name} (${deanCollege.code})` : (activeUser?.collegeName || 'Current College')}
                  </option>
                ) : (
                  <>
                    <option value="">Select College...</option>
                    {(colleges || []).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div>
              <label htmlFor="new-dept-name" className="block text-xs font-bold text-foreground mb-1">
                Program Name
              </label>
              <input
                id="new-dept-name"
                type="text"
                required
                placeholder="e.g. Program in Agribusiness"
                value={deptName}
                onChange={e => setDeptName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label htmlFor="new-dept-code" className="block text-xs font-bold text-foreground mb-1">
                Program Code
              </label>
              <input
                id="new-dept-code"
                type="text"
                required
                placeholder="e.g. BSAB"
                value={deptCode}
                onChange={e => setDeptCode(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30 uppercase"
              />
            </div>
            <div>
              <label htmlFor="new-dept-chair" className="block text-xs font-bold text-foreground mb-1">
                Initial Chairperson (Optional)
              </label>
              <select
                id="new-dept-chair"
                value={initialChairId}
                onChange={e => setInitialChairId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Leave Unassigned (Appoint Later)</option>
                {eligibleChairCandidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}){c.program || c.department ? ` - ${c.program || c.department}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setIsAddDeptOpen(false);
                  setDeptName('');
                  setDeptCode('');
                  setDeptCollegeId('');
                  setInitialChairId('');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingDept}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDept ? 'Adding...' : 'Add Program'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}

      {/* APPOINT / REASSIGN LEADER MODAL */}
      {appointModalData && (
        <DialogFrame
          title={`Appoint ${appointModalData.roleType === 'dean' ? 'Dean' : 'Chairperson'}`}
          subtitle={`Designate unit administrative leader for ${appointModalData.unitName}`}
          onClose={() => setAppointModalData(null)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setAppointModalData(null)}
                className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedCandidateId || isSubmittingLeader}
                onClick={handleAppointLeader}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <span>{isSubmittingLeader ? 'Appointing...' : 'Confirm Appointment'}</span>
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3 bg-muted/60 border border-border rounded-xl">
              <div className="font-bold text-foreground">Unit: {appointModalData.unitName}</div>
              <div className="text-muted-foreground text-[11px]">
                Role:{' '}
                {appointModalData.roleType === 'dean'
                  ? 'College Dean'
                  : 'Department Chairperson'}
              </div>
            </div>

            <div>
              <label htmlFor="select-candidate" className="block font-bold text-foreground mb-1.5">
                Select Candidate
              </label>
              <select
                id="select-candidate"
                value={selectedCandidateId}
                onChange={e => setSelectedCandidateId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select faculty member...</option>
                {eligibleCandidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) - {c.department}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Appointing a new leader automatically steps down any previous incumbent to faculty,
                strictly adhering to the single-seat leadership invariant.
              </span>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* DELETION BLOCKER MODAL */}
      {blockerModalData && (
        <DialogFrame
          title={blockerModalData.title}
          subtitle={`Deletion is blocked for ${blockerModalData.unitName}`}
          onClose={() => setBlockerModalData(null)}
        >
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">This academic unit cannot be deleted:</p>
                <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground font-medium">
                  {blockerModalData.blockers.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please clear or reassign all active leadership positions and ensure no users or pending registrations are assigned to this unit before deleting.
            </p>
            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setBlockerModalData(null)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* CONFIRM DELETION MODAL */}
      {deleteConfirmModalData && (
        <DialogFrame
          title={`Delete ${deleteConfirmModalData.type === 'college' ? 'Academic College' : 'Academic Program'}`}
          subtitle="This destructive action cannot be undone."
          onClose={() => !isDeleting && setDeleteConfirmModalData(null)}
        >
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs">
              <ShieldAlert className="w-5 h-5 shrink-0 text-destructive mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-bold">
                  Are you sure you want to permanently delete {deleteConfirmModalData.name} ({deleteConfirmModalData.code})?
                </p>
                {deleteConfirmModalData.type === 'college' && (deleteConfirmModalData.childDepartments?.length ?? 0) > 0 && (
                  <p className="text-muted-foreground">
                    This college contains <strong className="text-foreground">{deleteConfirmModalData.childDepartments!.length} program(s)</strong> ({deleteConfirmModalData.childDepartments!.map(d => d.name).join(', ')}), which have no enrolled users. Deleting this college will also permanently delete these programs.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmModalData(null)}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : deleteConfirmModalData.type === 'college' && (deleteConfirmModalData.childDepartments?.length ?? 0) > 0 ? 'Delete College & Programs' : 'Delete'}
              </button>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* ADD SCHOOL YEAR MODAL */}
      {isAddSchoolYearOpen && selectedCollegeForSY && (
        <DialogFrame
          title="Add School Year"
          subtitle={`Register a new academic year for ${selectedCollegeForSY.name} (${selectedCollegeForSY.code}).`}
          onClose={() => {
            if (!isSubmittingSY) {
              setIsAddSchoolYearOpen(false);
              setSchoolYearInput('');
              setSelectedCollegeForSY(null);
              setSyError(null);
            }
          }}
        >
          <form onSubmit={handleCreateSchoolYear} className="space-y-4">
            <div>
              <label htmlFor="new-school-year" className="block text-xs font-bold text-foreground mb-1">
                School Year (e.g., 2026-2027)
              </label>
              <input
                id="new-school-year"
                type="text"
                required
                placeholder="2026-2027"
                value={schoolYearInput}
                onChange={e => {
                  setSchoolYearInput(e.target.value);
                  if (syError) setSyError(null);
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Format must be two consecutive 4-digit calendar years separated by a hyphen (e.g. 2026-2027).
              </p>
            </div>

            {syError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syError}</span>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isSubmittingSY}
                onClick={() => {
                  setIsAddSchoolYearOpen(false);
                  setSchoolYearInput('');
                  setSelectedCollegeForSY(null);
                  setSyError(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingSY || !schoolYearInput.trim()}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmittingSY ? 'Adding...' : 'Add School Year'}
              </button>
            </div>
          </form>
        </DialogFrame>
      )}
    </div>
  );
};
