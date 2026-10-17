import React, { useState, useMemo } from 'react';
import { useLMS } from '../../../shared/context/LMSContext';
import type { User } from '../../../shared/types/lms';
import { DialogFrame } from '../../../shared/components/common/DialogFrame';
import { UserAvatar } from '../../../shared/components/common/UserAvatar';
import { ShieldAlert, ArrowRightLeft, UserCheck, AlertTriangle } from 'lucide-react';

export interface LeadershipTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  leader?: User;
  onSuccess?: () => void;
}

export const LeadershipTransferModal: React.FC<LeadershipTransferModalProps> = ({
  isOpen,
  onClose,
  leader: propLeader,
  onSuccess,
}) => {
  const { activeUser, db, colleges, departments, transferLeadership, showAlert } = useLMS();

  const currentLeader = propLeader || activeUser;

  // Determine roleType, unitId, unitName
  const { roleType, unitId, unitName } = useMemo(() => {
    let rType: 'dean' | 'chairperson' = 'dean';
    let uId = '';
    let uName = '';

    if (currentLeader?.adminSubrole === 'chairperson') {
      rType = 'chairperson';
    } else if (currentLeader?.adminSubrole === 'dean') {
      rType = 'dean';
    } else {
      // Check in colleges or departments
      const matchedCol = (colleges || []).find(c => c.deanId === currentLeader?.id);
      if (matchedCol) {
        rType = 'dean';
        uId = matchedCol.id;
        uName = matchedCol.name;
      } else {
        const matchedDept = (departments || []).find(d => d.chairpersonId === currentLeader?.id);
        if (matchedDept) {
          rType = 'chairperson';
          uId = matchedDept.id;
          uName = matchedDept.name;
        }
      }
    }

    if (!uId) {
      if (rType === 'dean') {
        const col = (colleges || []).find(
          c =>
            c.id === currentLeader?.collegeId ||
            (currentLeader?.collegeName && c.name.toLowerCase() === currentLeader.collegeName.toLowerCase())
        );
        uId = col?.id || currentLeader?.collegeId || 'col-ccs';
        uName = col?.name || currentLeader?.collegeName || 'College of Computer Science';
      } else {
        const dept = (departments || []).find(
          d =>
            d.id === currentLeader?.department ||
            (currentLeader?.department && d.name.toLowerCase() === currentLeader.department.toLowerCase())
        );
        uId = dept?.id || currentLeader?.department || 'dept-cs';
        uName = dept?.name || currentLeader?.department || 'Department of Computer Science';
      }
    }

    return { roleType: rType, unitId: uId, unitName: uName };
  }, [currentLeader, colleges, departments]);

  // Find eligible verified faculty members in this unit
  const eligibleFaculty = useMemo(() => {
    const allUsers = db?.users || [];
    return allUsers.filter(u => {
      if (!u || u.id === currentLeader?.id) return false;
      if (u.role !== 'faculty') return false;

      if (roleType === 'dean') {
        const matchesCollege =
          u.collegeId === unitId ||
          (u.collegeName && unitName && u.collegeName.toLowerCase() === unitName.toLowerCase()) ||
          u.collegeId === currentLeader?.collegeId ||
          (currentLeader?.collegeName && u.collegeName === currentLeader.collegeName);
        return matchesCollege;
      } else {
        const matchesDept =
          u.department === unitName ||
          u.department === currentLeader?.department ||
          u.department === unitId;
        return matchesDept;
      }
    });
  }, [db?.users, currentLeader, roleType, unitId, unitName]);

  const [selectedSuccessorId, setSelectedSuccessorId] = useState<string>('');
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedSuccessor = useMemo(() => {
    return eligibleFaculty.find(f => f.id === selectedSuccessorId);
  }, [eligibleFaculty, selectedSuccessorId]);

  if (!isOpen) return null;

  const currentRoleTitle =
    roleType === 'dean' ? `Dean of ${unitName}` : `Chairperson of ${unitName}`;

  const handleProceedToConfirm = () => {
    if (!selectedSuccessorId) return;
    setStep('confirm');
  };

  const handleConfirmTransfer = async () => {
    if (!selectedSuccessorId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await transferLeadership(
        roleType,
        currentLeader.id,
        selectedSuccessorId,
        unitId
      );

      if (res.success) {
        showAlert({
          title: 'Leadership Transferred',
          message: res.message || 'Leadership authority has been successfully handed over.',
          type: 'success',
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showAlert({
          title: 'Transfer Failed',
          message: res.message || 'Unable to complete leadership transfer.',
          type: 'error',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogFrame
      title="Leadership Authority Transfer"
      subtitle="Strict single-seat leadership handover. The predecessor will step down to faculty."
      onClose={onClose}
      wide={false}
      footer={
        step === 'select' ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedSuccessorId}
              onClick={handleProceedToConfirm}
              className="px-4 py-2 bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
            >
              <span>Review Transfer</span>
              <ArrowRightLeft className="w-3.5 h-3.5 ml-1" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setStep('select')}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmTransfer}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait flex items-center space-x-1.5"
            >
              <span>{isSubmitting ? 'Transferring Authority...' : 'Confirm Leadership Transfer'}</span>
            </button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* Incumbent Role Badge */}
        <div className="p-3.5 bg-muted/60 border border-border rounded-xl flex items-center space-x-3">
          <UserAvatar
            name={currentLeader?.name || 'Leader'}
            src={currentLeader?.avatar}
            className="w-10 h-10 rounded-full border border-border shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              Current Incumbent
            </div>
            <div className="font-bold text-foreground text-sm truncate">
              {currentLeader?.name || 'Current Leader'}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {currentRoleTitle}
            </div>
          </div>
        </div>

        {step === 'select' ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="select-successor"
                className="block text-xs font-bold text-foreground mb-1.5"
              >
                Select Successor (Eligible Faculty)
              </label>
              {eligibleFaculty.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>No eligible verified faculty members found in this unit.</span>
                </div>
              ) : (
                <select
                  id="select-successor"
                  aria-label="Select Successor (Eligible Faculty)"
                  value={selectedSuccessorId}
                  onChange={e => setSelectedSuccessorId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                >
                  <option value="">Choose an eligible faculty member...</option>
                  {eligibleFaculty.map(faculty => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.name} ({faculty.email}) - {faculty.department}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="p-3 bg-muted/40 border border-border/70 rounded-xl text-[11px] text-muted-foreground space-y-1">
              <div className="font-bold text-foreground flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                <span>Single-Seat Succession Invariant</span>
              </div>
              <p>
                Under the Gabay governance model, exactly one person may occupy an administrative
                leadership seat ({roleType === 'dean' ? 'Dean' : 'Chair'}).
                Handing over this seat instantly relinquishes administrative privilege and transfers
                unit control to the chosen faculty successor.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-700 dark:text-red-300 space-y-2">
              <div className="font-bold flex items-center space-x-2 text-sm text-red-800 dark:text-red-200">
                <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
                <span>Irreversible Authority Handover</span>
              </div>
              <p className="leading-relaxed">
                {`You will step down to regular Faculty and transfer administrative authority to ${selectedSuccessor?.name || ''}. Exactly 1 leader is permitted.`}
              </p>
            </div>

            {/* Handover comparison */}
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border text-muted-foreground font-semibold text-[11px]">
                <span>Role Transition Summary</span>
                <span>Unit: {unitName}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="font-medium text-foreground">{currentLeader?.name} (You)</span>
                <span className="text-muted-foreground font-mono text-[11px]">{roleType === 'dean' ? 'Dean' : 'Chair'} → Faculty</span>
              </div>
              <div className="flex items-center justify-between py-1 text-primary font-bold">
                <span className="flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{selectedSuccessor?.name}</span>
                </span>
                <span className="font-mono text-[11px]">
                  Faculty → {roleType === 'dean' ? 'Dean' : 'Chair'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </DialogFrame>
  );
};
