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

type AssetsPayload = {
  accountId: string;
  workspaceId: string | null;
  assets: AssetRecord[];
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    if (!accountId) {
      setAssets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchParisJson<AssetsPayload>(
        `/api/paris/accounts/${encodeURIComponent(accountId)}/assets`,
      );
      const items =
        payload && typeof payload === 'object' && Array.isArray((payload as { assets?: unknown }).assets)
          ? ((payload as { assets: AssetRecord[] }).assets ?? [])
          : [];
      setAssets(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    void loadAssets();
  }, [accountId, loadAssets]);

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
      await loadAssets();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDeleteError(message);
    } finally {
      setDeletingAssetId(null);
    }
  }, [accountId, loadAssets]);

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

      {loading ? <p>Loading assets...</p> : null}
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
          {!loading && assets.length === 0 ? (
            <tr>
              <td colSpan={5}>No assets found for this account.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
