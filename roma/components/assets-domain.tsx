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

export function AssetsDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const workspaceId = context.workspaceId;

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDeleteAsset = useCallback(async (assetId: string, usageCount: number) => {
    if (!accountId) return;
    const usageWarning =
      usageCount > 0
        ? `This asset is currently referenced ${usageCount} time${usageCount === 1 ? '' : 's'} in instance config. `
        : '';
    const confirmed = window.confirm(
      `${usageWarning}Delete this asset from account library? This is a soft delete and does not rewrite existing instance configs.`,
    );
    if (!confirmed) return;
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
  }, [accountId]);

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
                  onClick={() => void handleDeleteAsset(asset.assetId, asset.usageCount)}
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
    </section>
  );
}
