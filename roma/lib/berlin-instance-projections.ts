import {
  asTrimmedString,
  fetchBerlinProductJson,
  berlinProductUnavailableResult,
  type BerlinAccountInstanceProjectionResult,
  type BerlinAccountPublishContainmentResult,
  type BerlinDeleteInstanceProjectionResult,
} from './berlin-product-shared';

type BerlinProjectionRow = {
  publicId?: unknown;
  displayName?: unknown;
  updatedAt?: unknown;
  widgetId?: unknown;
  accountId?: unknown;
  widgetType?: unknown;
  meta?: unknown;
};

function normalizeProjectionRow(row: BerlinProjectionRow | null, fallbackPublicId: string): NonNullable<Extract<BerlinAccountInstanceProjectionResult, { ok: true }>['row']> | null {
  if (!row) return null;
  const widgetId = asTrimmedString(row.widgetId);
  const accountId = asTrimmedString(row.accountId);
  const widgetType = asTrimmedString(row.widgetType);
  if (!widgetId || !accountId || !widgetType) return null;
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
  };
}

export async function createAccountInstanceProjectionRow(args: {
  accountId: string;
  publicId: string;
  widgetType: string;
  displayName?: string | null;
  meta?: Record<string, unknown> | null;
  berlinAccessToken: string;
}): Promise<BerlinAccountInstanceProjectionResult> {
  try {
    const projection = await fetchBerlinProductJson<{ row?: BerlinProjectionRow | null }>({
      accessToken: args.berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(args.accountId)}/instances/projection`,
      method: 'POST',
      body: {
        publicId: args.publicId,
        widgetType: args.widgetType,
        displayName: args.displayName ?? null,
      },
    });
    if (!projection.ok) return projection;
    const row = normalizeProjectionRow(projection.value.row ?? null, args.publicId);
    if (projection.value.row && !row) {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.instance.invalidPayload',
        detail: 'invalid Berlin instance projection payload',
      };
    }
    return { ok: true, row };
  } catch (error) {
    return berlinProductUnavailableResult(error);
  }
}

export async function deleteAccountInstanceProjectionRow(args: {
  accountId: string;
  publicId: string;
  berlinAccessToken: string;
}): Promise<BerlinDeleteInstanceProjectionResult> {
  try {
    const projection = await fetchBerlinProductJson<{ ok?: unknown }>({
      accessToken: args.berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(args.accountId)}/instances/${encodeURIComponent(args.publicId)}/projection`,
      method: 'DELETE',
    });
    if (!projection.ok) return projection;
    return { ok: true };
  } catch (error) {
    return berlinProductUnavailableResult(error);
  }
}

export async function loadAccountPublishContainment(
  accountId: string,
  berlinAccessToken: string,
): Promise<BerlinAccountPublishContainmentResult> {
  try {
    const containment = await fetchBerlinProductJson<{
      containment?: { active?: unknown; reason?: unknown } | null;
    }>({
      accessToken: berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(accountId)}/publish-containment`,
    });
    if (!containment.ok) return containment;
    return {
      ok: true,
      containment: {
        active: Boolean(containment.value.containment?.active),
        reason: asTrimmedString(containment.value.containment?.reason),
      },
    };
  } catch (error) {
    return berlinProductUnavailableResult(error);
  }
}
