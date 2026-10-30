import type { OfficialSyllabusData } from '../../../shared/data/syllabusData';
import type { WizardStepId } from '../types/creator';

type Data = OfficialSyllabusData | undefined | null;

const has = (v?: string | null): boolean => Boolean(v && String(v).trim());
const hasAny = (values?: Array<string | undefined | null>): boolean =>
  Boolean(values && values.some(v => {
    if (!v) return false;
    const textOnly = v.replace(/<[^>]*>/g, '').trim();
    return textOnly.length > 0;
  }));

const hasSdgExplanation = (sdg?: { explanation?: string }): boolean => {
  if (!sdg) return false;
  if (!sdg.explanation) return false;
  return sdg.explanation.trim().length > 0;
};

const isExamRow = (title?: string, timeFrame?: string): boolean =>
  (title || '').toUpperCase().includes('EXAMINATION') ||
  (timeFrame || '').toLowerCase().includes('exam');

/**
 * Required inputs for a step, as human-readable labels. These are exactly the
 * fields marked with a red asterisk inside that step's form, so the tab badge
 * (check vs. warning) can never disagree with what the form calls required.
 */
export function getMissingStepFields(stepId: WizardStepId, data: Data): string[] {
  switch (stepId) {
    case 'course-info': {
      const missing: string[] = [];
      const type = data?.courseInfo?.type || '';
      if (!has(type)) missing.push('Course Type');

      const needsLecture = /lecture/i.test(type);
      const needsLab = /laboratory/i.test(type);
      const faculty = data?.facultyMembers || [];
      if (faculty.length === 0) {
        missing.push('Assigned Faculty Member(s)');
        return missing;
      }

      faculty.forEach((fac, idx) => {
        const facLabel = faculty.length > 1 ? `Faculty ${idx + 1} ` : '';
        const slots = fac.consultationSlots || [];
        if (!slots.some(slot => has(slot.time))) missing.push(`${facLabel}Consultation Time`);

        const sections = fac.sections || [];
        sections.forEach((sec, secIdx) => {
          const secLabel = sections.length > 1 ? `Section ${secIdx + 1} ` : '';
          if (needsLecture && !has(sec.lectureSchedule)) missing.push(`${secLabel}Lecture Time`);
          if (needsLab && !has(sec.labSchedule)) missing.push(`${secLabel}Lab Time`);
        });
      });
      return missing;
    }

    case 'outcomes': {
      const missing: string[] = [];
      if (!has(data?.courseInfo?.description)) missing.push('Course Description');
      if (!hasAny((data?.courseOutcomes || []).map(co => co.statement))) missing.push('Course Outcomes');
      
      // Check term formula (object with classStandingPercent and examPercent)
      const termFormula = data?.gradingSystem?.termFormula;
      if (typeof termFormula === 'object') {
        if (!has(termFormula.classStandingPercent)) missing.push('Term Formula Class Standing %');
        if (!has(termFormula.examPercent)) missing.push('Term Formula Exam %');
      } else if (!has(termFormula)) {
        missing.push('Term Formula');
      }
      
      // Check final formula (object with midtermPercent and finalPercent)
      const finalFormula = data?.gradingSystem?.finalFormula;
      if (typeof finalFormula === 'object') {
        if (!has(finalFormula.midtermPercent)) missing.push('Final Formula Midterm %');
        if (!has(finalFormula.finalPercent)) missing.push('Final Formula Final %');
      } else if (!has(finalFormula)) {
        missing.push('Final Formula');
      }
      
      // Check passing grade
      if (!has(data?.gradingSystem?.passingGrade)) missing.push('Passing Grade Benchmark');
      
      // Check class standing components total equals 100%
      const components = data?.gradingSystem?.classStandingComponents || [];
      if (components.length > 0) {
        const total = components.reduce((sum, comp) => {
          const pct = typeof comp === 'string' ? 0 : parseFloat(comp.percentage) || 0;
          return sum + pct;
        }, 0);
        if (Math.abs(total - 100) > 0.01) {
          missing.push('Class Standing Components must total 100%');
        }
        // Check each component has title and percentage
        components.forEach((comp, idx) => {
          const title = typeof comp === 'string' ? comp : comp.title;
          const pct = typeof comp === 'string' ? '' : comp.percentage;
          if (!has(title)) missing.push(`Component ${idx + 1} Title`);
          if (!has(pct)) missing.push(`Component ${idx + 1} Weight`);
        });
      }
      
      if (!hasAny(data?.classroomPolicies)) missing.push('Classroom Policies');
      return missing;
    }

    case 'outline': {
      const rows = data?.courseOutline || [];
      if (rows.length === 0) return ['Course Outline Entries'];
      const missing: string[] = [];
      rows.forEach((row, idx) => {
        const label = rows.length > 1 ? `Entry ${idx + 1}` : 'Entry';
        if (!has(row.timeFrame)) missing.push(`${label} Time Frame`);
        if (!has(row.title)) missing.push(`${label} Title`);
        if (!isExamRow(row.title, row.timeFrame) && !hasAny(row.topics)) {
          missing.push(`${label} Subtopics`);
        }
      });
      return missing;
    }

    case 'learning-plan': {
      const rows = data?.learningPlan || [];
      if (rows.length === 0) return ['Plan Block'];
      const missing: string[] = [];
      rows.forEach((row, idx) => {
        const label = rows.length > 1 ? `Block ${idx + 1}` : 'Block';
        if (!has(row.week)) missing.push(`${label} Time Frame`);
        if (!hasAny(row.learningOutcomes)) missing.push(`${label} Learning Outcomes`);
        if (!hasAny(row.topics)) missing.push(`${label} Topics`);
        if (!hasAny(row.methodology)) missing.push(`${label} Methodology`);
        if (!hasAny(row.assessment)) missing.push(`${label} Assessment`);
        // Check SDG explanations if SDGs are assigned
        if (row.sdgCoherence && row.sdgCoherence.length > 0) {
          row.sdgCoherence.forEach((sdg, sdgIdx) => {
            if (!hasSdgExplanation(sdg)) {
              missing.push(`${label} SDG ${sdg.goal} Explanation`);
            }
          });
        }
      });
      return missing;
    }

    case 'course-map': {
      const outcomes = data?.courseOutcomes || [];
      if (outcomes.length === 0) return ['Course Outcomes'];
      const map = data?.courseMap || [];
      const unmapped = outcomes.filter(co => {
        const entry = map.find(cm => cm.coNumber === co.number);
        return !Object.values(entry?.poAlignments || {}).some(v => v === 'I' || v === 'P' || v === 'D');
      });
      return unmapped.length > 0 ? ['PO Alignment'] : [];
    }

    case 'grading': {
      const refs = data?.references || [];
      if (refs.length === 0) return ['References'];
      const missing: string[] = [];
      refs.forEach((ref, idx) => {
        const label = refs.length > 1 ? `Reference ${idx + 1}` : 'Reference';
        if (!has(ref.authors)) missing.push(`${label} Author(s)`);
        if (!has(ref.year)) missing.push(`${label} Year`);
        if (!has(ref.title)) missing.push(`${label} Title`);
      });
      return missing;
    }

    case 'review': {
      const signatories = data?.signatories;
      const missing: string[] = [];
      if (!has(signatories?.preparedBy?.[0]?.name)) missing.push('Faculty Name');
      if (!has(signatories?.recommendingApproval?.name)) missing.push('Program Chairperson');
      if (!has(signatories?.approved?.name)) missing.push('College Dean');
      return missing;
    }

    default:
      return [];
  }
}

/** True only when every required input of that step is filled. */
export function isStepComplete(stepId: WizardStepId, data: Data): boolean {
  return getMissingStepFields(stepId, data).length === 0;
}
