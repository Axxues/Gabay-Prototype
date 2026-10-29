import React, { useState, useMemo } from 'react';
import type { SyllabusGroup, SyllabusLifecycleStatus } from '../../types/lifecycle';
import {
  Lock,
  Unlock,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  Search,
  Eye,
  FileCheck2,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { CustomDropdown } from '../../../../shared/components/common/CustomDropdown';

interface DepartmentSyllabusTableProps {
  groups: SyllabusGroup[];
  userRole?: string;
  onReleaseCourses: (groupIds: string[]) => void;
  onAssignEvaluators: (group: SyllabusGroup) => void;
  onChairApprove: (group: SyllabusGroup) => void;
  onDeanApprove: (group: SyllabusGroup) => void;
  onOpenPreview: (group: SyllabusGroup) => void;
}

export const STATUS_CONFIG: Record<
  SyllabusLifecycleStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  locked: {
    label: 'Locked',
    bg: 'bg-muted/70',
    text: 'text-muted-foreground',
    border: 'border-border',
    icon: <Lock className="w-3.5 h-3.5 text-muted-foreground" />
  },
  in_development: {
    label: 'In Development',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
    icon: <Unlock className="w-3.5 h-3.5 text-blue-500" />
  },
  submission_in_progress: {
    label: 'Awaiting Co-Instructors',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    icon: <Clock className="w-3.5 h-3.5 text-amber-500" />
  },
  ready_for_evaluation: {
    label: 'Ready for Evaluation',
    bg: 'bg-purple-500/10',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/20',
    icon: <Users className="w-3.5 h-3.5 text-purple-500" />
  },
  under_evaluation: {
    label: 'Under Evaluation',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/20',
    icon: <Eye className="w-3.5 h-3.5 text-indigo-500" />
  },
  revisions_required: {
    label: 'Revisions Required',
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
  },
  evaluator_approved: {
    label: 'Evaluator Approved',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    icon: <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
  },
  chair_approved: {
    label: 'Chair Endorsed',
    bg: 'bg-teal-500/10',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-500/20',
    icon: <FileCheck2 className="w-3.5 h-3.5 text-teal-500" />
  },
  approved: {
    label: 'Dean Approved (Ready)',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300 font-bold',
    border: 'border-emerald-500/30',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
  }
};

export const DepartmentSyllabusTable: React.FC<DepartmentSyllabusTableProps> = ({
  groups,
  userRole = 'chairperson',
  onReleaseCourses,
  onAssignEvaluators,
  onChairApprove,
  onDeanApprove,
  onOpenPreview
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const matchSearch =
        !searchQuery ||
        g.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.instructorNames.some(n => n.toLowerCase().includes(searchQuery.toLowerCase())) ||
        g.sections.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === 'all' || g.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [groups, searchQuery, statusFilter]);

  const allFilteredSelected =
    filteredGroups.length > 0 && filteredGroups.every(g => selectedIds.includes(g.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredGroups.map(g => g.id));
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Status Summary Stats
  const stats = useMemo(() => {
    return {
      total: groups.length,
      locked: groups.filter(g => g.status === 'locked').length,
      inDevelopment: groups.filter(g => g.status === 'in_development' || g.status === 'submission_in_progress' || g.status === 'revisions_required').length,
      evaluation: groups.filter(g => g.status === 'ready_for_evaluation' || g.status === 'under_evaluation').length,
      approved: groups.filter(g => g.status === 'approved').length
    };
  }, [groups]);

  const isDean = userRole?.toLowerCase().includes('dean');

  return (
    <div className="space-y-4">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-border bg-card/60">
          <p className="text-xs text-muted-foreground font-medium">Total Courses</p>
          <p className="text-2xl font-black text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card/60">
          <p className="text-xs text-muted-foreground font-medium">Locked (Pending Release)</p>
          <p className="text-2xl font-black text-muted-foreground mt-1">{stats.locked}</p>
        </div>
        <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">In Development</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.inDevelopment}</p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Approved & Ready</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.approved}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search code, title, section, faculty..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-48">
            <CustomDropdown
              value={statusFilter}
              onChange={val => setStatusFilter(val)}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'locked', label: 'Locked' },
                { value: 'in_development', label: 'In Development' },
                { value: 'ready_for_evaluation', label: 'Ready for Evaluation' },
                { value: 'under_evaluation', label: 'Under Evaluation' },
                { value: 'revisions_required', label: 'Revisions Required' },
                { value: 'evaluator_approved', label: 'Evaluator Approved' },
                { value: 'chair_approved', label: 'Chair Endorsed' },
                { value: 'approved', label: 'Approved' }
              ]}
              placeholder="Filter by Status"
              ariaLabel="Filter syllabus table by status"
              testId="syllabus-table-status-filter"
            />
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 px-4 bg-primary text-primary-foreground rounded-xl shadow-lg animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center text-[10px]">
              {selectedIds.length}
            </span>
            <span>courses selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onReleaseCourses(selectedIds)}
              className="px-3 py-1.5 bg-primary-foreground text-primary rounded-lg text-xs font-bold hover:bg-primary-foreground/90 transition-all flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Release Selected for Development</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-xs text-primary-foreground/80 hover:text-primary-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table Roster */}
      <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAll}
                    aria-label="Select all courses"
                    className="rounded border-border text-primary focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-3">Course Code & Title</th>
                <th className="p-3">Assigned Faculty</th>
                <th className="p-3">Sections</th>
                <th className="p-3">Status</th>
                <th className="p-3">Evaluators</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <ShieldAlert className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="font-medium text-foreground">No syllabus records found</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Upload course assignments via the Chairperson Chair-Sheet to generate course shells.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredGroups.map(group => {
                  const cfg = STATUS_CONFIG[group.status] || STATUS_CONFIG.locked;
                  const isChecked = selectedIds.includes(group.id);

                  return (
                    <tr
                      key={group.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isChecked ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(group.id)}
                          aria-label={`Select ${group.courseCode}`}
                          className="rounded border-border text-primary focus:ring-0 cursor-pointer"
                        />
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <span>{group.courseCode}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            {group.semester} Term
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] line-clamp-1 mt-0.5">
                          {group.courseTitle}
                        </p>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          {group.instructorNames.map((name, i) => (
                            <span key={i} className="text-foreground font-medium">
                              {name}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {group.sections.map((sec, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-muted/80 text-foreground font-semibold text-[10px]"
                            >
                              {sec}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          {cfg.icon}
                          <span>{cfg.label}</span>
                        </span>
                      </td>

                      <td className="p-3">
                        {group.evaluators.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {group.evaluators.map((e, idx) => (
                              <div key={idx} className="flex items-center gap-1 text-[11px]">
                                <span className="font-medium text-foreground">{e.evaluatorName}</span>
                                <span
                                  className={`text-[9px] px-1 py-0.2 rounded ${
                                    e.status === 'approved'
                                      ? 'bg-emerald-500/10 text-emerald-600'
                                      : e.status === 'revisions_requested'
                                      ? 'bg-destructive/10 text-destructive'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {e.status === 'approved' ? 'Approved' : e.status === 'revisions_requested' ? 'Revisions' : 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">None assigned</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {group.status === 'locked' && (
                            <button
                              onClick={() => onReleaseCourses([group.id])}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold flex items-center gap-1"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Release</span>
                            </button>
                          )}

                          {group.status === 'ready_for_evaluation' && (
                            <button
                              onClick={() => onAssignEvaluators(group)}
                              aria-label={`Assign evaluators for ${group.courseCode}`}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold flex items-center gap-1"
                            >
                              <Users className="w-3 h-3" />
                              <span>Assign Evaluators</span>
                            </button>
                          )}

                          {group.status === 'evaluator_approved' && (
                            <button
                              onClick={() => onChairApprove(group)}
                              className="px-2.5 py-1 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Chair Endorse</span>
                            </button>
                          )}

                          {group.status === 'chair_approved' && isDean && (
                            <button
                              onClick={() => onDeanApprove(group)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Dean Approve</span>
                            </button>
                          )}

                          <button
                            onClick={() => onOpenPreview(group)}
                            aria-label={`Preview ${group.courseCode}`}
                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Preview Document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
