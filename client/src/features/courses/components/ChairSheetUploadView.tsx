import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { useLMS } from '../../../shared/context/LMSContext';
import {
  parseChairSheet,
  validateChairSheetRows,
  matchFaculty,
  isEligibleFaculty,
  type ValidatedChairSheetRow,
  type RawChairSheetRow
} from '../utils/chairSheetParser';
import { ChairSheetPreviewTable } from './ChairSheetPreviewTable';

interface ChairSheetUploadViewProps {
  onNavigateCourse?: (courseId: string, subTab?: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const ChairSheetUploadView: React.FC<ChairSheetUploadViewProps> = ({
  onNavigateCourse,
  onNavigateTab,
}) => {
  const {
    activeUser,
    db,
    createCourse,
    showAlert,
    getActiveSchoolYearForCollege
  } = useLMS();

  const [rows, setRows] = useState<ValidatedChairSheetRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const eligibleFaculty = useMemo(() => {
    return (db.users || []).filter(isEligibleFaculty);
  }, [db.users]);

  const activeSchoolYear = useMemo(() => {
    const collegiateSY = activeUser?.collegeId
      ? getActiveSchoolYearForCollege?.(activeUser.collegeId)
      : undefined;
    return collegiateSY?.year || '2025-2026';
  }, [activeUser, getActiveSchoolYearForCollege]);

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
        message: err?.message || 'Failed to process Excel chair-sheet.',
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
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleAddNewRow = () => {
    const newRaw: RawChairSheetRow = {
      firstName: '',
      middleName: '',
      lastName: '',
      courseCode: '',
      descriptiveTitle: '',
      yearAndSection: '',
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
          schoolYear: activeSchoolYear,
          term: `1st Sem AY ${activeSchoolYear}`,
          published: true,
        });

        if (created?.id) {
          createdIds.push(created.id);
        }
      }

      showAlert({
        title: 'Courses Generated Successfully',
        message: `Successfully initialized ${totalCount} course shells for AY ${activeSchoolYear} and assigned them to their respective faculty.`,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/70">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
                Upload Department Chair-Sheet
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

        {rows.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setRows([]);
                setFileName(null);
              }}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />
              Reset & Re-upload
            </button>

            <button
              type="button"
              onClick={handleApproveAndSave}
              disabled={!canApprove}
              className={`px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
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
          </div>
        )}
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
            Upload Department Chair-Sheet (.xlsx)
          </h3>
          <p className="text-xs text-muted-foreground max-w-md text-center mt-1 mb-5">
            Drag and drop your department chair-sheet spreadsheet containing faculty names, course codes, titles, and sections.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            data-testid="chair-sheet-file-input"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl shadow-primary-sm transition-all flex items-center space-x-2 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Select Chair-Sheet File</span>
          </button>

          <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg border border-border/60">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Expected format: First Name, Middle Name, Last Name, Course Code, Descriptive Title, Year and Section</span>
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
                AY {activeSchoolYear}
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
                Sheet Preview & Validation ({fileName || 'chair-sheet.xlsx'})
              </span>
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                Editable Table
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
    </div>
  );
};
