import {
  asTrimmedString,
  berlinProductUnavailableResult,
  fetchBerlinProductJson,
  isRecord,
  type BerlinAccountPublishContainmentResult,
} from './berlin-product-shared';

export async function loadAccountPublishContainment(
  accountId: string,
  berlinAccessToken: string,
  requestId?: string | null,
): Promise<BerlinAccountPublishContainmentResult> {
  try {
    const containment = await fetchBerlinProductJson<{
      containment?: { active?: unknown; reason?: unknown } | null;
    }>({
      accessToken: berlinAccessToken,
      path: `/v1/accounts/${encodeURIComponent(accountId)}/publish-containment`,
      requestId,
    });
    if (!containment.ok) return containment;
    const value = containment.value;
    if (!isRecord(value) || !isRecord(value.containment) || typeof value.containment.active !== 'boolean') {
      return {
        ok: false,
        status: 502,
        reasonKey: 'coreui.errors.payload.invalid',
        detail: 'berlin_publish_containment_invalid_payload',
      };
    }
    return {
      ok: true,
      containment: {
        active: value.containment.active,
        reason: asTrimmedString(value.containment.reason),
      },
    };
  } catch (error) {
    return berlinProductUnavailableResult(error);
  }
}
