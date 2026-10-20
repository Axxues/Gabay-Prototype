import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLMS } from '../../../shared/context/LMSContext';
import type { College, Department, SchoolYear, User, AcademicSemester } from '../../../shared/types/lms';
import { ACADEMIC_SEMESTERS, formatSemesterLabel, normalizeAcademicSemester } from '../../../shared/utils/academicSemester';
import { DialogFrame } from '../../../shared/components/common/DialogFrame';
import { UserAvatar } from '../../../shared/components/common/UserAvatar';
import { CustomDropdown } from '../../../shared/components/common/CustomDropdown';
import {
  Building,
  Plus,
  ShieldAlert,
  ChevronDown,
  FolderTree,
  AlertCircle,
  Trash2,
  Calendar,
} from 'lucide-react';
import { isDeanRole, isChairRole } from '../../../shared/utils/roles';
import { generateUuid } from '../../../shared/utils/cryptoToken';

export const AcademicStructureTab: React.FC = () => {
  const navigate = useNavigate();
  const [expandedColleges, setExpandedColleges] = useState<Record<string, boolean>>({});

  const toggleCollegeCollapse = (collegeId: string) => {
    setExpandedColleges(prev => ({
      ...prev,
      [collegeId]: !prev[collegeId],
    }));
  };

  const {
    colleges,
    departments,
    addCollege,
    addDepartment,
    deleteCollege,
    deleteDepartment,
    getCollegeDeleteBlockers,
    getDepartmentDeleteBlockers,
    db,
    showAlert,
    activeRole,
    activeUser,
    schoolYears = [],
    setActiveSchoolYear,
    getSchoolYearsByCollege,
    getActiveSchoolYearForCollege,
    setBaselineSchoolYear,
    getBaselineSchoolYear,
    baselineSemester: contextBaselineSemester,
    setBaselineSemester,
  } = useLMS();

  const baselineSemester: AcademicSemester = normalizeAcademicSemester(contextBaselineSemester);

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

  // ONLY the Dean of this specific college has authority to roll over (Administrators and Chancellors do not)
  const canRolloverCollegeSchoolYear = (college: College) => {
    if (isSuperadminOrChancellor) return false;
    // Admins without dean subrole do not have rollover authority
    if (activeRole === 'admin' && activeUser?.adminSubrole !== 'dean') return false;

    const isDeanOfThisCollege =
      (activeRole === 'admin' && activeUser?.adminSubrole === 'dean' && (
        (activeUser.collegeId && activeUser.collegeId === college.id) ||
        (deanCollege && deanCollege.id === college.id) ||
        (college.deanId && activeUser.id === college.deanId)
      )) ||
      (college.deanId && activeUser?.id === college.deanId);

    return !!isDeanOfThisCollege;
  };

  // True when the signed-in user leads this specific college as its Dean: either
  // the college record appoints them, or they hold the dean subrole for it.
  const viewerIsDeanOfCollege = (college: College) =>
    Boolean(
      (college.deanId && activeUser?.id === college.deanId) ||
        (activeUser?.adminSubrole === 'dean' &&
          activeUser?.collegeId &&
          activeUser.collegeId === college.id)
    );

  // State for the selected school year in the rollover combo box / select list per college
  const [selectedSYByCollege, setSelectedSYByCollege] = useState<Record<string, string>>({});

  // Rollover confirmation verification modal state
  const [rolloverConfirmData, setRolloverConfirmData] = useState<{
    collegeId: string;
    collegeName: string;
    targetSchoolYearId: string;
    targetSchoolYear: string;
    currentActiveYear?: string;
  } | null>(null);
  const [isRollingOver, setIsRollingOver] = useState(false);

  // Admin / Chancellor authority to manage the University-Wide Default Baseline Academic Year
  const canManageBaselineSchoolYear =
    isSuperadminOrChancellor || (activeRole === 'admin' && !activeUser?.adminSubrole);

  const universalSchoolYears = (() => {
    const withoutCollege = (schoolYears || []).filter(sy => !sy.collegeId);
    if (withoutCollege.length > 0) return withoutCollege;
    const seen = new Set<string>();
    return (schoolYears || []).filter(sy => {
      if (seen.has(sy.year)) return false;
      seen.add(sy.year);
      return true;
    });
  })();
  const currentBaseline = getBaselineSchoolYear
    ? getBaselineSchoolYear()
    : universalSchoolYears.find(sy => sy.isActive) || universalSchoolYears[0];

  const [selectedBaselineId, setSelectedBaselineId] = useState<string>('');
  const [baselineConfirmData, setBaselineConfirmData] = useState<{
    targetId: string;
    targetYear: string;
    currentYear: string;
  } | null>(null);
  const [isUpdatingBaseline, setIsUpdatingBaseline] = useState(false);

  const [selectedBaselineSemester, setSelectedBaselineSemester] = useState<AcademicSemester | ''>('');
  const [semesterConfirmData, setSemesterConfirmData] = useState<{
    target: AcademicSemester;
    current: AcademicSemester;
  } | null>(null);
  const [isUpdatingSemester, setIsUpdatingSemester] = useState(false);

  const handleInitiateRollover = (college: College, targetSchoolYearId: string) => {
    const targetSY = getColYears(college.id).find(sy => sy.id === targetSchoolYearId);
    const activeSY = getActiveSchoolYearForCollege ? getActiveSchoolYearForCollege(college.id) : undefined;
    if (!targetSY) return;

    if (currentBaseline && targetSY.year.trim().toLowerCase() !== currentBaseline.year.trim().toLowerCase()) {
      showAlert({
        title: 'Rollover Restricted',
        message: `Colleges can only roll over to the current university baseline academic year (SY ${currentBaseline.year}).`,
        type: 'warning',
      });
      return;
    }

    setRolloverConfirmData({
      collegeId: college.id,
      collegeName: college.name,
      targetSchoolYearId,
      targetSchoolYear: targetSY.year,
      currentActiveYear: activeSY?.year,
    });
  };

  const handleConfirmRollover = async () => {
    if (!rolloverConfirmData || isRollingOver) return;
    setIsRollingOver(true);
    try {
      const res = await setActiveSchoolYear(rolloverConfirmData.collegeId, rolloverConfirmData.targetSchoolYearId);
      if (res.success) {
        showAlert({
          title: 'College Rollover Successful',
          message: res.message || `${rolloverConfirmData.collegeName} has successfully rolled over to SY ${rolloverConfirmData.targetSchoolYear}.`,
          type: 'success',
        });
        setRolloverConfirmData(null);
      } else {
        showAlert({
          title: 'Rollover Failed',
          message: res.message || 'Failed to roll over active school year.',
          type: 'error',
        });
      }
    } finally {
      setIsRollingOver(false);
    }
  };

  const handleInitiateBaselineChange = (targetSchoolYearId: string) => {
    const targetSY = universalSchoolYears.find(sy => sy.id === targetSchoolYearId);
    if (!targetSY) return;

    setBaselineConfirmData({
      targetId: targetSY.id,
      targetYear: targetSY.year,
      currentYear: currentBaseline?.year || '2025-2026',
    });
  };

  const handleConfirmBaselineChange = async () => {
    if (!baselineConfirmData || isUpdatingBaseline) return;
    setIsUpdatingBaseline(true);
    try {
      const res = await setBaselineSchoolYear(baselineConfirmData.targetId);
      if (res.success) {
        showAlert({
          title: 'Baseline Academic Year Updated',
          message: res.message || `University-Wide Default Baseline Year updated to SY ${baselineConfirmData.targetYear}.`,
          type: 'success',
        });
        setBaselineConfirmData(null);
        setSelectedBaselineId('');
      } else {
        showAlert({
          title: 'Update Failed',
          message: res.message || 'Failed to update university baseline academic year.',
          type: 'error',
        });
      }
    } finally {
      setIsUpdatingBaseline(false);
    }
  };

  const handleInitiateSemesterBaselineChange = (target: AcademicSemester) => {
    if (!target || target === baselineSemester) return;
    setSemesterConfirmData({
      target,
      current: baselineSemester,
    });
  };

  const handleConfirmSemesterBaselineChange = async () => {
    if (!semesterConfirmData || isUpdatingSemester) return;
    setIsUpdatingSemester(true);
    try {
      const res = await setBaselineSemester(semesterConfirmData.target);
      if (res.success) {
        showAlert({
          title: 'Baseline Semester Updated',
          message: res.message || `University-Wide Default Baseline Semester updated to ${formatSemesterLabel(semesterConfirmData.target)}.`,
          type: 'success',
        });
        setSemesterConfirmData(null);
        setSelectedBaselineSemester('');
      } else {
        showAlert({
          title: 'Update Failed',
          message: res.message || 'Failed to update university baseline semester.',
          type: 'error',
        });
      }
    } finally {
      setIsUpdatingSemester(false);
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
                // Leave the field unselected so "Select College..." is the default choice.
                // Deans stay locked to their own college.
                setDeptCollegeId(isDean ? effectiveCollegeId || '' : '');
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

      {/* University-Wide Default Baseline Academic Term Card (Admin / Chancellor Console) */}
      {canManageBaselineSchoolYear && (
        <div className="bg-card/70 border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-none">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-foreground">
                  University-Wide Default Baseline Academic Term
                </h3>
                <span className="sr-only">University-Wide Default Baseline Academic Year</span>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Institutional fallback for all academic cycles, new colleges, and un-rolled units. Deans independently roll over their own colleges.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/50">
            {/* Academic Year Control */}
            <div className="flex items-center space-x-2 shrink-0">
              <label htmlFor="baseline-sy-select" className="text-xs text-muted-foreground font-medium shrink-0">
                Change Baseline Year:
              </label>
              <CustomDropdown
                id="baseline-sy-select"
                ariaLabel="Select University-Wide Default Baseline School Year"
                className="w-56"
                searchable
                value={selectedBaselineId || currentBaseline?.id || ''}
                onChange={setSelectedBaselineId}
                options={universalSchoolYears.map((sy) => ({
                  value: sy.id,
                  label: `${sy.year} ${sy.id === currentBaseline?.id || sy.year === currentBaseline?.year ? '(Current Baseline)' : ''}`,
                }))}
              />
              <button
                type="button"
                disabled={!selectedBaselineId || selectedBaselineId === currentBaseline?.id}
                onClick={() => handleInitiateBaselineChange(selectedBaselineId || currentBaseline?.id || '')}
                className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
              >
                <span>Update Baseline</span>
              </button>
            </div>

            {/* Semester Control */}
            <div className="flex items-center space-x-2 shrink-0">
              <label htmlFor="baseline-semester-select" className="text-xs text-muted-foreground font-medium shrink-0">
                Change Baseline Semester:
              </label>
              <CustomDropdown
                id="baseline-semester-select"
                ariaLabel="Select University-Wide Default Baseline Semester"
                className="w-56"
                value={(selectedBaselineSemester || baselineSemester) as string}
                onChange={(val) => setSelectedBaselineSemester(val as AcademicSemester)}
                options={ACADEMIC_SEMESTERS.map((sem) => ({
                  value: sem,
                  label: `${formatSemesterLabel(sem)} ${sem === baselineSemester ? '(Current Baseline)' : ''}`,
                }))}
              />
              <button
                type="button"
                disabled={!selectedBaselineSemester || selectedBaselineSemester === baselineSemester}
                onClick={() => handleInitiateSemesterBaselineChange((selectedBaselineSemester || baselineSemester) as AcademicSemester)}
                className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
              >
                <span>Update Semester</span>
              </button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/80 italic">
            Changing the baseline academic year resets the baseline semester to First Semester and requires Deans to roll over again.
          </p>
        </div>
      )}

      {/* Colleges & Departments List */}
      <div className="space-y-5">
        {displayedColleges.map(college => {
          const dean = getUserById(college.deanId);
          const collegeDepts = (departments || []).filter(d => d.collegeId === college.id);
          const isExpanded = Boolean(expandedColleges[college.id]);

          return (
            <div
              key={college.id}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-none"
            >
              {/* College Header */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={`Toggle programs for ${college.name}`}
                onClick={() => toggleCollegeCollapse(college.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCollegeCollapse(college.id);
                  }
                }}
                className={`p-4 sm:p-5 bg-muted/40 ${isExpanded ? 'border-b border-border' : ''} flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-muted/60 transition-colors`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    aria-hidden="true"
                    className="p-1 rounded-lg text-muted-foreground transition-colors"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
                        isExpanded ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
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
                <div className="flex items-center space-x-3 shrink-0">
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
                              navigate(`/accounts/create-leadership?role=dean&collegeId=${encodeURIComponent(college.id)}`);
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
              </div>

              {/* Collapsible Content */}
              <div
                id={`college-content-${college.id}`}
                data-testid={`college-content-${college.id}`}
                aria-hidden={!isExpanded}
                className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                  isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden min-h-0">
                  {/* Program Listing Table */}
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
                                        navigate(`/accounts/create-leadership?role=chairperson&departmentId=${encodeURIComponent(dept.id)}&collegeId=${encodeURIComponent(college.id)}`);
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

                  {/* Collegiate School Years & Academic Cycles Section */}
                  <div className="p-4 sm:p-5 bg-card/60 border-t border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Collegiate School Year & Rollover</h4>
                        </div>
                      </div>
                    </div>

                    {/* School Year Select / Combo Box */}
                    {(() => {
                      const collegeYears = getColYears(college.id);
                      const activeSY = getActiveSchoolYearForCollege ? getActiveSchoolYearForCollege(college.id) : undefined;
                      if (collegeYears.length === 0) {
                        return (
                          <div className="p-3 bg-muted/20 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground">
                            No school years registered. School years are automatically generated with 5 years in advance.
                          </div>
                        );
                      }

                      // Default the selection to the current baseline year if available, else first non-active, else active, else first
                      const currentSelectedId =
                        selectedSYByCollege[college.id] ||
                        (currentBaseline ? collegeYears.find(sy => sy.year === currentBaseline.year)?.id : undefined) ||
                        collegeYears.find(sy => (activeSY ? sy.year !== activeSY.year : !sy.isActive))?.id ||
                        activeSY?.id ||
                        collegeYears[0]?.id;

                      const canRollover = canRolloverCollegeSchoolYear(college);
                      const selectedTargetSY = collegeYears.find(sy => sy.id === currentSelectedId);
                      const isSelectedBaseline = currentBaseline && selectedTargetSY ? selectedTargetSY.year === currentBaseline.year : false;
                      const isSelectedActive = activeSY && selectedTargetSY ? activeSY.year === selectedTargetSY.year : false;
                      const isRolloverAllowed = Boolean(isSelectedBaseline && !isSelectedActive);
                      // A college already sitting on the university baseline has no
                      // rollover decision left to make, so the year picker is locked.
                      const isBaselineActiveForCollege = Boolean(
                        currentBaseline &&
                        activeSY &&
                        currentBaseline.year?.trim().toLowerCase() === activeSY.year?.trim().toLowerCase()
                      );

                      return (
                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Current Active Badge Display & Baseline Mismatch Badge */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground font-medium">Active School Year:</span>
                              <div className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                <span>{activeSY?.year || '2025-2026'}</span>
                              </div>
                              {currentBaseline && activeSY && currentBaseline.year.trim().toLowerCase() !== activeSY.year.trim().toLowerCase() && (
                                <div
                                  data-testid={`baseline-mismatch-badge-${college.id}`}
                                  title={`The university baseline is AY ${currentBaseline.year}, which differs from this college's active academic year.`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 shadow-xs"
                                >
                                  <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                                  <span className="text-muted-foreground font-normal">Current Baseline:</span>
                                  <span className="font-extrabold">{currentBaseline.year}</span>
                                </div>
                              )}
                            </div>

                            {/* Select / Combo Box and Rollover Action */}
                            {canRollover ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <label
                                  htmlFor={`sy-select-${college.id}`}
                                  className="text-xs text-muted-foreground font-medium shrink-0"
                                >
                                  Academic Year:
                                </label>
                                <span
                                  className="inline-flex"
                                  title={
                                    isBaselineActiveForCollege
                                      ? `This college is already on the university baseline (SY ${activeSY?.year}).`
                                      : undefined
                                  }
                                >
                                  <CustomDropdown
                                    id={`sy-select-${college.id}`}
                                    ariaLabel={`Select school year to roll over for ${college.name}`}
                                    className="w-48"
                                    searchable
                                    disabled={isBaselineActiveForCollege}
                                    value={currentSelectedId}
                                    onChange={(next) => {
                                      setSelectedSYByCollege(prev => ({
                                        ...prev,
                                        [college.id]: next,
                                      }));
                                    }}
                                    options={collegeYears.map((sy: SchoolYear) => {
                                      const isCurrentActive = activeSY ? activeSY.year === sy.year : sy.isActive;
                                      const isBaseline = currentBaseline ? currentBaseline.year === sy.year : false;
                                      let labelSuffix = '';
                                      if (isCurrentActive && isBaseline) {
                                        labelSuffix = ' (Current Active & Baseline)';
                                      } else if (isCurrentActive) {
                                        labelSuffix = ' (Current Active)';
                                      } else if (isBaseline) {
                                        labelSuffix = ' (University Baseline)';
                                      }
                                      return { value: sy.id, label: `${sy.year}${labelSuffix}` };
                                    })}
                                  />
                                </span>
                                <button
                                  type="button"
                                  disabled={!isRolloverAllowed}
                                  title={
                                    !isSelectedBaseline
                                      ? `Colleges can only roll over to the current university baseline academic year (SY ${currentBaseline?.year || ''}).`
                                      : isSelectedActive
                                      ? 'This academic year is already active for this college.'
                                      : `Roll over ${college.name} to SY ${selectedTargetSY?.year || ''}`
                                  }
                                  onClick={() => handleInitiateRollover(college, currentSelectedId)}
                                  className="px-3.5 py-1.5 bg-card hover:bg-muted active:scale-[0.98] text-foreground font-bold text-xs rounded-xl border border-border hover:border-primary/40 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <span>Roll Over to Year</span>
                                </button>
                              </div>
                            ) : viewerIsDeanOfCollege(college) ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-medium shrink-0">
                                  Available Years:
                                </span>
                                <CustomDropdown
                                  disabled
                                  ariaLabel={`Available school years for ${college.name}`}
                                  className="w-44"
                                  value={activeSY?.id || ''}
                                  onChange={() => {}}
                                  options={collegeYears.map((sy: SchoolYear) => ({
                                    value: sy.id,
                                    label: `${sy.year} ${activeSY && activeSY.year === sy.year ? '(Current Active)' : ''}`,
                                  }))}
                                />
                              </div>
                            ) : null}
                          </div>
                          {canRollover && selectedTargetSY && !isSelectedBaseline && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 text-left sm:text-right">
                              Colleges can only roll over to the current university baseline academic year (SY {currentBaseline?.year}).
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
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
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30 uppercase placeholder:normal-case"
              />
            </div>
            <div>
              <label htmlFor="new-college-dean" className="block text-xs font-bold text-foreground mb-1">
                Initial Dean (Optional)
              </label>
              <CustomDropdown
                id="new-college-dean"
                searchable
                placeholder="Leave Unassigned (Appoint Later)"
                value={initialDeanId}
                onChange={setInitialDeanId}
                options={[
                  { value: '', label: 'Leave Unassigned (Appoint Later)' },
                  ...eligibleDeanCandidates.map(c => ({
                    value: c.id,
                    label: `${c.name} (${c.email})${c.department ? ` - ${c.department}` : ''}`,
                  })),
                ]}
              />
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
              <CustomDropdown
                id="dept-college-select"
                disabled={isDean}
                searchable={!isDean}
                placeholder="Select College..."
                value={isDean ? (effectiveCollegeId || deptCollegeId) : deptCollegeId}
                onChange={setDeptCollegeId}
                options={
                  isDean
                    ? [
                        {
                          value: effectiveCollegeId || deptCollegeId,
                          label: deanCollege
                            ? `${deanCollege.name} (${deanCollege.code})`
                            : activeUser?.collegeName || 'Current College',
                        },
                      ]
                    : [
                        { value: '', label: 'Select College...' },
                        ...(colleges || []).map(c => ({ value: c.id, label: `${c.name} (${c.code})` })),
                      ]
                }
              />
            </div>
            <div>
              <label htmlFor="new-dept-name" className="block text-xs font-bold text-foreground mb-1">
                Program Name
              </label>
              <input
                id="new-dept-name"
                type="text"
                required
                placeholder="e.g. Agribusiness"
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
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30 uppercase placeholder:normal-case"
              />
            </div>
            <div>
              <label htmlFor="new-dept-chair" className="block text-xs font-bold text-foreground mb-1">
                Initial Chairperson (Optional)
              </label>
              <CustomDropdown
                id="new-dept-chair"
                searchable
                placeholder="Leave Unassigned (Appoint Later)"
                value={initialChairId}
                onChange={setInitialChairId}
                options={[
                  { value: '', label: 'Leave Unassigned (Appoint Later)' },
                  ...eligibleChairCandidates.map(c => ({
                    value: c.id,
                    label: `${c.name} (${c.email})${c.program || c.department ? ` - ${c.program || c.department}` : ''}`,
                  })),
                ]}
              />
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

      {/* ROLLOVER VERIFICATION MODAL */}
      {rolloverConfirmData && (
        <DialogFrame
          title="Confirm Academic Year Rollover"
          subtitle={`Roll over ${rolloverConfirmData.collegeName} to a new academic cycle`}
          onClose={() => !isRollingOver && setRolloverConfirmData(null)}
          footer={
            <>
              <button
                type="button"
                disabled={isRollingOver}
                onClick={() => setRolloverConfirmData(null)}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRollingOver}
                onClick={handleConfirmRollover}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <span>{isRollingOver ? 'Rolling Over...' : 'Confirm Rollover'}</span>
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-xl text-foreground space-y-1">
              <div className="font-bold text-sm text-primary flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Transitioning to SY {rolloverConfirmData.targetSchoolYear}</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You are about to roll over <strong className="text-foreground">{rolloverConfirmData.collegeName}</strong> from{' '}
                <span className="font-semibold text-foreground">{rolloverConfirmData.currentActiveYear || 'the current cycle'}</span> to{' '}
                <span className="font-bold text-primary">{rolloverConfirmData.targetSchoolYear}</span>.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Rolling over the active academic year sets the default collegiate term for future enrollments, courses, and grading periods. Deans retain authority to roll over whenever necessary.
              </span>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* BASELINE CONFIRMATION MODAL */}
      {baselineConfirmData && (
        <DialogFrame
          title="Confirm Baseline Academic Year Update"
          subtitle="Update the university-wide baseline school year"
          onClose={() => !isUpdatingBaseline && setBaselineConfirmData(null)}
          footer={
            <>
              <button
                type="button"
                disabled={isUpdatingBaseline}
                onClick={() => setBaselineConfirmData(null)}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingBaseline}
                onClick={handleConfirmBaselineChange}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <span>{isUpdatingBaseline ? 'Updating...' : 'Confirm Update'}</span>
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-xl text-foreground space-y-1">
              <div className="font-bold text-sm text-primary flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>New University Baseline: SY {baselineConfirmData.targetYear}</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You are updating the University-Wide Default Baseline Academic Year from{' '}
                <span className="font-semibold text-foreground">{baselineConfirmData.currentYear}</span> to{' '}
                <span className="font-bold text-primary">{baselineConfirmData.targetYear}</span>.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This updates the baseline active flag in Likha ERP (`school_years` table). Existing colleges that have independently rolled over to their own active school year will retain their respective collegiate years.
              </span>
            </div>
          </div>
        </DialogFrame>
      )}

      {/* BASELINE SEMESTER CONFIRMATION MODAL */}
      {semesterConfirmData && (
        <DialogFrame
          title="Confirm Baseline Semester Update"
          subtitle="Set the university-wide baseline semester"
          onClose={() => !isUpdatingSemester && setSemesterConfirmData(null)}
          footer={
            <>
              <button
                type="button"
                disabled={isUpdatingSemester}
                onClick={() => setSemesterConfirmData(null)}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isUpdatingSemester}
                onClick={handleConfirmSemesterBaselineChange}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                <span>{isUpdatingSemester ? 'Updating...' : 'Confirm Baseline Semester'}</span>
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-xl text-foreground space-y-1">
              <div className="font-bold text-sm text-primary flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>New Baseline Semester: {formatSemesterLabel(semesterConfirmData.target)}</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You are updating the University-Wide Default Baseline Semester from{' '}
                <span className="font-semibold text-foreground">{formatSemesterLabel(semesterConfirmData.current)}</span> to{' '}
                <span className="font-bold text-primary">{formatSemesterLabel(semesterConfirmData.target)}</span>.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Colleges must roll over to this semester in order to create courses or upload course offerings for this term.
              </span>
            </div>
          </div>
        </DialogFrame>
      )}
    </div>
  );
};
