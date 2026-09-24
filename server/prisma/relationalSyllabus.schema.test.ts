import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

type DmmfField = {
  name: string;
  kind: string;
  type?: string;
  isId: boolean;
  isList: boolean;
  isRequired: boolean;
  isUnique: boolean;
  relationName?: string;
  relationFromFields?: string[];
  relationToFields?: string[];
  relationOnDelete?: string;
};

type DmmfModel = {
  name: string;
  fields: DmmfField[];
  uniqueFields: string[][];
  primaryKey: { fields: string[] } | null;
};

const models = new Map<string, DmmfModel>(
  (Prisma.dmmf.datamodel.models as DmmfModel[]).map((model) => [model.name, model]),
);

const getModel = (name: string): DmmfModel => {
  const model = models.get(name);
  expect(model, `Expected Prisma DMMF model ${name}`).toBeDefined();
  return model as DmmfModel;
};

const getField = (modelName: string, fieldName: string): DmmfField => {
  const field = getModel(modelName).fields.find((candidate) => candidate.name === fieldName);
  expect(field, `Expected Prisma DMMF field ${modelName}.${fieldName}`).toBeDefined();
  return field as DmmfField;
};

const expectUnique = (modelName: string, fields: string[]): void => {
  expect(getModel(modelName).uniqueFields).toContainEqual(fields);
};

const expectPrimaryKey = (modelName: string, fields: string[]): void => {
  expect(getModel(modelName).primaryKey?.fields).toEqual(fields);
};

const syllabusModelNames = [
  'Syllabus',
  'ProgramOutcome',
  'CoreValue',
  'GraduateAttribute',
  'SyllabusProgramOutcome',
  'SyllabusCoreValue',
  'SyllabusGraduateAttribute',
  'SyllabusInstitution',
  'SyllabusCourseInfo',
  'SyllabusInstitutionalStatement',
  'SyllabusGradingSystem',
  'SyllabusSourceDocument',
  'SyllabusFaculty',
  'SyllabusFacultySection',
  'SyllabusRequirement',
  'SyllabusPolicy',
  'SyllabusGradingComponent',
  'SyllabusRubric',
  'SyllabusRubricLevel',
  'SyllabusOutlineBlock',
  'SyllabusOutlineTopic',
  'SyllabusLearningPlan',
  'SyllabusLearningPlanOutcome',
  'SyllabusLearningPlanTopic',
  'SyllabusLearningPlanMethod',
  'SyllabusLearningPlanResource',
  'SyllabusLearningPlanAssessment',
  'SyllabusLearningPlanSdg',
  'SyllabusCourseOutcome',
  'SyllabusCourseMap',
  'SyllabusCourseMapProgramOutcome',
  'SyllabusReference',
  'SyllabusSignatory',
  'SyllabusExtensionField',
  'SyllabusMigrationAudit',
  'SyllabusMigrationAuditCourseLink',
  'SyllabusMigrationAuditRevisionLink',
] as const;

const oneToOneSectionModels = [
  'SyllabusInstitution',
  'SyllabusCourseInfo',
  'SyllabusInstitutionalStatement',
  'SyllabusGradingSystem',
  'SyllabusSourceDocument',
] as const;

const orderedModels = [
  ['SyllabusFaculty', ['syllabusId', 'position']],
  ['SyllabusFacultySection', ['facultyId', 'position']],
  ['SyllabusRequirement', ['syllabusId', 'position']],
  ['SyllabusPolicy', ['syllabusId', 'position']],
  ['SyllabusGradingComponent', ['gradingSystemId', 'position']],
  ['SyllabusRubric', ['syllabusId', 'position']],
  ['SyllabusProgramOutcome', ['syllabusId', 'position']],
  ['SyllabusCoreValue', ['syllabusId', 'position']],
  ['SyllabusGraduateAttribute', ['syllabusId', 'position']],
  ['SyllabusOutlineBlock', ['syllabusId', 'position']],
  ['SyllabusOutlineTopic', ['outlineBlockId', 'position']],
  ['SyllabusLearningPlan', ['syllabusId', 'position']],
  ['SyllabusLearningPlanOutcome', ['learningPlanId', 'position']],
  ['SyllabusLearningPlanTopic', ['learningPlanId', 'position']],
  ['SyllabusLearningPlanMethod', ['learningPlanId', 'position']],
  ['SyllabusLearningPlanResource', ['learningPlanId', 'position']],
  ['SyllabusLearningPlanAssessment', ['learningPlanId', 'position']],
  ['SyllabusCourseOutcome', ['syllabusId', 'position']],
  ['SyllabusCourseMap', ['syllabusId', 'position']],
  ['SyllabusCourseMapProgramOutcome', ['courseMapId', 'position']],
  ['SyllabusReference', ['syllabusId', 'position']],
  ['SyllabusSignatory', ['syllabusId', 'position']],
] as const;

const cascadeRelations = [
  ['Syllabus', 'course'],
  ['Syllabus', 'institution'],
  ['Syllabus', 'courseInfo'],
  ['Syllabus', 'institutionalStatement'],
  ['Syllabus', 'gradingSystem'],
  ['Syllabus', 'sourceDocument'],
  ['Syllabus', 'faculty'],
  ['Syllabus', 'requirements'],
  ['Syllabus', 'policies'],
  ['Syllabus', 'rubrics'],
  ['Syllabus', 'outlineBlocks'],
  ['Syllabus', 'learningPlans'],
  ['Syllabus', 'courseOutcomes'],
  ['Syllabus', 'courseMaps'],
  ['Syllabus', 'references'],
  ['Syllabus', 'signatories'],
  ['Syllabus', 'extensionFields'],
  ['Syllabus', 'programOutcomes'],
  ['Syllabus', 'coreValues'],
  ['Syllabus', 'graduateAttributes'],
  ['SyllabusFaculty', 'sections'],
  ['SyllabusGradingSystem', 'components'],
  ['SyllabusRubric', 'levels'],
  ['SyllabusOutlineBlock', 'topics'],
  ['SyllabusLearningPlan', 'outcomes'],
  ['SyllabusLearningPlan', 'topics'],
  ['SyllabusLearningPlan', 'methods'],
  ['SyllabusLearningPlan', 'resources'],
  ['SyllabusLearningPlan', 'assessments'],
  ['SyllabusLearningPlan', 'sdg'],
  ['SyllabusCourseMap', 'programOutcomes'],
] as const;

describe('relational syllabus Prisma schema', () => {
  it('contains every approved syllabus and catalog model', () => {
    expect(syllabusModelNames.filter((name) => !models.has(name))).toEqual([]);
  });

  it('preserves the legacy JSON field beside a one-to-one current revision pointer', () => {
    const legacySyllabus = getField('Course', 'syllabus');
    expect(legacySyllabus).toMatchObject({ kind: 'scalar', type: 'String', isRequired: false });

    const currentSyllabusId = getField('Course', 'currentSyllabusId');
    expect(currentSyllabusId).toMatchObject({
      kind: 'scalar',
      type: 'String',
      isRequired: false,
      isUnique: true,
    });
    expect(getField('Course', 'currentSyllabus')).toMatchObject({
      kind: 'object',
      isList: false,
      isRequired: false,
      relationName: 'CurrentCourseSyllabus',
      relationFromFields: ['currentSyllabusId'],
      relationToFields: ['id'],
    });
    expect(getField('Syllabus', 'currentForCourse')).toMatchObject({
      kind: 'object',
      isList: false,
      isRequired: false,
      relationName: 'CurrentCourseSyllabus',
    });
  });

  it('uses scalar IDs, composite keys, catalog identities, and stable ordered positions', () => {
    for (const modelName of oneToOneSectionModels) {
      expect(getField(modelName, 'syllabusId').isId).toBe(true);
    }
    expect(getField('SyllabusLearningPlanSdg', 'learningPlanId').isId).toBe(true);
    expect(getField('SyllabusCourseInfo', 'lectureHours').type).toBe('Int');
    expect(getField('SyllabusCourseInfo', 'labHours').type).toBe('Int');
    expect(getField('SyllabusLearningPlan', 'hoursLab').type).toBe('Int');
    expect(getField('SyllabusLearningPlan', 'hoursLec').type).toBe('Int');

    expectUnique('Syllabus', ['courseId', 'revisionNo']);
    expectUnique('ProgramOutcome', ['catalogVersion', 'number']);
    expectUnique('CoreValue', ['catalogVersion', 'acronym']);
    expectUnique('GraduateAttribute', ['catalogVersion', 'number']);
    expectUnique('SyllabusCourseOutcome', ['syllabusId', 'number']);
    expectUnique('SyllabusExtensionField', ['syllabusId', 'path']);
    expectUnique('SyllabusMigrationAudit', ['originalCourseId', 'sourceChecksum']);

    for (const [modelName, fields] of orderedModels) {
      expectUnique(modelName, [...fields]);
    }

    expectPrimaryKey('SyllabusProgramOutcome', ['syllabusId', 'programOutcomeId', 'position']);
    expectPrimaryKey('SyllabusCoreValue', ['syllabusId', 'coreValueId', 'position']);
    expectPrimaryKey('SyllabusGraduateAttribute', ['syllabusId', 'graduateAttributeId', 'position']);
    expectPrimaryKey('SyllabusRubricLevel', ['rubricId', 'level']);
    expectPrimaryKey('SyllabusCourseMapProgramOutcome', ['courseMapId', 'programOutcomeId']);
  });

  it('keeps immutable audit identities after live course and revision references are removed', () => {
    expect(getField('SyllabusMigrationAudit', 'originalCourseId')).toMatchObject({
      kind: 'scalar',
      type: 'String',
      isRequired: true,
    });
    expect(getField('SyllabusMigrationAudit', 'originalRevisionId')).toMatchObject({
      kind: 'scalar',
      type: 'String',
      isRequired: false,
    });
    expect(getField('SyllabusMigrationAuditCourseLink', 'auditId').isId).toBe(true);
    expect(getField('SyllabusMigrationAuditCourseLink', 'courseId')).toMatchObject({
      kind: 'scalar',
      type: 'String',
      isRequired: false,
    });
    expect(getField('SyllabusMigrationAuditCourseLink', 'course')).toMatchObject({
      kind: 'object',
      isRequired: false,
      relationFromFields: ['courseId'],
      relationToFields: ['id'],
    });
    expect(getField('SyllabusMigrationAuditRevisionLink', 'auditId').isId).toBe(true);
    expect(getField('SyllabusMigrationAuditRevisionLink', 'revisionId')).toMatchObject({
      kind: 'scalar',
      type: 'String',
      isRequired: false,
    });
    expect(getField('SyllabusMigrationAuditRevisionLink', 'revision')).toMatchObject({
      kind: 'object',
      isRequired: false,
      relationFromFields: ['revisionId'],
      relationToFields: ['id'],
    });
    expect(getModel('SyllabusMigrationAudit').fields.some((field) => field.name === 'syllabus')).toBe(false);
    expect(getField('Syllabus', 'migrationAuditRevisionLinks')).toMatchObject({
      kind: 'object',
      isList: true,
    });
  });

  it('uses explicit lineage and optional source-file relations plus owned cascades', () => {
    expect(getField('Syllabus', 'parent')).toMatchObject({
      kind: 'object',
      isList: false,
      isRequired: false,
      relationName: 'SyllabusParent',
      relationFromFields: ['parentSyllabusId'],
      relationToFields: ['id'],
    });
    expect(getField('Syllabus', 'children')).toMatchObject({
      kind: 'object',
      isList: true,
      relationName: 'SyllabusParent',
    });

    const sourceFile = getField('SyllabusSourceDocument', 'courseFile');
    expect(sourceFile).toMatchObject({
      kind: 'object',
      isList: false,
      isRequired: false,
      relationFromFields: ['courseFileId'],
      relationToFields: ['id'],
    });
    const inverse = getField('CourseFile', 'syllabusSourceDocuments');
    expect(inverse).toMatchObject({ kind: 'object', isList: true });
    expect(inverse.relationName).toBe(sourceFile.relationName);

    for (const [modelName, fieldName] of cascadeRelations) {
      expect(getField(modelName, fieldName), `${modelName}.${fieldName}`).toMatchObject({
        kind: 'object',
      });
    }
  });
});
