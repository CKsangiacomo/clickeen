'use client';

import { useEffect, useState } from 'react';
import usageCopy from '../l10n/usage/en.json';
import { formatAccountTierLabel, formatBytes } from '../lib/format';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';
import { RomaLoadingState } from './roma-system-state';

type UsageStorageResponse = {
  accountId: string;
  storageBytesUsed: number;
};

export function UsageDomain() {
  const { activeAccount, accountContext, data } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const accountId = accountContext.accountId;
  const entitlements = data.authz.entitlements;
  const [storageBytesUsed, setStorageBytesUsed] = useState<number | null>(null);
  const [storageLoading, setStorageLoading] = useState(true);

  const storageLimit = entitlements.limits['storage.bytes.max'];
  const storageLimitLabel = storageLimit === null ? usageCopy.unlimited : formatBytes(storageLimit);
  const storageUsedLabel = storageBytesUsed == null ? null : formatBytes(storageBytesUsed);

  useEffect(() => {
    let cancelled = false;
    async function loadStorageUsage() {
      setStorageLoading(true);
      try {
        const payload = await accountApi.fetchJson<UsageStorageResponse>(`/api/account/usage`, {
          method: 'GET',
        });
        if (!cancelled) {
          setStorageBytesUsed(payload.storageBytesUsed);
        }
      } catch {
        if (!cancelled) {
          setStorageBytesUsed(null);
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
        {storageLoading ? <RomaLoadingState /> : null}
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">{usageCopy.currentPlan}</h2>
            <p className="body-s">{formatAccountTierLabel(activeAccount.tier)}</p>
          </article>
          {storageUsedLabel !== null ? (
            <article className="roma-card">
              <h2 className="heading-6">{usageCopy.storageUsed}</h2>
              <p className="body-s">{storageUsedLabel}</p>
            </article>
          ) : null}
          <article className="roma-card">
            <h2 className="heading-6">{usageCopy.storageLimit}</h2>
            <p className="body-s">{storageLimitLabel}</p>
          </article>
        </div>
      </section>
    </>
  );
}
