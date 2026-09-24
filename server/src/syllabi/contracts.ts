export type JsonRecord = Record<string, unknown>;

export type SyllabusStatus = 'draft' | 'published' | 'archived';
export type RequirementCategory = 'major' | 'other';
export type CourseMapLevel = 'I' | 'P' | 'D';
export type SignatoryRole = 'prepared' | 'recommendingApproval' | 'approved';
export type SourceDocumentType = 'pdf' | 'docx';

export type SyllabusSectionKey =
  | 'institution'
  | 'courseInfo'
  | 'faculty'
  | 'institutionalStatements'
  | 'programOutcomes'
  | 'courseOutcomes'
  | 'requirements'
  | 'gradingSystem'
  | 'rubrics'
  | 'policies'
  | 'outline'
  | 'learningPlan'
  | 'courseMap'
  | 'references'
  | 'signatories'
  | 'sourceDocument';

export interface SyllabusInstitution {
  university: string;
  college: string;
  formCode: string;
  revision: string;
}

export interface SyllabusCourseInfo {
  code: string;
  title: string;
  semester: string;
  academicYear: string;
  type: string;
  credit: string;
  lectureHours: string;
  labHours: string;
  prerequisite: string;
  description: string;
}

export interface SyllabusFacultySection {
  section: string;
  schedule: string;
  room: string;
}

export interface SyllabusFacultySchedule {
  name: string;
  sections: SyllabusFacultySection[];
  consultation: string;
}

export interface SyllabusCoreValue {
  acronym: string;
  keyword: string;
  description: string;
}

export interface SyllabusGraduateAttribute {
  number: number;
  title: string;
  description: string;
}

export interface SyllabusInstitutionalStatements {
  philosophy: string;
  vision: string;
  mission: string;
  goal: string;
  coreValues: SyllabusCoreValue[];
  graduateAttributes: SyllabusGraduateAttribute[];
}

export interface SyllabusProgramOutcome {
  number: number;
  description: string;
}

export interface SyllabusCourseOutcome {
  number: number;
  statement: string;
}

export interface SyllabusRequirements {
  major: string[];
  other: string[];
}

export interface SyllabusGradingSystem {
  termFormula: string;
  finalFormula: string;
  classStandingComponents: string[];
  passingGrade: string;
}

export interface SyllabusRubric {
  category: string;
  levels: Record<number, string>;
}

export interface SyllabusPolicy {
  text: string;
  position: number;
}

export interface SyllabusPolicyRow extends SyllabusPolicy {}

export interface SyllabusOutlineBlock {
  timeFrame: string;
  title: string;
  topics: string[];
}

export interface SyllabusSdgCoherence {
  goal: string;
  title: string;
  description: string;
  target?: string;
}

export interface SyllabusLearningPlanEntry {
  week: string;
  hoursLab: number;
  hoursLec: number;
  learningOutcomes: string[];
  topics: string[];
  methodology: string[];
  resources: string[];
  assessment: string[];
  sdgCoherence?: SyllabusSdgCoherence;
}

export interface SyllabusCourseMapEntry {
  coNumber: number;
  coStatement: string;
  poAlignments: Record<number, CourseMapLevel | ''>;
}

export interface SyllabusReference {
  citation: string;
  year: string;
  doiOrPublisher?: string;
}

export interface SyllabusSignatory {
  name: string;
  title: string;
}

export interface SyllabusSignatories {
  preparedBy: SyllabusSignatory[];
  recommendingApproval: SyllabusSignatory;
  approved: SyllabusSignatory;
}

export interface SyllabusSourceDocument {
  fileName: string;
  fileSize: string;
  fileType: SourceDocumentType;
  fileDataUrl?: string;
  uploadedAt: string;
  courseFileId?: string;
}

export interface SyllabusDocument extends Omit<OfficialSyllabusDataShape, 'courseId' | 'sourceDocument'> {
  courseId: string;
  sourceDocument?: SyllabusSourceDocument;
}

export interface OfficialSyllabusDataShape {
  courseId?: string;
  institution: SyllabusInstitution;
  courseInfo: SyllabusCourseInfo;
  facultyMembers: SyllabusFacultySchedule[];
  institutionalStatements: SyllabusInstitutionalStatements;
  programOutcomes: SyllabusProgramOutcome[];
  courseOutcomes: SyllabusCourseOutcome[];
  courseRequirements: SyllabusRequirements;
  gradingSystem: SyllabusGradingSystem;
  projectRubrics: SyllabusRubric[];
  classroomPolicies: string[];
  courseOutline: SyllabusOutlineBlock[];
  learningPlan: SyllabusLearningPlanEntry[];
  courseMap: SyllabusCourseMapEntry[];
  references: SyllabusReference[];
  signatories: SyllabusSignatories;
  sourceDocument?: SyllabusSourceDocument;
}

export interface SyllabusRevisionHeader {
  id: string;
  courseId: string;
  revisionNo: number;
  status: SyllabusStatus;
  schemaVersion: string;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface SyllabusInstitutionRow extends SyllabusInstitution {}

export interface SyllabusCourseInfoRow extends SyllabusCourseInfo {}

export interface SyllabusFacultySectionRow extends SyllabusFacultySection {
  position: number;
}

export interface SyllabusFacultyRow {
  name: string;
  sections: SyllabusFacultySectionRow[];
  consultation: string;
  position: number;
}

export type SyllabusFacultyMemberRow = SyllabusFacultyRow;

export interface SyllabusCoreValueRow extends SyllabusCoreValue {
  position: number;
}

export interface SyllabusGraduateAttributeRow extends SyllabusGraduateAttribute {
  position: number;
}

export interface SyllabusInstitutionalStatementsRow {
  philosophy: string;
  vision: string;
  mission: string;
  goal: string;
  coreValues: SyllabusCoreValueRow[];
  graduateAttributes: SyllabusGraduateAttributeRow[];
}

export interface SyllabusProgramOutcomeRow extends SyllabusProgramOutcome {
  position: number;
}

export interface SyllabusCourseOutcomeRow extends SyllabusCourseOutcome {
  position: number;
}

export interface SyllabusRequirementRow {
  category: RequirementCategory;
  text: string;
  position: number;
}

export interface SyllabusRequirementsRow {
  major: SyllabusRequirementRow[];
  other: SyllabusRequirementRow[];
}

export interface SyllabusGradingComponentRow {
  text: string;
  position: number;
}

export interface SyllabusGradingSystemRow {
  termFormula: string;
  finalFormula: string;
  classStandingComponents: SyllabusGradingComponentRow[];
  passingGrade: string;
}

export interface SyllabusRubricLevelRow {
  level: 1 | 2 | 3 | 4;
  description: string;
}

export interface SyllabusRubricRow extends Omit<SyllabusRubric, 'levels'> {
  position: number;
  levels: Record<number, string>;
  levelRows: SyllabusRubricLevelRow[];
}

export interface SyllabusOutlineTopicRow {
  text: string;
  position: number;
}

export interface SyllabusOutlineBlockRow extends Omit<SyllabusOutlineBlock, 'topics'> {
  position: number;
  topics: SyllabusOutlineTopicRow[];
}

export interface SyllabusLearningPlanTextRow {
  text: string;
  position: number;
}

export interface SyllabusLearningPlanRow extends Omit<SyllabusLearningPlanEntry, 'learningOutcomes' | 'topics' | 'methodology' | 'resources' | 'assessment'> {
  position: number;
  learningOutcomes: SyllabusLearningPlanTextRow[];
  topics: SyllabusLearningPlanTextRow[];
  methodology: SyllabusLearningPlanTextRow[];
  resources: SyllabusLearningPlanTextRow[];
  assessment: SyllabusLearningPlanTextRow[];
}

export interface SyllabusCourseMapLinkRow {
  programOutcomeNumber: number;
  level: CourseMapLevel;
  position: number;
}

export interface SyllabusCourseMapRow {
  coNumber: number;
  coStatement: string;
  position: number;
  poAlignments: SyllabusCourseMapLinkRow[];
}

export interface SyllabusReferenceRow extends Omit<SyllabusReference, 'doiOrPublisher'> {
  position: number;
  doiOrPublisher?: string;
}

export interface SyllabusSignatoryRow extends SyllabusSignatory {
  role: SignatoryRole;
  position: number;
}

export interface SyllabusSourceDocumentRow extends SyllabusSourceDocument {
  legacyPayload?: unknown;
}

export interface SyllabusExtensionField {
  path: string;
  value: unknown;
}

export interface SyllabusWriteModel extends SyllabusRevisionHeader {
  institution: SyllabusInstitutionRow;
  courseInfo: SyllabusCourseInfoRow;
  facultyMembers: SyllabusFacultyRow[];
  institutionalStatements: SyllabusInstitutionalStatementsRow;
  programOutcomes: SyllabusProgramOutcomeRow[];
  courseOutcomes: SyllabusCourseOutcomeRow[];
  courseRequirements: SyllabusRequirementsRow;
  gradingSystem: SyllabusGradingSystemRow;
  projectRubrics: SyllabusRubricRow[];
  policies: string[];
  policyRows: SyllabusPolicyRow[];
  courseOutline: SyllabusOutlineBlockRow[];
  learningPlan: SyllabusLearningPlanRow[];
  courseMap: SyllabusCourseMapRow[];
  references: SyllabusReferenceRow[];
  signatories: SyllabusSignatoryRow[];
  sourceDocument: SyllabusSourceDocumentRow | null;
  extensions: SyllabusExtensionField[];
}
