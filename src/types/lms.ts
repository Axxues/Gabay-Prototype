export type UserRole = 'admin' | 'faculty' | 'staff' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  studentId?: string;
  department: string;
  title: string;
  password?: string;
  enrolledCourseIds?: string[];
}

import type { OfficialSyllabusData } from '../data/syllabusData';

export interface Course {
  id: string;
  code: string;
  title: string;
  section: string;
  term: string;
  instructorId: string;
  instructorName: string;
  published: boolean;
  color?: string;
  enrolledCount: number;
  credits?: number;
  chedComplianceCode?: string;
  image?: string;
  syllabus?: OfficialSyllabusData;
}

export interface ModuleItem {
  id: string;
  title: string;
  type: 'page' | 'assignment' | 'quiz' | 'file' | 'external_url';
  published: boolean;
  required: boolean;
  completionCondition?: 'view' | 'submit' | 'min_score';
  minScore?: number;
  content?: string;
  assignmentId?: string;
  quizId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  completed?: boolean;
}

export interface ModuleComment {
  id: string;
  moduleId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
  likes?: number;
  likedBy?: string[];
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  order: number;
  published: boolean;
  prerequisiteModuleId?: string;
  items: ModuleItem[];
  comments?: ModuleComment[];
}

export interface RubricRating {
  points: number;
  description: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  points: number;
  ratings: RubricRating[];
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  pointsPossible: number;
  dueDate: string;
  submissionTypes: ('file' | 'online_text')[];
  published: boolean;
  category: string;
  weight: number; // percentage (e.g. 20 for 20%)
  rubric: RubricCriterion[];
}

export interface SubmissionComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: string;
  text: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  submittedAt: string;
  submissionType: 'file' | 'online_text';
  content?: string;
  fileUrl?: string;
  fileName?: string;
  grade?: number;
  gradedAt?: string;
  gradedBy?: string;
  status: 'submitted' | 'graded' | 'missing';
  rubricScores: Record<string, number>;
  comments: SubmissionComment[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  type: 'multiple_choice' | 'true_false';
  options?: string[];
  correctAnswer: string;
  points: number;
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  timeLimitMinutes: number;
  published: boolean;
  questions: QuizQuestion[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  courseId?: string;
  courseCode?: string;
  type: 'assignment' | 'milestone' | 'advising' | 'lecture' | 'exam' | 'event';
  description: string;
  startAt?: string;
  endAt?: string;
  isAllDay?: boolean;
  colorHex?: string;
  location?: string;
}

export interface AdvisingSlot {
  id: string;
  instructorId: string;
  instructorName: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:00 AM - 10:30 AM"
  location: string;
  status: 'available' | 'booked';
  bookedByStudentId?: string;
  bookedByStudentName?: string;
  notes?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  courseId?: string;
  courseCode?: string;
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
}

export interface HistoryLog {
  id: string;
  path: string;
  title: string;
  timestamp: string;
}

export interface CommonsTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  author: string;
  downloads: number;
  rating: number;
  tags: string[];
  chedAlignment: string;
}

export interface AnnouncementReply {
  id: string;
  announcementId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
  likes: number;
  likedBy?: string[];
}

export interface Announcement {
  id: string;
  courseId: string; // or 'all' for institutional announcements
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  createdAt: string;
  delayedUntil?: string; // scheduled release date
  sectionRestriction?: string; // 'All Sections' | 'BSCS 4-1' etc.
  allowComments: boolean;
  usersMustPostBeforeReplies?: boolean;
  allowLiking?: boolean;
  likes: number;
  likedBy?: string[];
  pinned: boolean;
  attachments?: { name: string; size: string; url?: string }[];
  replies: AnnouncementReply[];
  readBy?: string[];
}

export interface DiscussionReply {
  id: string;
  discussionId: string;
  parentId?: string; // for nested/threaded replies
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
  likes: number;
  likedBy?: string[];
  attachments?: { name: string; url?: string }[];
}

export interface Discussion {
  id: string;
  courseId: string;
  title: string;
  prompt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorRole: UserRole;
  createdAt: string;
  isGraded: boolean;
  pointsPossible?: number;
  dueDate?: string;
  pinned: boolean;
  locked: boolean;
  usersMustPostBeforeReplies: boolean;
  groupAssignment?: string;
  replies: DiscussionReply[];
}

export interface CourseFile {
  id: string;
  courseId: string; // or 'user-<id>' for personal storage
  folderId?: string | null;
  name: string;
  size: number;
  formattedSize: string;
  type: 'pdf' | 'document' | 'slide' | 'code' | 'archive' | 'image';
  visibility: 'published' | 'unpublished' | 'restricted';
  updatedAt: string;
  uploadedBy: string;
  uploadedByName: string;
  content?: string; // for built-in previewer
  url?: string;
}

export interface CourseFolder {
  id: string;
  courseId: string;
  parentId?: string | null;
  name: string;
  updatedAt: string;
}

export interface MockDatabase {
  users: User[];
  courses: Course[];
  modules: Module[];
  assignments: Assignment[];
  submissions: Submission[];
  quizzes: Quiz[];
  calendarEvents: CalendarEvent[];
  advisingSlots: AdvisingSlot[];
  messages: Message[];
  historyLogs: HistoryLog[];
  commonsTemplates: CommonsTemplate[];
  announcements?: Announcement[];
  discussions?: Discussion[];
  courseFiles?: CourseFile[];
  courseFolders?: CourseFolder[];
}
