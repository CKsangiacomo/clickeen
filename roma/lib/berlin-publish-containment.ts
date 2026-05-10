import {
  asTrimmedString,
  berlinProductUnavailableResult,
  fetchBerlinProductJson,
  type BerlinAccountPublishContainmentResult,
} from './berlin-product-shared';

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
