import React, { useState, useMemo } from 'react';
import { useLMS } from '../../../shared/context/LMSContext';
import type { LeadershipTenure } from '../../../shared/types/lms';
import { UserAvatar } from '../../../shared/components/common/UserAvatar';
import { CustomDropdown } from '../../../shared/components/common/CustomDropdown';
import { DialogFrame } from '../../../shared/components/common/DialogFrame';
import { LeadershipTransferModal } from './LeadershipTransferModal';
import {
  Clock,
  Award,
  BookOpen,
  Users,
  Calendar,
  Search,
  FileText,
  CheckCircle2,
  ArrowRightLeft,
  GraduationCap,
  ChevronRight,
} from 'lucide-react';

export const LeadershipTimelineTab: React.FC = () => {
  const {
    leadershipTenures = [],
    colleges = [],
    departments = [],
    activeRole,
    activeUser,
    db,
    getTenureMetrics,
    getTenureAuditTrail,
  } = useLMS();

  const canManageLeadership = activeRole === 'superadmin' || activeRole === 'admin' || activeUser?.adminSubrole === 'chancellor';
  const [transferringTenure, setTransferringTenure] = useState<LeadershipTenure | null>(null);

  const [scopeFilter, setScopeFilter] = useState<'all' | 'system' | 'college' | 'department'>('all');
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected tenure for detailed audit drill-down modal
  const [inspectedTenure, setInspectedTenure] = useState<LeadershipTenure | null>(null);
  const [auditFilterType, setAuditFilterType] = useState<string>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Filter tenures
  const filteredTenures = useMemo(() => {
    return leadershipTenures.filter(tenure => {
      // 1. Scope filter
      if (scopeFilter !== 'all') {
        if (scopeFilter === 'system' && tenure.unitType !== 'system') return false;
        if (scopeFilter === 'college' && tenure.unitType !== 'college') return false;
        if (scopeFilter === 'department' && tenure.unitType !== 'department') return false;
      }

      // 2. Unit filters
      if (scopeFilter === 'college' && selectedCollegeId !== 'all') {
        if (tenure.unitId !== selectedCollegeId) return false;
      }
      if (scopeFilter === 'department') {
        if (selectedCollegeId !== 'all') {
          const dept = departments.find(d => d.id === tenure.unitId);
          if (dept && dept.collegeId !== selectedCollegeId) return false;
        }
        if (selectedDeptId !== 'all' && tenure.unitId !== selectedDeptId) {
          return false;
        }
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = tenure.leaderName.toLowerCase().includes(q);
        const matchesUnit = tenure.unitName.toLowerCase().includes(q);
        const matchesRole = tenure.role.toLowerCase().includes(q);
        const matchesNotes = (tenure.transitionNotes || '').toLowerCase().includes(q);
        if (!matchesName && !matchesUnit && !matchesRole && !matchesNotes) return false;
      }

      return true;
    });
  }, [leadershipTenures, scopeFilter, selectedCollegeId, selectedDeptId, searchQuery, departments]);

  // Formatter for tenure date ranges
  const formatTenureDateRange = (startDateStr: string, endDateStr?: string | null) => {
    const start = new Date(startDateStr);
    const startFormatted = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    if (!endDateStr) {
      return `${startFormatted} – Present`;
    }

    const end = new Date(endDateStr);
    const endFormatted = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const diffMonths = Math.max(
      1,
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    );
    const years = Math.floor(diffMonths / 12);
    const months = diffMonths % 12;

    let durationLabel = '';
    if (years > 0 && months > 0) {
      durationLabel = ` (${years} yr${years > 1 ? 's' : ''}, ${months} mo${months > 1 ? 's' : ''})`;
    } else if (years > 0) {
      durationLabel = ` (${years} yr${years > 1 ? 's' : ''})`;
    } else {
      durationLabel = ` (${months} mo${months > 1 ? 's' : ''})`;
    }

    return `${startFormatted} – ${endFormatted}${durationLabel}`;
  };

  // Inspected tenure audit trail
  const inspectedAuditTrail = useMemo(() => {
    if (!inspectedTenure) return [];
    const trail = getTenureAuditTrail(inspectedTenure);
    return trail.filter(event => {
      if (auditFilterType !== 'all' && event.eventType !== auditFilterType) return false;
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase();
        return (
          event.title.toLowerCase().includes(q) ||
          event.description.toLowerCase().includes(q) ||
          (event.actorName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [inspectedTenure, getTenureAuditTrail, auditFilterType, auditSearchQuery]);

  const inspectedMetrics = useMemo(() => {
    if (!inspectedTenure) return null;
    return getTenureMetrics(inspectedTenure);
  }, [inspectedTenure, getTenureMetrics]);

  return (
    <div className="space-y-6">
      {/* Overview Banner & Filter Toolbar */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-primary/10 text-primary rounded-lg">
                <Clock className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-foreground">
                Institutional Leadership & Governance Timeline
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Historical ledger of administrative tenures across University Leadership, Deans, and Program Chairs with continuous process auditing.
            </p>
          </div>

          {/* Quick Scope Switcher */}
          <div className="flex items-center space-x-1.5 p-1 bg-muted/60 border border-border rounded-xl self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                setScopeFilter('all');
                setSelectedCollegeId('all');
                setSelectedDeptId('all');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'all'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Levels
            </button>
            <button
              type="button"
              onClick={() => {
                setScopeFilter('system');
                setSelectedCollegeId('all');
                setSelectedDeptId('all');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'system'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Institutional
            </button>
            <button
              type="button"
              onClick={() => {
                setScopeFilter('college');
                setSelectedDeptId('all');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'college'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Colleges (Deans)
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('department')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                scopeFilter === 'department'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Programs (Chairs)
            </button>
          </div>
        </div>

        {/* Secondary Unit Filters & Search */}
        <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(scopeFilter === 'college' || scopeFilter === 'department') && (
              <div className="w-48 sm:w-56">
                <CustomDropdown
                  ariaLabel="Select College Filter"
                  value={selectedCollegeId}
                  onChange={setSelectedCollegeId}
                  options={[
                    { value: 'all', label: 'All Colleges' },
                    ...colleges.map(col => ({ value: col.id, label: col.name })),
                  ]}
                />
              </div>
            )}

            {scopeFilter === 'department' && (
              <div className="w-48 sm:w-56">
                <CustomDropdown
                  ariaLabel="Select Department Filter"
                  value={selectedDeptId}
                  onChange={setSelectedDeptId}
                  options={[
                    { value: 'all', label: 'All Programs / Departments' },
                    ...(selectedCollegeId === 'all'
                      ? departments
                      : departments.filter(d => d.collegeId === selectedCollegeId)
                    ).map(dept => ({ value: dept.id, label: dept.name })),
                  ]}
                />
              </div>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by leader name or unit..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredTenures.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-3">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
          <h3 className="font-bold text-foreground text-sm">No Leadership Tenures Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No administration records match your selected scope and query. Try adjusting your filter parameters.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-[11px] sm:before:left-[15px] before:top-4 before:bottom-4 before:w-0.5 before:bg-border">
          {filteredTenures.map((tenure) => {
            const metrics = getTenureMetrics(tenure);
            const isActive = tenure.status === 'active';

            return (
              <div
                key={tenure.id}
                className={`relative bg-card border rounded-2xl p-4 sm:p-5 transition-all hover:border-primary/40 shadow-none ${
                  isActive ? 'border-primary/40 ring-1 ring-primary/20 bg-primary/[0.02]' : 'border-border'
                }`}
              >
                {/* Timeline node dot */}
                <div
                  className={`absolute -left-[30px] sm:-left-[39px] top-6 w-5 h-5 rounded-full border-4 border-background flex items-center justify-center ${
                    isActive ? 'bg-primary' : 'bg-muted-foreground'
                  }`}
                />

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Leader Header */}
                  <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                    <UserAvatar
                      name={tenure.leaderName}
                      src={tenure.leaderAvatar}
                      className="w-11 h-11 rounded-full border border-border shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-foreground text-sm sm:text-base">
                          {tenure.leaderName}
                        </span>
                        {isActive ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active Incumbent</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground border border-border">
                            Completed Term
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-primary/10 text-primary rounded-md uppercase">
                          {tenure.role === 'admin' ? 'University Admin' : tenure.role === 'dean' ? 'College Dean' : 'Program Chair'}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-semibold text-foreground/80">{tenure.unitName}</span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{formatTenureDateRange(tenure.startDate, tenure.endDate)}</span>
                        </span>
                        {tenure.appointedBy && (
                          <>
                            <span>•</span>
                            <span>Appointed by: <strong className="text-foreground">{tenure.appointedBy}</strong></span>
                          </>
                        )}
                      </div>

                      {tenure.transitionNotes && (
                        <div className="mt-2 text-xs text-muted-foreground/90 italic bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40 max-w-xl">
                          "{tenure.transitionNotes}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions: View Term Audit & Handover */}
                  <div className="self-end md:self-center shrink-0 flex items-center space-x-2">
                    {isActive && canManageLeadership && (
                      <button
                        type="button"
                        onClick={() => setTransferringTenure(tenure)}
                        className="px-3 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs rounded-xl border border-primary/20 transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                        title="Handover Leadership Authority"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>Handover Seat</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setInspectedTenure(tenure)}
                      className="px-3.5 py-2 bg-muted/80 hover:bg-primary hover:text-primary-foreground text-foreground font-bold text-xs rounded-xl border border-border/80 hover:border-primary transition-all cursor-pointer flex items-center space-x-1.5 shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Inspect Administration Audit</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Tenure Impact Metrics Bar */}
                <div className="mt-4 pt-3.5 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-muted/40 p-2.5 rounded-xl border border-border/60">
                    <div className="flex items-center space-x-1.5 text-muted-foreground text-[10px] uppercase font-bold">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      <span>Curriculum Offerings</span>
                    </div>
                    <div className="text-base font-extrabold text-foreground mt-0.5">
                      {metrics.coursesCreated}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Courses established / active</div>
                  </div>

                  <div className="bg-muted/40 p-2.5 rounded-xl border border-border/60">
                    <div className="flex items-center space-x-1.5 text-muted-foreground text-[10px] uppercase font-bold">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Student Enrollments</span>
                    </div>
                    <div className="text-base font-extrabold text-foreground mt-0.5">
                      {metrics.studentsEnrolled}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Students matriculated</div>
                  </div>

                  <div className="bg-muted/40 p-2.5 rounded-xl border border-border/60">
                    <div className="flex items-center space-x-1.5 text-muted-foreground text-[10px] uppercase font-bold">
                      <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Official Syllabi</span>
                    </div>
                    <div className="text-base font-extrabold text-foreground mt-0.5">
                      {metrics.syllabiCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground">CHED standard approved</div>
                  </div>

                  <div className="bg-muted/40 p-2.5 rounded-xl border border-border/60">
                    <div className="flex items-center space-x-1.5 text-muted-foreground text-[10px] uppercase font-bold">
                      <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Academic Faculty</span>
                    </div>
                    <div className="text-base font-extrabold text-foreground mt-0.5">
                      {metrics.facultyAssigned}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Active instructors in unit</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Administration Audit Modal */}
      {inspectedTenure && (
        <DialogFrame
          title={`Administration Audit: ${inspectedTenure.leaderName}`}
          subtitle={`${inspectedTenure.role === 'admin' ? 'University Administration' : inspectedTenure.role === 'dean' ? 'Dean' : 'Chairperson'} • ${inspectedTenure.unitName} (${formatTenureDateRange(inspectedTenure.startDate, inspectedTenure.endDate)})`}
          onClose={() => {
            setInspectedTenure(null);
            setAuditFilterType('all');
            setAuditSearchQuery('');
          }}
          wide={true}
          footer={
            <button
              type="button"
              onClick={() => {
                setInspectedTenure(null);
                setAuditFilterType('all');
                setAuditSearchQuery('');
              }}
              className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Done Reviewing
            </button>
          }
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Impact Metric Cards in Modal */}
            {inspectedMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-muted/40 border border-border rounded-xl">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Courses Created</div>
                  <div className="text-lg font-bold text-foreground">{inspectedMetrics.coursesCreated}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Students Enrolled</div>
                  <div className="text-lg font-bold text-foreground">{inspectedMetrics.studentsEnrolled}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Syllabi Standardized</div>
                  <div className="text-lg font-bold text-foreground">{inspectedMetrics.syllabiCount}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Faculty Staffed</div>
                  <div className="text-lg font-bold text-foreground">{inspectedMetrics.facultyAssigned}</div>
                </div>
              </div>
            )}

            {/* Audit Trail Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setAuditFilterType('all')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                    auditFilterType === 'all'
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All Events
                </button>
                <button
                  type="button"
                  onClick={() => setAuditFilterType('leadership_transfer')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                    auditFilterType === 'leadership_transfer'
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Governance
                </button>
                <button
                  type="button"
                  onClick={() => setAuditFilterType('course_created')}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-colors cursor-pointer ${
                    auditFilterType === 'course_created'
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Curriculum
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={e => setAuditSearchQuery(e.target.value)}
                  placeholder="Filter audit events..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground w-full sm:w-56"
                />
              </div>
            </div>

            {/* Chronological Event Audit Table */}
            <div className="border border-border rounded-xl overflow-hidden">
              {inspectedAuditTrail.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No audit events recorded under this criteria.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {inspectedAuditTrail.map((event) => (
                    <div key={event.id} className="p-3.5 hover:bg-muted/30 transition-colors flex items-start space-x-3 text-xs">
                      <div className="p-2 rounded-xl bg-muted/60 text-primary border border-border shrink-0 mt-0.5">
                        {event.eventType === 'leadership_transfer' || event.eventType === 'leadership_appointment' ? (
                          <ArrowRightLeft className="w-4 h-4" />
                        ) : event.eventType === 'course_created' ? (
                          <BookOpen className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-foreground text-xs">{event.title}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(event.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          {event.description}
                        </p>
                        {event.actorName && (
                          <div className="text-[10px] text-muted-foreground">
                            Recorded by: <strong className="text-foreground">{event.actorName}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogFrame>
      )}

      {transferringTenure && (
        <LeadershipTransferModal
          isOpen={Boolean(transferringTenure)}
          onClose={() => setTransferringTenure(null)}
          leader={db.users.find(u => u.id === transferringTenure.leaderId)}
          forcedRoleType={transferringTenure.role}
          forcedUnitId={transferringTenure.unitId}
          forcedUnitName={transferringTenure.unitName}
        />
      )}
    </div>
  );
};
