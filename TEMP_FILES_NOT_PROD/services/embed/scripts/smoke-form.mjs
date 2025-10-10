// End-to-end form submission smoke test
// 1) Create anonymous widget -> expect { publicKey, publicId }
// 2) Submit to embed form endpoint using publicId -> expect ok:true

const SITE_ANON_URL = 'https://c-keen-site.vercel.app/api/widgets/anonymous';
const EMBED_FORM_URL = (publicId) => `https://c-keen-embed.vercel.app/api/form/${publicId}`;

async function createAnonWidget() {
  const res = await fetch(SITE_ANON_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'qa+smoke@ckeen.dev', type: 'contact-form', config: { title: 'Smoke' } })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`anon create failed: ${res.status} ${json.error || ''}`);
  const { publicKey, publicId } = json || {};
  if (!publicKey || !publicId) throw new Error('anon create missing publicKey/publicId');
  return { publicKey, publicId };
}

async function submitForm(publicId) {
  const res = await fetch(EMBED_FORM_URL(publicId), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'E2E', email: 'qa+contact@ckeen.dev', message: 'smoke' })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(`form submit failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function run() {
  try {
    const { publicId } = await createAnonWidget();
    const res = await submitForm(publicId);
    console.log('SMOKE PASS: form submission ok', res);
  } catch (e) {
    console.error('SMOKE FAIL:', e.message);
    process.exit(1);
  }
}

run();


