'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatBytes, formatNumber } from '../lib/format';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AssetRecord = {
  assetId: string;
  normalizedFilename: string;
  contentType: string;
  sizeBytes: number;
  usageCount: number;
  deletedAt: string | null;
  createdAt: string;
};

type DeleteAssetPayload = {
  accountId: string;
  assetId: string;
  deleted: boolean;
  alreadyDeleted?: boolean;
  deletedAt?: string | null;
};

type PendingDelete = {
  assetId: string;
  normalizedFilename: string;
  usageCount: number;
};

export function AssetsDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const workspaceId = context.workspaceId;

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  useEffect(() => {
    if (!accountId) {
      setAssets([]);
      setError(null);
      return;
    }
    const snapshot = me.data?.domains?.assets ?? null;
    if (!snapshot || snapshot.accountId !== accountId || !Array.isArray(snapshot.assets)) {
      setAssets([]);
      setError('Bootstrap assets snapshot unavailable.');
      return;
    }
    setAssets(snapshot.assets as AssetRecord[]);
    setError(null);
  }, [accountId, me.data?.domains?.assets]);

  const deleteAsset = useCallback(
    async (assetId: string) => {
      if (!accountId) return;
      setPendingDelete(null);
      setDeletingAssetId(assetId);
      setDeleteError(null);
      try {
        await fetchParisJson<DeleteAssetPayload>(
          `/api/paris/accounts/${encodeURIComponent(accountId)}/assets/${encodeURIComponent(assetId)}`,
          { method: 'DELETE' },
        );
        setAssets((prev) => prev.filter((asset) => asset.assetId !== assetId));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setDeleteError(message);
      } finally {
        setDeletingAssetId(null);
      }
    },
    [accountId],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const { assetId } = pendingDelete;
    await deleteAsset(assetId);
  }, [deleteAsset, pendingDelete]);

  const handleDeleteAsset = useCallback(
    (asset: AssetRecord) => {
      if (!accountId) return;
      if (asset.usageCount > 0) {
        setPendingDelete({
          assetId: asset.assetId,
          normalizedFilename: asset.normalizedFilename,
          usageCount: asset.usageCount,
        });
        return;
      }
      void deleteAsset(asset.assetId);
    },
    [accountId, deleteAsset],
  );

  if (me.loading) return <section className="roma-module-surface">Loading workspace context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load workspace context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="roma-module-surface">No account membership found for current user.</section>;
  }

  return (
    <section className="roma-module-surface">
      <p>
        Account: {accountId} | Workspace: {context.workspaceName || workspaceId}
      </p>

      {error ? <p>Failed to load assets: {error}</p> : null}
      {deleteError ? <p>Failed to delete asset: {deleteError}</p> : null}

      <table className="roma-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Type</th>
            <th>Size</th>
            <th>Usage</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.assetId}>
              <td>{asset.normalizedFilename}</td>
              <td>{asset.contentType}</td>
              <td>{formatBytes(asset.sizeBytes)}</td>
              <td>{formatNumber(asset.usageCount)}</td>
              <td className="roma-cell-actions">
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="secondary"
                  type="button"
                  onClick={() => handleDeleteAsset(asset)}
                  disabled={deletingAssetId === asset.assetId}
                >
                  <span className="diet-btn-txt__label">{deletingAssetId === asset.assetId ? 'Deleting...' : 'Delete'}</span>
                </button>
              </td>
            </tr>
          ))}
          {assets.length === 0 ? (
            <tr>
              <td colSpan={5}>No assets found for this account.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {pendingDelete ? (
        <div className="roma-modal-backdrop" role="presentation">
          <div className="roma-modal" role="dialog" aria-modal="true" aria-labelledby="roma-assets-delete-title">
            <h2 id="roma-assets-delete-title">Confirm asset delete</h2>
            <p>
              {pendingDelete.usageCount > 0
                ? `This asset is used ${pendingDelete.usageCount} time${pendingDelete.usageCount === 1 ? '' : 's'}, are you sure you want to delete it?`
                : 'Are you sure you want to delete this asset?'}
            </p>
            <p>Asset: {pendingDelete.normalizedFilename}</p>
            <div className="roma-modal__actions">
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="secondary"
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={Boolean(deletingAssetId)}
              >
                <span className="diet-btn-txt__label">Cancel</span>
              </button>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="danger"
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={Boolean(deletingAssetId)}
              >
                <span className="diet-btn-txt__label">Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
