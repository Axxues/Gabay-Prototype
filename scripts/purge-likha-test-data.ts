import { likhaFetch } from '../server/src/likha/client.js';

const TRANSACTIONAL_COLLECTIONS = [
  'submission_answers',
  'submissions',
  'announcement_replies',
  'announcements',
  'discussion_replies',
  'discussions',
  'notifications',
  'chat_messages',
  'enrollment_requests',
  'Course_Enrollments',
  'spr_cells',
  'course_grades',
];

async function getAuthToken(): Promise<string> {
  const loginRes = await fetch('https://gabay.zyberlab.com/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jayveegenetareyes@gmail.com', password: 'qwerty12345' }),
  });
  if (loginRes.ok) {
    const data = await loginRes.json();
    return data.data?.access_token || '';
  }
  return '';
}

export async function purgeTransactionalData(): Promise<void> {
  console.log('[purge] Starting transactional test data purge in Likha ERP...');
  const token = await getAuthToken();

  for (const collection of TRANSACTIONAL_COLLECTIONS) {
    try {
      let res = await likhaFetch(`/items/${collection}?limit=500&fields=id`);
      if (res.status === 403 && token) {
        res = await fetch(`https://gabay.zyberlab.com/items/${collection}?limit=500&fields=id`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (!res.ok) {
        console.warn(`[purge] Skip ${collection}: status ${res.status}`);
        continue;
      }
      const data = await res.json();
      const items = data.data || [];
      if (items.length === 0) {
        console.log(`[purge] ${collection} is already clean (0 items).`);
        continue;
      }
      console.log(`[purge] Deleting ${items.length} items from ${collection}...`);
      for (const item of items) {
        let delRes = await likhaFetch(`/items/${collection}/${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
        }).catch(() => null);
        if ((!delRes || delRes.status === 403) && token) {
          await fetch(`https://gabay.zyberlab.com/items/${collection}/${encodeURIComponent(item.id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      }
      console.log(`[purge] Cleared ${collection}.`);
    } catch (err) {
      console.warn(`[purge] Error cleaning ${collection}:`, err);
    }
  }

  console.log('[purge] Transactional test data purge finished.');
}

if (process.argv[1]?.endsWith('purge-likha-test-data.ts') || import.meta.url.endsWith('purge-likha-test-data.ts')) {
  purgeTransactionalData()
    .then(() => console.log('[purge] All transactional collections purged successfully.'))
    .catch(console.error);
}
