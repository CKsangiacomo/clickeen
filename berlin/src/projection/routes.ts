import { type MemberRole, type PolicyProfile } from '@clickeen/ck-policy';
import { claimAsString } from '../utils/claims';
import { json, validationError } from '../http';
import { capture, type BerlinRoute } from '../http/routing';
import { resolveAccountRouteContext } from '../bootstrap/route-context';
import { type Env } from '../types';
import {
  createAccountInstanceProjectionRow,
  deleteAccountInstanceProjectionRow,
  loadAccountPublishContainment,
} from './account-instance-projection';

function canMutateInstanceProjection(account: { tier: PolicyProfile; role: MemberRole }): Response | null {
  if (account.role !== 'viewer') return null;

  return json(
    {
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.upsell.reason.role.editorRequired',
        detail: 'This action requires an editor role.',
      },
    },
    { status: 403 },
  );
}

export async function handleAccountPublishContainmentProjection(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const resolved = await resolveAccountRouteContext(request, env, accountIdRaw);
  if (!resolved.ok) return resolved.response;

  const containment = await loadAccountPublishContainment({ env, account: resolved.account });
  if (!containment.ok) return containment.response;

  return json({ accountId: resolved.accountId, containment: containment.value });
}

export async function handleAccountInstanceProjectionCreate(
  request: Request,
  env: Env,
  accountIdRaw: string,
): Promise<Response> {
  const resolved = await resolveAccountRouteContext(request, env, accountIdRaw);
  if (!resolved.ok) return resolved.response;

  const deny = canMutateInstanceProjection(resolved.account);
  if (deny) return deny;

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return validationError('coreui.errors.payload.invalid');
  }

  const publicId = claimAsString((payload as { publicId?: unknown }).publicId);
  const widgetType = claimAsString((payload as { widgetType?: unknown }).widgetType);
  if (!publicId || !widgetType) return validationError('coreui.errors.payload.invalid');

  const created = await createAccountInstanceProjectionRow({
    env,
    account: resolved.account,
    publicId,
    widgetType,
    displayName: claimAsString((payload as { displayName?: unknown }).displayName),
  });
  if (!created.ok) return created.response;

  return json({ row: created.value });
}

export async function handleAccountInstanceProjectionDelete(
  request: Request,
  env: Env,
  accountIdRaw: string,
  publicIdRaw: string,
): Promise<Response> {
  const publicId = claimAsString(publicIdRaw);
  if (!publicId) return validationError('coreui.errors.payload.invalid', 'publicId required');

  const resolved = await resolveAccountRouteContext(request, env, accountIdRaw);
  if (!resolved.ok) return resolved.response;

  const deny = canMutateInstanceProjection(resolved.account);
  if (deny) return deny;

  const deleted = await deleteAccountInstanceProjectionRow({ env, account: resolved.account, publicId });
  if (!deleted.ok) return deleted.response;
  return json({ ok: true });
}

export const PROJECTION_ROUTES: BerlinRoute[] = [
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/instances\/projection$/,
    methods: {
      POST: ({ request, env, match }) => handleAccountInstanceProjectionCreate(request, env, capture(match, 1)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/instances\/([^/]+)\/projection$/,
    methods: {
      DELETE: ({ request, env, match }) =>
        handleAccountInstanceProjectionDelete(request, env, capture(match, 1), capture(match, 2)),
    },
  },
  {
    pattern: /^\/v1\/accounts\/([^/]+)\/publish-containment$/,
    methods: {
      GET: ({ request, env, match }) => handleAccountPublishContainmentProjection(request, env, capture(match, 1)),
    },
  },
];
