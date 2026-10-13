import { likhaFetch } from '../client.js';

function parseJsonField(val: any, fallback: any = []): any {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    if (!val.trim()) return fallback;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function unpackLegacyLikhaJsonData(): Promise<{
  activities: number;
  quizzes: number;
  exams: number;
  submissions: number;
  grades: number;
}> {
  const counts = {
    activities: 0,
    quizzes: 0,
    exams: 0,
    submissions: 0,
    grades: 0,
  };

  // 1. Unpack activities questions and rubrics
  const actRes = await likhaFetch('/items/activities?limit=1000');
  if (actRes.ok) {
    const actData = await actRes.json();
    const activities = actData.data || [];

    const qRes = await likhaFetch('/items/assessment_questions?limit=1000');
    const existingQ = new Set<string>();
    if (qRes.ok) {
      const qData = await qRes.json();
      (qData.data || []).forEach((q: any) => existingQ.add(q.id));
    }

    const rRes = await likhaFetch('/items/rubric_criteria?limit=1000');
    const existingR = new Set<string>();
    if (rRes.ok) {
      const rData = await rRes.json();
      (rData.data || []).forEach((r: any) => existingR.add(r.id));
    }

    for (const act of activities) {
      // Questions
      const questions = parseJsonField(act.questions, []);
      if (Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (typeof q === 'object' && q !== null) {
            const qId = q.id || `q-${act.id}-${i}`;
            if (!existingQ.has(qId)) {
              await likhaFetch('/items/assessment_questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: qId,
                  activity_id: act.id,
                  question_text: q.question_text || q.prompt || q.text || `Question ${i + 1}`,
                  question_type: q.question_type || q.type || 'essay',
                  points: Number(q.points) || 10,
                  correct_answer: q.correct_answer || q.correctAnswer || null,
                  options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
                  order: i + 1,
                }),
              }).catch(() => {});
              existingQ.add(qId);
              counts.activities++;
            }
          }
        }
      }

      // Rubrics
      const rubrics = parseJsonField(act.rubric, []);
      if (Array.isArray(rubrics)) {
        for (let i = 0; i < rubrics.length; i++) {
          const r = rubrics[i];
          if (typeof r === 'object' && r !== null) {
            const rId = r.id || `rub-${act.id}-${i}`;
            if (!existingR.has(rId)) {
              await likhaFetch('/items/rubric_criteria', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: rId,
                  activity_id: act.id,
                  title: r.title || r.criterion || `Criterion ${i + 1}`,
                  description: r.description || '',
                  max_points: Number(r.max_points ?? r.points) || 10,
                  order: i + 1,
                }),
              }).catch(() => {});
              existingR.add(rId);
              counts.activities++;
            }
          }
        }
      }
    }
  }

  // 2. Unpack quizzes questions
  const quizRes = await likhaFetch('/items/quizzes?limit=1000');
  if (quizRes.ok) {
    const quizData = await quizRes.json();
    for (const qz of quizData.data || []) {
      const questions = parseJsonField(qz.questions, []);
      if (Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (typeof q === 'object' && q !== null) {
            const qId = q.id || `q-${qz.id}-${i}`;
            await likhaFetch('/items/assessment_questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: qId,
                quiz_id: qz.id,
                question_text: q.question_text || q.prompt || q.text || `Question ${i + 1}`,
                question_type: q.question_type || q.type || 'multiple_choice',
                points: Number(q.points) || 5,
                correct_answer: q.correct_answer || q.correctAnswer || null,
                options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
                order: i + 1,
              }),
            }).catch(() => {});
            counts.quizzes++;
          }
        }
      }
    }
  }

  // 3. Unpack exams questions
  const examRes = await likhaFetch('/items/exams?limit=1000');
  if (examRes.ok) {
    const examData = await examRes.json();
    for (const ex of examData.data || []) {
      const questions = parseJsonField(ex.questions, []);
      if (Array.isArray(questions)) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (typeof q === 'object' && q !== null) {
            const qId = q.id || `q-${ex.id}-${i}`;
            await likhaFetch('/items/assessment_questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: qId,
                exam_id: ex.id,
                question_text: q.question_text || q.prompt || q.text || `Question ${i + 1}`,
                question_type: q.question_type || q.type || 'multiple_choice',
                points: Number(q.points) || 5,
                correct_answer: q.correct_answer || q.correctAnswer || null,
                options_json: typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []),
                order: i + 1,
              }),
            }).catch(() => {});
            counts.exams++;
          }
        }
      }
    }
  }

  // 4. Unpack submissions answers
  const subRes = await likhaFetch('/items/submissions?limit=1000');
  if (subRes.ok) {
    const subData = await subRes.json();
    for (const s of subData.data || []) {
      const answers = parseJsonField(s.answers, []);
      const answersList = Array.isArray(answers)
        ? answers
        : typeof answers === 'object' && answers !== null
          ? Object.entries(answers).map(([qid, val]) => ({ questionId: qid, answer: val }))
          : [];

      for (let i = 0; i < answersList.length; i++) {
        const a = answersList[i];
        const ansId = `sa-${s.id}-${i}`;
        await likhaFetch('/items/submission_answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: ansId,
            submission_id: s.id,
            question_id: a.questionId || a.question_id || `q-${i}`,
            student_answer: a.answer || a.studentAnswer || a.student_answer || String(a),
            awarded_points: a.points ?? a.awarded_points ?? null,
            feedback: a.feedback || null,
          }),
        }).catch(() => {});
        counts.submissions++;
      }
    }
  }

  // 5. Unpack course_grades spr_cells
  const grdRes = await likhaFetch('/items/course_grades?limit=1000');
  if (grdRes.ok) {
    const grdData = await grdRes.json();
    for (const g of grdData.data || []) {
      const rawCells = parseJsonField(g.spr_cells, null);
      if (rawCells && typeof rawCells === 'object') {
        const midterm = rawCells.midterm || rawCells.midtermScores || {};
        const final = rawCells.final || rawCells.finalScores || {};
        for (const [key, val] of Object.entries(midterm)) {
          if (typeof val === 'number') {
            await likhaFetch('/items/spr_cells', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: `cell-${g.id}-mt-${key}`,
                course_grade_id: g.id,
                course_id: g.course_id,
                student_id: g.student_id,
                term: 'midterm',
                component_key: key,
                score: val,
              }),
            }).catch(() => {});
            counts.grades++;
          }
        }
        for (const [key, val] of Object.entries(final)) {
          if (typeof val === 'number') {
            await likhaFetch('/items/spr_cells', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: `cell-${g.id}-fn-${key}`,
                course_grade_id: g.id,
                course_id: g.course_id,
                student_id: g.student_id,
                term: 'final',
                component_key: key,
                score: val,
              }),
            }).catch(() => {});
            counts.grades++;
          }
        }
      }
    }
  }

  return counts;
}
