import React, { useState } from 'react';
import { useLMS } from '../../../shared/context/LMSContext';
import type { College, Department, User } from '../../../shared/types/lms';
import { DialogFrame } from '../../../shared/components/common/DialogFrame';
import { UserAvatar } from '../../../shared/components/common/UserAvatar';
import {
  Building,
  Plus,
  ShieldAlert,
  ChevronRight,
  FolderTree,
  AlertCircle
} from 'lucide-react';

export const AcademicStructureTab: React.FC = () => {
  const {
    colleges,
    departments,
    addCollege,
    addDepartment,
    transferLeadership,
    db,
    showAlert,
  } = useLMS();

  // Modal states
  const [isAddCollegeOpen, setIsAddCollegeOpen] = useState(false);
  const [collegeName, setCollegeName] = useState('');
  const [collegeCode, setCollegeCode] = useState('');
  const [isSubmittingCollege, setIsSubmittingCollege] = useState(false);

  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [deptCollegeId, setDeptCollegeId] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
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

  // Helper to find a user by ID
  const getUserById = (id?: string): User | undefined => {
    if (!id) return undefined;
    return (db?.users || []).find(u => u.id === id);
  };

  // Submit new college
  const handleCreateCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName.trim() || !collegeCode.trim() || isSubmittingCollege) return;

    setIsSubmittingCollege(true);
    try {
      const newCol: College = {
        id: `col-${collegeCode.trim().toLowerCase()}-${Date.now().toString().slice(-4)}`,
        name: collegeName.trim(),
        code: collegeCode.trim().toUpperCase(),
      };
      await addCollege(newCol);
      showAlert({
        title: 'College Added',
        message: `${newCol.name} (${newCol.code}) was created successfully.`,
        type: 'success',
      });
      setIsAddCollegeOpen(false);
      setCollegeName('');
      setCollegeCode('');
    } finally {
      setIsSubmittingCollege(false);
    }
  };

  // Submit new department
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCollegeId || !deptName.trim() || !deptCode.trim() || isSubmittingDept) return;

    setIsSubmittingDept(true);
    try {
      const newDept: Department = {
        id: `dept-${deptCode.trim().toLowerCase()}-${Date.now().toString().slice(-4)}`,
        collegeId: deptCollegeId,
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase(),
      };
      await addDepartment(newDept);
      showAlert({
        title: 'Department Added',
        message: `${newDept.name} (${newDept.code}) was added to the college.`,
        type: 'success',
      });
      setIsAddDeptOpen(false);
      setDeptName('');
      setDeptCode('');
      setDeptCollegeId('');
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

  // Eligible candidates for the open appointment modal
  const eligibleCandidates = (db?.users || []).filter(u => {
    if (!appointModalData) return false;
    // Don't show current leader
    if (appointModalData.currentLeaderId && u.id === appointModalData.currentLeaderId) return false;
    return u.role === 'faculty' || u.role === 'admin';
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 bg-card border border-border rounded-2xl">
        <div>
          <h2 className="text-sm font-extrabold text-foreground flex items-center space-x-2">
            <FolderTree className="w-4 h-4 text-primary" />
            <span>Academic Structure & Multi-College Governance</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chancellor administrative console: dynamically provision colleges, academic
            departments, and designate unit leadership seats.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddCollegeOpen(true)}
            className="px-3.5 py-2 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add College</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (colleges.length > 0) setDeptCollegeId(colleges[0].id);
              setIsAddDeptOpen(true);
            }}
            className="px-3.5 py-2 bg-muted hover:bg-muted/80 active:scale-[0.98] text-foreground font-bold text-xs rounded-xl border border-border transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </button>
        </div>
      </div>

      {/* Colleges & Departments List */}
      <div className="space-y-5">
        {(colleges || []).map(college => {
          const dean = getUserById(college.deanId);
          const collegeDepts = (departments || []).filter(d => d.collegeId === college.id);

          return (
            <div
              key={college.id}
              className="bg-card border border-border rounded-2xl overflow-hidden shadow-none"
            >
              {/* College Header */}
              <div className="p-4 sm:p-5 bg-muted/40 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
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
                      {collegeDepts.length} {collegeDepts.length === 1 ? 'Department' : 'Departments'}
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
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Dean</div>
                        <div className="text-xs font-bold text-foreground truncate max-w-[140px]">
                          {dean.name}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
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
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="text-left min-w-0 pr-2">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Dean</div>
                        <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          Not Appointed
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
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
                    </>
                  )}
                </div>
              </div>

              {/* Department Listing Table */}
              <div className="divide-y divide-border/60">
                {collegeDepts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No departments added yet for this college.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setDeptCollegeId(college.id);
                        setIsAddDeptOpen(true);
                      }}
                      className="text-primary font-bold hover:underline ml-1"
                    >
                      Add one now
                    </button>
                  </div>
                ) : (
                  collegeDepts.map(dept => {
                    const chair = getUserById(dept.chairpersonId);

                    return (
                      <div
                        key={dept.id}
                        className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-foreground text-xs">{dept.name}</span>
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
                              <button
                                type="button"
                                onClick={() => {
                                  setAppointModalData({
                                    roleType: 'chairperson',
                                    unitId: dept.id,
                                    unitName: dept.name,
                                    currentLeaderId: dept.chairpersonId,
                                  });
                                }}
                                className="text-[11px] text-primary hover:underline font-semibold ml-2"
                              >
                                Reassign
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                              <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                                No Chair Appointed
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setAppointModalData({
                                    roleType: 'chairperson',
                                    unitId: dept.id,
                                    unitName: dept.name,
                                    currentLeaderId: dept.chairpersonId,
                                  });
                                }}
                                className="text-xs text-primary font-bold hover:underline ml-1"
                              >
                                Appoint
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
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
          onClose={() => setIsAddCollegeOpen(false)}
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
            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsAddCollegeOpen(false)}
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

      {/* ADD DEPARTMENT MODAL */}
      {isAddDeptOpen && (
        <DialogFrame
          title="Add Academic Department"
          subtitle="Attach an academic department under an existing college."
          onClose={() => setIsAddDeptOpen(false)}
        >
          <form onSubmit={handleCreateDepartment} className="space-y-4">
            <div>
              <label htmlFor="dept-college-select" className="block text-xs font-bold text-foreground mb-1">
                Select Parent College
              </label>
              <select
                id="dept-college-select"
                required
                value={deptCollegeId}
                onChange={e => setDeptCollegeId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select College...</option>
                {colleges.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-dept-name" className="block text-xs font-bold text-foreground mb-1">
                Department Name
              </label>
              <input
                id="new-dept-name"
                type="text"
                required
                placeholder="e.g. Department of Agribusiness"
                value={deptName}
                onChange={e => setDeptName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label htmlFor="new-dept-code" className="block text-xs font-bold text-foreground mb-1">
                Department Code
              </label>
              <input
                id="new-dept-code"
                type="text"
                required
                placeholder="e.g. AGRIBUS"
                value={deptCode}
                onChange={e => setDeptCode(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30 uppercase"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsAddDeptOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingDept}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDept ? 'Adding...' : 'Add Department'}
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
    </div>
  );
};
