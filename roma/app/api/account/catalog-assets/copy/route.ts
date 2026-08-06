import { resolvePolicyFromEntitlementsSnapshot } from '@clickeen/ck-policy';
import { NextRequest, NextResponse } from 'next/server';
import {
  finalizeAccountAssetResponse,
  proxyAccountAssetJson,
  resolveCurrentAccountAssetGatewayContext,
} from '@roma/lib/account-assets-gateway';
import { isAccountAssetRef } from '@roma/lib/account-asset-record';

export const runtime = 'edge';

function resolvePositiveLimit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
}

function isExactRequestBody(raw: unknown): raw is { assetRefs: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  if (Object.keys(raw).length !== 1 || !Object.prototype.hasOwnProperty.call(raw, 'assetRefs')) return false;
  const assetRefs = (raw as { assetRefs?: unknown }).assetRefs;
  if (!Array.isArray(assetRefs) || assetRefs.length === 0 || assetRefs.some((value) => typeof value !== 'string')) return false;
  if (assetRefs.some((value) => !isAccountAssetRef(value))) return false;
  return new Set(assetRefs).size === assetRefs.length;
}

function isExactCopySuccess(raw: unknown, expectedSourceAssetRefs: string[]): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length !== 1) return false;
  const mappings = (raw as { mappings?: unknown }).mappings;
  if (!Array.isArray(mappings) || mappings.length !== expectedSourceAssetRefs.length) return false;
  const returnedSources: string[] = [];
  const valid = mappings.every((mapping) => {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return false;
    if (Object.keys(mapping).sort().join(',') !== 'destinationAssetRef,sourceAssetRef') return false;
    const record = mapping as { sourceAssetRef?: unknown; destinationAssetRef?: unknown };
    if (!isAccountAssetRef(record.sourceAssetRef) || !isAccountAssetRef(record.destinationAssetRef)) return false;
    returnedSources.push(record.sourceAssetRef);
    return true;
  });
  return valid && new Set(returnedSources).size === returnedSources.length &&
    expectedSourceAssetRefs.every((sourceAssetRef) => returnedSources.includes(sourceAssetRef));
}

export async function POST(request: NextRequest) {
  const gateway = await resolveCurrentAccountAssetGatewayContext({ request, minRole: 'editor' });
  if (!gateway.ok) return gateway.response;

  if ((request.headers.get('x-account-id') || '').trim()) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.accountId.invalid' } },
        { status: 422 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }

  const body = await request.json().catch(() => null);
  if (!isExactRequestBody(body)) {
    return finalizeAccountAssetResponse({
      request,
      response: NextResponse.json(
        { error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.assets.copy.invalidPayload' } },
        { status: 422 },
      ),
      setCookies: gateway.value.sessionSetCookies,
    });
  }

  const policy = resolvePolicyFromEntitlementsSnapshot({
    profile: gateway.value.authzPayload.profile,
    role: gateway.value.authzPayload.role,
    entitlements: gateway.value.authzPayload.entitlements ?? null,
  });
  const uploadSizeLimit = resolvePositiveLimit(policy.limits['uploads.size.max']);
  const storageLimit = resolvePositiveLimit(policy.limits['storage.bytes.max']);

  return proxyAccountAssetJson({
    request,
    context: gateway.value,
    method: 'POST',
    path: '/__internal/assets/catalog-copy',
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: {
      'x-upload-size-max': uploadSizeLimit === null ? 'unlimited' : String(uploadSizeLimit),
      'x-storage-bytes-max': storageLimit === null ? 'unlimited' : String(storageLimit),
    },
    validateSuccessPayload: (payload) => isExactCopySuccess(payload, body.assetRefs),
  });
}
