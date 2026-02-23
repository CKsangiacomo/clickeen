#!/usr/bin/env node
import process from 'node:process';

const CK_DEV_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
const CK_DEMO_WORKSPACE_ID = '00000000-0000-0000-0000-000000000002';

const PERSONAS = [
  {
    key: 'free',
    emailEnv: 'CK_LOCAL_PERSONA_FREE_EMAIL',
    defaultEmail: 'local.free@clickeen.local',
    displayName: 'Local Free Persona',
    workspaceId: CK_DEMO_WORKSPACE_ID,
    role: 'owner',
  },
  {
    key: 'paid',
    emailEnv: 'CK_LOCAL_PERSONA_PAID_EMAIL',
    defaultEmail: 'local.paid@clickeen.local',
    displayName: 'Local Paid Persona',
    workspaceId: CK_DEV_WORKSPACE_ID,
    role: 'owner',
  },
  {
    key: 'admin',
    emailEnv: 'CK_ADMIN_EMAIL',
    defaultEmail: 'local.admin@clickeen.local',
    displayName: 'Local Admin Persona',
    workspaceId: CK_DEV_WORKSPACE_ID,
    role: 'admin',
  },
];

function asTrimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asEmail(value) {
  const normalized = asTrimmed(value).toLowerCase();
  return normalized || null;
}

function resolveRequiredEnv(name, fallback = '') {
  const value = asTrimmed(process.env[name] || fallback);
  if (!value) {
    throw new Error(`[seed-local-personas] Missing required env: ${name}`);
  }
  return value;
}

function looksLikeJwt(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(asTrimmed(value));
}

function resolveServiceRoleToken() {
  const jwtCandidate = [process.env.SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => asTrimmed(value))
    .find((value) => looksLikeJwt(value));
  if (jwtCandidate) return jwtCandidate;
  return resolveRequiredEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SERVICE_ROLE_KEY || '');
}

function isLocalHostname(hostname) {
  const normalized = asTrimmed(hostname).toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1';
}

function resolveSupabaseBaseUrl() {
  const raw =
    asTrimmed(process.env.SUPABASE_URL) ||
    asTrimmed(process.env.API_URL) ||
    asTrimmed(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!raw) throw new Error('[seed-local-personas] Missing SUPABASE_URL/API_URL');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`[seed-local-personas] Invalid SUPABASE URL: ${raw}`);
  }
  if (!isLocalHostname(parsed.hostname)) {
    throw new Error(`[seed-local-personas] Refusing to seed non-local Supabase host: ${parsed.hostname}`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

function resolvePersonaPassword() {
  const fromAdmin = asTrimmed(process.env.CK_ADMIN_PASSWORD);
  if (fromAdmin) return fromAdmin;
  throw new Error('[seed-local-personas] Missing required env: CK_ADMIN_PASSWORD');
}

function resolvePersonaEmail(persona) {
  if (typeof persona.emailEnv === 'string' && persona.emailEnv) {
    const email = asEmail(process.env[persona.emailEnv]);
    if (email) return email;
  }
  return persona.defaultEmail;
}

async function readJsonSafe(response) {
  return response.json().catch(() => null);
}

function adminAuthHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: 'application/json',
  };
}

function restHeaders(serviceRoleKey, extra = {}) {
  return {
    ...adminAuthHeaders(serviceRoleKey),
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function listAdminUsers(baseUrl, serviceRoleKey) {
  const response = await fetch(`${baseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
    method: 'GET',
    headers: adminAuthHeaders(serviceRoleKey),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await readJsonSafe(response);
    throw new Error(
      `[seed-local-personas] Failed to list auth users (${response.status}): ${JSON.stringify(detail)}`,
    );
  }

  const payload = await readJsonSafe(response);
  const users = Array.isArray(payload?.users) ? payload.users : [];
  return users
    .map((user) => {
      const id = typeof user?.id === 'string' ? user.id.trim() : '';
      const email = asEmail(user?.email);
      if (!id || !email) return null;
      return { id, email };
    })
    .filter(Boolean);
}

async function createAdminUser({ baseUrl, serviceRoleKey, email, password, personaKey, displayName }) {
  const response = await fetch(`${baseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      ...adminAuthHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        persona: personaKey,
        display_name: displayName,
      },
    }),
  });

  const payload = await readJsonSafe(response);
  if (!response.ok) {
    return { ok: false, status: response.status, payload };
  }

  const id = typeof payload?.id === 'string' ? payload.id.trim() : '';
  if (!id) {
    throw new Error(`[seed-local-personas] Admin create user returned missing id for ${email}`);
  }
  return { ok: true, id };
}

async function updateAdminUser({ baseUrl, serviceRoleKey, userId, password, personaKey, displayName }) {
  const response = await fetch(`${baseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: {
      ...adminAuthHeaders(serviceRoleKey),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      password,
      user_metadata: {
        persona: personaKey,
        display_name: displayName,
      },
    }),
  });

  if (!response.ok) {
    const detail = await readJsonSafe(response);
    throw new Error(
      `[seed-local-personas] Failed to update auth user ${userId} (${response.status}): ${JSON.stringify(detail)}`,
    );
  }
}

async function ensureWorkspaceShape(baseUrl, serviceRoleKey) {
  const workspaceTargets = [
    { id: CK_DEV_WORKSPACE_ID, name: 'Clickeen Dev', tier: 'tier3' },
    { id: CK_DEMO_WORKSPACE_ID, name: 'Clickeen Demo', tier: 'free' },
  ];

  for (const target of workspaceTargets) {
    const params = new URLSearchParams({
      id: `eq.${target.id}`,
    });
    const response = await fetch(`${baseUrl}/rest/v1/workspaces?${params.toString()}`, {
      method: 'PATCH',
      headers: restHeaders(serviceRoleKey, { Prefer: 'return=minimal' }),
      cache: 'no-store',
      body: JSON.stringify({
        name: target.name,
        tier: target.tier,
      }),
    });
    if (!response.ok) {
      const detail = await readJsonSafe(response);
      throw new Error(
        `[seed-local-personas] Failed to patch workspace ${target.id} (${response.status}): ${JSON.stringify(detail)}`,
      );
    }
  }
}

async function ensureWorkspaceMembership({ baseUrl, serviceRoleKey, workspaceId, userId, role }) {
  const response = await fetch(
    `${baseUrl}/rest/v1/workspace_members?on_conflict=workspace_id,user_id`,
    {
      method: 'POST',
      headers: restHeaders(serviceRoleKey, {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      cache: 'no-store',
      body: JSON.stringify([
        {
          workspace_id: workspaceId,
          user_id: userId,
          role,
        },
      ]),
    },
  );

  if (!response.ok) {
    const detail = await readJsonSafe(response);
    throw new Error(
      `[seed-local-personas] Failed to upsert workspace membership ${workspaceId}/${userId} (${response.status}): ${JSON.stringify(detail)}`,
    );
  }
}

async function ensurePersonaUser({ baseUrl, serviceRoleKey, password, persona, usersByEmail }) {
  const email = resolvePersonaEmail(persona);
  let userId = usersByEmail.get(email) ?? null;

  if (!userId) {
    const created = await createAdminUser({
      baseUrl,
      serviceRoleKey,
      email,
      password,
      personaKey: persona.key,
      displayName: persona.displayName,
    });

    if (created.ok) {
      userId = created.id;
      usersByEmail.set(email, userId);
    } else {
      // Concurrent/local reruns can return user-exists variants; re-read once and continue.
      const users = await listAdminUsers(baseUrl, serviceRoleKey);
      usersByEmail.clear();
      for (const user of users) {
        usersByEmail.set(user.email, user.id);
      }
      userId = usersByEmail.get(email) ?? null;
      if (!userId) {
        throw new Error(
          `[seed-local-personas] Failed to create auth user ${email} (${created.status}): ${JSON.stringify(created.payload)}`,
        );
      }
    }
  }

  await updateAdminUser({
    baseUrl,
    serviceRoleKey,
    userId,
    password,
    personaKey: persona.key,
    displayName: persona.displayName,
  });

  await ensureWorkspaceMembership({
    baseUrl,
    serviceRoleKey,
    workspaceId: persona.workspaceId,
    userId,
    role: persona.role,
  });

  return { email, userId, workspaceId: persona.workspaceId, role: persona.role };
}

async function main() {
  const baseUrl = resolveSupabaseBaseUrl();
  const serviceRoleKey = resolveServiceRoleToken();
  const password = resolvePersonaPassword();

  await ensureWorkspaceShape(baseUrl, serviceRoleKey);

  const existingUsers = await listAdminUsers(baseUrl, serviceRoleKey);
  const usersByEmail = new Map(existingUsers.map((user) => [user.email, user.id]));

  const results = [];
  for (const persona of PERSONAS) {
    const result = await ensurePersonaUser({
      baseUrl,
      serviceRoleKey,
      password,
      persona,
      usersByEmail,
    });
    results.push({ persona: persona.key, ...result });
  }

  for (const entry of results) {
    console.log(
      `[seed-local-personas] persona=${entry.persona} email=${entry.email} workspaceId=${entry.workspaceId} role=${entry.role}`,
    );
  }
  console.log('[seed-local-personas] OK');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
