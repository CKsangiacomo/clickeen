'use client';

import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/format';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';

type UsageStorageResponse = {
  storageBytesUsed?: number;
};

export function UsageDomain() {
  const { accountContext, activeAccount, data } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const accountId = accountContext.accountId;
  const entitlements = data.authz?.entitlements ?? null;
  const [storageBytesUsed, setStorageBytesUsed] = useState<number | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);

  const storageBudget = entitlements?.budgets?.['budget.uploads.bytes'] ?? null;
  const storageLimitLabel =
    typeof storageBudget?.max === 'number' && Number.isFinite(storageBudget.max) && storageBudget.max > 0 ? formatBytes(storageBudget.max) : 'Unlimited';
  const storageUsedLabel = storageLoading ? 'Loading...' : storageBytesUsed == null ? 'Unavailable' : formatBytes(storageBytesUsed);

  useEffect(() => {
    let cancelled = false;
    async function loadStorageUsage() {
      setStorageLoading(true);
      try {
        const response = await accountApi.fetchRaw(`/api/account/usage`, {
          method: 'GET',
        });
        const payload = (await response.json().catch(() => null)) as UsageStorageResponse | { error?: unknown } | null;
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const next =
          payload && typeof payload === 'object' && 'storageBytesUsed' in payload && typeof payload.storageBytesUsed === 'number'
            ? Math.max(0, Math.trunc(payload.storageBytesUsed))
            : null;
        if (!cancelled) setStorageBytesUsed(next);
      } catch {
        if (!cancelled) setStorageBytesUsed(null);
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
        <p className="body-m">Account: {accountContext.accountName}</p>
        <p className="body-s">Slug: {accountContext.accountSlug}</p>
        <p className="body-m">Detailed usage reporting is not available in Roma yet.</p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Current plan</h2>
            <p className="body-s">{activeAccount.tier}</p>
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
