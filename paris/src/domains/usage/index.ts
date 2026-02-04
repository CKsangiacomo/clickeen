import { resolvePolicy } from '@clickeen/ck-policy';
import type { Env, RenderSnapshotQueueJob } from '../../shared/types';
import { json, readJson } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { supabaseFetch } from '../../shared/supabase';
import { normalizeLocaleList } from '../../shared/l10n';

type UsageEventPayload = {
  publicId?: unknown;
  event?: unknown;
  tier?: unknown;
  sig?: unknown;
  timestamp?: unknown;
};

type EnforcementMode = 'frozen';

type EnforcementRow = {
  public_id: string;
  mode: EnforcementMode;
  period_key: string;
  frozen_at: string;
  reset_at: string;
  updated_at?: string | null;
};

function normalizePublicId(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  if (!/^wgt_[a-z0-9][a-z0-9_.-]*$/i.test(value)) return null;
  return value;
}

function normalizeEvent(raw: unknown): 'view' | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'view') return 'view';
  return null;
}

function normalizeTier(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value) return null;
  // expected: devstudio|minibob|free|tier1|tier2|tier3
  if (!/^[a-z0-9-]{2,24}$/.test(value)) return null;
  return value;
}

function normalizeSig(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  if (!/^[a-z0-9_-]{20,200}$/i.test(value)) return null;
  return value;
}

function getUtcPeriodKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function getUtcNextMonthStart(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  // First day of next month at 00:00:00Z
  return new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
}

async function resolveSnapshotLocalesForInstance(env: Env, publicId: string): Promise<string[]> {
  try {
    const instParams = new URLSearchParams({
      select: 'workspace_id',
      public_id: `eq.${publicId}`,
      limit: '1',
    });
    const instRes = await supabaseFetch(env, `/rest/v1/widget_instances?${instParams.toString()}`, { method: 'GET' });
    if (!instRes.ok) return ['en'];
    const instRows = (await instRes.json().catch(() => null)) as Array<{ workspace_id?: unknown }> | null;
    const workspaceId = instRows?.[0]?.workspace_id ? String(instRows[0].workspace_id) : '';
    if (!workspaceId) return ['en'];

    const wsParams = new URLSearchParams({
      select: 'tier,l10n_locales',
      id: `eq.${workspaceId}`,
      limit: '1',
    });
    const wsRes = await supabaseFetch(env, `/rest/v1/workspaces?${wsParams.toString()}`, { method: 'GET' });
    if (!wsRes.ok) return ['en'];
    const wsRows = (await wsRes.json().catch(() => null)) as Array<{ tier?: unknown; l10n_locales?: unknown }> | null;
    const row = wsRows?.[0];
    const tier = row?.tier ? String(row.tier).trim().toLowerCase() : '';
    if (!tier) return ['en'];

    const policy = resolvePolicy({ profile: tier as any, role: 'editor' });
    const maxLocalesTotalRaw = policy.caps['l10n.locales.max'];
    const maxLocalesTotal = maxLocalesTotalRaw == null ? null : Math.max(1, maxLocalesTotalRaw);

    const normalized = normalizeLocaleList(row?.l10n_locales, 'l10n_locales');
    const locales = normalized.ok ? normalized.locales : [];
    const deduped = Array.from(new Set(['en', ...locales]));
    if (maxLocalesTotal == null) return deduped;
    return deduped.slice(0, maxLocalesTotal);
  } catch {
    return ['en'];
  }
}

function requireUsageSecret(env: Env): string {
  const raw = (env.USAGE_EVENT_HMAC_SECRET || '').trim();
  if (!raw) throw new Error('[ParisWorker] Missing USAGE_EVENT_HMAC_SECRET');
  return raw;
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function isValidUsageSignature(args: {
  env: Env;
  publicId: string;
  tier: string;
  sig: string;
}): Promise<boolean> {
  const secret = requireUsageSecret(args.env);
  const message = `usage.v1|${args.publicId}|${args.tier}`;
  const expected = await hmacSha256Base64Url(secret, message);
  return expected === args.sig;
}

function resolveMonthlyViewsCap(tier: string): number | null {
  // Policy profile matches workspace tier strings for paid/free; allow devstudio/minibob too.
  const policy = resolvePolicy({ profile: tier as any, role: 'editor' });
  const cap = policy.caps['views.monthly.max'];
  if (cap == null) return null;
  return typeof cap === 'number' && Number.isFinite(cap) && cap >= 0 ? cap : null;
}

function resolvePublishedInstancesCap(tier: string): number | null {
  const policy = resolvePolicy({ profile: tier as any, role: 'editor' });
  const cap = policy.caps['instances.published.max'];
  if (cap == null) return null;
  return typeof cap === 'number' && Number.isFinite(cap) && cap >= 0 ? cap : null;
}

function isCappedTier(tier: string): boolean {
  return tier === 'free' || tier === 'tier1';
}

function requireUsageKv(env: Env): KVNamespace {
  if (!env.USAGE_KV) throw new Error('[ParisWorker] Missing USAGE_KV binding');
  return env.USAGE_KV;
}

function usageCounterKey(args: { publicId: string; periodKey: string }): string {
  return `usage.views.v1.${args.periodKey}.${args.publicId}`;
}

function usageFrozenMarkerKey(args: { publicId: string; periodKey: string }): string {
  return `usage.frozen.v1.${args.periodKey}.${args.publicId}`;
}

async function markFrozenInDb(args: {
  env: Env;
  publicId: string;
  periodKey: string;
  frozenAt: Date;
  resetAt: Date;
}): Promise<void> {
  const payload = {
    public_id: args.publicId,
    mode: 'frozen',
    period_key: args.periodKey,
    frozen_at: args.frozenAt.toISOString(),
    reset_at: args.resetAt.toISOString(),
  };
  const res = await supabaseFetch(args.env, `/rest/v1/instance_enforcement_state`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(payload),
  });
  if (res.ok) return;
  const details = await readJson(res);
  throw new Error(`[ParisWorker] Failed to write enforcement state (${res.status}): ${JSON.stringify(details)}`);
}

async function clearFrozenInDb(args: { env: Env; publicId: string }): Promise<void> {
  await supabaseFetch(args.env, `/rest/v1/instance_enforcement_state?public_id=eq.${encodeURIComponent(args.publicId)}`, {
    method: 'DELETE',
  });
}

async function enqueueRenderSnapshot(env: Env, job: RenderSnapshotQueueJob): Promise<void> {
  if (!env.RENDER_SNAPSHOT_QUEUE) return;
  await env.RENDER_SNAPSHOT_QUEUE.send(job);
}

export async function handleUsageEvent(req: Request, env: Env): Promise<Response> {
  let payload: UsageEventPayload;
  try {
    payload = (await req.json()) as UsageEventPayload;
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }

  const publicId = normalizePublicId(payload.publicId);
  const event = normalizeEvent(payload.event);
  const tier = normalizeTier(payload.tier);
  const sig = normalizeSig(payload.sig);

  if (!publicId || !event || !tier || !sig) {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalid' }, 422);
  }

  // Signature is the only auth contract here: /api/usage is called by Venice (server) and must not
  // be callable by arbitrary clients to inflate counters or freeze competitors.
  const validSig = await isValidUsageSignature({ env, publicId, tier, sig });
  if (!validSig) {
    return ckError({ kind: 'DENY', reasonKey: 'coreui.errors.usage.signatureInvalid' }, 403);
  }

  // Only capped tiers are metered today (PRD 37). Everyone else is unlimited and we skip counting to avoid extra cost.
  if (!isCappedTier(tier)) {
    return json({ ok: true, skipped: true }, { status: 204 });
  }

  const cap = resolveMonthlyViewsCap(tier);
  if (!cap || cap <= 0) {
    return json({ ok: true, skipped: true }, { status: 204 });
  }

  const kv = requireUsageKv(env);
  const now = new Date();
  const periodKey = getUtcPeriodKey(now);
  const frozenMarker = usageFrozenMarkerKey({ publicId, periodKey });
  const alreadyFrozen = await kv.get(frozenMarker);
  if (alreadyFrozen) {
    return json({ ok: true, frozen: true }, { status: 204 });
  }

  const counterKey = usageCounterKey({ publicId, periodKey });
  const prevRaw = await kv.get(counterKey);
  const prev = prevRaw ? Number(prevRaw) : 0;
  const next = Number.isFinite(prev) && prev >= 0 ? prev + 1 : 1;
  await kv.put(counterKey, String(next), { expirationTtl: 400 * 24 * 60 * 60 }); // ~400 days

  // Freeze on first overage view (cap reached → next view triggers freeze).
  if (next <= cap) {
    return json({ ok: true }, { status: 204 });
  }

  const resetAt = getUtcNextMonthStart(now);
  await kv.put(frozenMarker, '1', { expirationTtl: Math.max(60, Math.floor((resetAt.getTime() - now.getTime()) / 1000) + 60) });

  await markFrozenInDb({ env, publicId, periodKey, frozenAt: now, resetAt });
  await enqueueRenderSnapshot(env, { v: 1, kind: 'render-snapshot', publicId, action: 'upsert', locales: ['en'] });

  return json({ ok: true, frozen: true }, { status: 204 });
}

export async function handleFrozenResets(env: Env): Promise<void> {
  // Best-effort cleanup: remove expired frozen rows and regenerate live snapshots.
  // Bounded by a small limit to keep cron safe.
  const now = new Date();
  const iso = now.toISOString();
  const params = new URLSearchParams({
    select: 'public_id,mode,period_key,frozen_at,reset_at',
    reset_at: `lte.${iso}`,
    limit: '50',
  });
  const res = await supabaseFetch(env, `/rest/v1/instance_enforcement_state?${params.toString()}`, { method: 'GET' });
  if (!res.ok) return;
  const rows = (await res.json().catch(() => null)) as EnforcementRow[] | null;
  if (!rows || rows.length === 0) return;

  await Promise.all(
    rows.map(async (row) => {
      const publicId = row?.public_id ? String(row.public_id) : '';
      if (!publicId) return;
      await clearFrozenInDb({ env, publicId });
      const locales = await resolveSnapshotLocalesForInstance(env, publicId);
      await enqueueRenderSnapshot(env, { v: 1, kind: 'render-snapshot', publicId, action: 'upsert', locales });
    }),
  );
}

export function getPublishedInstancesCapForTier(tier: string): number | null {
  if (!tier) return null;
  return resolvePublishedInstancesCap(tier);
}
