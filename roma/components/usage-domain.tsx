'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatBytes } from '../lib/format';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { useRomaAccountApi } from './account-api';
import { resolveActiveRomaAccount, resolveActiveRomaContext, useRomaMe } from './use-roma-me';

type UsageStorageResponse = {
  storageBytesUsed?: number;
};

export function UsageDomain() {
  const me = useRomaMe();
  const accountApi = useRomaAccountApi(me.data);
  const context = useMemo(() => resolveActiveRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const activeAccount = useMemo(() => resolveActiveRomaAccount(me.data), [me.data]);
  const entitlements = me.data?.authz?.entitlements ?? null;
  const [storageBytesUsed, setStorageBytesUsed] = useState<number | null>(null);

  const storageBudget = entitlements?.budgets?.['budget.uploads.bytes'] ?? null;
  const storageLimitLabel =
    typeof storageBudget?.max === 'number' && Number.isFinite(storageBudget.max) && storageBudget.max > 0
      ? formatBytes(storageBudget.max)
      : 'Unlimited';
  const storageUsedLabel = storageBytesUsed == null ? 'Unavailable' : formatBytes(storageBytesUsed);

  useEffect(() => {
    let cancelled = false;
    async function loadStorageUsage() {
      if (!accountId) {
        if (!cancelled) setStorageBytesUsed(null);
        return;
      }
      try {
        const response = await accountApi.fetchRaw(`/api/assets/${encodeURIComponent(accountId)}?limit=1`, {
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
      }
    }
    void loadStorageUsage();
    return () => {
      cancelled = true;
    };
  }, [accountApi, accountId]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading usage context...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveAccountShellErrorCopy(
          me.error ?? 'coreui.errors.auth.contextUnavailable',
          'Usage is unavailable right now. Please try again.',
        )}
      </section>
    );
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account is available for usage right now.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {context.accountName || 'Current account'}</p>
        {context.accountSlug ? <p className="body-s">Slug: {context.accountSlug}</p> : null}
        <p className="body-m">Detailed usage reporting is not available in Roma yet.</p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Current plan</h2>
            <p className="body-s">{activeAccount?.tier ?? 'unknown'}</p>
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
