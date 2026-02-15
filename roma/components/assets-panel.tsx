'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRomaMe } from './use-roma-me';

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
  assets: AssetRecord[];
};

function parseReason(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') return `HTTP_${status}`;
  const withError = payload as { error?: unknown };
  if (typeof withError.error === 'string') return withError.error;
  if (withError.error && typeof withError.error === 'object') {
    const reasonKey = (withError.error as { reasonKey?: unknown }).reasonKey;
    if (typeof reasonKey === 'string') return reasonKey;
  }
  return `HTTP_${status}`;
}

export function AssetsPanel() {
  const me = useRomaMe();
  const [accountId, setAccountId] = useState<string>('');
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const accountOptions = useMemo(() => me.data?.accounts ?? [], [me.data?.accounts]);

  const loadAssets = useCallback(async (targetAccountId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/paris/accounts/${encodeURIComponent(targetAccountId)}/assets`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as AssetsPayload | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(parseReason(payload, response.status));
      }
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
  }, []);

  useEffect(() => {
    if (!me.data) return;
    const preferred = me.data.defaults.accountId ?? me.data.accounts[0]?.accountId ?? '';
    setAccountId((current) => current || preferred);
  }, [me.data]);

  useEffect(() => {
    if (!accountId) return;
    void loadAssets(accountId);
  }, [accountId, loadAssets]);

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      if (!accountId) return;
      const confirmed = window.confirm('Delete this asset from account library? This is a soft delete.');
      if (!confirmed) return;
      setDeletingAssetId(assetId);
      setDeleteError(null);
      try {
        const response = await fetch(`/api/paris/accounts/${encodeURIComponent(accountId)}/assets/${encodeURIComponent(assetId)}`, {
          method: 'DELETE',
        });
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        if (!response.ok) throw new Error(parseReason(payload, response.status));
        await loadAssets(accountId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setDeleteError(message);
      } finally {
        setDeletingAssetId(null);
      }
    },
    [accountId, loadAssets],
  );

  if (me.loading) return <section className="roma-module-surface">Loading account context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load account context: {me.error ?? 'unknown_error'}</section>;
  }
  if (accountOptions.length === 0) {
    return <section className="roma-module-surface">No account membership found for current user.</section>;
  }

  return (
    <section className="roma-module-surface">
      <div className="roma-toolbar">
        <label className="roma-label" htmlFor="account-select">
          Account
        </label>
        <select id="account-select" className="roma-select" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accountOptions.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.accountId}
            </option>
          ))}
        </select>
      </div>

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
              <td>{asset.sizeBytes}</td>
              <td>{asset.usageCount}</td>
              <td className="roma-cell-actions">
                <button
                  className="roma-btn roma-btn--danger roma-btn--inline"
                  type="button"
                  onClick={() => void handleDeleteAsset(asset.assetId)}
                  disabled={deletingAssetId === asset.assetId}
                >
                  {deletingAssetId === asset.assetId ? 'Deleting...' : 'Delete'}
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
