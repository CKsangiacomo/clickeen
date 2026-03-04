'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatBytes, formatNumber } from '../lib/format';
import { fetchParisJson, parseParisReason } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AssetRecord = {
  assetId: string;
  normalizedFilename: string;
  contentType: string;
  sizeBytes: number;
  usageCount: number;
  createdAt: string;
};

type DeleteAssetPayload = {
  accountId: string;
  assetId: string;
  deleted: boolean;
  usageCount?: number;
};

type DeletePreconditionPayload = {
  error?: { reasonKey?: string };
  usageCount?: number;
  requiresConfirm?: boolean;
};

type PendingDelete = {
  assetId: string;
  normalizedFilename: string;
  usageCount: number;
};

type DeleteRequestError = Error & {
  status?: number;
  payload?: DeletePreconditionPayload | null;
};

const DELETE_REASON_COPY: Record<string, string> = {
  'coreui.errors.asset.notFound': 'Asset not found. It may already be deleted.',
  'coreui.errors.asset.inUseConfirmRequired': 'This asset is in use and requires confirmation before delete.',
  'coreui.errors.auth.required': 'You need to sign in again to manage assets.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage this asset.',
  'coreui.errors.db.writeFailed': 'Asset delete failed on the server. Please try again.',
  'coreui.errors.assets.integrity.dbPointerMissingBlob': 'Delete blocked: this asset points to missing blobs in storage. Resolve in Assets panel.',
  'coreui.errors.assets.integrity.orphanBlob': 'Delete blocked: storage contains orphan blobs for this asset. Resolve in Assets panel.',
  'coreui.errors.assets.integrity.variantsMissingForAsset': 'Delete blocked: this asset has no variant metadata. Resolve in Assets panel.',
  'coreui.errors.assets.integrityUnavailable': 'Delete blocked: asset integrity check is unavailable right now. Try again.',
};


function resolveDeleteErrorCopy(reason: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return 'Asset delete failed. Please try again.';
  const mapped = DELETE_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_')) return `Asset delete failed (${normalized}).`;
  return normalized;
}

type AccountAssetsListResponse = {
  accountId: string;
  assets: AssetRecord[];
};

async function requestDeleteAsset(accountId: string, assetId: string, confirmInUse: boolean): Promise<DeleteAssetPayload> {
  const search = confirmInUse ? '?confirmInUse=1' : '';
  const response = await fetch(
    `/api/assets/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}${search}`,
    {
      method: 'DELETE',
      cache: 'no-store',
    },
  );
  const payload = (await response.json().catch(() => null)) as DeleteAssetPayload | DeletePreconditionPayload | null;
  if (!response.ok) {
    const reason = parseParisReason(payload, response.status);
    const error = new Error(reason) as DeleteRequestError;
    error.status = response.status;
    error.payload = (payload as DeletePreconditionPayload | null) ?? null;
    throw error;
  }
  return (payload as DeleteAssetPayload) ?? { accountId, assetId, deleted: true };
}

export function AssetsDomain() {
  const me = useRomaMe();
  const reloadMe = me.reload;
  const searchParams = useSearchParams();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const redirectReasonKey = useMemo(() => String(searchParams.get('reasonKey') || '').trim(), [searchParams]);
  const entitlements = me.data?.authz?.entitlements ?? null;
  const uploadSizeCapBytes = useMemo(() => {
    const raw = entitlements?.caps?.['uploads.size.max'];
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null;
  }, [entitlements?.caps]);
  const uploadsCountBudget = entitlements?.budgets?.['budget.uploads.count'] ?? null;
  const uploadsBytesBudget = entitlements?.budgets?.['budget.uploads.bytes'] ?? null;

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [purgeResult, setPurgeResult] = useState<{ ok?: boolean; deleted?: number } | null>(null);

  const refreshAssets = useCallback(async () => {
    if (!accountId) {
      setAssets([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchParisJson<AccountAssetsListResponse>(
        `/api/paris/accounts/${encodeURIComponent(accountId)}/assets?limit=500`,
        { method: 'GET' },
      );
      setAssets(Array.isArray(payload.assets) ? payload.assets : []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAssets([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const deleteAsset = useCallback(
    async (asset: AssetRecord, confirmInUse: boolean) => {
      if (!accountId) return;
      setDeletingAssetId(asset.assetId);
      setDeleteError(null);
      try {
        await requestDeleteAsset(accountId, asset.assetId, confirmInUse);
        setPendingDelete(null);
        setAssets((prev) => prev.filter((entry) => entry.assetId !== asset.assetId));
      } catch (err) {
        const typed = err as DeleteRequestError;
        if (
          typed?.status === 409 &&
          typed.payload &&
          typed.payload.requiresConfirm === true &&
          typed.payload.error?.reasonKey === 'coreui.errors.asset.inUseConfirmRequired'
        ) {
          setPendingDelete({
            assetId: asset.assetId,
            normalizedFilename: asset.normalizedFilename,
            usageCount:
              typeof typed.payload.usageCount === 'number' && Number.isFinite(typed.payload.usageCount)
                ? Math.max(0, Math.trunc(typed.payload.usageCount))
                : asset.usageCount,
          });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setDeleteError(resolveDeleteErrorCopy(message));
      } finally {
        setDeletingAssetId(null);
      }
    },
    [accountId],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const asset = assets.find((entry) => entry.assetId === pendingDelete.assetId);
    if (!asset) return;
    await deleteAsset(asset, true);
  }, [assets, deleteAsset, pendingDelete]);

  const handleDeleteAsset = useCallback(
    (asset: AssetRecord) => {
      if (!accountId) return;
      void deleteAsset(asset, false);
    },
    [accountId, deleteAsset],
  );

  const purgeAllAssetsEnabled = purgeConfirm.trim().toUpperCase() === 'PURGE';
  const handlePurgeAllAssets = useCallback(async () => {
    if (!accountId) return;
    setPurgeLoading(true);
    setPurgeError(null);
    setPurgeResult(null);
    try {
      const payload = await fetchParisJson<{ ok?: boolean; deleted?: number }>(
        `/api/paris/accounts/${encodeURIComponent(accountId)}/assets?confirm=1`,
        {
          method: 'DELETE',
          headers: {
            'x-clickeen-surface': 'roma-assets',
          },
        },
      );
      setPurgeResult(payload ?? { ok: true });
      setPurgeConfirm('');
      await reloadMe();
      await refreshAssets();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPurgeError(message);
    } finally {
      setPurgeLoading(false);
    }
  }, [accountId, refreshAssets, reloadMe]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading account context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load account context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account membership found for current user.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountId}</p>

        {error ? (
          <div className="roma-inline-stack">
            <p className="body-m">{error}</p>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="line2"
              type="button"
              onClick={() => void refreshAssets()}
              disabled={loading}
            >
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        ) : null}
        {redirectReasonKey ? (
          <p className="body-m">Upload blocked by entitlement: {redirectReasonKey}. Manage assets here, then retry upload in Builder.</p>
        ) : null}
        {uploadSizeCapBytes != null ? (
          <p className="body-m">Upload size limit per file: {formatBytes(uploadSizeCapBytes)}</p>
        ) : null}
        {uploadsCountBudget ? (
          <p className="body-m">
            Monthly upload count budget: {formatNumber(uploadsCountBudget.used)} /{' '}
            {uploadsCountBudget.max == null ? 'unlimited' : formatNumber(uploadsCountBudget.max)}
          </p>
        ) : null}
        {uploadsBytesBudget ? (
          <p className="body-m">
            Monthly upload bytes budget: {formatBytes(uploadsBytesBudget.used)} /{' '}
            {uploadsBytesBudget.max == null ? 'unlimited' : formatBytes(uploadsBytesBudget.max)}
          </p>
        ) : null}
        <div className="roma-inline-stack">
          <h2 className="heading-6">Danger zone: purge all assets</h2>
          <p className="body-m">
            Permanently deletes every asset blob + variant for this account from Tokyo/R2. This cannot be undone.
          </p>
          <div className="roma-toolbar">
            <input
              className="roma-input"
              value={purgeConfirm}
              onChange={(event) => setPurgeConfirm(event.target.value)}
              placeholder="Type PURGE to enable"
              aria-label="Confirm purge all assets"
              disabled={purgeLoading}
            />
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="secondary"
              type="button"
              onClick={() => void handlePurgeAllAssets()}
              disabled={!purgeAllAssetsEnabled || purgeLoading}
            >
              <span className="diet-btn-txt__label body-m">{purgeLoading ? 'Purging...' : 'Purge all assets'}</span>
            </button>
          </div>
          {purgeError ? <p className="body-m">Purge failed: {purgeError}</p> : null}
          {purgeResult ? (
            <p className="body-m">
              Purge result: {purgeResult.ok ? 'ok' : 'unknown'} {typeof purgeResult.deleted === 'number' ? `(${purgeResult.deleted} deleted)` : ''}
            </p>
          ) : null}
        </div>
        {deleteError ? <p className="body-m">Failed to delete asset: {deleteError}</p> : null}
      </section>

      <section className="rd-canvas-module">
        <table className="roma-table">
          <thead>
            <tr>
              <th className="table-header label-s">Asset</th>
              <th className="table-header label-s">Type</th>
              <th className="table-header label-s">Size</th>
              <th className="table-header label-s">Usage</th>
              <th className="table-header label-s">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.assetId}>
                <td className="body-s">{asset.normalizedFilename}</td>
                <td className="body-s">{asset.contentType}</td>
                <td className="body-s">{formatBytes(asset.sizeBytes)}</td>
                <td className="body-s">{formatNumber(asset.usageCount)}</td>
                <td className="roma-cell-actions">
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="secondary"
                    type="button"
                    onClick={() => handleDeleteAsset(asset)}
                    disabled={deletingAssetId === asset.assetId}
                  >
                    <span className="diet-btn-txt__label body-m">{deletingAssetId === asset.assetId ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </td>
              </tr>
            ))}
            {assets.length === 0 ? (
              <tr>
                <td colSpan={5} className="body-s">
                  No assets found for this account.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {pendingDelete ? (
        <div className="roma-modal-backdrop" role="presentation">
          <div className="roma-modal" role="dialog" aria-modal="true" aria-labelledby="roma-assets-delete-title">
            <h2 id="roma-assets-delete-title" className="heading-6">
              Confirm asset delete
            </h2>
            <p className="body-m">
              {pendingDelete.usageCount > 0
                ? `This asset is used ${pendingDelete.usageCount} time${pendingDelete.usageCount === 1 ? '' : 's'}, are you sure you want to delete it?`
                : 'Are you sure you want to delete this asset?'}
            </p>
            <p className="body-m">Asset: {pendingDelete.normalizedFilename}</p>
            <div className="roma-modal__actions">
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="secondary"
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={Boolean(deletingAssetId)}
              >
                <span className="diet-btn-txt__label body-m">Cancel</span>
              </button>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="danger"
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={Boolean(deletingAssetId)}
              >
                <span className="diet-btn-txt__label body-m">Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
