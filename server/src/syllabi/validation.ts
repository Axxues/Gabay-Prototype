import type { Request } from 'express';
import type { SyllabusSectionKey } from './contracts.js';

export type SyllabusApiErrorCode =
  | 'syllabus_not_found'
  | 'revision_conflict'
  | 'invalid_syllabus_section'
  | 'revision_not_publishable';

export class SyllabusValidationError extends Error {
  readonly code: SyllabusApiErrorCode = 'invalid_syllabus_section';

  constructor(message: string) {
    super(message);
    this.name = 'SyllabusValidationError';
  }
}

export const SYLLABUS_SECTION_KEYS: readonly SyllabusSectionKey[] = [
  'institution',
  'courseInfo',
  'faculty',
  'institutionalStatements',
  'programOutcomes',
  'courseOutcomes',
  'requirements',
  'gradingSystem',
  'rubrics',
  'policies',
  'outline',
  'learningPlan',
  'courseMap',
  'references',
  'signatories',
  'sourceDocument',
];

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (section: string, message: string): never => {
  throw new SyllabusValidationError(`Invalid ${section} section: ${message}`);
};

const asRecord = (section: string, value: unknown, path: string): JsonRecord => {
  if (!isRecord(value)) fail(section, `${path} must be an object.`);
  return value as JsonRecord;
};

const rejectUnknownKeys = (section: string, value: JsonRecord, known: ReadonlySet<string>, path: string): void => {
  for (const key of Object.keys(value)) {
    if (!known.has(key)) fail(section, `${path} has an unknown field '${key}'.`);
  }
};

const asString = (section: string, value: unknown, path: string): string => {
  if (typeof value !== 'string') fail(section, `${path} must be a string.`);
  return value as string;
};

const asStringList = (section: string, value: unknown, path: string): string[] => {
  if (!Array.isArray(value)) fail(section, `${path} must be an array of strings.`);
  for (const entry of value as unknown[]) {
    if (typeof entry !== 'string') fail(section, `${path} must be an array of strings.`);
  }
  return value as string[];
};

const asNonNegativeInt = (section: string, value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(section, `${path} must be a non-negative integer.`);
  }
  return value as number;
};

const asNonNegativeNumber = (section: string, value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(section, `${path} must be a non-negative number.`);
  }
  return value as number;
};

const checkUniquePositions = (section: string, entries: JsonRecord[], path: string): void => {
  const seen = new Set<number>();
  for (const entry of entries) {
    if (entry.position === undefined) continue;
    asNonNegativeInt(section, entry.position, `${path}.position`);
    if (seen.has(entry.position as number)) fail(section, `${path} has a duplicate position.`);
    seen.add(entry.position as number);
  }
};

const asRecordList = (section: string, value: unknown, path: string): JsonRecord[] => {
  if (!Array.isArray(value)) fail(section, `${path} must be an array.`);
  for (const entry of value as unknown[]) {
    if (!isRecord(entry)) fail(section, `${path} must be an array of objects.`);
  }
  const entries = value as JsonRecord[];
  checkUniquePositions(section, entries, path);
  return entries;
};

const INSTITUTION_KEYS = new Set(['university', 'college', 'formCode', 'revision']);
const COURSE_INFO_KEYS = new Set([
  'code',
  'title',
  'semester',
  'academicYear',
  'type',
  'credit',
  'lectureHours',
  'labHours',
  'prerequisite',
  'description',
]);
const FACULTY_KEYS = new Set(['name', 'sections', 'consultation', 'position']);
const FACULTY_SECTION_KEYS = new Set(['section', 'schedule', 'room', 'position']);
const STATEMENTS_KEYS = new Set([
  'philosophy',
  'vision',
  'mission',
  'goal',
  'coreValues',
  'graduateAttributes',
]);
const CORE_VALUE_KEYS = new Set(['acronym', 'keyword', 'description', 'position']);
const GRADUATE_ATTRIBUTE_KEYS = new Set(['number', 'title', 'description', 'position']);
const PROGRAM_OUTCOME_KEYS = new Set(['number', 'description', 'position']);
const COURSE_OUTCOME_KEYS = new Set(['number', 'statement', 'position']);
const REQUIREMENTS_KEYS = new Set(['major', 'other']);
const GRADING_KEYS = new Set(['termFormula', 'finalFormula', 'classStandingComponents', 'passingGrade']);
const RUBRIC_KEYS = new Set(['category', 'levels', 'position']);
const OUTLINE_KEYS = new Set(['timeFrame', 'title', 'topics', 'position']);
const LEARNING_PLAN_KEYS = new Set([
  'week',
  'hoursLab',
  'hoursLec',
  'learningOutcomes',
  'topics',
  'methodology',
  'resources',
  'assessment',
  'sdgCoherence',
  'position',
]);
const SDG_KEYS = new Set(['goal', 'title', 'description', 'target']);
const COURSE_MAP_KEYS = new Set(['coNumber', 'coStatement', 'poAlignments', 'position']);
const REFERENCE_KEYS = new Set(['citation', 'year', 'doiOrPublisher', 'position']);
const SIGNATORIES_KEYS = new Set(['preparedBy', 'recommendingApproval', 'approved']);
const SIGNATORY_KEYS = new Set(['name', 'title']);
const SIGNATORY_ROW_KEYS = new Set(['role', 'name', 'title', 'position']);
const SOURCE_DOCUMENT_KEYS = new Set([
  'fileName',
  'fileSize',
  'fileType',
  'fileDataUrl',
  'uploadedAt',
  'courseFileId',
  'legacyPayload',
]);

const validateInstitution = (value: unknown): unknown => {
  const source = asRecord('institution', value, 'institution');
  rejectUnknownKeys('institution', source, INSTITUTION_KEYS, 'institution');
  for (const key of INSTITUTION_KEYS) asString('institution', source[key], `institution.${key}`);
  return value;
};

const validateCourseInfo = (value: unknown): unknown => {
  const source = asRecord('courseInfo', value, 'courseInfo');
  rejectUnknownKeys('courseInfo', source, COURSE_INFO_KEYS, 'courseInfo');
  for (const key of COURSE_INFO_KEYS) asString('courseInfo', source[key], `courseInfo.${key}`);
  return value;
};

const validateFaculty = (value: unknown): unknown => {
  const entries = asRecordList('faculty', value, 'faculty');
  entries.forEach((entry, index) => {
    const path = `faculty[${index}]`;
    rejectUnknownKeys('faculty', entry, FACULTY_KEYS, path);
    asString('faculty', entry.name, `${path}.name`);
    asString('faculty', entry.consultation, `${path}.consultation`);
    const sections = asRecordList('faculty', entry.sections, `${path}.sections`);
    sections.forEach((section, sectionIndex) => {
      const sectionPath = `${path}.sections[${sectionIndex}]`;
      rejectUnknownKeys('faculty', section, FACULTY_SECTION_KEYS, sectionPath);
      asString('faculty', section.section, `${sectionPath}.section`);
      asString('faculty', section.schedule, `${sectionPath}.schedule`);
      asString('faculty', section.room, `${sectionPath}.room`);
    });
  });
  return value;
};

const validateInstitutionalStatements = (value: unknown): unknown => {
  const source = asRecord('institutionalStatements', value, 'institutionalStatements');
  rejectUnknownKeys('institutionalStatements', source, STATEMENTS_KEYS, 'institutionalStatements');
  for (const key of ['philosophy', 'vision', 'mission', 'goal'] as const) {
    asString('institutionalStatements', source[key], `institutionalStatements.${key}`);
  }
  const coreValues = asRecordList(
    'institutionalStatements',
    source.coreValues,
    'institutionalStatements.coreValues',
  );
  coreValues.forEach((entry, index) => {
    const path = `institutionalStatements.coreValues[${index}]`;
    rejectUnknownKeys('institutionalStatements', entry, CORE_VALUE_KEYS, path);
    asString('institutionalStatements', entry.acronym, `${path}.acronym`);
    asString('institutionalStatements', entry.keyword, `${path}.keyword`);
    asString('institutionalStatements', entry.description, `${path}.description`);
  });
  const attributes = asRecordList(
    'institutionalStatements',
    source.graduateAttributes,
    'institutionalStatements.graduateAttributes',
  );
  attributes.forEach((entry, index) => {
    const path = `institutionalStatements.graduateAttributes[${index}]`;
    rejectUnknownKeys('institutionalStatements', entry, GRADUATE_ATTRIBUTE_KEYS, path);
    asNonNegativeInt('institutionalStatements', entry.number, `${path}.number`);
    asString('institutionalStatements', entry.title, `${path}.title`);
    asString('institutionalStatements', entry.description, `${path}.description`);
  });
  return value;
};

const validateProgramOutcomes = (value: unknown): unknown => {
  const entries = asRecordList('programOutcomes', value, 'programOutcomes');
  entries.forEach((entry, index) => {
    const path = `programOutcomes[${index}]`;
    rejectUnknownKeys('programOutcomes', entry, PROGRAM_OUTCOME_KEYS, path);
    asNonNegativeInt('programOutcomes', entry.number, `${path}.number`);
    asString('programOutcomes', entry.description, `${path}.description`);
  });
  return value;
};

const validateCourseOutcomes = (value: unknown): unknown => {
  const entries = asRecordList('courseOutcomes', value, 'courseOutcomes');
  entries.forEach((entry, index) => {
    const path = `courseOutcomes[${index}]`;
    rejectUnknownKeys('courseOutcomes', entry, COURSE_OUTCOME_KEYS, path);
    asNonNegativeInt('courseOutcomes', entry.number, `${path}.number`);
    asString('courseOutcomes', entry.statement, `${path}.statement`);
  });
  return value;
};

const asRequirementList = (value: unknown, path: string): void => {
  if (!Array.isArray(value)) fail('requirements', `${path} must be an array.`);
  for (const entry of value as unknown[]) {
    if (typeof entry === 'string') continue;
    if (isRecord(entry) && typeof entry.text === 'string') continue;
    fail('requirements', `${path} must contain strings or { text } objects.`);
  }
};

const validateRequirements = (value: unknown): unknown => {
  const source = asRecord('requirements', value, 'requirements');
  rejectUnknownKeys('requirements', source, REQUIREMENTS_KEYS, 'requirements');
  asRequirementList(source.major, 'requirements.major');
  asRequirementList(source.other, 'requirements.other');
  return value;
};

const validateGradingSystem = (value: unknown): unknown => {
  const source = asRecord('gradingSystem', value, 'gradingSystem');
  rejectUnknownKeys('gradingSystem', source, GRADING_KEYS, 'gradingSystem');
  asString('gradingSystem', source.termFormula, 'gradingSystem.termFormula');
  asString('gradingSystem', source.finalFormula, 'gradingSystem.finalFormula');
  asStringList('gradingSystem', source.classStandingComponents, 'gradingSystem.classStandingComponents');
  asString('gradingSystem', source.passingGrade, 'gradingSystem.passingGrade');
  return value;
};

const validateRubrics = (value: unknown): unknown => {
  const entries = asRecordList('rubrics', value, 'rubrics');
  entries.forEach((entry, index) => {
    const path = `rubrics[${index}]`;
    rejectUnknownKeys('rubrics', entry, RUBRIC_KEYS, path);
    asString('rubrics', entry.category, `${path}.category`);
    const levels = asRecord('rubrics', entry.levels, `${path}.levels`);
    for (const level of ['1', '2', '3', '4']) {
      asString('rubrics', levels[level], `${path}.levels.${level}`);
    }
    for (const key of Object.keys(levels)) {
      if (!['1', '2', '3', '4'].includes(key)) fail('rubrics', `${path}.levels has an unknown level '${key}'.`);
    }
  });
  return value;
};

const validatePolicies = (value: unknown): unknown => {
  asStringList('policies', value, 'policies');
  return value;
};

const validateOutline = (value: unknown): unknown => {
  const entries = asRecordList('outline', value, 'outline');
  entries.forEach((entry, index) => {
    const path = `outline[${index}]`;
    rejectUnknownKeys('outline', entry, OUTLINE_KEYS, path);
    asString('outline', entry.timeFrame, `${path}.timeFrame`);
    asString('outline', entry.title, `${path}.title`);
    asStringList('outline', entry.topics, `${path}.topics`);
  });
  return value;
};

const validateLearningPlan = (value: unknown): unknown => {
  const entries = asRecordList('learningPlan', value, 'learningPlan');
  entries.forEach((entry, index) => {
    const path = `learningPlan[${index}]`;
    rejectUnknownKeys('learningPlan', entry, LEARNING_PLAN_KEYS, path);
    asString('learningPlan', entry.week, `${path}.week`);
    asNonNegativeNumber('learningPlan', entry.hoursLab, `${path}.hoursLab`);
    asNonNegativeNumber('learningPlan', entry.hoursLec, `${path}.hoursLec`);
    for (const key of ['learningOutcomes', 'topics', 'methodology', 'resources', 'assessment'] as const) {
      asStringList('learningPlan', entry[key], `${path}.${key}`);
    }
    if (entry.sdgCoherence !== undefined) {
      const sdg = asRecord('learningPlan', entry.sdgCoherence, `${path}.sdgCoherence`);
      rejectUnknownKeys('learningPlan', sdg, SDG_KEYS, `${path}.sdgCoherence`);
      asString('learningPlan', sdg.goal, `${path}.sdgCoherence.goal`);
      asString('learningPlan', sdg.title, `${path}.sdgCoherence.title`);
      asString('learningPlan', sdg.description, `${path}.sdgCoherence.description`);
      if (sdg.target !== undefined) asString('learningPlan', sdg.target, `${path}.sdgCoherence.target`);
    }
  });
  return value;
};

const COURSE_MAP_LEVELS = new Set(['I', 'P', 'D', '']);

const validateCourseMap = (value: unknown): unknown => {
  const entries = asRecordList('courseMap', value, 'courseMap');
  entries.forEach((entry, index) => {
    const path = `courseMap[${index}]`;
    rejectUnknownKeys('courseMap', entry, COURSE_MAP_KEYS, path);
    asNonNegativeInt('courseMap', entry.coNumber, `${path}.coNumber`);
    asString('courseMap', entry.coStatement, `${path}.coStatement`);
    const alignments = entry.poAlignments;
    if (Array.isArray(alignments)) {
      for (const link of alignments) {
        if (!isRecord(link)) fail('courseMap', `${path}.poAlignments must map program outcomes to levels.`);
        asNonNegativeInt('courseMap', link.programOutcomeNumber, `${path}.poAlignments.programOutcomeNumber`);
        if (typeof link.level !== 'string' || !COURSE_MAP_LEVELS.has(link.level)) {
          fail('courseMap', `${path}.poAlignments.level must be one of I, P, D.`);
        }
      }
    } else if (isRecord(alignments)) {
      for (const [key, level] of Object.entries(alignments)) {
        if (!/^\d+$/.test(key)) fail('courseMap', `${path}.poAlignments has an invalid program outcome key '${key}'.`);
        if (typeof level !== 'string' || !COURSE_MAP_LEVELS.has(level)) {
          fail('courseMap', `${path}.poAlignments[${key}] must be one of I, P, D or empty.`);
        }
      }
    } else {
      fail('courseMap', `${path}.poAlignments must be an object or an array.`);
    }
  });
  return value;
};

const validateReferences = (value: unknown): unknown => {
  const entries = asRecordList('references', value, 'references');
  entries.forEach((entry, index) => {
    const path = `references[${index}]`;
    rejectUnknownKeys('references', entry, REFERENCE_KEYS, path);
    asString('references', entry.citation, `${path}.citation`);
    asString('references', entry.year, `${path}.year`);
    if (entry.doiOrPublisher !== undefined) {
      asString('references', entry.doiOrPublisher, `${path}.doiOrPublisher`);
    }
  });
  return value;
};

const SIGNATORY_ROLES = new Set(['prepared', 'recommendingApproval', 'approved']);

const validateSignatories = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const entries = asRecordList('signatories', value, 'signatories');
    for (const [index, entry] of entries.entries()) {
      const path = `signatories[${index}]`;
      rejectUnknownKeys('signatories', entry, SIGNATORY_ROW_KEYS, path);
      if (typeof entry.role !== 'string' || !SIGNATORY_ROLES.has(entry.role)) {
        fail('signatories', `${path}.role must be one of prepared, recommendingApproval, approved.`);
      }
      asString('signatories', entry.name, `${path}.name`);
      asString('signatories', entry.title, `${path}.title`);
    }
    return value;
  }
  const source = asRecord('signatories', value, 'signatories');
  rejectUnknownKeys('signatories', source, SIGNATORIES_KEYS, 'signatories');
  const prepared = asRecordList('signatories', source.preparedBy, 'signatories.preparedBy');
  prepared.forEach((entry, index) => {
    const path = `signatories.preparedBy[${index}]`;
    rejectUnknownKeys('signatories', entry, SIGNATORY_KEYS, path);
    asString('signatories', entry.name, `${path}.name`);
    asString('signatories', entry.title, `${path}.title`);
  });
  for (const key of ['recommendingApproval', 'approved'] as const) {
    const entry = asRecord('signatories', source[key], `signatories.${key}`);
    rejectUnknownKeys('signatories', entry, SIGNATORY_KEYS, `signatories.${key}`);
    asString('signatories', entry.name, `signatories.${key}.name`);
    asString('signatories', entry.title, `signatories.${key}.title`);
  }
  return value;
};

const validateSourceDocument = (value: unknown): unknown => {
  if (value === null) return value;
  const source = asRecord('sourceDocument', value, 'sourceDocument');
  rejectUnknownKeys('sourceDocument', source, SOURCE_DOCUMENT_KEYS, 'sourceDocument');
  asString('sourceDocument', source.fileName, 'sourceDocument.fileName');
  asString('sourceDocument', source.fileSize, 'sourceDocument.fileSize');
  if (source.fileType !== 'pdf' && source.fileType !== 'docx') {
    fail('sourceDocument', 'sourceDocument.fileType must be pdf or docx.');
  }
  asString('sourceDocument', source.uploadedAt, 'sourceDocument.uploadedAt');
  if (source.fileDataUrl !== undefined) asString('sourceDocument', source.fileDataUrl, 'sourceDocument.fileDataUrl');
  if (source.courseFileId !== undefined) asString('sourceDocument', source.courseFileId, 'sourceDocument.courseFileId');
  return value;
};

export function validateSectionPayload(section: SyllabusSectionKey, value: unknown): unknown {
  switch (section) {
    case 'institution':
      return validateInstitution(value);
    case 'courseInfo':
      return validateCourseInfo(value);
    case 'faculty':
      return validateFaculty(value);
    case 'institutionalStatements':
      return validateInstitutionalStatements(value);
    case 'programOutcomes':
      return validateProgramOutcomes(value);
    case 'courseOutcomes':
      return validateCourseOutcomes(value);
    case 'requirements':
      return validateRequirements(value);
    case 'gradingSystem':
      return validateGradingSystem(value);
    case 'rubrics':
      return validateRubrics(value);
    case 'policies':
      return validatePolicies(value);
    case 'outline':
      return validateOutline(value);
    case 'learningPlan':
      return validateLearningPlan(value);
    case 'courseMap':
      return validateCourseMap(value);
    case 'references':
      return validateReferences(value);
    case 'signatories':
      return validateSignatories(value);
    case 'sourceDocument':
      return validateSourceDocument(value);
    default:
      throw new SyllabusValidationError(`Unknown syllabus section: ${String(section)}.`);
  }
}

export function parseExpectedRowVersion(req: Request): number {
  const header = req.headers['if-match'];
  const rawHeader = Array.isArray(header) ? header[0] : header;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const raw = rawHeader ?? body.expectedRowVersion ?? body.rowVersion;
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : '';
  const cleaned = text.replace(/^W\//, '').replace(/^"|"$/g, '').trim();
  const parsed = cleaned === '' ? NaN : Number(cleaned);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new SyllabusValidationError(
      'Expected row version must be a non-negative integer (If-Match or expectedRowVersion).',
    );
  }
  return parsed;
}
