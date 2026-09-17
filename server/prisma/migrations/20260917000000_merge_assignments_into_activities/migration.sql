-- 1. Extend Activity with classic columns + discriminator.
ALTER TABLE [Activity] ADD [format] NVARCHAR(16) NOT NULL DEFAULT 'questionset';
ALTER TABLE [Activity] ADD [submissionTypes] NVARCHAR(64) NULL;
ALTER TABLE [Activity] ADD [category] NVARCHAR(64) NULL;
ALTER TABLE [Activity] ADD [weight] FLOAT NULL;
ALTER TABLE [Activity] ADD [rubric] NVARCHAR(MAX) NULL;
ALTER TABLE [Activity] ADD [fileName] NVARCHAR(256) NULL;
ALTER TABLE [Activity] ADD [fileUrl] NVARCHAR(1024) NULL;
ALTER TABLE [Activity] ADD [fileSize] NVARCHAR(32) NULL;
ALTER TABLE [Activity] ADD [availableFrom] DATETIME2 NULL;
ALTER TABLE [Activity] ADD [availableUntil] DATETIME2 NULL;
ALTER TABLE [Activity] ADD [sectionRestriction] NVARCHAR(128) NULL;

-- 2. Backfill existing question-set rows explicitly.
-- NOTE: DML below runs via sp_executesql because SQL Server compiles the whole
-- migration batch up front, so the new [format] column is unknown at compile
-- time right after ADD. Dynamic SQL defers compilation until after ALTERs run.
EXEC sp_executesql N'UPDATE [Activity] SET [format] = ''questionset'' WHERE [format] IS NULL OR [format] = ''''';

-- 3. Move classic rows 1:1, IDs preserved, format forced.
EXEC sp_executesql N'INSERT INTO [Activity]
  ([id],[courseId],[title],[instructions],[pointsPossible],[dueDate],[published],[term],[format],
   [submissionTypes],[category],[weight],[rubric],[fileName],[fileUrl],[fileSize],
   [availableFrom],[availableUntil],[sectionRestriction])
SELECT [id],[courseId],[title],[instructions],[pointsPossible],[dueDate],[published],[term],''classic'',
   [submissionTypes],[category],[weight],[rubric],[fileName],[fileUrl],[fileSize],
   [availableFrom],[availableUntil],[sectionRestriction]
FROM [Assignment]';

-- 4. Rename link columns (values preserved).
EXEC sp_rename 'Submission.assignmentId', 'activityKey', 'COLUMN';
EXEC sp_rename 'ModuleItem.assignmentId', 'activityId', 'COLUMN';

-- 5. Drop the absorbed table.
DROP TABLE [Assignment];
