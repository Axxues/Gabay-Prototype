import React, { useState, useMemo } from 'react';
import { useLMS } from '../../../shared/context/LMSContext';
import type { User, LeadershipRoleType } from '../../../shared/types/lms';
import { DialogFrame } from '../../../shared/components/common/DialogFrame';
import { UserAvatar } from '../../../shared/components/common/UserAvatar';
import { ShieldAlert, ArrowRightLeft, UserPlus, FileCheck } from 'lucide-react';

export interface LeadershipTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  leader?: User;
  forcedRoleType?: LeadershipRoleType;
  forcedUnitId?: string;
  forcedUnitName?: string;
  onSuccess?: () => void;
}

export const LeadershipTransferModal: React.FC<LeadershipTransferModalProps> = ({
  isOpen,
  onClose,
  leader: propLeader,
  forcedRoleType,
  forcedUnitId,
  forcedUnitName,
  onSuccess,
}) => {
  const { activeUser, colleges, departments, transferLeadership, showAlert } = useLMS();

  const currentLeader = propLeader || activeUser;

  // Determine roleType, unitId, unitName
  const { roleType, unitId, unitName } = useMemo(() => {
    if (forcedRoleType) {
      return {
        roleType: forcedRoleType,
        unitId: forcedUnitId || (forcedRoleType === 'admin' ? 'system' : ''),
        unitName: forcedUnitName || (forcedRoleType === 'admin' ? 'Institutional Administration' : ''),
      };
    }

    let rType: LeadershipRoleType = 'dean';
    let uId = '';
    let uName = '';

    if (
      currentLeader?.adminSubrole === 'chancellor' ||
      currentLeader?.role === 'superadmin' ||
      (currentLeader?.role === 'admin' && !currentLeader.adminSubrole)
    ) {
      rType = 'admin';
      uId = 'system';
      uName = 'Institutional Administration';
    } else if (currentLeader?.adminSubrole === 'chairperson') {
      rType = 'chairperson';
    } else if (currentLeader?.adminSubrole === 'dean') {
      rType = 'dean';
    } else {
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
      } else if (rType === 'chairperson') {
        const leaderUnit = currentLeader?.program || currentLeader?.department;
        const dept = (departments || []).find(
          d =>
            d.id === leaderUnit ||
            (leaderUnit && d.name.toLowerCase() === leaderUnit.toLowerCase())
        );
        uId = dept?.id || leaderUnit || 'dept-cs';
        uName = dept?.name || leaderUnit || 'Computer Science';
      }
    }

    return { roleType: rType, unitId: uId, unitName: uName };
  }, [currentLeader, colleges, departments, forcedRoleType, forcedUnitId, forcedUnitName]);

  const defaultTitle = useMemo(() => {
    if (roleType === 'dean') return 'College Dean';
    if (roleType === 'chairperson') return 'Program Chairperson';
    return 'Institutional Administrator';
  }, [roleType]);

  // Form states: Direct Appointee Information (No Faculty Accounts Selected)
  const [newLeaderName, setNewLeaderName] = useState<string>('');
  const [newLeaderTitle, setNewLeaderTitle] = useState<string>('');
  const [resolutionNo, setResolutionNo] = useState<string>('');
  const [transitionNotes, setTransitionNotes] = useState<string>('');
  const [step, setStep] = useState<'details' | 'confirm'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentRoleTitle =
    roleType === 'admin'
      ? 'University / Institutional Administrator'
      : roleType === 'dean'
      ? `Dean of ${unitName}`
      : `Program Chairperson of ${unitName}`;

  const handleProceedToConfirm = () => {
    if (!newLeaderName.trim()) return;
    setStep('confirm');
  };

  const handleConfirmTransfer = async () => {
    if (!newLeaderName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const fullNotes = [
        resolutionNo.trim() ? `Board/Appointment Ref: ${resolutionNo.trim()}` : null,
        transitionNotes.trim() || null,
      ]
        .filter(Boolean)
        .join(' • ');

      const res = await transferLeadership(
        roleType,
        currentLeader?.id || 'none',
        newLeaderName.trim(),
        unitId,
        fullNotes || undefined,
        {
          title: newLeaderTitle.trim() || defaultTitle,
          resolutionNo: resolutionNo.trim() || undefined,
        }
      );

      if (res.success) {
        showAlert({
          title: 'Leadership Seat Handover Complete',
          message: res.message || 'Office seat account has been successfully transferred to the new appointee.',
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
      subtitle="Institutional office seat handover. The leadership seat account remains an Administrative account and is reassigned to the new appointee."
      onClose={onClose}
      wide={false}
      footer={
        step === 'details' ? (
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
              disabled={!newLeaderName.trim()}
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
              onClick={() => setStep('details')}
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

        {step === 'details' ? (
          <div className="space-y-3.5">
            {/* New Appointee Name */}
            <div>
              <label
                htmlFor="new-leader-name"
                className="block text-xs font-bold text-foreground mb-1.5 flex items-center justify-between"
              >
                <span>New Appointee Full Name *</span>
                <span className="text-[11px] text-muted-foreground font-normal">Incoming Leader</span>
              </label>
              <input
                id="new-leader-name"
                type="text"
                value={newLeaderName}
                onChange={e => setNewLeaderName(e.target.value)}
                placeholder="e.g. Dr. Aris Thorne"
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground font-medium"
                required
              />
            </div>

            {/* Appointee Title */}
            <div>
              <label
                htmlFor="new-leader-title"
                className="block text-xs font-bold text-foreground mb-1.5"
              >
                Official Title / Academic Designation
              </label>
              <input
                id="new-leader-title"
                type="text"
                value={newLeaderTitle}
                onChange={e => setNewLeaderTitle(e.target.value)}
                placeholder={defaultTitle}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
              />
            </div>

            {/* Appointment / Board Resolution Reference */}
            <div>
              <label
                htmlFor="appointment-ref"
                className="block text-xs font-bold text-foreground mb-1.5"
              >
                Appointment Order / Board Resolution Ref (Optional)
              </label>
              <input
                id="appointment-ref"
                type="text"
                value={resolutionNo}
                onChange={e => setResolutionNo(e.target.value)}
                placeholder="e.g. BOR Resolution No. 2026-14"
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
              />
            </div>

            {/* Transition Notes */}
            <div>
              <label
                htmlFor="transition-notes"
                className="block text-xs font-bold text-foreground mb-1.5"
              >
                Transition Reason / Notes (Optional)
              </label>
              <input
                id="transition-notes"
                type="text"
                value={transitionNotes}
                onChange={e => setTransitionNotes(e.target.value)}
                placeholder="e.g. Scheduled term turnover for Academic Year 2026–2027"
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
              />
            </div>

            {/* University Governance Rule Notice */}
            <div className="p-3 bg-muted/40 border border-border/70 rounded-xl text-[11px] text-muted-foreground space-y-1.5">
              <div className="font-bold text-foreground flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                <span>University Governance Rule: Separate Account Model</span>
              </div>
              <p className="leading-relaxed">
                Under institutional policy, Dean and Chair accounts are separate from personal faculty accounts.
                This operation hands over the <strong>{roleType === 'dean' ? 'Dean' : roleType === 'chairperson' ? 'Chair' : 'Admin'} seat account</strong> to the new appointee.
                Previous personal profile data is removed from the active seat, all administrative history is permanently preserved in the timeline, and personal faculty accounts remain completely untouched.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-xs text-foreground space-y-2">
              <div className="font-bold flex items-center space-x-2 text-sm text-primary">
                <FileCheck className="w-4.5 h-4.5 shrink-0" />
                <span>Confirm Leadership Seat Handover</span>
              </div>
              <p className="leading-relaxed text-muted-foreground text-xs">
                {`The official ${roleType === 'dean' ? 'Dean' : roleType === 'chairperson' ? 'Chairperson' : 'Admin'} seat account will be handed over to ${newLeaderName.trim()}. This account retains its administrative status and will NOT be stepped down to faculty. The predecessor's administration will be permanently archived in the Governance Timeline with all historical courses and records.`}
              </p>
            </div>

            {/* Handover comparison */}
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border text-muted-foreground font-semibold text-[11px]">
                <span>Office Seat Succession Summary</span>
                <span>Unit: {unitName}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="font-medium text-foreground">Outgoing Seat Occupant</span>
                <span className="text-muted-foreground font-mono text-[11px]">{currentLeader?.name || 'Incumbent'} (Archived to Timeline)</span>
              </div>
              <div className="flex items-center justify-between py-1 text-primary font-bold">
                <span className="flex items-center space-x-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Incoming Seat Appointee</span>
                </span>
                <span className="font-mono text-[11px]">
                  {newLeaderName.trim()} ({newLeaderTitle.trim() || defaultTitle})
                </span>
              </div>
              <div className="flex items-center justify-between py-1 text-muted-foreground text-[11px]">
                <span>Account Role Status</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Remains Admin / {roleType === 'dean' ? 'Dean' : roleType === 'chairperson' ? 'Chair' : 'Admin'} (Never Stepped Down)
                </span>
              </div>
              {(resolutionNo.trim() || transitionNotes.trim()) && (
                <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground space-y-0.5">
                  {resolutionNo.trim() && (
                    <div><span className="font-semibold text-foreground">Reference: </span>{resolutionNo.trim()}</div>
                  )}
                  {transitionNotes.trim() && (
                    <div><span className="font-semibold text-foreground">Turnover Note: </span>{transitionNotes.trim()}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DialogFrame>
  );
};
