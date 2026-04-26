'use client';

import { useRomaAccountContext } from './roma-account-context';

export function BillingDomain() {
  const { accountContext, activeAccount } = useRomaAccountContext();

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountContext.accountName}</p>
        <p className="body-s">Slug: {accountContext.accountSlug}</p>
        <p className="body-m">Billing is not configured for this account yet.</p>
      </section>

      <section className="rd-canvas-module">
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2 className="heading-6">Current plan</h2>
            <p className="body-s">{activeAccount.tier}</p>
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
