BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[QuizQuestion] ADD [examId] NVARCHAR(64);

-- AlterTable
ALTER TABLE [dbo].[Submission] ADD [examId] NVARCHAR(64);

-- CreateTable
CREATE TABLE [dbo].[Exam] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [instructions] NVARCHAR(max) NOT NULL,
    [timeLimitMinutes] INT NOT NULL CONSTRAINT [Exam_timeLimitMinutes_df] DEFAULT 30,
    [published] BIT NOT NULL CONSTRAINT [Exam_published_df] DEFAULT 0,
    [dueDate] DATETIME2,
    [term] NVARCHAR(16) NOT NULL,
    CONSTRAINT [Exam_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Submission] ADD CONSTRAINT [Submission_examId_fkey] FOREIGN KEY ([examId]) REFERENCES [dbo].[Exam]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[QuizQuestion] ADD CONSTRAINT [QuizQuestion_examId_fkey] FOREIGN KEY ([examId]) REFERENCES [dbo].[Exam]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

