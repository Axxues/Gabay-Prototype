import { normalizeSyllabus } from '../utils/syllabusNormalization.js';
import type {
  CourseMapLevel,
  RequirementCategory,
  SyllabusCourseInfoRow,
  SyllabusCourseMapLinkRow,
  SyllabusCourseMapRow,
  SyllabusCourseOutcomeRow,
  SyllabusCoreValueRow,
  SyllabusDocument,
  SyllabusExtensionField,
  SyllabusFacultyRow,
  SyllabusGradingSystemRow,
  SyllabusGraduateAttributeRow,
  SyllabusInstitutionalStatementsRow,
  SyllabusLearningPlanRow,
  SyllabusLearningPlanTextRow,
  SyllabusOutlineBlockRow,
  SyllabusProgramOutcomeRow,
  SyllabusReferenceRow,
  SyllabusRequirementsRow,
  SyllabusRubricRow,
  SyllabusSectionKey,
  SyllabusSignatoryRow,
  SyllabusSourceDocument,
  SyllabusSourceDocumentRow,
  SyllabusWriteModel,
} from './contracts.js';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecords = (value: unknown): UnknownRecord[] => asList(value).filter(isRecord);

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const asTextList = (value: unknown): string[] =>
  asList(value).filter((entry): entry is string => typeof entry === 'string');

const isSafeKey = (key: string): boolean =>
  key !== '__proto__' && key !== 'constructor' && key !== 'prototype';

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!isRecord(value)) return value;
  const result: UnknownRecord = {};
  for (const key of Object.keys(value)) {
    if (!isSafeKey(key)) continue;
    result[key] = cloneValue(value[key]);
  }
  return result;
};

const textRows = (value: unknown): SyllabusLearningPlanTextRow[] =>
  asList(value).map((entry, position) => ({
    text: asText(typeof entry === 'object' && entry !== null && 'text' in entry ? entry.text : entry),
    position,
  }));

const textValues = (value: unknown): string[] =>
  asList(value).map((entry) =>
    asText(typeof entry === 'object' && entry !== null && 'text' in entry ? entry.text : entry),
  );

const mapInstitution = (value: unknown) => {
  const source = asRecord(value);
  return {
    university: asText(source.university),
    college: asText(source.college),
    formCode: asText(source.formCode),
    revision: asText(source.revision),
  };
};

const mapCourseInfo = (value: unknown): SyllabusCourseInfoRow => {
  const source = asRecord(value);
  return {
    code: asText(source.code),
    title: asText(source.title),
    semester: asText(source.semester),
    academicYear: asText(source.academicYear),
    type: asText(source.type),
    credit: asText(source.credit),
    lectureHours: asText(source.lectureHours),
    labHours: asText(source.labHours),
    prerequisite: asText(source.prerequisite),
    description: asText(source.description),
  };
};

const mapFaculty = (value: unknown): SyllabusFacultyRow[] =>
  asRecords(value).map((source, position) => ({
    name: asText(source.name),
    sections: asRecords(source.sections).map((section, sectionPosition) => ({
      section: asText(section.section),
      schedule: asText(section.schedule),
      room: asText(section.room),
      position: sectionPosition,
    })),
    consultation: asText(source.consultation),
    position,
  }));

const mapCoreValues = (value: unknown): SyllabusCoreValueRow[] =>
  asRecords(value).map((source, position) => ({
    acronym: asText(source.acronym),
    keyword: asText(source.keyword),
    description: asText(source.description),
    position,
  }));

const mapGraduateAttributes = (value: unknown): SyllabusGraduateAttributeRow[] =>
  asRecords(value).map((source, position) => ({
    number: asNumber(source.number),
    title: asText(source.title),
    description: asText(source.description),
    position,
  }));

const mapInstitutionalStatements = (value: unknown): SyllabusInstitutionalStatementsRow => {
  const source = asRecord(value);
  return {
    philosophy: asText(source.philosophy),
    vision: asText(source.vision),
    mission: asText(source.mission),
    goal: asText(source.goal),
    coreValues: mapCoreValues(source.coreValues),
    graduateAttributes: mapGraduateAttributes(source.graduateAttributes),
  };
};

const mapProgramOutcomes = (value: unknown): SyllabusProgramOutcomeRow[] =>
  asRecords(value).map((source, position) => ({
    number: asNumber(source.number),
    description: asText(source.description),
    position,
  }));

const mapCourseOutcomes = (value: unknown): SyllabusCourseOutcomeRow[] =>
  asRecords(value).map((source, position) => ({
    number: asNumber(source.number),
    statement: asText(source.statement),
    position,
  }));

const mapRequirements = (value: unknown): SyllabusRequirementsRow => {
  const source = asRecord(value);
  const mapCategory = (entries: unknown, category: RequirementCategory) =>
    textRows(entries).map((entry) => ({ category, text: entry.text, position: entry.position }));
  return {
    major: mapCategory(source.major, 'major'),
    other: mapCategory(source.other, 'other'),
  };
};

const mapGradingSystem = (value: unknown): SyllabusGradingSystemRow => {
  const source = asRecord(value);
  return {
    termFormula: asText(source.termFormula),
    finalFormula: asText(source.finalFormula),
    classStandingComponents: textRows(source.classStandingComponents),
    passingGrade: asText(source.passingGrade),
  };
};

const mapRubrics = (value: unknown): SyllabusRubricRow[] =>
  asRecords(value).map((source, position) => {
    const sourceLevels = asRecord(source.levels);
    const levels = {
      1: asText(sourceLevels['1']),
      2: asText(sourceLevels['2']),
      3: asText(sourceLevels['3']),
      4: asText(sourceLevels['4']),
    };
    return {
      category: asText(source.category),
      position,
      levels,
      levelRows: [1, 2, 3, 4].map((level) => ({
        level: level as 1 | 2 | 3 | 4,
        description: levels[level as keyof typeof levels],
      })),
    };
  });

const mapOutline = (value: unknown): SyllabusOutlineBlockRow[] =>
  asRecords(value).map((source, position) => ({
    timeFrame: asText(source.timeFrame),
    title: asText(source.title),
    position,
    topics: textRows(source.topics).map((topic) => ({
      text: topic.text,
      position: topic.position,
    })),
  }));

const mapSdgCoherence = (value: unknown) => {
  const source = asRecord(value);
  if (!isRecord(value)) return undefined;
  const result: {
    goal: string;
    title: string;
    description: string;
    target?: string;
  } = {
    goal: asText(source.goal),
    title: asText(source.title),
    description: asText(source.description),
  };
  if (typeof source.target === 'string') result.target = source.target;
  return result;
};

const mapLearningPlan = (value: unknown): SyllabusLearningPlanRow[] =>
  asRecords(value).map((source, position) => {
    const sdgCoherence = mapSdgCoherence(source.sdgCoherence);
    return {
      week: asText(source.week),
      hoursLab: asNumber(source.hoursLab),
      hoursLec: asNumber(source.hoursLec),
      position,
      learningOutcomes: textRows(source.learningOutcomes),
      topics: textRows(source.topics),
      methodology: textRows(source.methodology),
      resources: textRows(source.resources),
      assessment: textRows(source.assessment),
      ...(sdgCoherence ? { sdgCoherence } : {}),
    };
  });

const mapCourseMap = (value: unknown): SyllabusCourseMapRow[] =>
  asRecords(value).map((source, position) => {
    const alignmentEntries: Array<{ key: string; level: unknown }> = Array.isArray(source.poAlignments)
      ? asRecords(source.poAlignments).map((entry) => ({
          key: String(asNumber(entry.programOutcomeNumber)),
          level: entry.level,
        }))
      : Object.entries(asRecord(source.poAlignments)).map(([key, level]) => ({ key, level }));
    const keys = alignmentEntries
      .filter(({ key, level }) => /^\d+$/.test(key) && ['I', 'P', 'D', ''].includes(asText(level)))
      .sort((left, right) => {
        const numericOrder = Number(left.key) - Number(right.key);
        return numericOrder === 0 ? left.key.localeCompare(right.key) : numericOrder;
      });
    const links: SyllabusCourseMapLinkRow[] = [];
    for (const { key, level } of keys) {
      if (level !== 'I' && level !== 'P' && level !== 'D') continue;
      links.push({
        programOutcomeNumber: Number(key),
        level,
        position: links.length,
      });
    }
    return {
      coNumber: asNumber(source.coNumber),
      coStatement: asText(source.coStatement),
      position,
      poAlignments: links,
    };
  });

const mapReferences = (value: unknown): SyllabusReferenceRow[] =>
  asRecords(value).map((source, position) => {
    const result: SyllabusReferenceRow = {
      citation: asText(source.citation),
      year: asText(source.year),
      position,
    };
    if (typeof source.doiOrPublisher === 'string') result.doiOrPublisher = source.doiOrPublisher;
    return result;
  });

const mapSignatories = (value: unknown): SyllabusSignatoryRow[] => {
  if (Array.isArray(value)) {
    return asRecords(value).map((source, position) => ({
      name: asText(source.name),
      title: asText(source.title),
      role: asText(source.role) as SyllabusSignatoryRow['role'],
      position,
    }));
  }
  const source = asRecord(value);
  const prepared = asRecords(source.preparedBy).map((entry, position) => ({
    name: asText(entry.name),
    title: asText(entry.title),
    role: 'prepared' as const,
    position,
  }));
  const recommending = asRecord(source.recommendingApproval);
  const approved = asRecord(source.approved);
  return [
    ...prepared,
    {
      name: asText(recommending.name),
      title: asText(recommending.title),
      role: 'recommendingApproval' as const,
      position: prepared.length,
    },
    {
      name: asText(approved.name),
      title: asText(approved.title),
      role: 'approved' as const,
      position: prepared.length + 1,
    },
  ];
};

const mapSourceDocument = (value: unknown): SyllabusSourceDocumentRow | null => {
  if (!isRecord(value)) return null;
  const result: SyllabusSourceDocumentRow = {
    fileName: asText(value.fileName),
    fileSize: asText(value.fileSize),
    fileType: value.fileType === 'docx' ? 'docx' : 'pdf',
    uploadedAt: asText(value.uploadedAt),
  };
  if (typeof value.fileDataUrl === 'string') result.fileDataUrl = value.fileDataUrl;
  if (typeof value.courseFileId === 'string') result.courseFileId = value.courseFileId;
  if (Object.prototype.hasOwnProperty.call(value, 'legacyPayload')) {
    result.legacyPayload = cloneValue(value.legacyPayload);
  }
  return result;
};

const documentSourceDocument = (
  value: SyllabusSourceDocumentRow | null,
): SyllabusSourceDocument | undefined => {
  if (!value) return undefined;
  const result: SyllabusSourceDocument = {
    fileName: asText(value.fileName),
    fileSize: asText(value.fileSize),
    fileType: value.fileType === 'docx' ? 'docx' : 'pdf',
    uploadedAt: asText(value.uploadedAt),
  };
  if (typeof value.fileDataUrl === 'string') result.fileDataUrl = value.fileDataUrl;
  if (typeof value.courseFileId === 'string') result.courseFileId = value.courseFileId;
  return result;
};

const mapPolicyRows = (value: unknown) => textRows(value).map((entry) => ({ text: entry.text, position: entry.position }));

const topLevelKnownKeys = new Set([
  'courseId',
  'institution',
  'courseInfo',
  'facultyMembers',
  'institutionalStatements',
  'programOutcomes',
  'courseOutcomes',
  'courseRequirements',
  'gradingSystem',
  'projectRubrics',
  'classroomPolicies',
  'courseOutline',
  'learningPlan',
  'courseMap',
  'references',
  'signatories',
  'sourceDocument',
  'extensions',
]);

const institutionKnownKeys = new Set(['university', 'college', 'formCode', 'revision']);
const courseInfoKnownKeys = new Set([
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
const facultyKnownKeys = new Set(['name', 'sections', 'consultation']);
const facultySectionKnownKeys = new Set(['section', 'schedule', 'room']);
const coreValueKnownKeys = new Set(['acronym', 'keyword', 'description']);
const graduateAttributeKnownKeys = new Set(['number', 'title', 'description']);
const institutionalKnownKeys = new Set([
  'philosophy',
  'vision',
  'mission',
  'goal',
  'coreValues',
  'graduateAttributes',
]);
const programOutcomeKnownKeys = new Set(['number', 'description']);
const courseOutcomeKnownKeys = new Set(['number', 'statement']);
const requirementsKnownKeys = new Set(['major', 'other']);
const gradingKnownKeys = new Set(['termFormula', 'finalFormula', 'classStandingComponents', 'passingGrade']);
const rubricKnownKeys = new Set(['category', 'levels']);
const outlineKnownKeys = new Set(['timeFrame', 'title', 'topics']);
const learningPlanKnownKeys = new Set([
  'week',
  'hoursLab',
  'hoursLec',
  'learningOutcomes',
  'topics',
  'methodology',
  'resources',
  'assessment',
  'sdgCoherence',
]);
const sdgKnownKeys = new Set(['goal', 'title', 'description', 'target']);
const courseMapKnownKeys = new Set(['coNumber', 'coStatement', 'poAlignments']);
const referenceKnownKeys = new Set(['citation', 'year', 'doiOrPublisher']);
const signatoryKnownKeys = new Set(['name', 'title']);
const signatoriesKnownKeys = new Set(['preparedBy', 'recommendingApproval', 'approved']);
const sourceDocumentKnownKeys = new Set([
  'fileName',
  'fileSize',
  'fileType',
  'fileDataUrl',
  'uploadedAt',
  'courseFileId',
  'legacyPayload',
]);

const addUnknownFields = (
  extensions: SyllabusExtensionField[],
  value: unknown,
  path: string,
  knownKeys: ReadonlySet<string>,
): void => {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!isSafeKey(key) || knownKeys.has(key)) continue;
    const childPath = `${path}.${key}`;
    extensions.push({ path: childPath, value: cloneValue(value[key]) });
  }
};

const collectExtensions = (value: UnknownRecord): SyllabusExtensionField[] => {
  const extensions: SyllabusExtensionField[] = [];
  addUnknownFields(extensions, value, '$', topLevelKnownKeys);
  const extensionValue = value.extensions;
  if (isRecord(extensionValue)) {
    for (const key of Object.keys(extensionValue).sort()) {
      if (!isSafeKey(key)) continue;
      const path = `$.extensions.${key}`;
      extensions.push({ path, value: cloneValue(extensionValue[key]) });
    }
  } else if (Object.prototype.hasOwnProperty.call(value, 'extensions')) {
    extensions.push({ path: '$.extensions', value: cloneValue(extensionValue) });
  }

  addUnknownFields(extensions, value.institution, '$.institution', institutionKnownKeys);
  addUnknownFields(extensions, value.courseInfo, '$.courseInfo', courseInfoKnownKeys);

  asRecords(value.facultyMembers).forEach((faculty, index) => {
    const facultyPath = `$.facultyMembers[${index}]`;
    addUnknownFields(extensions, faculty, facultyPath, facultyKnownKeys);
    asRecords(faculty.sections).forEach((section, sectionIndex) => {
      addUnknownFields(extensions, section, `${facultyPath}.sections[${sectionIndex}]`, facultySectionKnownKeys);
    });
  });

  const statements = asRecord(value.institutionalStatements);
  addUnknownFields(extensions, statements, '$.institutionalStatements', institutionalKnownKeys);
  asRecords(statements.coreValues).forEach((entry, index) => {
    addUnknownFields(extensions, entry, `$.institutionalStatements.coreValues[${index}]`, coreValueKnownKeys);
  });
  asRecords(statements.graduateAttributes).forEach((entry, index) => {
    addUnknownFields(
      extensions,
      entry,
      `$.institutionalStatements.graduateAttributes[${index}]`,
      graduateAttributeKnownKeys,
    );
  });

  asRecords(value.programOutcomes).forEach((entry, index) => {
    addUnknownFields(extensions, entry, `$.programOutcomes[${index}]`, programOutcomeKnownKeys);
  });
  asRecords(value.courseOutcomes).forEach((entry, index) => {
    addUnknownFields(extensions, entry, `$.courseOutcomes[${index}]`, courseOutcomeKnownKeys);
  });
  addUnknownFields(extensions, value.courseRequirements, '$.courseRequirements', requirementsKnownKeys);
  addUnknownFields(extensions, value.gradingSystem, '$.gradingSystem', gradingKnownKeys);

  asRecords(value.projectRubrics).forEach((entry, index) => {
    addUnknownFields(extensions, entry, `$.projectRubrics[${index}]`, rubricKnownKeys);
  });

  asRecords(value.courseOutline).forEach((entry, index) => {
    addUnknownFields(extensions, entry, `$.courseOutline[${index}]`, outlineKnownKeys);
  });
  asRecords(value.learningPlan).forEach((entry, index) => {
    const learningPlanPath = `$.learningPlan[${index}]`;
    addUnknownFields(extensions, entry, learningPlanPath, learningPlanKnownKeys);
    addUnknownFields(extensions, entry.sdgCoherence, `${learningPlanPath}.sdgCoherence`, sdgKnownKeys);
  });
  asRecords(value.courseMap).forEach((entry, index) => {
    addUnknownFields(extensions, entry, `$.courseMap[${index}]`, courseMapKnownKeys);
  });
  asRecords(value.references).forEach((entry, index) => {
    addUnknownFields(extensions, entry, `$.references[${index}]`, referenceKnownKeys);
  });
  const signatories = asRecord(value.signatories);
  addUnknownFields(extensions, signatories, '$.signatories', signatoriesKnownKeys);
  asRecords(signatories.preparedBy).forEach((entry, index) => {
    addUnknownFields(extensions, entry, `$.signatories.preparedBy[${index}]`, signatoryKnownKeys);
  });
  addUnknownFields(extensions, signatories.recommendingApproval, '$.signatories.recommendingApproval', signatoryKnownKeys);
  addUnknownFields(extensions, signatories.approved, '$.signatories.approved', signatoryKnownKeys);
  addUnknownFields(extensions, value.sourceDocument, '$.sourceDocument', sourceDocumentKnownKeys);

  const unique = new Map<string, SyllabusExtensionField>();
  for (const extension of extensions) unique.set(extension.path, extension);
  return [...unique.values()].sort((left, right) => left.path.localeCompare(right.path));
};

const mapSectionValue = (section: SyllabusSectionKey, value: unknown): unknown => {
  switch (section) {
    case 'institution':
      return mapInstitution(value);
    case 'courseInfo':
      return mapCourseInfo(value);
    case 'faculty':
      return mapFaculty(value);
    case 'institutionalStatements':
      return mapInstitutionalStatements(value);
    case 'programOutcomes':
      return mapProgramOutcomes(value);
    case 'courseOutcomes':
      return mapCourseOutcomes(value);
    case 'requirements':
      return mapRequirements(value);
    case 'gradingSystem':
      return mapGradingSystem(value);
    case 'rubrics':
      return mapRubrics(value);
    case 'policies':
      return asTextList(value);
    case 'outline':
      return mapOutline(value);
    case 'learningPlan':
      return mapLearningPlan(value);
    case 'courseMap':
      return mapCourseMap(value);
    case 'references':
      return mapReferences(value);
    case 'signatories':
      return mapSignatories(value);
    case 'sourceDocument':
      return mapSourceDocument(value);
  }
};

const mapPolicyValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return textValues(value);
  return [];
};

const modelToCourseMapAlignments = (
  value: unknown,
  catalogNumbers: number[],
): Record<number, CourseMapLevel | ''> => {
  const keys = new Set(catalogNumbers);
  const links: Array<{ key: number; level: CourseMapLevel }> = [];
  if (Array.isArray(value)) {
    for (const entry of asRecords(value)) {
      const key = asNumber(entry.programOutcomeNumber);
      keys.add(key);
      if (entry.level === 'I' || entry.level === 'P' || entry.level === 'D') {
        links.push({ key, level: entry.level });
      }
    }
  } else if (isRecord(value)) {
    for (const [key, level] of Object.entries(value)) {
      if (!/^\d+$/.test(key)) continue;
      const numericKey = Number(key);
      keys.add(numericKey);
      if (level === 'I' || level === 'P' || level === 'D') {
        links.push({ key: numericKey, level });
      }
    }
  }
  const result: Record<number, CourseMapLevel | ''> = {};
  for (const key of [...keys].sort((left, right) => left - right)) result[key] = '';
  for (const link of links.sort((left, right) => left.key - right.key)) result[link.key] = link.level;
  return result;
};

const modelToSignatories = (value: unknown) => {
  if (!Array.isArray(value)) {
    const source = asRecord(value);
    return {
      preparedBy: asRecords(source.preparedBy).map((entry) => ({
        name: asText(entry.name),
        title: asText(entry.title),
      })),
      recommendingApproval: {
        name: asText(asRecord(source.recommendingApproval).name),
        title: asText(asRecord(source.recommendingApproval).title),
      },
      approved: {
        name: asText(asRecord(source.approved).name),
        title: asText(asRecord(source.approved).title),
      },
    };
  }
  const rows = asRecords(value);
  const preparedBy = rows
    .filter((entry) => asText(entry.role) === 'prepared')
    .map((entry) => ({ name: asText(entry.name), title: asText(entry.title) }));
  const findRole = (role: string) => {
    const entry = rows.find((candidate) => asText(candidate.role) === role);
    return { name: asText(entry?.name), title: asText(entry?.title) };
  };
  return {
    preparedBy,
    recommendingApproval: findRole('recommendingApproval'),
    approved: findRole('approved'),
  };
};

export function mapLegacyToWriteModel(input: unknown, revisionId: string, courseId: string): SyllabusWriteModel {
  const normalized = normalizeSyllabus(input);
  const source = normalized as UnknownRecord;
  const policies = asTextList(source.classroomPolicies);
  return {
    id: revisionId,
    courseId,
    revisionNo: 1,
    status: 'draft',
    schemaVersion: '1',
    rowVersion: 1,
    createdAt: '',
    updatedAt: '',
    publishedAt: null,
    institution: mapInstitution(source.institution),
    courseInfo: mapCourseInfo(source.courseInfo),
    facultyMembers: mapFaculty(source.facultyMembers),
    institutionalStatements: mapInstitutionalStatements(source.institutionalStatements),
    programOutcomes: mapProgramOutcomes(source.programOutcomes),
    courseOutcomes: mapCourseOutcomes(source.courseOutcomes),
    courseRequirements: mapRequirements(source.courseRequirements),
    gradingSystem: mapGradingSystem(source.gradingSystem),
    projectRubrics: mapRubrics(source.projectRubrics),
    policies,
    policyRows: mapPolicyRows(policies),
    courseOutline: mapOutline(source.courseOutline),
    learningPlan: mapLearningPlan(source.learningPlan),
    courseMap: mapCourseMap(source.courseMap),
    references: mapReferences(source.references),
    signatories: mapSignatories(source.signatories),
    sourceDocument: mapSourceDocument(source.sourceDocument),
    extensions: collectExtensions(source),
  };
}

export function mapWriteModelToDocument(model: SyllabusWriteModel): SyllabusDocument {
  const sourceDocument = documentSourceDocument(model.sourceDocument);
  const policies = Array.isArray(model.policies)
    ? textValues(model.policies)
    : mapPolicyValues(model.policyRows);
  const catalogNumbers = asList(model.programOutcomes)
    .map((entry) => asNumber(asRecord(entry).number))
    .filter((number) => Number.isFinite(number));
  const document: SyllabusDocument = {
    courseId: model.courseId,
    institution: {
      university: asText(model.institution?.university),
      college: asText(model.institution?.college),
      formCode: asText(model.institution?.formCode),
      revision: asText(model.institution?.revision),
    },
    courseInfo: {
      code: asText(model.courseInfo?.code),
      title: asText(model.courseInfo?.title),
      semester: asText(model.courseInfo?.semester),
      academicYear: asText(model.courseInfo?.academicYear),
      type: asText(model.courseInfo?.type),
      credit: asText(model.courseInfo?.credit),
      lectureHours: asText(model.courseInfo?.lectureHours),
      labHours: asText(model.courseInfo?.labHours),
      prerequisite: asText(model.courseInfo?.prerequisite),
      description: asText(model.courseInfo?.description),
    },
    facultyMembers: asList(model.facultyMembers).map((entry) => {
      const faculty = asRecord(entry);
      return {
        name: asText(faculty.name),
        sections: asList(faculty.sections).map((sectionValue) => {
          const section = asRecord(sectionValue);
          return {
            section: asText(section.section),
            schedule: asText(section.schedule),
            room: asText(section.room),
          };
        }),
        consultation: asText(faculty.consultation),
      };
    }),
    institutionalStatements: {
      philosophy: asText(model.institutionalStatements?.philosophy),
      vision: asText(model.institutionalStatements?.vision),
      mission: asText(model.institutionalStatements?.mission),
      goal: asText(model.institutionalStatements?.goal),
      coreValues: asList(model.institutionalStatements?.coreValues).map((entry) => {
        const value = asRecord(entry);
        return {
          acronym: asText(value.acronym),
          keyword: asText(value.keyword),
          description: asText(value.description),
        };
      }),
      graduateAttributes: asList(model.institutionalStatements?.graduateAttributes).map((entry) => {
        const value = asRecord(entry);
        return {
          number: asNumber(value.number),
          title: asText(value.title),
          description: asText(value.description),
        };
      }),
    },
    programOutcomes: asList(model.programOutcomes).map((entry) => {
      const value = asRecord(entry);
      return { number: asNumber(value.number), description: asText(value.description) };
    }),
    courseOutcomes: asList(model.courseOutcomes).map((entry) => {
      const value = asRecord(entry);
      return { number: asNumber(value.number), statement: asText(value.statement) };
    }),
    courseRequirements: {
      major: textValues(model.courseRequirements?.major),
      other: textValues(model.courseRequirements?.other),
    },
    gradingSystem: {
      termFormula: asText(model.gradingSystem?.termFormula),
      finalFormula: asText(model.gradingSystem?.finalFormula),
      classStandingComponents: textValues(model.gradingSystem?.classStandingComponents),
      passingGrade: asText(model.gradingSystem?.passingGrade),
    },
    projectRubrics: asList(model.projectRubrics).map((entry) => {
      const rubric = asRecord(entry);
      const levelRows = asRecords(rubric.levelRows);
      const levelDescription = (level: number): string =>
        asText(levelRows.find((row) => asNumber(row.level) === level)?.description);
      return {
        category: asText(rubric.category),
        levels: {
          1: levelDescription(1),
          2: levelDescription(2),
          3: levelDescription(3),
          4: levelDescription(4),
        },
      };
    }),
    classroomPolicies: policies,
    courseOutline: asList(model.courseOutline).map((entry) => {
      const block = asRecord(entry);
      return {
        timeFrame: asText(block.timeFrame),
        title: asText(block.title),
        topics: textValues(block.topics),
      };
    }),
    learningPlan: asList(model.learningPlan).map((entry) => {
      const plan = asRecord(entry);
      const sdg = asRecord(plan.sdgCoherence);
      const sdgResult: { goal: string; title: string; description: string; target?: string } | undefined =
        isRecord(plan.sdgCoherence)
          ? {
              goal: asText(sdg.goal),
              title: asText(sdg.title),
              description: asText(sdg.description),
            }
          : undefined;
      if (sdgResult && typeof sdg.target === 'string') sdgResult.target = sdg.target;
      return {
        week: asText(plan.week),
        hoursLab: asNumber(plan.hoursLab),
        hoursLec: asNumber(plan.hoursLec),
        learningOutcomes: textValues(plan.learningOutcomes),
        topics: textValues(plan.topics),
        methodology: textValues(plan.methodology),
        resources: textValues(plan.resources),
        assessment: textValues(plan.assessment),
        ...(sdgResult ? { sdgCoherence: sdgResult } : {}),
      };
    }),
    courseMap: asList(model.courseMap).map((entry) => {
      const map = asRecord(entry);
      return {
        coNumber: asNumber(map.coNumber),
        coStatement: asText(map.coStatement),
        poAlignments: modelToCourseMapAlignments(map.poAlignments, catalogNumbers),
      };
    }),
    references: asList(model.references).map((entry) => {
      const reference = asRecord(entry);
      const result: { citation: string; year: string; doiOrPublisher?: string } = {
        citation: asText(reference.citation),
        year: asText(reference.year),
      };
      if (typeof reference.doiOrPublisher === 'string') result.doiOrPublisher = reference.doiOrPublisher;
      return result;
    }),
    signatories: modelToSignatories(model.signatories),
  };
  if (sourceDocument) document.sourceDocument = sourceDocument as SyllabusDocument['sourceDocument'];
  return document;
}

export function getSection(model: SyllabusWriteModel, section: SyllabusSectionKey): unknown {
  switch (section) {
    case 'institution':
      return cloneValue(model.institution);
    case 'courseInfo':
      return cloneValue(model.courseInfo);
    case 'faculty':
      return cloneValue(model.facultyMembers);
    case 'institutionalStatements':
      return cloneValue(model.institutionalStatements);
    case 'programOutcomes':
      return cloneValue(model.programOutcomes);
    case 'courseOutcomes':
      return cloneValue(model.courseOutcomes);
    case 'requirements':
      return cloneValue(model.courseRequirements);
    case 'gradingSystem':
      return cloneValue(model.gradingSystem);
    case 'rubrics':
      return cloneValue(model.projectRubrics);
    case 'policies':
      return cloneValue(model.policies);
    case 'outline':
      return cloneValue(model.courseOutline);
    case 'learningPlan':
      return cloneValue(model.learningPlan);
    case 'courseMap':
      return cloneValue(model.courseMap);
    case 'references':
      return cloneValue(model.references);
    case 'signatories':
      return cloneValue(model.signatories);
    case 'sourceDocument':
      return cloneValue(model.sourceDocument);
  }
}

export function replaceSection(
  model: SyllabusWriteModel,
  section: SyllabusSectionKey,
  value: unknown,
): SyllabusWriteModel {
  const next: SyllabusWriteModel = { ...model };
  switch (section) {
    case 'institution':
      next.institution = mapSectionValue(section, value) as typeof next.institution;
      break;
    case 'courseInfo':
      next.courseInfo = mapSectionValue(section, value) as typeof next.courseInfo;
      break;
    case 'faculty':
      next.facultyMembers = mapSectionValue(section, value) as typeof next.facultyMembers;
      break;
    case 'institutionalStatements':
      next.institutionalStatements = mapSectionValue(section, value) as typeof next.institutionalStatements;
      break;
    case 'programOutcomes':
      next.programOutcomes = mapSectionValue(section, value) as typeof next.programOutcomes;
      break;
    case 'courseOutcomes':
      next.courseOutcomes = mapSectionValue(section, value) as typeof next.courseOutcomes;
      break;
    case 'requirements':
      next.courseRequirements = mapSectionValue(section, value) as typeof next.courseRequirements;
      break;
    case 'gradingSystem':
      next.gradingSystem = mapSectionValue(section, value) as typeof next.gradingSystem;
      break;
    case 'rubrics':
      next.projectRubrics = mapSectionValue(section, value) as typeof next.projectRubrics;
      break;
    case 'policies': {
      const policies = mapPolicyValues(value);
      next.policies = policies;
      next.policyRows = mapPolicyRows(policies);
      break;
    }
    case 'outline':
      next.courseOutline = mapSectionValue(section, value) as typeof next.courseOutline;
      break;
    case 'learningPlan':
      next.learningPlan = mapSectionValue(section, value) as typeof next.learningPlan;
      break;
    case 'courseMap':
      next.courseMap = mapSectionValue(section, value) as typeof next.courseMap;
      break;
    case 'references':
      next.references = mapSectionValue(section, value) as typeof next.references;
      break;
    case 'signatories':
      next.signatories = mapSectionValue(section, value) as typeof next.signatories;
      break;
    case 'sourceDocument':
      next.sourceDocument = mapSectionValue(section, value) as typeof next.sourceDocument;
      break;
  }
  return next;
}
