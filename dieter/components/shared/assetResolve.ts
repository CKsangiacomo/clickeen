import { isUuid } from '@clickeen/ck-contracts';
import { resolveHostedAssetBridge } from './hostedAssetBridge';

export type ResolvedEditorAssetChoice = {
  assetId: string;
  assetRef: string;
  url: string;
};

function readDocumentDatasetValue(key: string): string {
  if (typeof document === 'undefined') return '';
  const value = (document.documentElement.dataset as Record<string, string | undefined>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function resolveAssetApiBase(): string {
  return readDocumentDatasetValue('ckAssetApiBase').replace(/\/+$/, '');
}

function resolveEditorAssetAccountId(): string | null {
  const accountId = readDocumentDatasetValue('ckOwnerAccountId');
  return isUuid(accountId) ? accountId : null;
}

function normalizeResolvedEditorAssetChoice(raw: unknown): ResolvedEditorAssetChoice | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const asset = raw as Record<string, unknown>;
  const assetId = String(asset.assetId || '').trim();
  const assetRef = String(asset.assetRef || '').trim();
  const url = String(asset.url || '').trim();
  if (!isUuid(assetId) || !assetRef || !url) return null;
  return { assetId, assetRef, url };
}

export async function resolveEditorAssetChoices(
  assetIdsRaw: string[],
): Promise<Map<string, ResolvedEditorAssetChoice>> {
  const accountId = resolveEditorAssetAccountId();
  if (!accountId) {
    throw new Error('No account context available.');
  }

  const seen = new Set<string>();
  const assetIds = assetIdsRaw
    .map((entry) => String(entry || '').trim())
    .filter((assetId) => {
      if (!isUuid(assetId) || seen.has(assetId)) return false;
      seen.add(assetId);
      return true;
    });

  if (!assetIds.length) return new Map();

  const hostedBridge = resolveHostedAssetBridge();
  let payload: Record<string, unknown> | null = null;
  if (hostedBridge) {
    payload = (await hostedBridge.resolveAssets(assetIds)) as Record<string, unknown> | null;
  } else {
    const assetApiBase = resolveAssetApiBase();
    if (!assetApiBase) {
      throw new Error('coreui.errors.builder.command.hostUnavailable');
    }
    const endpoint = `${assetApiBase}/resolve`;

    const response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ assetIds }),
    });
    payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const reasonKey = String((payload?.error as Record<string, unknown> | undefined)?.reasonKey || '').trim();
      throw new Error(reasonKey || `HTTP_${response.status}`);
    }
  }

  const assets = Array.isArray(payload?.assets) ? (payload.assets as unknown[]) : [];
  const resolved = new Map<string, ResolvedEditorAssetChoice>();
  for (const asset of assets) {
    const normalized = normalizeResolvedEditorAssetChoice(asset);
    if (!normalized) continue;
    resolved.set(normalized.assetId, normalized);
  }
  return resolved;
}
