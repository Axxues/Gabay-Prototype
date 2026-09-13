-- Run once in SSMS as a sysadmin. Creates the login, the database, and maps them.
CREATE LOGIN [gabay_app] WITH PASSWORD = N'__SET_A_STRONG_PASSWORD__', CHECK_POLICY = ON;
GO
CREATE DATABASE [GabayPrototype];
GO
USE [GabayPrototype];
GO
CREATE USER [gabay_app] FOR LOGIN [gabay_app];
GO
ALTER ROLE [db_owner] ADD MEMBER [gabay_app];
GO
