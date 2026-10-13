import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';
import { prisma } from '../../db.js';

export function formatLikhaGrade(g: any, relationalCells?: any[]): any {
  if (!g) return null;

  let sprCellsData = g.spr_cells;
  if (relationalCells && relationalCells.length > 0) {
    const sprObj: any = { midtermScores: {}, finalScores: {}, mtExam: null, ftExam: null };
    for (const cell of relationalCells) {
      if (cell.term === 'midterm') {
        if (cell.component_key === 'exam') sprObj.mtExam = cell.score;
        else sprObj.midtermScores[cell.component_key] = cell.score;
      } else if (cell.term === 'final') {
        if (cell.component_key === 'exam') sprObj.ftExam = cell.score;
        else sprObj.finalScores[cell.component_key] = cell.score;
      }
    }
    sprCellsData = sprObj;
  }

  return {
    id: g.id,
    courseId: g.course_id || g.courseId,
    studentId: g.student_id || g.studentId,
    midtermGrade: g.midterm_grade !== undefined ? g.midterm_grade : (g.midtermGrade ?? null),
    finalGrade: g.final_grade !== undefined ? g.final_grade : (g.finalGrade ?? null),
    sprCells: typeof sprCellsData === 'object' && sprCellsData !== null 
      ? JSON.stringify(sprCellsData) 
      : (typeof sprCellsData === 'string' ? sprCellsData : (g.sprCells ?? null)),
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
        // Query relational spr_cells
        const cellsRes = await fetch(`${LIKHA_URL}/items/spr_cells?filter[course_id][_eq]=${encodeURIComponent(courseId)}&limit=1000`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);

        const allCells = cellsRes && cellsRes.ok ? ((await cellsRes.json()) as any).data || [] : [];

        return json.data.map((g: any) => {
          const cellsForGrade = allCells.filter((c: any) => c.course_grade_id === g.id || c.student_id === g.student_id);
          return formatLikhaGrade(g, cellsForGrade);
        });
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
  return grades.map((g) => formatLikhaGrade(g));
}

export async function upsertCourseGrade(
  courseId: string,
  studentId: string,
  patch: { midtermGrade?: number | null; finalGrade?: number | null; sprCells?: any }
): Promise<any> {
  let likhaSaved: any = null;
  let gradeId = `grd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  try {
    const token = await getLikhaAdminToken();
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

    if (checkRes.ok) {
      const checkJson = (await checkRes.json()) as any;
      if (Array.isArray(checkJson.data) && checkJson.data.length > 0) {
        gradeId = checkJson.data[0].id;
        const patchRes = await fetch(`${LIKHA_URL}/items/course_grades/${encodeURIComponent(gradeId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (patchRes.ok) {
          const patchJson = (await patchRes.json()) as any;
          likhaSaved = formatLikhaGrade(patchJson.data);
        }
      } else {
        const postRes = await fetch(`${LIKHA_URL}/items/course_grades`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: gradeId, ...body }),
        });
        if (postRes.ok) {
          const postJson = (await postRes.json()) as any;
          likhaSaved = formatLikhaGrade(postJson.data);
        }
      }
    }

    // Relational writes to spr_cells
    if (patch.sprCells) {
      const parsed = typeof patch.sprCells === 'string' ? JSON.parse(patch.sprCells) : patch.sprCells;
      if (parsed.midtermScores && typeof parsed.midtermScores === 'object') {
        for (const [key, score] of Object.entries(parsed.midtermScores)) {
          await fetch(`${LIKHA_URL}/items/spr_cells`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              id: `sc-${gradeId}-mt-${key}`,
              course_grade_id: gradeId,
              student_id: studentId,
              course_id: courseId,
              term: 'midterm',
              component_key: key,
              score: Number(score),
            }),
          }).catch(() => {});
        }
      }
      if (parsed.mtExam !== undefined && parsed.mtExam !== null) {
        await fetch(`${LIKHA_URL}/items/spr_cells`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            id: `sc-${gradeId}-mt-exam`,
            course_grade_id: gradeId,
            student_id: studentId,
            course_id: courseId,
            term: 'midterm',
            component_key: 'exam',
            score: Number(parsed.mtExam),
          }),
        }).catch(() => {});
      }
      if (parsed.finalScores && typeof parsed.finalScores === 'object') {
        for (const [key, score] of Object.entries(parsed.finalScores)) {
          await fetch(`${LIKHA_URL}/items/spr_cells`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              id: `sc-${gradeId}-ft-${key}`,
              course_grade_id: gradeId,
              student_id: studentId,
              course_id: courseId,
              term: 'final',
              component_key: key,
              score: Number(score),
            }),
          }).catch(() => {});
        }
      }
      if (parsed.ftExam !== undefined && parsed.ftExam !== null) {
        await fetch(`${LIKHA_URL}/items/spr_cells`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            id: `sc-${gradeId}-ft-exam`,
            course_grade_id: gradeId,
            student_id: studentId,
            course_id: courseId,
            term: 'final',
            component_key: 'exam',
            score: Number(parsed.ftExam),
          }),
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[gradesRepo] Likha upsertCourseGrade failed, continuing with Prisma:', err);
  }

  // Update Prisma in sync
  const sprCellsStr = patch.sprCells !== undefined
    ? (typeof patch.sprCells === 'string' ? patch.sprCells : JSON.stringify(patch.sprCells))
    : undefined;

  const prismaRow = await prisma.courseGrade.upsert({
    where: {
      courseId_studentId: {
        courseId,
        studentId,
      },
    },
    create: {
      courseId,
      studentId,
      midtermGrade: patch.midtermGrade ?? null,
      finalGrade: patch.finalGrade ?? null,
      sprCells: sprCellsStr ?? null,
    },
    update: {
      ...(patch.midtermGrade !== undefined ? { midtermGrade: patch.midtermGrade } : {}),
      ...(patch.finalGrade !== undefined ? { finalGrade: patch.finalGrade } : {}),
      ...(sprCellsStr !== undefined ? { sprCells: sprCellsStr } : {}),
    },
  });

  return likhaSaved || formatLikhaGrade(prismaRow);
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

