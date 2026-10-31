import React, { useEffect } from 'react';
import type { OfficialSyllabusData, LearningPlanWeek } from '../../../../../shared/data/syllabusData';
import { CustomDropdown, RichTextEditor } from '../../../../../shared/components/common';
import { Plus, Trash2, Globe, Clock, X } from 'lucide-react';
import { RequiredMark } from '../RequiredMark';
import { analyzeSectionSchedules } from '../../../utils/scheduleHours';

interface Step4LearningPlanProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

const SDG_PRESETS: Array<{ goal: string; title: string; description: string }> = [
  { goal: 'SDG 1', title: 'No Poverty', description: 'Promoting economic inclusion and equal access to opportunities.' },
  { goal: 'SDG 4', title: 'Quality Education', description: 'Ensuring inclusive, equitable quality education and lifelong learning opportunities.' },
  { goal: 'SDG 8', title: 'Decent Work and Economic Growth', description: 'Promoting sustained, inclusive economic growth and productive employment.' },
  { goal: 'SDG 9', title: 'Industry, Innovation and Infrastructure', description: 'Building resilient infrastructure, promoting inclusive and sustainable industrialization and fostering innovation.' },
  { goal: 'SDG 11', title: 'Sustainable Cities and Communities', description: 'Making cities and human settlements inclusive, safe, resilient, and sustainable.' },
  { goal: 'SDG 12', title: 'Responsible Consumption and Production', description: 'Ensuring sustainable consumption and production patterns in technology.' },
  { goal: 'SDG 16', title: 'Peace, Justice and Strong Institutions', description: 'Promoting peaceful and inclusive societies, access to justice, and effective institutions.' }
];

const SDG_OPTIONS = [
  { value: '', label: 'No SDG Assigned' },
  ...SDG_PRESETS.map(s => ({
    value: s.goal,
    label: `${s.goal}: ${s.title}`,
  })),
];

export const Step4LearningPlan: React.FC<Step4LearningPlanProps> = ({ data, onChange }) => {
  const { learningPlan = [], courseInfo } = data;

  // ─── Auto-sync lecture/lab hours from Contact Hours ─────────────────────────
  const scheduleAnalysis = analyzeSectionSchedules(data.facultyMembers, courseInfo.type);
  const canonicalLectureHours = scheduleAnalysis.canonicalLectureHours || parseFloat(courseInfo.lectureHours || '0') || 0;
  const canonicalLabHours = scheduleAnalysis.canonicalLabHours || parseFloat(courseInfo.labHours || '0') || 0;

  // Function to calculate number of weeks from week range string
  const getWeekCount = (weekStr: string): number => {
    if (!weekStr) return 0;
    const parts = weekStr.split('-').map(p => p.trim());
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        return end - start + 1;
      }
    }
    // Single number represents one week (e.g., "5" = week 5, not 5 weeks)
    return 1;
  };

  // Auto-update learning plan hours when Contact Hours change
  useEffect(() => {
    if (learningPlan.length === 0) return;
    
    const updated = learningPlan.map(row => ({
      ...row,
      hoursLec: canonicalLectureHours,
      hoursLab: canonicalLabHours
    }));
    
    const hasChanges = learningPlan.some((row, i) => 
      row.hoursLec !== updated[i].hoursLec || row.hoursLab !== updated[i].hoursLab
    );
    
    if (hasChanges) {
      onChange({ ...data, learningPlan: updated });
    }
  }, [canonicalLectureHours, canonicalLabHours, learningPlan, data, onChange]);

  const updatePlanRow = (index: number, field: keyof LearningPlanWeek, value: any) => {
    const updated = learningPlan.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange({ ...data, learningPlan: updated });
  };

  const updateListField = (index: number, field: 'learningOutcomes' | 'topics' | 'methodology' | 'resources' | 'assessment', htmlContent: string) => {
    updatePlanRow(index, field, [htmlContent]);
  };

  const addSdg = (planIndex: number, goalKey: string) => {
    const matched = SDG_PRESETS.find(s => s.goal === goalKey);
    if (!matched) return;

    const currentSdgs = learningPlan[planIndex].sdgCoherence || [];
    if (currentSdgs.some(s => s.goal === goalKey)) return; // Prevent duplicates

    updatePlanRow(planIndex, 'sdgCoherence', [
      ...currentSdgs,
      {
        goal: matched.goal,
        title: matched.title,
        description: matched.description,
        explanation: ''
      }
    ]);
  };

  const removeSdg = (planIndex: number, goalKey: string) => {
    const currentSdgs = learningPlan[planIndex].sdgCoherence || [];
    const updated = currentSdgs.filter(s => s.goal !== goalKey);
    updatePlanRow(planIndex, 'sdgCoherence', updated.length > 0 ? updated : undefined);
  };

  const updateSdgExplanation = (planIndex: number, goalKey: string, explanation: string) => {
    const currentSdgs = learningPlan[planIndex].sdgCoherence || [];
    const updated = currentSdgs.map(s =>
      s.goal === goalKey ? { ...s, explanation } : s
    );
    updatePlanRow(planIndex, 'sdgCoherence', updated);
  };

  const addPlanRow = () => {
    const nextRow: LearningPlanWeek = {
      week: '',
      hoursLec: 0,
      hoursLab: 0,
      learningOutcomes: [],
      topics: [],
      sdgCoherence: undefined,
      methodology: [],
      resources: [],
      assessment: []
    };
    onChange({
      ...data,
      learningPlan: [...learningPlan, nextRow]
    });
  };

  const removePlanRow = (index: number) => {
    const updated = learningPlan.filter((_, i) => i !== index);
    onChange({ ...data, learningPlan: updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={addPlanRow}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Plan Block</span>
        </button>
      </div>

      <div className="space-y-6">
        {learningPlan.map((row, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center space-x-3">
                <span className="font-bold text-sm text-foreground">
                  Block {idx + 1}
                </span>
                <RequiredMark />
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                    Week:
                  </span>
                  <input
                    type="text"
                    value={row.week ?? ''}
                    onChange={e => {
                      const input = e.target.value;

                      // Only allow numbers, spaces, and hyphens
                      const validChars = /^[0-9\s-]*$/;
                      if (!validChars.test(input)) return;

                      // Split by hyphen to get individual numbers
                      const parts = input.split('-').map(p => p.trim());
                      const isValid = parts.every(part => {
                        if (part === '') return true; // Allow empty during typing
                        const num = parseInt(part, 10);
                        return !isNaN(num) && num >= 1 && num <= 99;
                      });

                      if (isValid) {
                        updatePlanRow(idx, 'week', input);
                      }
                    }}
                    onKeyDown={e => {
                      // Allow navigation and deletion keys
                      const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                      if (allowedKeys.includes(e.key)) return;

                      // Only allow numbers, space, and hyphen
                      if (!/^[0-9-]$/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="1 or 1 - 4"
                    className="w-32 pl-14 pr-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
                  />
                </div>
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Lec:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={(() => {
                      const weekCount = getWeekCount(row.week);
                      const totalLec = canonicalLectureHours * weekCount;
                      return totalLec === 0 ? '' : String(totalLec);
                    })()}
                    placeholder="0"
                    disabled
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      updatePlanRow(idx, 'hoursLec', raw === '' ? 0 : Number(raw));
                    }}
                    className="w-12 px-1.5 py-0.5 text-xs rounded border border-border bg-muted/50 text-muted-foreground cursor-not-allowed text-center outline-none select-none"
                  />
                  <span>Lab:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={(() => {
                      const weekCount = getWeekCount(row.week);
                      const totalLab = canonicalLabHours * weekCount;
                      return totalLab === 0 ? '' : String(totalLab);
                    })()}
                    placeholder="0"
                    disabled
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      updatePlanRow(idx, 'hoursLab', raw === '' ? 0 : Number(raw));
                    }}
                    className="w-12 px-1.5 py-0.5 text-xs rounded border border-border bg-muted/50 text-muted-foreground cursor-not-allowed text-center outline-none select-none"
                  />
                  <span>hrs</span>
                </div>
              </div>

              {learningPlan.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePlanRow(idx)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                  title="Remove Block"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                  <span>Learning Outcomes</span>
                  <RequiredMark />
                </label>
                <RichTextEditor
                  content={(row.learningOutcomes || [])[0] || ''}
                  onChange={(html: string) => updateListField(idx, 'learningOutcomes', html)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                  <span>Topics / Subject Matter (Optional)</span>
                </label>
                <RichTextEditor
                  content={(row.topics || [])[0] || ''}
                  onChange={(html: string) => updateListField(idx, 'topics', html)}
                  className="min-h-[100px]"
                />
              </div>
            </div>

            {/* SDG Coherence - Multiple Selections with Explanations */}
            <div className="p-4 rounded-xl bg-muted/30 border border-border/70 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>SDG Coherence (Sustainable Development Goals)</span>
                </label>
                <div className="w-64">
                  <CustomDropdown
                    value=""
                    onChange={val => val && addSdg(idx, val)}
                    options={SDG_OPTIONS.filter(opt => opt.value !== '' && !(row.sdgCoherence || []).some(s => s.goal === opt.value))}
                    variant="compact"
                    placeholder="+ Add SDG"
                  />
                </div>
              </div>

              {(row.sdgCoherence || []).length > 0 ? (
                <div className="space-y-1.5">
                  {row.sdgCoherence.map((sdg, sdgIdx) => (
                    <div key={sdgIdx} className="p-2 rounded-md bg-background border border-border/60 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-xs font-bold text-foreground mb-0.5">
                            {sdg.goal}: {sdg.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground mb-1">
                            {sdg.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSdg(idx, sdg.goal)}
                          className="p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                          title="Remove SDG"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-muted-foreground">
                          Alignment:
                        </label>
                        <textarea
                          rows={1}
                          value={sdg.explanation || ''}
                          onChange={e => updateSdgExplanation(idx, sdg.goal, e.target.value)}
                          placeholder="How this aligns..."
                          className="w-full px-1.5 py-1 text-xs rounded-sm border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-y"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-2">
                  No SDGs assigned. Click "+ Add SDG" to assign relevant Sustainable Development Goals.
                </div>
              )}
            </div>

            {/* Methodology, Resources & Assessment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                  <span>Methodology (Teaching Strategies)</span>
                  <RequiredMark />
                </label>
                <RichTextEditor
                  content={(row.methodology || [])[0] || ''}
                  onChange={(html: string) => updateListField(idx, 'methodology', html)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Learning Resources
                </label>
                <RichTextEditor
                  content={(row.resources || [])[0] || ''}
                  onChange={(html: string) => updateListField(idx, 'resources', html)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                  <span>Assessment</span>
                  <RequiredMark />
                </label>
                <RichTextEditor
                  content={(row.assessment || [])[0] || ''}
                  onChange={(html: string) => updateListField(idx, 'assessment', html)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
