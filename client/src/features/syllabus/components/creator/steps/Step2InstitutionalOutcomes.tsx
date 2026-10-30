import React, { useState, useEffect } from 'react';
import type { OfficialSyllabusData, CourseOutcome, ProgramOutcome, RubricRow } from '../../../../../shared/data/syllabusData';
import { OFFICIAL_SYLLABUS_CSPC112, OFFICIAL_INSTITUTIONAL_STATEMENTS } from '../../../../../shared/data/syllabusData';
import { CustomDropdown } from '../../../../../shared/components/common/CustomDropdown';
import {
  Landmark,
  Award,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Compass,
  HeartHandshake,
  BookOpen,
  ShieldCheck,
  Clock,
  Layers
} from 'lucide-react';

const COURSE_TYPE_OPTIONS = [
  { value: 'Lecture', label: 'Lecture' },
  { value: 'Lecture and Laboratory', label: 'Lecture and Laboratory' },
  { value: 'Laboratory', label: 'Laboratory' },
];

interface Step2InstitutionalOutcomesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step2InstitutionalOutcomes: React.FC<Step2InstitutionalOutcomesProps> = ({ data, onChange }) => {
  const [showInstitutional, setShowInstitutional] = useState(true);
  const [showCoreValues, setShowCoreValues] = useState(false);
  const [showGraduateAttributes, setShowGraduateAttributes] = useState(false);

  const {
    institutionalStatements,
    programOutcomes = [],
    courseOutcomes = [],
    gradingSystem,
    projectRubrics = [],
    classroomPolicies = [],
    facultyMembers = []
  } = data;

  const effectiveInstitutional = {
    philosophy: institutionalStatements?.philosophy?.trim() || OFFICIAL_INSTITUTIONAL_STATEMENTS.philosophy,
    vision: institutionalStatements?.vision?.trim() || OFFICIAL_INSTITUTIONAL_STATEMENTS.vision,
    mission: institutionalStatements?.mission?.trim() || OFFICIAL_INSTITUTIONAL_STATEMENTS.mission,
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

  const primaryFaculty = facultyMembers[0];

  const restoreBaseline = () => {
    onChange({
      ...data,
      institutionalStatements: {
        ...OFFICIAL_INSTITUTIONAL_STATEMENTS
      },
      programOutcomes: [
        ...OFFICIAL_SYLLABUS_CSPC112.programOutcomes
      ]
    });
  };

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

  const updateProgramOutcome = (numberOrIndex: number, description: string) => {
    const updated = programOutcomes.map((po, idx) =>
      (po.number === numberOrIndex || idx === numberOrIndex) ? { ...po, description } : po
    );
    onChange({
      ...data,
      programOutcomes: updated
    });
  };

  const removeProgramOutcome = (numberOrIndex: number) => {
    const targetIdx = (numberOrIndex >= 0 && numberOrIndex < programOutcomes.length)
      ? numberOrIndex
      : programOutcomes.findIndex(po => po.number === numberOrIndex);
    if (targetIdx === -1) return;

    const filtered = programOutcomes.filter((_, idx) => idx !== targetIdx);
    const poNumberMap = new Map<number, number>();
    const reindexedPOs = filtered.map((po, idx) => {
      const newNum = idx + 1;
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

  const updateCourseOutcome = (numberOrIndex: number, statement: string) => {
    const targetIdx = (numberOrIndex >= 0 && numberOrIndex < courseOutcomes.length)
      ? numberOrIndex
      : courseOutcomes.findIndex(co => co.number === numberOrIndex);
    const updated = courseOutcomes.map((co, idx) =>
      (idx === targetIdx || co.number === numberOrIndex) ? { ...co, statement } : co
    );
    const targetNum = targetIdx !== -1 ? courseOutcomes[targetIdx]?.number : numberOrIndex;
    const updatedMap = (data.courseMap || []).map(cm =>
      (cm.coNumber === targetNum || cm.coNumber === (targetIdx + 1)) ? { ...cm, coStatement: statement } : cm
    );
    onChange({
      ...data,
      courseOutcomes: updated,
      courseMap: updatedMap
    });
  };

  const removeCourseOutcome = (numberOrIndex: number) => {
    const targetIdx = (numberOrIndex >= 0 && numberOrIndex < courseOutcomes.length)
      ? numberOrIndex
      : courseOutcomes.findIndex(co => co.number === numberOrIndex);
    if (targetIdx === -1) return;

    const targetCO = courseOutcomes[targetIdx];
    const filtered = courseOutcomes.filter((_, idx) => idx !== targetIdx);
    const coNumberMap = new Map<number, number>();
    const reindexedCOs = filtered.map((co, idx) => {
      const newNum = idx + 1;
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
        ...(data.gradingSystem || {}),
        [field]: value
      }
    });
  };

  const addComponent = () => {
    const current = gradingSystem?.classStandingComponents || [];
    updateGrading('classStandingComponents', [...current, '']);
  };

  const updateComponentItem = (index: number, value: string) => {
    const current = [...(gradingSystem?.classStandingComponents || [])];
    current[index] = value;
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
    const newRow: RubricRow = {
      category: '',
      levels: { 1: '', 2: '', 3: '', 4: '' }
    };
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

  const updateRubricLevel = (index: number, level: 1 | 2 | 3 | 4, text: string) => {
    const updated = [...projectRubrics];
    updated[index] = {
      ...updated[index],
      levels: {
        ...updated[index].levels,
        [level]: text
      }
    };
    onChange({
      ...data,
      projectRubrics: updated
    });
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
      projectRubrics: [...OFFICIAL_SYLLABUS_CSPC112.projectRubrics]
    });
  };

  const updateConsultationHours = (val: string) => {
    const updated = [...facultyMembers];
    if (updated.length > 0) {
      updated[0] = {
        ...updated[0],
        consultation: val
      };
    } else {
      updated.push({
        name: 'Assigned Faculty',
        sections: [{ section: '', schedule: '', room: '' }],
        consultation: val
      });
    }
    onChange({
      ...data,
      facultyMembers: updated
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
            <Award className="w-5 h-5 text-primary" />
            <span>Institutional Foundation &amp; Course Specifications</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Institutional PVMGO statements, Graduate Attributes, Core Values, Outcomes, Course Specifications, Grading, and Policies aligned with DMMMSU-INS-F003 Part I.
          </p>
        </div>
      </div>

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
          <div className="flex items-center space-x-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              Institutional Standard (Non-editable)
            </span>
            <button
              type="button"
              onClick={restoreBaseline}
              className="flex items-center space-x-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restore University Baseline</span>
            </button>
          </div>
        </div>

        {showInstitutional && (
          <div className="p-4 space-y-4 text-xs">
            {/* Philosophy */}
            <div className="space-y-1.5">
              <label htmlFor="inst-philosophy" className="font-bold text-foreground flex items-center justify-between">
                <span>Philosophy</span>
                <span className="text-[10px] font-normal text-muted-foreground">(DMMMSU Standard)</span>
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
              <label htmlFor="inst-mission" className="font-bold text-foreground flex items-center justify-between">
                <span>Mission</span>
                <span className="text-[10px] font-normal text-muted-foreground">(DMMMSU Standard)</span>
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
              <label htmlFor="inst-vision" className="font-bold text-foreground flex items-center justify-between">
                <span>Vision</span>
                <span className="text-[10px] font-normal text-muted-foreground">(DMMMSU Standard)</span>
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
              <label htmlFor="inst-goal" className="font-bold text-foreground flex items-center justify-between">
                <span>Goals</span>
                <span className="text-[10px] font-normal text-muted-foreground">(DMMMSU Standard)</span>
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
          <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
            Institutional Standard (Non-editable)
          </span>
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
          <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
            Institutional Standard (Non-editable)
          </span>
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
            <h3 className="text-sm font-bold text-foreground">
              Program Outcomes (PO1 – PO{programOutcomes.length})
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
            <h3 className="text-sm font-bold text-foreground">Course Outcomes (CO)</h3>
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
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Course Catalog Specifications</span>
          </h3>
          <span className="text-[10px] text-muted-foreground italic">Catalog &amp; Hours</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="course-type" className="text-xs font-semibold text-foreground">
              Course Type
            </label>
            <CustomDropdown
              id="course-type"
              value={courseInfo.type ?? ''}
              onChange={val => updateCourseInfo('type', val)}
              options={COURSE_TYPE_OPTIONS}
              placeholder="Select Course Type"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="course-credit" className="text-xs font-semibold text-foreground">
              Course Credit
            </label>
            <input
              id="course-credit"
              type="text"
              value={courseInfo.credit ?? ''}
              onChange={e => updateCourseInfo('credit', e.target.value)}
              placeholder="e.g. 3 units"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="course-description" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Course Description</span>
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

          <div className="space-y-1.5">
            <label htmlFor="lecture-hours" className="text-xs font-semibold text-foreground">
              Contact Hours: Lecture Hours / Week
            </label>
            <input
              id="lecture-hours"
              type="text"
              value={courseInfo.lectureHours ?? ''}
              onChange={e => updateCourseInfo('lectureHours', e.target.value)}
              placeholder="e.g. 2 hours/week"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="lab-hours" className="text-xs font-semibold text-foreground">
              Contact Hours: Laboratory Hours / Week
            </label>
            <input
              id="lab-hours"
              type="text"
              value={courseInfo.labHours ?? ''}
              onChange={e => updateCourseInfo('labHours', e.target.value)}
              placeholder="e.g. 3 hours/week (or leave empty)"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="course-prereq" className="text-xs font-semibold text-foreground">
              Course Prerequisites
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
      </div>

      {/* 7. Grading System */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Grading System</span>
          </h3>
          <span className="text-[10px] text-muted-foreground italic">Evaluation Formulas</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="term-formula" className="text-xs font-semibold text-foreground">
              Term Formula (Midterms)
            </label>
            <input
              id="term-formula"
              type="text"
              value={gradingSystem?.termFormula || ''}
              onChange={e => updateGrading('termFormula', e.target.value)}
              placeholder="e.g. 60% Class Standing + 40% Midterm Exam"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="final-formula" className="text-xs font-semibold text-foreground">
              Final Grade Formula
            </label>
            <input
              id="final-formula"
              type="text"
              value={gradingSystem?.finalFormula || ''}
              onChange={e => updateGrading('finalFormula', e.target.value)}
              placeholder="e.g. 50% Midterm Grade + 50% Tentative Final Grade"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="passing-grade" className="text-xs font-semibold text-foreground">
              Passing Grade Benchmark
            </label>
            <input
              id="passing-grade"
              type="text"
              value={gradingSystem?.passingGrade || ''}
              onChange={e => updateGrading('passingGrade', e.target.value)}
              placeholder="e.g. 75% or 3.0"
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Class Standing Components
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

            <div className="space-y-2">
              {(gradingSystem?.classStandingComponents && gradingSystem.classStandingComponents.length > 0) ? (
                gradingSystem.classStandingComponents.map((comp, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <input
                      type="text"
                      aria-label={`Class Standing Component ${idx + 1}`}
                      value={comp}
                      onChange={e => updateComponentItem(idx, e.target.value)}
                      placeholder="e.g. Quizzes and Unit Tests (25%)"
                      className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => removeComponent(idx)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                      title="Remove component"
                      aria-label={`Remove component ${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground italic py-1">
                  No components defined. Click &ldquo;Add Component&rdquo; to add one.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Optional Rubrics for Group Project Presentation and Documentation */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/40 border-b border-border">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="font-bold text-xs text-foreground">
              Rubrics for Group Project Presentation and Documentation
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              Optional
            </span>
          </div>

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
                      projectRubrics: [{ category: '', levels: { 1: '', 2: '', 3: '', 4: '' } }]
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
        </div>

        {projectRubrics.length > 0 ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Teams and group presentations are evaluated across criteria scored from Level 1 (Beginning) to Level 4 (Exemplary):
              </p>
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
              {projectRubrics.map((r, rIdx) => (
                <div key={rIdx} className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Criterion #{rIdx + 1} Name / Evaluation Category
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {([1, 2, 3, 4] as const).map(lv => {
                      const labels = {
                        1: 'Level 1 (Beginning)',
                        2: 'Level 2 (Developing)',
                        3: 'Level 3 (Proficient)',
                        4: 'Level 4 (Exemplary)'
                      };
                      return (
                        <div key={lv} className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">
                            {labels[lv]}
                          </label>
                          <textarea
                            rows={3}
                            value={r.levels[lv] || ''}
                            onChange={e => updateRubricLevel(rIdx, lv, e.target.value)}
                            placeholder={`Describe performance for ${labels[lv]}...`}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all leading-relaxed"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 text-xs text-muted-foreground flex items-center justify-between">
            <span>Project presentation and documentation rubrics are currently omitted from this syllabus.</span>
            <button
              type="button"
              onClick={() => {
                onChange({
                  ...data,
                  projectRubrics: [{ category: '', levels: { 1: '', 2: '', 3: '', 4: '' } }]
                });
              }}
              className="text-primary hover:underline font-semibold cursor-pointer"
            >
              + Enable Project Rubric
            </button>
          </div>
        )}
      </div>

      {/* 8. Classroom Policies */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Classroom Policies</span>
          </h3>
          <button
            type="button"
            onClick={addPolicy}
            className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Policy</span>
          </button>
        </div>

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
      </div>

      {/* 9. Consultation Hours */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
            <Clock className="w-4 h-4 text-primary" />
            <span>Consultation Hours</span>
          </h3>
          <span className="text-[10px] text-muted-foreground italic">Student Advising Schedule</span>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="consultation-hours-policy" className="text-xs font-semibold text-foreground">
            Designated Faculty Consultation Period / Office Hours
          </label>
          <input
            id="consultation-hours-policy"
            type="text"
            value={primaryFaculty?.consultation || ''}
            onChange={e => updateConsultationHours(e.target.value)}
            placeholder="e.g. MTWTHF 02:00 PM – 03:00 PM (Dean's Office / Faculty Room)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>
    </div>
  );
};
