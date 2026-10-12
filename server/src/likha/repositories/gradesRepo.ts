import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';
import { prisma } from '../../db.js';

export function formatLikhaGrade(g: any): any {
  if (!g) return null;
  return {
    id: g.id,
    courseId: g.course_id || g.courseId,
    studentId: g.student_id || g.studentId,
    midtermGrade: g.midterm_grade !== undefined ? g.midterm_grade : (g.midtermGrade ?? null),
    finalGrade: g.final_grade !== undefined ? g.final_grade : (g.finalGrade ?? null),
    sprCells: typeof g.spr_cells === 'object' && g.spr_cells !== null 
      ? JSON.stringify(g.spr_cells) 
      : (typeof g.sprCells === 'string' ? g.sprCells : (g.spr_cells ?? null)),
    updatedAt: g.updated_at || g.updatedAt || new Date().toISOString(),
  };
}

export async function getCourseGrades(courseId: string, studentId?: string | null): Promise<any[]> {
  try {
    const token = await getLikhaAdminToken();
    let url = `${LIKHA_URL}/items/course_grades?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=250`;
    if (studentId) {
      url += `&filter[student_id][_eq]=${encodeURIComponent(studentId)}`;
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const json = (await res.json()) as any;
      if (Array.isArray(json.data) && json.data.length > 0) {
        return json.data.map(formatLikhaGrade);
      }
    }
  } catch (err) {
    console.warn('[gradesRepo] Likha getCourseGrades failed, falling back to Prisma:', err);
  }

  // Fallback to Prisma
  const grades = await prisma.courseGrade.findMany({
    where: {
      courseId,
      ...(studentId ? { studentId } : {}),
    },
  });
  return grades.map(formatLikhaGrade);
}

export async function upsertCourseGrade(
  courseId: string,
  studentId: string,
  patch: { midtermGrade?: number | null; finalGrade?: number | null; sprCells?: any }
): Promise<any> {
  let likhaSaved: any = null;

  try {
    const token = await getLikhaAdminToken();
    // Check if row already exists in Likha
    const checkRes = await fetch(
      `${LIKHA_URL}/items/course_grades?filter[course_id][_eq]=${encodeURIComponent(courseId)}&filter[student_id][_eq]=${encodeURIComponent(studentId)}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const body: Record<string, any> = {
      course_id: courseId,
      student_id: studentId,
      updated_at: new Date().toISOString(),
    };
    if (patch.midtermGrade !== undefined) body.midterm_grade = patch.midtermGrade;
    if (patch.finalGrade !== undefined) body.final_grade = patch.finalGrade;
    if (patch.sprCells !== undefined) {
      body.spr_cells = typeof patch.sprCells === 'string' ? JSON.parse(patch.sprCells) : patch.sprCells;
    }

    if (checkRes.ok) {
      const checkJson = (await checkRes.json()) as any;
      if (Array.isArray(checkJson.data) && checkJson.data.length > 0) {
        const existingId = checkJson.data[0].id;
        const patchRes = await fetch(`${LIKHA_URL}/items/course_grades/${encodeURIComponent(existingId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (patchRes.ok) {
          const patchJson = (await patchRes.json()) as any;
          likhaSaved = formatLikhaGrade(patchJson.data);
        }
      } else {
        const id = `grd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        const postRes = await fetch(`${LIKHA_URL}/items/course_grades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id, ...body }),
        });
        if (postRes.ok) {
          const postJson = (await postRes.json()) as any;
          likhaSaved = formatLikhaGrade(postJson.data);
        }
      }
    }
  } catch (err) {
    console.warn('[gradesRepo] Likha upsertCourseGrade failed, continuing with Prisma:', err);
  }

  // Update Prisma in sync
  const sprCellsStr = patch.sprCells !== undefined
    ? (typeof patch.sprCells === 'string' ? patch.sprCells : JSON.stringify(patch.sprCells))
    : undefined;

  const prismaGrade = await prisma.courseGrade.upsert({
    where: { courseId_studentId: { courseId, studentId } },
    update: {
      ...(patch.midtermGrade !== undefined ? { midtermGrade: patch.midtermGrade } : {}),
      ...(patch.finalGrade !== undefined ? { finalGrade: patch.finalGrade } : {}),
      ...(sprCellsStr !== undefined ? { sprCells: sprCellsStr } : {}),
    },
    create: {
      courseId,
      studentId,
      midtermGrade: patch.midtermGrade ?? null,
      finalGrade: patch.finalGrade ?? null,
      sprCells: sprCellsStr ?? null,
    },
  });

  return likhaSaved || formatLikhaGrade(prismaGrade);
}

export async function getCourseSprConfig(courseId: string): Promise<any | null> {
  try {
    const token = await getLikhaAdminToken();
    const res = await fetch(`${LIKHA_URL}/items/courses/${encodeURIComponent(courseId)}?fields=spr_config`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = (await res.json()) as any;
      const conf = json.data?.spr_config;
      if (conf) {
        return typeof conf === 'string' ? JSON.parse(conf) : conf;
      }
    }
  } catch (err) {
    console.warn('[gradesRepo] Likha getCourseSprConfig failed, falling back to Prisma:', err);
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { sprConfig: true },
  });
  if (!course || !course.sprConfig) return null;
  return JSON.parse(course.sprConfig);
}

export async function saveCourseSprConfig(courseId: string, config: any): Promise<any> {
  const configObj = typeof config === 'string' ? JSON.parse(config) : config;
  const configStr = typeof config === 'string' ? config : JSON.stringify(config);

  try {
    const token = await getLikhaAdminToken();
    await fetch(`${LIKHA_URL}/items/courses/${encodeURIComponent(courseId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ spr_config: configObj }),
    });
  } catch (err) {
    console.warn('[gradesRepo] Likha saveCourseSprConfig failed:', err);
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: { sprConfig: configStr },
  });

  return JSON.parse(updated.sprConfig!);
}
