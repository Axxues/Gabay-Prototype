import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Download,
  X
} from 'lucide-react';
import { useLMS } from '../../../shared/context/LMSContext';
import { AnimatedModal } from '../../../shared/components/common/ModalPortal';
import { CustomDropdown } from '../../../shared/components/common/CustomDropdown';
import {
  parseChairSheet,
  validateChairSheetRows,
  matchFaculty,
  isEligibleFaculty,
  downloadAssignedCoursesTemplate,
  formatCourseTerm,
  type ValidatedChairSheetRow,
  type RawChairSheetRow
} from '../utils/chairSheetParser';
import { ChairSheetPreviewTable } from './ChairSheetPreviewTable';

export interface AssignedCoursesUploadViewProps {
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
  onNavigateTab: (tab: string) => void;
}

export type ChairSheetUploadViewProps = AssignedCoursesUploadViewProps;

export const AssignedCoursesUploadView: React.FC<AssignedCoursesUploadViewProps> = ({
  onNavigateCourse,
  onNavigateTab,
}) => {
  const {
    activeUser,
    db,
    createCourse,
    showAlert,
    colleges,
    departments,
    schoolYears,
    getSchoolYearsByCollege,
    getActiveSchoolYearForCollege,
    getBaselineSchoolYear,
  } = useLMS();

  const [rows, setRows] = useState<ValidatedChairSheetRow[]>([]);
  const [rowToDelete, setRowToDelete] = useState<ValidatedChairSheetRow | null>(null);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const eligibleFaculty = useMemo(() => {
    return (db.users || []).filter(isEligibleFaculty);
  }, [db.users]);

  // Robust collegiate scoping: resolve via activeUser.collegeId, department affiliation, or dean assignment
  const userCollegeId = useMemo(() => {
    if (activeUser?.collegeId) return activeUser.collegeId;
    if (activeUser?.department && departments) {
      const match = departments.find(
        d =>
          d.id === activeUser.department ||
          d.name?.toLowerCase() === activeUser.department.toLowerCase() ||
          d.code?.toLowerCase() === activeUser.department.toLowerCase() ||
          d.chairpersonId === activeUser.id
      );
      if (match?.collegeId) return match.collegeId;
    }
    if (colleges) {
      const deanMatch = colleges.find(
        c =>
          c.deanId === activeUser?.id ||
          (activeUser?.collegeName && c.name?.toLowerCase() === activeUser.collegeName.toLowerCase())
      );
      if (deanMatch?.id) return deanMatch.id;
    }
    return 'col-ccs';
  }, [activeUser, departments, colleges]);

  const userDepartment = useMemo(() => {
    if (departments) {
      const match = departments.find(
        d =>
          d.chairpersonId === activeUser?.id ||
          d.id === activeUser?.department ||
          d.name?.toLowerCase() === activeUser?.department?.toLowerCase() ||
          d.code?.toLowerCase() === activeUser?.department?.toLowerCase()
      );
      if (match) return match;
    }
    return undefined;
  }, [activeUser, departments]);

  const defaultSchoolYear = useMemo(() => {
    if (getActiveSchoolYearForCollege) {
      const activeSy = getActiveSchoolYearForCollege(userCollegeId);
      if (activeSy?.year) return activeSy.year;
    }
    const list = getSchoolYearsByCollege ? getSchoolYearsByCollege(userCollegeId) : [];
    const active = list.find(sy => sy.isActive);
    if (active?.year) return active.year;
    const baseline = getBaselineSchoolYear?.();
    return baseline?.year || '2025-2026';
  }, [getActiveSchoolYearForCollege, getSchoolYearsByCollege, getBaselineSchoolYear, userCollegeId]);

  const [selectedSchoolYear, setSelectedSchoolYear] = useState<string>(() => defaultSchoolYear);

  useEffect(() => {
    if (defaultSchoolYear) {
      setSelectedSchoolYear(defaultSchoolYear);
    }
  }, [defaultSchoolYear]);

  const schoolYearOptions = useMemo(() => {
    const years = new Set<string>();
    const list = getSchoolYearsByCollege ? getSchoolYearsByCollege(userCollegeId) : (schoolYears || []);
    list.forEach(sy => {
      if (sy.year) years.add(sy.year.trim());
    });
    if (defaultSchoolYear) years.add(defaultSchoolYear);
    years.add('2025-2026');
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [getSchoolYearsByCollege, userCollegeId, schoolYears, defaultSchoolYear]);

  const handleProcessFile = async (file: File) => {
    if (!file) return;
    try {
      setFileName(file.name);
      let buffer: ArrayBuffer;
      if (typeof file.arrayBuffer === 'function') {
        buffer = await file.arrayBuffer();
      } else {
        buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
      }
      const parsed = parseChairSheet(buffer);

      if (parsed.length === 0) {
        showAlert({
          title: 'Empty or Invalid File',
          message: 'No valid course rows could be detected in the uploaded spreadsheet. Please check the column headers.',
          type: 'warning',
        });
        return;
      }

      const validated = validateChairSheetRows(parsed, db.users || []);
      setRows(validated);
    } catch (err: any) {
      showAlert({
        title: 'Upload Error',
        message: err?.message || 'Failed to process Excel assigned courses sheet.',
        type: 'error',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
    // reset input so same file can be re-selected if desired
    e.target.value = '';
  };

  const handleUpdateRow = (id: string, updates: Partial<RawChairSheetRow>) => {
    setRows(prevRows =>
      prevRows.map(row => {
        if (row.id !== id) return row;
        const updatedRaw: RawChairSheetRow = {
          firstName: updates.firstName !== undefined ? updates.firstName : row.firstName,
          middleName: updates.middleName !== undefined ? updates.middleName : row.middleName,
          lastName: updates.lastName !== undefined ? updates.lastName : row.lastName,
          courseCode: updates.courseCode !== undefined ? updates.courseCode : row.courseCode,
          descriptiveTitle: updates.descriptiveTitle !== undefined ? updates.descriptiveTitle : row.descriptiveTitle,
          yearAndSection: updates.yearAndSection !== undefined ? updates.yearAndSection : row.yearAndSection,
          semester: updates.semester !== undefined ? updates.semester : row.semester,
        };
        const match = matchFaculty(updatedRaw, db.users || []);
        return {
          ...row,
          ...updatedRaw,
          facultyStatus: match.status,
          matchedUser: match.user,
          suggestedUser: match.suggestion,
          facultyErrorMessage: match.error,
        };
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    const target = rows.find(r => r.id === id);
    if (!target) return;

    // Check if the row has any non-empty fields
    const hasContent = Boolean(
      target.firstName?.trim() ||
      target.middleName?.trim() ||
      target.lastName?.trim() ||
      target.courseCode?.trim() ||
      target.descriptiveTitle?.trim() ||
      target.yearAndSection?.trim() ||
      target.semester?.trim()
    );

    if (hasContent) {
      setRowToDelete(target);
    } else {
      setRows(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleAddNewRow = () => {
    const newRaw: RawChairSheetRow = {
      firstName: '',
      middleName: '',
      lastName: '',
      courseCode: '',
      descriptiveTitle: '',
      yearAndSection: '',
      semester: 'First',
    };
    const validated = validateChairSheetRows([newRaw], db.users || [])[0];
    setRows(prev => [...prev, validated]);
  };

  // Validation Metrics
  const totalCount = rows.length;
  const validCount = rows.filter(r => r.facultyStatus === 'valid').length;
  const invalidCount = totalCount - validCount;
  const canApprove = totalCount > 0 && invalidCount === 0 && !isSubmitting;

  const handleApproveAndSave = async () => {
    if (!canApprove) return;

    setIsSubmitting(true);
    setSubmitProgress({ current: 0, total: totalCount });

    const createdIds: string[] = [];

    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        setSubmitProgress({ current: i + 1, total: totalCount });

        const created = await createCourse({
          code: row.courseCode.trim().toUpperCase(),
          title: row.descriptiveTitle.trim(),
          section: row.yearAndSection.trim(),
          instructorId: row.matchedUser?.id,
          instructorName: row.matchedUser?.name || `${row.firstName} ${row.lastName}`.trim(),
          schoolYear: selectedSchoolYear,
          term: formatCourseTerm(row.semester, selectedSchoolYear),
          semester: row.semester?.trim() || undefined,
          collegeId: userCollegeId,
          department: userDepartment?.name || row.matchedUser?.department,
          departmentId: userDepartment?.id,
          published: true,
        });

        if (created?.id) {
          createdIds.push(created.id);
        }
      }

      showAlert({
        title: 'Courses Generated Successfully',
        message: `Successfully initialized ${totalCount} course shells for AY ${selectedSchoolYear} and assigned them to their respective faculty.`,
        type: 'success',
      });

      if (createdIds[0] && onNavigateCourse) {
        onNavigateCourse(createdIds[0], 'modules');
      } else {
        onNavigateTab('courses');
      }
    } catch (err: any) {
      showAlert({
        title: 'Batch Creation Error',
        message: err?.message || 'An error occurred while creating course shells.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(null);
    }
  };

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col flex-wrap sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/70">
        <div className="flex min-w-0 items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
                Upload Department Assigned Courses
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-md">
                Chairperson Authority
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Scan program curriculum assignments, verify faculty rosters, and bulk-generate official course shells.
            </p>
          </div>
        </div>

        {/* Actions: shrink-0 keeps the cluster at full width so Approve never drops below Reupload.
            sm:ml-auto holds it at the right edge, even if the whole cluster wraps under the title. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:flex-nowrap">
          {/* Target Academic Year Selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="assigned-courses-ay-select" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Academic Year:
            </label>
            <CustomDropdown
              id="assigned-courses-ay-select"
              ariaLabel="Select Target Academic Year for Assigned Courses"
              value={selectedSchoolYear}
              onChange={setSelectedSchoolYear}
              disabled={isSubmitting}
              variant="compact"
              className="min-w-[140px]"
              options={schoolYearOptions.map(sy => ({
                value: sy,
                label: `AY ${sy}${sy === defaultSchoolYear ? ' (Active)' : ''}`,
              }))}
            />
          </div>

          {rows.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setRows([]);
                  setFileName(null);
                }}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
                Reupload
              </button>

              <button
                type="button"
                onClick={() => {
                  if (canApprove) {
                    setShowApproveConfirm(true);
                  }
                }}
                disabled={!canApprove || isSubmitting}
                className={`px-5 py-2 text-xs font-bold whitespace-nowrap rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
                  canApprove
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary-sm active:scale-[0.98]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-70'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      Creating ({submitProgress?.current}/{submitProgress?.total})...
                    </span>
                  </>
                ) : canApprove ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Create {totalCount} Course{totalCount === 1 ? '' : 's'}</span>
                  </>
                ) : (
                  <span>Resolve Unmatched Faculty</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Upload Dropzone */}
      {rows.length === 0 ? (
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-3xl transition-all ${
            isDragging
              ? 'border-primary bg-primary/5 scale-[0.99]'
              : 'border-border/80 bg-card hover:border-primary/50 hover:bg-muted/20'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>

          <h3 className="text-base font-bold text-foreground text-center">
            Upload Department Assigned Courses (.xlsx)
          </h3>
          <p className="text-xs text-muted-foreground max-w-md text-center mt-1 mb-5">
            Drag and drop your department assigned courses spreadsheet containing faculty names, course codes, titles, and sections.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            data-testid="assigned-courses-file-input"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl shadow-primary-sm transition-all flex items-center space-x-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Select Assigned Courses File</span>
            </button>

            <button
              type="button"
              onClick={() => downloadAssignedCoursesTemplate()}
              className="px-4 py-2.5 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-primary" />
              <span>Download Template</span>
            </button>
          </div>

          <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg border border-border/60">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Expected format: First Name, Middle Name, Last Name, Course Code, Descriptive Title, Year and Section, Semester</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metrics & Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-card border border-border rounded-2xl">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Total Course Offerings
              </span>
              <span className="text-xl font-extrabold text-foreground mt-0.5 block tabular-nums">
                {totalCount}
              </span>
            </div>

            <div className="p-4 bg-card border border-border rounded-2xl">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                Verified Faculty Matches
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block tabular-nums">
                {validCount}
              </span>
            </div>

            <div className="p-4 bg-card border border-border rounded-2xl">
              <span className={`text-[11px] font-semibold block ${invalidCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                Unmatched / Errors
              </span>
              <span className={`text-xl font-extrabold mt-0.5 block tabular-nums ${invalidCount > 0 ? 'text-destructive' : 'text-foreground'}`}>
                {invalidCount}
              </span>
            </div>

            <div className="p-4 bg-card border border-border rounded-2xl">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                Academic Scope
              </span>
              <span className="text-xs font-extrabold text-foreground mt-1 block">
                AY {selectedSchoolYear}
              </span>
            </div>
          </div>

          {/* Validation Warning Alert if invalidCount > 0 */}
          {invalidCount > 0 && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start space-x-3 text-destructive">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold">
                  Cannot approve: {invalidCount} unmatched faculty member{invalidCount === 1 ? '' : 's'}
                </h4>
                <p className="text-[11px] text-destructive/90 mt-0.5">
                  The system cannot verify one or more faculty names against existing LMS accounts. Please correct spelling directly in the table or select the registered faculty from the dropdown before saving.
                </p>
              </div>
            </div>
          )}

          {/* Actions Bar above table */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-foreground">
                Sheet Preview & Validation ({fileName || 'assigned-courses.xlsx'})
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddNewRow}
              className="text-xs font-semibold text-primary hover:text-primary/90 flex items-center space-x-1 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add custom row</span>
            </button>
          </div>

          {/* Editable Preview Table */}
          <ChairSheetPreviewTable
            rows={rows}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            eligibleFaculty={eligibleFaculty}
          />
        </div>
      )}

      {/* Delete Row Confirmation Modal */}
      <AnimatedModal
        isOpen={Boolean(rowToDelete)}
        onClose={() => setRowToDelete(null)}
        panelClassName="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4"
      >
        {({ startClose }) => {
          const summaryLabel = [
            rowToDelete?.courseCode?.trim(),
            rowToDelete?.descriptiveTitle?.trim() || (rowToDelete?.firstName ? `${rowToDelete.firstName} ${rowToDelete.lastName}`.trim() : '')
          ].filter(Boolean).join(' - ') || 'this course entry';

          return (
            <>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground leading-tight font-sans">
                      Delete Course Row
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startClose}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-1 font-sans">
                Are you sure you want to delete <span className="font-semibold text-foreground">{summaryLabel}</span>? This will remove it from the preview table.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={startClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (rowToDelete) {
                      setRows(prev => prev.filter(r => r.id !== rowToDelete.id));
                      setRowToDelete(null);
                    }
                  }}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm transition-all cursor-pointer active:scale-[0.98] font-sans"
                >
                  Delete
                </button>
              </div>
            </>
          );
        }}
      </AnimatedModal>

      {/* Approve Courses Confirmation Modal */}
      <AnimatedModal
        isOpen={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        panelClassName="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 space-y-4"
      >
        {({ startClose }) => (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground leading-tight font-sans">
                    Approve Course Offerings
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={startClose}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-1 font-sans">
              Are you sure you want to approve and initialize <span className="font-semibold text-foreground">{totalCount} course shell{totalCount === 1 ? '' : 's'}</span> for Academic Year <span className="font-semibold text-foreground">{selectedSchoolYear}</span>? Each course will be officially generated and assigned to its verified faculty.
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={startClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer font-sans"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApproveConfirm(false);
                  void handleApproveAndSave();
                }}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary-sm transition-all cursor-pointer active:scale-[0.98] font-sans"
              >
                Confirm & Create
              </button>
            </div>
          </>
        )}
      </AnimatedModal>
    </div>
  );
};

export const ChairSheetUploadView = AssignedCoursesUploadView;
