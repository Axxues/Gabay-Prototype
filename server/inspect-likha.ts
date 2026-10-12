import './src/env.js';

const LIKHA_URL = process.env.LIKHA_URL || 'https://gabay.zyberlab.com';
const ADMIN_EMAIL = process.env.LIKHA_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.LIKHA_ADMIN_PASSWORD || 'd1r3ctu5';

async function main() {
  const loginRes = await fetch(`${LIKHA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.access_token;
  if (!token) {
    console.error('Failed to log in:', loginData);
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };

  // 1. Collections
  const colRes = await fetch(`${LIKHA_URL}/collections`, { headers });
  const colData = await colRes.json();
  const customCols = (colData?.data || [])
    .filter((c: any) => !c.collection.startsWith('directus_'))
    .map((c: any) => c.collection);
  console.log('Custom collections in Likha:', customCols);

  // 2. Flows (Automations)
  const flowsRes = await fetch(`${LIKHA_URL}/flows`, { headers });
  const flowsData = await flowsRes.json();
  console.log('Existing Flows in Likha:', (flowsData?.data || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    trigger: f.trigger,
    status: f.status,
  })));

  const cRes = await fetch(`${LIKHA_URL}/items/courses?limit=100&fields=id`, { headers });
  const cData = await cRes.json();
  const validIds = new Set((cData.data || []).map((c: any) => c.id));
  console.log('Valid course IDs count:', validIds.size);

  const cgRes = await fetch(`${LIKHA_URL}/items/course_grades?limit=100&fields=id,course_id`, { headers });
  const cgData = await cgRes.json();
  const invalid = (cgData.data || []).filter((g: any) => !validIds.has(g.course_id));
  console.log('Invalid course_grades rows:', invalid);

  // 5. Relations
  const relsRes = await fetch(`${LIKHA_URL}/relations`, { headers });
  const relsData = await relsRes.json();
  console.log('Relations in Likha count:', (relsData?.data || []).length);
  const customRels = (relsData?.data || []).filter((r: any) =>
    !r.collection.startsWith('directus_') && !r.related_collection?.startsWith('directus_')
  );
  console.log('Custom relations:', customRels.map((r: any) => `${r.collection}.${r.field} -> ${r.related_collection}`));
}

main().catch(console.error);
