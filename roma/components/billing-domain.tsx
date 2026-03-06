'use client';

import { useMemo } from 'react';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

export function BillingDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const activeAccount = useMemo(
    () => (accountId ? me.data?.accounts?.find((account) => account.accountId === accountId) ?? null : null),
    [accountId, me.data?.accounts],
  );

  if (me.loading) return <section className="rd-canvas-module body-m">Loading billing context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account membership found for billing controls.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountId}</p>
        <p className="body-m">Billing is not configured in this environment.</p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Plan Tier</h2>
            <p className="body-s">{activeAccount?.tier ?? 'unknown'}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">Status</h2>
            <p className="body-s">not_configured</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">Provider</h2>
            <p className="body-s">stripe</p>
          </article>
        </div>
      </section>
    </>
  );
}
