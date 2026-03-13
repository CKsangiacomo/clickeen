'use client';

import { useMemo } from 'react';
import { formatBytes } from '../lib/format';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

export function UsageDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const activeAccount = useMemo(
    () => (accountId ? me.data?.accounts?.find((account) => account.accountId === accountId) ?? null : null),
    [accountId, me.data?.accounts],
  );
  const entitlements = me.data?.authz?.entitlements ?? null;

  const storageBudget = entitlements?.budgets?.['budget.uploads.bytes'] ?? null;
  const storageLimitLabel =
    typeof storageBudget?.max === 'number' && Number.isFinite(storageBudget.max) && storageBudget.max > 0
      ? formatBytes(storageBudget.max)
      : 'Unlimited';
  const storageUsedLabel = formatBytes(storageBudget?.used ?? 0);

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
