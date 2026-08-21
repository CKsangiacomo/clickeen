'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { AccountAssetRecord } from '@clickeen/ck-contracts';
import { createDialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import assetsCopy from '../l10n/assets/en.json';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';
import { formatBytes, formatNumber } from '../lib/format';
import { useRomaAccountApi, type RomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { useRomaAccountContext } from './roma-account-context';
import { RomaAccountNoticeModal } from './roma-account-notice-modal';
import { RomaCommandConfirmationDialog } from './roma-command-confirmation-dialog';
import { RomaDomainErrorBoundary } from './roma-domain-error-boundary';
import { RomaShell } from './roma-shell';
import { RomaEmptyState, RomaLoadingState } from './roma-system-state';

type DeleteAssetPayload = {
  accountId: string;
  assetRef: string;
  deleted: boolean;
};

type AccountAssetsListResponse = {
  accountId: string;
  storageBytesUsed: number;
  assets: AccountAssetRecord[];
};

type BulkItemStatus = 'queued' | 'uploading' | 'success' | 'failed';

type BulkUploadItem = {
  id: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  status: BulkItemStatus;
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
  listRefreshPending: boolean;
};

const DEFAULT_ASSET_SORT: AssetSort = { key: 'filename', direction: 'ascending' };

function formatBulkItemStatus(status: BulkItemStatus): string {
  switch (status) {
    case 'queued':
      return assetsCopy.bulk.queued;
    case 'uploading':
      return assetsCopy.bulk.uploading;
    case 'success':
      return assetsCopy.bulk.uploaded;
    case 'failed':
      return assetsCopy.bulk.failed;
  }
}

async function requestDeleteAsset(
  accountApi: Pick<RomaAccountApi, 'fetchJson'>,
  assetRef: string,
): Promise<DeleteAssetPayload> {
  return accountApi.fetchJson<DeleteAssetPayload>(`/api/account/assets/${encodeURIComponent(assetRef)}`, {
    method: 'DELETE',
  });
}

async function requestUploadAsset(accountApi: Pick<RomaAccountApi, 'fetchJson'>, file: File, source: string): Promise<AccountAssetRecord> {
  return accountApi.fetchJson<AccountAssetRecord>(`/api/account/assets/upload`, {
    method: 'POST',
    headers: {
      'content-type': file.type,
      'x-filename': file.name,
      'x-source': source,
    },
    body: file,
  });
}

export function AssetsPage() {
  const [headerActions, setHeaderActions] = useState<AssetsHeaderActions | null>(null);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const actionsBusy = Boolean(headerActions?.singleUploadBusy || headerActions?.bulkUploadBusy);

  return (
    <RomaShell
      activeDomain="assets"
      title={assetsCopy.title}
      headerControls={(
        <DieterDropdownActions
          className="roma-header-filter"
          ariaLabel={assetsCopy.filter}
          triggerStyle="button"
          value={assetFilter}
          options={[
            { value: 'all', label: assetsCopy.filters.all },
            { value: 'font', label: assetsCopy.filters.font },
            { value: 'vector', label: assetsCopy.filters.vector },
            { value: 'image', label: assetsCopy.filters.image },
            { value: 'video', label: assetsCopy.filters.video },
          ]}
          onChange={(value) => setAssetFilter(value as AssetFilter)}
        />
      )}
      headerRight={headerActions ? (
        <>
          <button
            className="diet-button"
            data-size="large"
            data-type="primary"
            data-loading={headerActions.singleUploadBusy || undefined}
            type="button"
            aria-busy={headerActions.singleUploadBusy || undefined}
            onClick={headerActions.uploadAsset}
            disabled={actionsBusy}
          >
            {headerActions.singleUploadBusy ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">{headerActions.singleUploadBusy ? assetsCopy.uploading : assetsCopy.upload}</span>
          </button>
          <button
            className="diet-button"
            data-size="large"
            data-type="secondary"
            data-loading={headerActions.bulkUploadBusy || undefined}
            type="button"
            aria-busy={headerActions.bulkUploadBusy || undefined}
            onClick={headerActions.uploadBulk}
            disabled={actionsBusy}
          >
            {headerActions.bulkUploadBusy ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">{headerActions.bulkUploadBusy ? assetsCopy.uploading : assetsCopy.uploadBulk}</span>
          </button>
          <button
            className="diet-button"
            data-size="large"
            data-type="tertiary"
            data-loading={headerActions.listRefreshPending || undefined}
            type="button"
            aria-busy={headerActions.listRefreshPending || undefined}
            onClick={headerActions.refresh}
            disabled={headerActions.listLoading || actionsBusy}
          >
            {headerActions.listRefreshPending ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">{headerActions.listRefreshPending ? assetsCopy.refreshing : assetsCopy.refresh}</span>
          </button>
        </>
      ) : null}
    >
      <RomaAccountNoticeModal />
      <Suspense fallback={<RomaLoadingState className="rd-canvas-module" />}>
        <RomaDomainErrorBoundary domainLabel={assetsCopy.title} resetKey="assets">
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

  const entitlements = data.authz.entitlements;
  const uploadSizeLimitBytes = entitlements.limits['uploads.size.max'];
  const storageLimit = entitlements.limits['storage.bytes.max'];

  const [assets, setAssets] = useState<AccountAssetRecord[] | null>(null);
  const [storageBytesUsed, setStorageBytesUsed] = useState<number | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listRefreshPending, setListRefreshPending] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [deletingAssetRef, setDeletingAssetRef] = useState<string | null>(null);
  const [deleteConfirmationAsset, setDeleteConfirmationAsset] = useState<AccountAssetRecord | null>(null);
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

  const refreshAssets = useCallback(async (options?: { passive?: boolean; preserveError?: boolean }) => {
    const passive = options?.passive !== false;
    if (passive) setLoading(true);
    if (!options?.preserveError) setListFailed(false);
    try {
      const exact = await accountApi.fetchJson<AccountAssetsListResponse>(`/api/account/assets`, {
        method: 'GET',
      });
      setAssets(exact.assets);
      setStorageBytesUsed(exact.storageBytesUsed);
      setListFailed(false);
    } catch {
      setListFailed(true);
    } finally {
      if (passive) setLoading(false);
    }
  }, [accountApi]);

  const refreshAssetsFromControl = useCallback(async () => {
    setListRefreshPending(true);
    try {
      await refreshAssets({ passive: false, preserveError: true });
    } finally {
      setListRefreshPending(false);
    }
  }, [refreshAssets]);

  const retryAssets = useCallback(async () => {
    setRetryPending(true);
    try {
      await refreshAssets({ passive: false, preserveError: true });
    } finally {
      setRetryPending(false);
    }
  }, [refreshAssets]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const deleteAsset = useCallback(
    async (asset: AccountAssetRecord) => {
      setDeletingAssetRef(asset.assetRef);
      try {
        await requestDeleteAsset(accountApi, asset.assetRef);
        setDeleteConfirmationAsset(null);
        void refreshAssets();
        return true;
      } catch {
        return false;
      } finally {
        setDeletingAssetRef(null);
      }
    },
    [accountApi, refreshAssets],
  );

  const handleDeleteAsset = useCallback(
    (asset: AccountAssetRecord) => {
      setDeleteConfirmationAsset(asset);
    },
    [],
  );

  const uploadSingle = useCallback(
    async (file: File) => {
      setSingleUploadBusy(true);
      try {
        await requestUploadAsset(accountApi, file, 'api');
        await refreshAssets();
      } catch {
      } finally {
        setSingleUploadBusy(false);
      }
    },
    [accountApi, refreshAssets],
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
      if (files.length === 0) return;
      const initial: BulkUploadItem[] = files.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        sizeBytes: file.size,
        contentType: file.type,
        status: 'queued',
      }));
      setBulkItems(initial);
      setBulkUploadOpen(true);
      setBulkUploadBusy(true);

      let uploadedAny = false;
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]!;
        const item = initial[i]!;

        updateBulkItem(item.id, { status: 'uploading' });
        try {
          await requestUploadAsset(accountApi, file, 'api');
          updateBulkItem(item.id, { status: 'success' });
          uploadedAny = true;
        } catch {
          updateBulkItem(item.id, { status: 'failed' });
        }
      }

      setBulkUploadBusy(false);
      if (uploadedAny) {
        await refreshAssets();
      }
    },
    [accountApi, refreshAssets, updateBulkItem],
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
    refresh: () => void refreshAssetsFromControl(),
    singleUploadBusy,
    bulkUploadBusy,
    listLoading: loading,
    listRefreshPending,
  }), [bulkUploadBusy, listRefreshPending, loading, refreshAssetsFromControl, singleUploadBusy]);

  useEffect(() => {
    onHeaderActions?.(headerActions);
    return () => {
      onHeaderActions?.(null);
    };
  }, [headerActions, onHeaderActions]);

  const storedAssetsLabel = assets == null
    ? null
    : formatNumber(assets.length);
  const storageUsedLabel = storageBytesUsed == null
    ? null
    : formatBytes(storageBytesUsed);

  return (
    <>
      <section className="rd-canvas-module">
        <p className="label-s">{assetsCopy.account}</p>
        <p className="body-m">{accountContext.accountLabel}</p>

        {listFailed ? (
          <div className="roma-inline-stack" role="alert">
            <button
              className="diet-button"
              data-size="medium"
              data-type="tertiary"
              data-loading={retryPending || undefined}
              type="button"
              aria-busy={retryPending || undefined}
              onClick={() => void retryAssets()}
              disabled={retryPending}
            >
              {retryPending ? <span className="diet-spinner" aria-hidden="true" /> : null}
              <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.retry}</span>
            </button>
          </div>
        ) : null}
        {storedAssetsLabel !== null ? <><p className="label-s">{assetsCopy.stored}</p><p className="body-m">{storedAssetsLabel}</p></> : null}
        {storageUsedLabel !== null ? (
          <><p className="label-s">{assetsCopy.storageUsed}</p><p className="body-m">{storageUsedLabel} / {storageLimit === null ? assetsCopy.unlimited : formatBytes(storageLimit)}</p></>
        ) : null}
        <p className="label-s">{assetsCopy.uploadLimit}</p>
        <p className="body-m">
          {uploadSizeLimitBytes === null ? assetsCopy.unlimited : formatBytes(uploadSizeLimitBytes)}
        </p>

        <input ref={singleUploadInputRef} type="file" hidden onChange={handleSingleFileChange} aria-label={assetsCopy.uploadSingleAccessible} />
        <input ref={bulkUploadInputRef} type="file" multiple hidden onChange={handleBulkFileChange} aria-label={assetsCopy.uploadMultipleAccessible} />
      </section>

      <section className="rd-canvas-module">
        <div className="diet-table">
        <table className="diet-table__table">
          <thead>
            <tr>
              <th className="label-s" scope="col" aria-sort={sort.key === 'filename' ? sort.direction : 'none'}>
                <span>{assetsCopy.columns.asset}</span>{' '}
                <button
                  className="diet-button"
                  data-size="small"
                  data-type="quaternary"
                  type="button"
                  aria-label={assetsCopy.sort.asset}
                  onClick={() => changeSort('filename')}
                >
                  <span
                    className="diet-icon diet-icon-mask"
                    data-size="12"
                    style={{
                      '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'filename'
                        ? sort.direction === 'ascending' ? 'chevron.up.2.svg' : 'chevron.down.2.svg'
                        : 'chevron.down.dotted.2.svg'}")`,
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th className="label-s" scope="col" aria-sort={sort.key === 'assetType' ? sort.direction : 'none'}>
                <span>{assetsCopy.columns.type}</span>{' '}
                <button
                  className="diet-button"
                  data-size="small"
                  data-type="quaternary"
                  type="button"
                  aria-label={assetsCopy.sort.type}
                  onClick={() => changeSort('assetType')}
                >
                  <span
                    className="diet-icon diet-icon-mask"
                    data-size="12"
                    style={{
                      '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'assetType'
                        ? sort.direction === 'ascending' ? 'chevron.up.2.svg' : 'chevron.down.2.svg'
                        : 'chevron.down.dotted.2.svg'}")`,
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th className="label-s" scope="col">{assetsCopy.columns.mime}</th>
              <th className="label-s" scope="col" aria-sort={sort.key === 'sizeBytes' ? sort.direction : 'none'}>
                <span>{assetsCopy.columns.size}</span>{' '}
                <button
                  className="diet-button"
                  data-size="small"
                  data-type="quaternary"
                  type="button"
                  aria-label={assetsCopy.sort.size}
                  onClick={() => changeSort('sizeBytes')}
                >
                  <span
                    className="diet-icon diet-icon-mask"
                    data-size="12"
                    style={{
                      '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'sizeBytes'
                        ? sort.direction === 'ascending' ? 'chevron.up.2.svg' : 'chevron.down.2.svg'
                        : 'chevron.down.dotted.2.svg'}")`,
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                </button>
              </th>
              <th className="label-s diet-table__cell--action" scope="col">{assetsCopy.columns.actions}</th>
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
                    className="diet-button"
                    data-size="medium"
                    data-type="secondary"
                    type="button"
                    onClick={() => handleDeleteAsset(asset)}
                    disabled={deletingAssetRef === asset.assetRef}
                  >
                    <span className="diet-button__label">{assetsCopy.delete}</span>
                  </button>
                </td>
              </tr>
            ))}
            {assets == null ? (
              <tr>
                <td colSpan={5} className="diet-data-table__state-cell">
                  {loading ? <RomaLoadingState /> : null}
                </td>
              </tr>
            ) : sortedAssets.length === 0 ? (
              <tr>
                <td colSpan={5} className="diet-data-table__state-cell">
                  <RomaEmptyState>
                    {assets.length === 0
                      ? assetsCopy.empty
                      : assetsCopy.filteredEmpty}
                  </RomaEmptyState>
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
              <h2 id="roma-assets-bulk-title" className="heading-4">
                {assetsCopy.bulk.title}
              </h2>
            </div>
            <button
              className="diet-button diet-popup__dismiss"
              data-size="medium"
              data-type="quaternary"
              type="button"
              aria-label={ROMA_DIALOGS_UI_COPY.close}
              onClick={() => setBulkUploadOpen(false)}
              disabled={bulkUploadBusy}
            >
              <span className="diet-icon" data-icon="multiply" aria-hidden="true" />
            </button>
          </header>
          <div className="diet-popup__body">
            <div className="roma-inline-stack" role={failedBulkCount > 0 && !bulkUploadBusy ? 'alert' : 'status'} aria-live="polite">
              <p className="label-s">{assetsCopy.bulk.processed}</p><p className="body-s">{completedBulkCount} / {totalBulkCount}</p>
              <p className="label-s">{assetsCopy.bulk.success}</p><p className="body-s">{successfulBulkCount}</p>
              <p className="label-s">{assetsCopy.bulk.failed}</p><p className="body-s">{failedBulkCount}</p>
              {bulkUploadBusy ? <><p className="label-s">{assetsCopy.bulk.uploading}</p><p className="body-s">{uploadingBulkCount}</p><p className="label-s">{assetsCopy.bulk.queued}</p><p className="body-s">{queuedBulkCount}</p></> : null}
            </div>
            <div className="diet-table">
              <table className="diet-table__table">
                <thead>
                  <tr>
                    <th className="label-s">{assetsCopy.columns.file}</th>
                    <th className="label-s">{assetsCopy.columns.type}</th>
                    <th className="label-s">{assetsCopy.columns.size}</th>
                    <th className="label-s">{assetsCopy.columns.status}</th>
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
                className="diet-button"
                data-size="medium"
                data-type="tertiary"
                type="button"
                onClick={() => bulkUploadInputRef.current?.click()}
                disabled={bulkUploadBusy}
              >
                <span className="diet-button__label">{assetsCopy.bulk.addMore}</span>
              </button>
              <button
                className="diet-button"
                data-size="medium"
                data-type="secondary"
                type="button"
                onClick={() => setBulkUploadOpen(false)}
                disabled={bulkUploadBusy}
              >
                <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.close}</span>
              </button>
            </div>
          </footer>
        </dialog>
      ) : null}
      <RomaCommandConfirmationDialog
        open={Boolean(deleteConfirmationAsset)}
        title={assetsCopy.delete}
        body={deleteConfirmationAsset?.filename}
        confirmLabel={assetsCopy.delete}
        pending={Boolean(deleteConfirmationAsset && deletingAssetRef === deleteConfirmationAsset.assetRef)}
        onCancel={() => setDeleteConfirmationAsset(null)}
        onConfirm={() => {
          const asset = deleteConfirmationAsset;
          if (asset) void deleteAsset(asset);
        }}
      />
    </>
  );
}
