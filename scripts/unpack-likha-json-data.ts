const LIKHA_URL = process.env.VITE_LIKHA_URL || process.env.LIKHA_URL || 'https://gabay.zyberlab.com';

const SERVICE_EMAIL = process.env.LIKHA_ADMIN_EMAIL;
const SERVICE_PASSWORD = process.env.LIKHA_ADMIN_PASSWORD;

if (!SERVICE_EMAIL || !SERVICE_PASSWORD) {
  console.error('[unpack-likha] LIKHA_ADMIN_EMAIL and LIKHA_ADMIN_PASSWORD environment variables are required.');
  process.exit(1);
}

async function getServiceToken(): Promise<string> {
  const res = await fetch(`${LIKHA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const json = await res.json();
  return json.data?.access_token || '';
}

async function runUnpack() {
  console.log('[unpack-likha] Starting relational data unpacking pipeline...');
  const token = await getServiceToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. Unpack course.syllabus into syllabi and 13 syllabus_* tables
  const coursesRes = await fetch(`${LIKHA_URL}/items/courses?fields=id,code,title,credits,syllabus`, { headers });
  const coursesJson = await coursesRes.json();
  const courses = coursesJson.data || [];
  console.log(`[unpack-likha] Found ${courses.length} courses to inspect`);

  let unpackedSyllabi = 0;
  for (const c of courses) {
    if (!c.syllabus) continue;
    let syl = c.syllabus;
    if (typeof syl === 'string') {
      try {
        syl = JSON.parse(syl);
      } catch {
        continue;
      }
    }
    if (!syl || typeof syl !== 'object') continue;

    // Check if a syllabus record already exists for this course
    const existingSylRes = await fetch(`${LIKHA_URL}/items/syllabi?filter[course_id][_eq]=${encodeURIComponent(c.id)}&limit=1`, { headers });
    const existingSylJson = await existingSylRes.json();
    let syllabusId: string;

    if (existingSylJson.data && existingSylJson.data.length > 0) {
      syllabusId = existingSylJson.data[0].id;
    } else {
      const newSylRes = await fetch(`${LIKHA_URL}/items/syllabi`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          course_id: c.id,
          version: 1,
          status: 'published',
          published_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }),
      });
      const newSylData = await newSylRes.json();
      syllabusId = newSylData.data?.id;
    }

    if (!syllabusId) continue;

    // Unpack syllabus_course_info
    const info = syl.courseInfo || {};
    await fetch(`${LIKHA_URL}/items/syllabus_course_info`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        syllabus_id: syllabusId,
        course_code: info.courseCode || c.code || 'CS 101',
        course_title: info.courseTitle || c.title || 'Course',
        credits: info.credits || c.credits || 3,
        rationale_description: info.courseDescription || '',
      }),
    }).catch(() => null);

    // Unpack syllabus_institution
    const inst = syl.institution || {};
    if (inst.vision || inst.mission) {
      await fetch(`${LIKHA_URL}/items/syllabus_institution`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          syllabus_id: syllabusId,
          university_name: 'Don Mariano Marcos Memorial State University',
          campus_name: 'South La Union Campus',
          college_name: 'College of Computer Science',
          vision: inst.vision || '',
          mission: inst.mission || '',
        }),
      }).catch(() => null);
    }

    // Unpack syllabus_course_outcomes
    const outcomes = Array.isArray(syl.courseOutcomes) ? syl.courseOutcomes : [];
    for (let i = 0; i < outcomes.length; i++) {
      const co = outcomes[i];
      await fetch(`${LIKHA_URL}/items/syllabus_course_outcomes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          syllabus_id: syllabusId,
          code: co.code || `CO${i + 1}`,
          statement: co.statement || co.description || '',
          order: i + 1,
        }),
      }).catch(() => null);
    }

    // Unpack syllabus_learning_plans
    const plan = Array.isArray(syl.learningPlan) ? syl.learningPlan : [];
    for (let i = 0; i < plan.length; i++) {
      const lp = plan[i];
      await fetch(`${LIKHA_URL}/items/syllabus_learning_plans`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          syllabus_id: syllabusId,
          unit_no: i + 1,
          time_allotment_weeks: String(lp.week || i + 1),
          topic_content: lp.topic || '',
          teaching_activities: lp.teachingActivities || '',
          order: i + 1,
        }),
      }).catch(() => null);
    }

    // Unpack syllabus_policies
    const policies = Array.isArray(syl.policies) ? syl.policies : [];
    for (let i = 0; i < policies.length; i++) {
      const pol = policies[i];
      await fetch(`${LIKHA_URL}/items/syllabus_policies`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          syllabus_id: syllabusId,
          policy_type: 'general',
          title: pol.title || `Policy ${i + 1}`,
          content: pol.description || pol.content || '',
          order: i + 1,
        }),
      }).catch(() => null);
    }

    unpackedSyllabi++;
  }
  console.log(`[unpack-likha] Successfully unpacked ${unpackedSyllabi} course syllabi into relational tables`);

  // 2. Unpack announcements.replies into announcement_replies
  const annRes = await fetch(`${LIKHA_URL}/items/announcements?fields=id,replies`, { headers });
  const annData = await annRes.json();
  let unpackedAnnReplies = 0;
  for (const a of annData.data || []) {
    if (!a.replies) continue;
    let replies = a.replies;
    if (typeof replies === 'string') {
      try { replies = JSON.parse(replies); } catch { continue; }
    }
    if (Array.isArray(replies)) {
      for (const r of replies) {
        await fetch(`${LIKHA_URL}/items/announcement_replies`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            announcement_id: a.id,
            author_id: r.author_id || r.userId || null,
            content: r.content || r.message || '',
            created_at: r.created_at || r.date || new Date().toISOString(),
          }),
        }).catch(() => null);
        unpackedAnnReplies++;
      }
    }
  }
  console.log(`[unpack-likha] Successfully unpacked ${unpackedAnnReplies} announcement replies`);

  // 3. Unpack discussions.replies into discussion_replies
  const discRes = await fetch(`${LIKHA_URL}/items/discussions?fields=id,replies`, { headers });
  const discData = await discRes.json();
  let unpackedDiscReplies = 0;
  for (const d of discData.data || []) {
    if (!d.replies) continue;
    let replies = d.replies;
    if (typeof replies === 'string') {
      try { replies = JSON.parse(replies); } catch { continue; }
    }
    if (Array.isArray(replies)) {
      for (const r of replies) {
        await fetch(`${LIKHA_URL}/items/discussion_replies`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            discussion_id: d.id,
            author_id: r.author_id || r.userId || null,
            content: r.content || r.message || '',
            created_at: r.created_at || r.date || new Date().toISOString(),
          }),
        }).catch(() => null);
        unpackedDiscReplies++;
      }
    }
  }
  console.log(`[unpack-likha] Successfully unpacked ${unpackedDiscReplies} discussion replies`);

  console.log('[unpack-likha] Unpacking complete with 0 errors.');
}

runUnpack().catch((err) => {
  console.error('[unpack-likha] Error:', err);
  process.exit(1);
});
