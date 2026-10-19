import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import type { User } from '../../../shared/types/lms';
import type { ValidatedChairSheetRow, RawChairSheetRow } from '../utils/chairSheetParser';
import { CustomDropdown } from '../../../shared/components/common/CustomDropdown';

const SEMESTER_OPTIONS = [
  { value: 'First', label: 'First' },
  { value: 'Mid-Year', label: 'Mid-Year' },
  { value: 'Second', label: 'Second' },
];

interface ChairSheetPreviewTableProps {
  rows: ValidatedChairSheetRow[];
  onUpdateRow: (id: string, updates: Partial<RawChairSheetRow>) => void;
  onDeleteRow: (id: string) => void;
  eligibleFaculty: User[];
}

export const ChairSheetPreviewTable: React.FC<ChairSheetPreviewTableProps> = ({
  rows,
  onUpdateRow,
  onDeleteRow,
  eligibleFaculty,
}) => {
  if (rows.length === 0) return null;

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-muted-foreground font-semibold">
            <th className="py-3 px-3 w-10 text-center">#</th>
            <th className="py-3 px-3 min-w-[130px]">First Name</th>
            <th className="py-3 px-3 min-w-[110px]">Middle Name</th>
            <th className="py-3 px-3 min-w-[130px]">Last Name</th>
            <th className="py-3 px-3 min-w-[110px]">Course Code</th>
            <th className="py-3 px-3 min-w-[200px]">Descriptive Title</th>
            <th className="py-3 px-3 min-w-[100px]">Year & Sec</th>
            <th className="py-3 px-3 min-w-[110px]">Semester</th>
            <th className="py-3 px-3 min-w-[220px]">Faculty Verification</th>
            <th className="py-3 px-3 w-12 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, idx) => {
            const isValid = row.facultyStatus === 'valid';

            return (
              <tr
                key={row.id}
                className={`transition-colors hover:bg-muted/30 ${
                  !isValid ? 'bg-destructive/5' : ''
                }`}
              >
                <td className="py-2.5 px-3 text-center text-muted-foreground font-medium">
                  {idx + 1}
                </td>

                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={row.firstName}
                    onChange={e => onUpdateRow(row.id, { firstName: e.target.value })}
                    placeholder="First Name"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none text-foreground text-xs"
                  />
                </td>

                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={row.middleName}
                    onChange={e => onUpdateRow(row.id, { middleName: e.target.value })}
                    placeholder="Middle Name"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none text-foreground text-xs"
                  />
                </td>

                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={row.lastName}
                    onChange={e => onUpdateRow(row.id, { lastName: e.target.value })}
                    placeholder="Last Name"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none text-foreground text-xs"
                  />
                </td>

                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={row.courseCode}
                    onChange={e => onUpdateRow(row.id, { courseCode: e.target.value })}
                    placeholder="CSCC 103"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none text-foreground text-xs font-semibold uppercase"
                  />
                </td>

                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={row.descriptiveTitle}
                    onChange={e => onUpdateRow(row.id, { descriptiveTitle: e.target.value })}
                    placeholder="Course Title"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none text-foreground text-xs"
                  />
                </td>

                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={row.yearAndSection}
                    onChange={e => onUpdateRow(row.id, { yearAndSection: e.target.value })}
                    placeholder="4-E"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none text-foreground text-xs font-medium"
                  />
                </td>

                <td className="py-2 px-2 min-w-[125px]">
                  <CustomDropdown
                    variant="compact"
                    ariaLabel={`Semester for row ${idx + 1}`}
                    value={row.semester || 'First'}
                    onChange={value => onUpdateRow(row.id, { semester: value })}
                    options={SEMESTER_OPTIONS}
                  />
                </td>

                <td className="py-2 px-3">
                  <div className="space-y-1.5">
                    {isValid ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[170px]">
                          Matched: {row.matchedUser?.name || `${row.firstName} ${row.lastName}`}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive font-semibold text-[11px] border border-destructive/20">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Not Found / Spelled Wrongly</span>
                        </div>
                      </div>
                    )}

                    {/* Quick Faculty Picker Dropdown */}
                    <CustomDropdown
                      variant="compact"
                      ariaLabel="Assign registered faculty"
                      value={row.matchedUser?.id || ''}
                      placeholder={isValid ? 'Change assigned faculty...' : 'Choose registered faculty...'}
                      className="mt-1"
                      onChange={value => {
                        const chosenUser = eligibleFaculty.find(u => u.id === value);
                        if (chosenUser) {
                          onUpdateRow(row.id, {
                            firstName: chosenUser.firstName || chosenUser.name.split(' ')[0] || '',
                            middleName: chosenUser.middleName || '',
                            lastName: chosenUser.lastName || chosenUser.name.split(' ').slice(1).join(' ') || '',
                          });
                        }
                      }}
                      options={[
                        { value: '', label: isValid ? 'Change assigned faculty...' : 'Choose registered faculty...' },
                        ...eligibleFaculty.map(f => ({
                          value: f.id,
                          label: `${f.name} (${f.title || f.role})`,
                        })),
                      ]}
                    />
                  </div>
                </td>

                <td className="py-2 px-2 text-center">
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row.id)}
                    aria-label={`Delete course row ${idx + 1}`}
                    title="Remove row"
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export type AssignedCoursesPreviewTableProps = ChairSheetPreviewTableProps;
export const AssignedCoursesPreviewTable: React.FC<AssignedCoursesPreviewTableProps> = ChairSheetPreviewTable;
