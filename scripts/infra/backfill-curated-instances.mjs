const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const dryRun = String(process.env.DRY_RUN || '').trim() === '1';

if (!baseUrl || !serviceKey) {
  throw new Error('[backfill-curated] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function supabaseFetch(path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  return res;
}

async function loadCuratedCandidates() {
  const params = new URLSearchParams({
    select: 'public_id,widget_id,status,config,created_at,updated_at',
  });
  params.set('or', '(public_id.like.wgt_main_%,public_id.like.wgt_curated_%)');
  const res = await supabaseFetch(`/rest/v1/widget_instances?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[backfill-curated] Failed to read widget_instances (${res.status}): ${detail}`);
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function loadWidgetTypeLookup(widgetIds) {
  if (widgetIds.length === 0) return new Map();
  const params = new URLSearchParams({
    select: 'id,type',
    id: `in.(${widgetIds.join(',')})`,
  });
  const res = await supabaseFetch(`/rest/v1/widgets?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[backfill-curated] Failed to read widgets (${res.status}): ${detail}`);
  }
  const rows = await res.json().catch(() => []);
  const lookup = new Map();
  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      if (!row || typeof row !== 'object') return;
      const id = String(row.id || '').trim();
      const type = String(row.type || '').trim();
      if (id && type) lookup.set(id, type);
    });
  }
  return lookup;
}

async function upsertCuratedInstances(payloads) {
  if (payloads.length === 0) return;
  const chunkSize = 50;
  for (let i = 0; i < payloads.length; i += chunkSize) {
    const batch = payloads.slice(i, i + chunkSize);
    const res = await supabaseFetch(`/rest/v1/curated_widget_instances?on_conflict=public_id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[backfill-curated] Failed to upsert curated_widget_instances (${res.status}): ${detail}`);
    }
  }
}

const rows = await loadCuratedCandidates();
if (rows.length === 0) {
  console.log('[backfill-curated] No curated candidates found.');
  process.exit(0);
}

const widgetIds = Array.from(
  new Set(rows.map((row) => String(row.widget_id || '').trim()).filter((id) => id))
);
const widgetLookup = await loadWidgetTypeLookup(widgetIds);

const payloads = [];
const skipped = [];

rows.forEach((row) => {
  const publicId = String(row.public_id || '').trim();
  const widgetId = String(row.widget_id || '').trim();
  const widgetType = widgetLookup.get(widgetId);
  if (!publicId || !widgetType) {
    skipped.push(publicId || '<missing-public-id>');
    return;
  }
  const kind = publicId.startsWith('wgt_main_') ? 'baseline' : 'curated';
  payloads.push({
    public_id: publicId,
    widget_type: widgetType,
    kind,
    status: 'published',
    config: row.config || {},
    created_at: row.created_at || null,
    updated_at: row.updated_at || row.created_at || null,
  });
});

console.log(`[backfill-curated] Prepared ${payloads.length} curated instances (skipped ${skipped.length}).`);
if (skipped.length > 0) {
  console.log(`[backfill-curated] Skipped: ${skipped.join(', ')}`);
}

if (dryRun) {
  console.log('[backfill-curated] DRY_RUN=1, no writes performed.');
  process.exit(0);
}

await upsertCuratedInstances(payloads);
console.log('[backfill-curated] Backfill complete.');
