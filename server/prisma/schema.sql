BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(128) NOT NULL,
    [email] NVARCHAR(256) NOT NULL,
    [passwordHash] NVARCHAR(256) NOT NULL,
    [role] NVARCHAR(32) NOT NULL,
    [avatar] NVARCHAR(512) NOT NULL,
    [department] NVARCHAR(128) NOT NULL,
    [title] NVARCHAR(128) NOT NULL,
    [lastVisitedAt] NVARCHAR(max),
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Course] (
    [id] NVARCHAR(64) NOT NULL,
    [code] NVARCHAR(32) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [section] NVARCHAR(64) NOT NULL,
    [term] NVARCHAR(64) NOT NULL,
    [instructorId] NVARCHAR(64) NOT NULL,
    [instructorName] NVARCHAR(128) NOT NULL,
    [published] BIT NOT NULL CONSTRAINT [Course_published_df] DEFAULT 0,
    [color] NVARCHAR(32),
    [image] NVARCHAR(512),
    [enrolledCount] INT NOT NULL CONSTRAINT [Course_enrolledCount_df] DEFAULT 0,
    [credits] INT,
    [chedComplianceCode] NVARCHAR(64),
    [joinCode] NVARCHAR(32),
    [syllabus] NVARCHAR(max),
    CONSTRAINT [Course_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Course_joinCode_key] UNIQUE NONCLUSTERED ([joinCode])
);

-- CreateTable
CREATE TABLE [dbo].[CourseSection] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(128) NOT NULL,
    [capacity] INT,
    [enrolledCount] INT NOT NULL CONSTRAINT [CourseSection_enrolledCount_df] DEFAULT 0,
    [schedule] NVARCHAR(256),
    [location] NVARCHAR(256),
    CONSTRAINT [CourseSection_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[EnrollmentRequest] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [studentId] NVARCHAR(64) NOT NULL,
    [studentName] NVARCHAR(128) NOT NULL,
    [type] NVARCHAR(32) NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [EnrollmentRequest_status_df] DEFAULT 'pending',
    [requestedAt] DATETIME2 NOT NULL CONSTRAINT [EnrollmentRequest_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [resolvedAt] DATETIME2,
    [resolvedBy] NVARCHAR(64),
    [sectionId] NVARCHAR(64),
    [targetSectionId] NVARCHAR(64),
    CONSTRAINT [EnrollmentRequest_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Module] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [order] INT NOT NULL CONSTRAINT [Module_order_df] DEFAULT 0,
    [published] BIT NOT NULL CONSTRAINT [Module_published_df] DEFAULT 0,
    [prerequisiteModuleId] NVARCHAR(64),
    [authorId] NVARCHAR(64),
    [authorName] NVARCHAR(128),
    CONSTRAINT [Module_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ModuleItem] (
    [id] NVARCHAR(64) NOT NULL,
    [moduleId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [type] NVARCHAR(32) NOT NULL,
    [published] BIT NOT NULL CONSTRAINT [ModuleItem_published_df] DEFAULT 1,
    [required] BIT NOT NULL CONSTRAINT [ModuleItem_required_df] DEFAULT 0,
    [completionCondition] NVARCHAR(32),
    [minScore] FLOAT(53),
    [content] NVARCHAR(max),
    [assignmentId] NVARCHAR(64),
    [quizId] NVARCHAR(64),
    [fileUrl] NVARCHAR(1024),
    [fileName] NVARCHAR(256),
    [fileSize] NVARCHAR(32),
    [fileType] NVARCHAR(64),
    [completed] BIT NOT NULL CONSTRAINT [ModuleItem_completed_df] DEFAULT 0,
    [authorId] NVARCHAR(64),
    [authorName] NVARCHAR(128),
    CONSTRAINT [ModuleItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ModuleComment] (
    [id] NVARCHAR(64) NOT NULL,
    [moduleId] NVARCHAR(64) NOT NULL,
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(512) NOT NULL,
    [authorRole] NVARCHAR(32) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ModuleComment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [likes] INT NOT NULL CONSTRAINT [ModuleComment_likes_df] DEFAULT 0,
    [isEdited] BIT NOT NULL CONSTRAINT [ModuleComment_isEdited_df] DEFAULT 0,
    [editedAt] DATETIME2,
    CONSTRAINT [ModuleComment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ModuleCommentLike] (
    [commentId] NVARCHAR(64) NOT NULL,
    [userId] NVARCHAR(64) NOT NULL,
    CONSTRAINT [ModuleCommentLike_pkey] PRIMARY KEY CLUSTERED ([commentId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[Assignment] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [instructions] NVARCHAR(max) NOT NULL,
    [pointsPossible] FLOAT(53) NOT NULL,
    [dueDate] DATETIME2 NOT NULL,
    [submissionTypes] NVARCHAR(64) NOT NULL,
    [published] BIT NOT NULL CONSTRAINT [Assignment_published_df] DEFAULT 0,
    [category] NVARCHAR(64) NOT NULL,
    [weight] FLOAT(53) NOT NULL CONSTRAINT [Assignment_weight_df] DEFAULT 0,
    [rubric] NVARCHAR(max) NOT NULL,
    [fileName] NVARCHAR(256),
    [fileUrl] NVARCHAR(1024),
    [fileSize] NVARCHAR(32),
    [availableFrom] DATETIME2,
    [availableUntil] DATETIME2,
    [sectionRestriction] NVARCHAR(128),
    CONSTRAINT [Assignment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Submission] (
    [id] NVARCHAR(64) NOT NULL,
    [assignmentId] NVARCHAR(64),
    [quizId] NVARCHAR(64),
    [activityId] NVARCHAR(64),
    [courseId] NVARCHAR(64) NOT NULL,
    [studentId] NVARCHAR(64) NOT NULL,
    [studentName] NVARCHAR(128) NOT NULL,
    [studentAvatar] NVARCHAR(512) NOT NULL,
    [submittedAt] DATETIME2 NOT NULL CONSTRAINT [Submission_submittedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [submissionType] NVARCHAR(32) NOT NULL,
    [content] NVARCHAR(max),
    [fileUrl] NVARCHAR(1024),
    [fileName] NVARCHAR(256),
    [grade] FLOAT(53),
    [gradedAt] DATETIME2,
    [gradedBy] NVARCHAR(128),
    [status] NVARCHAR(32) NOT NULL,
    [rubricScores] NVARCHAR(max) NOT NULL,
    CONSTRAINT [Submission_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[SubmissionComment] (
    [id] NVARCHAR(64) NOT NULL,
    [submissionId] NVARCHAR(64) NOT NULL,
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorRole] NVARCHAR(32) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SubmissionComment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [text] NVARCHAR(max) NOT NULL,
    CONSTRAINT [SubmissionComment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Quiz] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [instructions] NVARCHAR(max) NOT NULL,
    [timeLimitMinutes] INT NOT NULL CONSTRAINT [Quiz_timeLimitMinutes_df] DEFAULT 30,
    [published] BIT NOT NULL CONSTRAINT [Quiz_published_df] DEFAULT 0,
    [delayedUntil] DATETIME2,
    [dueDate] DATETIME2,
    [fileName] NVARCHAR(256),
    [fileUrl] NVARCHAR(1024),
    [fileSize] NVARCHAR(32),
    CONSTRAINT [Quiz_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[QuizQuestion] (
    [id] NVARCHAR(64) NOT NULL,
    [quizId] NVARCHAR(64),
    [activityId] NVARCHAR(64),
    [text] NVARCHAR(max) NOT NULL,
    [type] NVARCHAR(32) NOT NULL,
    [options] NVARCHAR(max) NOT NULL,
    [correctAnswer] NVARCHAR(1024),
    [points] FLOAT(53) NOT NULL CONSTRAINT [QuizQuestion_points_df] DEFAULT 5,
    [description] NVARCHAR(max),
    [rubricNotes] NVARCHAR(max),
    [imageUrl] NVARCHAR(1024),
    [imageName] NVARCHAR(256),
    [fileUrl] NVARCHAR(1024),
    [fileName] NVARCHAR(256),
    CONSTRAINT [QuizQuestion_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Activity] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [instructions] NVARCHAR(max) NOT NULL,
    [pointsPossible] FLOAT(53) NOT NULL,
    [dueDate] DATETIME2,
    [published] BIT NOT NULL CONSTRAINT [Activity_published_df] DEFAULT 0,
    CONSTRAINT [Activity_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Announcement] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(512) NOT NULL,
    [authorRole] NVARCHAR(32) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Announcement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [delayedUntil] DATETIME2,
    [sectionId] NVARCHAR(64) NOT NULL CONSTRAINT [Announcement_sectionId_df] DEFAULT 'all',
    [sectionRestriction] NVARCHAR(128) NOT NULL CONSTRAINT [Announcement_sectionRestriction_df] DEFAULT 'All Sections',
    [allowComments] BIT NOT NULL CONSTRAINT [Announcement_allowComments_df] DEFAULT 1,
    [usersMustPostBeforeReplies] BIT NOT NULL CONSTRAINT [Announcement_usersMustPostBeforeReplies_df] DEFAULT 0,
    [allowLiking] BIT NOT NULL CONSTRAINT [Announcement_allowLiking_df] DEFAULT 1,
    [likes] INT NOT NULL CONSTRAINT [Announcement_likes_df] DEFAULT 0,
    [pinned] BIT NOT NULL CONSTRAINT [Announcement_pinned_df] DEFAULT 0,
    CONSTRAINT [Announcement_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AnnouncementAttachment] (
    [id] NVARCHAR(64) NOT NULL,
    [announcementId] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(256) NOT NULL,
    [size] NVARCHAR(32) NOT NULL,
    [url] NVARCHAR(1024),
    CONSTRAINT [AnnouncementAttachment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AnnouncementReply] (
    [id] NVARCHAR(64) NOT NULL,
    [announcementId] NVARCHAR(64) NOT NULL,
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(512) NOT NULL,
    [authorRole] NVARCHAR(32) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AnnouncementReply_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [likes] INT NOT NULL CONSTRAINT [AnnouncementReply_likes_df] DEFAULT 0,
    CONSTRAINT [AnnouncementReply_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AnnouncementReplyLike] (
    [replyId] NVARCHAR(64) NOT NULL,
    [userId] NVARCHAR(64) NOT NULL,
    CONSTRAINT [AnnouncementReplyLike_pkey] PRIMARY KEY CLUSTERED ([replyId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[AnnouncementLike] (
    [announcementId] NVARCHAR(64) NOT NULL,
    [userId] NVARCHAR(64) NOT NULL,
    CONSTRAINT [AnnouncementLike_pkey] PRIMARY KEY CLUSTERED ([announcementId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[AnnouncementRead] (
    [announcementId] NVARCHAR(64) NOT NULL,
    [userId] NVARCHAR(64) NOT NULL,
    CONSTRAINT [AnnouncementRead_pkey] PRIMARY KEY CLUSTERED ([announcementId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[Discussion] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [prompt] NVARCHAR(max) NOT NULL,
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(512) NOT NULL,
    [authorRole] NVARCHAR(32) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Discussion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [isGraded] BIT NOT NULL CONSTRAINT [Discussion_isGraded_df] DEFAULT 0,
    [pointsPossible] FLOAT(53),
    [dueDate] DATETIME2,
    [pinned] BIT NOT NULL CONSTRAINT [Discussion_pinned_df] DEFAULT 0,
    [locked] BIT NOT NULL CONSTRAINT [Discussion_locked_df] DEFAULT 0,
    [usersMustPostBeforeReplies] BIT NOT NULL CONSTRAINT [Discussion_usersMustPostBeforeReplies_df] DEFAULT 0,
    [groupAssignment] NVARCHAR(128),
    CONSTRAINT [Discussion_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[DiscussionReply] (
    [id] NVARCHAR(64) NOT NULL,
    [discussionId] NVARCHAR(64) NOT NULL,
    [parentId] NVARCHAR(64),
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(512) NOT NULL,
    [authorRole] NVARCHAR(32) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DiscussionReply_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [likes] INT NOT NULL CONSTRAINT [DiscussionReply_likes_df] DEFAULT 0,
    CONSTRAINT [DiscussionReply_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[DiscussionReplyLike] (
    [replyId] NVARCHAR(64) NOT NULL,
    [userId] NVARCHAR(64) NOT NULL,
    CONSTRAINT [DiscussionReplyLike_pkey] PRIMARY KEY CLUSTERED ([replyId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[Message] (
    [id] NVARCHAR(64) NOT NULL,
    [senderId] NVARCHAR(64) NOT NULL,
    [senderName] NVARCHAR(128) NOT NULL,
    [senderRole] NVARCHAR(32) NOT NULL,
    [recipientId] NVARCHAR(64) NOT NULL,
    [recipientName] NVARCHAR(128) NOT NULL,
    [recipientRole] NVARCHAR(32) NOT NULL,
    [courseId] NVARCHAR(64),
    [courseCode] NVARCHAR(32),
    [subject] NVARCHAR(256) NOT NULL,
    [body] NVARCHAR(max) NOT NULL,
    [timestamp] DATETIME2 NOT NULL CONSTRAINT [Message_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    [read] BIT NOT NULL CONSTRAINT [Message_read_df] DEFAULT 0,
    [reaction] NVARCHAR(32),
    [attachmentName] NVARCHAR(256),
    [attachmentSize] NVARCHAR(32),
    [groupId] NVARCHAR(64),
    [isGroup] BIT NOT NULL CONSTRAINT [Message_isGroup_df] DEFAULT 0,
    CONSTRAINT [Message_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ChatGroup] (
    [id] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(128) NOT NULL,
    [avatar] NVARCHAR(512),
    [courseId] NVARCHAR(64),
    [courseCode] NVARCHAR(32),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ChatGroup_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdBy] NVARCHAR(64) NOT NULL,
    CONSTRAINT [ChatGroup_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ChatGroupMember] (
    [groupId] NVARCHAR(64) NOT NULL,
    [userId] NVARCHAR(64) NOT NULL,
    CONSTRAINT [ChatGroupMember_pkey] PRIMARY KEY CLUSTERED ([groupId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[CalendarEvent] (
    [id] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [date] NVARCHAR(32) NOT NULL,
    [time] NVARCHAR(32) NOT NULL,
    [courseId] NVARCHAR(64),
    [courseCode] NVARCHAR(32),
    [type] NVARCHAR(32) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2,
    [startAt] DATETIME2,
    [endAt] DATETIME2,
    [isAllDay] BIT NOT NULL CONSTRAINT [CalendarEvent_isAllDay_df] DEFAULT 0,
    [colorHex] NVARCHAR(32),
    [location] NVARCHAR(256),
    [meetingPlatform] NVARCHAR(32),
    [meetingId] NVARCHAR(128),
    [meetingPasscode] NVARCHAR(128),
    [meetingJoinUrl] NVARCHAR(1024),
    CONSTRAINT [CalendarEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AdvisingSlot] (
    [id] NVARCHAR(64) NOT NULL,
    [instructorId] NVARCHAR(64) NOT NULL,
    [instructorName] NVARCHAR(128) NOT NULL,
    [date] NVARCHAR(32) NOT NULL,
    [timeSlot] NVARCHAR(64) NOT NULL,
    [location] NVARCHAR(256) NOT NULL,
    [status] NVARCHAR(32) NOT NULL,
    [bookedByStudentId] NVARCHAR(64),
    [bookedByStudentName] NVARCHAR(128),
    [notes] NVARCHAR(max),
    CONSTRAINT [AdvisingSlot_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] NVARCHAR(64) NOT NULL,
    [type] NVARCHAR(64) NOT NULL,
    [recipientId] NVARCHAR(64) NOT NULL,
    [actorId] NVARCHAR(64) NOT NULL,
    [actorName] NVARCHAR(128) NOT NULL,
    [actorAvatar] NVARCHAR(512) NOT NULL,
    [relatedId] NVARCHAR(64) NOT NULL,
    [relatedTitle] NVARCHAR(256) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [read] BIT NOT NULL CONSTRAINT [Notification_read_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CourseFolder] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [parentId] NVARCHAR(64),
    [name] NVARCHAR(256) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    [autoKey] NVARCHAR(128),
    CONSTRAINT [CourseFolder_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CourseFile] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [folderId] NVARCHAR(64),
    [name] NVARCHAR(256) NOT NULL,
    [size] INT NOT NULL CONSTRAINT [CourseFile_size_df] DEFAULT 0,
    [formattedSize] NVARCHAR(32) NOT NULL,
    [type] NVARCHAR(32) NOT NULL,
    [visibility] NVARCHAR(32) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    [uploadedBy] NVARCHAR(64) NOT NULL,
    [uploadedByName] NVARCHAR(128) NOT NULL,
    [content] NVARCHAR(max),
    [url] NVARCHAR(1024),
    [fileUrl] NVARCHAR(1024),
    [sourceArea] NVARCHAR(32),
    [sourceId] NVARCHAR(64),
    CONSTRAINT [CourseFile_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[HistoryLog] (
    [id] NVARCHAR(64) NOT NULL,
    [path] NVARCHAR(512) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [timestamp] DATETIME2 NOT NULL CONSTRAINT [HistoryLog_timestamp_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [HistoryLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CommonsTemplate] (
    [id] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [category] NVARCHAR(128) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [author] NVARCHAR(128) NOT NULL,
    [downloads] INT NOT NULL CONSTRAINT [CommonsTemplate_downloads_df] DEFAULT 0,
    [rating] FLOAT(53) NOT NULL CONSTRAINT [CommonsTemplate_rating_df] DEFAULT 0,
    [tags] NVARCHAR(max) NOT NULL,
    [chedAlignment] NVARCHAR(512) NOT NULL,
    CONSTRAINT [CommonsTemplate_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Course] ADD CONSTRAINT [Course_instructorId_fkey] FOREIGN KEY ([instructorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CourseSection] ADD CONSTRAINT [CourseSection_courseId_fkey] FOREIGN KEY ([courseId]) REFERENCES [dbo].[Course]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[EnrollmentRequest] ADD CONSTRAINT [EnrollmentRequest_courseId_fkey] FOREIGN KEY ([courseId]) REFERENCES [dbo].[Course]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ModuleItem] ADD CONSTRAINT [ModuleItem_moduleId_fkey] FOREIGN KEY ([moduleId]) REFERENCES [dbo].[Module]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ModuleComment] ADD CONSTRAINT [ModuleComment_moduleId_fkey] FOREIGN KEY ([moduleId]) REFERENCES [dbo].[Module]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ModuleCommentLike] ADD CONSTRAINT [ModuleCommentLike_commentId_fkey] FOREIGN KEY ([commentId]) REFERENCES [dbo].[ModuleComment]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Submission] ADD CONSTRAINT [Submission_quizId_fkey] FOREIGN KEY ([quizId]) REFERENCES [dbo].[Quiz]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Submission] ADD CONSTRAINT [Submission_activityId_fkey] FOREIGN KEY ([activityId]) REFERENCES [dbo].[Activity]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SubmissionComment] ADD CONSTRAINT [SubmissionComment_submissionId_fkey] FOREIGN KEY ([submissionId]) REFERENCES [dbo].[Submission]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[QuizQuestion] ADD CONSTRAINT [QuizQuestion_quizId_fkey] FOREIGN KEY ([quizId]) REFERENCES [dbo].[Quiz]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[QuizQuestion] ADD CONSTRAINT [QuizQuestion_activityId_fkey] FOREIGN KEY ([activityId]) REFERENCES [dbo].[Activity]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AnnouncementAttachment] ADD CONSTRAINT [AnnouncementAttachment_announcementId_fkey] FOREIGN KEY ([announcementId]) REFERENCES [dbo].[Announcement]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AnnouncementReply] ADD CONSTRAINT [AnnouncementReply_announcementId_fkey] FOREIGN KEY ([announcementId]) REFERENCES [dbo].[Announcement]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AnnouncementReplyLike] ADD CONSTRAINT [AnnouncementReplyLike_replyId_fkey] FOREIGN KEY ([replyId]) REFERENCES [dbo].[AnnouncementReply]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AnnouncementLike] ADD CONSTRAINT [AnnouncementLike_announcementId_fkey] FOREIGN KEY ([announcementId]) REFERENCES [dbo].[Announcement]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AnnouncementRead] ADD CONSTRAINT [AnnouncementRead_announcementId_fkey] FOREIGN KEY ([announcementId]) REFERENCES [dbo].[Announcement]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[DiscussionReply] ADD CONSTRAINT [DiscussionReply_discussionId_fkey] FOREIGN KEY ([discussionId]) REFERENCES [dbo].[Discussion]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[DiscussionReplyLike] ADD CONSTRAINT [DiscussionReplyLike_replyId_fkey] FOREIGN KEY ([replyId]) REFERENCES [dbo].[DiscussionReply]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ChatGroupMember] ADD CONSTRAINT [ChatGroupMember_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[ChatGroup]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[CourseFolder] ADD CONSTRAINT [CourseFolder_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[CourseFolder]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CourseFile] ADD CONSTRAINT [CourseFile_folderId_fkey] FOREIGN KEY ([folderId]) REFERENCES [dbo].[CourseFolder]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

