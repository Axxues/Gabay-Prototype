import type { Course, User, UserRole, College, Department } from '../types/lms';

export interface CourseScopingParams {
  courses: Course[];
  users: User[];
  activeUser: User;
  activeRole: UserRole;
  approvedCourseIds?: Set<string>;
  colleges?: College[];
  departments?: Department[];
}

/**
 * Filter courses based on user role and hierarchy:
 * - student: only enrolled courses (via enrolledCourseIds or approved requests)
 * - superadmin / chancellor: all courses across the entire institution
 * - dean: courses where instructor belongs to their college (or course belongs to college) + own courses
 * - chairperson: courses where instructor belongs to their department + own courses
 * - admin (general): courses where instructorId === activeUser.id
 * - faculty: only courses where instructorId === activeUser.id
 * - staff: empty on dashboard; catalog inspect on CoursesPage
 */
export function getScopedCourses({
  courses = [],
  users = [],
  activeUser,
  activeRole,
  approvedCourseIds = new Set(),
  colleges = [],
  departments = [],
}: CourseScopingParams): Course[] {
  if (!activeUser) return [];

  // Students see only their enrolled courses
  if (activeRole === 'student') {
    return courses.filter(
      c => (activeUser.enrolledCourseIds || []).includes(c.id) || approvedCourseIds.has(c.id)
    );
  }

  // Chancellor (Superadmin) sees all courses across all colleges
  if (activeRole === 'superadmin' || activeUser.adminSubrole === 'chancellor') {
    return courses;
  }

  // Dean scoping: courses where instructor belongs to their college, plus their own courses
  if (activeRole === 'admin' && activeUser.adminSubrole === 'dean') {
    const deanCollegeId = activeUser.collegeId || colleges.find(c => c.deanId === activeUser.id)?.id;
    const deanCollege = colleges.find(
      c => c.id === deanCollegeId || (activeUser.collegeName && c.name.toLowerCase() === activeUser.collegeName.toLowerCase())
    );
    const effectiveCollegeId = deanCollegeId || deanCollege?.id;
    const effectiveCollegeName = (deanCollege?.name || activeUser.collegeName || '').toLowerCase();

    const collegeDeptNames = new Set(
      departments
        .filter(d => effectiveCollegeId && d.collegeId === effectiveCollegeId)
        .map(d => d.name.toLowerCase())
    );
    const collegeDeptCodes = new Set(
      departments
        .filter(d => effectiveCollegeId && d.collegeId === effectiveCollegeId)
        .map(d => d.code.toLowerCase())
    );

    return courses.filter(course => {
      // Always include courses authored by the active user
      if (course.instructorId === activeUser.id) return true;

      // Direct course collegeId check if available
      if (effectiveCollegeId && (course as any).collegeId === effectiveCollegeId) return true;

      // Match instructor's affiliation
      const instructor = users.find(u => u.id === course.instructorId);
      if (!instructor) return false;

      if (effectiveCollegeId && instructor.collegeId === effectiveCollegeId) return true;
      if (effectiveCollegeName && instructor.collegeName && instructor.collegeName.toLowerCase() === effectiveCollegeName) {
        return true;
      }
      if (instructor.department) {
        const deptLower = instructor.department.toLowerCase();
        if (effectiveCollegeName && deptLower === effectiveCollegeName) return true;
        if (collegeDeptNames.has(deptLower) || collegeDeptCodes.has(deptLower)) return true;
      }

      return false;
    });
  }

  // Chairperson scoping: courses where instructor belongs to their department, plus their own courses
  if (activeRole === 'admin' && activeUser.adminSubrole === 'chairperson') {
    const chairDeptObj = departments.find(
      d =>
        d.chairpersonId === activeUser.id ||
        (activeUser.department &&
          (d.name.toLowerCase() === activeUser.department.toLowerCase() ||
            d.id === activeUser.department ||
            d.code.toLowerCase() === activeUser.department.toLowerCase()))
    );
    const chairDeptName = (chairDeptObj?.name || activeUser.department || '').toLowerCase();
    const chairDeptCode = chairDeptObj?.code?.toLowerCase();
    const chairDeptId = chairDeptObj?.id;

    return courses.filter(course => {
      // Always include courses authored by the active user
      if (course.instructorId === activeUser.id) return true;

      // Direct course department check if available
      if ((course as any).department) {
        const cDept = String((course as any).department).toLowerCase();
        if (chairDeptName && cDept === chairDeptName) return true;
        if (chairDeptCode && cDept === chairDeptCode) return true;
        if (chairDeptId && cDept === chairDeptId) return true;
      }

      // Match instructor's department affiliation
      const instructor = users.find(u => u.id === course.instructorId);
      if (!instructor) return false;

      if (chairDeptId && ((instructor as any).departmentId === chairDeptId || instructor.collegeId === chairDeptId)) {
        return true;
      }
      if (instructor.department) {
        const instDept = instructor.department.toLowerCase();
        if (chairDeptName && instDept === chairDeptName) return true;
        if (chairDeptCode && instDept === chairDeptCode) return true;
        if (chairDeptId && instDept === chairDeptId.toLowerCase()) return true;
      }

      return false;
    });
  }

  // General Admin without subrole: default to own courses (or college/department if specified)
  if (activeRole === 'admin') {
    return courses.filter(course => course.instructorId === activeUser.id);
  }

  // Faculty: only courses where they are the instructor
  if (activeRole === 'faculty') {
    return courses.filter(course => course.instructorId === activeUser.id);
  }

  // Staff: empty for dashboard scoping (has read-only course catalog inspect in CoursesPage)
  if (activeRole === 'staff') {
    return [];
  }

  return courses;
}
