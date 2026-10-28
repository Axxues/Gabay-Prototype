import React from 'react';
import type { OfficialSyllabusData, CourseMapEntry } from '../../../../../shared/data/syllabusData';
import { Compass, HelpCircle } from 'lucide-react';

interface Step5CourseMapProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const cycleAlignment = (current: string = ''): 'I' | 'P' | 'D' | '' => {
  if (!current) return 'I';
  if (current === 'I') return 'P';
  if (current === 'P') return 'D';
  return '';
};

export const Step5CourseMap: React.FC<Step5CourseMapProps> = ({ data, onChange }) => {
  const { courseOutcomes = [], programOutcomes = [], courseMap = [] } = data;

  const poList = programOutcomes.length > 0
    ? programOutcomes
    : Array.from({ length: 11 }, (_, i) => ({ number: i + 1, description: '' }));

  // Ensure courseMap entries match current course outcomes
  const synchronizedMap: CourseMapEntry[] = courseOutcomes.map(co => {
    const existing = courseMap.find(cm => cm.coNumber === co.number);
    return {
      coNumber: co.number,
      coStatement: co.statement,
      poAlignments: existing?.poAlignments || {}
    };
  });

  const handleCellClick = (coNumber: number, poNum: number) => {
    const updatedMap = synchronizedMap.map(entry => {
      if (entry.coNumber === coNumber) {
        const currentVal = entry.poAlignments[poNum] || '';
        const nextVal = cycleAlignment(currentVal);
        return {
          ...entry,
          poAlignments: {
            ...entry.poAlignments,
            [poNum]: nextVal
          }
        };
      }
      return entry;
    });

    onChange({
      ...data,
      courseMap: updatedMap
    });
  };

  const getCellBadgeStyle = (val: string = '') => {
    switch (val) {
      case 'I':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'P':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'D':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-muted/30 text-muted-foreground/30 border-dashed border-border hover:bg-muted/70';
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4">
        <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
          <Compass className="w-5 h-5 text-primary" />
          <span>Part IV: Curriculum Course Map Matrix</span>
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Map each Course Outcome (CO) against the 11 institutional Program Outcomes (PO). Click any cell to cycle through the alignments.
        </p>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-3 p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
          <span className="font-semibold text-foreground flex items-center space-x-1">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Legend:</span>
          </span>
          <span className="inline-flex items-center space-x-1">
            <span className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs bg-blue-500/10 text-blue-600 border border-blue-500/30">
              I
            </span>
            <span className="text-muted-foreground">Introduced</span>
          </span>
          <span className="inline-flex items-center space-x-1">
            <span className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs bg-amber-500/10 text-amber-600 border border-amber-500/30">
              P
            </span>
            <span className="text-muted-foreground">Practiced</span>
          </span>
          <span className="inline-flex items-center space-x-1">
            <span className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
              D
            </span>
            <span className="text-muted-foreground">Demonstrated</span>
          </span>
          <span className="text-[11px] text-muted-foreground/80 italic ml-auto">
            Click cell to cycle: (blank) → I → P → D → (blank)
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border shadow-sm bg-card">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-muted/60 border-b border-border font-bold">
              <th className="p-3 w-1/3 min-w-[260px] border-r border-border">
                Course Outcomes (CO)
              </th>
              {poList.map(po => (
                <th
                  key={po.number}
                  className="p-2 text-center border-r border-border min-w-[48px] w-12 text-foreground"
                  title={po.description}
                >
                  PO{po.number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {synchronizedMap.map(entry => (
              <tr key={entry.coNumber} className="border-b border-border hover:bg-muted/20 transition-colors">
                <td className="p-3 border-r border-border align-middle">
                  <div className="font-semibold text-foreground">
                    CO{entry.coNumber}:
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {entry.coStatement}
                  </div>
                </td>
                {poList.map(po => {
                  const val = entry.poAlignments[po.number] || '';
                  return (
                    <td key={po.number} className="p-1 text-center border-r border-border align-middle">
                      <button
                        type="button"
                        data-testid={`cell-co-${entry.coNumber}-po-${po.number}`}
                        onClick={() => handleCellClick(entry.coNumber, po.number)}
                        className={`w-8 h-8 rounded-lg border font-bold text-xs transition-all cursor-pointer active:scale-95 flex items-center justify-center mx-auto ${getCellBadgeStyle(val)}`}
                        title={`Click to cycle alignment for CO${entry.coNumber} x PO${po.number}`}
                      >
                        {val || '-'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
