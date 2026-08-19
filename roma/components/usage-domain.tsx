'use client';

import { useEffect, useState } from 'react';
import { formatAccountTierLabel, formatBytes } from '../lib/format';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';

type UsageStorageResponse = {
  accountId: string;
  storageBytesUsed: number;
};

export function UsageDomain() {
  const { accountContext, activeAccount, data } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const accountId = accountContext.accountId;
  const entitlements = data.authz.entitlements;
  const [storageBytesUsed, setStorageBytesUsed] = useState<number | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);

  const storageLimit = entitlements.limits['storage.bytes.max'] ?? null;
  const storageLimitLabel =
    typeof storageLimit === 'number' && Number.isFinite(storageLimit) && storageLimit > 0 ? formatBytes(storageLimit) : 'Unlimited';
  const storageUsedLabel = storageLoading ? 'Loading...' : storageBytesUsed == null ? 'Unavailable' : formatBytes(storageBytesUsed);

  useEffect(() => {
    let cancelled = false;
    async function loadStorageUsage() {
      setStorageLoading(true);
      setStorageError(false);
      try {
        const payload = await accountApi.fetchJson<UsageStorageResponse>(`/api/account/usage`, {
          method: 'GET',
        });
        if (!cancelled) {
          setStorageBytesUsed(payload.storageBytesUsed);
          setStorageError(false);
        }
      } catch {
        if (!cancelled) {
          setStorageBytesUsed(null);
          setStorageError(true);
        }
      } finally {
        if (!cancelled) setStorageLoading(false);
      }
    }
    void loadStorageUsage();
    return () => {
      cancelled = true;
    };
  }, [accountApi, accountId]);

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountContext.accountLabel}</p>
        <p className="body-m">Storage usage is live. Broader usage reporting is not connected in Roma yet.</p>
        {storageError ? (
          <p className="body-m" role="alert">
            Storage usage could not be loaded.
          </p>
        ) : null}
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Current plan</h2>
            <p className="body-s">{formatAccountTierLabel(activeAccount.tier)}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">Storage used</h2>
            <p className="body-s">{storageUsedLabel}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">Storage limit</h2>
            <p className="body-s">{storageLimitLabel}</p>
          </article>
        </div>
      </section>
    </>
  );
}
