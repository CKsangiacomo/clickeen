'use client';

import { useMemo } from 'react';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { resolveActiveRomaAccount, resolveActiveRomaContext, useRomaMe } from './use-roma-me';

export function BillingDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveActiveRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const activeAccount = useMemo(() => resolveActiveRomaAccount(me.data), [me.data]);

  if (me.loading) return <section className="rd-canvas-module body-m">Loading billing context...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveAccountShellErrorCopy(
          me.error ?? 'coreui.errors.auth.contextUnavailable',
          'Billing is unavailable right now. Please try again.',
        )}
      </section>
    );
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account is available for billing controls right now.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {context.accountName || 'Current account'}</p>
        {context.accountSlug ? <p className="body-s">Slug: {context.accountSlug}</p> : null}
        <p className="body-m">Billing is not configured for this account yet.</p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Current plan</h2>
            <p className="body-s">{activeAccount?.tier ?? 'unknown'}</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">Billing status</h2>
            <p className="body-s">Not available yet</p>
          </article>
          <article className="roma-card">
            <h2 className="heading-6">What to do</h2>
            <p className="body-s">Use Settings for account ownership changes and current plan visibility.</p>
          </article>
        </div>
      </section>
    </>
  );
}
