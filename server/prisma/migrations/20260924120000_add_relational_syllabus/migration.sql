BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[Course] ADD [currentSyllabusId] NVARCHAR(64) NULL;

CREATE TABLE [dbo].[ProgramOutcome] (
    [id] NVARCHAR(64) NOT NULL,
    [number] INT NOT NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    [catalogVersion] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_ProgramOutcome_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2(3) NOT NULL,
    CONSTRAINT [ProgramOutcome_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProgramOutcome_catalogVersion_number_key] UNIQUE NONCLUSTERED ([catalogVersion], [number])
);

CREATE TABLE [dbo].[CoreValue] (
    [id] NVARCHAR(64) NOT NULL,
    [acronym] NVARCHAR(64) NOT NULL,
    [keyword] NVARCHAR(256) NOT NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    [catalogVersion] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_CoreValue_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2(3) NOT NULL,
    CONSTRAINT [CoreValue_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CoreValue_catalogVersion_acronym_key] UNIQUE NONCLUSTERED ([catalogVersion], [acronym])
);

CREATE TABLE [dbo].[GraduateAttribute] (
    [id] NVARCHAR(64) NOT NULL,
    [number] INT NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    [catalogVersion] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_GraduateAttribute_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2(3) NOT NULL,
    CONSTRAINT [GraduateAttribute_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GraduateAttribute_catalogVersion_number_key] UNIQUE NONCLUSTERED ([catalogVersion], [number])
);

CREATE TABLE [dbo].[Syllabus] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [parentSyllabusId] NVARCHAR(64) NULL,
    [revisionNo] INT NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [DF_Syllabus_status] DEFAULT N'draft',
    [schemaVersion] NVARCHAR(32) NOT NULL CONSTRAINT [DF_Syllabus_schemaVersion] DEFAULT N'1',
    [rowVersion] INT NOT NULL CONSTRAINT [DF_Syllabus_rowVersion] DEFAULT 1,
    [createdById] NVARCHAR(64) NOT NULL,
    [publishedById] NVARCHAR(64) NULL,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_Syllabus_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2(3) NOT NULL,
    [publishedAt] DATETIME2(3) NULL,
    CONSTRAINT [Syllabus_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Syllabus_courseId_revisionNo_key] UNIQUE NONCLUSTERED ([courseId], [revisionNo])
);

CREATE TABLE [dbo].[SyllabusProgramOutcome] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [programOutcomeId] NVARCHAR(64) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusProgramOutcome_pkey] PRIMARY KEY CLUSTERED ([syllabusId], [programOutcomeId], [position]),
    CONSTRAINT [SyllabusProgramOutcome_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusCoreValue] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [coreValueId] NVARCHAR(64) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusCoreValue_pkey] PRIMARY KEY CLUSTERED ([syllabusId], [coreValueId], [position]),
    CONSTRAINT [SyllabusCoreValue_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusGraduateAttribute] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [graduateAttributeId] NVARCHAR(64) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusGraduateAttribute_pkey] PRIMARY KEY CLUSTERED ([syllabusId], [graduateAttributeId], [position]),
    CONSTRAINT [SyllabusGraduateAttribute_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusInstitution] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [university] NVARCHAR(256) NOT NULL,
    [college] NVARCHAR(256) NOT NULL,
    [formCode] NVARCHAR(64) NOT NULL,
    [revision] NVARCHAR(64) NOT NULL,
    CONSTRAINT [SyllabusInstitution_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

CREATE TABLE [dbo].[SyllabusCourseInfo] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [semester] NVARCHAR(128) NOT NULL,
    [academicYear] NVARCHAR(64) NOT NULL,
    [type] NVARCHAR(128) NOT NULL,
    [credit] NVARCHAR(32) NOT NULL,
    [lectureHours] INT NOT NULL,
    [labHours] INT NOT NULL,
    [prerequisite] NVARCHAR(MAX) NOT NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [SyllabusCourseInfo_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

CREATE TABLE [dbo].[SyllabusInstitutionalStatement] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [philosophy] NVARCHAR(MAX) NOT NULL,
    [vision] NVARCHAR(MAX) NOT NULL,
    [mission] NVARCHAR(MAX) NOT NULL,
    [goal] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [SyllabusInstitutionalStatement_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

CREATE TABLE [dbo].[SyllabusGradingSystem] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [termFormula] NVARCHAR(256) NOT NULL,
    [finalFormula] NVARCHAR(256) NOT NULL,
    [passingGrade] NVARCHAR(64) NOT NULL,
    CONSTRAINT [SyllabusGradingSystem_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

CREATE TABLE [dbo].[SyllabusSourceDocument] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [fileName] NVARCHAR(256) NOT NULL,
    [fileSize] NVARCHAR(32) NOT NULL,
    [fileType] NVARCHAR(32) NOT NULL,
    [uploadedAt] DATETIME2(3) NOT NULL,
    [fileDataUrl] NVARCHAR(MAX) NULL,
    [legacyPayload] NVARCHAR(MAX) NULL,
    [courseFileId] NVARCHAR(64) NULL,
    CONSTRAINT [SyllabusSourceDocument_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

CREATE TABLE [dbo].[SyllabusFaculty] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(256) NOT NULL,
    [consultation] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    [userId] NVARCHAR(64) NULL,
    CONSTRAINT [SyllabusFaculty_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusFaculty_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusFacultySection] (
    [id] NVARCHAR(64) NOT NULL,
    [facultyId] NVARCHAR(64) NOT NULL,
    [section] NVARCHAR(128) NOT NULL,
    [schedule] NVARCHAR(256) NOT NULL,
    [room] NVARCHAR(256) NOT NULL,
    [position] INT NOT NULL,
    [courseSectionId] NVARCHAR(64) NULL,
    CONSTRAINT [SyllabusFacultySection_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusFacultySection_facultyId_position_key] UNIQUE NONCLUSTERED ([facultyId], [position])
);

CREATE TABLE [dbo].[SyllabusRequirement] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [category] NVARCHAR(32) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusRequirement_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusRequirement_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusPolicy] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusPolicy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusPolicy_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusGradingComponent] (
    [id] NVARCHAR(64) NOT NULL,
    [gradingSystemId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusGradingComponent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusGradingComponent_gradingSystemId_position_key] UNIQUE NONCLUSTERED ([gradingSystemId], [position])
);

CREATE TABLE [dbo].[SyllabusRubric] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [category] NVARCHAR(256) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusRubric_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusRubric_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusRubricLevel] (
    [rubricId] NVARCHAR(64) NOT NULL,
    [level] INT NOT NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT [SyllabusRubricLevel_pkey] PRIMARY KEY CLUSTERED ([rubricId], [level])
);

CREATE TABLE [dbo].[SyllabusOutlineBlock] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [timeFrame] NVARCHAR(256) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusOutlineBlock_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusOutlineBlock_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusOutlineTopic] (
    [id] NVARCHAR(64) NOT NULL,
    [outlineBlockId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusOutlineTopic_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusOutlineTopic_outlineBlockId_position_key] UNIQUE NONCLUSTERED ([outlineBlockId], [position])
);

CREATE TABLE [dbo].[SyllabusLearningPlan] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [week] NVARCHAR(128) NOT NULL,
    [hoursLab] INT NOT NULL,
    [hoursLec] INT NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlan_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlan_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusLearningPlanOutcome] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanOutcome_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanOutcome_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId], [position])
);

CREATE TABLE [dbo].[SyllabusLearningPlanTopic] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanTopic_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanTopic_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId], [position])
);

CREATE TABLE [dbo].[SyllabusLearningPlanMethod] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanMethod_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanMethod_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId], [position])
);

CREATE TABLE [dbo].[SyllabusLearningPlanResource] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanResource_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanResource_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId], [position])
);

CREATE TABLE [dbo].[SyllabusLearningPlanAssessment] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanAssessment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanAssessment_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId], [position])
);

CREATE TABLE [dbo].[SyllabusLearningPlanSdg] (
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [goal] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    [target] NVARCHAR(MAX) NULL,
    CONSTRAINT [SyllabusLearningPlanSdg_pkey] PRIMARY KEY CLUSTERED ([learningPlanId])
);

CREATE TABLE [dbo].[SyllabusCourseOutcome] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [number] INT NOT NULL,
    [statement] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusCourseOutcome_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusCourseOutcome_syllabusId_number_key] UNIQUE NONCLUSTERED ([syllabusId], [number]),
    CONSTRAINT [SyllabusCourseOutcome_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusCourseMap] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [courseOutcomeId] NVARCHAR(64) NOT NULL,
    [coNumber] INT NOT NULL,
    [coStatement] NVARCHAR(MAX) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusCourseMap_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusCourseMap_courseOutcomeId_key] UNIQUE NONCLUSTERED ([courseOutcomeId]),
    CONSTRAINT [SyllabusCourseMap_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusCourseMapProgramOutcome] (
    [courseMapId] NVARCHAR(64) NOT NULL,
    [programOutcomeId] NVARCHAR(64) NOT NULL,
    [level] NVARCHAR(1) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusCourseMapProgramOutcome_pkey] PRIMARY KEY CLUSTERED ([courseMapId], [programOutcomeId]),
    CONSTRAINT [SyllabusCourseMapProgramOutcome_courseMapId_position_key] UNIQUE NONCLUSTERED ([courseMapId], [position])
);

CREATE TABLE [dbo].[SyllabusReference] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [citation] NVARCHAR(MAX) NOT NULL,
    [year] NVARCHAR(32) NOT NULL,
    [doiOrPublisher] NVARCHAR(MAX) NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusReference_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusReference_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusSignatory] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [role] NVARCHAR(32) NOT NULL,
    [name] NVARCHAR(256) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusSignatory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusSignatory_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId], [position])
);

CREATE TABLE [dbo].[SyllabusExtensionField] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [path] NVARCHAR(512) NOT NULL,
    [value] NVARCHAR(MAX) NOT NULL,
    [valueType] NVARCHAR(64) NOT NULL,
    CONSTRAINT [SyllabusExtensionField_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusExtensionField_syllabusId_path_key] UNIQUE NONCLUSTERED ([syllabusId], [path])
);

CREATE TABLE [dbo].[SyllabusMigrationAudit] (
    [id] NVARCHAR(64) NOT NULL,
    [originalCourseId] NVARCHAR(64) NOT NULL,
    [originalRevisionId] NVARCHAR(64) NULL,
    [sourceChecksum] NVARCHAR(128) NOT NULL,
    [status] NVARCHAR(32) NOT NULL,
    [scannedCount] INT NOT NULL CONSTRAINT [DF_SyllabusMigrationAudit_scannedCount] DEFAULT 0,
    [createdCount] INT NOT NULL CONSTRAINT [DF_SyllabusMigrationAudit_createdCount] DEFAULT 0,
    [updatedCount] INT NOT NULL CONSTRAINT [DF_SyllabusMigrationAudit_updatedCount] DEFAULT 0,
    [skippedCount] INT NOT NULL CONSTRAINT [DF_SyllabusMigrationAudit_skippedCount] DEFAULT 0,
    [conflictedCount] INT NOT NULL CONSTRAINT [DF_SyllabusMigrationAudit_conflictedCount] DEFAULT 0,
    [errorText] NVARCHAR(MAX) NULL,
    [createdAt] DATETIME2(3) NOT NULL CONSTRAINT [DF_SyllabusMigrationAudit_createdAt] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2(3) NOT NULL,
    [completedAt] DATETIME2(3) NULL,
    CONSTRAINT [SyllabusMigrationAudit_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusMigrationAudit_originalCourseId_sourceChecksum_key] UNIQUE NONCLUSTERED ([originalCourseId], [sourceChecksum])
);

CREATE TABLE [dbo].[SyllabusMigrationAuditCourseLink] (
    [auditId] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NULL,
    CONSTRAINT [SyllabusMigrationAuditCourseLink_pkey] PRIMARY KEY CLUSTERED ([auditId])
);

CREATE TABLE [dbo].[SyllabusMigrationAuditRevisionLink] (
    [auditId] NVARCHAR(64) NOT NULL,
    [revisionId] NVARCHAR(64) NULL,
    CONSTRAINT [SyllabusMigrationAuditRevisionLink_pkey] PRIMARY KEY CLUSTERED ([auditId])
);

EXEC sys.sp_executesql N'CREATE UNIQUE INDEX [Course_currentSyllabusId_key] ON [dbo].[Course] ([currentSyllabusId]) WHERE [currentSyllabusId] IS NOT NULL;';
CREATE UNIQUE INDEX [Syllabus_courseId_status_published_key] ON [dbo].[Syllabus] ([courseId], [status]) WHERE [status] = N'published';

CREATE INDEX [Syllabus_parentSyllabusId_idx] ON [dbo].[Syllabus] ([parentSyllabusId]);
CREATE INDEX [SyllabusProgramOutcome_programOutcomeId_idx] ON [dbo].[SyllabusProgramOutcome] ([programOutcomeId]);
CREATE INDEX [SyllabusCoreValue_coreValueId_idx] ON [dbo].[SyllabusCoreValue] ([coreValueId]);
CREATE INDEX [SyllabusGraduateAttribute_graduateAttributeId_idx] ON [dbo].[SyllabusGraduateAttribute] ([graduateAttributeId]);
CREATE INDEX [SyllabusSourceDocument_courseFileId_idx] ON [dbo].[SyllabusSourceDocument] ([courseFileId]);
CREATE INDEX [SyllabusFaculty_userId_idx] ON [dbo].[SyllabusFaculty] ([userId]);
CREATE INDEX [SyllabusFacultySection_courseSectionId_idx] ON [dbo].[SyllabusFacultySection] ([courseSectionId]);
CREATE INDEX [SyllabusCourseMapProgramOutcome_programOutcomeId_idx] ON [dbo].[SyllabusCourseMapProgramOutcome] ([programOutcomeId]);
CREATE INDEX [SyllabusMigrationAuditCourseLink_courseId_idx] ON [dbo].[SyllabusMigrationAuditCourseLink] ([courseId]);
CREATE INDEX [SyllabusMigrationAuditRevisionLink_revisionId_idx] ON [dbo].[SyllabusMigrationAuditRevisionLink] ([revisionId]);

ALTER TABLE [dbo].[Syllabus] WITH CHECK ADD CONSTRAINT [CK_Syllabus_status] CHECK ([status] IN (N'draft', N'published', N'archived'));
ALTER TABLE [dbo].[SyllabusRequirement] WITH CHECK ADD CONSTRAINT [CK_SyllabusRequirement_category] CHECK ([category] IN (N'major', N'other'));
ALTER TABLE [dbo].[SyllabusSignatory] WITH CHECK ADD CONSTRAINT [CK_SyllabusSignatory_role] CHECK ([role] IN (N'prepared', N'recommendingApproval', N'approved'));
ALTER TABLE [dbo].[SyllabusRubricLevel] WITH CHECK ADD CONSTRAINT [CK_SyllabusRubricLevel_level] CHECK ([level] BETWEEN 1 AND 4);
ALTER TABLE [dbo].[SyllabusCourseMapProgramOutcome] WITH CHECK ADD CONSTRAINT [CK_SyllabusCourseMapProgramOutcome_level] CHECK ([level] IN (N'I', N'P', N'D'));
ALTER TABLE [dbo].[SyllabusFaculty] WITH CHECK ADD CONSTRAINT [CK_SyllabusFaculty_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusFacultySection] WITH CHECK ADD CONSTRAINT [CK_SyllabusFacultySection_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusRequirement] WITH CHECK ADD CONSTRAINT [CK_SyllabusRequirement_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusPolicy] WITH CHECK ADD CONSTRAINT [CK_SyllabusPolicy_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusGradingComponent] WITH CHECK ADD CONSTRAINT [CK_SyllabusGradingComponent_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusRubric] WITH CHECK ADD CONSTRAINT [CK_SyllabusRubric_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusProgramOutcome] WITH CHECK ADD CONSTRAINT [CK_SyllabusProgramOutcome_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusCoreValue] WITH CHECK ADD CONSTRAINT [CK_SyllabusCoreValue_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusGraduateAttribute] WITH CHECK ADD CONSTRAINT [CK_SyllabusGraduateAttribute_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusOutlineBlock] WITH CHECK ADD CONSTRAINT [CK_SyllabusOutlineBlock_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusOutlineTopic] WITH CHECK ADD CONSTRAINT [CK_SyllabusOutlineTopic_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusLearningPlan] WITH CHECK ADD CONSTRAINT [CK_SyllabusLearningPlan_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusLearningPlanOutcome] WITH CHECK ADD CONSTRAINT [CK_SyllabusLearningPlanOutcome_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusLearningPlanTopic] WITH CHECK ADD CONSTRAINT [CK_SyllabusLearningPlanTopic_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusLearningPlanMethod] WITH CHECK ADD CONSTRAINT [CK_SyllabusLearningPlanMethod_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusLearningPlanResource] WITH CHECK ADD CONSTRAINT [CK_SyllabusLearningPlanResource_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusLearningPlanAssessment] WITH CHECK ADD CONSTRAINT [CK_SyllabusLearningPlanAssessment_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusCourseOutcome] WITH CHECK ADD CONSTRAINT [CK_SyllabusCourseOutcome_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusCourseMap] WITH CHECK ADD CONSTRAINT [CK_SyllabusCourseMap_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusCourseMapProgramOutcome] WITH CHECK ADD CONSTRAINT [CK_SyllabusCourseMapProgramOutcome_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusReference] WITH CHECK ADD CONSTRAINT [CK_SyllabusReference_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusSignatory] WITH CHECK ADD CONSTRAINT [CK_SyllabusSignatory_position] CHECK ([position] >= 0);
ALTER TABLE [dbo].[SyllabusCourseInfo] WITH CHECK ADD CONSTRAINT [CK_SyllabusCourseInfo_lectureHours] CHECK ([lectureHours] >= 0);
ALTER TABLE [dbo].[SyllabusCourseInfo] WITH CHECK ADD CONSTRAINT [CK_SyllabusCourseInfo_labHours] CHECK ([labHours] >= 0);
ALTER TABLE [dbo].[SyllabusLearningPlan] WITH CHECK ADD CONSTRAINT [CK_SyllabusLearningPlan_hoursLab] CHECK ([hoursLab] >= 0);
ALTER TABLE [dbo].[SyllabusLearningPlan] WITH CHECK ADD CONSTRAINT [CK_SyllabusLearningPlan_hoursLec] CHECK ([hoursLec] >= 0);

ALTER TABLE [dbo].[Syllabus] ADD CONSTRAINT [FK_Syllabus_courseId_Course] FOREIGN KEY ([courseId]) REFERENCES [dbo].[Course]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Syllabus] ADD CONSTRAINT [FK_Syllabus_parentSyllabusId_Syllabus] FOREIGN KEY ([parentSyllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusProgramOutcome] ADD CONSTRAINT [FK_SyllabusProgramOutcome_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusProgramOutcome] ADD CONSTRAINT [FK_SyllabusProgramOutcome_programOutcomeId_ProgramOutcome] FOREIGN KEY ([programOutcomeId]) REFERENCES [dbo].[ProgramOutcome]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusCoreValue] ADD CONSTRAINT [FK_SyllabusCoreValue_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusCoreValue] ADD CONSTRAINT [FK_SyllabusCoreValue_coreValueId_CoreValue] FOREIGN KEY ([coreValueId]) REFERENCES [dbo].[CoreValue]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusGraduateAttribute] ADD CONSTRAINT [FK_SyllabusGraduateAttribute_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusGraduateAttribute] ADD CONSTRAINT [FK_SyllabusGraduateAttribute_graduateAttributeId_GraduateAttribute] FOREIGN KEY ([graduateAttributeId]) REFERENCES [dbo].[GraduateAttribute]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusInstitution] ADD CONSTRAINT [FK_SyllabusInstitution_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusCourseInfo] ADD CONSTRAINT [FK_SyllabusCourseInfo_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusInstitutionalStatement] ADD CONSTRAINT [FK_SyllabusInstitutionalStatement_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusGradingSystem] ADD CONSTRAINT [FK_SyllabusGradingSystem_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusSourceDocument] ADD CONSTRAINT [FK_SyllabusSourceDocument_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusSourceDocument] ADD CONSTRAINT [FK_SyllabusSourceDocument_courseFileId_CourseFile] FOREIGN KEY ([courseFileId]) REFERENCES [dbo].[CourseFile]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusFaculty] ADD CONSTRAINT [FK_SyllabusFaculty_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusFaculty] ADD CONSTRAINT [FK_SyllabusFaculty_userId_User] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusFacultySection] ADD CONSTRAINT [FK_SyllabusFacultySection_facultyId_SyllabusFaculty] FOREIGN KEY ([facultyId]) REFERENCES [dbo].[SyllabusFaculty]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusFacultySection] ADD CONSTRAINT [FK_SyllabusFacultySection_courseSectionId_CourseSection] FOREIGN KEY ([courseSectionId]) REFERENCES [dbo].[CourseSection]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusRequirement] ADD CONSTRAINT [FK_SyllabusRequirement_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusPolicy] ADD CONSTRAINT [FK_SyllabusPolicy_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusGradingComponent] ADD CONSTRAINT [FK_SyllabusGradingComponent_gradingSystemId_SyllabusGradingSystem] FOREIGN KEY ([gradingSystemId]) REFERENCES [dbo].[SyllabusGradingSystem]([syllabusId]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusRubric] ADD CONSTRAINT [FK_SyllabusRubric_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusRubricLevel] ADD CONSTRAINT [FK_SyllabusRubricLevel_rubricId_SyllabusRubric] FOREIGN KEY ([rubricId]) REFERENCES [dbo].[SyllabusRubric]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusOutlineBlock] ADD CONSTRAINT [FK_SyllabusOutlineBlock_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusOutlineTopic] ADD CONSTRAINT [FK_SyllabusOutlineTopic_outlineBlockId_SyllabusOutlineBlock] FOREIGN KEY ([outlineBlockId]) REFERENCES [dbo].[SyllabusOutlineBlock]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusLearningPlan] ADD CONSTRAINT [FK_SyllabusLearningPlan_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusLearningPlanOutcome] ADD CONSTRAINT [FK_SyllabusLearningPlanOutcome_learningPlanId_SyllabusLearningPlan] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusLearningPlanTopic] ADD CONSTRAINT [FK_SyllabusLearningPlanTopic_learningPlanId_SyllabusLearningPlan] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusLearningPlanMethod] ADD CONSTRAINT [FK_SyllabusLearningPlanMethod_learningPlanId_SyllabusLearningPlan] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusLearningPlanResource] ADD CONSTRAINT [FK_SyllabusLearningPlanResource_learningPlanId_SyllabusLearningPlan] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusLearningPlanAssessment] ADD CONSTRAINT [FK_SyllabusLearningPlanAssessment_learningPlanId_SyllabusLearningPlan] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusLearningPlanSdg] ADD CONSTRAINT [FK_SyllabusLearningPlanSdg_learningPlanId_SyllabusLearningPlan] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusCourseOutcome] ADD CONSTRAINT [FK_SyllabusCourseOutcome_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusCourseMap] ADD CONSTRAINT [FK_SyllabusCourseMap_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusCourseMap] ADD CONSTRAINT [FK_SyllabusCourseMap_courseOutcomeId_SyllabusCourseOutcome] FOREIGN KEY ([courseOutcomeId]) REFERENCES [dbo].[SyllabusCourseOutcome]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusCourseMapProgramOutcome] ADD CONSTRAINT [FK_SyllabusCourseMapProgramOutcome_courseMapId_SyllabusCourseMap] FOREIGN KEY ([courseMapId]) REFERENCES [dbo].[SyllabusCourseMap]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusCourseMapProgramOutcome] ADD CONSTRAINT [FK_SyllabusCourseMapProgramOutcome_programOutcomeId_ProgramOutcome] FOREIGN KEY ([programOutcomeId]) REFERENCES [dbo].[ProgramOutcome]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusReference] ADD CONSTRAINT [FK_SyllabusReference_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusSignatory] ADD CONSTRAINT [FK_SyllabusSignatory_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusExtensionField] ADD CONSTRAINT [FK_SyllabusExtensionField_syllabusId_Syllabus] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusMigrationAuditCourseLink] ADD CONSTRAINT [FK_SyllabusMigrationAuditCourseLink_auditId_SyllabusMigrationAudit] FOREIGN KEY ([auditId]) REFERENCES [dbo].[SyllabusMigrationAudit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusMigrationAuditCourseLink] ADD CONSTRAINT [FK_SyllabusMigrationAuditCourseLink_courseId_Course] FOREIGN KEY ([courseId]) REFERENCES [dbo].[Course]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusMigrationAuditRevisionLink] ADD CONSTRAINT [FK_SyllabusMigrationAuditRevisionLink_auditId_SyllabusMigrationAudit] FOREIGN KEY ([auditId]) REFERENCES [dbo].[SyllabusMigrationAudit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SyllabusMigrationAuditRevisionLink] ADD CONSTRAINT [FK_SyllabusMigrationAuditRevisionLink_revisionId_Syllabus] FOREIGN KEY ([revisionId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Course] ADD CONSTRAINT [FK_Course_currentSyllabusId_Syllabus] FOREIGN KEY ([currentSyllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
