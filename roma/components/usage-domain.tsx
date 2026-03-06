'use client';

import { useMemo } from 'react';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

export function UsageDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const accountProfile = me.data?.authz?.profile ?? null;
  const accountRole = me.data?.authz?.role ?? null;
  const entitlements = me.data?.authz?.entitlements ?? null;

  if (me.loading) return <section className="rd-canvas-module body-m">Loading usage context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">Missing account context for usage diagnostics.</section>;
  }

  const enabledFlags = entitlements ? Object.values(entitlements.flags || {}).filter(Boolean).length : 0;
  const capCount = entitlements ? Object.keys(entitlements.caps || {}).length : 0;
  const budgetCount = entitlements ? Object.keys(entitlements.budgets || {}).length : 0;

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountId}</p>
        <p className="body-m">Detailed usage counters are not configured in this environment.</p>
      </section>

      {accountProfile || accountRole ? (
        <section className="rd-canvas-module">
          <div className="roma-grid roma-grid--three">
            <article className="roma-card">
              <h2 className="heading-6">Policy Profile</h2>
              <p className="body-s">{accountProfile ?? 'unknown'}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Role</h2>
              <p className="body-s">{accountRole ?? 'unknown'}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Entitlements</h2>
              <p className="body-s">
                {enabledFlags} flags on / {capCount} caps / {budgetCount} budgets
              </p>
            </article>
          </div>
        </section>
      ) : null}

      {entitlements ? (
        <section className="rd-canvas-module">
          <div className="roma-codeblock">
            <strong className="overline-small">Account Entitlements</strong>
            <pre>{JSON.stringify(entitlements, null, 2)}</pre>
          </div>
        </section>
      ) : null}
    </>
  );
}
