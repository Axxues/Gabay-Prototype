/**
 * Likha ERP Directus Collection Models for GABAY LMS
 */

export interface LikhaRole {
  id: string;
  name: string;
  description?: string;
  admin_access?: boolean;
}

export interface LikhaUser {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  student_id?: string | null;
  department?: string | null;
  user_role?: 'admin' | 'faculty' | 'student' | 'staff' | string | null;
  banner?: string | null;
  student_type?: string | null;
  avatar?: string | null;
  status?: string;
}

export interface LikhaCourse {
  id: string;
  code: string;
  title: string;
  section: string;
  term: string;
  instructor_id?: string | null;
  instructor_name?: string | null;
  published: boolean;
  color?: string | null;
  image?: string | null;
  enrolled_count: number;
  credits?: number | null;
  ched_compliance_code?: string | null;
  join_code?: string | null;
  syllabus?: any;
  spr_config?: any;
  grading_terms?: any;
  grades_released?: any;
  date_created?: string;
  date_updated?: string;
}

export interface LikhaCourseSection {
  id: string;
  course_id: string;
  name: string;
  capacity?: number | null;
  enrolled_count: number;
  schedule?: string | null;
  location?: string | null;
}

export interface LikhaEnrollmentRequest {
  id: string;
  course_id: string;
  student_id: string;
  student_name: string;
  type: string; // self_join | faculty_enroll | section_switch
  status: string; // pending | approved | rejected
  requested_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  section_id?: string | null;
  target_section_id?: string | null;
}

export interface LikhaModule {
  id: string;
  course_id: string;
  title: string;
  order: number;
  published: boolean;
  prerequisite_module_id?: string | null;
  author_id?: string | null;
  author_name?: string | null;
}

export interface LikhaModuleItem {
  id: string;
  module_id: string;
  title: string;
  type: string;
  published: boolean;
  required: boolean;
  content?: string | null;
  url?: string | null;
  duration?: string | null;
  points?: number | null;
  due_date?: string | null;
  order: number;
}

export interface LikhaModuleComment {
  id: string;
  module_id: string;
  author_id: string;
  author_name: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
  likes?: string[] | null;
}

export interface LikhaActivity {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  term: string;
  format?: string | null;
  category?: string | null;
  weight?: number | null;
  total_points: number;
  due_date?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  published: boolean;
  questions?: any;
  rubric?: any;
}

export interface LikhaQuiz {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  term: string;
  time_limit_minutes: number;
  total_points: number;
  due_date?: string | null;
  published: boolean;
  questions?: any;
}

export interface LikhaExam {
  id: string;
  course_id: string;
  title: string;
  description?: string | null;
  term: string;
  time_limit_minutes: number;
  total_points: number;
  due_date?: string | null;
  published: boolean;
  questions?: any;
}

export interface LikhaSubmission {
  id: string;
  course_id: string;
  student_id: string;
  activity_id?: string | null;
  quiz_id?: string | null;
  exam_id?: string | null;
  status: string;
  score?: number | null;
  max_score?: number | null;
  submitted_at: string;
  graded_at?: string | null;
  graded_by?: string | null;
  answers?: any;
  rubric_scores?: any;
  comments?: any;
  file_url?: string | null;
  file_name?: string | null;
  content?: string | null;
}

export interface LikhaAnnouncement {
  id: string;
  course_id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string | null;
  title: string;
  content: string;
  pinned: boolean;
  created_at: string;
  likes?: string[] | null;
  replies?: any;
}

export interface LikhaDiscussion {
  id: string;
  course_id: string;
  author_id: string;
  author_name: string;
  title: string;
  content: string;
  pinned: boolean;
  locked: boolean;
  created_at: string;
  replies?: any;
}

export interface LikhaMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  recipient_name: string;
  course_id?: string | null;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
  attachment_name?: string | null;
  attachment_url?: string | null;
  group_id?: string | null;
}

export interface LikhaCalendarEvent {
  id: string;
  title: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  type: string;
  location?: string | null;
  description?: string | null;
  all_day: boolean;
  course_id?: string | null;
  user_id?: string | null;
}

export interface LikhaCourseFile {
  id: string;
  course_id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  visibility: string;
  parent_id?: string | null;
  auto_key?: string | null;
  uploaded_by?: string | null;
  uploaded_at: string;
}

export interface LikhaCourseGrade {
  id: string;
  course_id: string;
  student_id: string;
  midterm_grade?: number | null;
  final_grade?: number | null;
  spr_cells?: any;
  updated_at: string;
}

export interface LikhaSyllabus {
  id: string;
  course_id: string;
  version: number;
  status: string;
  content: any;
  published_at?: string | null;
  created_at: string;
}
