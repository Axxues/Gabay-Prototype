import React, { useState, useMemo } from 'react';
import type { SyllabusGroup } from '../../types/lifecycle';
import type { User } from '../../../../shared/types/lms';
import { isFacultyRole } from '../../../../shared/utils/roles';
import { AnimatedModal } from '../../../../shared/components/common/ModalPortal';
import { Search, UserCheck, X, Users, AlertCircle } from 'lucide-react';

interface AssignEvaluatorsModalProps {
  isOpen: boolean;
  group: SyllabusGroup | null;
  users: User[];
  onClose: () => void;
  onConfirm: (groupId: string, evaluators: Array<{ id: string; name: string }>) => void;
}

export const AssignEvaluatorsModal: React.FC<AssignEvaluatorsModalProps> = ({
  isOpen,
  group,
  users,
  onClose,
  onConfirm
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvaluators, setSelectedEvaluators] = useState<Array<{ id: string; name: string }>>([]);

  // Eligible Faculty Pool:
  // 1. Same college as the group/course
  // 2. Pure Faculty role (strictly excludes administrative Deans, Chairs, Admins)
  // 3. EXCLUDES instructors assigned to this course (Conflict of interest gate)
  const eligibleFaculty = useMemo(() => {
    if (!group) return [];
    return users.filter(user => {
      // Role check: must be strictly faculty (isFacultyRole checks subroles & titles)
      if (!isFacultyRole(user)) return false;

      // College check: must strictly match course's college
      if (group.collegeId && user.collegeId !== group.collegeId) {
        return false;
      }

      // Conflict of interest: Cannot evaluate own course
      if (group.instructorIds && group.instructorIds.includes(user.id)) {
        return false;
      }

      return true;
    });
  }, [group, users]);

  const filteredFaculty = useMemo(() => {
    if (!searchQuery.trim()) return eligibleFaculty;
    const q = searchQuery.toLowerCase();
    return eligibleFaculty.filter(
      u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q)
    );
  }, [eligibleFaculty, searchQuery]);

  if (!isOpen || !group) return null;

  const handleToggle = (faculty: User) => {
    const isSelected = selectedEvaluators.some(e => e.id === faculty.id);
    if (isSelected) {
      setSelectedEvaluators(prev => prev.filter(e => e.id !== faculty.id));
    } else {
      setSelectedEvaluators(prev => [
        ...prev,
        { id: faculty.id, name: faculty.name || 'Faculty Member' }
      ]);
    }
  };

  const handleConfirm = () => {
    if (selectedEvaluators.length === 0) return;
    onConfirm(group.id, selectedEvaluators);
    onClose();
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 space-y-5 max-w-lg w-full bg-card text-foreground">
        {/* Header */}
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Academic Evaluation Board</span>
          </div>
          <h2 className="text-xl font-black text-foreground">
            Assign Course Evaluators
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select one or more collegiate faculty members to review and evaluate the syllabus for{' '}
            <span className="font-semibold text-foreground">{group.courseCode}</span>.
          </p>
        </div>

        {/* Selected Evaluator Chips */}
        {selectedEvaluators.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Selected Evaluator Committee ({selectedEvaluators.length})
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-purple-500/5 border border-purple-500/20">
              {selectedEvaluators.map(e => (
                <span
                  key={e.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300"
                >
                  <UserCheck className="w-3 h-3 text-purple-600" />
                  <span>{e.name}</span>
                  <button
                    onClick={() => setSelectedEvaluators(prev => prev.filter(item => item.id !== e.id))}
                    className="p-0.5 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search eligible department faculty..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Faculty List */}
        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 divide-y divide-border/60">
          {filteredFaculty.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <AlertCircle className="w-6 h-6 mx-auto mb-1 text-muted-foreground/60" />
              <span>No eligible collegiate faculty found.</span>
            </div>
          ) : (
            filteredFaculty.map(faculty => {
              const isSelected = selectedEvaluators.some(e => e.id === faculty.id);

              return (
                <div
                  key={faculty.id}
                  onClick={() => handleToggle(faculty)}
                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-purple-500/10' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {faculty.name?.charAt(0) || 'F'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{faculty.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {faculty.department || 'Academic Faculty'}
                      </p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="rounded border-border text-purple-600 focus:ring-0 pointer-events-none"
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedEvaluators.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            Confirm Assignment
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
};
