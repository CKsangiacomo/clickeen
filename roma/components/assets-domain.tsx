'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatBytes, formatNumber } from '../lib/format';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { parseApiErrorReason } from './same-origin-json';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AssetRecord = {
  assetRef: string;
  assetType: string;
  filename: string;
  url: string;
  contentType: string;
  sizeBytes: number;
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
  assetRef: string;
  filename: string;
  usageCount: number;
};

type DeleteRequestError = Error & {
  status?: number;
  payload?: DeletePreconditionPayload | null;
};

type AccountAssetsListResponse = {
  accountId: string;
  storageBytesUsed?: number;
  assets: AssetRecord[];
};

type AssetUploadResponse = {
  assetRef?: string;
  assetType?: string;
  filename?: string;
  url?: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt?: string;
  error?: unknown;
};

type BulkItemStatus = 'queued' | 'uploading' | 'success' | 'failed';

type BulkUploadItem = {
  id: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  status: BulkItemStatus;
  error: string | null;
};

const DELETE_REASON_COPY: Record<string, string> = {
  'coreui.errors.asset.notFound': 'Asset not found. It may already be deleted.',
  'coreui.errors.asset.inUseConfirmRequired': 'This asset is in use and requires confirmation before delete.',
  'coreui.errors.auth.required': 'You need to sign in again to manage assets.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage this asset.',
  'coreui.errors.db.writeFailed': 'Asset delete failed on the server. Please try again.',
  'coreui.errors.assets.integrity.dbPointerMissingBlob':
    'Delete blocked: this asset points to missing blobs in storage. Resolve in Assets panel.',
  'coreui.errors.assets.integrity.orphanBlob':
    'Delete blocked: storage contains orphan blobs for this asset. Resolve in Assets panel.',
  'coreui.errors.assets.integrity.blobMissingForAsset':
    'Delete blocked: this asset has no storage blob key. Resolve in Assets panel.',
  'coreui.errors.assets.integrityUnavailable':
    'Delete blocked: asset integrity check is unavailable right now. Try again.',
};

const ASSET_REASON_COPY: Record<string, string> = {
  'coreui.upsell.reason.budgetExceeded':
    'This upload would exceed your account storage limit. Delete assets or upgrade storage, then try again.',
  'coreui.upsell.reason.capReached': 'This file exceeds the per-file upload limit.',
  'coreui.upsell.reason.platform.uploads': 'Uploads are not available for this account plan.',
  'coreui.errors.assets.uploadFailed': 'Asset upload failed. Please try again.',
  'coreui.errors.auth.required': 'You need to sign in again to manage assets.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage assets in this account.',
  'coreui.errors.db.readFailed': 'Failed to load assets. Please try again.',
  'coreui.errors.db.writeFailed': 'Asset update failed on the server. Please try again.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
};

function resolveAssetErrorCopy(reason: string, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = ASSET_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.')) return fallback;
  return normalized;
}

function resolveDeleteErrorCopy(reason: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return 'Asset delete failed. Please try again.';
  const mapped = DELETE_REASON_COPY[normalized];
  if (mapped) return mapped;
  return resolveAssetErrorCopy(normalized, 'Asset delete failed. Please try again.');
}

function extractAssetIdFromRef(assetRefRaw: string): string | null {
  const raw = String(assetRefRaw || '').trim();
  if (!raw) return null;
  let key = raw;
  if (/^https?:\/\//i.test(key)) {
    try {
      const parsedUrl = new URL(key);
      key = parsedUrl.pathname;
    } catch {
      return null;
    }
  }
  if (key.startsWith('/assets/v/')) {
    key = key.slice('/assets/v/'.length);
    try {
      key = decodeURIComponent(key);
    } catch {
      return null;
    }
  }
  key = key.replace(/^\/+/, '');
  const match = key.match(/^assets\/versions\/[0-9a-f-]{36}\/([0-9a-f-]{36})\/.+$/i);
  if (!match) return null;
  return match[1] || null;
}

async function requestDeleteAsset(
  accountId: string,
  assetId: string,
  confirmInUse: boolean,
  authzCapsule?: string | null,
): Promise<DeleteAssetPayload> {
  const search = confirmInUse ? '?confirmInUse=1' : '';
  const response = await fetch(
    `/api/assets/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}${search}`,
    {
      method: 'DELETE',
      cache: 'no-store',
      headers: authzCapsule ? { 'x-ck-authz-capsule': authzCapsule } : undefined,
    },
  );
  const payload = (await response.json().catch(() => null)) as DeleteAssetPayload | DeletePreconditionPayload | null;
  if (!response.ok) {
    const reason = parseApiErrorReason(payload, response.status);
    const error = new Error(reason) as DeleteRequestError;
    error.status = response.status;
    error.payload = (payload as DeletePreconditionPayload | null) ?? null;
    throw error;
  }
  return (payload as DeleteAssetPayload) ?? { accountId, assetId, deleted: true };
}

async function requestUploadAsset(
  accountId: string,
  file: File,
  source: string,
  authzCapsule?: string | null,
): Promise<AssetRecord> {
  const response = await fetch('/api/assets/upload', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-account-id': accountId,
      'x-filename': file.name || 'upload.bin',
      'x-source': source,
      ...(authzCapsule ? { 'x-ck-authz-capsule': authzCapsule } : {}),
    },
    body: file,
  });
  const payload = (await response.json().catch(() => null)) as AssetUploadResponse | null;
  if (!response.ok) {
    throw new Error(parseApiErrorReason(payload, response.status));
  }
  const assetRef = typeof payload?.assetRef === 'string' ? payload.assetRef.trim() : '';
  if (!assetRef) throw new Error('coreui.errors.assets.uploadFailed');
  return {
    assetRef,
    assetType: typeof payload?.assetType === 'string' ? payload.assetType : 'other',
    filename: typeof payload?.filename === 'string' ? payload.filename : file.name || 'upload.bin',
    url: typeof payload?.url === 'string' ? payload.url : '',
    contentType: typeof payload?.contentType === 'string' ? payload.contentType : file.type || 'application/octet-stream',
    sizeBytes: typeof payload?.sizeBytes === 'number' && Number.isFinite(payload.sizeBytes) ? Math.max(0, Math.trunc(payload.sizeBytes)) : file.size,
    createdAt: typeof payload?.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
  };
}

function upsertAsset(existing: AssetRecord[], next: AssetRecord): AssetRecord[] {
  const without = existing.filter((item) => item.assetRef !== next.assetRef);
  return [next, ...without];
}

export function AssetsDomain() {
  const me = useRomaMe();
  const reloadMe = me.reload;
  const searchParams = useSearchParams();
  const singleUploadInputRef = useRef<HTMLInputElement | null>(null);
  const bulkUploadInputRef = useRef<HTMLInputElement | null>(null);

  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const accountCapsule =
    typeof me.data?.authz?.accountCapsule === 'string' && me.data.authz.accountCapsule.trim()
      ? me.data.authz.accountCapsule.trim()
      : null;
  const redirectReasonKey = useMemo(() => String(searchParams.get('reasonKey') || '').trim(), [searchParams]);
  const entitlements = me.data?.authz?.entitlements ?? null;
  const uploadSizeCapBytes = useMemo(() => {
    const raw = entitlements?.caps?.['uploads.size.max'];
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null;
  }, [entitlements?.caps]);
  const storageBudget = entitlements?.budgets?.['budget.uploads.bytes'] ?? null;

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [storageBytesUsed, setStorageBytesUsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [singleUploadError, setSingleUploadError] = useState<string | null>(null);
  const [singleUploadBusy, setSingleUploadBusy] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadBusy, setBulkUploadBusy] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkUploadItem[]>([]);

  const refreshAssets = useCallback(async () => {
    if (!accountId) {
      setAssets([]);
      setStorageBytesUsed(0);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(accountId)}?limit=500`, {
        method: 'GET',
        cache: 'no-store',
        headers: accountCapsule ? { 'x-ck-authz-capsule': accountCapsule } : undefined,
      });
      const payload = (await response.json().catch(() => null)) as AccountAssetsListResponse | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(parseApiErrorReason(payload, response.status));
      }
      const resolvedAssets =
        payload && typeof payload === 'object' && Array.isArray((payload as AccountAssetsListResponse).assets)
          ? (payload as AccountAssetsListResponse).assets
          : [];
      const storageUsed =
        payload && typeof payload === 'object' && typeof (payload as AccountAssetsListResponse).storageBytesUsed === 'number'
          ? Math.max(0, Math.trunc((payload as AccountAssetsListResponse).storageBytesUsed ?? 0))
          : resolvedAssets.reduce((total, asset) => total + Math.max(0, Math.trunc(asset.sizeBytes)), 0);
      setAssets(resolvedAssets);
      setStorageBytesUsed(storageUsed);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAssets([]);
      setStorageBytesUsed(0);
      setError(resolveAssetErrorCopy(message, 'Failed to load assets. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [accountCapsule, accountId]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const deleteAsset = useCallback(
    async (asset: AssetRecord, confirmInUse: boolean) => {
      if (!accountId) return;
      const assetId = extractAssetIdFromRef(asset.assetRef);
      if (!assetId) {
        setDeleteError('Asset delete failed. Invalid assetRef.');
        return;
      }
      setDeletingAssetId(assetId);
      setDeleteError(null);
      try {
        await requestDeleteAsset(accountId, assetId, confirmInUse, accountCapsule);
        setPendingDelete(null);
        setAssets((prev) => prev.filter((entry) => entry.assetRef !== asset.assetRef));
        setStorageBytesUsed((prev) => Math.max(0, prev - Math.max(0, Math.trunc(asset.sizeBytes))));
      } catch (err) {
        const typed = err as DeleteRequestError;
        if (
          typed?.status === 409 &&
          typed.payload &&
          typed.payload.requiresConfirm === true &&
          typed.payload.error?.reasonKey === 'coreui.errors.asset.inUseConfirmRequired'
        ) {
          setPendingDelete({
            assetRef: asset.assetRef,
            filename: asset.filename,
            usageCount:
              typeof typed.payload.usageCount === 'number' && Number.isFinite(typed.payload.usageCount)
                ? Math.max(0, Math.trunc(typed.payload.usageCount))
                : 0,
          });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setDeleteError(resolveDeleteErrorCopy(message));
      } finally {
        setDeletingAssetId(null);
      }
    },
    [accountCapsule, accountId],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const asset = assets.find((entry) => entry.assetRef === pendingDelete.assetRef);
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

  const uploadSingle = useCallback(
    async (file: File) => {
      if (!accountId) return;
      if (uploadSizeCapBytes != null && file.size > uploadSizeCapBytes) {
        setSingleUploadError(`File exceeds per-file limit (${formatBytes(uploadSizeCapBytes)}).`);
        return;
      }
      setSingleUploadBusy(true);
      setSingleUploadError(null);
      try {
        const uploaded = await requestUploadAsset(accountId, file, 'api', accountCapsule);
        setAssets((prev) => upsertAsset(prev, uploaded));
        setStorageBytesUsed((prev) => prev + Math.max(0, Math.trunc(uploaded.sizeBytes)));
        await reloadMe();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSingleUploadError(resolveAssetErrorCopy(message, 'Asset upload failed. Please try again.'));
      } finally {
        setSingleUploadBusy(false);
      }
    },
    [accountCapsule, accountId, reloadMe, uploadSizeCapBytes],
  );

  const handleSingleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      void uploadSingle(file);
    },
    [uploadSingle],
  );

  const updateBulkItem = useCallback((id: string, patch: Partial<BulkUploadItem>) => {
    setBulkItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const runBulkUpload = useCallback(
    async (files: File[]) => {
      if (!accountId || files.length === 0) return;
      const initial: BulkUploadItem[] = files.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name || 'upload.bin',
        sizeBytes: file.size,
        contentType: file.type || 'application/octet-stream',
        status: 'queued',
        error: null,
      }));
      setBulkItems(initial);
      setBulkUploadOpen(true);
      setBulkUploadBusy(true);

      let uploadedAny = false;
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const item = initial[i];
        if (!item) continue;
        if (uploadSizeCapBytes != null && file.size > uploadSizeCapBytes) {
          updateBulkItem(item.id, {
            status: 'failed',
            error: `File exceeds per-file limit (${formatBytes(uploadSizeCapBytes)}).`,
          });
          continue;
        }

        updateBulkItem(item.id, { status: 'uploading', error: null });
        try {
          const uploaded = await requestUploadAsset(accountId, file, 'api', accountCapsule);
          setAssets((prev) => upsertAsset(prev, uploaded));
          setStorageBytesUsed((prev) => prev + Math.max(0, Math.trunc(uploaded.sizeBytes)));
          updateBulkItem(item.id, { status: 'success', error: null });
          uploadedAny = true;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          updateBulkItem(item.id, {
            status: 'failed',
            error: resolveAssetErrorCopy(message, 'Asset upload failed. Please try again.'),
          });
        }
      }

      setBulkUploadBusy(false);
      if (uploadedAny) {
        await reloadMe();
      }
    },
    [accountCapsule, accountId, reloadMe, updateBulkItem, uploadSizeCapBytes],
  );

  const handleBulkFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (!files.length) return;
      void runBulkUpload(files);
    },
    [runBulkUpload],
  );

  if (me.loading) return <section className="rd-canvas-module body-m">Loading account context...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveAccountShellErrorCopy(
          me.error ?? 'coreui.errors.auth.contextUnavailable',
          'Assets are unavailable right now. Please try again.',
        )}
      </section>
    );
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account is available for assets right now.</section>;
  }

  const successfulBulkCount = bulkItems.filter((item) => item.status === 'success').length;
  const failedBulkCount = bulkItems.filter((item) => item.status === 'failed').length;

  return (
    <>
      <section className="rd-canvas-module">
        {context.accountName ? <p className="body-m">Account: {context.accountName}</p> : null}

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
          <p className="body-m">
            Builder upload is blocked.{' '}
            {resolveAssetErrorCopy(redirectReasonKey, 'Manage storage here, then retry the upload in Builder.')}
          </p>
        ) : null}
        <p className="body-m">Stored assets: {formatNumber(assets.length)}</p>
        <p className="body-m">
          Storage used: {formatBytes(storageBytesUsed)} /{' '}
          {storageBudget?.max == null ? 'unlimited' : formatBytes(storageBudget.max)}
        </p>
        {uploadSizeCapBytes != null ? (
          <p className="body-m">Per-file upload limit: {formatBytes(uploadSizeCapBytes)}</p>
        ) : null}

        <div className="roma-toolbar">
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => singleUploadInputRef.current?.click()}
            disabled={singleUploadBusy || bulkUploadBusy}
          >
            <span className="diet-btn-txt__label body-m">{singleUploadBusy ? 'Uploading…' : 'Upload asset'}</span>
          </button>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="secondary"
            type="button"
            onClick={() => bulkUploadInputRef.current?.click()}
            disabled={singleUploadBusy || bulkUploadBusy}
          >
            <span className="diet-btn-txt__label body-m">{bulkUploadBusy ? 'Uploading…' : 'Upload in bulk'}</span>
          </button>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            onClick={() => void refreshAssets()}
            disabled={loading || singleUploadBusy || bulkUploadBusy}
          >
            <span className="diet-btn-txt__label body-m">{loading ? 'Refreshing…' : 'Refresh list'}</span>
          </button>
        </div>

        <input
          ref={singleUploadInputRef}
          type="file"
          hidden
          onChange={handleSingleFileChange}
          aria-label="Upload single asset"
        />
        <input
          ref={bulkUploadInputRef}
          type="file"
          multiple
          hidden
          onChange={handleBulkFileChange}
          aria-label="Upload multiple assets"
        />

        {singleUploadError ? <p className="body-m">Upload failed: {singleUploadError}</p> : null}
        {deleteError ? <p className="body-m">Failed to delete asset: {deleteError}</p> : null}
      </section>

      <section className="rd-canvas-module">
        <table className="roma-table">
          <thead>
            <tr>
              <th className="table-header label-s">Asset</th>
              <th className="table-header label-s">Type</th>
              <th className="table-header label-s">MIME</th>
              <th className="table-header label-s">Size</th>
              <th className="table-header label-s">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.assetRef}>
                <td className="body-s">{asset.filename}</td>
                <td className="body-s">{asset.assetType}</td>
                <td className="body-s">{asset.contentType}</td>
                <td className="body-s">{formatBytes(asset.sizeBytes)}</td>
                <td className="roma-cell-actions">
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="secondary"
                    type="button"
                    onClick={() => handleDeleteAsset(asset)}
                    disabled={deletingAssetId === extractAssetIdFromRef(asset.assetRef)}
                  >
                    <span className="diet-btn-txt__label body-m">
                      {deletingAssetId === extractAssetIdFromRef(asset.assetRef) ? 'Deleting...' : 'Delete'}
                    </span>
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
            <p className="body-m">Asset: {pendingDelete.filename}</p>
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

      {bulkUploadOpen ? (
        <div className="roma-modal-backdrop" role="presentation">
          <div className="roma-modal" role="dialog" aria-modal="true" aria-labelledby="roma-assets-bulk-title">
            <h2 id="roma-assets-bulk-title" className="heading-6">
              Bulk upload
            </h2>
            <p className="body-m">
              Upload multiple files in one run. Each file is processed independently and failures do not block other files.
            </p>
            <div className="roma-inline-stack">
              <p className="body-s">Success: {successfulBulkCount}</p>
              <p className="body-s">Failed: {failedBulkCount}</p>
              {bulkUploadBusy ? <p className="body-s">Uploading…</p> : null}
            </div>
            <table className="roma-table">
              <thead>
                <tr>
                  <th className="table-header label-s">File</th>
                  <th className="table-header label-s">Type</th>
                  <th className="table-header label-s">Size</th>
                  <th className="table-header label-s">Status</th>
                </tr>
              </thead>
              <tbody>
                {bulkItems.map((item) => (
                  <tr key={item.id}>
                    <td className="body-s">{item.name}</td>
                    <td className="body-s">{item.contentType}</td>
                    <td className="body-s">{formatBytes(item.sizeBytes)}</td>
                    <td className="body-s">
                      {item.status}
                      {item.error ? ` - ${item.error}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="roma-modal__actions">
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="line2"
                type="button"
                onClick={() => bulkUploadInputRef.current?.click()}
                disabled={bulkUploadBusy}
              >
                <span className="diet-btn-txt__label body-m">Add more files</span>
              </button>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="secondary"
                type="button"
                onClick={() => setBulkUploadOpen(false)}
                disabled={bulkUploadBusy}
              >
                <span className="diet-btn-txt__label body-m">Close</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
