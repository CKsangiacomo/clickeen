import type { MemberRole } from '@clickeen/ck-policy';
import type { Env, WorkspaceRow } from './types';
import type { SupabaseAuthPrincipal } from './auth';
import { assertDevAuth, isTrustedInternalServiceRequest } from './auth';
import {
  readRomaAuthzCapsuleHeader,
  verifyRomaWorkspaceAuthzCapsule,
  type RomaWorkspaceAuthzCapsulePayload,
} from './authz-capsule';
import { ckError } from './errors';
import { readJson } from './http';
import { supabaseFetch } from './supabase';
import { requireWorkspace } from './workspaces';

type WorkspaceMembershipRow = {
  role: string;
};

type WorkspaceAuthResult =
  | {
      ok: true;
      auth: { source: 'dev' | 'supabase'; principal?: SupabaseAuthPrincipal };
      workspace: WorkspaceRow;
      role: MemberRole;
    }
  | {
      ok: false;
      response: Response;
    };

function isInternalWorkspaceServicePathAllowed(req: Request): boolean {
  const pathname = new URL(req.url).pathname;
  if (/^\/api\/workspaces\/[^/]+\/instance\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/workspaces\/[^/]+\/instances\/[^/]+\/layers\/locale\/[^/]+$/.test(pathname))
    return true;
  return false;
}

function normalizeRole(value: unknown): MemberRole | null {
  switch (value) {
    case 'viewer':
    case 'editor':
    case 'admin':
    case 'owner':
      return value;
    default:
      return null;
  }
}

const WORKSPACE_MEMBERSHIP_CACHE_TTL_MS = 20_000;
const WORKSPACE_MEMBERSHIP_STORE_KEY = '__CK_PARIS_WORKSPACE_MEMBERSHIP_CACHE_V1__';

type WorkspaceMembershipCacheEntry = {
  role: MemberRole | null;
  expiresAt: number;
};

type WorkspaceMembershipStore = {
  cache: Record<string, WorkspaceMembershipCacheEntry | undefined>;
  inFlight: Record<string, Promise<MemberRole | null> | undefined>;
};

function isWorkspaceMembershipStore(value: unknown): value is WorkspaceMembershipStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const cache = record.cache;
  const inFlight = record.inFlight;
  if (!cache || typeof cache !== 'object' || Array.isArray(cache)) return false;
  if (!inFlight || typeof inFlight !== 'object' || Array.isArray(inFlight)) return false;
  return true;
}

function resolveWorkspaceMembershipStore(): WorkspaceMembershipStore {
  const scope = globalThis as Record<string, unknown>;
  const existing = scope[WORKSPACE_MEMBERSHIP_STORE_KEY];
  if (isWorkspaceMembershipStore(existing)) return existing;
  const next: WorkspaceMembershipStore = {
    cache: {},
    inFlight: {},
  };
  scope[WORKSPACE_MEMBERSHIP_STORE_KEY] = next;
  return next;
}

function toMembershipCacheKey(workspaceId: string, userId: string): string {
  return `${workspaceId}:${userId}`;
}

function roleRank(role: MemberRole): number {
  switch (role) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'editor':
      return 2;
    case 'viewer':
      return 1;
    default:
      return 0;
  }
}

async function resolveWorkspaceMembershipRole(
  env: Env,
  workspaceId: string,
  userId: string,
): Promise<MemberRole | null> {
  const key = toMembershipCacheKey(workspaceId, userId);
  const store = resolveWorkspaceMembershipStore();
  const cached = store.cache[key];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.role;
  }
  if (cached) {
    delete store.cache[key];
  }

  const existingRequest = store.inFlight[key];
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const params = new URLSearchParams({
      select: 'role',
      user_id: `eq.${userId}`,
      workspace_id: `eq.${workspaceId}`,
      limit: '1',
    });
    const res = await supabaseFetch(env, `/rest/v1/workspace_members?${params.toString()}`, {
      method: 'GET',
    });
    if (!res.ok) {
      const details = await readJson(res);
      throw new Error(
        `[ParisWorker] Failed to resolve workspace membership (${res.status}): ${JSON.stringify(details)}`,
      );
    }

    const rows = (await res.json().catch(() => null)) as WorkspaceMembershipRow[] | null;
    const role = rows?.[0]?.role;
    return normalizeRole(role);
  })();
  store.inFlight[key] = request;

  try {
    const role = await request;
    store.cache[key] = {
      role,
      expiresAt: Date.now() + WORKSPACE_MEMBERSHIP_CACHE_TTL_MS,
    };
    return role;
  } finally {
    delete resolveWorkspaceMembershipStore().inFlight[key];
  }
}

function hydrateWorkspaceFromCapsule(payload: RomaWorkspaceAuthzCapsulePayload): WorkspaceRow {
  return {
    id: payload.workspaceId,
    account_id: payload.accountId,
    tier: payload.workspaceTier,
    name: payload.workspaceName,
    slug: payload.workspaceSlug,
    website_url: payload.workspaceWebsiteUrl ?? null,
  };
}

export async function authorizeWorkspace(
  req: Request,
  env: Env,
  workspaceId: string,
  minRole: MemberRole,
): Promise<WorkspaceAuthResult> {
  const auth = await assertDevAuth(req, env);
  if (!auth.ok) return { ok: false, response: auth.response };

  if (!auth.principal) {
    const trustedInternal =
      auth.source === 'dev' &&
      isTrustedInternalServiceRequest(req, env) &&
      isInternalWorkspaceServicePathAllowed(req);
    if (!trustedInternal) {
      return {
        ok: false,
        response: ckError({ kind: 'AUTH', reasonKey: 'coreui.errors.auth.required' }, 401),
      };
    }
    const workspaceResult = await requireWorkspace(env, workspaceId);
    if (!workspaceResult.ok) {
      return { ok: false, response: workspaceResult.response };
    }
    return {
      ok: true,
      auth: { source: auth.source },
      workspace: workspaceResult.workspace,
      role: 'owner',
    };
  }

  const capsule = readRomaAuthzCapsuleHeader(req);
  if (capsule) {
    const verified = await verifyRomaWorkspaceAuthzCapsule(env, capsule);
    if (!verified.ok) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    const payload = verified.payload;
    if (payload.userId !== auth.principal.userId || payload.workspaceId !== workspaceId) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    if (roleRank(payload.role) < roleRank(minRole)) {
      return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
    }
    return {
      ok: true,
      auth: { source: auth.source, principal: auth.principal },
      workspace: hydrateWorkspaceFromCapsule(payload),
      role: payload.role,
    };
  }

  const workspaceResult = await requireWorkspace(env, workspaceId);
  if (!workspaceResult.ok) {
    return { ok: false, response: workspaceResult.response };
  }

  let role: MemberRole | null = null;
  try {
    role = await resolveWorkspaceMembershipRole(env, workspaceId, auth.principal.userId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      response: ckError({ kind: 'INTERNAL', reasonKey: 'coreui.errors.db.readFailed', detail }, 500),
    };
  }

  if (!role || roleRank(role) < roleRank(minRole)) {
    return { ok: false, response: ckError({ kind: 'DENY', reasonKey: 'coreui.errors.auth.forbidden' }, 403) };
  }

  return { ok: true, auth: { source: auth.source, principal: auth.principal }, workspace: workspaceResult.workspace, role };
}
