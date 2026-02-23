import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DEFAULTS = {
  local: {
    bobBaseUrl: 'http://localhost:3000',
    romaBaseUrl: 'http://localhost:3004',
    parisBaseUrl: 'http://localhost:3001',
    tokyoBaseUrl: 'http://localhost:8791',
    veniceBaseUrl: 'http://localhost:3003',
    publishLatencyBudgetMs: 5_000,
  },
  'cloud-dev': {
    bobBaseUrl: 'https://bob-dev.pages.dev',
    romaBaseUrl: 'https://roma-dev.pages.dev',
    parisBaseUrl: 'https://paris.dev.clickeen.com',
    tokyoBaseUrl: 'https://tokyo.dev.clickeen.com',
    veniceBaseUrl: 'https://venice.dev.clickeen.com',
    publishLatencyBudgetMs: 7_000,
  },
};

const LOCAL_ENV_FILE = path.join(process.cwd(), '.env.local');
const LOCAL_PROBE_EMAIL_DEFAULTS = ['local.admin@clickeen.local', 'local.paid@clickeen.local', 'dev@clickeen.local'];
let cachedSupabaseCliEnv = null;

function readLocalEnvValue(key) {
  const direct = process.env[key];
  if (direct) return normalizeEnvValue(direct);
  try {
    const raw = fs.readFileSync(LOCAL_ENV_FILE, 'utf8');
    const match = raw.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? normalizeEnvValue(match[1]) : '';
  } catch {
    return '';
  }
}

function normalizeEnvValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function readRuntimeValue(key, opts = {}) {
  const fromProcess = normalizeEnvValue(process.env[key] || '');
  if (fromProcess) return fromProcess;
  if (opts.allowLocalFallback) {
    const fromLocal = readLocalEnvValue(key);
    if (fromLocal) return fromLocal;
  }
  return '';
}

function readUrl(name, fallback, allowLocalFallback) {
  const raw = readRuntimeValue(name, { allowLocalFallback });
  const value = raw || fallback;
  return value.replace(/\/+$/, '');
}

function parseLatencyBudget(raw, fallback) {
  const parsed = Number.parseInt(String(raw || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function resolveSupabaseBearer(envName) {
  const allowLocalFallback = envName === 'local';
  const envScopedKey =
    envName === 'cloud-dev'
      ? 'RUNTIME_PARITY_SUPABASE_BEARER_CLOUD'
      : envName === 'local'
        ? 'RUNTIME_PARITY_SUPABASE_BEARER_LOCAL'
        : '';

  const scopedToken = envScopedKey
    ? readRuntimeValue(envScopedKey, {
        allowLocalFallback,
      })
    : '';
  if (scopedToken) return scopedToken;

  const token = readRuntimeValue('RUNTIME_PARITY_SUPABASE_BEARER', {
    allowLocalFallback,
  });
  if (token) return token;
  return '';
}

function resolveTokyoDevJwt(envName, { required }) {
  const explicit = readRuntimeValue('RUNTIME_PARITY_TOKYO_DEV_JWT', {
    allowLocalFallback: envName === 'local',
  });
  if (explicit) return explicit;
  const fallbackTokyo = readRuntimeValue('TOKYO_DEV_JWT', { allowLocalFallback: envName === 'local' });
  if (fallbackTokyo) return fallbackTokyo;
  const fallbackParis = readRuntimeValue('PARIS_DEV_JWT', { allowLocalFallback: envName === 'local' });
  if (fallbackParis) return fallbackParis;
  if (required) {
    throw new Error(
      '[runtime-parity] Missing RUNTIME_PARITY_TOKYO_DEV_JWT (or TOKYO_DEV_JWT / PARIS_DEV_JWT) for Tokyo snapshot trigger auth.',
    );
  }
  return '';
}

function parseEnvLines(raw) {
  const out = {};
  for (const line of String(raw || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key) continue;
    const value = normalizeEnvValue(trimmed.slice(idx + 1));
    out[key] = value;
  }
  return out;
}

function readSupabaseCliEnv() {
  if (cachedSupabaseCliEnv) return cachedSupabaseCliEnv;
  try {
    const raw = execSync('supabase status --output env', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    cachedSupabaseCliEnv = parseEnvLines(raw);
    return cachedSupabaseCliEnv;
  } catch {
    cachedSupabaseCliEnv = {};
    return cachedSupabaseCliEnv;
  }
}

function readSupabaseCliEnvValue(key) {
  const env = readSupabaseCliEnv();
  return normalizeEnvValue(env[key] || '');
}

function resolveLocalSupabaseAuthConfig() {
  const baseUrl =
    readSupabaseCliEnvValue('API_URL') ||
    readSupabaseCliEnvValue('SUPABASE_URL') ||
    readRuntimeValue('SUPABASE_URL', { allowLocalFallback: true }) ||
    readRuntimeValue('NEXT_PUBLIC_SUPABASE_URL', { allowLocalFallback: true }) ||
    readRuntimeValue('API_URL', { allowLocalFallback: true });
  const anonKey =
    readSupabaseCliEnvValue('ANON_KEY') ||
    readSupabaseCliEnvValue('SUPABASE_ANON_KEY') ||
    readSupabaseCliEnvValue('PUBLISHABLE_KEY') ||
    readRuntimeValue('SUPABASE_ANON_KEY', { allowLocalFallback: true }) ||
    readRuntimeValue('NEXT_PUBLIC_SUPABASE_ANON_KEY', { allowLocalFallback: true });
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    anonKey,
  };
}

function resolveCloudSupabaseAuthConfig() {
  const baseUrl =
    readRuntimeValue('RUNTIME_PARITY_SUPABASE_URL', { allowLocalFallback: true }) ||
    readRuntimeValue('SUPABASE_URL', { allowLocalFallback: true }) ||
    readRuntimeValue('NEXT_PUBLIC_SUPABASE_URL', { allowLocalFallback: true });
  const anonKey =
    readRuntimeValue('RUNTIME_PARITY_SUPABASE_ANON_KEY', { allowLocalFallback: true }) ||
    readRuntimeValue('SUPABASE_ANON_KEY', { allowLocalFallback: true }) ||
    readRuntimeValue('NEXT_PUBLIC_SUPABASE_ANON_KEY', { allowLocalFallback: true }) ||
    readRuntimeValue('SUPABASE_SERVICE_ROLE_KEY', { allowLocalFallback: true });
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    anonKey,
  };
}

function resolveProbeCredentials(envName) {
  const scopedEmail = envName === 'cloud-dev'
    ? readRuntimeValue('RUNTIME_PARITY_PROBE_EMAIL_CLOUD', { allowLocalFallback: true })
    : envName === 'local'
      ? readRuntimeValue('RUNTIME_PARITY_PROBE_EMAIL_LOCAL', { allowLocalFallback: true })
      : '';
  const emailCandidates = [
    scopedEmail,
    readRuntimeValue('RUNTIME_PARITY_PROBE_EMAIL', { allowLocalFallback: true }),
    readRuntimeValue('CK_ADMIN_EMAIL', { allowLocalFallback: true }),
    ...(envName === 'local' ? LOCAL_PROBE_EMAIL_DEFAULTS : []),
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);

  const scopedPassword = envName === 'cloud-dev'
    ? readRuntimeValue('RUNTIME_PARITY_PROBE_PASSWORD_CLOUD', { allowLocalFallback: true })
    : envName === 'local'
      ? readRuntimeValue('RUNTIME_PARITY_PROBE_PASSWORD_LOCAL', { allowLocalFallback: true })
      : '';
  const password =
    scopedPassword ||
    readRuntimeValue('RUNTIME_PARITY_PROBE_PASSWORD', { allowLocalFallback: true }) ||
    readRuntimeValue('CK_ADMIN_PASSWORD', { allowLocalFallback: true });

  return {
    emailCandidates,
    password: String(password || '').trim(),
  };
}

async function readJsonSafe(response) {
  return response.json().catch(() => null);
}

async function requestPasswordGrant(args) {
  const response = await fetch(`${args.baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: args.anonKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      email: args.email,
      password: args.password,
    }),
  });
  const payload = await readJsonSafe(response);
  const accessToken =
    response.ok && payload && typeof payload.access_token === 'string'
      ? payload.access_token.trim()
      : '';
  return {
    status: response.status,
    accessToken,
  };
}

async function mintSupabaseBearer(envName) {
  const config = envName === 'local' ? resolveLocalSupabaseAuthConfig() : resolveCloudSupabaseAuthConfig();
  if (!config.baseUrl || !config.anonKey) {
    throw new Error(
      `[runtime-parity] Missing ${envName} Supabase auth config (SUPABASE_URL + SUPABASE_ANON_KEY).`,
    );
  }

  const credentials = resolveProbeCredentials(envName);
  if (!credentials.emailCandidates.length || !credentials.password) {
    throw new Error(
      `[runtime-parity] Missing ${envName} probe credentials. Set CK_ADMIN_EMAIL/CK_ADMIN_PASSWORD or RUNTIME_PARITY_PROBE_EMAIL/RUNTIME_PARITY_PROBE_PASSWORD.`,
    );
  }

  const attempts = [];
  for (const email of credentials.emailCandidates) {
    try {
      const result = await requestPasswordGrant({
        baseUrl: config.baseUrl,
        anonKey: config.anonKey,
        email,
        password: credentials.password,
      });
      attempts.push(`${email}:${result.status}`);
      if (result.accessToken) {
        return result.accessToken;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      attempts.push(`${email}:error(${detail})`);
    }
  }

  throw new Error(
    `[runtime-parity] Failed to mint ${envName} probe bearer (${attempts.join(', ')}). Export an explicit bearer (RUNTIME_PARITY_SUPABASE_BEARER[_CLOUD]) or verify probe credentials.`,
  );
}

export async function ensureRuntimeProfileAuth(profile) {
  if (profile.mode !== 'auth') return profile;
  if (profile.supabaseBearer) return profile;
  const token = await mintSupabaseBearer(profile.name);
  return {
    ...profile,
    supabaseBearer: token,
  };
}

export function resolveRuntimeProfile(envName, options = {}) {
  const defaults = DEFAULTS[envName];
  if (!defaults) {
    throw new Error(`[runtime-parity] Invalid --env value: ${envName}`);
  }
  const mode = options.mode === 'public' ? 'public' : options.mode === 'auth' ? 'auth' : '';
  if (!mode) {
    throw new Error(`[runtime-parity] Invalid runtime parity mode: ${String(options.mode || '')}`);
  }

  const allowLocalFallback = envName === 'local';
  const publishLatencyBudgetMs = parseLatencyBudget(
    readRuntimeValue('RUNTIME_PARITY_PUBLISH_BUDGET_MS', { allowLocalFallback }),
    defaults.publishLatencyBudgetMs,
  );
  const requiresTokyoJwt = false;

  return {
    name: envName,
    mode,
    bobBaseUrl: readUrl('RUNTIME_PARITY_BOB_BASE_URL', defaults.bobBaseUrl, allowLocalFallback),
    romaBaseUrl: readUrl('RUNTIME_PARITY_ROMA_BASE_URL', defaults.romaBaseUrl, allowLocalFallback),
    parisBaseUrl: readUrl('RUNTIME_PARITY_PARIS_BASE_URL', defaults.parisBaseUrl, allowLocalFallback),
    tokyoBaseUrl: readUrl('RUNTIME_PARITY_TOKYO_BASE_URL', defaults.tokyoBaseUrl, allowLocalFallback),
    veniceBaseUrl: readUrl('RUNTIME_PARITY_VENICE_BASE_URL', defaults.veniceBaseUrl, allowLocalFallback),
    publishLatencyBudgetMs,
    supabaseBearer: resolveSupabaseBearer(envName),
    tokyoDevJwt: resolveTokyoDevJwt(envName, { required: requiresTokyoJwt }),
    probePublicId: readRuntimeValue('RUNTIME_PARITY_PUBLIC_ID', { allowLocalFallback }),
    probePublishPublicId: readRuntimeValue('RUNTIME_PARITY_PUBLISH_PUBLIC_ID', { allowLocalFallback }),
    probeAccountId: readRuntimeValue('RUNTIME_PARITY_ACCOUNT_ID', { allowLocalFallback }),
    probeWorkspaceId: readRuntimeValue('RUNTIME_PARITY_WORKSPACE_ID', { allowLocalFallback }),
  };
}
