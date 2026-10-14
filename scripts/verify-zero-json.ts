/**
 * Automated Zero-JSON Schema Audit for Likha ERP / Gabay LMS
 *
 * Asserts that across all Gabay LMS application collections, there are
 * strictly ZERO columns/fields with type 'json'.
 */

const LIKHA_URL = process.env.LIKHA_URL || 'https://gabay.zyberlab.com';
const SERVICE_EMAIL = process.env.LIKHA_ADMIN_EMAIL || 'jayveegenetareyes@gmail.com';
const SERVICE_PASSWORD = process.env.LIKHA_ADMIN_PASSWORD || 'qwerty12345';

// Internal Directus and Likha Dev Workspace CMS builder collections excluded from LMS domain
const EXCLUDED_COLLECTIONS = new Set([
  'component',
  'layout',
  'page',
  'page_page',
  'print_template',
  'likha_dev_workspace',
]);

async function main() {
  console.log(`[Audit] Connecting to Likha ERP: ${LIKHA_URL}...`);

  const loginRes = await fetch(`${LIKHA_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD }),
  });

  if (!loginRes.ok) {
    console.error(`[Audit] Authentication failed with status ${loginRes.status}`);
    process.exit(1);
  }

  const { data: { access_token } } = await loginRes.json();

  // Fetch all collections metadata
  const collectionsRes = await fetch(`${LIKHA_URL}/collections`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const collectionsData = await collectionsRes.json();
  const allCollections: any[] = collectionsData.data || [];

  // Filter LMS collections
  const lmsCollections = allCollections.filter((c) => {
    if (c.collection.startsWith('directus_')) return false;
    if (EXCLUDED_COLLECTIONS.has(c.collection)) return false;
    if (c.meta?.group === 'likha_dev_workspace') return false;
    return true;
  });

  const lmsCollectionNames = new Set(lmsCollections.map((c) => c.collection));

  console.log(`[Audit] Auditing ${lmsCollectionNames.size} Gabay LMS collections:`);
  console.log(Array.from(lmsCollectionNames).sort().map((name) => `  - ${name}`).join('\n'));

  // Fetch all fields metadata
  const fieldsRes = await fetch(`${LIKHA_URL}/fields`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const fieldsData = await fieldsRes.json();
  const allFields: any[] = fieldsData.data || [];

  // Find any JSON fields in LMS collections
  const jsonFieldsInLms = allFields.filter((f) => {
    if (!lmsCollectionNames.has(f.collection)) return false;
    return f.type === 'json' || f.schema?.data_type === 'json' || f.schema?.data_type === 'jsonb';
  });

  console.log(`\n======================================================`);
  console.log(`[Audit Result] LMS JSON Fields Count: ${jsonFieldsInLms.length}`);
  console.log(`======================================================`);

  if (jsonFieldsInLms.length > 0) {
    console.error(`❌ FAILURE: Found ${jsonFieldsInLms.length} unexpected JSON fields:`);
    for (const j of jsonFieldsInLms) {
      console.error(`  - Collection "${j.collection}" -> Field "${j.field}" (type: ${j.type})`);
    }
    process.exit(1);
  }

  console.log(`SUCCESS: Zero JSON fields found across all Likha ERP collections.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[Audit Error]', err);
  process.exit(1);
});
