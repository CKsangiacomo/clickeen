'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveBootstrapDomainState } from './bootstrap-domain-state';
import { formatBytes, formatNumber } from '../lib/format';
import { parseParisReason } from './paris-http';
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
  cleanupQueued?: number;
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
};

function resolveDeleteErrorCopy(reason: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return 'Asset delete failed. Please try again.';
  const mapped = DELETE_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_')) return `Asset delete failed (${normalized}).`;
  return normalized;
}

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
    const hasDomainPayload = Boolean(snapshot && snapshot.accountId === accountId && Array.isArray(snapshot.assets));
    const domainState = resolveBootstrapDomainState({
      data: me.data,
      domainKey: 'assets',
      hasDomainPayload,
    });
    if (!hasDomainPayload || domainState.kind !== 'ok') {
      setAssets([]);
      setError(domainState.reasonKey);
      return;
    }
    const safeSnapshot = snapshot as NonNullable<typeof snapshot>;
    setAssets(safeSnapshot.assets as AssetRecord[]);
    setError(null);
  }, [accountId, me.data]);

  useEffect(() => {
    if (!accountId) return;
    void reloadMe();
  }, [accountId, workspaceId, reloadMe]);

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

  if (me.loading) return <section className="rd-canvas-module body-m">Loading workspace context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load workspace context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account membership found for current user.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Account: {accountId} | Workspace: {context.workspaceName || workspaceId}
        </p>

        {error ? (
          <div className="roma-inline-stack">
            <p className="body-m">roma.errors.bootstrap.domain_unavailable</p>
            <p className="body-m">{error}</p>
            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void me.reload()}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        ) : null}
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
