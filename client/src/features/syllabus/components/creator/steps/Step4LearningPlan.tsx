import React from 'react';
import type { OfficialSyllabusData, LearningPlanWeek } from '../../../../../shared/data/syllabusData';
import { CustomDropdown } from '../../../../../shared/components/common/CustomDropdown';
import { Plus, Trash2, Globe, Clock, Layers } from 'lucide-react';

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
  const { learningPlan = [] } = data;

  const updatePlanRow = (index: number, field: keyof LearningPlanWeek, value: any) => {
    const updated = learningPlan.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange({ ...data, learningPlan: updated });
  };

  const updateListField = (index: number, field: 'learningOutcomes' | 'topics' | 'methodology' | 'resources' | 'assessment', text: string) => {
    const items = text.split('\n').filter(Boolean);
    updatePlanRow(index, field, items);
  };

  const handleSdgChange = (index: number, goalKey: string) => {
    if (!goalKey) {
      updatePlanRow(index, 'sdgCoherence', undefined);
      return;
    }
    const matched = SDG_PRESETS.find(s => s.goal === goalKey);
    if (matched) {
      updatePlanRow(index, 'sdgCoherence', {
        goal: matched.goal,
        title: matched.title,
        description: matched.description
      });
    }
  };

  const addPlanRow = () => {
    const nextRow: LearningPlanWeek = {
      week: `Week ${learningPlan.length + 1}`,
      hoursLec: 3,
      hoursLab: 0,
      learningOutcomes: [],
      topics: [],
      sdgCoherence: {
        goal: 'SDG 4',
        title: 'Quality Education',
        description: 'Providing inclusive and equitable quality education.'
      },
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
      <div className="border-b border-border/70 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Part III: Learning Plan & SDG Alignment</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Map out learning outcomes, topics, UN Sustainable Development Goals (SDG), teaching methodologies, and assessment tasks.
          </p>
        </div>
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
                <input
                  type="text"
                  value={row.week ?? ''}
                  onChange={e => updatePlanRow(idx, 'week', e.target.value)}
                  placeholder="e.g. Week 1 - 4"
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
                <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Lec:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.hoursLec === 0 ? '' : (row.hoursLec ?? '')}
                    placeholder="0"
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      updatePlanRow(idx, 'hoursLec', raw === '' ? 0 : Number(raw));
                    }}
                    className="w-12 px-1.5 py-0.5 text-xs rounded border border-border bg-background text-center outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span>Lab:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.hoursLab === 0 ? '' : (row.hoursLab ?? '')}
                    placeholder="0"
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      updatePlanRow(idx, 'hoursLab', raw === '' ? 0 : Number(raw));
                    }}
                    className="w-12 px-1.5 py-0.5 text-xs rounded border border-border bg-background text-center outline-none focus:ring-1 focus:ring-primary"
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
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Learning Outcomes (one per line)
                </label>
                <textarea
                  rows={3}
                  value={(row.learningOutcomes || []).join('\n')}
                  onChange={e => updateListField(idx, 'learningOutcomes', e.target.value)}
                  placeholder="Enter intended learning outcomes for this timeframe..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none leading-relaxed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Topics / Subject Matter (one per line)
                </label>
                <textarea
                  rows={3}
                  value={(row.topics || []).join('\n')}
                  onChange={e => updateListField(idx, 'topics', e.target.value)}
                  placeholder="Enter module topics and subtopics..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none leading-relaxed"
                />
              </div>
            </div>

            {/* SDG Coherence Selection */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>SDG Coherence (Sustainable Development Goals)</span>
                </label>
                <div className="w-64">
                  <CustomDropdown
                    value={row.sdgCoherence?.goal || ''}
                    onChange={val => handleSdgChange(idx, val)}
                    options={SDG_OPTIONS}
                    variant="compact"
                    placeholder="Select SDG"
                  />
                </div>
              </div>

              {row.sdgCoherence && (
                <div className="text-xs text-muted-foreground pl-5 border-l-2 border-emerald-500">
                  <span className="font-semibold text-foreground">{row.sdgCoherence.goal} – {row.sdgCoherence.title}: </span>
                  <span>{row.sdgCoherence.description}</span>
                </div>
              )}
            </div>

            {/* Methodology, Resources & Assessment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Methodology (Teaching Strategies)
                </label>
                <textarea
                  rows={2}
                  value={(row.methodology || []).join('\n')}
                  onChange={e => updateListField(idx, 'methodology', e.target.value)}
                  placeholder="Lecture-Discussion&#10;Demonstration&#10;Collaborative Learning"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Learning Resources
                </label>
                <textarea
                  rows={2}
                  value={(row.resources || []).join('\n')}
                  onChange={e => updateListField(idx, 'resources', e.target.value)}
                  placeholder="PPT Presentation&#10;Course LMS&#10;Textbook"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Assessment Tasks
                </label>
                <textarea
                  rows={2}
                  value={(row.assessment || []).join('\n')}
                  onChange={e => updateListField(idx, 'assessment', e.target.value)}
                  placeholder="Short Quizzes&#10;Lab Exercises&#10;Midterm Exam"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
