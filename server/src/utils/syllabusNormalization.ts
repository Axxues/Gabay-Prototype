export class SyllabusNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyllabusNormalizationError';
  }
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): JsonRecord => (isRecord(value) ? value : {});

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const textList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

const numberValue = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const recordList = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const appendUnknown = <T extends JsonRecord>(base: T, source: JsonRecord, known: readonly string[]): T => {
  const result: JsonRecord = { ...base };
  for (const key of Object.keys(source).sort()) {
    if (known.includes(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    result[key] = source[key];
  }
  return result as T;
};

const normalizeInstitution = (value: unknown): JsonRecord => {
  const source = asRecord(value);
  return appendUnknown(
    {
      university: text(source.university),
      college: text(source.college),
      formCode: text(source.formCode),
      revision: text(source.revision),
    },
    source,
    ['university', 'college', 'formCode', 'revision'],
  );
};

const normalizeCourseInfo = (value: unknown): JsonRecord => {
  const source = asRecord(value);
  return appendUnknown(
    {
      code: text(source.code),
      title: text(source.title),
      semester: text(source.semester),
      academicYear: text(source.academicYear),
      type: text(source.type),
      credit: text(source.credit),
      lectureHours: text(source.lectureHours),
      labHours: text(source.labHours),
      prerequisite: text(source.prerequisite),
      description: text(source.description),
    },
    source,
    [
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
    ],
  );
};

const normalizeFacultyMembers = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) => {
    const sections = recordList(source.sections).map((section) =>
      appendUnknown(
        {
          section: text(section.section),
          schedule: text(section.schedule),
          room: text(section.room),
        },
        section,
        ['section', 'schedule', 'room'],
      ),
    );
    return appendUnknown(
      {
        name: text(source.name),
        sections,
        consultation: text(source.consultation),
      },
      source,
      ['name', 'sections', 'consultation'],
    );
  });

const normalizeCoreValues = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) =>
    appendUnknown(
      {
        acronym: text(source.acronym),
        keyword: text(source.keyword),
        description: text(source.description),
      },
      source,
      ['acronym', 'keyword', 'description'],
    ),
  );

const normalizeGraduateAttributes = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) =>
    appendUnknown(
      {
        number: numberValue(source.number),
        title: text(source.title),
        description: text(source.description),
      },
      source,
      ['number', 'title', 'description'],
    ),
  );

const normalizeProgramOutcomes = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) =>
    appendUnknown(
      {
        number: numberValue(source.number),
        description: text(source.description),
      },
      source,
      ['number', 'description'],
    ),
  );

const normalizeCourseOutcomes = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) =>
    appendUnknown(
      {
        number: numberValue(source.number),
        statement: text(source.statement),
      },
      source,
      ['number', 'statement'],
    ),
  );

const normalizeInstitutionalStatements = (value: unknown): JsonRecord => {
  const source = asRecord(value);
  return appendUnknown(
    {
      philosophy: text(source.philosophy),
      vision: text(source.vision),
      mission: text(source.mission),
      goal: text(source.goal),
      coreValues: normalizeCoreValues(source.coreValues),
      graduateAttributes: normalizeGraduateAttributes(source.graduateAttributes),
    },
    source,
    ['philosophy', 'vision', 'mission', 'goal', 'coreValues', 'graduateAttributes'],
  );
};

const normalizeCourseRequirements = (value: unknown): JsonRecord => {
  const source = asRecord(value);
  return appendUnknown(
    {
      major: textList(source.major),
      other: textList(source.other),
    },
    source,
    ['major', 'other'],
  );
};

const normalizeGradingSystem = (value: unknown): JsonRecord => {
  const source = asRecord(value);
  return appendUnknown(
    {
      termFormula: text(source.termFormula),
      finalFormula: text(source.finalFormula),
      classStandingComponents: textList(source.classStandingComponents),
      passingGrade: text(source.passingGrade),
    },
    source,
    ['termFormula', 'finalFormula', 'classStandingComponents', 'passingGrade'],
  );
};

const normalizeRubrics = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) => {
    const levels = asRecord(source.levels);
    return appendUnknown(
      {
        category: text(source.category),
        levels: {
          '1': text(levels['1']),
          '2': text(levels['2']),
          '3': text(levels['3']),
          '4': text(levels['4']),
        },
      },
      source,
      ['category', 'levels'],
    );
  });

const normalizeOutline = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) =>
    appendUnknown(
      {
        timeFrame: text(source.timeFrame),
        title: text(source.title),
        topics: textList(source.topics),
      },
      source,
      ['timeFrame', 'title', 'topics'],
    ),
  );

const normalizeSdgCoherence = (value: unknown): JsonRecord | undefined => {
  if (!isRecord(value)) return undefined;
  const result: JsonRecord = {
    goal: text(value.goal),
    title: text(value.title),
    description: text(value.description),
  };
  if (typeof value.target === 'string') result.target = value.target;
  return appendUnknown(result, value, ['goal', 'title', 'description', 'target']);
};

const normalizeLearningPlan = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) => {
    const result: JsonRecord = {
      week: text(source.week),
      hoursLab: numberValue(source.hoursLab),
      hoursLec: numberValue(source.hoursLec),
      learningOutcomes: textList(source.learningOutcomes),
      topics: textList(source.topics),
      methodology: textList(source.methodology),
      resources: textList(source.resources),
      assessment: textList(source.assessment),
    };
    const sdgCoherence = normalizeSdgCoherence(source.sdgCoherence);
    if (sdgCoherence) result.sdgCoherence = sdgCoherence;
    return appendUnknown(result, source, [
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
  });

const normalizeCourseMap = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) => {
    const alignmentsSource = asRecord(source.poAlignments);
    const alignments: Record<string, string> = {};
    for (const [key, entry] of Object.entries(alignmentsSource).sort(([left], [right]) => left.localeCompare(right))) {
      if (/^\d+$/.test(key) && (entry === 'I' || entry === 'P' || entry === 'D' || entry === '')) {
        alignments[key] = entry;
      }
    }
    return appendUnknown(
      {
        coNumber: numberValue(source.coNumber),
        coStatement: text(source.coStatement),
        poAlignments: alignments,
      },
      source,
      ['coNumber', 'coStatement', 'poAlignments'],
    );
  });

const normalizeReferences = (value: unknown): JsonRecord[] =>
  recordList(value).map((source) => {
    const result: JsonRecord = {
      citation: text(source.citation),
      year: text(source.year),
    };
    if (typeof source.doiOrPublisher === 'string') result.doiOrPublisher = source.doiOrPublisher;
    return appendUnknown(result, source, ['citation', 'year', 'doiOrPublisher']);
  });

const normalizeSignatories = (value: unknown): JsonRecord => {
  const source = asRecord(value);
  const normalizeSignatory = (entry: unknown): JsonRecord => {
    const signatory = asRecord(entry);
    return appendUnknown(
      {
        name: text(signatory.name),
        title: text(signatory.title),
      },
      signatory,
      ['name', 'title'],
    );
  };
  return appendUnknown(
    {
      preparedBy: recordList(source.preparedBy).map(normalizeSignatory),
      recommendingApproval: normalizeSignatory(source.recommendingApproval),
      approved: normalizeSignatory(source.approved),
    },
    source,
    ['preparedBy', 'recommendingApproval', 'approved'],
  );
};

const normalizeSourceDocument = (value: unknown): JsonRecord | undefined => {
  if (!isRecord(value)) return undefined;
  const result: JsonRecord = {
    fileName: text(value.fileName),
    fileSize: text(value.fileSize),
    fileType: value.fileType === 'docx' ? 'docx' : 'pdf',
    uploadedAt: text(value.uploadedAt),
  };
  if (typeof value.fileDataUrl === 'string') result.fileDataUrl = value.fileDataUrl;
  return appendUnknown(result, value, ['fileName', 'fileSize', 'fileType', 'uploadedAt', 'fileDataUrl']);
};

const TOP_LEVEL_KEYS = [
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
] as const;

export function normalizeSyllabus(raw: unknown): Record<string, unknown> {
  let value = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) throw new SyllabusNormalizationError('Syllabus must be a non-empty JSON object.');
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      throw new SyllabusNormalizationError('Syllabus contains invalid JSON.');
    }
  }
  if (!isRecord(value)) {
    throw new SyllabusNormalizationError('Syllabus must be a JSON object.');
  }

  const source = value;
  const result: JsonRecord = {};
  if (typeof source.courseId === 'string') result.courseId = source.courseId;
  result.institution = normalizeInstitution(source.institution);
  result.courseInfo = normalizeCourseInfo(source.courseInfo);
  result.facultyMembers = normalizeFacultyMembers(source.facultyMembers);
  result.institutionalStatements = normalizeInstitutionalStatements(source.institutionalStatements);
  result.programOutcomes = normalizeProgramOutcomes(source.programOutcomes);
  result.courseOutcomes = normalizeCourseOutcomes(source.courseOutcomes);
  result.courseRequirements = normalizeCourseRequirements(source.courseRequirements);
  result.gradingSystem = normalizeGradingSystem(source.gradingSystem);
  result.projectRubrics = normalizeRubrics(source.projectRubrics);
  result.classroomPolicies = textList(source.classroomPolicies);
  result.courseOutline = normalizeOutline(source.courseOutline);
  result.learningPlan = normalizeLearningPlan(source.learningPlan);
  result.courseMap = normalizeCourseMap(source.courseMap);
  result.references = normalizeReferences(source.references);
  result.signatories = normalizeSignatories(source.signatories);
  const sourceDocument = normalizeSourceDocument(source.sourceDocument);
  if (sourceDocument) result.sourceDocument = sourceDocument;
  return appendUnknown(result, source, TOP_LEVEL_KEYS);
}

export function normalizeSyllabusField(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  return JSON.stringify(normalizeSyllabus(raw));
}
