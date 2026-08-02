'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { AccountAssetRecord } from '@clickeen/ck-contracts';
import { createDialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { parseAccountAssetRecord } from '../lib/account-asset-record';
import { formatBytes, formatNumber } from '../lib/format';
import { useRomaAccountApi, type RomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { parseApiErrorReason } from './same-origin-json';
import { useRomaAccountContext } from './roma-account-context';
import { RomaAccountNoticeModal } from './roma-account-notice-modal';
import { RomaDomainErrorBoundary } from './roma-domain-error-boundary';
import { RomaShell } from './roma-shell';

type DeleteAssetPayload = {
  accountId: string;
  assetRef: string;
  deleted: boolean;
};

type AccountAssetsListResponse = {
  accountId: string;
  storageBytesUsed: number;
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

type AssetSortKey = 'filename' | 'assetType' | 'sizeBytes';
type AssetSortDirection = 'ascending' | 'descending';
type AssetSort = { key: AssetSortKey; direction: AssetSortDirection };
type AssetFilter = 'all' | 'font' | 'vector' | 'image' | 'video';

type AssetsHeaderActions = {
  uploadAsset: () => void;
  uploadBulk: () => void;
  refresh: () => void;
  singleUploadBusy: boolean;
  bulkUploadBusy: boolean;
  listLoading: boolean;
};

const DEFAULT_ASSET_SORT: AssetSort = { key: 'filename', direction: 'ascending' };

const DELETE_REASON_COPY: Record<string, string> = {
  'coreui.errors.asset.notFound': 'Asset not found. It may already be deleted.',
  'coreui.errors.auth.required': 'You need to sign in again to manage assets.',
  'coreui.errors.auth.forbidden': 'You do not have permission to manage this asset.',
  'coreui.errors.db.writeFailed': 'Asset delete failed on the server. Please try again.',
  'coreui.errors.assets.integrityUnavailable': 'Delete blocked: asset integrity check is unavailable right now. Try again.',
  'coreui.errors.assets.payloadInvalid': 'Asset delete failed on the server. Please try again.',
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
  return fallback;
}

function resolveDeleteErrorCopy(reason: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return 'Asset delete failed. Please try again.';
  const mapped = DELETE_REASON_COPY[normalized];
  if (mapped) return mapped;
  return resolveAssetErrorCopy(normalized, 'Asset delete failed. Please try again.');
}

function formatBulkItemStatus(status: BulkItemStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'uploading':
      return 'Uploading';
    case 'success':
      return 'Uploaded';
    case 'failed':
      return 'Failed';
    default:
      return 'Unavailable';
  }
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
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    (payload as { accountId?: unknown }).accountId !== accountId ||
    (payload as { assetRef?: unknown }).assetRef !== assetRef ||
    (payload as { deleted?: unknown }).deleted !== true
  ) {
    throw new Error('coreui.errors.assets.payloadInvalid');
  }
  return payload as DeleteAssetPayload;
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
  const normalized = parseAccountAssetRecord(payload);
  if (!normalized) throw new Error('coreui.errors.assets.uploadFailed');
  return normalized;
}

export function AssetsPage() {
  const [headerActions, setHeaderActions] = useState<AssetsHeaderActions | null>(null);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const actionsBusy = Boolean(headerActions?.singleUploadBusy || headerActions?.bulkUploadBusy);

  return (
    <RomaShell
      activeDomain="assets"
      title="Assets"
      headerRight={(
        <>
          <DieterDropdownActions
            className="roma-header-filter"
            ariaLabel="Filter assets by type"
            triggerStyle="button"
            value={assetFilter}
            options={[
              { value: 'all', label: 'Show all' },
              { value: 'font', label: 'Fonts' },
              { value: 'vector', label: 'SVGs' },
              { value: 'image', label: 'Photo' },
              { value: 'video', label: 'Video' },
            ]}
            onChange={(value) => setAssetFilter(value as AssetFilter)}
          />
          {headerActions ? (
            <>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="primary"
                type="button"
                onClick={headerActions.uploadAsset}
                disabled={actionsBusy}
              >
                <span className="diet-btn-txt__label body-m">{headerActions.singleUploadBusy ? 'Uploading…' : 'Upload asset'}</span>
              </button>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="secondary"
                type="button"
                onClick={headerActions.uploadBulk}
                disabled={actionsBusy}
              >
                <span className="diet-btn-txt__label body-m">{headerActions.bulkUploadBusy ? 'Uploading…' : 'Upload in bulk'}</span>
              </button>
              <button
                className="diet-btn-txt"
                data-size="md"
                data-variant="line2"
                type="button"
                onClick={headerActions.refresh}
                disabled={headerActions.listLoading || actionsBusy}
              >
                <span className="diet-btn-txt__label body-m">{headerActions.listLoading ? 'Refreshing…' : 'Refresh list'}</span>
              </button>
            </>
          ) : null}
        </>
      )}
    >
      <RomaAccountNoticeModal />
      <Suspense fallback={<section className="rd-canvas-module">Loading domain...</section>}>
        <RomaDomainErrorBoundary domainLabel="Assets" resetKey="assets">
          <AssetsDomain assetFilter={assetFilter} onHeaderActions={setHeaderActions} />
        </RomaDomainErrorBoundary>
      </Suspense>
    </RomaShell>
  );
}

export function AssetsDomain({
  assetFilter,
  onHeaderActions,
}: {
  assetFilter: AssetFilter;
  onHeaderActions?: (actions: AssetsHeaderActions | null) => void;
}) {
  const { accountContext, data } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const singleUploadInputRef = useRef<HTMLInputElement | null>(null);
  const bulkUploadInputRef = useRef<HTMLInputElement | null>(null);
  const bulkUploadDialogRef = useRef<HTMLDialogElement | null>(null);
  const bulkUploadCloseRef = useRef<HTMLButtonElement | null>(null);
  const bulkUploadBusyRef = useRef(false);

  const accountId = accountContext.accountId;
  const accountPublicId = accountContext.accountPublicId;
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
  const [sort, setSort] = useState<AssetSort>(DEFAULT_ASSET_SORT);

  useEffect(() => {
    bulkUploadBusyRef.current = bulkUploadBusy;
  }, [bulkUploadBusy]);

  useEffect(() => {
    if (!bulkUploadOpen) return;
    const dialog = bulkUploadDialogRef.current;
    if (!dialog) return;
    const dialogLifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => (bulkUploadCloseRef.current?.disabled ? dialog : bulkUploadCloseRef.current),
      requestDismiss(reason) {
        if (reason === 'escape' && !bulkUploadBusyRef.current) setBulkUploadOpen(false);
      },
    });
    dialogLifecycle.open();
    return () => dialogLifecycle.destroy();
  }, [bulkUploadOpen]);

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
      if (
        !assetsPayload ||
        typeof assetsPayload !== 'object' ||
        !Array.isArray((assetsPayload as AccountAssetsListResponse).assets) ||
        typeof (assetsPayload as AccountAssetsListResponse).storageBytesUsed !== 'number'
      ) {
        throw new Error('coreui.errors.assets.invalidPayload');
      }
      const normalizedAssets = (assetsPayload as AccountAssetsListResponse).assets.map(parseAccountAssetRecord);
      if (normalizedAssets.some((asset) => !asset)) {
        throw new Error('coreui.errors.assets.invalidPayload');
      }
      const storageBytesUsed = Number((assetsPayload as AccountAssetsListResponse).storageBytesUsed);
      if (!Number.isFinite(storageBytesUsed) || storageBytesUsed < 0) {
        throw new Error('coreui.errors.assets.invalidPayload');
      }

      setAssets(normalizedAssets as AccountAssetRecord[]);
      setStorageBytesUsed(Math.trunc(storageBytesUsed));
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
        await requestDeleteAsset(accountApi, accountPublicId, asset.assetRef);
        await refreshAssets();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setDeleteError(resolveDeleteErrorCopy(message));
      } finally {
        setDeletingAssetRef(null);
      }
    },
    [accountApi, accountId, accountPublicId, refreshAssets],
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
  const completedBulkCount = successfulBulkCount + failedBulkCount;
  const totalBulkCount = bulkItems.length;
  const uploadingBulkCount = bulkItems.filter((item) => item.status === 'uploading').length;
  const queuedBulkCount = bulkItems.filter((item) => item.status === 'queued').length;
  const bulkProgressLabel =
    totalBulkCount > 0
      ? `${completedBulkCount} of ${totalBulkCount} files processed`
      : 'No files selected';
  const bulkResultLabel =
    !bulkUploadBusy && totalBulkCount > 0
      ? failedBulkCount > 0 && successfulBulkCount > 0
        ? `Partial upload complete: ${successfulBulkCount} uploaded, ${failedBulkCount} failed.`
        : failedBulkCount > 0
          ? `Upload failed for ${failedBulkCount} file${failedBulkCount === 1 ? '' : 's'}.`
          : `${successfulBulkCount} file${successfulBulkCount === 1 ? '' : 's'} uploaded.`
      : null;
  const changeSort = useCallback((key: AssetSortKey) => {
    setSort((current) => current.key === key
      ? {
          key,
          direction: current.direction === 'ascending' ? 'descending' : 'ascending',
        }
      : { key, direction: 'ascending' });
  }, []);

  const sortedAssets = useMemo(() => {
    const rows = (assets ?? []).filter((asset) => assetFilter === 'all' || asset.assetType === assetFilter);
    return rows.slice().sort((left, right) => {
      let comparison: number;
      if (sort.key === 'sizeBytes') {
        comparison = left.sizeBytes - right.sizeBytes;
      } else if (sort.key === 'assetType') {
        comparison = left.assetType.localeCompare(right.assetType);
      } else {
        comparison = left.filename.localeCompare(right.filename);
      }
      if (comparison !== 0) return sort.direction === 'ascending' ? comparison : -comparison;
      return left.filename.localeCompare(right.filename);
    });
  }, [assetFilter, assets, sort]);

  const headerActions = useMemo<AssetsHeaderActions>(() => ({
    uploadAsset: () => singleUploadInputRef.current?.click(),
    uploadBulk: () => bulkUploadInputRef.current?.click(),
    refresh: () => void refreshAssets(),
    singleUploadBusy,
    bulkUploadBusy,
    listLoading: loading,
  }), [bulkUploadBusy, loading, refreshAssets, singleUploadBusy]);

  useEffect(() => {
    onHeaderActions?.(headerActions);
    return () => {
      onHeaderActions?.(null);
    };
  }, [headerActions, onHeaderActions]);

  const storedAssetsLabel = assets == null ? (loading ? 'Loading...' : 'Unavailable') : formatNumber(assets.length);
  const storageUsedLabel = storageBytesUsed == null ? (loading ? 'Loading...' : 'Unavailable') : formatBytes(storageBytesUsed);

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountContext.accountLabel}</p>

        {error ? (
          <div className="roma-inline-stack" role="alert">
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

        <input ref={singleUploadInputRef} type="file" hidden onChange={handleSingleFileChange} aria-label="Upload single asset" />
        <input ref={bulkUploadInputRef} type="file" multiple hidden onChange={handleBulkFileChange} aria-label="Upload multiple assets" />

        {singleUploadError ? <p className="body-m" role="alert">Upload failed: {singleUploadError}</p> : null}
        {deleteError ? <p className="body-m" role="alert">Failed to delete asset: {deleteError}</p> : null}
      </section>

      <section className="rd-canvas-module">
        <div className="diet-table">
        <table className="diet-table__table">
          <thead>
            <tr>
              <th className="label-s" scope="col" aria-sort={sort.key === 'filename' ? sort.direction : 'none'}>
                <span>Asset</span>{' '}
                <button
                  className="diet-btn-ic"
                  data-size="xs"
                  data-variant="neutral"
                  type="button"
                  aria-label="Sort by asset name"
                  onClick={() => changeSort('filename')}
                >
                  <span
                    className="diet-btn-ic__icon diet-icon-mask"
                    style={{
                      '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'filename'
                        ? sort.direction === 'ascending' ? 'arrow.up.svg' : 'arrow.down.svg'
                        : 'arrow.up.arrow.down.svg'}")`,
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th className="label-s" scope="col" aria-sort={sort.key === 'assetType' ? sort.direction : 'none'}>
                <span>Type</span>{' '}
                <button
                  className="diet-btn-ic"
                  data-size="xs"
                  data-variant="neutral"
                  type="button"
                  aria-label="Sort by type"
                  onClick={() => changeSort('assetType')}
                >
                  <span
                    className="diet-btn-ic__icon diet-icon-mask"
                    style={{
                      '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'assetType'
                        ? sort.direction === 'ascending' ? 'arrow.up.svg' : 'arrow.down.svg'
                        : 'arrow.up.arrow.down.svg'}")`,
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th className="label-s" scope="col">MIME</th>
              <th className="label-s" scope="col" aria-sort={sort.key === 'sizeBytes' ? sort.direction : 'none'}>
                <span>Size</span>{' '}
                <button
                  className="diet-btn-ic"
                  data-size="xs"
                  data-variant="neutral"
                  type="button"
                  aria-label="Sort by size"
                  onClick={() => changeSort('sizeBytes')}
                >
                  <span
                    className="diet-btn-ic__icon diet-icon-mask"
                    style={{
                      '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'sizeBytes'
                        ? sort.direction === 'ascending' ? 'arrow.up.svg' : 'arrow.down.svg'
                        : 'arrow.up.arrow.down.svg'}")`,
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th className="label-s diet-table__cell--action" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedAssets.map((asset) => (
              <tr key={asset.assetRef}>
                <td className="body-s">{asset.filename}</td>
                <td className="body-s">{asset.assetType}</td>
                <td className="body-s">{asset.contentType}</td>
                <td className="body-s">{formatBytes(asset.sizeBytes)}</td>
                <td className="body-s diet-table__cell--action">
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
                  <span role={loading ? 'status' : 'alert'}>
                    {loading ? 'Loading assets...' : 'Assets are unavailable right now.'}
                  </span>
                </td>
              </tr>
            ) : sortedAssets.length === 0 ? (
              <tr>
                <td colSpan={5} className="body-s">
                  {assets.length === 0 ? 'No assets found for this account.' : 'No assets match this filter.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </section>

      {bulkUploadOpen ? (
        <dialog ref={bulkUploadDialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-assets-bulk-title" tabIndex={-1}>
          <header className="diet-popup__header">
            <div className="roma-inline-stack">
              <h2 id="roma-assets-bulk-title" className="heading-6">
                Bulk upload
              </h2>
              <p className="body-m">Upload multiple files in one run. Each file is processed independently and failures do not block other files.</p>
            </div>
          </header>
          <div className="diet-popup__body">
            <div className="roma-inline-stack" role={failedBulkCount > 0 && !bulkUploadBusy ? 'alert' : 'status'} aria-live="polite">
              <p className="body-s">{bulkProgressLabel}</p>
              <p className="body-s">Success: {successfulBulkCount}</p>
              <p className="body-s">Failed: {failedBulkCount}</p>
              {bulkUploadBusy ? <p className="body-s">Uploading: {uploadingBulkCount}; queued: {queuedBulkCount}</p> : null}
              {bulkResultLabel ? <p className="body-s">{bulkResultLabel}</p> : null}
            </div>
            <div className="diet-table">
              <table className="diet-table__table">
                <thead>
                  <tr>
                    <th className="label-s">File</th>
                    <th className="label-s">Type</th>
                    <th className="label-s">Size</th>
                    <th className="label-s">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkItems.map((item) => (
                    <tr key={item.id}>
                      <td className="body-s">{item.name}</td>
                      <td className="body-s">{item.contentType}</td>
                      <td className="body-s">{formatBytes(item.sizeBytes)}</td>
                      <td className="body-s">
                        <span role={item.status === 'failed' ? 'alert' : item.status === 'uploading' ? 'status' : undefined}>
                          {formatBulkItemStatus(item.status)}
                          {item.error ? ` - ${item.error}` : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <footer className="diet-popup__footer">
            <div className="diet-popup__actions">
              <button
                ref={bulkUploadCloseRef}
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
          </footer>
        </dialog>
      ) : null}
    </>
  );
}
