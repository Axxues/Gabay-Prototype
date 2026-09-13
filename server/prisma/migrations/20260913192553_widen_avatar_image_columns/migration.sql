-- Widen avatar/image URL columns to NVARCHAR(max) (data-URL uploads exceed 512 chars)
ALTER TABLE [dbo].[User] ALTER COLUMN [avatar] NVARCHAR(max) NOT NULL;
ALTER TABLE [dbo].[Course] ALTER COLUMN [image] NVARCHAR(max) NULL;
ALTER TABLE [dbo].[ModuleComment] ALTER COLUMN [authorAvatar] NVARCHAR(max) NOT NULL;
ALTER TABLE [dbo].[Submission] ALTER COLUMN [studentAvatar] NVARCHAR(max) NOT NULL;
ALTER TABLE [dbo].[Announcement] ALTER COLUMN [authorAvatar] NVARCHAR(max) NOT NULL;
ALTER TABLE [dbo].[DiscussionReply] ALTER COLUMN [authorAvatar] NVARCHAR(max) NOT NULL;
ALTER TABLE [dbo].[Discussion] ALTER COLUMN [authorAvatar] NVARCHAR(max) NOT NULL;
ALTER TABLE [dbo].[AnnouncementReply] ALTER COLUMN [authorAvatar] NVARCHAR(max) NOT NULL;
ALTER TABLE [dbo].[ChatGroup] ALTER COLUMN [avatar] NVARCHAR(max) NULL;
ALTER TABLE [dbo].[Notification] ALTER COLUMN [actorAvatar] NVARCHAR(max) NOT NULL;
