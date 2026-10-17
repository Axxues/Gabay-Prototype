import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  CourseMapLevel,
  RagSectionKey,
  RagSectionMap,
  RagSectionRecord,
  RequirementCategory,
  SignatoryRole,
  SyllabusCourseMapRow,
  SyllabusDocument,
  SyllabusRevisionHeader,
  SyllabusRubricRow,
  SyllabusSectionKey,
  SyllabusStatus,
  SyllabusWriteModel,
} from './contracts.js';
import { RagSectionKeyOrder } from './contracts.js';
import {
  mapLegacyToWriteModel,
  mapWriteModelToDocument,
  replaceSection as replaceMappedSection,
} from './mapper.js';
import { SYLLABUS_SECTION_KEYS, validateSectionPayload } from './validation.js';

export interface SyllabusRepository {
  getPublished(courseId: string): Promise<SyllabusDocument | null>;
  getRevision(courseId: string, revisionId: string): Promise<SyllabusDocument | null>;
  getPublishedEnvelope(courseId: string): Promise<SyllabusRevisionEnvelope | null>;
  getRevisionEnvelope(courseId: string, revisionId: string): Promise<SyllabusRevisionEnvelope | null>;
  listRevisions(courseId: string): Promise<SyllabusRevisionHeader[]>;
  replaceFromLegacy(courseId: string, createdById: string, normalizedSyllabus: string): Promise<SyllabusRevisionHeader>;
  getRagSections(courseId: string): Promise<SyllabusRagSections>;
  getRagSectionRecords(courseId: string): Promise<SyllabusRagRecord[]>;
  createDraft(courseId: string, createdById: string, sourceRevisionId?: string): Promise<SyllabusRevisionHeader>;
  replaceSection(
    courseId: string,
    revisionId: string,
    expectedRowVersion: number,
    section: SyllabusSectionKey,
    value: unknown,
  ): Promise<SyllabusRevisionHeader>;
  publish(
    courseId: string,
    revisionId: string,
    expectedRowVersion: number,
    publishedById: string,
  ): Promise<SyllabusRevisionHeader>;
  deleteDraft(courseId: string, revisionId: string): Promise<void>;
  withdrawSyllabus(courseId: string): Promise<void>;
}

export interface SyllabusRevisionEnvelope {
  revision: SyllabusRevisionHeader;
  syllabus: SyllabusDocument;
}

export type SyllabusRagSectionKey = RagSectionKey;

export type SyllabusRagSections = RagSectionMap;

export type SyllabusRagRecord = RagSectionRecord;

export type SyllabusMigrationAuditStatus = 'created' | 'updated' | 'skipped' | 'conflict';

export interface SyllabusMigrationAuditInput {
  originalCourseId: string;
  originalRevisionId: string | null;
  sourceChecksum: string;
  status: SyllabusMigrationAuditStatus;
  scannedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  conflictedCount: number;
  errorText: string | null;
}

export type SyllabusIdFactory = (prefix: string) => string;

export const SYLLABUS_CATALOG_VERSION = '1';

const COURSE_INFO_LECTURE_HOURS_PATH = '$.migration.courseInfo.lectureHours';
const COURSE_INFO_LAB_HOURS_PATH = '$.migration.courseInfo.labHours';
const SOURCE_DOCUMENT_STATE_KEY = '__gabaySyllabusSourceDocument';
const RAG_SECTION_LIMIT = 1500;

export class SyllabusConflictError extends Error {
  readonly code = 'revision_conflict';

  constructor(message = 'The syllabus revision changed before this update completed.') {
    super(message);
    this.name = 'SyllabusConflictError';
  }
}

export class SyllabusNotFoundError extends Error {
  readonly code = 'syllabus_not_found';

  constructor(message = 'The syllabus revision was not found for this course.') {
    super(message);
    this.name = 'SyllabusNotFoundError';
  }
}

export class SyllabusPublishError extends Error {
  readonly code = 'revision_not_publishable';

  constructor(message: string) {
    super(message);
    this.name = 'SyllabusPublishError';
  }
}

export class SyllabusSourceFileError extends Error {
  readonly code = 'invalid_syllabus_source_file';

  constructor(message = 'The source file must belong to the same course.') {
    super(message);
    this.name = 'SyllabusSourceFileError';
  }
}

export class SyllabusRepositoryError extends Error {
  readonly code = 'invalid_syllabus_data';

  constructor(message: string) {
    super(message);
    this.name = 'SyllabusRepositoryError';
  }
}

const defaultIdFactory: SyllabusIdFactory = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const syllabusRelations = {
  institution: true,
  courseInfo: true,
  institutionalStatement: true,
  gradingSystem: {
    include: {
      components: { orderBy: { position: 'asc' } },
    },
  },
  sourceDocument: true,
  faculty: {
    orderBy: { position: 'asc' },
    include: { sections: { orderBy: { position: 'asc' } } },
  },
  requirements: { orderBy: { position: 'asc' } },
  policies: { orderBy: { position: 'asc' } },
  rubrics: {
    orderBy: { position: 'asc' },
    include: { levels: { orderBy: { level: 'asc' } } },
  },
  outlineBlocks: {
    orderBy: { position: 'asc' },
    include: { topics: { orderBy: { position: 'asc' } } },
  },
  learningPlans: {
    orderBy: { position: 'asc' },
    include: {
      outcomes: { orderBy: { position: 'asc' } },
      topics: { orderBy: { position: 'asc' } },
      methods: { orderBy: { position: 'asc' } },
      resources: { orderBy: { position: 'asc' } },
      assessments: { orderBy: { position: 'asc' } },
      sdg: true,
    },
  },
  courseOutcomes: { orderBy: { position: 'asc' } },
  courseMaps: {
    orderBy: { position: 'asc' },
    include: {
      programOutcomes: {
        orderBy: { position: 'asc' },
        include: { programOutcome: true },
      },
    },
  },
  references: { orderBy: { position: 'asc' } },
  signatories: { orderBy: { position: 'asc' } },
  extensionFields: { orderBy: { path: 'asc' } },
  programOutcomes: {
    orderBy: { position: 'asc' },
    include: { programOutcome: true },
  },
  coreValues: {
    orderBy: { position: 'asc' },
    include: { coreValue: true },
  },
  graduateAttributes: {
    orderBy: { position: 'asc' },
    include: { graduateAttribute: true },
  },
} satisfies Prisma.SyllabusInclude;

export type SyllabusRelationRecord = Prisma.SyllabusGetPayload<{ include: typeof syllabusRelations }>;

const headerSelect = {
  id: true,
  courseId: true,
  revisionNo: true,
  status: true,
  schemaVersion: true,
  rowVersion: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
} satisfies Prisma.SyllabusSelect;

type RevisionHeaderRecord = Prisma.SyllabusGetPayload<{ select: typeof headerSelect }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseStoredValue = (value: string, valueType: string): unknown => {
  if (valueType === 'undefined') return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const parseDate = (value: string): { date: Date; canonical: string | null } => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: new Date(0), canonical: null };
  return { date, canonical: date.toISOString() };
};

const parseHour = (value: string): number => {
  const match = /^\s*(\d+)/.exec(value);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
};

const valueType = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const serializeValue = (value: unknown): string => JSON.stringify(value) ?? 'null';

const toStatus = (value: string): SyllabusStatus => {
  if (value === 'draft' || value === 'published' || value === 'archived') return value;
  throw new SyllabusRepositoryError(`Unsupported syllabus revision status: ${value}`);
};

const toRequirementCategory = (value: string): RequirementCategory => {
  if (value === 'major' || value === 'other') return value;
  throw new SyllabusRepositoryError(`Unsupported syllabus requirement category: ${value}`);
};

const toSignatoryRole = (value: string): SignatoryRole => {
  if (value === 'prepared' || value === 'recommendingApproval' || value === 'approved') return value;
  throw new SyllabusRepositoryError(`Unsupported syllabus signatory role: ${value}`);
};

const toCourseMapLevel = (value: string): CourseMapLevel => {
  if (value === 'I' || value === 'P' || value === 'D') return value;
  throw new SyllabusRepositoryError(`Unsupported syllabus course-map level: ${value}`);
};

const toRubricLevel = (value: number): 1 | 2 | 3 | 4 => {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  throw new SyllabusRepositoryError(`Unsupported syllabus rubric level: ${value}`);
};

const toHeader = (record: RevisionHeaderRecord): SyllabusRevisionHeader => ({
  id: record.id,
  courseId: record.courseId,
  revisionNo: record.revisionNo,
  status: toStatus(record.status),
  schemaVersion: record.schemaVersion,
  rowVersion: record.rowVersion,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  publishedAt: record.publishedAt?.toISOString() ?? null,
});

const documentSectionValues = (syllabus: SyllabusDocument): Record<SyllabusSectionKey, unknown> => ({
  institution: syllabus.institution,
  courseInfo: syllabus.courseInfo,
  faculty: syllabus.facultyMembers,
  institutionalStatements: syllabus.institutionalStatements,
  programOutcomes: syllabus.programOutcomes,
  courseOutcomes: syllabus.courseOutcomes,
  requirements: syllabus.courseRequirements,
  gradingSystem: syllabus.gradingSystem,
  rubrics: syllabus.projectRubrics,
  policies: syllabus.classroomPolicies,
  outline: syllabus.courseOutline,
  learningPlan: syllabus.learningPlan,
  courseMap: syllabus.courseMap,
  references: syllabus.references,
  signatories: syllabus.signatories,
  sourceDocument: syllabus.sourceDocument ?? null,
});

const sourceState = (record: NonNullable<SyllabusRelationRecord['sourceDocument']>): {
  uploadedAt: string;
  legacyPayload?: unknown;
} => {
  let uploadedAt = record.uploadedAt.toISOString();
  let legacyPayload: unknown;
  if (record.legacyPayload !== null) {
    const stored = parseStoredValue(record.legacyPayload, 'json');
    if (isRecord(stored) && isRecord(stored[SOURCE_DOCUMENT_STATE_KEY])) {
      const state = stored[SOURCE_DOCUMENT_STATE_KEY];
      if (typeof state.uploadedAt === 'string') uploadedAt = state.uploadedAt;
      if (Object.prototype.hasOwnProperty.call(state, 'legacyPayload')) {
        legacyPayload = state.legacyPayload;
      }
    } else {
      legacyPayload = stored;
    }
  }
  return { uploadedAt, ...(legacyPayload === undefined ? {} : { legacyPayload }) };
};

export function assembleSyllabusWriteModel(record: SyllabusRelationRecord): SyllabusWriteModel {
  const model = mapLegacyToWriteModel({}, record.id, record.courseId);
  model.status = toStatus(record.status);
  model.revisionNo = record.revisionNo;
  model.schemaVersion = record.schemaVersion;
  model.rowVersion = record.rowVersion;
  model.createdAt = record.createdAt.toISOString();
  model.updatedAt = record.updatedAt.toISOString();
  model.publishedAt = record.publishedAt?.toISOString() ?? null;

  const storedExtensions = record.extensionFields.map((field) => ({
    path: field.path,
    value: parseStoredValue(field.value, field.valueType),
  }));
  const migrationValues = new Map(
    storedExtensions
      .filter(
        (field) =>
          field.path === COURSE_INFO_LECTURE_HOURS_PATH || field.path === COURSE_INFO_LAB_HOURS_PATH,
      )
      .map((field) => [field.path, field.value]),
  );
  model.extensions = storedExtensions
    .filter(
      (field) =>
        field.path !== COURSE_INFO_LECTURE_HOURS_PATH && field.path !== COURSE_INFO_LAB_HOURS_PATH,
    )
    .map((field) => ({ path: field.path, value: field.value }));

  if (record.institution) {
    model.institution = {
      university: record.institution.university,
      college: record.institution.college,
      formCode: record.institution.formCode,
      revision: record.institution.revision,
    };
  }

  if (record.courseInfo) {
    model.courseInfo = {
      code: record.courseInfo.code,
      title: record.courseInfo.title,
      semester: record.courseInfo.semester,
      academicYear: record.courseInfo.academicYear,
      type: record.courseInfo.type,
      credit: record.courseInfo.credit,
      lectureHours:
        typeof migrationValues.get(COURSE_INFO_LECTURE_HOURS_PATH) === 'string'
          ? String(migrationValues.get(COURSE_INFO_LECTURE_HOURS_PATH))
          : String(record.courseInfo.lectureHours),
      labHours:
        typeof migrationValues.get(COURSE_INFO_LAB_HOURS_PATH) === 'string'
          ? String(migrationValues.get(COURSE_INFO_LAB_HOURS_PATH))
          : String(record.courseInfo.labHours),
      prerequisite: record.courseInfo.prerequisite,
      description: record.courseInfo.description,
    };
  }

  if (record.institutionalStatement) {
    model.institutionalStatements = {
      philosophy: record.institutionalStatement.philosophy,
      vision: record.institutionalStatement.vision,
      mission: record.institutionalStatement.mission,
      goal: record.institutionalStatement.goal,
      coreValues: record.coreValues.map((row) => ({
        acronym: row.coreValue.acronym,
        keyword: row.coreValue.keyword,
        description: row.coreValue.description,
        position: row.position,
      })),
      graduateAttributes: record.graduateAttributes.map((row) => ({
        number: row.graduateAttribute.number,
        title: row.graduateAttribute.title,
        description: row.graduateAttribute.description,
        position: row.position,
      })),
    };
  }

  if (record.gradingSystem) {
    model.gradingSystem = {
      termFormula: record.gradingSystem.termFormula,
      finalFormula: record.gradingSystem.finalFormula,
      passingGrade: record.gradingSystem.passingGrade,
      classStandingComponents: record.gradingSystem.components.map((component) => ({
        text: component.text,
        position: component.position,
      })),
    };
  }

  if (record.sourceDocument) {
    const state = sourceState(record.sourceDocument);
    model.sourceDocument = {
      fileName: record.sourceDocument.fileName,
      fileSize: record.sourceDocument.fileSize,
      fileType: record.sourceDocument.fileType === 'docx' ? 'docx' : 'pdf',
      uploadedAt: state.uploadedAt,
      ...(record.sourceDocument.fileDataUrl === null
        ? {}
        : { fileDataUrl: record.sourceDocument.fileDataUrl }),
      ...(record.sourceDocument.courseFileId === null
        ? {}
        : { courseFileId: record.sourceDocument.courseFileId }),
      ...(state.legacyPayload === undefined ? {} : { legacyPayload: state.legacyPayload }),
    };
  } else {
    model.sourceDocument = null;
  }

  model.facultyMembers = record.faculty.map((faculty) => ({
    name: faculty.name,
    consultation: faculty.consultation,
    position: faculty.position,
    sections: faculty.sections.map((section) => ({
      section: section.section,
      schedule: section.schedule,
      room: section.room,
      position: section.position,
    })),
  }));

  model.courseRequirements = { major: [], other: [] };
  for (const requirement of record.requirements) {
    model.courseRequirements[toRequirementCategory(requirement.category)].push({
      category: requirement.category as RequirementCategory,
      text: requirement.text,
      position: requirement.position,
    });
  }

  model.policies = record.policies.map((policy) => policy.text);
  model.policyRows = record.policies.map((policy) => ({
    text: policy.text,
    position: policy.position,
  }));

  model.programOutcomes = record.programOutcomes.map((row) => ({
    number: row.programOutcome.number,
    description: row.programOutcome.description,
    position: row.position,
  }));
  model.institutionalStatements.coreValues = record.coreValues.map((row) => ({
    acronym: row.coreValue.acronym,
    keyword: row.coreValue.keyword,
    description: row.coreValue.description,
    position: row.position,
  }));
  model.institutionalStatements.graduateAttributes = record.graduateAttributes.map((row) => ({
    number: row.graduateAttribute.number,
    title: row.graduateAttribute.title,
    description: row.graduateAttribute.description,
    position: row.position,
  }));

  model.projectRubrics = record.rubrics.map((rubric): SyllabusRubricRow => {
    const levelRows = rubric.levels.map((level) => ({
      level: toRubricLevel(level.level),
      description: level.description,
    }));
    return {
      category: rubric.category,
      position: rubric.position,
      levels: {
        1: levelRows.find((level) => level.level === 1)?.description ?? '',
        2: levelRows.find((level) => level.level === 2)?.description ?? '',
        3: levelRows.find((level) => level.level === 3)?.description ?? '',
        4: levelRows.find((level) => level.level === 4)?.description ?? '',
      },
      levelRows,
    };
  });

  model.courseOutline = record.outlineBlocks.map((block) => ({
    timeFrame: block.timeFrame,
    title: block.title,
    position: block.position,
    topics: block.topics.map((topic) => ({ text: topic.text, position: topic.position })),
  }));

  model.learningPlan = record.learningPlans.map((plan) => ({
    week: plan.week,
    hoursLab: plan.hoursLab,
    hoursLec: plan.hoursLec,
    position: plan.position,
    learningOutcomes: plan.outcomes.map((row) => ({ text: row.text, position: row.position })),
    topics: plan.topics.map((row) => ({ text: row.text, position: row.position })),
    methodology: plan.methods.map((row) => ({ text: row.text, position: row.position })),
    resources: plan.resources.map((row) => ({ text: row.text, position: row.position })),
    assessment: plan.assessments.map((row) => ({ text: row.text, position: row.position })),
    ...(plan.sdg
      ? {
          sdgCoherence: {
            goal: plan.sdg.goal,
            title: plan.sdg.title,
            description: plan.sdg.description,
            ...(plan.sdg.target === null ? {} : { target: plan.sdg.target }),
          },
        }
      : {}),
  }));

  model.courseOutcomes = record.courseOutcomes.map((outcome) => ({
    number: outcome.number,
    statement: outcome.statement,
    position: outcome.position,
  }));

  model.courseMap = record.courseMaps.map(
    (courseMap): SyllabusCourseMapRow => ({
      coNumber: courseMap.coNumber,
      coStatement: courseMap.coStatement,
      position: courseMap.position,
      poAlignments: courseMap.programOutcomes.map((row) => ({
        programOutcomeNumber: row.programOutcome.number,
        level: toCourseMapLevel(row.level),
        position: row.position,
      })),
    }),
  );

  model.references = record.references.map((reference) => ({
    citation: reference.citation,
    year: reference.year,
    position: reference.position,
    ...(reference.doiOrPublisher === null ? {} : { doiOrPublisher: reference.doiOrPublisher }),
  }));

  model.signatories = record.signatories.map((signatory) => ({
    role: toSignatoryRole(signatory.role),
    name: signatory.name,
    title: signatory.title,
    position: signatory.position,
  }));

  return model;
}

async function findRevision(
  client: Pick<PrismaClient, 'syllabus'>,
  courseId: string,
  revisionId: string,
): Promise<SyllabusRelationRecord | null> {
  return client.syllabus.findFirst({
    where: { id: revisionId, courseId },
    include: syllabusRelations,
  });
}

export async function readSyllabusWriteModel(
  client: Pick<PrismaClient, 'syllabus'>,
  courseId: string,
  revisionId: string,
): Promise<SyllabusWriteModel | null> {
  const record = await findRevision(client, courseId, revisionId);
  return record ? assembleSyllabusWriteModel(record) : null;
}

export async function readPublishedSyllabusWriteModel(
  client: Pick<PrismaClient, 'course'>,
  courseId: string,
): Promise<SyllabusWriteModel | null> {
  const course = await client.course.findUnique({
    where: { id: courseId },
    select: { currentSyllabus: { include: syllabusRelations } },
  });
  if (!course?.currentSyllabus || course.currentSyllabus.status !== 'published') return null;
  return assembleSyllabusWriteModel(course.currentSyllabus);
}

async function lockRevision(
  tx: Prisma.TransactionClient,
  courseId: string,
  revisionId: string,
): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM [Syllabus] WHERE [id] = ${revisionId} AND [courseId] = ${courseId}`,
  );
}

async function upsertProgramOutcome(
  tx: Prisma.TransactionClient,
  row: { number: number; description: string },
  newId: SyllabusIdFactory,
) {
  return tx.programOutcome.upsert({
    where: {
      catalogVersion_number: {
        catalogVersion: SYLLABUS_CATALOG_VERSION,
        number: row.number,
      },
    },
    create: {
      id: newId('po'),
      number: row.number,
      description: row.description,
      catalogVersion: SYLLABUS_CATALOG_VERSION,
    },
    update: {},
  });
}

async function upsertCoreValue(
  tx: Prisma.TransactionClient,
  row: { acronym: string; keyword: string; description: string },
  newId: SyllabusIdFactory,
) {
  return tx.coreValue.upsert({
    where: {
      catalogVersion_acronym: {
        catalogVersion: SYLLABUS_CATALOG_VERSION,
        acronym: row.acronym,
      },
    },
    create: {
      id: newId('cv'),
      acronym: row.acronym,
      keyword: row.keyword,
      description: row.description,
      catalogVersion: SYLLABUS_CATALOG_VERSION,
    },
    update: {},
  });
}

async function upsertGraduateAttribute(
  tx: Prisma.TransactionClient,
  row: { number: number; title: string; description: string },
  newId: SyllabusIdFactory,
) {
  return tx.graduateAttribute.upsert({
    where: {
      catalogVersion_number: {
        catalogVersion: SYLLABUS_CATALOG_VERSION,
        number: row.number,
      },
    },
    create: {
      id: newId('ga'),
      number: row.number,
      title: row.title,
      description: row.description,
      catalogVersion: SYLLABUS_CATALOG_VERSION,
    },
    update: {},
  });
}

async function writeInstitution(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
): Promise<void> {
  await tx.syllabusInstitution.create({
    data: { syllabusId: model.id, ...model.institution },
  });
}

async function writeCourseInfo(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
): Promise<void> {
  await tx.syllabusCourseInfo.create({
    data: {
      syllabusId: model.id,
      code: model.courseInfo.code,
      title: model.courseInfo.title,
      semester: model.courseInfo.semester,
      academicYear: model.courseInfo.academicYear,
      type: model.courseInfo.type,
      credit: model.courseInfo.credit,
      lectureHours: parseHour(model.courseInfo.lectureHours),
      labHours: parseHour(model.courseInfo.labHours),
      prerequisite: model.courseInfo.prerequisite,
      description: model.courseInfo.description,
    },
  });
}

async function writeProgramOutcomes(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const row of model.programOutcomes) {
    const catalog = await upsertProgramOutcome(tx, row, newId);
    await tx.syllabusProgramOutcome.create({
      data: { syllabusId: model.id, programOutcomeId: catalog.id, position: row.position },
    });
  }
}

async function writeCoreValues(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const row of model.institutionalStatements.coreValues) {
    const catalog = await upsertCoreValue(tx, row, newId);
    await tx.syllabusCoreValue.create({
      data: { syllabusId: model.id, coreValueId: catalog.id, position: row.position },
    });
  }
}

async function writeGraduateAttributes(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const row of model.institutionalStatements.graduateAttributes) {
    const catalog = await upsertGraduateAttribute(tx, row, newId);
    await tx.syllabusGraduateAttribute.create({
      data: { syllabusId: model.id, graduateAttributeId: catalog.id, position: row.position },
    });
  }
}

async function writeInstitutionalStatements(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
): Promise<void> {
  const statements = model.institutionalStatements;
  await tx.syllabusInstitutionalStatement.create({
    data: {
      syllabusId: model.id,
      philosophy: statements.philosophy,
      vision: statements.vision,
      mission: statements.mission,
      goal: statements.goal,
    },
  });
}

async function writeGradingSystem(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  const grading = model.gradingSystem;
  const row = await tx.syllabusGradingSystem.create({
    data: {
      syllabusId: model.id,
      termFormula: grading.termFormula,
      finalFormula: grading.finalFormula,
      passingGrade: grading.passingGrade,
    },
  });
  for (const component of grading.classStandingComponents) {
    await tx.syllabusGradingComponent.create({
      data: {
        id: newId('gradecomp'),
        gradingSystemId: row.syllabusId,
        text: component.text,
        position: component.position,
      },
    });
  }
}

async function validateAndWriteSourceDocument(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
): Promise<void> {
  await validateSourceFile(tx, model.courseId, model);
  const source = model.sourceDocument;
  if (!source) return;
  const uploadedAt = parseDate(source.uploadedAt);
  const state: Record<string, unknown> = {};
  if (uploadedAt.canonical !== source.uploadedAt) state.uploadedAt = source.uploadedAt;
  if (source.legacyPayload !== undefined) state.legacyPayload = source.legacyPayload;
  const legacyPayload =
    Object.keys(state).length > 0
      ? serializeValue({ [SOURCE_DOCUMENT_STATE_KEY]: state })
      : null;
  await tx.syllabusSourceDocument.create({
    data: {
      syllabusId: model.id,
      fileName: source.fileName,
      fileSize: source.fileSize,
      fileType: source.fileType,
      uploadedAt: uploadedAt.date,
      fileDataUrl: source.fileDataUrl ?? null,
      courseFileId: source.courseFileId ?? null,
      legacyPayload,
    },
  });
}

async function writeFaculty(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const faculty of model.facultyMembers) {
    await tx.syllabusFaculty.create({
      data: {
        id: newId('faculty'),
        syllabusId: model.id,
        name: faculty.name,
        consultation: faculty.consultation,
        position: faculty.position,
        sections: {
          create: faculty.sections.map((section) => ({
            id: newId('facsect'),
            section: section.section,
            schedule: section.schedule,
            room: section.room,
            position: section.position,
          })),
        },
      },
    });
  }
}

async function writeRequirements(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  let position = 0;
  for (const category of ['major', 'other'] as const) {
    for (const requirement of model.courseRequirements[category]) {
      await tx.syllabusRequirement.create({
        data: {
          id: newId('req'),
          syllabusId: model.id,
          category: requirement.category,
          text: requirement.text,
          position,
        },
      });
      position += 1;
    }
  }
}

async function writePolicies(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  if (model.policyRows.length === 0) return;
  await tx.syllabusPolicy.createMany({
    data: model.policyRows.map((policy) => ({
      id: newId('policy'),
      syllabusId: model.id,
      text: policy.text,
      position: policy.position,
    })),
  });
}

async function writeRubrics(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const rubric of model.projectRubrics) {
    await tx.syllabusRubric.create({
      data: {
        id: newId('rubric'),
        syllabusId: model.id,
        category: rubric.category,
        position: rubric.position,
        levels: {
          create: rubric.levelRows.map((level) => ({
            level: level.level,
            description: level.description,
          })),
        },
      },
    });
  }
}

async function writeOutline(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const block of model.courseOutline) {
    await tx.syllabusOutlineBlock.create({
      data: {
        id: newId('outline'),
        syllabusId: model.id,
        timeFrame: block.timeFrame,
        title: block.title,
        position: block.position,
        topics: {
          create: block.topics.map((topic) => ({
            id: newId('topic'),
            text: topic.text,
            position: topic.position,
          })),
        },
      },
    });
  }
}

async function writeLearningPlan(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const plan of model.learningPlan) {
    await tx.syllabusLearningPlan.create({
      data: {
        id: newId('lp'),
        syllabusId: model.id,
        week: plan.week,
        hoursLab: plan.hoursLab,
        hoursLec: plan.hoursLec,
        position: plan.position,
        outcomes: {
          create: plan.learningOutcomes.map((row) => ({
            id: newId('lpout'),
            text: row.text,
            position: row.position,
          })),
        },
        topics: {
          create: plan.topics.map((row) => ({
            id: newId('lptopic'),
            text: row.text,
            position: row.position,
          })),
        },
        methods: {
          create: plan.methodology.map((row) => ({
            id: newId('lpmethod'),
            text: row.text,
            position: row.position,
          })),
        },
        resources: {
          create: plan.resources.map((row) => ({
            id: newId('lpresource'),
            text: row.text,
            position: row.position,
          })),
        },
        assessments: {
          create: plan.assessment.map((row) => ({
            id: newId('lpassess'),
            text: row.text,
            position: row.position,
          })),
        },
        sdg: plan.sdgCoherence
          ? {
              create: {
                goal: plan.sdgCoherence.goal,
                title: plan.sdgCoherence.title,
                description: plan.sdgCoherence.description,
                target: plan.sdgCoherence.target ?? null,
              },
            }
          : undefined,
      },
    });
  }
}

async function writeCourseOutcomes(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const outcome of model.courseOutcomes) {
    await tx.syllabusCourseOutcome.create({
      data: {
        id: newId('co'),
        syllabusId: model.id,
        number: outcome.number,
        statement: outcome.statement,
        position: outcome.position,
      },
    });
  }
}

async function writeCourseMaps(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  if (model.courseMap.length === 0) return;
  const outcomes = await tx.syllabusCourseOutcome.findMany({
    where: { syllabusId: model.id },
    select: { id: true, number: true },
  });
  const outcomeIds = new Map(outcomes.map((outcome) => [outcome.number, outcome.id]));
  for (const courseMap of model.courseMap) {
    const courseOutcomeId = outcomeIds.get(courseMap.coNumber);
    if (!courseOutcomeId) {
      throw new SyllabusRepositoryError(
        `Course outcome ${courseMap.coNumber} is required before its curriculum map row.`,
      );
    }
    const row = await tx.syllabusCourseMap.create({
      data: {
        id: newId('map'),
        syllabusId: model.id,
        courseOutcomeId,
        coNumber: courseMap.coNumber,
        coStatement: courseMap.coStatement,
        position: courseMap.position,
      },
    });
    for (const alignment of courseMap.poAlignments) {
      const catalog = await upsertProgramOutcome(
        tx,
        { number: alignment.programOutcomeNumber, description: '' },
        newId,
      );
      await tx.syllabusCourseMapProgramOutcome.create({
        data: {
          courseMapId: row.id,
          programOutcomeId: catalog.id,
          level: alignment.level,
          position: alignment.position,
        },
      });
    }
  }
}

async function writeReferences(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const reference of model.references) {
    await tx.syllabusReference.create({
      data: {
        id: newId('ref'),
        syllabusId: model.id,
        citation: reference.citation,
        year: reference.year,
        doiOrPublisher: reference.doiOrPublisher ?? null,
        position: reference.position,
      },
    });
  }
}

async function writeSignatories(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  for (const signatory of model.signatories) {
    await tx.syllabusSignatory.create({
      data: {
        id: newId('sig'),
        syllabusId: model.id,
        role: signatory.role,
        name: signatory.name,
        title: signatory.title,
        position: signatory.position,
      },
    });
  }
}

const courseInfoExtensionFields = (
  model: SyllabusWriteModel,
): Array<{ path: string; value: unknown }> => {
  const lectureHours = parseHour(model.courseInfo.lectureHours);
  const labHours = parseHour(model.courseInfo.labHours);
  return [
    ...(String(lectureHours) === model.courseInfo.lectureHours
      ? []
      : [{ path: COURSE_INFO_LECTURE_HOURS_PATH, value: model.courseInfo.lectureHours }]),
    ...(String(labHours) === model.courseInfo.labHours
      ? []
      : [{ path: COURSE_INFO_LAB_HOURS_PATH, value: model.courseInfo.labHours }]),
  ];
};

const writeExtensionRows = async (
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  fields: Array<{ path: string; value: unknown }>,
  newId: SyllabusIdFactory,
): Promise<void> => {
  const unique = new Map(fields.map((field) => [field.path, field]));
  for (const field of unique.values()) {
    await tx.syllabusExtensionField.create({
      data: {
        id: newId('ext'),
        syllabusId: model.id,
        path: field.path,
        value: serializeValue(field.value),
        valueType: valueType(field.value),
      },
    });
  }
};

async function writeExtensions(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  await writeExtensionRows(
    tx,
    model,
    [
      ...model.extensions.map((field) => ({ path: field.path, value: field.value })),
      ...courseInfoExtensionFields(model),
    ],
    newId,
  );
}

async function writeSectionRows(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  section: SyllabusSectionKey,
  newId: SyllabusIdFactory,
): Promise<void> {
  switch (section) {
    case 'institution':
      await writeInstitution(tx, model);
      return;
    case 'courseInfo':
      await writeCourseInfo(tx, model);
      await writeExtensionRows(tx, model, courseInfoExtensionFields(model), newId);
      return;
    case 'faculty':
      await writeFaculty(tx, model, newId);
      return;
    case 'institutionalStatements':
      await writeInstitutionalStatements(tx, model);
      await writeCoreValues(tx, model, newId);
      await writeGraduateAttributes(tx, model, newId);
      return;
    case 'programOutcomes':
      await writeProgramOutcomes(tx, model, newId);
      return;
    case 'courseOutcomes':
      await writeCourseOutcomes(tx, model, newId);
      return;
    case 'requirements':
      await writeRequirements(tx, model, newId);
      return;
    case 'gradingSystem':
      await writeGradingSystem(tx, model, newId);
      return;
    case 'rubrics':
      await writeRubrics(tx, model, newId);
      return;
    case 'policies':
      await writePolicies(tx, model, newId);
      return;
    case 'outline':
      await writeOutline(tx, model, newId);
      return;
    case 'learningPlan':
      await writeLearningPlan(tx, model, newId);
      return;
    case 'courseMap':
      await writeCourseMaps(tx, model, newId);
      return;
    case 'references':
      await writeReferences(tx, model, newId);
      return;
    case 'signatories':
      await writeSignatories(tx, model, newId);
      return;
    case 'sourceDocument':
      await validateAndWriteSourceDocument(tx, model);
      return;
  }
}

async function writeAllSectionRows(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  await writeInstitution(tx, model);
  await writeCourseInfo(tx, model);
  await writeFaculty(tx, model, newId);
  await writeProgramOutcomes(tx, model, newId);
  await writeInstitutionalStatements(tx, model);
  await writeCoreValues(tx, model, newId);
  await writeGraduateAttributes(tx, model, newId);
  await writeCourseOutcomes(tx, model, newId);
  await writeRequirements(tx, model, newId);
  await writeGradingSystem(tx, model, newId);
  await writeRubrics(tx, model, newId);
  await writePolicies(tx, model, newId);
  await writeOutline(tx, model, newId);
  await writeLearningPlan(tx, model, newId);
  await writeCourseMaps(tx, model, newId);
  await writeReferences(tx, model, newId);
  await writeSignatories(tx, model, newId);
  await validateAndWriteSourceDocument(tx, model);
  await writeExtensions(tx, model, newId);
}

export interface PersistSyllabusRevisionMetadata {
  createdById: string;
  publishedById: string | null;
  publishedAt: Date | null;
  parentSyllabusId: string | null;
}

export async function persistSyllabusRevision(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  metadata: PersistSyllabusRevisionMetadata,
  newId: SyllabusIdFactory = defaultIdFactory,
): Promise<RevisionHeaderRecord> {
  await validateSourceFile(tx, model.courseId, model);
  const parent = await tx.syllabus.create({
    data: {
      id: model.id,
      courseId: model.courseId,
      parentSyllabusId: metadata.parentSyllabusId,
      revisionNo: model.revisionNo,
      status: model.status,
      schemaVersion: model.schemaVersion,
      rowVersion: model.rowVersion,
      createdById: metadata.createdById,
      publishedById: metadata.publishedById,
      publishedAt: metadata.publishedAt,
    },
  });
  await writeAllSectionRows(tx, model, newId);
  return parent;
}

async function deleteOwnedSection(
  tx: Prisma.TransactionClient,
  syllabusId: string,
  section: SyllabusSectionKey,
): Promise<void> {
  switch (section) {
    case 'institution':
      await tx.syllabusInstitution.deleteMany({ where: { syllabusId } });
      return;
    case 'courseInfo':
      await tx.syllabusExtensionField.deleteMany({
        where: {
          syllabusId,
          path: { in: [COURSE_INFO_LECTURE_HOURS_PATH, COURSE_INFO_LAB_HOURS_PATH] },
        },
      });
      await tx.syllabusCourseInfo.deleteMany({ where: { syllabusId } });
      return;
    case 'faculty':
      await tx.syllabusFaculty.deleteMany({ where: { syllabusId } });
      return;
    case 'institutionalStatements':
      await tx.syllabusCoreValue.deleteMany({ where: { syllabusId } });
      await tx.syllabusGraduateAttribute.deleteMany({ where: { syllabusId } });
      await tx.syllabusInstitutionalStatement.deleteMany({ where: { syllabusId } });
      return;
    case 'programOutcomes':
      await tx.syllabusProgramOutcome.deleteMany({ where: { syllabusId } });
      return;
    case 'courseOutcomes':
      await tx.syllabusCourseOutcome.deleteMany({ where: { syllabusId } });
      return;
    case 'requirements':
      await tx.syllabusRequirement.deleteMany({ where: { syllabusId } });
      return;
    case 'gradingSystem':
      await tx.syllabusGradingSystem.deleteMany({ where: { syllabusId } });
      return;
    case 'rubrics':
      await tx.syllabusRubric.deleteMany({ where: { syllabusId } });
      return;
    case 'policies':
      await tx.syllabusPolicy.deleteMany({ where: { syllabusId } });
      return;
    case 'outline':
      await tx.syllabusOutlineBlock.deleteMany({ where: { syllabusId } });
      return;
    case 'learningPlan':
      await tx.syllabusLearningPlan.deleteMany({ where: { syllabusId } });
      return;
    case 'courseMap':
      await tx.syllabusCourseMap.deleteMany({ where: { syllabusId } });
      return;
    case 'references':
      await tx.syllabusReference.deleteMany({ where: { syllabusId } });
      return;
    case 'signatories':
      await tx.syllabusSignatory.deleteMany({ where: { syllabusId } });
      return;
    case 'sourceDocument':
      await tx.syllabusSourceDocument.deleteMany({ where: { syllabusId } });
      return;
  }
}

async function replaceCourseOutcomes(
  tx: Prisma.TransactionClient,
  model: SyllabusWriteModel,
  newId: SyllabusIdFactory,
): Promise<void> {
  const existing = await tx.syllabusCourseOutcome.findMany({
    where: { syllabusId: model.id },
    select: { id: true, number: true, courseMap: { select: { id: true } } },
  });
  const desired = new Map(model.courseOutcomes.map((outcome) => [outcome.number, outcome]));
  const stale = existing.filter((outcome) => !desired.has(outcome.number));
  if (stale.some((outcome) => outcome.courseMap !== null)) {
    throw new SyllabusRepositoryError(
      'A referenced course outcome cannot be removed without replacing the curriculum map first.',
    );
  }
  for (const outcome of stale) {
    await tx.syllabusCourseOutcome.delete({ where: { id: outcome.id } });
  }
  for (const outcome of existing) {
    if (desired.has(outcome.number)) {
      await tx.syllabusCourseOutcome.update({
        where: { id: outcome.id },
        data: { position: { increment: 1_000_000 } },
      });
    }
  }
  for (const outcome of model.courseOutcomes) {
    const current = existing.find((candidate) => candidate.number === outcome.number);
    if (current) {
      await tx.syllabusCourseOutcome.update({
        where: { id: current.id },
        data: { statement: outcome.statement, position: outcome.position },
      });
    } else {
      await tx.syllabusCourseOutcome.create({
        data: {
          id: newId('co'),
          syllabusId: model.id,
          number: outcome.number,
          statement: outcome.statement,
          position: outcome.position,
        },
      });
    }
  }
}

export async function validateSourceFile(
  tx: Pick<Prisma.TransactionClient, 'courseFile'>,
  courseId: string,
  model: SyllabusWriteModel,
): Promise<void> {
  const courseFileId = model.sourceDocument?.courseFileId;
  if (!courseFileId) return;
  const file = await tx.courseFile.findUnique({ where: { id: courseFileId }, select: { courseId: true } });
  if (!file || file.courseId !== courseId) throw new SyllabusSourceFileError();
}

const capRagText = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > RAG_SECTION_LIMIT
    ? `${normalized.slice(0, RAG_SECTION_LIMIT - 1)}…`
    : normalized;
};

export function emptySyllabusRagSections(): SyllabusRagSections {
  return {
    institution: '',
    description: '',
    faculty: '',
    institutional_statement: '',
    program_outcomes: '',
    core_values: '',
    graduate_attributes: '',
    requirements: '',
    grading: '',
    rubrics: '',
    policies: '',
    outline: '',
    learning_plan: '',
    outcomes: '',
    course_map: '',
    references: '',
  };
}

export function buildSyllabusRagSections(
  course: { code: string; title: string },
  syllabus: SyllabusDocument | null,
): SyllabusRagSections {
  const sections: SyllabusRagSections = emptySyllabusRagSections();
  if (!syllabus) return sections;
  const institution = syllabus.institution;
  if (
    [institution.university, institution.college, institution.formCode, institution.revision].some(
      (value) => value.trim() !== '',
    )
  ) {
    sections.institution = capRagText(
      [
        `Institution: ${institution.university}.`,
        institution.college ? `College: ${institution.college}.` : '',
        institution.formCode ? `Form: ${institution.formCode}.` : '',
        institution.revision ? `Revision: ${institution.revision}.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  const info = syllabus.courseInfo;
  const hasInfo = [
    info.semester,
    info.academicYear,
    info.credit,
    info.lectureHours,
    info.labHours,
    info.prerequisite,
    info.description,
  ].some((value) => value.trim() !== '');
  if (hasInfo) {
    sections.description = capRagText(
      [
        `${course.code}: ${course.title}.`,
        info.semester ? `Semester: ${info.semester}.` : '',
        info.academicYear ? `Academic year: ${info.academicYear}.` : '',
        info.credit ? `Credits: ${info.credit}.` : '',
        info.lectureHours ? `Lecture: ${info.lectureHours}.` : '',
        info.labHours ? `Laboratory: ${info.labHours}.` : '',
        info.prerequisite ? `Prerequisite: ${info.prerequisite}.` : '',
        info.description,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  if (syllabus.courseOutcomes.length > 0) {
    sections.outcomes = capRagText(
      `Course outcomes: ${syllabus.courseOutcomes
        .map((outcome) => `CO${outcome.number}: ${outcome.statement}`)
        .join(' ')}`,
    );
  }
  const grading = syllabus.gradingSystem;
  sections.grading = capRagText(
    [
      grading.termFormula ? `Term grade formula: ${grading.termFormula}.` : '',
      grading.finalFormula ? `Final grade formula: ${grading.finalFormula}.` : '',
      grading.classStandingComponents.length > 0
        ? `Class standing components: ${grading.classStandingComponents.join(', ')}.`
        : '',
      grading.passingGrade ? `Passing grade: ${grading.passingGrade}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
  if (syllabus.classroomPolicies.length > 0) {
    sections.policies = capRagText(`Classroom policies: ${syllabus.classroomPolicies.join(' ')}`);
  }
  if (syllabus.courseOutline.length > 0) {
    sections.outline = capRagText(
      `Course outline: ${syllabus.courseOutline
        .map(
          (block) =>
            `${block.timeFrame} ${block.title}${
              block.topics.length > 0 ? ` (${block.topics.join(', ')})` : ''
            };`,
        )
        .join(' ')}`,
    );
  }
  if (syllabus.references.length > 0) {
    sections.references = capRagText(
      `References: ${syllabus.references
        .map((reference) => `${reference.citation}${reference.year ? ` (${reference.year})` : ''};`)
        .join(' ')}`,
    );
  }
  if (syllabus.facultyMembers.length > 0) {
    sections.faculty = capRagText(
      `Syllabus faculty: ${syllabus.facultyMembers
        .map((faculty) => faculty.name)
        .filter(Boolean)
        .join(', ')}.`,
    );
  }
  const statements = syllabus.institutionalStatements;
  if (
    [statements.philosophy, statements.vision, statements.mission, statements.goal].some(
      (value) => value.trim() !== '',
    )
  ) {
    sections.institutional_statement = capRagText(
      [
        statements.philosophy ? `Philosophy: ${statements.philosophy}` : '',
        statements.vision ? `Vision: ${statements.vision}` : '',
        statements.mission ? `Mission: ${statements.mission}` : '',
        statements.goal ? `Goal: ${statements.goal}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  if (syllabus.programOutcomes.length > 0) {
    sections.program_outcomes = capRagText(
      `Program outcomes: ${syllabus.programOutcomes
        .map((outcome) => `PO${outcome.number}: ${outcome.description}`)
        .join(' ')}`,
    );
  }
  if (statements.coreValues.length > 0) {
    sections.core_values = capRagText(
      `Core values: ${statements.coreValues
        .map((value) => `${value.acronym} (${value.keyword}): ${value.description}`)
        .join(' ')}`,
    );
  }
  if (statements.graduateAttributes.length > 0) {
    sections.graduate_attributes = capRagText(
      `Graduate attributes: ${statements.graduateAttributes
        .map((attribute) => `${attribute.number} ${attribute.title}: ${attribute.description}`)
        .join(' ')}`,
    );
  }
  const requirements = syllabus.courseRequirements;
  if (requirements.major.length > 0 || requirements.other.length > 0) {
    sections.requirements = capRagText(
      [
        requirements.major.length > 0 ? `Major requirements: ${requirements.major.join(' ')}` : '',
        requirements.other.length > 0 ? `Other requirements: ${requirements.other.join(' ')}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  if (syllabus.projectRubrics.length > 0) {
    sections.rubrics = capRagText(
      `Rubrics: ${syllabus.projectRubrics
        .map(
          (rubric) =>
            `${rubric.category}: ${[1, 2, 3, 4]
              .map((level) => `L${level} ${rubric.levels[level] ?? ''}`.trim())
              .join('; ')}`,
        )
        .join(' ')}`,
    );
  }
  if (syllabus.learningPlan.length > 0) {
    sections.learning_plan = capRagText(
      `Learning plan: ${syllabus.learningPlan
        .map((entry) =>
          [
            entry.week,
            entry.learningOutcomes.length > 0 ? `Outcomes: ${entry.learningOutcomes.join(', ')}` : '',
            entry.topics.length > 0 ? `Topics: ${entry.topics.join(', ')}` : '',
            entry.methodology.length > 0 ? `Methods: ${entry.methodology.join(', ')}` : '',
            entry.resources.length > 0 ? `Resources: ${entry.resources.join(', ')}` : '',
            entry.assessment.length > 0 ? `Assessment: ${entry.assessment.join(', ')}` : '',
            entry.sdgCoherence
              ? `SDG ${entry.sdgCoherence.goal} ${entry.sdgCoherence.title}: ${entry.sdgCoherence.description}`
              : '',
          ]
            .filter(Boolean)
            .join(' '),
        )
        .join(' ')}`,
    );
  }
  if (syllabus.courseMap.length > 0) {
    sections.course_map = capRagText(
      `Curriculum map: ${syllabus.courseMap
        .map((entry) => {
          const alignments = Object.entries(entry.poAlignments)
            .filter(([, level]) => level === 'I' || level === 'P' || level === 'D')
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([po, level]) => `PO${po}=${level}`)
            .join(', ');
          return `CO${entry.coNumber} (${entry.coStatement})${alignments ? `: ${alignments}` : ''};`;
        })
        .join(' ')}`,
    );
  }
  return sections;
}

export function toSyllabusRagRecords(
  syllabusId: string,
  revisionNo: number,
  sections: SyllabusRagSections,
): SyllabusRagRecord[] {
  const records: SyllabusRagRecord[] = [];
  for (const sectionKey of RagSectionKeyOrder) {
    const sectionText = sections[sectionKey] ?? '';
    if (sectionText !== '') {
      records.push({ syllabusId, revisionNo, status: 'published', sectionKey, sectionText });
    }
  }
  return records;
}

export async function recordSyllabusMigrationAudit(
  tx: Prisma.TransactionClient,
  input: SyllabusMigrationAuditInput,
) {
  const now = new Date();
  return tx.syllabusMigrationAudit.upsert({
    where: {
      originalCourseId_sourceChecksum: {
        originalCourseId: input.originalCourseId,
        sourceChecksum: input.sourceChecksum,
      },
    },
    create: {
      id: defaultIdFactory('audit'),
      originalCourseId: input.originalCourseId,
      originalRevisionId: input.originalRevisionId,
      sourceChecksum: input.sourceChecksum,
      status: input.status,
      scannedCount: input.scannedCount,
      createdCount: input.createdCount,
      updatedCount: input.updatedCount,
      skippedCount: input.skippedCount,
      conflictedCount: input.conflictedCount,
      errorText: input.errorText,
      completedAt: now,
      courseLink: { create: { courseId: input.originalCourseId } },
      revisionLink: { create: { revisionId: input.originalRevisionId } },
    },
    update: {
      status: input.status,
      scannedCount: input.scannedCount,
      createdCount: input.createdCount,
      updatedCount: input.updatedCount,
      skippedCount: input.skippedCount,
      conflictedCount: input.conflictedCount,
      errorText: input.errorText,
      completedAt: now,
      courseLink: {
        upsert: {
          create: { courseId: input.originalCourseId },
          update: { courseId: input.originalCourseId },
        },
      },
      revisionLink: {
        upsert: {
          create: { revisionId: input.originalRevisionId },
          update: { revisionId: input.originalRevisionId },
        },
      },
    },
  });
}

export class PrismaSyllabusRepository implements SyllabusRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly newId: SyllabusIdFactory = defaultIdFactory,
  ) {}

  async getPublished(courseId: string): Promise<SyllabusDocument | null> {
    const course = await this.client.course.findUnique({
      where: { id: courseId },
      select: { currentSyllabus: { include: syllabusRelations } },
    });
    if (!course?.currentSyllabus || course.currentSyllabus.status !== 'published') return null;
    return mapWriteModelToDocument(assembleSyllabusWriteModel(course.currentSyllabus));
  }

  async getRevision(courseId: string, revisionId: string): Promise<SyllabusDocument | null> {
    const record = await findRevision(this.client, courseId, revisionId);
    return record ? mapWriteModelToDocument(assembleSyllabusWriteModel(record)) : null;
  }

  async getPublishedEnvelope(courseId: string): Promise<SyllabusRevisionEnvelope | null> {
    const course = await this.client.course.findUnique({
      where: { id: courseId },
      select: { currentSyllabus: { include: syllabusRelations } },
    });
    if (!course?.currentSyllabus || course.currentSyllabus.status !== 'published') return null;
    return {
      revision: toHeader(course.currentSyllabus),
      syllabus: mapWriteModelToDocument(assembleSyllabusWriteModel(course.currentSyllabus)),
    };
  }

  async getRevisionEnvelope(courseId: string, revisionId: string): Promise<SyllabusRevisionEnvelope | null> {
    const record = await findRevision(this.client, courseId, revisionId);
    if (!record) return null;
    return {
      revision: toHeader(record),
      syllabus: mapWriteModelToDocument(assembleSyllabusWriteModel(record)),
    };
  }

  async listRevisions(courseId: string): Promise<SyllabusRevisionHeader[]> {
    const rows = await this.client.syllabus.findMany({
      where: { courseId },
      orderBy: { revisionNo: 'asc' },
      select: headerSelect,
    });
    return rows.map(toHeader);
  }

  async replaceFromLegacy(
    courseId: string,
    createdById: string,
    normalizedSyllabus: string,
  ): Promise<SyllabusRevisionHeader> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalizedSyllabus);
    } catch {
      throw new SyllabusRepositoryError('Legacy syllabus must be a JSON object string.');
    }
    let model: SyllabusWriteModel;
    let syllabus: SyllabusDocument;
    try {
      model = mapLegacyToWriteModel(parsed, this.newId('syl'), courseId);
      syllabus = mapWriteModelToDocument(model);
    } catch (err) {
      if (err instanceof SyllabusRepositoryError) throw err;
      throw new SyllabusRepositoryError(
        err instanceof Error ? err.message : 'Legacy syllabus could not be normalized.',
      );
    }
    const values = documentSectionValues(syllabus);
    for (const section of SYLLABUS_SECTION_KEYS) {
      validateSectionPayload(section, values[section]);
    }
    return this.client.$transaction(async (tx) => {
      const latest = await tx.syllabus.aggregate({
        where: { courseId },
        _max: { revisionNo: true },
      });
      const full: SyllabusWriteModel = {
        ...model,
        revisionNo: (latest._max.revisionNo ?? 0) + 1,
        status: 'draft',
        rowVersion: 1,
        createdAt: '',
        updatedAt: '',
        publishedAt: null,
      };
      await persistSyllabusRevision(
        tx,
        full,
        {
          createdById,
          publishedById: null,
          publishedAt: null,
          parentSyllabusId: null,
        },
        this.newId,
      );
      await tx.course.update({ where: { id: courseId }, data: { syllabus: normalizedSyllabus } });
      const header = await tx.syllabus.findUnique({ where: { id: full.id }, select: headerSelect });
      if (!header) throw new SyllabusNotFoundError();
      return toHeader(header);
    });
  }

  async getRagSections(courseId: string): Promise<SyllabusRagSections> {
    const course = await this.client.course.findUnique({
      where: { id: courseId },
      select: { code: true, title: true, currentSyllabus: { include: syllabusRelations } },
    });
    const syllabus =
      course?.currentSyllabus?.status === 'published'
        ? mapWriteModelToDocument(assembleSyllabusWriteModel(course.currentSyllabus))
        : null;
    return buildSyllabusRagSections(
      { code: course?.code ?? '', title: course?.title ?? '' },
      syllabus,
    );
  }

  async getRagSectionRecords(courseId: string): Promise<SyllabusRagRecord[]> {
    const course = await this.client.course.findUnique({
      where: { id: courseId },
      select: { code: true, title: true, currentSyllabus: { include: syllabusRelations } },
    });
    const record = course?.currentSyllabus;
    if (!record || record.status !== 'published') return [];
    const syllabus = mapWriteModelToDocument(assembleSyllabusWriteModel(record));
    const sections = buildSyllabusRagSections(
      { code: course?.code ?? '', title: course?.title ?? '' },
      syllabus,
    );
    return toSyllabusRagRecords(record.id, record.revisionNo, sections);
  }

  async createDraft(
    courseId: string,
    createdById: string,
    sourceRevisionId?: string,
  ): Promise<SyllabusRevisionHeader> {
    return this.client.$transaction(async (tx) => {
      const id = this.newId('syl');
      const source = sourceRevisionId
        ? await findRevision(tx, courseId, sourceRevisionId)
        : null;
      if (sourceRevisionId && !source) throw new SyllabusNotFoundError();
      const sourceModel = source
        ? assembleSyllabusWriteModel(source)
        : mapLegacyToWriteModel({}, id, courseId);
      const latest = await tx.syllabus.aggregate({
        where: { courseId },
        _max: { revisionNo: true },
      });
      const model: SyllabusWriteModel = {
        ...sourceModel,
        id,
        courseId,
        revisionNo: (latest._max.revisionNo ?? 0) + 1,
        status: 'draft',
        rowVersion: 1,
        createdAt: '',
        updatedAt: '',
        publishedAt: null,
      };
      const parent = await persistSyllabusRevision(
        tx,
        model,
        {
          createdById,
          publishedById: null,
          publishedAt: null,
          parentSyllabusId: sourceRevisionId ?? null,
        },
        this.newId,
      );
      return toHeader(parent);
    });
  }

  async replaceSection(
    courseId: string,
    revisionId: string,
    expectedRowVersion: number,
    section: SyllabusSectionKey,
    value: unknown,
  ): Promise<SyllabusRevisionHeader> {
    return this.client.$transaction(async (tx) => {
      await lockRevision(tx, courseId, revisionId);
      const record = await findRevision(tx, courseId, revisionId);
      if (!record || record.status !== 'draft') throw new SyllabusNotFoundError();
      if (record.rowVersion !== expectedRowVersion) throw new SyllabusConflictError();
      const current = assembleSyllabusWriteModel(record);
      const next = replaceMappedSection(current, section, value);
      await validateSourceFile(tx, courseId, next);
      if (section === 'courseOutcomes') {
        await replaceCourseOutcomes(tx, next, this.newId);
      } else {
        await deleteOwnedSection(tx, revisionId, section);
        await writeSectionRows(tx, next, section, this.newId);
      }
      const updated = await tx.syllabus.updateMany({
        where: { id: revisionId, courseId, status: 'draft', rowVersion: expectedRowVersion },
        data: { rowVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new SyllabusConflictError();
      await tx.historyLog.create({
        data: {
          id: this.newId('history'),
          path: `courses/${courseId}/syllabi/${revisionId}/sections/${section}`,
          title: `Syllabus section replaced: ${section}`,
        },
      });
      const header = await tx.syllabus.findUnique({ where: { id: revisionId }, select: headerSelect });
      if (!header) throw new SyllabusNotFoundError();
      return toHeader(header);
    });
  }

  async publish(
    courseId: string,
    revisionId: string,
    expectedRowVersion: number,
    publishedById: string,
  ): Promise<SyllabusRevisionHeader> {
    return this.client.$transaction(async (tx) => {
      await lockRevision(tx, courseId, revisionId);
      const record = await findRevision(tx, courseId, revisionId);
      if (!record || record.status !== 'draft') throw new SyllabusNotFoundError();
      if (record.rowVersion !== expectedRowVersion) throw new SyllabusConflictError();
      const model = assembleSyllabusWriteModel(record);
      const publishable =
        model.courseInfo.code.trim() !== '' &&
        model.courseInfo.title.trim() !== '' &&
        model.gradingSystem.termFormula.trim() !== '' &&
        model.gradingSystem.finalFormula.trim() !== '' &&
        model.courseOutcomes.length > 0;
      if (!publishable) {
        throw new SyllabusPublishError('Course information, grading formulas, and outcomes are required.');
      }
      await tx.syllabus.updateMany({
        where: { courseId, status: 'published' },
        data: { status: 'archived' },
      });
      const publishedAt = new Date();
      const updated = await tx.syllabus.updateMany({
        where: { id: revisionId, courseId, status: 'draft', rowVersion: expectedRowVersion },
        data: {
          status: 'published',
          publishedAt,
          publishedById,
          rowVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new SyllabusConflictError();
      const course = await tx.course.updateMany({
        where: { id: courseId },
        data: { currentSyllabusId: revisionId },
      });
      if (course.count !== 1) throw new SyllabusNotFoundError();
      const header = await tx.syllabus.findUnique({ where: { id: revisionId }, select: headerSelect });
      if (!header) throw new SyllabusNotFoundError();
      return toHeader(header);
    });
  }

  async deleteDraft(courseId: string, revisionId: string): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await lockRevision(tx, courseId, revisionId);
      const deleted = await tx.syllabus.deleteMany({
        where: { id: revisionId, courseId, status: 'draft' },
      });
      if (deleted.count !== 1) throw new SyllabusNotFoundError();
    });
  }

  async withdrawSyllabus(courseId: string): Promise<void> {
    return this.client.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: { id: true, syllabus: true },
      });
      if (!course) throw new SyllabusNotFoundError();
      const existing = await tx.syllabus.findFirst({ where: { courseId }, select: { id: true } });
      if (!existing && course.syllabus == null) throw new SyllabusNotFoundError();
      await tx.syllabus.deleteMany({ where: { courseId, status: 'draft' } });
      await tx.syllabus.updateMany({ where: { courseId, status: 'published' }, data: { status: 'archived' } });
      const updated = await tx.course.updateMany({
        where: { id: courseId },
        data: { currentSyllabusId: null, syllabus: null },
      });
      if (updated.count !== 1) throw new SyllabusNotFoundError();
    });
  }
}
