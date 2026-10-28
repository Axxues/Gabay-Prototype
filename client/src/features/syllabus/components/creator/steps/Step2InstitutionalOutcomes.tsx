import React, { useState } from 'react';
import type { OfficialSyllabusData, CourseOutcome, ProgramOutcome, CoreValue, GraduateAttribute } from '../../../../../shared/data/syllabusData';
import { OFFICIAL_SYLLABUS_CSPC112 } from '../../../../../shared/data/syllabusData';
import { Landmark, Award, Plus, Trash2, ChevronDown, ChevronRight, RotateCcw, Compass, HeartHandshake } from 'lucide-react';

interface Step2InstitutionalOutcomesProps {
  data: OfficialSyllabusData;
  onChange: (updated: OfficialSyllabusData) => void;
}

export const Step2InstitutionalOutcomes: React.FC<Step2InstitutionalOutcomesProps> = ({ data, onChange }) => {
  const [showInstitutional, setShowInstitutional] = useState(true);
  const [showCoreValues, setShowCoreValues] = useState(false);
  const [showGraduateAttributes, setShowGraduateAttributes] = useState(false);

  const { institutionalStatements, programOutcomes = [], courseOutcomes = [] } = data;

  const restoreBaseline = () => {
    onChange({
      ...data,
      institutionalStatements: {
        ...OFFICIAL_SYLLABUS_CSPC112.institutionalStatements
      },
      programOutcomes: [
        ...OFFICIAL_SYLLABUS_CSPC112.programOutcomes
      ]
    });
  };

  const updateStatement = (field: 'philosophy' | 'vision' | 'mission' | 'goal', value: string) => {
    onChange({
      ...data,
      institutionalStatements: {
        ...institutionalStatements,
        [field]: value
      }
    });
  };

  const updateCoreValue = (index: number, field: keyof CoreValue, value: string) => {
    const list = [...(institutionalStatements?.coreValues || [])];
    list[index] = { ...list[index], [field]: value };
    onChange({
      ...data,
      institutionalStatements: {
        ...institutionalStatements,
        coreValues: list
      }
    });
  };

  const addCoreValue = () => {
    const list = [...(institutionalStatements?.coreValues || [])];
    list.push({ acronym: 'VAL', keyword: 'Value', description: 'Core institutional value statement.' });
    onChange({
      ...data,
      institutionalStatements: {
        ...institutionalStatements,
        coreValues: list
      }
    });
  };

  const removeCoreValue = (index: number) => {
    const list = (institutionalStatements?.coreValues || []).filter((_, i) => i !== index);
    onChange({
      ...data,
      institutionalStatements: {
        ...institutionalStatements,
        coreValues: list
      }
    });
  };

  const updateGraduateAttribute = (index: number, field: keyof GraduateAttribute, value: any) => {
    const list = [...(institutionalStatements?.graduateAttributes || [])];
    list[index] = { ...list[index], [field]: value };
    onChange({
      ...data,
      institutionalStatements: {
        ...institutionalStatements,
        graduateAttributes: list
      }
    });
  };

  const addGraduateAttribute = () => {
    const list = [...(institutionalStatements?.graduateAttributes || [])];
    list.push({
      number: list.length + 1,
      title: `Graduate Attribute ${list.length + 1}`,
      description: 'Competency and institutional graduate attribute statement.'
    });
    onChange({
      ...data,
      institutionalStatements: {
        ...institutionalStatements,
        graduateAttributes: list
      }
    });
  };

  const removeGraduateAttribute = (index: number) => {
    const list = (institutionalStatements?.graduateAttributes || []).filter((_, i) => i !== index);
    onChange({
      ...data,
      institutionalStatements: {
        ...institutionalStatements,
        graduateAttributes: list
      }
    });
  };

  const addProgramOutcome = () => {
    const nextNumber = programOutcomes.length > 0 ? Math.max(...programOutcomes.map(p => p.number)) + 1 : 1;
    const newPO: ProgramOutcome = {
      number: nextNumber,
      description: 'New program outcome statement describing student capability and domain proficiency.'
    };
    onChange({
      ...data,
      programOutcomes: [...programOutcomes, newPO]
    });
  };

  const updateProgramOutcome = (number: number, description: string) => {
    const updated = programOutcomes.map(po => po.number === number ? { ...po, description } : po);
    onChange({
      ...data,
      programOutcomes: updated
    });
  };

  const removeProgramOutcome = (number: number) => {
    const updated = programOutcomes.filter(po => po.number !== number);
    const updatedMap = (data.courseMap || []).map(cm => {
      const alignments = { ...cm.poAlignments };
      delete alignments[number];
      return {
        ...cm,
        poAlignments: alignments
      };
    });
    onChange({
      ...data,
      programOutcomes: updated,
      courseMap: updatedMap
    });
  };

  const addCourseOutcome = () => {
    const nextNumber = courseOutcomes.length > 0 ? Math.max(...courseOutcomes.map(c => c.number)) + 1 : 1;
    const newOutcome: CourseOutcome = {
      number: nextNumber,
      statement: 'New course outcome statement describing measurable competency.'
    };
    onChange({
      ...data,
      courseOutcomes: [...courseOutcomes, newOutcome],
      courseMap: [
        ...(data.courseMap || []),
        {
          coNumber: nextNumber,
          coStatement: newOutcome.statement,
          poAlignments: {}
        }
      ]
    });
  };

  const updateCourseOutcome = (number: number, statement: string) => {
    const updated = courseOutcomes.map(co => co.number === number ? { ...co, statement } : co);
    const updatedMap = (data.courseMap || []).map(cm => cm.coNumber === number ? { ...cm, coStatement: statement } : cm);
    onChange({
      ...data,
      courseOutcomes: updated,
      courseMap: updatedMap
    });
  };

  const removeCourseOutcome = (number: number) => {
    const updated = courseOutcomes.filter(co => co.number !== number);
    const updatedMap = (data.courseMap || []).filter(cm => cm.coNumber !== number);
    onChange({
      ...data,
      courseOutcomes: updated,
      courseMap: updatedMap
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border/70 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
            <Award className="w-5 h-5 text-primary" />
            <span>Institutional Statements & Course Outcomes</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Customize institutional PVMGO, Core Values, Graduate Attributes, Program Outcomes (POs), and articulate your Course Outcomes (COs).
          </p>
        </div>
      </div>

      {/* Editable University PVMGO Section */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/40 border-b border-border">
          <button
            type="button"
            onClick={() => setShowInstitutional(!showInstitutional)}
            className="flex items-center space-x-2 font-semibold text-xs text-foreground hover:text-primary transition-colors cursor-pointer text-left"
          >
            <Landmark className="w-4 h-4 text-primary" />
            <span>Institutional Framework (Philosophy, Vision, Mission, Goal)</span>
            {showInstitutional ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
          <button
            type="button"
            onClick={restoreBaseline}
            className="flex items-center space-x-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restore University Baseline</span>
          </button>
        </div>

        {showInstitutional && (
          <div className="p-4 space-y-4 text-xs">
            <div className="space-y-1.5">
              <label htmlFor="inst-philosophy" className="font-bold text-foreground block">
                Philosophy:
              </label>
              <textarea
                id="inst-philosophy"
                rows={2}
                value={institutionalStatements?.philosophy || ''}
                onChange={e => updateStatement('philosophy', e.target.value)}
                placeholder="Enter university philosophy..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inst-vision" className="font-bold text-foreground block">
                Vision:
              </label>
              <textarea
                id="inst-vision"
                rows={2}
                value={institutionalStatements?.vision || ''}
                onChange={e => updateStatement('vision', e.target.value)}
                placeholder="Enter university vision statement..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inst-mission" className="font-bold text-foreground block">
                Mission:
              </label>
              <textarea
                id="inst-mission"
                rows={2}
                value={institutionalStatements?.mission || ''}
                onChange={e => updateStatement('mission', e.target.value)}
                placeholder="Enter university mission statement..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="inst-goal" className="font-bold text-foreground block">
                Goal:
              </label>
              <textarea
                id="inst-goal"
                rows={2}
                value={institutionalStatements?.goal || ''}
                onChange={e => updateStatement('goal', e.target.value)}
                placeholder="Enter university institutional goal..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
              />
            </div>
          </div>
        )}
      </div>

      {/* Editable Core Values (SERVICE) */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/40 border-b border-border">
          <button
            type="button"
            onClick={() => setShowCoreValues(!showCoreValues)}
            className="flex items-center space-x-2 font-semibold text-xs text-foreground hover:text-primary transition-colors cursor-pointer text-left"
          >
            <HeartHandshake className="w-4 h-4 text-primary" />
            <span>Core Values ({institutionalStatements?.coreValues?.length || 0} Defined)</span>
            {showCoreValues ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showCoreValues && (
            <button
              type="button"
              onClick={addCoreValue}
              className="flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Value</span>
            </button>
          )}
        </div>

        {showCoreValues && (
          <div className="p-4 space-y-3">
            {(institutionalStatements?.coreValues || []).map((cv, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/20">
                <div className="w-24 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Keyword</label>
                  <input
                    type="text"
                    value={cv.keyword || cv.acronym}
                    onChange={e => updateCoreValue(idx, 'keyword', e.target.value)}
                    placeholder="e.g. Service"
                    className="w-full px-2 py-1 text-xs font-semibold rounded-md border border-border bg-background"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                  <input
                    type="text"
                    value={cv.description}
                    onChange={e => updateCoreValue(idx, 'description', e.target.value)}
                    placeholder="Description of core value..."
                    className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background"
                  />
                </div>
                {(institutionalStatements?.coreValues || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCoreValue(idx)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer mt-4"
                    title="Remove value"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editable Graduate Attributes */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/40 border-b border-border">
          <button
            type="button"
            onClick={() => setShowGraduateAttributes(!showGraduateAttributes)}
            className="flex items-center space-x-2 font-semibold text-xs text-foreground hover:text-primary transition-colors cursor-pointer text-left"
          >
            <Compass className="w-4 h-4 text-primary" />
            <span>Institutional Graduate Attributes ({institutionalStatements?.graduateAttributes?.length || 0} Defined)</span>
            {showGraduateAttributes ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showGraduateAttributes && (
            <button
              type="button"
              onClick={addGraduateAttribute}
              className="flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Attribute</span>
            </button>
          )}
        </div>

        {showGraduateAttributes && (
          <div className="p-4 space-y-3">
            {(institutionalStatements?.graduateAttributes || []).map((ga, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-muted/20">
                <div className="w-1/3 min-w-[140px] space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title</label>
                  <input
                    type="text"
                    value={ga.title}
                    onChange={e => updateGraduateAttribute(idx, 'title', e.target.value)}
                    placeholder="e.g. Critical Thinker"
                    className="w-full px-2 py-1 text-xs font-semibold rounded-md border border-border bg-background"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
                  <textarea
                    rows={2}
                    value={ga.description}
                    onChange={e => updateGraduateAttribute(idx, 'description', e.target.value)}
                    placeholder="Describe graduate capability..."
                    className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background leading-relaxed"
                  />
                </div>
                {(institutionalStatements?.graduateAttributes || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeGraduateAttribute(idx)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer mt-4"
                    title="Remove attribute"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Program Outcomes (PO) Section - FULLY EDITABLE */}
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
          {programOutcomes.map(po => (
            <div
              key={po.number}
              className="flex items-start space-x-3 p-3.5 rounded-xl border border-border bg-card shadow-xs hover:border-primary/40 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex-shrink-0 mt-0.5">
                PO{po.number}
              </span>
              <div className="flex-1">
                <textarea
                  rows={2}
                  value={po.description}
                  onChange={e => updateProgramOutcome(po.number, e.target.value)}
                  placeholder={`Describe Program Outcome ${po.number}...`}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
                />
              </div>
              {programOutcomes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeProgramOutcome(po.number)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                  title={`Remove PO${po.number}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Course Outcomes (CO) Section */}
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
          {courseOutcomes.map(co => (
            <div
              key={co.number}
              className="flex items-start space-x-3 p-3.5 rounded-xl border border-border bg-card shadow-xs hover:border-primary/40 transition-colors"
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex-shrink-0 mt-0.5">
                CO{co.number}
              </span>
              <div className="flex-1">
                <textarea
                  rows={2}
                  value={co.statement}
                  onChange={e => updateCourseOutcome(co.number, e.target.value)}
                  placeholder={`Describe Course Outcome ${co.number}...`}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all leading-relaxed"
                />
              </div>
              {courseOutcomes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCourseOutcome(co.number)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                  title="Remove Course Outcome"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
