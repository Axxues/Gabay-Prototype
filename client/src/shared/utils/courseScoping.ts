import type { Course, User, UserRole, College, Department } from '../types/lms';
import { isDeanRole, isChairRole } from './roles';

export interface CourseScopingParams {
  courses: Course[];
  users: User[];
  activeUser: User;
  activeRole: UserRole;
  approvedCourseIds?: Set<string>;
  colleges?: College[];
  departments?: Department[];
  selectedCollegeId?: string;
  selectedProgramId?: string;
}

/**
 * Normalizes an academic department/program name or description for flexible comparison.
 * Strips common prefixes like "Department of ", "Program in ", "Bachelor of Science in ", "BS in ", "BS ", etc.
 */
export function normalizeDepartmentName(str?: string | null): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/^department\s+of\s+/i, '')
    .replace(/^college\s+of\s+/i, '')
    .replace(/^program\s+in\s+/i, '')
    .replace(/^bachelor\s+of\s+science\s+in\s+/i, '')
    .replace(/^bachelor\s+in\s+/i, '')
    .replace(/^bachelor\s+of\s+/i, '')
    .replace(/^bs\s+in\s+/i, '')
    .replace(/^bs\s+/i, '')
    .replace(/\s+department$/i, '')
    .replace(/\s+program$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a given course belongs to or is affiliated with an academic program/department.
 */
export function courseMatchesProgram(course: Course, dept: Department, users: User[] = []): boolean {
  if (!dept) return false;
  const deptId = (dept.id || '').toLowerCase().trim();
  const deptName = (dept.name || '').toLowerCase().trim();
  const deptCode = (dept.code || '').toLowerCase().trim();
  const normDeptName = normalizeDepartmentName(dept.name);

  const c = course as any;

  // 1. Explicit ID matches
  if (c.departmentId && c.departmentId.toLowerCase().trim() === deptId) return true;
  if (c.programId && c.programId.toLowerCase().trim() === deptId) return true;

  // 2. Direct course.department matching
  if (c.department) {
    const cDeptRaw = String(c.department).toLowerCase().trim();
    const cDeptNorm = normalizeDepartmentName(String(c.department));
    if (cDeptRaw === deptId || cDeptRaw === deptCode || cDeptRaw === deptName) return true;
    if (cDeptNorm && normDeptName && (cDeptNorm === normDeptName || cDeptNorm.includes(normDeptName) || normDeptName.includes(cDeptNorm))) return true;
    if ((deptCode === 'cs' || deptCode === 'bscs') && (cDeptRaw === 'bscs' || cDeptRaw === 'cs')) return true;
    if ((deptCode === 'it' || deptCode === 'bsit') && (cDeptRaw === 'it' || cDeptRaw === 'bsit' || cDeptNorm.includes('information technology'))) return true;
  }

  // 3. Instructor affiliation
  const instId = course.instructorId || c.instructor_id || (typeof c.instructor === 'object' ? c.instructor?.id : c.instructor);
  if (instId) {
    const instructor = users.find(u => u.id === instId);
    if (instructor) {
      if ((instructor as any).departmentId && (instructor as any).departmentId.toLowerCase().trim() === deptId) return true;
      for (const field of [instructor.department, instructor.program]) {
        if (!field) continue;
        const fRaw = String(field).toLowerCase().trim();
        const fNorm = normalizeDepartmentName(String(field));
        if (fRaw === deptId || fRaw === deptCode || fRaw === deptName) return true;
        if (fNorm && normDeptName && (fNorm === normDeptName || fNorm.includes(normDeptName) || normDeptName.includes(fNorm))) return true;
        if ((deptCode === 'cs' || deptCode === 'bscs') && (fRaw === 'bscs' || fRaw === 'cs' || fNorm.includes('computer science'))) return true;
        if ((deptCode === 'it' || deptCode === 'bsit') && (fRaw === 'it' || fRaw === 'bsit' || fNorm.includes('information technology'))) return true;
      }
    }
  }

  // 4. Section prefix matching (e.g. BSCS 4-1, BSIT 1-A, CS 1-A, IT 2-B)
  if (course.section) {
    const sec = course.section.trim().toUpperCase();
    if (deptCode === 'cs' || deptCode === 'bscs' || normDeptName === 'computer science') {
      if (/^BSCS/i.test(sec) || /^CS[\s\-_0-9]/i.test(sec) || sec === 'CS') return true;
    }
    if (deptCode === 'it' || deptCode === 'bsit' || normDeptName === 'information technology') {
      if (/^BSIT/i.test(sec) || /^IT[\s\-_0-9]/i.test(sec) || sec === 'IT') return true;
    }
    if (deptCode && (sec.startsWith(deptCode.toUpperCase() + ' ') || sec.startsWith(deptCode.toUpperCase() + '-') || sec === deptCode.toUpperCase())) {
      return true;
    }
  }

  // 5. Course Code prefix matching (e.g. CSCC 103, CCSC 303, CSPC 112, CSCB 101, CMSC 199, IT 201, ITEC 101)
  if (course.code) {
    const code = course.code.trim().toUpperCase();
    if (deptCode === 'cs' || deptCode === 'bscs' || normDeptName === 'computer science') {
      if (/^(CS|CMSC|CCSC|CSPC|CSCB)\b/i.test(code) || /^(CS|CMSC|CCSC|CSPC|CSCB)\s*[0-9]/i.test(code)) return true;
    }
    if (deptCode === 'it' || deptCode === 'bsit' || normDeptName === 'information technology') {
      if (/^(IT|BSIT|ITEC|IS|BSIS)\b/i.test(code) || /^(IT|BSIT|ITEC|IS|BSIS)\s*[0-9]/i.test(code)) return true;
    }
    if (deptCode && (code.startsWith(deptCode.toUpperCase() + ' ') || code.startsWith(deptCode.toUpperCase() + '-') || code === deptCode.toUpperCase())) {
      if (!/^(IT|IS)/i.test(code) || deptCode === 'it' || deptCode === 'bsit') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a given course belongs to or is affiliated with a collegiate unit.
 */
export function courseMatchesCollege(
  course: Course,
  collegeId: string,
  collegeName: string,
  departments: Department[] = [],
  users: User[] = []
): boolean {
  if (!collegeId && !collegeName) return false;
  const c = course as any;
  const cleanColId = (collegeId || '').toLowerCase().trim();
  const cleanColName = (collegeName || '').toLowerCase().trim();

  // 1. Direct collegeId match
  if (c.collegeId && c.collegeId.toLowerCase().trim() === cleanColId) return true;

  // 2. Direct college name or alias match
  if (c.college) {
    const cCol = String(c.college).toLowerCase().trim();
    if (cCol === cleanColId || cCol === cleanColName || (cleanColName && cCol.includes(cleanColName))) {
      return true;
    }
  }

  // 3. Check all departments belonging to this college
  const deptsInCollege = departments.filter(
    d => cleanColId && d.collegeId && d.collegeId.toLowerCase().trim() === cleanColId
  );

  for (const dept of deptsInCollege) {
    if (courseMatchesProgram(course, dept, users)) return true;
  }

  // 4. Check instructor's college affiliation
  const instId = course.instructorId || c.instructor_id || (typeof c.instructor === 'object' ? c.instructor?.id : c.instructor);
  if (instId) {
    const instructor = users.find(u => u.id === instId);
    if (instructor) {
      if (cleanColId && instructor.collegeId && instructor.collegeId.toLowerCase().trim() === cleanColId) return true;
      if (
        cleanColName &&
        instructor.collegeName &&
        instructor.collegeName.toLowerCase().trim() === cleanColName
      ) {
        return true;
      }
      if (instructor.department) {
        const instDept = instructor.department.toLowerCase().trim();
        if (cleanColName && (instDept === cleanColName || instDept.includes(cleanColName) || cleanColName.includes(instDept))) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Filter courses based on user role, jurisdiction, and active navigation filters:
 * - student: only enrolled courses (via enrolledCourseIds or approved requests)
 * - faculty: only courses where instructorId === activeUser.id (faculty have no manual course creation or oversight)
 * - chairperson: only courses in the academic program handled by the chair
 * - dean: courses throughout their college, with optional program filter
 * - admin / superadmin: courses throughout the university, with optional college and program filters
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
  selectedCollegeId,
  selectedProgramId,
}: CourseScopingParams): Course[] {
  if (!activeUser) return [];

  // Students see only their enrolled courses
  if (activeRole === 'student') {
    return courses.filter(
      c => (activeUser.enrolledCourseIds || []).includes(c.id) || approvedCourseIds.has(c.id)
    );
  }

  // Faculty see only their own assigned teaching courses
  if (activeRole === 'faculty') {
    return courses.filter(course => course.instructorId === activeUser.id);
  }

  // Staff: empty for dashboard scoping (has read-only course catalog inspect in CoursesPage)
  if (activeRole === 'staff') {
    return [];
  }

  // Chairperson: sees only courses in the program they handle
  if (isChairRole(activeUser, activeRole)) {
    const chairDeptObj = departments.find(
      d =>
        d.chairpersonId === activeUser.id ||
        (activeUser.department &&
          (d.name.toLowerCase() === activeUser.department.toLowerCase() ||
            d.id === activeUser.department ||
            d.code.toLowerCase() === activeUser.department.toLowerCase())) ||
        (activeUser.program &&
          (d.name.toLowerCase() === activeUser.program.toLowerCase() ||
            d.id === activeUser.program ||
            d.code.toLowerCase() === activeUser.program.toLowerCase()))
    );

    if (chairDeptObj) {
      return courses.filter(course => courseMatchesProgram(course, chairDeptObj, users));
    }

    // Fallback if no matching department entity found
    const fallbackDeptName = (activeUser.program || activeUser.department || '').toLowerCase();
    if (!fallbackDeptName) return [];

    return courses.filter(course => {
      const c = course as any;
      if (c.department && String(c.department).toLowerCase() === fallbackDeptName) return true;
      const instructor = users.find(u => u.id === course.instructorId);
      if (instructor) {
        const instDept = (instructor.program || instructor.department || '').toLowerCase();
        if (instDept === fallbackDeptName) return true;
      }
      return false;
    });
  }

  // Dean: fixed to their home college (College-Wide audit).
  // `selectedCollegeId` is an admin-only selector; a stale or forged value must
  // never widen a dean's jurisdiction beyond their own college.
  if (isDeanRole(activeUser, activeRole)) {
    const deanCollegeId =
      activeUser.collegeId ||
      colleges.find(c => c.deanId === activeUser.id)?.id;
    const deanCollege = colleges.find(
      c =>
        c.id === deanCollegeId ||
        (activeUser.collegeName && c.name?.toLowerCase() === activeUser.collegeName.toLowerCase())
    );
    const effectiveCollegeId = deanCollegeId || deanCollege?.id || '';
    const effectiveCollegeName = (deanCollege?.name || activeUser.collegeName || '').toLowerCase();

    let collegeCourses = courses.filter(course =>
      courseMatchesCollege(course, effectiveCollegeId, effectiveCollegeName, departments, users)
    );

    if (selectedProgramId && selectedProgramId !== 'all') {
      const normalizedCollegeId = effectiveCollegeId.toLowerCase().trim();
      const targetDept = departments.find(
        d =>
          (d.id === selectedProgramId || d.code?.toLowerCase() === selectedProgramId.toLowerCase()) &&
          // Program tabs are limited to the dean's own college; a program from
          // another college resolves to nothing rather than leaking its courses.
          (!normalizedCollegeId ||
            !d.collegeId ||
            d.collegeId.toLowerCase().trim() === normalizedCollegeId)
      );
      collegeCourses = targetDept
        ? collegeCourses.filter(course => courseMatchesProgram(course, targetDept, users))
        : [];
    }

    return collegeCourses;
  }

  // Admin / Superadmin: monitors university-wide, with optional college and program filtering
  if (
    activeRole === 'admin' ||
    activeRole === 'superadmin' ||
    activeUser.adminSubrole === 'chancellor'
  ) {
    let result = [...courses];

    // Filter by college if selected
    if (selectedCollegeId && selectedCollegeId !== 'all') {
      const collegeObj = colleges.find(
        c => c.id === selectedCollegeId || c.code?.toLowerCase() === selectedCollegeId.toLowerCase()
      );
      result = result.filter(course =>
        courseMatchesCollege(
          course,
          selectedCollegeId,
          collegeObj?.name || '',
          departments,
          users
        )
      );
    }

    // Filter by program if selected
    if (selectedProgramId && selectedProgramId !== 'all') {
      const targetDept = departments.find(
        d => d.id === selectedProgramId || d.code.toLowerCase() === selectedProgramId.toLowerCase()
      );
      if (targetDept) {
        result = result.filter(course => courseMatchesProgram(course, targetDept, users));
      }
    }

    return result;
  }

  return courses;
}

/**
 * Determines whether a user is allowed to comment on announcements or modules
 * for a given course based on collegiate and program boundaries:
 * - Admin/superadmin: unrestricted across all colleges and programs.
 * - Student: must be enrolled/approved for the course, or affiliated with the course's program/college.
 * - Instructor/Faculty: must be assigned to the course, or affiliated with the course's department/college.
 * - Chairperson: course must belong to the chairperson's academic department/program.
 * - Dean: course must belong to the dean's collegiate unit.
 * - Staff: must be affiliated with the course's department or college.
 */
export function canUserCommentOnCourse(
  user?: User | null,
  role?: UserRole | null,
  course?: Course | null,
  departments: Department[] = [],
  colleges: College[] = [],
  approvedCourseIds: Set<string> = new Set()
): boolean {
  if (!user || !course) return false;
  const effectiveRole = role || user.role;

  // 1. Admin/superadmin: unrestricted across all colleges and programs
  if (
    effectiveRole === 'admin' ||
    effectiveRole === 'superadmin' ||
    user.role === 'admin' ||
    user.role === 'superadmin'
  ) {
    return true;
  }

  // 2. Student: enrolled or approved for this course, or belonging to its program/college
  if (effectiveRole === 'student') {
    if ((user.enrolledCourseIds || []).includes(course.id) || approvedCourseIds.has(course.id)) {
      return true;
    }
    if (user.department || user.program) {
      const studentDept = departments.find(
        d =>
          (user.department &&
            (d.id === user.department ||
              d.name.toLowerCase() === user.department.toLowerCase() ||
              d.code.toLowerCase() === user.department.toLowerCase())) ||
          (user.program &&
            (d.id === user.program ||
              d.name.toLowerCase() === user.program.toLowerCase() ||
              d.code.toLowerCase() === user.program.toLowerCase()))
      );
      if (studentDept && courseMatchesProgram(course, studentDept)) {
        return true;
      }
    }
    if (user.collegeId || user.collegeName) {
      if (courseMatchesCollege(course, user.collegeId || '', user.collegeName || '', departments)) {
        return true;
      }
    }
    return false;
  }

  // 3. Faculty / Instructor: assigned instructor, or belonging to the course's department/college
  if (effectiveRole === 'faculty') {
    if (course.instructorId === user.id) {
      return true;
    }
    if (user.department || user.program) {
      const facDept = departments.find(
        d =>
          (user.department &&
            (d.id === user.department ||
              d.name.toLowerCase() === user.department.toLowerCase() ||
              d.code.toLowerCase() === user.department.toLowerCase())) ||
          (user.program &&
            (d.id === user.program ||
              d.name.toLowerCase() === user.program.toLowerCase() ||
              d.code.toLowerCase() === user.program.toLowerCase()))
      );
      if (facDept && courseMatchesProgram(course, facDept)) {
        return true;
      }
    }
    if (user.collegeId || user.collegeName) {
      if (courseMatchesCollege(course, user.collegeId || '', user.collegeName || '', departments)) {
        return true;
      }
    }
    return false;
  }

  // 4. Chairperson: course must belong to the chair's academic department/program
  if (isChairRole(user, effectiveRole)) {
    const chairDept = departments.find(
      d =>
        d.chairpersonId === user.id ||
        (user.department &&
          (d.name.toLowerCase() === user.department.toLowerCase() ||
            d.id === user.department ||
            d.code.toLowerCase() === user.department.toLowerCase())) ||
        (user.program &&
          (d.name.toLowerCase() === user.program.toLowerCase() ||
            d.id === user.program ||
            d.code.toLowerCase() === user.program.toLowerCase()))
    );
    if (chairDept && courseMatchesProgram(course, chairDept)) {
      return true;
    }
    return false;
  }

  // 5. Dean: course must belong to the dean's college
  if (isDeanRole(user, effectiveRole)) {
    const deanCol = colleges.find(
      c =>
        c.deanId === user.id ||
        (user.collegeId && c.id === user.collegeId) ||
        (user.collegeName && c.name.toLowerCase() === user.collegeName.toLowerCase())
    );
    const colId = deanCol?.id || user.collegeId || '';
    const colName = deanCol?.name || user.collegeName || '';
    if (courseMatchesCollege(course, colId, colName, departments)) {
      return true;
    }
    return false;
  }

  // 6. Staff: must match department or college
  if (effectiveRole === 'staff') {
    if (user.department) {
      const staffDept = departments.find(
        d =>
          d.id === user.department ||
          d.name.toLowerCase() === user.department.toLowerCase() ||
          d.code.toLowerCase() === user.department.toLowerCase()
      );
      if (staffDept && courseMatchesProgram(course, staffDept)) {
        return true;
      }
    }
    if (user.collegeId || user.collegeName) {
      if (courseMatchesCollege(course, user.collegeId || '', user.collegeName || '', departments)) {
        return true;
      }
    }
    return false;
  }

  return false;
}

