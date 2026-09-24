import '../src/env.js';

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type ColumnRow = { name: string };
type TableRow = { name: string };
type CheckConstraintRow = {
  name: string;
  parentTable: string;
  definition: string;
  isDisabled: boolean;
  isNotTrusted: boolean;
};
type ForeignKeyRow = {
  constraintName: string;
  parentTable: string;
  parentColumn: string;
  referencedTable: string;
  referencedColumn: string;
  deleteAction: number;
  updateAction: number;
  hasLeadingIndex: number;
};
type CountRow = { count: number };
type NullableIdRow = { courseFileId: string | null };
type JsonRow = { syllabus: string };
type AuditRow = {
  id: string;
  courseId: string | null;
  revisionId: string | null;
  originalCourseId: string;
  originalRevisionId: string | null;
  sourceChecksum: string;
};
type RollbackArtifactRow = {
  relationalTableCount: number;
  currentSyllabusColumnCount: number;
};
type CheckContract = {
  name: string;
  table: string;
  column: string;
  values?: readonly string[];
  minimum?: number;
  maximum?: number;
};
type ExpectedForeignKey = readonly [
  name: string,
  parentTable: string,
  parentColumn: string,
  referencedTable: string,
  referencedColumn: string,
  deleteAction: number,
  updateAction: number,
];
type DisposableDatabase = {
  name: string;
  cleanup: () => Promise<void>;
};

const expectedTables = [
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

const expectedCheckContracts = [
  { name: 'CK_Syllabus_status', table: 'Syllabus', column: 'status', values: ['draft', 'published', 'archived'] },
  { name: 'CK_SyllabusRequirement_category', table: 'SyllabusRequirement', column: 'category', values: ['major', 'other'] },
  {
    name: 'CK_SyllabusSignatory_role',
    table: 'SyllabusSignatory',
    column: 'role',
    values: ['prepared', 'recommendingApproval', 'approved'],
  },
  { name: 'CK_SyllabusRubricLevel_level', table: 'SyllabusRubricLevel', column: 'level', minimum: 1, maximum: 4 },
  {
    name: 'CK_SyllabusCourseMapProgramOutcome_level',
    table: 'SyllabusCourseMapProgramOutcome',
    column: 'level',
    values: ['I', 'P', 'D'],
  },
  { name: 'CK_SyllabusFaculty_position', table: 'SyllabusFaculty', column: 'position', minimum: 0 },
  {
    name: 'CK_SyllabusFacultySection_position',
    table: 'SyllabusFacultySection',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusRequirement_position',
    table: 'SyllabusRequirement',
    column: 'position',
    minimum: 0,
  },
  { name: 'CK_SyllabusPolicy_position', table: 'SyllabusPolicy', column: 'position', minimum: 0 },
  {
    name: 'CK_SyllabusGradingComponent_position',
    table: 'SyllabusGradingComponent',
    column: 'position',
    minimum: 0,
  },
  { name: 'CK_SyllabusRubric_position', table: 'SyllabusRubric', column: 'position', minimum: 0 },
  {
    name: 'CK_SyllabusProgramOutcome_position',
    table: 'SyllabusProgramOutcome',
    column: 'position',
    minimum: 0,
  },
  { name: 'CK_SyllabusCoreValue_position', table: 'SyllabusCoreValue', column: 'position', minimum: 0 },
  {
    name: 'CK_SyllabusGraduateAttribute_position',
    table: 'SyllabusGraduateAttribute',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusOutlineBlock_position',
    table: 'SyllabusOutlineBlock',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusOutlineTopic_position',
    table: 'SyllabusOutlineTopic',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusLearningPlan_position',
    table: 'SyllabusLearningPlan',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusLearningPlanOutcome_position',
    table: 'SyllabusLearningPlanOutcome',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusLearningPlanTopic_position',
    table: 'SyllabusLearningPlanTopic',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusLearningPlanMethod_position',
    table: 'SyllabusLearningPlanMethod',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusLearningPlanResource_position',
    table: 'SyllabusLearningPlanResource',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusLearningPlanAssessment_position',
    table: 'SyllabusLearningPlanAssessment',
    column: 'position',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusCourseOutcome_position',
    table: 'SyllabusCourseOutcome',
    column: 'position',
    minimum: 0,
  },
  { name: 'CK_SyllabusCourseMap_position', table: 'SyllabusCourseMap', column: 'position', minimum: 0 },
  {
    name: 'CK_SyllabusCourseMapProgramOutcome_position',
    table: 'SyllabusCourseMapProgramOutcome',
    column: 'position',
    minimum: 0,
  },
  { name: 'CK_SyllabusReference_position', table: 'SyllabusReference', column: 'position', minimum: 0 },
  { name: 'CK_SyllabusSignatory_position', table: 'SyllabusSignatory', column: 'position', minimum: 0 },
  {
    name: 'CK_SyllabusCourseInfo_lectureHours',
    table: 'SyllabusCourseInfo',
    column: 'lectureHours',
    minimum: 0,
  },
  { name: 'CK_SyllabusCourseInfo_labHours', table: 'SyllabusCourseInfo', column: 'labHours', minimum: 0 },
  {
    name: 'CK_SyllabusLearningPlan_hoursLab',
    table: 'SyllabusLearningPlan',
    column: 'hoursLab',
    minimum: 0,
  },
  {
    name: 'CK_SyllabusLearningPlan_hoursLec',
    table: 'SyllabusLearningPlan',
    column: 'hoursLec',
    minimum: 0,
  },
] as const satisfies readonly CheckContract[];

const expectedForeignKeys = [
  ['FK_Course_currentSyllabusId_Syllabus', 'Course', 'currentSyllabusId', 'Syllabus', 'id', 0, 0],
  ['FK_Syllabus_courseId_Course', 'Syllabus', 'courseId', 'Course', 'id', 1, 0],
  ['FK_Syllabus_parentSyllabusId_Syllabus', 'Syllabus', 'parentSyllabusId', 'Syllabus', 'id', 0, 0],
  [
    'FK_SyllabusProgramOutcome_syllabusId_Syllabus',
    'SyllabusProgramOutcome',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusProgramOutcome_programOutcomeId_ProgramOutcome',
    'SyllabusProgramOutcome',
    'programOutcomeId',
    'ProgramOutcome',
    'id',
    0,
    0,
  ],
  ['FK_SyllabusCoreValue_syllabusId_Syllabus', 'SyllabusCoreValue', 'syllabusId', 'Syllabus', 'id', 1, 0],
  ['FK_SyllabusCoreValue_coreValueId_CoreValue', 'SyllabusCoreValue', 'coreValueId', 'CoreValue', 'id', 0, 0],
  [
    'FK_SyllabusGraduateAttribute_syllabusId_Syllabus',
    'SyllabusGraduateAttribute',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusGraduateAttribute_graduateAttributeId_GraduateAttribute',
    'SyllabusGraduateAttribute',
    'graduateAttributeId',
    'GraduateAttribute',
    'id',
    0,
    0,
  ],
  [
    'FK_SyllabusInstitution_syllabusId_Syllabus',
    'SyllabusInstitution',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  ['FK_SyllabusCourseInfo_syllabusId_Syllabus', 'SyllabusCourseInfo', 'syllabusId', 'Syllabus', 'id', 1, 0],
  [
    'FK_SyllabusInstitutionalStatement_syllabusId_Syllabus',
    'SyllabusInstitutionalStatement',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusGradingSystem_syllabusId_Syllabus',
    'SyllabusGradingSystem',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusSourceDocument_syllabusId_Syllabus',
    'SyllabusSourceDocument',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusSourceDocument_courseFileId_CourseFile',
    'SyllabusSourceDocument',
    'courseFileId',
    'CourseFile',
    'id',
    2,
    0,
  ],
  ['FK_SyllabusFaculty_syllabusId_Syllabus', 'SyllabusFaculty', 'syllabusId', 'Syllabus', 'id', 1, 0],
  ['FK_SyllabusFaculty_userId_User', 'SyllabusFaculty', 'userId', 'User', 'id', 0, 0],
  [
    'FK_SyllabusFacultySection_facultyId_SyllabusFaculty',
    'SyllabusFacultySection',
    'facultyId',
    'SyllabusFaculty',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusFacultySection_courseSectionId_CourseSection',
    'SyllabusFacultySection',
    'courseSectionId',
    'CourseSection',
    'id',
    0,
    0,
  ],
  [
    'FK_SyllabusRequirement_syllabusId_Syllabus',
    'SyllabusRequirement',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  ['FK_SyllabusPolicy_syllabusId_Syllabus', 'SyllabusPolicy', 'syllabusId', 'Syllabus', 'id', 1, 0],
  [
    'FK_SyllabusGradingComponent_gradingSystemId_SyllabusGradingSystem',
    'SyllabusGradingComponent',
    'gradingSystemId',
    'SyllabusGradingSystem',
    'syllabusId',
    1,
    0,
  ],
  ['FK_SyllabusRubric_syllabusId_Syllabus', 'SyllabusRubric', 'syllabusId', 'Syllabus', 'id', 1, 0],
  [
    'FK_SyllabusRubricLevel_rubricId_SyllabusRubric',
    'SyllabusRubricLevel',
    'rubricId',
    'SyllabusRubric',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusOutlineBlock_syllabusId_Syllabus',
    'SyllabusOutlineBlock',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusOutlineTopic_outlineBlockId_SyllabusOutlineBlock',
    'SyllabusOutlineTopic',
    'outlineBlockId',
    'SyllabusOutlineBlock',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusLearningPlan_syllabusId_Syllabus',
    'SyllabusLearningPlan',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusLearningPlanOutcome_learningPlanId_SyllabusLearningPlan',
    'SyllabusLearningPlanOutcome',
    'learningPlanId',
    'SyllabusLearningPlan',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusLearningPlanTopic_learningPlanId_SyllabusLearningPlan',
    'SyllabusLearningPlanTopic',
    'learningPlanId',
    'SyllabusLearningPlan',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusLearningPlanMethod_learningPlanId_SyllabusLearningPlan',
    'SyllabusLearningPlanMethod',
    'learningPlanId',
    'SyllabusLearningPlan',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusLearningPlanResource_learningPlanId_SyllabusLearningPlan',
    'SyllabusLearningPlanResource',
    'learningPlanId',
    'SyllabusLearningPlan',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusLearningPlanAssessment_learningPlanId_SyllabusLearningPlan',
    'SyllabusLearningPlanAssessment',
    'learningPlanId',
    'SyllabusLearningPlan',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusLearningPlanSdg_learningPlanId_SyllabusLearningPlan',
    'SyllabusLearningPlanSdg',
    'learningPlanId',
    'SyllabusLearningPlan',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusCourseOutcome_syllabusId_Syllabus',
    'SyllabusCourseOutcome',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  ['FK_SyllabusCourseMap_syllabusId_Syllabus', 'SyllabusCourseMap', 'syllabusId', 'Syllabus', 'id', 1, 0],
  [
    'FK_SyllabusCourseMap_courseOutcomeId_SyllabusCourseOutcome',
    'SyllabusCourseMap',
    'courseOutcomeId',
    'SyllabusCourseOutcome',
    'id',
    0,
    0,
  ],
  [
    'FK_SyllabusCourseMapProgramOutcome_courseMapId_SyllabusCourseMap',
    'SyllabusCourseMapProgramOutcome',
    'courseMapId',
    'SyllabusCourseMap',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusCourseMapProgramOutcome_programOutcomeId_ProgramOutcome',
    'SyllabusCourseMapProgramOutcome',
    'programOutcomeId',
    'ProgramOutcome',
    'id',
    0,
    0,
  ],
  ['FK_SyllabusReference_syllabusId_Syllabus', 'SyllabusReference', 'syllabusId', 'Syllabus', 'id', 1, 0],
  ['FK_SyllabusSignatory_syllabusId_Syllabus', 'SyllabusSignatory', 'syllabusId', 'Syllabus', 'id', 1, 0],
  [
    'FK_SyllabusExtensionField_syllabusId_Syllabus',
    'SyllabusExtensionField',
    'syllabusId',
    'Syllabus',
    'id',
    1,
    0,
  ],
  [
    'FK_SyllabusMigrationAuditCourseLink_auditId_SyllabusMigrationAudit',
    'SyllabusMigrationAuditCourseLink',
    'auditId',
    'SyllabusMigrationAudit',
    'id',
    0,
    0,
  ],
  [
    'FK_SyllabusMigrationAuditCourseLink_courseId_Course',
    'SyllabusMigrationAuditCourseLink',
    'courseId',
    'Course',
    'id',
    2,
    0,
  ],
  [
    'FK_SyllabusMigrationAuditRevisionLink_auditId_SyllabusMigrationAudit',
    'SyllabusMigrationAuditRevisionLink',
    'auditId',
    'SyllabusMigrationAudit',
    'id',
    0,
    0,
  ],
  [
    'FK_SyllabusMigrationAuditRevisionLink_revisionId_Syllabus',
    'SyllabusMigrationAuditRevisionLink',
    'revisionId',
    'Syllabus',
    'id',
    2,
    0,
  ],
] as const satisfies readonly ExpectedForeignKey[];

const prismaCliPath = fileURLToPath(new URL('../../node_modules/prisma/build/index.js', import.meta.url));
const serverPath = fileURLToPath(new URL('../', import.meta.url));
const schemaPath = fileURLToPath(new URL('./schema.prisma', import.meta.url));
const migrationsPath = fileURLToPath(new URL('./migrations/', import.meta.url));
const targetMigrationName = '20260924120000_add_relational_syllabus';
const targetMigrationPath = path.join(migrationsPath, targetMigrationName, 'migration.sql');
const databaseName = `Gabay_RelationalSyllabus_${process.pid}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
let database: PrismaClient | undefined;
let cleanupMainDatabase: (() => Promise<void>) | undefined;

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error('DATABASE_URL is required for SQL Server migration integration tests');

const serverMatch = configuredUrl.match(/^sqlserver:\/\/([^:;]+)(?::(\d+))?;/i);
if (!serverMatch) throw new Error('DATABASE_URL must identify a SQL Server host');
const sqlServer = serverMatch[2] ? `${serverMatch[1]},${serverMatch[2]}` : (serverMatch[1] as string);
const loginMatch = configuredUrl.match(/[?&;]user=([^;&]+)/i);
if (!loginMatch) throw new Error('DATABASE_URL must identify a SQL login for disposable database provisioning');
const configuredLogin = decodeURIComponent(loginMatch[1] as string);
const quoteIdentifier = (value: string): string => value.replace(/]/g, ']]');
const quoteLiteral = (value: string): string => value.replace(/'/g, "''");

const withDatabase = (url: string, name: string): string => {
  const updated = url.replace(/([?&;]database=)[^;&]+/i, `$1${name}`);
  if (updated === url) throw new Error('DATABASE_URL must contain a database parameter');
  return updated;
};

const runMigration = async (targetSchemaPath: string, targetDatabaseName: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [prismaCliPath, 'migrate', 'deploy', '--schema', targetSchemaPath],
      {
        cwd: serverPath,
        env: { ...process.env, DATABASE_URL: withDatabase(configuredUrl as string, targetDatabaseName) },
        windowsHide: true,
      },
    );
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Disposable Prisma migration failed with exit code ${String(code)}:\n${output}`));
    });
  });
};

const runSqlcmd = async (sql: string): Promise<void> => {
  if (process.platform !== 'win32') throw new Error('Windows sqlcmd is required to provision the disposable SQL Server database');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('sqlcmd.exe', ['-S', sqlServer, '-E', '-d', 'master', '-b', '-Q', sql], {
      windowsHide: true,
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sqlcmd failed with exit code ${String(code)}:\n${output}`));
    });
  });
};

const provisionWithSqlcmd = async (name: string): Promise<void> => {
  const databaseIdentifier = quoteIdentifier(name);
  const databaseLiteral = quoteLiteral(name);
  const loginLiteral = quoteLiteral(configuredLogin);
  await runSqlcmd(`
    IF DB_ID(N'${databaseLiteral}') IS NOT NULL
    BEGIN
      ALTER DATABASE [${databaseIdentifier}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
      DROP DATABASE [${databaseIdentifier}];
    END;
    CREATE DATABASE [${databaseIdentifier}];
    DECLARE @grantSql NVARCHAR(MAX) =
      N'USE ' + QUOTENAME(N'${databaseLiteral}') +
      N'; CREATE USER ' + QUOTENAME(N'${loginLiteral}') +
      N' FOR LOGIN ' + QUOTENAME(N'${loginLiteral}') +
      N'; ALTER ROLE [db_owner] ADD MEMBER ' + QUOTENAME(N'${loginLiteral}') + N';';
    EXEC sys.sp_executesql @grantSql;
  `);
};

const dropDatabase = async (name: string, provisionedWithSqlcmd: boolean): Promise<void> => {
  if (provisionedWithSqlcmd) {
    await runSqlcmd(`
      IF DB_ID(N'${quoteLiteral(name)}') IS NOT NULL
      BEGIN
        DECLARE @dropSql NVARCHAR(MAX) =
          N'ALTER DATABASE ' + QUOTENAME(N'${quoteLiteral(name)}') +
          N' SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ' +
          QUOTENAME(N'${quoteLiteral(name)}') + N';';
        EXEC sys.sp_executesql @dropSql;
      END;
    `);
    return;
  }
  const master = new PrismaClient({ datasourceUrl: withDatabase(configuredUrl as string, 'master') });
  try {
    await master.$executeRawUnsafe(`ALTER DATABASE [${name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
    await master.$executeRawUnsafe(`DROP DATABASE [${name}]`);
  } finally {
    await master.$disconnect();
  }
};

const provisionDatabase = async (name: string): Promise<DisposableDatabase> => {
  let provisionedWithSqlcmd = false;
  const master = new PrismaClient({ datasourceUrl: withDatabase(configuredUrl as string, 'master') });
  try {
    await master.$executeRawUnsafe(`CREATE DATABASE [${name}]`);
  } catch (error) {
    if (!String(error).includes('CREATE DATABASE permission denied')) throw error;
    provisionedWithSqlcmd = true;
  } finally {
    await master.$disconnect();
  }
  if (provisionedWithSqlcmd) {
    try {
      await provisionWithSqlcmd(name);
    } catch (error) {
      await dropDatabase(name, true);
      throw error;
    }
  }
  let cleaned = false;
  return {
    name,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      await dropDatabase(name, provisionedWithSqlcmd);
    },
  };
};

const expectConstraintViolation = async (sql: string, constraintName: string): Promise<void> => {
  const error = await (database as PrismaClient)
    .$executeRawUnsafe(sql)
    .then(() => null)
    .catch((reason: unknown) => reason);
  expect(error, `Expected ${constraintName} to reject the statement`).toBeInstanceOf(Error);
  expect(String(error)).toContain(constraintName);
};

const normalizeCheckDefinition = (definition: string): string =>
  definition.toLowerCase().replace(/[\[\]()\s]/g, '').replace(/n'/g, "'");

beforeAll(async () => {
  const disposable = await provisionDatabase(databaseName);
  cleanupMainDatabase = disposable.cleanup;
  try {
    await runMigration(schemaPath, disposable.name);
    database = new PrismaClient({ datasourceUrl: withDatabase(configuredUrl as string, disposable.name) });
    await database.$connect();
  } catch (error) {
    if (database) await database.$disconnect();
    await cleanupMainDatabase();
    throw error;
  }
}, 180_000);

afterAll(async () => {
  if (database) await database.$disconnect();
  if (cleanupMainDatabase) await cleanupMainDatabase();
});

describe('relational syllabus SQL Server migration', () => {
  it('enforces the complete schema and preserves audit snapshots through deletion', async () => {
    const client = database as PrismaClient;

    const columns = await client.$queryRawUnsafe<ColumnRow>(
      `SELECT [name] FROM sys.columns WHERE [object_id] = OBJECT_ID(N'dbo.Course')`,
    );
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['syllabus', 'currentSyllabusId']),
    );

    const tables = await client.$queryRawUnsafe<TableRow>(
      `SELECT [name] FROM sys.tables WHERE [schema_id] = SCHEMA_ID(N'dbo')`,
    );
    const tableNames = tables.map((table) => table.name);
    expect(expectedTables.filter((table) => !tableNames.includes(table))).toEqual([]);

    const checks = await client.$queryRawUnsafe<CheckConstraintRow>(`
      SELECT
        [name],
        OBJECT_NAME([parent_object_id]) AS [parentTable],
        [definition],
        [is_disabled] AS [isDisabled],
        [is_not_trusted] AS [isNotTrusted]
      FROM sys.check_constraints
    `);
    for (const contract of expectedCheckContracts) {
      const check = checks.find((candidate) => candidate.name === contract.name);
      expect(check, contract.name).toMatchObject({
        parentTable: contract.table,
        isDisabled: false,
        isNotTrusted: false,
      });
      const definition = normalizeCheckDefinition(check?.definition ?? '');
      const normalizedColumn = contract.column.toLowerCase();
      expect(definition, contract.name).toContain(normalizedColumn);
      if (contract.values) {
        const actualValues = [...definition.matchAll(/'([^']*)'/g)].map((match) => match[1]);
        expect(new Set(actualValues), contract.name).toEqual(
          new Set(contract.values.map((value) => value.toLowerCase())),
        );
      }
      if (contract.minimum !== undefined && contract.maximum !== undefined) {
        expect(definition, contract.name).toContain(`${normalizedColumn}>=${contract.minimum}`);
        expect(definition, contract.name).toContain(`${normalizedColumn}<=${contract.maximum}`);
      } else if (contract.minimum !== undefined) {
        expect(definition, contract.name).toContain(`${normalizedColumn}>=${contract.minimum}`);
      }
    }

    const foreignKeys = await client.$queryRawUnsafe<ForeignKeyRow>(`
      SELECT
        fk.[name] AS [constraintName],
        OBJECT_NAME(fk.[parent_object_id]) AS [parentTable],
        parentColumn.[name] AS [parentColumn],
        OBJECT_NAME(fk.[referenced_object_id]) AS [referencedTable],
        referencedColumn.[name] AS [referencedColumn],
        fk.[delete_referential_action] AS [deleteAction],
        fk.[update_referential_action] AS [updateAction],
        CASE WHEN EXISTS (
          SELECT 1
          FROM sys.indexes AS indexInfo
          JOIN sys.index_columns AS indexColumn
            ON indexColumn.[object_id] = indexInfo.[object_id]
           AND indexColumn.[index_id] = indexInfo.[index_id]
          WHERE indexInfo.[object_id] = fk.[parent_object_id]
            AND indexColumn.[key_ordinal] = 1
            AND indexColumn.[column_id] = parentColumn.[column_id]
        ) THEN 1 ELSE 0 END AS [hasLeadingIndex]
      FROM sys.foreign_keys AS fk
      JOIN sys.foreign_key_columns AS parentColumnMapping
        ON parentColumnMapping.[constraint_object_id] = fk.[object_id]
      JOIN sys.columns AS parentColumn
        ON parentColumn.[object_id] = fk.[parent_object_id]
       AND parentColumn.[column_id] = parentColumnMapping.[parent_column_id]
      JOIN sys.foreign_key_columns AS referencedColumnMapping
        ON referencedColumnMapping.[constraint_object_id] = fk.[object_id]
       AND referencedColumnMapping.[constraint_column_id] = parentColumnMapping.[constraint_column_id]
      JOIN sys.columns AS referencedColumn
        ON referencedColumn.[object_id] = fk.[referenced_object_id]
       AND referencedColumn.[column_id] = referencedColumnMapping.[referenced_column_id]
    `);
    const newForeignKeys = foreignKeys.filter(
      (foreignKey) =>
        expectedTables.includes(foreignKey.parentTable as (typeof expectedTables)[number]) ||
        (foreignKey.parentTable === 'Course' && foreignKey.parentColumn === 'currentSyllabusId'),
    );
    expect(newForeignKeys.map((foreignKey) => foreignKey.constraintName).sort()).toEqual(
      expectedForeignKeys.map(([name]) => name).sort(),
    );
    for (const [name, parentTable, parentColumn, referencedTable, referencedColumn, deleteAction, updateAction] of
      expectedForeignKeys) {
      expect(newForeignKeys.find((foreignKey) => foreignKey.constraintName === name), name).toMatchObject({
        parentTable,
        parentColumn,
        referencedTable,
        referencedColumn,
        deleteAction,
        updateAction,
        hasLeadingIndex: 1,
      });
    }

    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[User]
        ([id], [name], [email], [passwordHash], [role], [avatar], [department], [title])
      VALUES
        (N'integration-user', N'Integration User', N'integration@example.test', N'hash', N'faculty', N'', N'Test', N'Professor')
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[Course]
        ([id], [code], [title], [section], [term], [instructorId], [instructorName], [published], [enrolledCount], [joinCode], [syllabus])
      VALUES
        (N'integration-course', N'TST101', N'Integration Course', N'A', N'2026', N'integration-user', N'Integration User', 0, 0, N'JOIN001', N'{"legacy":true}')
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[Course]
        ([id], [code], [title], [section], [term], [instructorId], [instructorName], [published], [enrolledCount], [joinCode], [syllabus])
      VALUES
        (N'integration-course-2', N'TST102', N'Integration Course Two', N'A', N'2026', N'integration-user', N'Integration User', 0, 0, N'JOIN002', NULL)
    `);

    const legacy = await client.$queryRawUnsafe<JsonRow>(
      `SELECT [syllabus] FROM [dbo].[Course] WHERE [id] = N'integration-course'`,
    );
    expect(legacy[0].syllabus).toBe('{"legacy":true}');

    await expectConstraintViolation(
      `INSERT INTO [dbo].[Syllabus]
        ([id], [courseId], [revisionNo], [status], [schemaVersion], [rowVersion], [createdById], [createdAt], [updatedAt])
      VALUES
        (N'invalid-status', N'integration-course', 99, N'invalid', N'1', 1, N'integration-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      'CK_Syllabus_status',
    );

    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[Syllabus]
        ([id], [courseId], [revisionNo], [status], [schemaVersion], [rowVersion], [createdById], [createdAt], [updatedAt])
      VALUES
        (N'integration-syllabus', N'integration-course', 1, N'draft', N'1', 1, N'integration-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    await client.$executeRawUnsafe(
      `UPDATE [dbo].[Course] SET [currentSyllabusId] = N'integration-syllabus' WHERE [id] = N'integration-course'`,
    );

    await expectConstraintViolation(
      `INSERT INTO [dbo].[SyllabusCourseInfo]
        ([syllabusId], [code], [title], [semester], [academicYear], [type], [credit], [lectureHours], [labHours], [prerequisite], [description])
      VALUES
        (N'integration-syllabus', N'TST101', N'Integration Course', N'Fall', N'2026', N'Lecture', N'3', -1, 0, N'', N'')`,
      'CK_SyllabusCourseInfo_lectureHours',
    );
    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[SyllabusCourseInfo]
        ([syllabusId], [code], [title], [semester], [academicYear], [type], [credit], [lectureHours], [labHours], [prerequisite], [description])
      VALUES
        (N'integration-syllabus', N'TST101', N'Integration Course', N'Fall', N'2026', N'Lecture', N'3', 3, 0, N'', N'')
    `);

    await expectConstraintViolation(
      `INSERT INTO [dbo].[SyllabusRequirement]
        ([id], [syllabusId], [category], [text], [position])
      VALUES
        (N'invalid-requirement', N'integration-syllabus', N'invalid', N'Requirement', 0)`,
      'CK_SyllabusRequirement_category',
    );
    await expectConstraintViolation(
      `INSERT INTO [dbo].[SyllabusPolicy]
        ([id], [syllabusId], [text], [position])
      VALUES
        (N'invalid-policy-position', N'integration-syllabus', N'Policy', -1)`,
      'CK_SyllabusPolicy_position',
    );
    await expectConstraintViolation(
      `INSERT INTO [dbo].[SyllabusSignatory]
        ([id], [syllabusId], [role], [name], [title], [position])
      VALUES
        (N'invalid-signatory', N'integration-syllabus', N'invalid', N'Name', N'Title', 0)`,
      'CK_SyllabusSignatory_role',
    );

    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[SyllabusRubric]
        ([id], [syllabusId], [category], [position])
      VALUES
        (N'integration-rubric', N'integration-syllabus', N'Project', 0)
    `);
    await expectConstraintViolation(
      `INSERT INTO [dbo].[SyllabusRubricLevel]
        ([rubricId], [level], [description])
      VALUES
        (N'integration-rubric', 0, N'Invalid lower level')`,
      'CK_SyllabusRubricLevel_level',
    );
    await expectConstraintViolation(
      `INSERT INTO [dbo].[SyllabusRubricLevel]
        ([rubricId], [level], [description])
      VALUES
        (N'integration-rubric', 5, N'Invalid upper level')`,
      'CK_SyllabusRubricLevel_level',
    );

    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[ProgramOutcome]
        ([id], [number], [description], [catalogVersion], [createdAt], [updatedAt])
      VALUES
        (N'integration-program-outcome', 1, N'Program outcome', N'2026', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[SyllabusCourseOutcome]
        ([id], [syllabusId], [number], [statement], [position])
      VALUES
        (N'integration-course-outcome', N'integration-syllabus', 1, N'Course outcome', 0)
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[SyllabusCourseMap]
        ([id], [syllabusId], [courseOutcomeId], [coNumber], [coStatement], [position])
      VALUES
        (N'integration-course-map', N'integration-syllabus', N'integration-course-outcome', 1, N'Historical statement', 0)
    `);
    await expectConstraintViolation(
      `INSERT INTO [dbo].[SyllabusCourseMapProgramOutcome]
        ([courseMapId], [programOutcomeId], [level], [position])
      VALUES
        (N'integration-course-map', N'integration-program-outcome', N'X', 0)`,
      'CK_SyllabusCourseMapProgramOutcome_level',
    );

    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[Syllabus]
        ([id], [courseId], [revisionNo], [status], [schemaVersion], [rowVersion], [createdById], [createdAt], [updatedAt])
      VALUES
        (N'integration-draft-two', N'integration-course', 2, N'draft', N'1', 1, N'integration-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (N'integration-archived-three', N'integration-course', 3, N'archived', N'1', 1, N'integration-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (N'integration-archived-four', N'integration-course', 4, N'archived', N'1', 1, N'integration-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[Syllabus]
        ([id], [courseId], [revisionNo], [status], [schemaVersion], [rowVersion], [createdById], [createdAt], [updatedAt], [publishedAt])
      VALUES
        (N'integration-first-published', N'integration-course', 5, N'published', N'1', 1, N'integration-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (N'integration-other-course-published', N'integration-course-2', 1, N'published', N'1', 1, N'integration-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    await client.$executeRawUnsafe(`
      UPDATE [dbo].[Course]
      SET [currentSyllabusId] = N'integration-other-course-published'
      WHERE [id] = N'integration-course-2'
    `);
    await expectConstraintViolation(
      `UPDATE [dbo].[Course]
      SET [currentSyllabusId] = N'integration-other-course-published'
      WHERE [id] = N'integration-course'`,
      'Course_currentSyllabusId_key',
    );
    const permittedRevisions = await client.$queryRawUnsafe<CountRow>(`
      SELECT [status], COUNT(*) AS [count]
      FROM [dbo].[Syllabus]
      WHERE [id] IN (
        N'integration-syllabus',
        N'integration-draft-two',
        N'integration-archived-three',
        N'integration-archived-four',
        N'integration-first-published',
        N'integration-other-course-published'
      )
      GROUP BY [status]
    `);
    expect(permittedRevisions).toEqual(
      expect.arrayContaining([
        { status: 'draft', count: 2 },
        { status: 'archived', count: 2 },
        { status: 'published', count: 2 },
      ]),
    );
    await expectConstraintViolation(
      `INSERT INTO [dbo].[Syllabus]
        ([id], [courseId], [revisionNo], [status], [schemaVersion], [rowVersion], [createdById], [createdAt], [updatedAt], [publishedAt])
      VALUES
        (N'integration-second-published', N'integration-course', 6, N'published', N'1', 1, N'integration-user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      'Syllabus_courseId_status_published_key',
    );

    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[CourseFile]
        ([id], [courseId], [name], [size], [formattedSize], [type], [visibility], [updatedAt], [uploadedBy], [uploadedByName])
      VALUES
        (N'integration-file', N'integration-course', N'syllabus.pdf', 1, N'1 B', N'application/pdf', N'course', CURRENT_TIMESTAMP, N'integration-user', N'Integration User')
    `);
    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[SyllabusSourceDocument]
        ([syllabusId], [fileName], [fileSize], [fileType], [uploadedAt], [courseFileId])
      VALUES
        (N'integration-syllabus', N'syllabus.pdf', N'1 B', N'pdf', CURRENT_TIMESTAMP, N'integration-file')
    `);
    await client.$executeRawUnsafe(`DELETE FROM [dbo].[CourseFile] WHERE [id] = N'integration-file'`);
    const sourceDocument = await client.$queryRawUnsafe<NullableIdRow>(
      `SELECT [courseFileId] FROM [dbo].[SyllabusSourceDocument] WHERE [syllabusId] = N'integration-syllabus'`,
    );
    expect(sourceDocument).toEqual([{ courseFileId: null }]);

    const rollbackId = `rollback-${randomUUID()}`;
    await expect(
      client.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(`
          INSERT INTO [dbo].[User]
            ([id], [name], [email], [passwordHash], [role], [avatar], [department], [title])
          VALUES
            (N'${rollbackId}', N'Rollback User', N'rollback-${randomUUID()}@example.test', N'hash', N'faculty', N'', N'Test', N'Professor')
        `);
        throw new Error('rollback-probe');
      }),
    ).rejects.toThrow('rollback-probe');
    const rolledBack = await client.$queryRawUnsafe<CountRow>(
      `SELECT COUNT(*) AS [count] FROM [dbo].[User] WHERE [id] = N'${rollbackId}'`,
    );
    expect(rolledBack[0].count).toBe(0);

    await client.$executeRawUnsafe(`
      INSERT INTO [dbo].[SyllabusMigrationAudit]
        ([id], [originalCourseId], [originalRevisionId], [sourceChecksum], [status], [createdAt], [updatedAt])
      VALUES
        (N'audit-one', N'integration-course', N'integration-syllabus', N'shared-checksum', N'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (N'audit-two', N'integration-course-2', N'integration-other-course-published', N'shared-checksum', N'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO [dbo].[SyllabusMigrationAuditCourseLink]
        ([auditId], [courseId])
      VALUES
        (N'audit-one', N'integration-course'),
        (N'audit-two', N'integration-course-2');
      INSERT INTO [dbo].[SyllabusMigrationAuditRevisionLink]
        ([auditId], [revisionId])
      VALUES
        (N'audit-one', N'integration-syllabus'),
        (N'audit-two', N'integration-other-course-published');
    `);

    await client.$executeRawUnsafe(
      `UPDATE [dbo].[Course] SET [currentSyllabusId] = NULL WHERE [id] = N'integration-course'`,
    );
    await client.$executeRawUnsafe(`DELETE FROM [dbo].[Syllabus] WHERE [id] = N'integration-syllabus'`);
    const auditAfterRevisionDelete = await client.$queryRawUnsafe<AuditRow>(`
      SELECT
        audit.[id],
        courseLink.[courseId],
        revisionLink.[revisionId],
        audit.[originalCourseId],
        audit.[originalRevisionId],
        audit.[sourceChecksum]
      FROM [dbo].[SyllabusMigrationAudit] AS audit
      LEFT JOIN [dbo].[SyllabusMigrationAuditCourseLink] AS courseLink
        ON courseLink.[auditId] = audit.[id]
      LEFT JOIN [dbo].[SyllabusMigrationAuditRevisionLink] AS revisionLink
        ON revisionLink.[auditId] = audit.[id]
      WHERE audit.[id] = N'audit-one'
    `);
    expect(auditAfterRevisionDelete).toEqual([
      {
        id: 'audit-one',
        courseId: 'integration-course',
        revisionId: null,
        originalCourseId: 'integration-course',
        originalRevisionId: 'integration-syllabus',
        sourceChecksum: 'shared-checksum',
      },
    ]);

    await client.$executeRawUnsafe(`
      DELETE FROM [dbo].[Course]
      WHERE [id] IN (N'integration-course', N'integration-course-2')
    `);
    const remainingAudits = await client.$queryRawUnsafe<AuditRow>(`
      SELECT
        audit.[id],
        courseLink.[courseId],
        revisionLink.[revisionId],
        audit.[originalCourseId],
        audit.[originalRevisionId],
        audit.[sourceChecksum]
      FROM [dbo].[SyllabusMigrationAudit] AS audit
      LEFT JOIN [dbo].[SyllabusMigrationAuditCourseLink] AS courseLink
        ON courseLink.[auditId] = audit.[id]
      LEFT JOIN [dbo].[SyllabusMigrationAuditRevisionLink] AS revisionLink
        ON revisionLink.[auditId] = audit.[id]
      ORDER BY audit.[id]
    `);
    expect(remainingAudits).toEqual([
      {
        id: 'audit-one',
        courseId: null,
        revisionId: null,
        originalCourseId: 'integration-course',
        originalRevisionId: 'integration-syllabus',
        sourceChecksum: 'shared-checksum',
      },
      {
        id: 'audit-two',
        courseId: null,
        revisionId: null,
        originalCourseId: 'integration-course-2',
        originalRevisionId: 'integration-other-course-published',
        sourceChecksum: 'shared-checksum',
      },
    ]);
    const cascaded = await client.$queryRawUnsafe<CountRow>(
      `SELECT COUNT(*) AS [count] FROM [dbo].[Syllabus] WHERE [courseId] IN (N'integration-course', N'integration-course-2')`,
    );
    expect(cascaded[0].count).toBe(0);
  }, 120_000);

  it('rolls back every schema change when the migration transaction fails', async () => {
    const rollbackDatabaseName = `${databaseName}_rollback`;
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'gabay-relational-syllabus-'));
    const temporarySchemaPath = path.join(temporaryRoot, 'schema.prisma');
    const temporaryMigrationsPath = path.join(temporaryRoot, 'migrations');
    let disposable: DisposableDatabase | undefined;
    let rollbackDatabase: PrismaClient | undefined;

    try {
      await cp(schemaPath, temporarySchemaPath);
      await cp(migrationsPath, temporaryMigrationsPath, { recursive: true });
      const temporaryMigrationPath = path.join(
        temporaryMigrationsPath,
        targetMigrationName,
        'migration.sql',
      );
      const migrationSql = await readFile(targetMigrationPath, 'utf8');
      const commitMarker = '\nCOMMIT TRAN;';
      const commitIndex = migrationSql.lastIndexOf(commitMarker);
      expect(commitIndex).toBeGreaterThan(0);
      const failingMigrationSql = `${migrationSql.slice(0, commitIndex)}\nTHROW 50000, 'forced migration failure', 1;${migrationSql.slice(commitIndex)}`;
      await writeFile(temporaryMigrationPath, failingMigrationSql);

      disposable = await provisionDatabase(rollbackDatabaseName);
      await expect(runMigration(temporarySchemaPath, disposable.name)).rejects.toThrow('forced migration failure');

      rollbackDatabase = new PrismaClient({
        datasourceUrl: withDatabase(configuredUrl as string, disposable.name),
      });
      await rollbackDatabase.$connect();
      const relationalTableNames = expectedTables.map((name) => `N'${name}'`).join(',');
      const artifacts = await rollbackDatabase.$queryRawUnsafe<RollbackArtifactRow>(`
        SELECT
          (SELECT COUNT(*) FROM sys.tables WHERE [name] IN (${relationalTableNames})) AS [relationalTableCount],
          CASE WHEN COL_LENGTH(N'dbo.Course', N'currentSyllabusId') IS NULL THEN 0 ELSE 1 END AS [currentSyllabusColumnCount]
      `);
      expect(artifacts).toEqual([{ relationalTableCount: 0, currentSyllabusColumnCount: 0 }]);
    } finally {
      if (rollbackDatabase) await rollbackDatabase.$disconnect();
      if (disposable) await disposable.cleanup();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 180_000);
});
