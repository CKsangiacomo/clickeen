'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { normalizeAccountAssetRecord, type AccountAssetRecord } from '@clickeen/ck-contracts';
import { formatBytes, formatNumber } from '../lib/format';
import { useRomaAccountApi, type RomaAccountApi } from './account-api';
import { parseApiErrorReason } from './same-origin-json';
import { useRomaAccountContext } from './roma-account-context';

type DeleteAssetPayload = {
  accountId: string;
  assetRef: string;
  deleted: boolean;
};

type AccountAssetsListResponse = {
  accountId: string;
  storageBytesUsed?: number;
  assets: unknown[];
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
  'coreui.errors.auth.required': 'You need to sign in again to manage assets.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage this asset.',
  'coreui.errors.db.writeFailed': 'Asset delete failed on the server. Please try again.',
  'coreui.errors.assets.integrityUnavailable': 'Delete blocked: asset integrity check is unavailable right now. Try again.',
};

const ASSET_REASON_COPY: Record<string, string> = {
  'coreui.upsell.reason.limitReached': 'This exceeds your current plan limit.',
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

async function requestDeleteAsset(
  accountApi: Pick<RomaAccountApi, 'fetchRaw'>,
  accountId: string,
  assetRef: string,
): Promise<DeleteAssetPayload> {
  const response = await accountApi.fetchRaw(`/api/account/assets/${encodeURIComponent(assetRef)}`, {
    method: 'DELETE',
  });
  const payload = (await response.json().catch(() => null)) as DeleteAssetPayload | { error?: unknown } | null;
  if (!response.ok) {
    const reason = parseApiErrorReason(payload, response.status);
    throw new Error(reason);
  }
  return (payload as DeleteAssetPayload) ?? { accountId, assetRef, deleted: true };
}

async function requestUploadAsset(accountApi: Pick<RomaAccountApi, 'fetchRaw'>, file: File, source: string): Promise<AccountAssetRecord> {
  const response = await accountApi.fetchRaw(`/api/account/assets/upload`, {
    method: 'POST',
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-filename': file.name || 'upload.bin',
      'x-source': source,
    },
    body: file,
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    throw new Error(parseApiErrorReason(payload, response.status));
  }
  const normalized = normalizeAccountAssetRecord(payload);
  if (!normalized) throw new Error('coreui.errors.assets.uploadFailed');
  return normalized;
}

export function AssetsDomain() {
  const { accountContext, data } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const singleUploadInputRef = useRef<HTMLInputElement | null>(null);
  const bulkUploadInputRef = useRef<HTMLInputElement | null>(null);

  const accountId = accountContext.accountId;
  const entitlements = data.authz?.entitlements ?? null;
  const uploadSizeLimitBytes = useMemo(() => {
    const raw = entitlements?.limits?.['uploads.size.max'];
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : null;
  }, [entitlements?.limits]);
  const storageLimit = entitlements?.limits?.['storage.bytes.max'] ?? null;

  const [assets, setAssets] = useState<AccountAssetRecord[] | null>(null);
  const [storageBytesUsed, setStorageBytesUsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingAssetRef, setDeletingAssetRef] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [singleUploadError, setSingleUploadError] = useState<string | null>(null);
  const [singleUploadBusy, setSingleUploadBusy] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadBusy, setBulkUploadBusy] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkUploadItem[]>([]);

  const refreshAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const assetsResponse = await accountApi.fetchRaw(`/api/account/assets`, {
        method: 'GET',
      });
      const assetsPayload = (await assetsResponse.json().catch(() => null)) as AccountAssetsListResponse | { error?: unknown } | null;
      if (!assetsResponse.ok) {
        throw new Error(parseApiErrorReason(assetsPayload, assetsResponse.status));
      }
      const resolvedAssets =
        assetsPayload && typeof assetsPayload === 'object' && Array.isArray((assetsPayload as AccountAssetsListResponse).assets)
          ? (assetsPayload as AccountAssetsListResponse).assets.map(normalizeAccountAssetRecord).filter((asset): asset is AccountAssetRecord => Boolean(asset))
          : [];
      const nextStorageBytesUsed =
        assetsPayload && typeof assetsPayload === 'object' && typeof (assetsPayload as AccountAssetsListResponse).storageBytesUsed === 'number'
          ? Math.max(0, Math.trunc((assetsPayload as AccountAssetsListResponse).storageBytesUsed ?? 0))
          : null;

      setAssets(resolvedAssets);
      setStorageBytesUsed(nextStorageBytesUsed);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(resolveAssetErrorCopy(message, 'Failed to load assets. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [accountApi]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const deleteAsset = useCallback(
    async (asset: AccountAssetRecord) => {
      if (!accountId) return;
      if (!asset.assetRef) {
        setDeleteError('Asset delete failed. Invalid asset reference.');
        return;
      }
      setDeletingAssetRef(asset.assetRef);
      setDeleteError(null);
      try {
        await requestDeleteAsset(accountApi, accountId, asset.assetRef);
        await refreshAssets();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setDeleteError(resolveDeleteErrorCopy(message));
      } finally {
        setDeletingAssetRef(null);
      }
    },
    [accountApi, accountId, refreshAssets],
  );

  const handleDeleteAsset = useCallback(
    (asset: AccountAssetRecord) => {
      if (!accountId) return;
      void deleteAsset(asset);
    },
    [accountId, deleteAsset],
  );

  const uploadSingle = useCallback(
    async (file: File) => {
      if (!accountId) return;
      if (uploadSizeLimitBytes != null && file.size > uploadSizeLimitBytes) {
        setSingleUploadError(`File exceeds per-file limit (${formatBytes(uploadSizeLimitBytes)}).`);
        return;
      }
      setSingleUploadBusy(true);
      setSingleUploadError(null);
      try {
        await requestUploadAsset(accountApi, file, 'api');
        await refreshAssets();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setSingleUploadError(resolveAssetErrorCopy(message, 'Asset upload failed. Please try again.'));
      } finally {
        setSingleUploadBusy(false);
      }
    },
    [accountApi, accountId, refreshAssets, uploadSizeLimitBytes],
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
        if (uploadSizeLimitBytes != null && file.size > uploadSizeLimitBytes) {
          updateBulkItem(item.id, {
            status: 'failed',
            error: `File exceeds per-file limit (${formatBytes(uploadSizeLimitBytes)}).`,
          });
          continue;
        }

        updateBulkItem(item.id, { status: 'uploading', error: null });
        try {
          await requestUploadAsset(accountApi, file, 'api');
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
        await refreshAssets();
      }
    },
    [accountApi, accountId, refreshAssets, updateBulkItem, uploadSizeLimitBytes],
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

  const successfulBulkCount = bulkItems.filter((item) => item.status === 'success').length;
  const failedBulkCount = bulkItems.filter((item) => item.status === 'failed').length;
  const storedAssetsLabel = assets == null ? (loading ? 'Loading...' : 'Unavailable') : formatNumber(assets.length);
  const storageUsedLabel = storageBytesUsed == null ? (loading ? 'Loading...' : 'Unavailable') : formatBytes(storageBytesUsed);
  const assetRows = assets ?? [];

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountContext.accountLabel}</p>

        {error ? (
          <div className="roma-inline-stack">
            <p className="body-m">{error}</p>
            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void refreshAssets()} disabled={loading}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        ) : null}
        <p className="body-m">Stored assets: {storedAssetsLabel}</p>
        <p className="body-m">
          Storage used: {storageUsedLabel} / {storageLimit == null ? 'unlimited' : formatBytes(storageLimit)}
        </p>
        {uploadSizeLimitBytes != null ? <p className="body-m">Per-file upload limit: {formatBytes(uploadSizeLimitBytes)}</p> : null}

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

        <input ref={singleUploadInputRef} type="file" hidden onChange={handleSingleFileChange} aria-label="Upload single asset" />
        <input ref={bulkUploadInputRef} type="file" multiple hidden onChange={handleBulkFileChange} aria-label="Upload multiple assets" />

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
            {assetRows.map((asset) => (
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
                    disabled={deletingAssetRef === asset.assetRef}
                  >
                    <span className="diet-btn-txt__label body-m">{deletingAssetRef === asset.assetRef ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </td>
              </tr>
            ))}
            {assets == null ? (
              <tr>
                <td colSpan={5} className="body-s">
                  {loading ? 'Loading assets...' : 'Assets are unavailable right now.'}
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={5} className="body-s">
                  No assets found for this account.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {bulkUploadOpen ? (
        <div className="roma-modal-backdrop" role="presentation">
          <div className="roma-modal" role="dialog" aria-modal="true" aria-labelledby="roma-assets-bulk-title">
            <h2 id="roma-assets-bulk-title" className="heading-6">
              Bulk upload
            </h2>
            <p className="body-m">Upload multiple files in one run. Each file is processed independently and failures do not block other files.</p>
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
