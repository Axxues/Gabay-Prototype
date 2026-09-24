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
    [avatar] NVARCHAR(max) NOT NULL,
    [banner] NVARCHAR(max),
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
    [image] NVARCHAR(max),
    [enrolledCount] INT NOT NULL CONSTRAINT [Course_enrolledCount_df] DEFAULT 0,
    [credits] INT,
    [chedComplianceCode] NVARCHAR(64),
    [joinCode] NVARCHAR(32),
    [syllabus] NVARCHAR(max),
    [sprConfig] NVARCHAR(max),
    [gradingTerms] NVARCHAR(max),
    [gradesReleased] NVARCHAR(max),
    [currentSyllabusId] NVARCHAR(64),
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
    [activityId] NVARCHAR(64),
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
    [parentId] NVARCHAR(64),
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(max) NOT NULL,
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
CREATE TABLE [dbo].[Submission] (
    [id] NVARCHAR(64) NOT NULL,
    [activityKey] NVARCHAR(64),
    [quizId] NVARCHAR(64),
    [activityId] NVARCHAR(64),
    [examId] NVARCHAR(64),
    [courseId] NVARCHAR(64) NOT NULL,
    [studentId] NVARCHAR(64) NOT NULL,
    [studentName] NVARCHAR(128) NOT NULL,
    [studentAvatar] NVARCHAR(max) NOT NULL,
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
    [term] NVARCHAR(16),
    CONSTRAINT [Quiz_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[QuizQuestion] (
    [id] NVARCHAR(64) NOT NULL,
    [quizId] NVARCHAR(64),
    [activityId] NVARCHAR(64),
    [examId] NVARCHAR(64),
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
    [term] NVARCHAR(16),
    [format] NVARCHAR(16) NOT NULL,
    [submissionTypes] NVARCHAR(64),
    [category] NVARCHAR(64),
    [weight] FLOAT(53),
    [rubric] NVARCHAR(max),
    [fileName] NVARCHAR(256),
    [fileUrl] NVARCHAR(1024),
    [fileSize] NVARCHAR(32),
    [availableFrom] DATETIME2,
    [availableUntil] DATETIME2,
    [sectionRestriction] NVARCHAR(128),
    CONSTRAINT [Activity_pkey] PRIMARY KEY CLUSTERED ([id])
);

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

-- CreateTable
CREATE TABLE [dbo].[Announcement] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [content] NVARCHAR(max) NOT NULL,
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(max) NOT NULL,
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
    [parentId] NVARCHAR(64),
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(max) NOT NULL,
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
    [authorAvatar] NVARCHAR(max) NOT NULL,
    [authorRole] NVARCHAR(32) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Discussion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [isGraded] BIT NOT NULL CONSTRAINT [Discussion_isGraded_df] DEFAULT 0,
    [pointsPossible] FLOAT(53),
    [dueDate] DATETIME2,
    [pinned] BIT NOT NULL CONSTRAINT [Discussion_pinned_df] DEFAULT 0,
    [locked] BIT NOT NULL CONSTRAINT [Discussion_locked_df] DEFAULT 0,
    [usersMustPostBeforeReplies] BIT NOT NULL CONSTRAINT [Discussion_usersMustPostBeforeReplies_df] DEFAULT 0,
    [groupActivity] NVARCHAR(128),
    CONSTRAINT [Discussion_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[DiscussionReply] (
    [id] NVARCHAR(64) NOT NULL,
    [discussionId] NVARCHAR(64) NOT NULL,
    [parentId] NVARCHAR(64),
    [authorId] NVARCHAR(64) NOT NULL,
    [authorName] NVARCHAR(128) NOT NULL,
    [authorAvatar] NVARCHAR(max) NOT NULL,
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
    [avatar] NVARCHAR(max),
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
    [actorAvatar] NVARCHAR(max) NOT NULL,
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
CREATE TABLE [dbo].[Syllabus] (
    [id] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64) NOT NULL,
    [parentSyllabusId] NVARCHAR(64),
    [revisionNo] INT NOT NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [Syllabus_status_df] DEFAULT 'draft',
    [schemaVersion] NVARCHAR(32) NOT NULL CONSTRAINT [Syllabus_schemaVersion_df] DEFAULT '1',
    [rowVersion] INT NOT NULL CONSTRAINT [Syllabus_rowVersion_df] DEFAULT 1,
    [createdById] NVARCHAR(64) NOT NULL,
    [publishedById] NVARCHAR(64),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Syllabus_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [publishedAt] DATETIME2,
    CONSTRAINT [Syllabus_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Syllabus_courseId_revisionNo_key] UNIQUE NONCLUSTERED ([courseId],[revisionNo])
);

-- CreateTable
CREATE TABLE [dbo].[ProgramOutcome] (
    [id] NVARCHAR(64) NOT NULL,
    [number] INT NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [catalogVersion] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ProgramOutcome_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ProgramOutcome_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ProgramOutcome_catalogVersion_number_key] UNIQUE NONCLUSTERED ([catalogVersion],[number])
);

-- CreateTable
CREATE TABLE [dbo].[CoreValue] (
    [id] NVARCHAR(64) NOT NULL,
    [acronym] NVARCHAR(64) NOT NULL,
    [keyword] NVARCHAR(256) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [catalogVersion] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CoreValue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CoreValue_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CoreValue_catalogVersion_acronym_key] UNIQUE NONCLUSTERED ([catalogVersion],[acronym])
);

-- CreateTable
CREATE TABLE [dbo].[GraduateAttribute] (
    [id] NVARCHAR(64) NOT NULL,
    [number] INT NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [catalogVersion] NVARCHAR(64) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GraduateAttribute_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GraduateAttribute_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [GraduateAttribute_catalogVersion_number_key] UNIQUE NONCLUSTERED ([catalogVersion],[number])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusProgramOutcome] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [programOutcomeId] NVARCHAR(64) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusProgramOutcome_pkey] PRIMARY KEY CLUSTERED ([syllabusId],[programOutcomeId],[position]),
    CONSTRAINT [SyllabusProgramOutcome_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusCoreValue] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [coreValueId] NVARCHAR(64) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusCoreValue_pkey] PRIMARY KEY CLUSTERED ([syllabusId],[coreValueId],[position]),
    CONSTRAINT [SyllabusCoreValue_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusGraduateAttribute] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [graduateAttributeId] NVARCHAR(64) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusGraduateAttribute_pkey] PRIMARY KEY CLUSTERED ([syllabusId],[graduateAttributeId],[position]),
    CONSTRAINT [SyllabusGraduateAttribute_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusInstitution] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [university] NVARCHAR(256) NOT NULL,
    [college] NVARCHAR(256) NOT NULL,
    [formCode] NVARCHAR(64) NOT NULL,
    [revision] NVARCHAR(64) NOT NULL,
    CONSTRAINT [SyllabusInstitution_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

-- CreateTable
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
    [prerequisite] NVARCHAR(max) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    CONSTRAINT [SyllabusCourseInfo_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusInstitutionalStatement] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [philosophy] NVARCHAR(max) NOT NULL,
    [vision] NVARCHAR(max) NOT NULL,
    [mission] NVARCHAR(max) NOT NULL,
    [goal] NVARCHAR(max) NOT NULL,
    CONSTRAINT [SyllabusInstitutionalStatement_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusGradingSystem] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [termFormula] NVARCHAR(256) NOT NULL,
    [finalFormula] NVARCHAR(256) NOT NULL,
    [passingGrade] NVARCHAR(64) NOT NULL,
    CONSTRAINT [SyllabusGradingSystem_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusSourceDocument] (
    [syllabusId] NVARCHAR(64) NOT NULL,
    [fileName] NVARCHAR(256) NOT NULL,
    [fileSize] NVARCHAR(32) NOT NULL,
    [fileType] NVARCHAR(32) NOT NULL,
    [uploadedAt] DATETIME2 NOT NULL,
    [fileDataUrl] NVARCHAR(max),
    [legacyPayload] NVARCHAR(max),
    [courseFileId] NVARCHAR(64),
    CONSTRAINT [SyllabusSourceDocument_pkey] PRIMARY KEY CLUSTERED ([syllabusId])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusFaculty] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(256) NOT NULL,
    [consultation] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    [userId] NVARCHAR(64),
    CONSTRAINT [SyllabusFaculty_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusFaculty_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusFacultySection] (
    [id] NVARCHAR(64) NOT NULL,
    [facultyId] NVARCHAR(64) NOT NULL,
    [section] NVARCHAR(128) NOT NULL,
    [schedule] NVARCHAR(256) NOT NULL,
    [room] NVARCHAR(256) NOT NULL,
    [position] INT NOT NULL,
    [courseSectionId] NVARCHAR(64),
    CONSTRAINT [SyllabusFacultySection_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusFacultySection_facultyId_position_key] UNIQUE NONCLUSTERED ([facultyId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusRequirement] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [category] NVARCHAR(32) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusRequirement_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusRequirement_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusPolicy] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusPolicy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusPolicy_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusGradingComponent] (
    [id] NVARCHAR(64) NOT NULL,
    [gradingSystemId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusGradingComponent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusGradingComponent_gradingSystemId_position_key] UNIQUE NONCLUSTERED ([gradingSystemId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusRubric] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [category] NVARCHAR(256) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusRubric_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusRubric_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusRubricLevel] (
    [rubricId] NVARCHAR(64) NOT NULL,
    [level] INT NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    CONSTRAINT [SyllabusRubricLevel_pkey] PRIMARY KEY CLUSTERED ([rubricId],[level])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusOutlineBlock] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [timeFrame] NVARCHAR(256) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusOutlineBlock_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusOutlineBlock_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusOutlineTopic] (
    [id] NVARCHAR(64) NOT NULL,
    [outlineBlockId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusOutlineTopic_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusOutlineTopic_outlineBlockId_position_key] UNIQUE NONCLUSTERED ([outlineBlockId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusLearningPlan] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [week] NVARCHAR(128) NOT NULL,
    [hoursLab] INT NOT NULL,
    [hoursLec] INT NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlan_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlan_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusLearningPlanOutcome] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanOutcome_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanOutcome_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusLearningPlanTopic] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanTopic_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanTopic_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusLearningPlanMethod] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanMethod_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanMethod_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusLearningPlanResource] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanResource_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanResource_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusLearningPlanAssessment] (
    [id] NVARCHAR(64) NOT NULL,
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusLearningPlanAssessment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusLearningPlanAssessment_learningPlanId_position_key] UNIQUE NONCLUSTERED ([learningPlanId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusLearningPlanSdg] (
    [learningPlanId] NVARCHAR(64) NOT NULL,
    [goal] NVARCHAR(64) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [target] NVARCHAR(max),
    CONSTRAINT [SyllabusLearningPlanSdg_pkey] PRIMARY KEY CLUSTERED ([learningPlanId])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusCourseOutcome] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [number] INT NOT NULL,
    [statement] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusCourseOutcome_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusCourseOutcome_syllabusId_number_key] UNIQUE NONCLUSTERED ([syllabusId],[number]),
    CONSTRAINT [SyllabusCourseOutcome_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusCourseMap] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [courseOutcomeId] NVARCHAR(64) NOT NULL,
    [coNumber] INT NOT NULL,
    [coStatement] NVARCHAR(max) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusCourseMap_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusCourseMap_courseOutcomeId_key] UNIQUE NONCLUSTERED ([courseOutcomeId]),
    CONSTRAINT [SyllabusCourseMap_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusCourseMapProgramOutcome] (
    [courseMapId] NVARCHAR(64) NOT NULL,
    [programOutcomeId] NVARCHAR(64) NOT NULL,
    [level] NVARCHAR(1) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusCourseMapProgramOutcome_pkey] PRIMARY KEY CLUSTERED ([courseMapId],[programOutcomeId]),
    CONSTRAINT [SyllabusCourseMapProgramOutcome_courseMapId_position_key] UNIQUE NONCLUSTERED ([courseMapId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusReference] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [citation] NVARCHAR(max) NOT NULL,
    [year] NVARCHAR(32) NOT NULL,
    [doiOrPublisher] NVARCHAR(max),
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusReference_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusReference_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusSignatory] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [role] NVARCHAR(32) NOT NULL,
    [name] NVARCHAR(256) NOT NULL,
    [title] NVARCHAR(256) NOT NULL,
    [position] INT NOT NULL,
    CONSTRAINT [SyllabusSignatory_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusSignatory_syllabusId_position_key] UNIQUE NONCLUSTERED ([syllabusId],[position])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusExtensionField] (
    [id] NVARCHAR(64) NOT NULL,
    [syllabusId] NVARCHAR(64) NOT NULL,
    [path] NVARCHAR(512) NOT NULL,
    [value] NVARCHAR(max) NOT NULL,
    [valueType] NVARCHAR(64) NOT NULL,
    CONSTRAINT [SyllabusExtensionField_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusExtensionField_syllabusId_path_key] UNIQUE NONCLUSTERED ([syllabusId],[path])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusMigrationAudit] (
    [id] NVARCHAR(64) NOT NULL,
    [originalCourseId] NVARCHAR(64) NOT NULL,
    [originalRevisionId] NVARCHAR(64),
    [sourceChecksum] NVARCHAR(128) NOT NULL,
    [status] NVARCHAR(32) NOT NULL,
    [scannedCount] INT NOT NULL CONSTRAINT [SyllabusMigrationAudit_scannedCount_df] DEFAULT 0,
    [createdCount] INT NOT NULL CONSTRAINT [SyllabusMigrationAudit_createdCount_df] DEFAULT 0,
    [updatedCount] INT NOT NULL CONSTRAINT [SyllabusMigrationAudit_updatedCount_df] DEFAULT 0,
    [skippedCount] INT NOT NULL CONSTRAINT [SyllabusMigrationAudit_skippedCount_df] DEFAULT 0,
    [conflictedCount] INT NOT NULL CONSTRAINT [SyllabusMigrationAudit_conflictedCount_df] DEFAULT 0,
    [errorText] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SyllabusMigrationAudit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    [completedAt] DATETIME2,
    CONSTRAINT [SyllabusMigrationAudit_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SyllabusMigrationAudit_originalCourseId_sourceChecksum_key] UNIQUE NONCLUSTERED ([originalCourseId],[sourceChecksum])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusMigrationAuditCourseLink] (
    [auditId] NVARCHAR(64) NOT NULL,
    [courseId] NVARCHAR(64),
    CONSTRAINT [SyllabusMigrationAuditCourseLink_pkey] PRIMARY KEY CLUSTERED ([auditId])
);

-- CreateTable
CREATE TABLE [dbo].[SyllabusMigrationAuditRevisionLink] (
    [auditId] NVARCHAR(64) NOT NULL,
    [revisionId] NVARCHAR(64),
    CONSTRAINT [SyllabusMigrationAuditRevisionLink_pkey] PRIMARY KEY CLUSTERED ([auditId])
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
CREATE TABLE [dbo].[CourseGrade] (
    [courseId] NVARCHAR(64) NOT NULL,
    [studentId] NVARCHAR(64) NOT NULL,
    [midtermGrade] FLOAT(53),
    [finalGrade] FLOAT(53),
    [sprCells] NVARCHAR(max),
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CourseGrade_pkey] PRIMARY KEY CLUSTERED ([courseId],[studentId])
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

-- CreateIndex
CREATE NONCLUSTERED INDEX [SyllabusMigrationAuditCourseLink_courseId_idx] ON [dbo].[SyllabusMigrationAuditCourseLink]([courseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SyllabusMigrationAuditRevisionLink_revisionId_idx] ON [dbo].[SyllabusMigrationAuditRevisionLink]([revisionId]);

CREATE UNIQUE INDEX [Course_currentSyllabusId_key] ON [dbo].[Course] ([currentSyllabusId]) WHERE [currentSyllabusId] IS NOT NULL;
CREATE UNIQUE INDEX [Syllabus_courseId_status_published_key] ON [dbo].[Syllabus] ([courseId], [status]) WHERE [status] = N'published';

CREATE INDEX [Syllabus_parentSyllabusId_idx] ON [dbo].[Syllabus] ([parentSyllabusId]);
CREATE INDEX [SyllabusProgramOutcome_programOutcomeId_idx] ON [dbo].[SyllabusProgramOutcome] ([programOutcomeId]);
CREATE INDEX [SyllabusCoreValue_coreValueId_idx] ON [dbo].[SyllabusCoreValue] ([coreValueId]);
CREATE INDEX [SyllabusGraduateAttribute_graduateAttributeId_idx] ON [dbo].[SyllabusGraduateAttribute] ([graduateAttributeId]);
CREATE INDEX [SyllabusSourceDocument_courseFileId_idx] ON [dbo].[SyllabusSourceDocument] ([courseFileId]);
CREATE INDEX [SyllabusFaculty_userId_idx] ON [dbo].[SyllabusFaculty] ([userId]);
CREATE INDEX [SyllabusFacultySection_courseSectionId_idx] ON [dbo].[SyllabusFacultySection] ([courseSectionId]);
CREATE INDEX [SyllabusCourseMapProgramOutcome_programOutcomeId_idx] ON [dbo].[SyllabusCourseMapProgramOutcome] ([programOutcomeId]);

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

-- AddForeignKey
ALTER TABLE [dbo].[Course] ADD CONSTRAINT [Course_instructorId_fkey] FOREIGN KEY ([instructorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Course] ADD CONSTRAINT [Course_currentSyllabusId_fkey] FOREIGN KEY ([currentSyllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

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
ALTER TABLE [dbo].[Submission] ADD CONSTRAINT [Submission_examId_fkey] FOREIGN KEY ([examId]) REFERENCES [dbo].[Exam]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SubmissionComment] ADD CONSTRAINT [SubmissionComment_submissionId_fkey] FOREIGN KEY ([submissionId]) REFERENCES [dbo].[Submission]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[QuizQuestion] ADD CONSTRAINT [QuizQuestion_quizId_fkey] FOREIGN KEY ([quizId]) REFERENCES [dbo].[Quiz]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[QuizQuestion] ADD CONSTRAINT [QuizQuestion_activityId_fkey] FOREIGN KEY ([activityId]) REFERENCES [dbo].[Activity]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[QuizQuestion] ADD CONSTRAINT [QuizQuestion_examId_fkey] FOREIGN KEY ([examId]) REFERENCES [dbo].[Exam]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE [dbo].[Syllabus] ADD CONSTRAINT [Syllabus_courseId_fkey] FOREIGN KEY ([courseId]) REFERENCES [dbo].[Course]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Syllabus] ADD CONSTRAINT [Syllabus_parentSyllabusId_fkey] FOREIGN KEY ([parentSyllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusProgramOutcome] ADD CONSTRAINT [SyllabusProgramOutcome_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusProgramOutcome] ADD CONSTRAINT [SyllabusProgramOutcome_programOutcomeId_fkey] FOREIGN KEY ([programOutcomeId]) REFERENCES [dbo].[ProgramOutcome]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusCoreValue] ADD CONSTRAINT [SyllabusCoreValue_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusCoreValue] ADD CONSTRAINT [SyllabusCoreValue_coreValueId_fkey] FOREIGN KEY ([coreValueId]) REFERENCES [dbo].[CoreValue]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusGraduateAttribute] ADD CONSTRAINT [SyllabusGraduateAttribute_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusGraduateAttribute] ADD CONSTRAINT [SyllabusGraduateAttribute_graduateAttributeId_fkey] FOREIGN KEY ([graduateAttributeId]) REFERENCES [dbo].[GraduateAttribute]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusInstitution] ADD CONSTRAINT [SyllabusInstitution_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusCourseInfo] ADD CONSTRAINT [SyllabusCourseInfo_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusInstitutionalStatement] ADD CONSTRAINT [SyllabusInstitutionalStatement_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusGradingSystem] ADD CONSTRAINT [SyllabusGradingSystem_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusSourceDocument] ADD CONSTRAINT [SyllabusSourceDocument_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusSourceDocument] ADD CONSTRAINT [SyllabusSourceDocument_courseFileId_fkey] FOREIGN KEY ([courseFileId]) REFERENCES [dbo].[CourseFile]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusFaculty] ADD CONSTRAINT [SyllabusFaculty_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusFaculty] ADD CONSTRAINT [SyllabusFaculty_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusFacultySection] ADD CONSTRAINT [SyllabusFacultySection_facultyId_fkey] FOREIGN KEY ([facultyId]) REFERENCES [dbo].[SyllabusFaculty]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusFacultySection] ADD CONSTRAINT [SyllabusFacultySection_courseSectionId_fkey] FOREIGN KEY ([courseSectionId]) REFERENCES [dbo].[CourseSection]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusRequirement] ADD CONSTRAINT [SyllabusRequirement_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusPolicy] ADD CONSTRAINT [SyllabusPolicy_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusGradingComponent] ADD CONSTRAINT [SyllabusGradingComponent_gradingSystemId_fkey] FOREIGN KEY ([gradingSystemId]) REFERENCES [dbo].[SyllabusGradingSystem]([syllabusId]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusRubric] ADD CONSTRAINT [SyllabusRubric_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusRubricLevel] ADD CONSTRAINT [SyllabusRubricLevel_rubricId_fkey] FOREIGN KEY ([rubricId]) REFERENCES [dbo].[SyllabusRubric]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusOutlineBlock] ADD CONSTRAINT [SyllabusOutlineBlock_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusOutlineTopic] ADD CONSTRAINT [SyllabusOutlineTopic_outlineBlockId_fkey] FOREIGN KEY ([outlineBlockId]) REFERENCES [dbo].[SyllabusOutlineBlock]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusLearningPlan] ADD CONSTRAINT [SyllabusLearningPlan_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusLearningPlanOutcome] ADD CONSTRAINT [SyllabusLearningPlanOutcome_learningPlanId_fkey] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusLearningPlanTopic] ADD CONSTRAINT [SyllabusLearningPlanTopic_learningPlanId_fkey] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusLearningPlanMethod] ADD CONSTRAINT [SyllabusLearningPlanMethod_learningPlanId_fkey] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusLearningPlanResource] ADD CONSTRAINT [SyllabusLearningPlanResource_learningPlanId_fkey] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusLearningPlanAssessment] ADD CONSTRAINT [SyllabusLearningPlanAssessment_learningPlanId_fkey] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusLearningPlanSdg] ADD CONSTRAINT [SyllabusLearningPlanSdg_learningPlanId_fkey] FOREIGN KEY ([learningPlanId]) REFERENCES [dbo].[SyllabusLearningPlan]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusCourseOutcome] ADD CONSTRAINT [SyllabusCourseOutcome_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusCourseMap] ADD CONSTRAINT [SyllabusCourseMap_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusCourseMap] ADD CONSTRAINT [SyllabusCourseMap_courseOutcomeId_fkey] FOREIGN KEY ([courseOutcomeId]) REFERENCES [dbo].[SyllabusCourseOutcome]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusCourseMapProgramOutcome] ADD CONSTRAINT [SyllabusCourseMapProgramOutcome_courseMapId_fkey] FOREIGN KEY ([courseMapId]) REFERENCES [dbo].[SyllabusCourseMap]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusCourseMapProgramOutcome] ADD CONSTRAINT [SyllabusCourseMapProgramOutcome_programOutcomeId_fkey] FOREIGN KEY ([programOutcomeId]) REFERENCES [dbo].[ProgramOutcome]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusReference] ADD CONSTRAINT [SyllabusReference_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusSignatory] ADD CONSTRAINT [SyllabusSignatory_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusExtensionField] ADD CONSTRAINT [SyllabusExtensionField_syllabusId_fkey] FOREIGN KEY ([syllabusId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusMigrationAuditCourseLink] ADD CONSTRAINT [SyllabusMigrationAuditCourseLink_auditId_fkey] FOREIGN KEY ([auditId]) REFERENCES [dbo].[SyllabusMigrationAudit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusMigrationAuditCourseLink] ADD CONSTRAINT [SyllabusMigrationAuditCourseLink_courseId_fkey] FOREIGN KEY ([courseId]) REFERENCES [dbo].[Course]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusMigrationAuditRevisionLink] ADD CONSTRAINT [SyllabusMigrationAuditRevisionLink_auditId_fkey] FOREIGN KEY ([auditId]) REFERENCES [dbo].[SyllabusMigrationAudit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SyllabusMigrationAuditRevisionLink] ADD CONSTRAINT [SyllabusMigrationAuditRevisionLink_revisionId_fkey] FOREIGN KEY ([revisionId]) REFERENCES [dbo].[Syllabus]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
