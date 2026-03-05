import { resolvePolicy } from '@clickeen/ck-policy';
import { normalizeWidgetPublicId } from '@clickeen/ck-contracts';
import type { Env } from '../../shared/types';
import { json } from '../../shared/http';
import { ckError } from '../../shared/errors';
import { asTrimmedString } from '../../shared/validation';

type UsageEventPayload = {
  publicId?: unknown;
  event?: unknown;
  tier?: unknown;
  sig?: unknown;
  timestamp?: unknown;
};

function normalizeEvent(raw: unknown): 'view' | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'view') return 'view';
  return null;
}

function normalizeTier(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value) return null;
  if (value === 'minibob' || value === 'free' || value === 'tier1' || value === 'tier2' || value === 'tier3') {
    return value;
  }
  return null;
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

function resolvePublishedInstancesCap(tier: string): number | null {
  const policy = resolvePolicy({ profile: tier as any, role: 'editor' });
  const cap = policy.caps['instances.published.max'];
  if (cap == null) return null;
  return typeof cap === 'number' && Number.isFinite(cap) && cap >= 0 ? cap : null;
}

function requireUsageKv(env: Env): KVNamespace {
  if (!env.USAGE_KV) throw new Error('[ParisWorker] Missing USAGE_KV binding');
  return env.USAGE_KV;
}

function usageCounterKey(args: { publicId: string; periodKey: string }): string {
  return `usage.views.v1.${args.periodKey}.${args.publicId}`;
}

export async function handleUsageEvent(req: Request, env: Env): Promise<Response> {
  let payload: UsageEventPayload;
  try {
    payload = (await req.json()) as UsageEventPayload;
  } catch {
    return ckError({ kind: 'VALIDATION', reasonKey: 'coreui.errors.payload.invalidJson' }, 422);
  }

  const publicId = normalizeWidgetPublicId(payload.publicId);
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

  const kv = requireUsageKv(env);
  const periodKey = getUtcPeriodKey(new Date());

  const counterKey = usageCounterKey({ publicId, periodKey });
  const prevRaw = await kv.get(counterKey);
  const prev = prevRaw ? Number(prevRaw) : 0;
  const next = Number.isFinite(prev) && prev >= 0 ? prev + 1 : 1;
  await kv.put(counterKey, String(next), { expirationTtl: 400 * 24 * 60 * 60 }); // ~400 days

  return json({ ok: true, tier: asTrimmedString(tier) ?? null }, { status: 204 });
}

export async function handleFrozenResets(_env: Env): Promise<void> {
  // Freeze-by-views has been removed. Keep scheduler contract with a no-op.
}

export function getPublishedInstancesCapForTier(tier: string): number | null {
  if (!tier) return null;
  return resolvePublishedInstancesCap(tier);
}
