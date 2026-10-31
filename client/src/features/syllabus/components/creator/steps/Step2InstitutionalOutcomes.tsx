import React, { useState, useEffect } from 'react';
import type { OfficialSyllabusData, CourseOutcome, ProgramOutcome, RubricRow } from '../../../../../shared/data/syllabusData';
import { OFFICIAL_SYLLABUS_CSPC112, OFFICIAL_INSTITUTIONAL_STATEMENTS, normalizeRubricLevels, createEmptyRubricRow, DEFAULT_RUBRIC_LEVEL_TITLES } from '../../../../../shared/data/syllabusData';
import { CustomDropdown } from '../../../../../shared/components/common';
import { RequiredMark } from '../RequiredMark';
import { CollapsibleCard } from '../CollapsibleCard';
import {
  Landmark,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RotateCcw,
  Compass,
  HeartHandshake,
  BookOpen,
  ShieldCheck,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { analyzeSectionSchedules } from '../../../utils/scheduleHours';

const COURSE_TYPE_OPTIONS = [
  { value: 'Lecture', label: 'Lecture' },
  { value: 'Lecture and Laboratory', label: 'Lecture and Laboratory' },
  { value: 'Laboratory', label: 'Laboratory' },
];

/**
 * Give every rubric criterion exactly `count` performance levels, keeping the
 * titles/descriptions already entered and filling new slots with defaults.
 */
const resizeRubricLevels = (rows: RubricRow[], count: number): RubricRow[] =>
  (rows || []).map(row => {
    const levels = normalizeRubricLevels(row.levels).slice(0, count);
    while (levels.length < count) {
      const idx = levels.length;
      levels.push({
        title: DEFAULT_RUBRIC_LEVEL_TITLES[idx] || '',
        description: ''
      });
    }
    return { ...row, levels };
  });

interface Step2InstitutionalOutcomesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step2InstitutionalOutcomes: React.FC<Step2InstitutionalOutcomesProps> = ({ data, onChange }) => {
  const [showInstitutional, setShowInstitutional] = useState(false);
  const [showCoreValues, setShowCoreValues] = useState(false);
  const [showGraduateAttributes, setShowGraduateAttributes] = useState(false);

  const {
    institutionalStatements,
    programOutcomes = [],
    courseOutcomes = [],
    gradingSystem,
    projectRubrics = [],
    classroomPolicies = []
  } = data;

  const effectiveInstitutional = {
    philosophy: (institutionalStatements?.philosophy?.trim() && institutionalStatements.philosophy.trim() !== 'Total human development')
      ? institutionalStatements.philosophy.trim()
      : OFFICIAL_INSTITUTIONAL_STATEMENTS.philosophy,
    vision: (institutionalStatements?.vision?.trim() && !institutionalStatements.vision.includes('A Premier University of the North'))
      ? institutionalStatements.vision.trim()
      : OFFICIAL_INSTITUTIONAL_STATEMENTS.vision,
    mission: (institutionalStatements?.mission?.trim() && !institutionalStatements.mission.includes('Develop human capital for nation building'))
      ? institutionalStatements.mission.trim()
      : OFFICIAL_INSTITUTIONAL_STATEMENTS.mission,
    goal: institutionalStatements?.goal?.trim() || OFFICIAL_INSTITUTIONAL_STATEMENTS.goal,
    coreValues: (institutionalStatements?.coreValues && institutionalStatements.coreValues.length > 0)
      ? institutionalStatements.coreValues
      : OFFICIAL_INSTITUTIONAL_STATEMENTS.coreValues,
    graduateAttributes: (institutionalStatements?.graduateAttributes && institutionalStatements.graduateAttributes.length > 0)
      ? institutionalStatements.graduateAttributes
      : OFFICIAL_INSTITUTIONAL_STATEMENTS.graduateAttributes
  };

  const courseInfo = data?.courseInfo || {
    code: '',
    title: '',
    semester: '',
    academicYear: '',
    type: '',
    credit: '',
    lectureHours: '',
    labHours: '',
    prerequisite: '',
    description: ''
  };

  // Number of performance levels every criterion shares. Seeded from the
  // loaded rubrics so the control always matches what is on screen.
  const [newRowLevelCount, setNewRowLevelCount] = useState<number>(() =>
    projectRubrics.length > 0
      ? Math.max(1, Math.min(10, normalizeRubricLevels(projectRubrics[0].levels).length))
      : 4
  );

  // Normalise legacy `{1,2,3,4}` payloads and align every criterion to one
  // number of performance levels.
  useEffect(() => {
    if (projectRubrics.length === 0) return;
    const count = Math.max(1, Math.min(10, normalizeRubricLevels(projectRubrics[0].levels).length));
    setNewRowLevelCount(count);
    const aligned = resizeRubricLevels(projectRubrics, count);
    const isSame = aligned.length === projectRubrics.length
      && aligned.every((r, i) => JSON.stringify(r) === JSON.stringify(projectRubrics[i]));
    if (!isSame) {
      onChange({ ...data, projectRubrics: aligned });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Contact Hours derived from Section 1 schedules ────────────────────────
  // Contact Hours are NOT editable; they must be computed from the
  // uniform per-section weekly hours in Section 1 across all instructors.
  const scheduleAnalysis = analyzeSectionSchedules(data.facultyMembers, courseInfo.type);
  const lectureMismatch = scheduleAnalysis.hasLectureMismatch;
  const labMismatch = scheduleAnalysis.hasLabMismatch;
  const scheduleMismatch = scheduleAnalysis.hasMismatch;

  const lectureHoursValue = lectureMismatch
    ? ''
    : (scheduleAnalysis.canonicalLectureHours > 0 ? String(scheduleAnalysis.canonicalLectureHours) : (courseInfo.lectureHours || ''));
  const labHoursValue = labMismatch
    ? ''
    : (scheduleAnalysis.canonicalLabHours > 0 ? String(scheduleAnalysis.canonicalLabHours) : (courseInfo.labHours || ''));

  // Auto-normalize if programOutcomes or courseOutcomes have non-contiguous numbering (e.g. from prior deletions or draft)
  useEffect(() => {
    const hasUnnormalizedPO = programOutcomes.some((po, idx) => po.number !== idx + 1);
    const hasUnnormalizedCO = courseOutcomes.some((co, idx) => co.number !== idx + 1);
    if (hasUnnormalizedPO || hasUnnormalizedCO) {
      const poMap = new Map<number, number>();
      const reindexedPOs = programOutcomes.map((po, idx) => {
        poMap.set(po.number, idx + 1);
        return { ...po, number: idx + 1 };
      });
      const coMap = new Map<number, number>();
      const reindexedCOs = courseOutcomes.map((co, idx) => {
        coMap.set(co.number, idx + 1);
        return { ...co, number: idx + 1 };
      });
      const updatedMap = (data.courseMap || []).map((cm, idx) => {
        const newCoNum = coMap.get(cm.coNumber) ?? (idx + 1);
        const newAlignments: Record<number, 'I' | 'P' | 'D'> = {};
        Object.entries(cm.poAlignments || {}).forEach(([oldKey, val]) => {
          const newPoNum = poMap.get(Number(oldKey)) ?? Number(oldKey);
          if (val) newAlignments[newPoNum] = val;
        });
        return {
          ...cm,
          coNumber: newCoNum,
          poAlignments: newAlignments
        };
      });
      onChange({
        ...data,
        programOutcomes: reindexedPOs,
        courseOutcomes: reindexedCOs,
        courseMap: updatedMap
      });
    }
  }, [programOutcomes, courseOutcomes, data, onChange]);

  // Sync computed Contact Hours (from Section 1 schedules) into courseInfo so the
  // document preview and downstream consumers always reflect the live schedules.
  // Only writes when the derived value differs from what is stored, to avoid loops.
  useEffect(() => {
    const current = data?.courseInfo;
    if (!current) return;
    const nextLecture = lectureMismatch ? '' : lectureHoursValue;
    const nextLab = labMismatch ? '' : labHoursValue;
    if (current.lectureHours === nextLecture && current.labHours === nextLab) return;
    onChange({
      ...data,
      courseInfo: {
        ...current,
        lectureHours: nextLecture,
        labHours: nextLab
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureHoursValue, labHoursValue, lectureMismatch, labMismatch]);

  const addProgramOutcome = () => {
    const nextNumber = programOutcomes.length + 1;
    const newPO: ProgramOutcome = {
      number: nextNumber,
      description: ''
    };
    onChange({
      ...data,
      programOutcomes: [...programOutcomes, newPO]
    });
  };

  const updateProgramOutcome = (idx: number, description: string) => {
    const updated = programOutcomes.map((po, i) =>
      i === idx ? { ...po, description } : po
    );
    onChange({
      ...data,
      programOutcomes: updated
    });
  };

  const removeProgramOutcome = (idx: number) => {
    if (idx < 0 || idx >= programOutcomes.length) return;

    const filtered = programOutcomes.filter((_, i) => i !== idx);
    const poNumberMap = new Map<number, number>();
    const reindexedPOs = filtered.map((po, i) => {
      const newNum = i + 1;
      poNumberMap.set(po.number, newNum);
      return {
        ...po,
        number: newNum
      };
    });

    const updatedMap = (data.courseMap || []).map(cm => {
      const newAlignments: Record<number, 'I' | 'P' | 'D'> = {};
      Object.entries(cm.poAlignments || {}).forEach(([oldPoKey, val]) => {
        const oldPoNum = Number(oldPoKey);
        const newPoNum = poNumberMap.get(oldPoNum);
        if (newPoNum !== undefined && val) {
          newAlignments[newPoNum] = val;
        }
      });
      return {
        ...cm,
        poAlignments: newAlignments
      };
    });

    onChange({
      ...data,
      programOutcomes: reindexedPOs,
      courseMap: updatedMap
    });
  };

  const addCourseOutcome = () => {
    const nextNumber = courseOutcomes.length + 1;
    const newOutcome: CourseOutcome = {
      number: nextNumber,
      statement: ''
    };
    onChange({
      ...data,
      courseOutcomes: [...courseOutcomes, newOutcome],
      courseMap: [
        ...(data.courseMap || []),
        {
          coNumber: nextNumber,
          coStatement: '',
          poAlignments: {}
        }
      ]
    });
  };

  const updateCourseOutcome = (idx: number, statement: string) => {
    const updated = courseOutcomes.map((co, i) =>
      i === idx ? { ...co, statement } : co
    );
    const targetNum = courseOutcomes[idx]?.number ?? (idx + 1);
    const updatedMap = (data.courseMap || []).map(cm =>
      cm.coNumber === targetNum ? { ...cm, coStatement: statement } : cm
    );
    onChange({
      ...data,
      courseOutcomes: updated,
      courseMap: updatedMap
    });
  };

  const removeCourseOutcome = (idx: number) => {
    if (idx < 0 || idx >= courseOutcomes.length) return;

    const targetCO = courseOutcomes[idx];
    const filtered = courseOutcomes.filter((_, i) => i !== idx);
    const coNumberMap = new Map<number, number>();
    const reindexedCOs = filtered.map((co, i) => {
      const newNum = i + 1;
      coNumberMap.set(co.number, newNum);
      return {
        ...co,
        number: newNum
      };
    });

    const remainingCourseMap = (data.courseMap || []).filter(cm => cm.coNumber !== targetCO?.number);
    const updatedMap = remainingCourseMap.map(cm => {
      const newCoNum = coNumberMap.get(cm.coNumber) ?? cm.coNumber;
      const matchingCO = reindexedCOs.find(c => c.number === newCoNum);
      return {
        ...cm,
        coNumber: newCoNum,
        coStatement: matchingCO?.statement || cm.coStatement
      };
    });

    onChange({
      ...data,
      courseOutcomes: reindexedCOs,
      courseMap: updatedMap
    });
  };

  const updateCourseInfo = (field: keyof typeof courseInfo, value: string) => {
    onChange({
      ...data,
      courseInfo: {
        ...courseInfo,
        [field]: value
      }
    });
  };

  const updateGrading = (field: keyof typeof data.gradingSystem, value: any) => {
    onChange({
      ...data,
      gradingSystem: {
        ...data.gradingSystem,
        [field]: value
      }
    });
  };

  const addComponent = () => {
    const current = (gradingSystem?.classStandingComponents || []) as any[];
    if (current.length > 0 && typeof current[0] === 'string') {
      updateGrading('classStandingComponents', [...current, '']);
    } else {
      updateGrading('classStandingComponents', [...current, { title: '', percentage: '' }]);
    }
  };

  const updateComponentItem = (index: number, field: 'title' | 'percentage', value: string) => {
    const current = [...(gradingSystem?.classStandingComponents || [])] as any[];
    
    // Handle legacy string format
    if (typeof current[index] === 'string') {
      current[index] = value;
    } else {
      current[index] = { ...current[index], [field]: value };
    }
    
    updateGrading('classStandingComponents', current);
  };

  const removeComponent = (index: number) => {
    const current = [...(gradingSystem?.classStandingComponents || [])];
    current.splice(index, 1);
    updateGrading('classStandingComponents', current);
  };

  const addPolicy = () => {
    const current = classroomPolicies || [];
    onChange({
      ...data,
      classroomPolicies: [...current, '']
    });
  };

  const updatePolicyItem = (index: number, value: string) => {
    const current = [...(classroomPolicies || [])];
    current[index] = value;
    onChange({
      ...data,
      classroomPolicies: current
    });
  };

  const removePolicy = (index: number) => {
    const current = [...(classroomPolicies || [])];
    current.splice(index, 1);
    onChange({
      ...data,
      classroomPolicies: current
    });
  };

const addRubricRow = () => {
    const newRow: RubricRow = createEmptyRubricRow(newRowLevelCount);
    onChange({
      ...data,
      projectRubrics: [...projectRubrics, newRow]
    });
  };

  const updateRubricCategory = (index: number, category: string) => {
    const updated = [...projectRubrics];
    updated[index] = { ...updated[index], category };
    onChange({
      ...data,
      projectRubrics: updated
    });
  };

  const updateRubricLevelTitle = (index: number, levelIdx: number, title: string) => {
    const updated = [...projectRubrics];
    const levels = normalizeRubricLevels(updated[index].levels);
    levels[levelIdx] = { ...levels[levelIdx], title };
    updated[index] = { ...updated[index], levels };
    onChange({
      ...data,
      projectRubrics: updated
    });
  };

  const updateRubricLevelDescription = (index: number, levelIdx: number, description: string) => {
    const updated = [...projectRubrics];
    const levels = normalizeRubricLevels(updated[index].levels);
    levels[levelIdx] = { ...levels[levelIdx], description };
    updated[index] = { ...updated[index], levels };
    onChange({
      ...data,
      projectRubrics: updated
    });
  };

  /** One count for the whole rubric: every criterion is resized together. */
  const stepRubricLevelCount = (delta: number) => {
    const count = Math.max(1, Math.min(10, newRowLevelCount + delta));
    if (count === newRowLevelCount) return;
    setNewRowLevelCount(count);
    if (projectRubrics.length > 0) {
      onChange({ ...data, projectRubrics: resizeRubricLevels(projectRubrics, count) });
    }
  };

  // Arrow keys on the read-only count field or its stepper buttons adjust the count.
  const handleLevelCountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepRubricLevelCount(1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepRubricLevelCount(-1);
    }
  };

  const removeRubricRow = (index: number) => {
    const updated = projectRubrics.filter((_, i) => i !== index);
    onChange({
      ...data,
      projectRubrics: updated
    });
  };

  const restoreBaselineRubrics = () => {
    onChange({
      ...data,
      projectRubrics: resizeRubricLevels(OFFICIAL_SYLLABUS_CSPC112.projectRubrics, newRowLevelCount)
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Philosophy, Mission, Vision, Goals */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/40 border-b border-border">
          <button
            type="button"
            onClick={() => setShowInstitutional(!showInstitutional)}
            className="flex items-center space-x-2 font-semibold text-xs text-foreground hover:text-primary transition-colors cursor-pointer text-left"
          >
            <Landmark className="w-4 h-4 text-primary" />
            <span>Institutional Framework (Philosophy, Mission, Vision, Goals)</span>
            {showInstitutional ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>

        {showInstitutional && (
          <div className="p-4 space-y-4 text-xs">
            {/* Philosophy */}
            <div className="space-y-1.5">
              <label htmlFor="inst-philosophy" className="font-bold text-foreground">
                <span>Philosophy</span>
              </label>
              <textarea
                id="inst-philosophy"
                disabled
                rows={2}
                value={effectiveInstitutional.philosophy}
                placeholder="University philosophy..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all leading-relaxed"
              />
            </div>

            {/* Mission */}
            <div className="space-y-1.5">
              <label htmlFor="inst-mission" className="font-bold text-foreground">
                <span>Mission</span>
              </label>
              <textarea
                id="inst-mission"
                disabled
                rows={2}
                value={effectiveInstitutional.mission}
                placeholder="University mission statement..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all leading-relaxed"
              />
            </div>

            {/* Vision */}
            <div className="space-y-1.5">
              <label htmlFor="inst-vision" className="font-bold text-foreground">
                <span>Vision</span>
              </label>
              <textarea
                id="inst-vision"
                disabled
                rows={2}
                value={effectiveInstitutional.vision}
                placeholder="University vision statement..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all leading-relaxed"
              />
            </div>

            {/* Goals */}
            <div className="space-y-1.5">
              <label htmlFor="inst-goal" className="font-bold text-foreground">
                <span>Goals</span>
              </label>
              <textarea
                id="inst-goal"
                disabled
                rows={2}
                value={effectiveInstitutional.goal}
                placeholder="University institutional goal..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Graduate Attributes */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/40 border-b border-border">
          <button
            type="button"
            onClick={() => setShowGraduateAttributes(!showGraduateAttributes)}
            className="flex items-center space-x-2 font-semibold text-xs text-foreground hover:text-primary transition-colors cursor-pointer text-left"
          >
            <Compass className="w-4 h-4 text-primary" />
            <span>Graduate Attributes ({effectiveInstitutional.graduateAttributes.length} Defined)</span>
            {showGraduateAttributes ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>

        {showGraduateAttributes && (
          <div className="p-4 space-y-3">
            {effectiveInstitutional.graduateAttributes.map((ga, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/20">
                <div className="w-1/3 min-w-[140px] space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title</label>
                  <input
                    type="text"
                    disabled
                    value={ga.title ?? ''}
                    placeholder="e.g. Critical Thinker"
                    className="w-full px-2 py-1 text-xs font-semibold rounded-md border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                  <textarea
                    rows={2}
                    disabled
                    value={ga.description ?? ''}
                    placeholder="Describe graduate capability..."
                    className="w-full px-2 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none leading-relaxed"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Core Values (SERVICE) */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/40 border-b border-border">
          <button
            type="button"
            onClick={() => setShowCoreValues(!showCoreValues)}
            className="flex items-center space-x-2 font-semibold text-xs text-foreground hover:text-primary transition-colors cursor-pointer text-left"
          >
            <HeartHandshake className="w-4 h-4 text-primary" />
            <span>Core Values ({effectiveInstitutional.coreValues.length} Defined)</span>
            {showCoreValues ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
        </div>

        {showCoreValues && (
          <div className="p-4 space-y-3">
            {effectiveInstitutional.coreValues.map((cv, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/20">
                <div className="w-24 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Keyword</label>
                  <input
                    type="text"
                    disabled
                    value={cv.keyword || cv.acronym || ''}
                    placeholder="e.g. Service"
                    className="w-full px-2 py-1 text-xs font-semibold rounded-md border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                  <input
                    type="text"
                    disabled
                    value={cv.description ?? ''}
                    placeholder="Description of core value..."
                    className="w-full px-2 py-1 text-xs rounded-md border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Program Outcomes (PO) Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center space-x-1">
              <span>Program Outcomes (PO1 – PO{programOutcomes.length})</span>
              <RequiredMark />
            </h3>
            <p className="text-xs text-muted-foreground">
              Institutional program outcomes. Edit each outcome or add new ones; these map directly into the Part IV Course Map Matrix.
            </p>
          </div>
          <button
            type="button"
            onClick={addProgramOutcome}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Program Outcome</span>
          </button>
        </div>

        <div className="space-y-3">
          {programOutcomes.map((po, idx) => {
            const displayNum = idx + 1;
            return (
              <div
                key={idx}
                className="flex items-start space-x-3 p-3.5 rounded-xl border border-border bg-card shadow-xs hover:border-primary/40 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex-shrink-0 mt-0.5">
                  PO{displayNum}
                </span>
                <div className="flex-1">
                  <textarea
                    rows={2}
                    value={po.description ?? ''}
                    onChange={e => updateProgramOutcome(idx, e.target.value)}
                    placeholder={`Describe Program Outcome ${displayNum}...`}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
                  />
                </div>
                {programOutcomes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProgramOutcome(idx)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                    title={`Remove PO${displayNum}`}
                    aria-label={`Remove PO${displayNum}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Course Outcomes (CO) Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground inline-flex items-center gap-1">
              <span>Course Outcomes (CO)</span>
              <RequiredMark />
            </h3>
            <p className="text-xs text-muted-foreground">
              Measurable statements of what students should be able to do by the end of the course.
            </p>
          </div>
          <button
            type="button"
            onClick={addCourseOutcome}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Course Outcome</span>
          </button>
        </div>

        <div className="space-y-3">
          {courseOutcomes.map((co, idx) => {
            const displayNum = idx + 1;
            return (
              <div
                key={idx}
                className="flex items-start space-x-3 p-3.5 rounded-xl border border-border bg-card shadow-xs hover:border-primary/40 transition-colors"
              >
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex-shrink-0 mt-0.5">
                  CO{displayNum}
                </span>
                <div className="flex-1">
                  <textarea
                    rows={2}
                    value={co.statement ?? ''}
                    onChange={e => updateCourseOutcome(idx, e.target.value)}
                    placeholder={`Describe Course Outcome ${displayNum}...`}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
                  />
                </div>
                {courseOutcomes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCourseOutcome(idx)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                    title={`Remove CO${displayNum}`}
                    aria-label={`Remove CO${displayNum}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Course Specifications (Course Type, Credit, Description, Contact Hours, Prerequisites) */}
      <CollapsibleCard
        icon={<BookOpen className="w-4 h-4 text-primary" />}
        title="Course Catalog Specifications"
        headerRight={<span className="text-[10px] text-muted-foreground italic">Catalog & Hours</span>}
      >

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="course-type" className="text-xs font-semibold text-foreground">
              Course Type
            </label>
            <div title="To change the course type, change it from Section 1.">
              <CustomDropdown
                id="course-type"
                value={courseInfo.type ?? ''}
                onChange={val => updateCourseInfo('type', val)}
                options={COURSE_TYPE_OPTIONS}
                placeholder="Select Course Type"
                disabled
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-credit" className="text-xs font-semibold text-foreground flex items-center space-x-1">
              <span>Course Credit</span>
              <RequiredMark />
            </label>
            <div className="flex items-center gap-2">
              <input
                id="course-credit"
                type="number"
                value={courseInfo.credit ?? ''}
                onChange={e => updateCourseInfo('credit', e.target.value)}
                placeholder="e.g. 3"
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">unit(s)</span>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="course-description" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span className="inline-flex items-center gap-1">
                Course Description
                <RequiredMark />
              </span>
              <span className="text-[10px] font-normal text-primary font-medium">(Editable)</span>
            </label>
            <textarea
              id="course-description"
              rows={4}
              value={courseInfo.description ?? ''}
              onChange={e => updateCourseInfo('description', e.target.value)}
              placeholder="Enter official course catalog description..."
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all leading-relaxed"
            />
          </div>

          {scheduleMismatch && (
            <div className="md:col-span-2 flex items-start gap-2.5 p-3 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold">
                  {lectureMismatch && labMismatch
                    ? 'Lecture and Lab Hours Mismatched across Sections:'
                    : lectureMismatch
                    ? 'Lecture Hours Mismatched across Sections:'
                    : 'Lab Hours Mismatched across Sections:'}
                </span>
              </div>
            </div>
          )}

          {(courseInfo.type === 'Lecture' || courseInfo.type === 'Lecture and Laboratory') && (
            <div className="space-y-1.5">
              <label htmlFor="lecture-hours" className="text-xs font-semibold text-foreground">
                Contact Hours: Lecture Hours / Week
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="lecture-hours"
                  type="text"
                  disabled
                  value={lectureHoursValue}
                  placeholder={lectureMismatch ? 'Lecture schedules are mismatched' : 'e.g. 2'}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">hours/week</span>
              </div>
            </div>
          )}

          {(courseInfo.type === 'Laboratory' || courseInfo.type === 'Lecture and Laboratory') && (
            <div className="space-y-1.5">
              <label htmlFor="lab-hours" className="text-xs font-semibold text-foreground">
                Contact Hours: Laboratory Hours / Week
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="lab-hours"
                  type="text"
                  disabled
                  value={labHoursValue}
                  placeholder={labMismatch ? 'Lab schedules are mismatched' : 'e.g. 3'}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed outline-none select-none transition-all"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">hours/week</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="course-prereq" className="text-xs font-semibold text-foreground">
              Course Prerequisites <span className="text-muted-foreground font-normal">(Optional)</span>
            </label>
            <input
              id="course-prereq"
              type="text"
              value={courseInfo.prerequisite ?? ''}
              onChange={e => updateCourseInfo('prerequisite', e.target.value)}
              placeholder="e.g. CSPC 111 or None"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>
      </CollapsibleCard>

      {/* 7. Grading System */}
      <CollapsibleCard
        icon={<ShieldCheck className="w-4 h-4 text-primary" />}
        title="Grading System"
        headerRight={<span className="text-[10px] text-muted-foreground italic">Evaluation Formulas</span>}
      >

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground inline-flex items-center gap-1">
              <span>Term Grade Computation</span>
              <RequiredMark />
            </label>
            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Class Standing</span>
                <span className="text-sm font-mono font-semibold text-foreground">40%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Exam</span>
                <span className="text-sm font-mono font-semibold text-foreground">60%</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground inline-flex items-center gap-1">
              <span>Final Grade Computation</span>
              <RequiredMark />
            </label>
            <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Midterm Grade</span>
                <span className="text-sm font-mono font-semibold text-foreground">40%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Final Term Grade</span>
                <span className="text-sm font-mono font-semibold text-foreground">60%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground inline-flex items-center gap-1">
                <span>Class Standing Components</span>
                <RequiredMark />
              </label>
              <button
                type="button"
                onClick={addComponent}
                className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Component</span>
              </button>
            </div>

            <div className="space-y-3">
              {(gradingSystem?.classStandingComponents && gradingSystem.classStandingComponents.length > 0) ? (
                <>
                  {gradingSystem.classStandingComponents.map((comp, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-border/70 bg-muted/10 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-1.5">
                          <label className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                            <span>Component #{idx + 1}</span>
                            <RequiredMark />
                          </label>
                          <input
                            type="text"
                            value={typeof comp === 'string' ? comp : comp.title}
                            onChange={e => updateComponentItem(idx, 'title', e.target.value)}
                            placeholder="e.g. Quizzes"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeComponent(idx)}
                          className="mt-6 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                          title="Remove component"
                          aria-label={`Remove component ${idx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-xs text-muted-foreground italic py-1">
                  No components defined. Click &ldquo;Add Component&rdquo; to add one.
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {/* Optional Rubrics for Group Project Presentation and Documentation */}
      <CollapsibleCard
        icon={<Layers className="w-4 h-4 text-primary" />}
        title={
          <>
            <span className="font-bold text-xs text-foreground">
              Rubrics for Group Project Presentation and Documentation
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              Optional
            </span>
          </>
        }
        contentClassName=""
        headerRight={
          <div className="flex items-center space-x-3">
            {projectRubrics.length > 0 && (
              <button
                type="button"
                onClick={restoreBaselineRubrics}
                className="flex items-center space-x-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                title="Reset to official DMMMSU project rubrics"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore Baseline Rubrics</span>
              </button>
            )}
            <label className="flex items-center space-x-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={projectRubrics.length > 0}
                onChange={e => {
                  if (e.target.checked) {
                    onChange({
                      ...data,
                      projectRubrics: [createEmptyRubricRow(newRowLevelCount)]
                    });
                  } else {
                    onChange({
                      ...data,
                      projectRubrics: []
                    });
                  }
                }}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer"
              />
              <span className="text-xs font-medium text-foreground">Include in Syllabus</span>
            </label>
          </div>
        }
      >

{projectRubrics.length > 0 ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label htmlFor="rubric-level-count" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Levels per criterion
                  </label>
                  <div className="flex items-center gap-1" onKeyDown={handleLevelCountKeyDown}>
                    <input
                      id="rubric-level-count"
                      aria-label="Performance levels per criterion"
                      type="number"
                      min={1}
                      max={10}
                      value={newRowLevelCount}
                      readOnly
                      className="w-12 px-2 py-1 text-center text-xs rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-default outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        aria-label="Increase performance levels"
                        onClick={() => stepRubricLevelCount(1)}
                        disabled={newRowLevelCount >= 10}
                        className="flex h-3 w-6 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Decrease performance levels"
                        onClick={() => stepRubricLevelCount(-1)}
                        disabled={newRowLevelCount <= 1}
                        className="flex h-3 w-6 items-center justify-center rounded border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addRubricRow}
                  className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Rubric Criterion</span>
                </button>
              </div>

              <div className="space-y-4">
                {projectRubrics.map((r, rIdx) => {
                  // Read through the normalizer: a legacy `{1:{...}}` payload from a
                  // saved draft reaches this render before the mount effect can rewrite it.
                  const levels = normalizeRubricLevels(r.levels);
                  return (
                    <div key={rIdx} className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                            <span>Criterion #{rIdx + 1} Name / Evaluation Category</span>
                            <RequiredMark />
                          </label>
                          <input
                            type="text"
                            value={r.category}
                            onChange={e => updateRubricCategory(rIdx, e.target.value)}
                            placeholder="e.g. Articulate requirements and design of the project"
                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRubricRow(rIdx)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer mt-4"
                          title="Remove rubric criterion"
                          aria-label={`Remove rubric criterion ${rIdx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Performance Levels ({levels.length})
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {levels.map((level, lvIdx) => {
                            const levelNames = ['Beginning', 'Developing', 'Proficient', 'Exemplary'];
                            const placeholder = `e.g. Level ${lvIdx + 1} (${levelNames[lvIdx] || 'Custom'}), ${lvIdx + 1} point${lvIdx > 0 ? 's' : ''}`;
                            return (
                            <div key={lvIdx} className="space-y-1.5 p-2.5 rounded-lg border border-border bg-background">
                              <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                                  <span>Level Title</span>
                                  <RequiredMark />
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={level.title}
                                    onChange={e => updateRubricLevelTitle(rIdx, lvIdx, e.target.value)}
                                    placeholder={placeholder}
                                    className="flex-1 px-2 py-1 text-[11px] font-bold rounded border border-border bg-muted/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                  />
                                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">#{lvIdx + 1}</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-muted-foreground inline-flex items-center gap-1">
                                  <span>Description</span>
                                  <RequiredMark />
                                </label>
                                <textarea
                                  rows={3}
                                  value={level.description}
                                  onChange={e => updateRubricLevelDescription(rIdx, lvIdx, e.target.value)}
                                  placeholder="Describe performance for this level..."
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all leading-relaxed"
                                />
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
              <span>Project presentation and documentation rubrics are currently omitted from this syllabus.</span>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Levels
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newRowLevelCount}
                  onChange={e => setNewRowLevelCount(Math.max(1, Math.min(10, Number(e.target.value) || 4)))}
                  className="w-16 px-2 py-1 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    onChange({
                      ...data,
                      projectRubrics: [createEmptyRubricRow(newRowLevelCount)]
                    });
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer"
                >
                  + Enable Project Rubric
                </button>
              </div>
            </div>
          )}
      </CollapsibleCard>

      {/* 8. Classroom Policies */}
      <CollapsibleCard
        icon={<ShieldCheck className="w-4 h-4 text-primary" />}
        title={
          <>
            <span>Classroom Policies</span>
            <RequiredMark />
          </>
        }
        headerRight={
          <button
            type="button"
            onClick={addPolicy}
            className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Policy</span>
          </button>
        }
      >

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Course &amp; Classroom Directives
          </label>
          <div className="space-y-2 mt-2">
            {(classroomPolicies && classroomPolicies.length > 0) ? (
              classroomPolicies.map((policy, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <div className="w-6 h-6 rounded-md bg-muted text-muted-foreground text-[11px] font-bold flex items-center justify-center shrink-0 mt-2">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    aria-label={`Classroom Policy ${idx + 1}`}
                    value={policy}
                    onChange={e => updatePolicyItem(idx, e.target.value)}
                    placeholder={`Policy ${idx + 1}: e.g. Class attendance and punctuality must be observed...`}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => removePolicy(idx)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer mt-0.5"
                    title="Remove policy"
                    aria-label={`Remove policy ${idx + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground italic py-1">
                No classroom policies defined. Click &ldquo;Add Policy&rdquo; to add one.
              </div>
            )}
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
};
