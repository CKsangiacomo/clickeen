import {
  asTrimmedString,
  fetchBerlinProductJson,
  michaelUnavailableResult,
  type MichaelAccountInstancePublicIdsResult,
  type MichaelAccountInstanceResult,
  type MichaelAccountPublishContainmentResult,
  type MichaelDeleteInstanceResult,
} from './michael-shared';

type BerlinRegistryRow = {
  publicId?: unknown;
  displayName?: unknown;
  updatedAt?: unknown;
  widgetId?: unknown;
  accountId?: unknown;
  widgetType?: unknown;
  meta?: unknown;
  source?: unknown;
};

function normalizeRegistryRow(row: BerlinRegistryRow | null, fallbackPublicId: string): NonNullable<Extract<MichaelAccountInstanceResult, { ok: true }>['row']> | null {
  if (!row) return null;
  const widgetId = asTrimmedString(row.widgetId);
  const accountId = asTrimmedString(row.accountId);
  const widgetType = asTrimmedString(row.widgetType);
  if (!widgetId || !accountId || !widgetType) return null;
  const source = row.source === 'curated' ? 'curated' : 'account';
  const meta =
    row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : null;
  return {
    publicId: asTrimmedString(row.publicId) ?? fallbackPublicId,
    displayName: asTrimmedString(row.displayName),
    updatedAt: asTrimmedString(row.updatedAt),
    widgetId,
    accountId,
    widgetType,
    meta,
    source,
  };
}

export async function getAccountInstanceCoreRow(
  accountId: string,
  publicId: string,
  accessToken: string,
): Promise<MichaelAccountInstanceResult> {
  try {
    const registry = await fetchBerlinProductJson<{ row?: BerlinRegistryRow | null }>({
      accessToken,
      path: `/v1/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/registry`,
    });
    if (!registry.ok) return registry;
    const row = normalizeRegistryRow(registry.value.row ?? null, publicId);
    if (registry.value.row && !row) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid Berlin instance registry payload',
      };
    }
    return { ok: true, row };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function createAccountInstanceRow(args: {
  accountId: string;
  publicId: string;
  widgetType: string;
  displayName?: string | null;
  meta?: Record<string, unknown> | null;
  berlinAccessToken: string;
}): Promise<MichaelAccountInstanceResult> {
  try {
    const registry = await fetchBerlinProductJson<{ row?: BerlinRegistryRow | null }>({
      accessToken: args.berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(args.accountId)}/instances/registry`,
      method: 'POST',
      body: {
        publicId: args.publicId,
        widgetType: args.widgetType,
        displayName: args.displayName ?? null,
      },
    });
    if (!registry.ok) return registry;
    const row = normalizeRegistryRow(registry.value.row ?? null, args.publicId);
    if (registry.value.row && !row) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid Berlin instance registry payload',
      };
    }
    return { ok: true, row };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function deleteAccountInstanceRow(args: {
  accountId: string;
  publicId: string;
  berlinAccessToken: string;
}): Promise<MichaelDeleteInstanceResult> {
  try {
    const registry = await fetchBerlinProductJson<{ ok?: unknown }>({
      accessToken: args.berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(args.accountId)}/instances/${encodeURIComponent(args.publicId)}/registry`,
      method: 'DELETE',
    });
    if (!registry.ok) return registry;
    return { ok: true };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function loadAccountPublishContainment(
  accountId: string,
  berlinAccessToken: string,
): Promise<MichaelAccountPublishContainmentResult> {
  try {
    const registry = await fetchBerlinProductJson<{
      containment?: { active?: unknown; reason?: unknown } | null;
    }>({
      accessToken: berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(accountId)}/publish-containment`,
    });
    if (!registry.ok) return registry;
    return {
      ok: true,
      containment: {
        active: Boolean(registry.value.containment?.active),
        reason: asTrimmedString(registry.value.containment?.reason),
      },
    };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}

export async function listAccountInstancePublicIds(
  accountId: string,
  berlinAccessToken: string,
): Promise<MichaelAccountInstancePublicIdsResult> {
  try {
    const registry = await fetchBerlinProductJson<{ publicIds?: unknown }>({
      accessToken: berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(accountId)}/instances/public-ids`,
    });
    if (!registry.ok) return registry;
    const publicIds = Array.isArray(registry.value.publicIds)
      ? registry.value.publicIds
          .map((publicId) => asTrimmedString(publicId))
          .filter((publicId): publicId is string => Boolean(publicId))
      : [];
    return { ok: true, publicIds };
  } catch (error) {
    return michaelUnavailableResult(error);
  }
}
